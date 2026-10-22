/**
 * 核心层冒烟测试（零依赖，直接用 node 跑）
 *
 *   node frontend/test/core.smoke.js
 *
 * 只验证纯逻辑部分：转义、路由匹配、生命周期清理。
 * 这些是最容易写错、也最容易静默失效的地方 —— 比如旧代码里
 * escapeHtml 漏转义引号导致 XSS，以及切页后定时器残留。
 *
 * 不依赖 jsdom：用 vm 建一个最小浏览器桩，把 core 层加载进去。
 */
'use strict';

var vm = require('vm');
var fs = require('fs');
var path = require('path');
var assert = require('assert');

var CORE_DIR = path.join(__dirname, '..', 'js', 'core');
var CORE_FILES = ['dom.js', 'ui.js', 'view.js', 'router.js'];

// ========== 最小浏览器桩 ==========

var sandbox = {
    console: console,
    setTimeout: setTimeout,
    clearTimeout: clearTimeout,
    Promise: Promise,
    requestAnimationFrame: function (fn) { return setTimeout(fn, 0); },
    location: { pathname: '/', href: 'http://localhost/' },
    history: { pushState: function () {}, replaceState: function () {} },
    localStorage: (function () {
        var data = {};
        return {
            getItem: function (k) { return k in data ? data[k] : null; },
            setItem: function (k, v) { data[k] = String(v); },
            removeItem: function (k) { delete data[k]; }
        };
    })(),
    sessionStorage: (function () {
        var data = {};
        return {
            getItem: function (k) { return k in data ? data[k] : null; },
            setItem: function (k, v) { data[k] = String(v); },
            removeItem: function (k) { delete data[k]; }
        };
    })(),
    CustomEvent: function (type, init) {
        this.type = type;
        this.detail = init && init.detail;
    },
    dispatchEvent: function () {},
    addEventListener: function () {},
    document: {
        getElementById: function () { return null; },
        querySelector: function () { return null; },
        querySelectorAll: function () { return []; },
        createElement: function () {
            return {
                style: {}, dataset: {}, classList: { add: function () {}, remove: function () {}, toggle: function () {} },
                appendChild: function () {}, setAttribute: function () {}, removeChild: function () {}
            };
        },
        addEventListener: function () {},
        body: { style: {} },
        head: { appendChild: function () {} }
    },
    AbortController: typeof AbortController !== 'undefined' ? AbortController : undefined,
    echarts: undefined,
    fetch: function () {
        return Promise.reject(new Error('测试环境不发起网络请求'));
    }
};
sandbox.window = sandbox;
sandbox.globalThis = sandbox;
vm.createContext(sandbox);

CORE_FILES.forEach(function (file) {
    var full = path.join(CORE_DIR, file);
    vm.runInContext(fs.readFileSync(full, 'utf-8'), sandbox, { filename: file });
});

var App = sandbox.App;

// ========== 测试框架 ==========

var passed = 0;
var failed = 0;

function test(name, fn) {
    try {
        fn();
        passed++;
        console.log('  PASS  ' + name);
    } catch (e) {
        failed++;
        console.log('  FAIL  ' + name);
        console.log('        ' + e.message);
    }
}

async function testAsync(name, fn) {
    try {
        await fn();
        passed++;
        console.log('  PASS  ' + name);
    } catch (e) {
        failed++;
        console.log('  FAIL  ' + name);
        console.log('        ' + e.message);
    }
}

// ========== 用例 ==========

