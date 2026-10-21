/**
 * 一致性自检：路由 / 视图 / 模板 / 样式 是否齐备
 * 用法：node tools/verify-consistency.js
 */
const fs = require('fs');
const path = require('path');

const FE = path.join(__dirname, '..', 'frontend');
const app = fs.readFileSync(path.join(FE, 'app.html'), 'utf8');

const scripts = [...app.matchAll(/src="(js\/views\/[^"]+)"/g)].map(m => m[1]);
const files = fs.readdirSync(path.join(FE, 'js/views'))
    .filter(f => f.endsWith('.js'))
    .map(f => 'js/views/' + f);

let failed = 0;
function ok(name, cond, extra) {
    console.log((cond ? 'OK    ' : 'FAIL  ') + name + (extra ? '  [' + extra + ']' : ''));
    if (!cond) failed++;
}

ok('app.html 引用的视图数 = 目录中的视图数', scripts.length === files.length,
    scripts.length + ' vs ' + files.length);

const notWired = files.filter(f => !scripts.includes(f));
const ghost = scripts.filter(f => !files.includes(f));
ok('没有「写了但没接入入口」的视图', notWired.length === 0, notWired.join(',') || '无');
ok('没有「入口引用了但文件不存在」的视图', ghost.length === 0, ghost.join(',') || '无');

const missing = [];
const routes = [];
files.forEach(f => {
    const src = fs.readFileSync(path.join(FE, f), 'utf8');
    const tpl = (src.match(/template: '([^']+)'/) || [])[1];
    const css = (src.match(/styles: '([^']+)'/) || [])[1];
    if (tpl && !fs.existsSync(path.join(FE, tpl))) missing.push(f + ' → 模板 ' + tpl);
    if (css && !fs.existsSync(path.join(FE, css))) missing.push(f + ' → 样式 ' + css);

    // 只看 App.view(...) 定义块内的 path，避免把事件 detail 里的 path 也数进来。
    // 另外平台页是工厂注册（path: '/' + key），单独标注。
    const viewIdx = src.lastIndexOf('App.view(');
    const head = viewIdx >= 0 ? src.slice(viewIdx) : src;
    const m = head.match(/path:\s*'([^']*)'\s*\+\s*key/);
    if (m) {
        routes.push(m[1] + '<platform>(按工厂注册 3 条)');
    } else {
        const p = (head.match(/path:\s*'([^']+)'/) || [])[1];
        if (p) routes.push(p + ' (' + path.basename(f, '.js') + ')');
    }
});
ok('模板 / 样式文件都存在', missing.length === 0, missing.join(' | ') || '无');

// ---------- 侧边栏每一项都必须有对应视图 ----------
// 这条检查是补漏来的：当初「迁移完毕」的结论下，platform.html（平台总览）
// 其实漏了 —— 侧边栏有 18 个导航项，视图只有 17 条路由。静态检查能一眼抓到。
const sidebarSrc = fs.readFileSync(path.join(FE, 'js/sidebar.js'), 'utf8');
const navItems = [...new Set(
    [...sidebarSrc.matchAll(/data-page="([^"]+)"/g)].map(m => m[1])
)].sort();

const viewNavs = new Set();
files.forEach(f => {
    const src = fs.readFileSync(path.join(FE, f), 'utf8');
    if (/nav:\s*key\s*\+\s*'\.html'/.test(src)) {
        // 工厂注册（平台三页共用一个模块）
        ['douyin', 'xianyu', 'xiaohongshu'].forEach(k => viewNavs.add(k + '.html'));
    } else {
        const m = src.match(/nav:\s*'([^']+)'/);
        if (m) viewNavs.add(m[1]);
    }
});

const uncovered = navItems.filter(n => !viewNavs.has(n));
ok('侧边栏每个导航项都有对应视图', uncovered.length === 0,
    uncovered.length ? '未覆盖: ' + uncovered.join(', ') : navItems.length + ' 项全覆盖');

