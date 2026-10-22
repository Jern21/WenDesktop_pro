/**
 * 依赖接线检查
 *
 * 抓的是一类具体故障：视图里调 `window.openOrderForm(...)`，
 * 但对应的共享模块（order-form.js）没在 app.html 里加载 → 运行时函数不存在，
 * 表现就是「按钮点了没反应」。本次真实踩过（订单编辑打不开）。
 *
 * 做法：
 *   1. 扫 app.html 里加载了哪些 js 文件；
 *   2. 每个 js 文件定义/暴露了哪些全局（window.X =、顶层 function X、window.X.y =）；
 *   3. 扫视图里引用的 window.X 和裸调用的已知模块函数；
 *   4. 报告「引用了但没人定义」的。
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const FE = path.join(ROOT, 'frontend');

// ---------- 1. 入口加载了哪些脚本 ----------
const appHtml = fs.readFileSync(path.join(FE, 'app.html'), 'utf8');
const loadedScripts = [...appHtml.matchAll(/<script\s+src="([^"]+)"/g)].map(m => m[1]);
const loadedSet = new Set(loadedScripts.map(s => s.replace(/^\.?\//, '')));

function normalizeScript(src) {
    return String(src || '').replace(/^\.\//, '');
}

/** 视图里按需加载的脚本清单，例如 project.js 的 SCRIPT_SRCS。 */
function dynamicScriptsIn(src) {
    const found = [];
    const re = /(?:var|let|const)\s+SCRIPT_SRCS\s*=\s*\[([\s\S]*?)\]/g;
    let block;
    while ((block = re.exec(src))) {
        const paths = block[1].match(/['"]([^'"]+\.js)['"]/g) || [];
        paths.forEach(raw => {
            found.push(normalizeScript(raw.slice(1, -1)));
        });
    }
    return found;
}