async function main() {
    console.log('\n[1] 核心层加载');
    test('四个模块均挂载到 App 命名空间', function () {
        assert.ok(App, 'App 未创建');
        assert.ok(App.dom, 'App.dom 缺失');
        assert.ok(App.ui, 'App.ui 缺失');
        assert.ok(App.views, 'App.views 缺失');
        assert.ok(App.router, 'App.router 缺失');
    });

    console.log('\n[2] escapeHtml 安全性（修复 customer.html 的 XSS 缺口）');
    test('转义尖括号', function () {
        assert.strictEqual(App.dom.escapeHtml('<script>'), '&lt;script&gt;');
    });
    test('转义双引号（旧 customer 实现漏掉，可属性逃逸）', function () {
        assert.strictEqual(App.dom.escapeHtml('a"b'), 'a&quot;b');
    });
    test('转义单引号（旧 customer 实现漏掉）', function () {
        assert.strictEqual(App.dom.escapeHtml("a'b"), 'a&#39;b');
    });
    test('转义 & 且不重复转义', function () {
        assert.strictEqual(App.dom.escapeHtml('a&b'), 'a&amp;b');
    });
    test('null / undefined 返回空串而不抛错', function () {
        assert.strictEqual(App.dom.escapeHtml(null), '');
        assert.strictEqual(App.dom.escapeHtml(undefined), '');
    });
    test('属性逃逸场景被阻断', function () {
        var payload = '" onmouseover="alert(1)';
        var out = '<div title="' + App.dom.escapeHtml(payload) + '">';
        assert.ok(out.indexOf('onmouseover="alert') === -1, '属性逃逸未被阻断: ' + out);
    });

    console.log('\n[3] 分页按钮 HTML');
    test('paginationButtonsHtml 输出页码和每页条数', function () {
        assert.ok(typeof App.ui.paginationButtonsHtml === 'function');
        var html = App.ui.paginationButtonsHtml({
            page: 1,
            pageSize: 10,
            total: 25,
            sizeSelectId: 'page-size-select'
        });
        assert.ok(html.indexOf('data-page="2"') !== -1, '应包含第 2 页按钮');
        assert.ok(html.indexOf('id="page-size-select"') !== -1, '应包含每页条数');
        assert.ok(html.indexOf('page-prev') !== -1, '应包含上一页');
    });

    console.log('\n[4] 金额与日期格式化');
    test('formatMoney 保留两位并加符号', function () {
        assert.strictEqual(App.dom.formatMoney(1234.5), '¥1,234.50');
    });
    test('formatMoneyCompact 万位缩写', function () {
        assert.strictEqual(App.dom.formatMoneyCompact(12345), '¥1.2万');
    });
    test('formatDate 补零', function () {
        assert.strictEqual(App.dom.formatDate('2026-01-05T08:00:00'), '2026-01-05');
    });
    test('formatDate 非法输入返回空串', function () {
        assert.strictEqual(App.dom.formatDate('not-a-date'), '');
    });

    console.log('\n[4] 路由匹配');
    test('静态路径匹配', function () {
        App.router.add('/orders', 'orders');
        var m = App.router.match('/orders');
        assert.ok(m, '未匹配');
        assert.strictEqual(m.name, 'orders');
    });
    test('动态参数匹配', function () {
        App.router.add('/orders/:id', 'orderDetail');
        var m = App.router.match('/orders/abc123');
        assert.ok(m, '未匹配');
        assert.strictEqual(m.name, 'orderDetail');
        assert.strictEqual(m.params.id, 'abc123');
    });
    test('长路径优先（/orders/:id 不被 /orders 抢先）', function () {
        var m = App.router.match('/orders/xyz');
        assert.strictEqual(m.name, 'orderDetail');
    });
    test('尾部斜杠容错', function () {
        var m = App.router.match('/orders/');
        assert.strictEqual(m.name, 'orders');
    });
    test('未注册路径返回 null', function () {
        assert.strictEqual(App.router.match('/nope'), null);
    });
    test('URL 参数被解码', function () {
        App.router.add('/c/:name', 'c');
        var m = App.router.match('/c/%E6%96%87');
        assert.strictEqual(m.params.name, '文');
    });

    console.log('\n[5] 生命周期清理（根治切页残留）');
    await testAsync('onCleanup 登记的函数在切页时逆序执行', async function () {
        var order = [];
        App.view('lifecycle-test', {
            path: '/lifecycle-test',
            template: null,
            async mount(root, ctx) {
                ctx.onCleanup(function () { order.push('first'); });
                ctx.onCleanup(function () { order.push('second'); });
                order.push('mount');
            }
        });

        var activation = await App.views.activate('lifecycle-test', {}, '/lifecycle-test');
        await activation.mount({});
        assert.deepStrictEqual(order, ['mount']);

        App.views.runCleanup();
        assert.deepStrictEqual(order, ['mount', 'second', 'first'], '应逆序执行，实际: ' + order.join(','));
    });

    await testAsync('清理函数抛错不影响其余清理执行', async function () {
        var count = 0;
        App.view('throw-test', {
            path: '/throw-test',
            async mount(root, ctx) {
                ctx.onCleanup(function () { count++; });
                ctx.onCleanup(function () { throw new Error('故意失败'); });
                ctx.onCleanup(function () { count++; });
            }
        });
        var activation = await App.views.activate('throw-test', {}, '/throw-test');
        await activation.mount({});
        App.views.runCleanup();
        assert.strictEqual(count, 2, '其余清理函数应仍被执行');
    });

    console.log('\n[6] 视图重新进入（伪 SPA 的经典故障场景）');
    await testAsync('同一视图连续进入两次不报错', async function () {
        var mountCount = 0;
        App.view('reenter', {
            path: '/reenter',
            async mount(root, ctx) {
                mountCount++;
                ctx.onCleanup(function () {});
            }
        });
        var a1 = await App.views.activate('reenter', {}, '/reenter');
        await a1.mount({});
        App.views.runCleanup();
        var a2 = await App.views.activate('reenter', {}, '/reenter');
        await a2.mount({});
        assert.strictEqual(mountCount, 2, '第二次进入应正常执行 mount');
    });

    // ========== 汇总 ==========
    console.log('\n' + '='.repeat(46));
    console.log('  通过 ' + passed + ' 项，失败 ' + failed + ' 项');
    console.log('='.repeat(46) + '\n');

    if (failed > 0) process.exitCode = 1;
}

main().catch(function (e) {
    console.error('测试脚本自身异常:', e);
    process.exitCode = 1;
});
