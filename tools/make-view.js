/**
 * 视图模块生成器
 *
 * 把 .workbuddy/tmp/<name>.script.js（从旧页面提取的内联脚本）
 * 自动包装成 App.view 模块，输出到 frontend/js/views/<name>.js
 *
 * 关键设计：
 *   1. 原脚本整段放进 mount() 函数体内 —— 所有 var/function 变成局部作用域，
 *      彻底避免旧架构「同名函数互相覆盖」和「let/const 重复声明」的问题。
 *   2. 临时劫持 document/window 的 addEventListener，**自动登记**本页注册的
 *      所有全局监听，卸载时统一移除 —— 不需要逐行改造成 ctx.onCleanup。
 *   3. 保留 finally 恢复原生方法，即使脚本抛错也不会把劫持泄漏出去。
 *
 *   node tools/make-view.js
 */
'use strict';

var fs = require('fs');
var path = require('path');

var ROOT = path.join(__dirname, '..');
var FRONTEND = path.join(ROOT, 'frontend');
var TMP = path.join(ROOT, '.workbuddy', 'tmp');

var VIEWS = [
    { name: 'quote', path: '/quote', nav: 'quote.html', source: 'frontend/pages/business/quote.html' },
    { name: 'stats', path: '/stats', nav: 'stats.html', source: 'frontend/pages/content/stats.html' },
    { name: 'orders', path: '/orders', nav: 'orders.html', source: 'frontend/pages/business/orders.html' },
    { name: 'customer', path: '/customer', nav: 'customer.html', source: 'frontend/pages/business/customer.html' },
    { name: 'reminder', path: '/reminder', nav: 'reminder.html', source: 'frontend/pages/personal/reminder.html' },
    { name: 'accounts', path: '/accounts', nav: 'accounts.html', source: 'frontend/pages/personal/accounts.html' },
    { name: 'settings', path: '/settings', nav: 'settings.html', source: 'frontend/pages/personal/settings.html' },
    { name: 'dashboard', path: '/', nav: 'index.html', source: 'frontend/index.html' },
    { name: 'posters', path: '/posters', nav: 'posters.html', source: 'frontend/pages/content/posters.html' },
    { name: 'canvas', path: '/canvas', nav: 'canvas.html', source: 'frontend/pages/content/canvas.html' },
    { name: 'resume', path: '/resume', nav: 'resume.html', source: 'frontend/pages/personal/resume.html' },
    { name: 'platform', path: '/platform', nav: 'platform.html', source: 'frontend/pages/platform/platform.html' }
];

// 支持 --only=name1,name2 只重生成指定视图（改单页时用，避免不必要的全量重跑）
var ONLY = (function () {
    var arg = process.argv.slice(2).find(function (a) { return a.indexOf('--only=') === 0; });
    if (!arg) return null;
    return arg.slice('--only='.length).split(',').map(function (s) { return s.trim(); }).filter(Boolean);
})();

function readTitle(sourceRel) {
    try {
        var html = fs.readFileSync(path.join(ROOT, sourceRel), 'utf-8');
        var m = html.match(/<title>([^<]*)<\/title>/i);
        if (!m) return null;
        var t = m[1].trim();
        // 去掉项目后缀
        t = t.replace(/\s*-\s*文的项目工作台\s*$/, '').trim();
        return t || null;
    } catch (e) {
        return null;
    }
}

function indentBlock(code, spaces) {
    var pad = new Array(spaces + 1).join(' ');
    return code.split(/\r?\n/).map(function (line) {
        return line.length ? pad + line : line;
    }).join('\n');
}

