/** 不依赖 Android SDK：验证原生返回键接入实际路由及弹层优先级。 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { matchRoute } from '../src/config/routes.js';

var source = readFileSync(new URL('../src/platform/android/page.js', import.meta.url), 'utf8')
    .replace(/^import .*;$/gm, '').replace('export function startPlatform', 'function startPlatform');

function shell(options) {
    var opts = options || {};
    var calls = [];
    var listener;
    var context = vm.createContext({
        App: {
            addListener: function (name, fn) { calls.push(name); listener = fn; return Promise.resolve(); },
            minimizeApp: function () { calls.push('minimize'); return Promise.resolve(); }
        },
        getPath: function () { return opts.path || '/'; },
        goBack: function (fallback) { calls.push('back:' + fallback); },
        matchRoute: matchRoute,
        window: { dispatchEvent: function () { return opts.cancelled !== true; } },
        document: { querySelectorAll: function () { return opts.dialogs || []; } },
        Event: globalThis.Event,
        console: console
    });
    vm.runInContext(source, context);
    context.startPlatform();
    return { calls: calls, pressBack: function () { listener(); }, start: context.startPlatform };
}

test('重复启动只绑定一个原生监听器', function () {
    var app = shell();
    app.start();
    assert.deepEqual(app.calls, ['backButton']);
});

test('首页与登录页返回时最小化应用', function () {
    ['/', '/login'].forEach(function (path) {
        var app = shell({ path: path });
        app.pressBack();
        assert.deepEqual(app.calls, ['backButton', 'minimize']);
    });
});

test('详情页复用路由父级，一级页与未知页回落首页', function () {
    ['/orders/123', '/customers/456', '/orders', '/unknown'].forEach(function (path) {
        var app = shell({ path: path });
        app.pressBack();
        assert.deepEqual(app.calls, ['backButton', 'back:' + (matchRoute(path).parent || '/')]);
    });
});

test('顶部弹层先取消，不能触发页面返回', function () {
    var cancelled = [];
    var app = shell({ path: '/orders', dialogs: [
        { querySelector: function () { return { click: function () { cancelled.push('lower'); } }; } },
        { querySelector: function () { return { click: function () { cancelled.push('top'); } }; } }
    ] });
    app.pressBack();
    assert.deepEqual(cancelled, ['top']);
    assert.deepEqual(app.calls, ['backButton']);
});

test('未识别模态框阻止后台导航', function () {
    var app = shell({ dialogs: [{ querySelector: function () { return null; } }] });
    app.pressBack();
    assert.deepEqual(app.calls, ['backButton']);
});

test('特殊页面可以接管返回键', function () {
    var app = shell({ cancelled: true });
    app.pressBack();
    assert.deepEqual(app.calls, ['backButton']);
});