// ---------- 2. 各 js 文件暴露的全局 ----------
function globalsOf(relPath) {
    const full = path.join(FE, relPath);
    if (!fs.existsSync(full)) return new Set();
    const src = fs.readFileSync(full, 'utf8');
    const names = new Set();
    let m;

    // window.X = ...   /   window.X = { ...
    // ⚠️ 必须用 =(?!=) 排除比较运算：视图里大量 `typeof window.X === 'function'`，
    //    只用 \s*= 会把 `===` 的第一个等号当成赋值，误判成「这个全局有人定义」，
    //    从而漏掉真正的未接线问题（本工具第一次写就这么漏了 openOrderForm）。
    const reAssign = /window\.([A-Za-z_$][\w$]*)\s*=(?!=)/g;
    while ((m = reAssign.exec(src))) names.add(m[1]);

    // window.X.Y = ... → 记 X（命名空间挂载）
    const reNs = /window\.([A-Za-z_$][\w$]*)\.([A-Za-z_$][\w$]*)\s*=(?!=)/g;
    while ((m = reNs.exec(src))) names.add(m[1]);

    // 顶层 function X(  —— 只有缩进为 0 的才算全局（IIFE 内的是私有的）
    src.split(/\r?\n/).forEach(line => {
        const fm = /^function\s+([A-Za-z_$][\w$]*)\s*\(/.exec(line);
        if (fm) names.add(fm[1]);
        const vm = /^var\s+([A-Za-z_$][\w$]*)\s*=/.exec(line);
        if (vm) names.add(vm[1]);
    });

    return names;
}

// 所有 js 文件的全局表（区分「已加载」和「未加载」）
const allJs = [];
function walk(dir, base) {
    fs.readdirSync(dir, { withFileTypes: true }).forEach(d => {
        const full = path.join(dir, d.name);
        const rel = base ? base + '/' + d.name : d.name;
        if (d.isDirectory()) walk(full, rel);
        else if (d.name.endsWith('.js')) allJs.push(rel);
    });
}
walk(path.join(FE, 'js'), 'js');

const providedByLoaded = new Map();   // name -> 文件
const providedByUnloaded = new Map(); // name -> 文件

allJs.forEach(rel => {
    if (rel === 'js/app.js' || rel === 'js/spa-router.js') return; // 入口器/旧路由不算
    const names = globalsOf(rel);
    const isLoaded = loadedSet.has(rel);
    names.forEach(n => {
        const m = isLoaded ? providedByLoaded : providedByUnloaded;
        if (!m.has(n)) m.set(n, rel);
    });
});

// ---------- 3. 视图引用的全局 ----------
const viewDir = path.join(FE, 'js', 'views');
const viewFiles = fs.readdirSync(viewDir).filter(f => f.endsWith('.js'));

const used = new Map(); // name -> [引用它的视图]
const dynamicByView = new Map();
const missingDynamic = [];

viewFiles.forEach(f => {
    const src = fs.readFileSync(path.join(viewDir, f), 'utf8');
    const dynamic = dynamicScriptsIn(src);
    dynamicByView.set(f, dynamic);
    dynamic.forEach(rel => {
        if (!fs.existsSync(path.join(FE, rel))) {
            missingDynamic.push({ view: f, script: rel });
        }
    });
    let m;
    const re = /window\.([A-Za-z_$][\w$]*)/g;
    while ((m = re.exec(src))) {
        const name = m[1];
        if (!used.has(name)) used.set(name, []);
        if (!used.get(name).includes(f)) used.get(name).push(f);
    }
});

// ---------- 4. 判定 ----------
// 浏览器/框架/第三方库自带，或由视图自己定义、或由 App.* 提供
const IGNORE = new Set([
    'location', 'document', 'addEventListener', 'removeEventListener', 'dispatchEvent',
    'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'requestAnimationFrame',
    'cancelAnimationFrame', 'fetch', 'history', 'navigator', 'localStorage', 'sessionStorage',
    'CustomEvent', 'Event', 'FormData', 'URLSearchParams', 'AbortController', 'alert',
    'confirm', 'prompt', 'open', 'close', 'print', 'scrollTo', 'scrollBy', 'innerWidth',
    'innerHeight', 'devicePixelRatio', 'matchMedia', 'getComputedStyle', 'JSON', 'Math',
    'Date', 'Object', 'Array', 'String', 'Number', 'Boolean', 'Promise', 'console',
    'echarts', 'tailwind', 'pdfjsLib', 'Sortable', 'html2canvas', 'XLSX', 'JSZip',
    'QRCode', 'Image', 'Blob', 'File', 'FileReader', 'URL', 'App', 'PAGE_BASE',
    'ROOT_URL', 'PAGE_ROUTES', 'api', 'ui', 'spaNavigate', 'CountUp',

    '__projectPageSpaReadyBound',

    // 仅出现在注释里，扫描误报。
    '_memoEscBound'
]);

let problems = 0;
const broken = [];
const lazy = [];

used.forEach((views, name) => {
    if (IGNORE.has(name)) return;
    if (providedByLoaded.has(name)) return;             // 已加载，正常

    if (providedByUnloaded.has(name)) {
        const modulePath = providedByUnloaded.get(name);
        const covered = views.every(view => (dynamicByView.get(view) || []).includes(modulePath));
        if (!covered) {
            broken.push({ name, views, module: modulePath });
        }
    } else {
        // 没人提供：可能是视图自己定义的（检查一下）
        const selfDefined = views.every(v => {
            const src = fs.readFileSync(path.join(viewDir, v), 'utf8');
            return new RegExp('window\\.' + name + '\\s*=').test(src);
        });
        if (!selfDefined) lazy.push({ name, views });
    }
});

console.log('入口已加载脚本：' + loadedScripts.length + ' 个');
console.log('');

if (missingDynamic.length) {
    problems += missingDynamic.length;
    console.log('❌ 视图的动态脚本清单指向了不存在的文件：');
    missingDynamic.forEach(item => {
        console.log('   ' + item.view + ' → ' + item.script);
    });
    console.log('');
}

if (broken.length) {
    problems += broken.length;
    console.log('❌ 视图引用了「有模块提供但入口没加载」的全局：');
    broken.forEach(b => {
        console.log('   window.' + b.name + '  ← 需要加载 ' + b.module +
            '  （引用者：' + b.views.join(', ') + '）');
    });
    console.log('');
}

if (lazy.length) {
    problems += lazy.length;
    console.log('⚠ 视图引用了「找不到任何定义」的全局：');
    lazy.forEach(b => {
        console.log('   window.' + b.name + '  （引用者：' + b.views.join(', ') + '）');
    });
    console.log('');
}

if (problems === 0) {
    console.log('>>> 依赖接线正常');
    process.exit(0);
}
process.exit(1);