function buildView(conf) {
    var scriptPath = path.join(TMP, conf.name + '.script.js');
    if (!fs.existsSync(scriptPath)) {
        return { ok: false, reason: '缺少脚本文件 ' + scriptPath };
    }

    var code = fs.readFileSync(scriptPath, 'utf-8');
    var title = readTitle(conf.source) || conf.name;
    var hasCss = fs.existsSync(path.join(FRONTEND, 'css', 'views', conf.name + '.css'));
    var hasTpl = fs.existsSync(path.join(FRONTEND, 'views', conf.name + '.html'));

    if (!hasTpl) {
        return { ok: false, reason: '缺少模板文件' };
    }

    var lines = [];
    lines.push('/**');
    lines.push(' * ' + title + ' 视图');
    lines.push(' *');
    lines.push(' * 自动迁移自 ' + conf.source);
    lines.push(' *');
    lines.push(' * 迁移方式：原脚本整段放入 mount() 作用域，');
    lines.push(' *   - 所有 var/function 成为局部变量，不再污染 window');
    lines.push(' *   - document/window 上的监听由框架自动登记并清理');
    lines.push(' *');
    lines.push(' * ⚠️ 人工复核清单：');
    lines.push(' *   1. 若含 onclick 内联属性 → 需改造成 data-act 委托');
    lines.push(' *   2. 若含 spa:ready / spa:cleanup-forms 监听 → 新架构下应删除');
    lines.push(' *   3. 若 css 含 @apply → 需展开为原生 CSS');
    lines.push(' */');
    lines.push('(function (global) {');
    lines.push("    'use strict';");
    lines.push('');
    lines.push('    var App = global.App = global.App || {};');
    lines.push('');
    lines.push("    App.view('" + conf.name + "', {");
    lines.push("        path: '" + conf.path + "',");
    lines.push("        nav: '" + conf.nav + "',");
    lines.push("        title: '" + title.replace(/'/g, "\\'") + "',");
    lines.push("        template: 'views/" + conf.name + ".html',");
    if (hasCss) {
        lines.push("        styles: 'css/views/" + conf.name + ".css',");
    }
    lines.push('');
    lines.push('        async mount(root, ctx) {');
    lines.push('            // ---- 自动捕获本页注册的全局监听，卸载时统一移除 ----');
    lines.push('            var _docAdd = document.addEventListener;');
    lines.push('            var _winAdd = window.addEventListener;');
    lines.push('            var _listeners = [];');
    lines.push('            document.addEventListener = function (t, f, o) {');
    lines.push("                _listeners.push(['doc', t, f, o]);");
    lines.push('                return _docAdd.call(document, t, f, o);');
    lines.push('            };');
    lines.push('            window.addEventListener = function (t, f, o) {');
    lines.push("                _listeners.push(['win', t, f, o]);");
    lines.push('                return _winAdd.call(window, t, f, o);');
    lines.push('            };');
    lines.push('            ctx.onCleanup(function () {');
    lines.push('                document.addEventListener = _docAdd;');
    lines.push('                window.addEventListener = _winAdd;');
    lines.push('                _listeners.forEach(function (r) {');
    lines.push('                    try {');
    lines.push("                        (r[0] === 'doc' ? document : window).removeEventListener(r[1], r[2], r[3]);");
    lines.push('                    } catch (e) { /* ignore */ }');
    lines.push('                });');
    lines.push('            });');
    lines.push('');
    lines.push('            try {');
    lines.push('                /* ==================== 原始脚本开始 ==================== */');
    lines.push(indentBlock(code, 16));
    lines.push('                /* ==================== 原始脚本结束 ==================== */');
    lines.push('            } finally {');
    lines.push('                document.addEventListener = _docAdd;');
    lines.push('                window.addEventListener = _winAdd;');
    lines.push('            }');
    lines.push('        }');
    lines.push('    });');
    lines.push('');
    lines.push("})(typeof window !== 'undefined' ? window : this);");

    var outPath = path.join(FRONTEND, 'js', 'views', conf.name + '.js');
    fs.writeFileSync(outPath, lines.join('\n') + '\n', 'utf-8');

    return {
        ok: true,
        lines: code.split(/\r?\n/).length,
        out: 'frontend/js/views/' + conf.name + '.js',
        hasCss: hasCss,
        title: title
    };
}

var okCount = 0;
var failCount = 0;

var targets = ONLY ? VIEWS.filter(function (v) { return ONLY.indexOf(v.name) !== -1; }) : VIEWS;
if (ONLY) {
    var unknown = ONLY.filter(function (n) {
        return !VIEWS.some(function (v) { return v.name === n; });
    });
    if (unknown.length) console.warn('⚠ 未知视图名：' + unknown.join(', '));
}

targets.forEach(function (conf) {
    var r = buildView(conf);
    if (r.ok) {
        okCount++;
        console.log('✔ ' + conf.name + '  [' + r.title + ']  脚本 ' + r.lines + ' 行' + (r.hasCss ? '  +css' : ''));
    } else {
        failCount++;
        console.log('❌ ' + conf.name + '  ' + r.reason);
    }
});

console.log('\n生成 ' + okCount + ' 个，失败 ' + failCount + ' 个');
