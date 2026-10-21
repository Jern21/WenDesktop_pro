/**
 * 视图提取工具
 *
 * 把旧页面（完整 HTML 文档）拆成新架构需要的三件套：
 *   views/<name>.html      ← #page-view 内的内容
 *   css/views/<name>.css   ← <style> 内容
 *   （内联脚本单独输出，供人工改造成 view 模块）
 *
 * 同时扫描"需要人工处理的点"：onclick、定时器、document/window 级监听、@apply。
 *
 *   node tools/extract-view.js <旧页面相对路径> [视图名]
 *   例：node tools/extract-view.js frontend/pages/business/quote.html quote
 */
'use strict';

var fs = require('fs');
var path = require('path');

var ROOT = path.join(__dirname, '..');

function readFile(p) {
    return fs.readFileSync(p, 'utf-8');
}

/**
 * 从 #page-view 的开始标签起，用栈匹配找到成对的 </div>，返回内部 HTML
 */
function extractPageView(html) {
    var startRe = /<div\s+id=["']page-view["']/i;
    var m = startRe.exec(html);
    if (!m) return null;

    // 找到该开始标签的结束位置
    var tagEnd = html.indexOf('>', m.index);
    if (tagEnd === -1) return null;

    var depth = 1;
    var pos = tagEnd + 1;
    var openRe = /<div\b/gi;
    var closeRe = /<\/div\s*>/gi;

    while (pos < html.length && depth > 0) {
        openRe.lastIndex = pos;
        closeRe.lastIndex = pos;

        var nextOpen = openRe.exec(html);
        var nextClose = closeRe.exec(html);

        if (!nextClose) return null;

        if (nextOpen && nextOpen.index < nextClose.index) {
            depth++;
            pos = nextOpen.index + 4;
        } else {
            depth--;
            if (depth === 0) {
                return html.slice(tagEnd + 1, nextClose.index);
            }
            pos = nextClose.index + 6;
        }
    }
    return null;
}

/**
 * 提取所有 <style>...</style> 内容
 */
function extractStyles(html) {
    var out = [];
    var re = /<style([^>]*)>([\s\S]*?)<\/style>/gi;
    var m;
    while ((m = re.exec(html)) !== null) {
        out.push({
            attrs: m[1] || '',
            content: m[2] || '',
            isTailwind: /text\/tailwindcss/i.test(m[1] || '')
        });
    }
    return out;
}

/**
 * 提取内联脚本（无 src 的 <script>）
 */
function extractInlineScripts(html) {
    var out = [];
    var re = /<script(?![^>]*\bsrc=)([^>]*)>([\s\S]*?)<\/script>/gi;
    var m;
    while ((m = re.exec(html)) !== null) {
        var code = m[2] || '';
        // 跳过只有 PAGE_BASE 声明的声明块
        if (/^\s*window\.PAGE_BASE\s*=/.test(code) && code.length < 120) continue;
        out.push(code);
    }
    return out;
}

/**
 * 扫描需要人工处理的点
 */
function scan(code, html) {
    var count = function (re) {
        var n = 0;
        var m;
        var r = new RegExp(re.source, re.flags.indexOf('g') === -1 ? re.flags + 'g' : re.flags);
        while ((m = r.exec(code)) !== null) n++;
        return n;
    };

    return {
        onClickInHtml: (html.match(/\son(click|change|input|submit|keyup|keydown|blur|focus)\s*=/gi) || []).length,
        onClickInJs: (code.match(/onclick\s*=/g) || []).length,
        setInterval: count(/setInterval\s*\(/),
        setTimeout: count(/setTimeout\s*\(/),
        docAddListener: count(/document\.addEventListener\s*\(/),
        winAddListener: count(/window\.addEventListener\s*\(/),
        echartsInit: count(/echarts\.init\s*\(/),
        iframe: count(/<iframe/g)
    };
}

// ========== 主流程 ==========

var relPath = process.argv[2];
var viewName = process.argv[3];

if (!relPath) {
    console.error('用法: node tools/extract-view.js <旧页面相对路径> [视图名]');
    process.exit(1);
}

var absPath = path.join(ROOT, relPath);
if (!fs.existsSync(absPath)) {
    console.error('文件不存在: ' + absPath);
    process.exit(1);
}

if (!viewName) {
    viewName = path.basename(relPath, '.html');
}

var html = readFile(absPath);
var pageView = extractPageView(html);
var styles = extractStyles(html);
var scripts = extractInlineScripts(html);
var code = scripts.join('\n\n/* ---- 下一个 script 块 ---- */\n\n');

console.log('=== ' + relPath + ' → ' + viewName + ' ===');
console.log('总行数: ' + html.split(/\r?\n/).length);

if (!pageView) {
    console.error('❌ 未找到 #page-view，可能是片段页或结构特殊，需手工处理');
    process.exit(2);
}
console.log('#page-view 内容行数: ' + pageView.split(/\r?\n/).length);

var outDirs = [path.join(ROOT, 'frontend', 'views'), path.join(ROOT, 'frontend', 'css', 'views')];
outDirs.forEach(function (d) {
    if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
});

// 模板（去掉首尾多余空行）
var tplOut = path.join(ROOT, 'frontend', 'views', viewName + '.html');
fs.writeFileSync(tplOut, pageView.replace(/^\s*\n/, '').replace(/\s+$/, '') + '\n', 'utf-8');
console.log('✔ 模板: frontend/views/' + viewName + '.html');

// 样式
if (styles.length) {
    var cssParts = [];
    var hasApply = false;
    styles.forEach(function (s) {
        if (s.isTailwind || /@apply/.test(s.content)) hasApply = true;
        cssParts.push(s.content.trim());
    });
    var cssOut = path.join(ROOT, 'frontend', 'css', 'views', viewName + '.css');
    var header = '/**\n * ' + viewName + ' 视图样式\n * 提取自 ' + relPath + '\n';
    if (hasApply) {
        header += ' *\n * ⚠️ 含 @apply 指令（依赖 Tailwind CDN 运行时展开），SPA 下需展开为原生 CSS。\n';
    }
    header += ' */\n\n';
    fs.writeFileSync(cssOut, header + cssParts.join('\n\n') + '\n', 'utf-8');
    console.log('✔ 样式: frontend/css/views/' + viewName + '.css' + (hasApply ? '  (@apply 需展开)' : ''));
} else {
    console.log('— 无 <style> 块');
}

// 脚本（临时输出，供改造参考）
if (code.trim()) {
    var tmpOut = path.join(ROOT, '.workbuddy', 'tmp', viewName + '.script.js');
    var tmpDir = path.dirname(tmpOut);
    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
    fs.writeFileSync(tmpOut, code, 'utf-8');
    console.log('✔ 脚本: .workbuddy/tmp/' + viewName + '.script.js (' + code.split(/\r?\n/).length + ' 行)');
} else {
    console.log('— 无内联脚本');
}

// 扫描报告
var s = scan(code, html);
console.log('\n--- 需人工处理的点 ---');
console.log('HTML onclick 等内联事件: ' + s.onClickInHtml);
console.log('JS 内拼接的 onclick: ' + s.onClickInJs);
console.log('setInterval: ' + s.setInterval);
console.log('setTimeout: ' + s.setTimeout + '   (多为 UI 动画，通常无需清理)');
console.log('document.addEventListener: ' + s.docAddListener + '   (需登记 onCleanup)');
console.log('window.addEventListener: ' + s.winAddListener + '   (需登记 onCleanup)');
console.log('echarts.init: ' + s.echartsInit + '   (框架已自动 dispose)');
console.log('iframe: ' + s.iframe);
