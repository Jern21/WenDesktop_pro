/**
 * 视图后处理（幂等，可重复执行）
 *
 * 背景：`make-view.js` 是从旧页面「重新生成」视图模块的，
 * 任何直接改在生成物里的手工修复，一旦重跑生成器就会全部丢失（本次真实踩过）。
 * 所以把修复统一收进本脚本，作为生成之后的**固定构建步骤**：
 *
 *   node tools/make-view.js          # 生成
 *   node tools/post-process-views.js # 修补
 *
 * 做三件事：
 *   1. DOMContentLoaded 就绪改造
 *      SPA 切页时该事件早已触发过，纯监听等于永不执行。
 *   2. data-act 事件委托注入
 *      扫模板里声明的 data-act，自动生成转发表（值 = 同名局部函数）。
 *      带 begin/end 标记，重跑时先删旧块再插新块。
 *   3. 全局函数暴露
 *      JS 拼接的 HTML 里仍有带参数的 onclick，内联处理器只在全局作用域找函数。
 *      挂到 window，由 core/view.js 的全局键快照回收机制在卸载时删掉，不会跨页残留。
 */
'use strict';

var fs = require('fs');
var path = require('path');

var ROOT = path.join(__dirname, '..');
var VIEW_DIR = path.join(ROOT, 'frontend', 'js', 'views');
var TPL_DIR = path.join(ROOT, 'frontend', 'views');

var BEGIN = '/* <<< auto:post-process >>> */';
var END = '/* <<< /auto:post-process >>> */';

/**
 * 每个视图的额外配置
 *   extraActs —— data-act 值不是简单同名函数的特例
 *   expose    —— 需要挂到 window 供内联 onclick 使用的函数
 */
var PLAN = {
    accounts: {
        extraActs: {
            'pick-icon': "function () { var i = document.getElementById('account-icon-upload'); if (i) i.click(); }"
        },
        expose: ['viewAccount', 'editAccount', 'deleteAccount', 'copyText']
    },
    resume: {
        extraActs: {},
        expose: []
    }
};

// ========== 1. DOMContentLoaded 就绪改造 ==========

var SINGLE_CALL = /document\.addEventListener\('DOMContentLoaded',\s*([A-Za-z_$][\w$]*)\);/g;

function patchReadyState(file, src) {
    var changed = 0;

    src = src.replace(SINGLE_CALL, function (whole, fn, offset) {
        // 已经包在就绪判断里 → 天然正确，不动
        var prev = src.slice(Math.max(0, offset - 220), offset);
        if (/if\s*\(\s*document\.readyState\s*===\s*['"]loading['"]\s*\)\s*\{\s*$/.test(prev)) {
            return whole;
        }
        changed++;
        return "if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', " +
            fn + '); } else { ' + fn + '(); }';
    });

    return { src: src, changed: changed };
}

/**
 * dashboard 里有个多行函数体形式，单独收拾
 */
function patchDashboardMultiline(src) {
    var bad =
        "                        document.addEventListener('DOMContentLoaded', function() {\n" +
        "                            bindTrendRangeSelect();\n" +
        "                            initTrendChart();\n" +
        "                        });";

    var good =
        "                        if (document.readyState === 'loading') {\n" +
        "                            document.addEventListener('DOMContentLoaded', function() {\n" +
        "                                bindTrendRangeSelect();\n" +
        "                                initTrendChart();\n" +
        "                            });\n" +
        "                        } else {\n" +
        "                            bindTrendRangeSelect();\n" +
        "                            initTrendChart();\n" +
        "                        }";

    if (src.indexOf(bad) === -1) return { src: src, changed: 0 };
    return { src: src.replace(bad, good), changed: 1 };
}

// ========== 2 + 3. data-act 委托 + 全局暴露 ==========

/**
 * 去掉上一次注入的块（幂等）
 */
function stripAutoBlock(src) {
    var i = src.indexOf(BEGIN);
    if (i === -1) return src;
    var j = src.indexOf(END, i);
    if (j === -1) return src;
    return src.slice(0, i) + src.slice(j + END.length);
}

/**
 * 读模板里声明的 data-act 值
 */
function readActNames(viewName) {
    var tplPath = path.join(TPL_DIR, viewName + '.html');
    if (!fs.existsSync(tplPath)) return [];
    var html = fs.readFileSync(tplPath, 'utf-8');
    var set = {};
    var re = /data-act="([^"]+)"/g;
    var m;
    while ((m = re.exec(html))) set[m[1]] = true;
    return Object.keys(set);
}