// ---------- 视图 CSS 的 display 声明会不会压掉 Tailwind 的 hidden ----------
/*
 * 视图 CSS 由 core/router.js 的 ensureStyle() 动态 append 到 <head>，
 * 位置排在 Tailwind 运行时样式之后。若它用「孤立的单类选择器」给某类设了 display，
 * 就与 Tailwind 的 .hidden { display: none } 同优先级（都是 0,1,0），后注入者胜，
 * 于是 hidden 被压掉。曾经就因此让 reminder 页的三个模态框常显并层叠，
 * 最上面的 #delete-modal 抢先接到点击 —— 用户看到的是「点日期提醒直接触发删除」。
 *
 * 约定（两种修法，满足任一即可）：
 *   .foo.hidden { display: none }      ← 组合选择器抬到 0,2,0
 *   .foo:not(.hidden) { display: ... } ← 非 hidden 时才设 display
 * 参见 css/views/project.css 与 css/views/reminder.css 的现有写法。
 */
const VIEW_CSS_DIR = path.join(FE, 'css/views');
const stripCssComments = s => s.replace(/\/\*[\s\S]*?\*\//g, '');

const displayClasses = new Map();   // 类名 -> 哪个文件里给了它 display
const guarded = new Set();          // 已按上面两种写法加固的类

fs.readdirSync(VIEW_CSS_DIR).filter(f => f.endsWith('.css')).forEach(f => {
    const raw = stripCssComments(fs.readFileSync(path.join(VIEW_CSS_DIR, f), 'utf8'));
    [...raw.matchAll(/([^{}]+)\{([^{}]*)\}/g)].forEach(([, sel, body]) => {
        sel.split(',').forEach(one => {
            one = one.trim();
            if (!one) return;
            const hasDisplay = /(?:^|[\s;{])display\s*:/.test(body);

            const g = one.match(/^\.([\w-]+)(?:\.hidden|:not\(\.hidden\))$/);
            if (g && hasDisplay) guarded.add(g[1]);

            const single = one.match(/^\.([\w-]+)$/);
            if (single && hasDisplay) {
                if (!displayClasses.has(single[1])) displayClasses.set(single[1], new Set());
                displayClasses.get(single[1]).add(f);
            }
        });
    });
});

// 收集模板里「同一个 class 属性同时带 hidden 和某个 display 类」的情况
const htmlFiles = fs.readdirSync(path.join(FE, 'views'))
    .filter(f => f.endsWith('.html'))
    .map(f => 'views/' + f);
const contentDir = path.join(FE, 'pages/content');
if (fs.existsSync(contentDir)) {
    fs.readdirSync(contentDir).filter(f => f.endsWith('.html'))
        .forEach(f => htmlFiles.push('pages/content/' + f));
}

const hiddenClashes = [];
let riskyCount = 0;
displayClasses.forEach((_, cls) => { if (!guarded.has(cls)) riskyCount++; });

htmlFiles.forEach(rel => {
    const src = fs.readFileSync(path.join(FE, rel), 'utf8');
    [...src.matchAll(/class\s*=\s*"([^"]*)"/g)].forEach(m => {
        const tokens = m[1].trim().split(/\s+/);
        if (tokens.indexOf('hidden') === -1) return;
        tokens.forEach(tok => {
            if (!displayClasses.has(tok) || guarded.has(tok)) return;
            hiddenClashes.push(rel + ' → .' + tok +
                '（display 定义在 ' + [...displayClasses.get(tok)].join('/') + '）');
        });
    });
});

ok('模板里没有「CSS 设了 display 又指望 hidden 生效」的组合',
    hiddenClashes.length === 0,
    hiddenClashes.length ? [...new Set(hiddenClashes)].join(' | ') : '无');

if (riskyCount > 0) {
    console.log('INFO  以下类由视图 CSS 设了 display 且未加固（以后给它加 hidden 会失效）：');
    let buf = [];
    displayClasses.forEach((files, cls) => {
        if (!guarded.has(cls)) buf.push('.' + cls);
    });
    console.log('      ' + buf.join(', '));
}

console.log('');
console.log('路由清单（' + routes.length + ' 条）：');
routes.forEach(r => console.log('  ' + r));

console.log('');
console.log(failed === 0 ? '>>> 一致性自检通过' : '>>> ' + failed + ' 项不一致');
process.exit(failed === 0 ? 0 : 1);