function buildAutoBlock(viewName) {
    var conf = PLAN[viewName] || { extraActs: {}, expose: [] };
    var acts = readActNames(viewName);
    if (!acts.length && !conf.expose.length) return '';

    var src = fs.readFileSync(path.join(VIEW_DIR, viewName + '.js'), 'utf-8');
    var entries = [];
    var missing = [];

    acts.forEach(function (act) {
        if (/^[A-Za-z_$][\w$]*$/.test(act)) {
            // 同名局部函数
            if (new RegExp('function\\s+' + act + '\\s*\\(').test(src)) {
                entries.push("                '" + act + "': " + act + ',');
            } else {
                missing.push(act);
            }
        } else if (conf.extraActs[act]) {
            entries.push("                '" + act + "': " + conf.extraActs[act] + ',');
        } else {
            missing.push(act);
        }
    });

    if (missing.length) {
        console.warn('  ⚠ ' + viewName + ' 模板声明了但找不到对应函数: ' + missing.join(', '));
    }

    var lines = [];
    lines.push(BEGIN);
    lines.push('            /* ---------------- data-act 事件委托（自动生成，勿手改） ---------------- */');
    lines.push('            // 模板里的内联 onclick 已统一改为 data-act 属性，这里转发到本作用域的函数。');
    lines.push('            // 本块由 tools/post-process-views.js 生成，重跑会整体替换。');
    lines.push('            var ACTION_MAP = {');
    entries.forEach(function (e) { lines.push(e); });
    lines.push('            };');
    lines.push("            ctx.onCleanup(App.dom.delegate(root, '[data-act]', 'click', function (e, el) {");
    lines.push("                var act = el.getAttribute('data-act');");
    lines.push('                var fn = ACTION_MAP[act];');
    lines.push("                if (typeof fn !== 'function') {");
    lines.push("                    console.warn('[" + viewName + "] 未定义的动作:', act);");
    lines.push('                    return;');
    lines.push('                }');
    lines.push('                e.preventDefault();');
    lines.push('                fn(e, el);');
    lines.push('            }));');

    if (conf.expose.length) {
        lines.push('');
        lines.push('            /* ---------- 兼容：JS 拼接的卡片 HTML 仍用内联 onclick ---------- */');
        lines.push('            // 内联处理器只在全局作用域找函数，且这些调用带参数，故挂到 window。');
        lines.push('            // 离开页面时由 core/view.js 的全局键快照回收自动删除，不会跨页残留。');
        conf.expose.forEach(function (fn) {
            if (new RegExp('function\\s+' + fn + '\\s*\\(').test(src)) {
                lines.push('            window.' + fn + ' = ' + fn + ';');
            } else {
                console.warn('  ⚠ ' + viewName + ' 要暴露的 ' + fn + ' 不存在');
            }
        });
    }

    lines.push(END);
    return lines.join('\n');
}

// ========== 主流程 ==========

var ANCHOR = '/* ==================== 原始脚本结束 ==================== */';
var touched = [];

fs.readdirSync(VIEW_DIR).filter(function (f) { return f.endsWith('.js'); }).forEach(function (file) {
    var viewName = path.basename(file, '.js');
    var full = path.join(VIEW_DIR, file);
    var src = fs.readFileSync(full, 'utf-8');
    var before = src;
    var notes = [];

    // 1. 就绪改造
    var r1 = patchReadyState(file, src);
    src = r1.src;
    if (r1.changed) notes.push('DOMContentLoaded×' + r1.changed);

    if (viewName === 'dashboard') {
        var r2 = patchDashboardMultiline(src);
        src = r2.src;
        if (r2.changed) notes.push('DOMContentLoaded(多行)×1');
    }

    // 2 + 3. 委托与暴露（仅对需要它的视图）
    if (PLAN[viewName]) {
        src = stripAutoBlock(src);
        var block = buildAutoBlock(viewName);
        if (block) {
            if (src.indexOf(ANCHOR) === -1) {
                console.warn('  ⚠ ' + file + ' 找不到插入锚点，跳过');
            } else {
                src = src.replace(ANCHOR, block + '\n' + ANCHOR);
                notes.push('data-act 委托');
            }
        }
    }

    if (src !== before) {
        fs.writeFileSync(full, src, 'utf-8');
        touched.push(viewName.padEnd(12) + notes.join(' + '));
    }
});

console.log('已修补 ' + touched.length + ' 个视图：');
touched.forEach(function (t) { console.log('  ✔ ' + t); });
