/**
 * 移动端页面脚手架
 *
 * 用法：
 *   node tools/new-panel.js orders 订单 --icon receipt                 # 一级页面（进右侧导航栏）
 *   node tools/new-panel.js order-detail 订单详情 --subpage --parent /orders --path /orders/:id
 *                                                                     # 详情页（不进导航栏，靠路径进入）
 *   node tools/new-panel.js orders 订单 --dry-run                      只打印要改什么，不落盘
 *
 * 它做三件事（手工做的话少一处就出问题）：
 *   1. 生成 mobile-pwa/src/views/panels/<name>.js —— 带「加载态/错误态/请求取消/destroy」的标准骨架
 *   2. 在 registry.js 里补 import + 登记（**漏登记会静默落到占位页**）
 *   3. 一级页面 → 在 nav.js 补导航项；子页面 → 在 routes.js 的 SUBPAGE_ROUTES 补一条
 *      （**搞反了就会把详情页塞进右侧导航栏**，所以这一条必须由模式决定，不能靠人记）
 *
 * 生成后自动跑 tools/verify-mobile.js 校验；不通过则把改过的文件全部回滚。
 * 这个回滚很重要：脚手架改的是别人的源码，写坏了必须能全身而退。
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'mobile-pwa', 'src');
const PANELS_DIR = path.join(SRC, 'views', 'panels');
const REGISTRY = path.join(PANELS_DIR, 'registry.js');
const NAV = path.join(SRC, 'config', 'nav.js');
const ROUTES = path.join(SRC, 'config', 'routes.js');

/* ============================================================
 * 参数
 * ========================================================== */

const argv = process.argv.slice(2);
const flags = {};
const positional = [];

// 支持三种写法：--key=value、--key value、--flag
// （只写 `--key=value` 一种的话，`--icon bell` 里的 bell 会被当成位置参数，实测踩过）
for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) {
        positional.push(a);
        continue;
    }
    const eq = a.indexOf('=');
    if (eq !== -1) {
        flags[a.slice(2, eq)] = a.slice(eq + 1);
        continue;
    }
    const key = a.slice(2);
    const next = argv[i + 1];
    if (next && !next.startsWith('--')) {
        flags[key] = next;
        i += 1;              // 把值吃掉，别再当位置参数
    } else {
        flags[key] = true;
    }
}

const name = positional[0];
const labelArg = positional[1];

if (!name || !labelArg) {
    console.log('');
    console.log('用法：node tools/new-panel.js <name> <label> [选项]');
    console.log('');
    console.log('  <name>   面板 key（也是 registry 里的 key），小写字母/数字/连字符，如 orders');
    console.log('  <label>  页面显示名，如 订单');
    console.log('');
    console.log('一级页面（进右侧导航栏）：');
    console.log('  --icon=<key>       导航图标，默认 grid（可选 grid/receipt/bell/gear/users/more）');
    console.log('  --subtitle=<text>  顶栏副标题');
    console.log('  --path=<path>      覆盖路径，默认 /<name>');
    console.log('  --flush            去掉内容区默认内边距（整屏自绘背景的页面用）');
    console.log('');
    console.log('子页面（详情页，不进导航栏）：');
    console.log('  --subpage          标记为子页面 → 写进 routes.js 的 SUBPAGE_ROUTES，不碰 nav.js');
    console.log('  --parent=<path>    返回按钮的目标路径，必填，如 /orders');
    console.log('  --path=<path>      路径模式，默认 /<name>，详情页一般是 /orders/:id');
    console.log('');
    console.log('  --dry-run          只打印将要做的改动，不写文件');
    console.log('');
    process.exit(1);
}

if (!/^[a-z][a-z0-9-]*$/.test(name)) {
    console.error('✗ name 只能是小写字母开头、含小写字母/数字/连字符：' + name);
    process.exit(1);
}

const camel = name.replace(/-(.)/g, (_, c) => c.toUpperCase());
const mountFn = 'mount' + camel.charAt(0).toUpperCase() + camel.slice(1) + 'Panel';
const fileName = name + '.js';
const panelPath = path.join(PANELS_DIR, fileName);
const icon = typeof flags.icon === 'string' ? flags.icon : 'grid';
const subtitle = typeof flags.subtitle === 'string' ? flags.subtitle : labelArg;
const flush = flags.flush === true;
const dryRun = flags['dry-run'] === true;
const isSubpage = flags.subpage === true || typeof flags.subpage === 'string';

/**
 * 路径参数的清洗
 *
 * 为什么要专门处理：在 Windows 的 Git Bash（MSYS）里，`--parent /projects` 会被
 * **自动转成 `C:/Users/xxx/PortableGit/projects`** —— bash 把 `/projects` 当成绝对路径翻译了，
 * node 拿到的是一个 Windows 路径，工具还傻乎乎照单全收，最后报「parent 不是已登记路径」，
 * 看起来像路由表坏了，其实是 shell 的锅。（`--path /orders/:id` 因为带冒号不会被转，
 * 所以这个坑只在「不带参数的父路径」上出现，极易误判。）
 *
 * 对策：允许省略前导斜杠（相对写法不会被转换），并且一旦认出是驱动器路径就立刻报清楚的错。
 */
function sanitizeRoutePath(value, flagName) {
    if (typeof value !== 'string' || !value) {
        throw new Error(flagName + ' 需要一个路径值');
    }
    if (/^[A-Za-z]:[\\/]/.test(value)) {
        throw new Error(
            flagName + ' 被 shell 转成了 Windows 路径：' + value + '\n' +
            '  Windows 的 Git Bash 会把以 / 开头的参数当成绝对路径翻译。\n' +
            '  改成不带前导斜杠的写法即可，例如：--' + flagName + '=projects'
        );
    }
    var p = '/' + value.replace(/^\/+/, '').replace(/\\/g, '/');
    return p.length > 1 ? p.replace(/\/+$/, '') : p;
}

let parent = null;
let routePath = '/' + name;
try {
    if (typeof flags.parent === 'string') parent = sanitizeRoutePath(flags.parent, 'parent');
    if (typeof flags.path === 'string') routePath = sanitizeRoutePath(flags.path, 'path');
} catch (e) {
    console.error('✗ ' + e.message);
    process.exit(1);
}

if (isSubpage && !parent) {
    console.error('✗ --subpage 必须配 --parent=/xxx（返回按钮要知道退到哪，否则会退到占位页）');
    process.exit(1);
}
if (!isSubpage && parent) {
    console.error('✗ --parent 只对 --subpage 有意义；一级页面的返回目标是它自己');
    process.exit(1);
}
if (isSubpage && flush) {
    console.error('✗ --flush 是给整屏自绘背景的一级页面用的，详情页请用默认内边距');
    process.exit(1);
}

if (fs.existsSync(panelPath)) {
    console.error('✗ 已存在：' + path.relative(ROOT, panelPath));
    console.error('  换一个 name，或先手工确认该页面是否需要重写。');
    process.exit(1);
}

/* ============================================================
 * 1. 面板骨架
 * ========================================================== */

const panelSource = `/**
 * ${labelArg} 面板
 *
 * 由 \`node tools/new-panel.js\` 生成。骨架已经包含移动端面板的全部样板：
 * 加载态 / 错误态 / 请求取消（AbortController）/ 代际编号防竞态 / destroy 清理。
 *
 * 你要改的地方只有两处，都标了 TODO：
 *   1. load() 里换成真正的领域方法（api/resources.js 里的）
 *   2. renderData() 里换成真正的渲染
 *
 * ⚠️ destroy() 必须保留：切走页面时 shell 会调它。
 *    少了它，定时器和事件监听会累积，表现是「用一阵之后点一次触发两次」。
 */
import { escapeHtml } from '../../lib/format.js';
import { toast } from '../../lib/toast.js';
import { stats } from '../../api/resources.js';

/**
 * @param {HTMLElement} container .mobile-content 滚动容器
 * @param {Object} route matchRoute() 的结果
 *        route.params —— 路径参数，详情页的 id 在 route.params.id
 *        route.path   —— 实际路径
 */
export function ${mountFn}(container, route) {
    var state = { disposed: false, generation: 0 };
    var abortCtrl = null;

    function setBusy(text) {
        container.innerHTML = '<p class="lv-footer-text" style="padding:24px;text-align:center">' +
            escapeHtml(text) + '</p>';
    }

    function renderError(err) {
        container.innerHTML =
            '<div class="lv-error">' +
            '  <div class="lv-empty-icon" aria-hidden="true">⚠️</div>' +
            '  <p class="lv-empty-title"></p>' +
            '  <button type="button" class="lv-retry" data-act="retry">重试</button>' +
            '</div>';
        container.querySelector('.lv-empty-title').textContent = (err && err.message) || '加载失败';
        container.querySelector('[data-act="retry"]').addEventListener('click', load);
    }

    function renderData(data) {
        // TODO 换成这个页面真正要展示的内容。
        // 提示：列表页直接用 createListView（src/components/list-view.js），别自己写分页和下拉刷新。
        container.innerHTML =
            '<section class="m-card">' +
            '  <h2 class="m-card-title">${labelArg}</h2>' +
            '  <p class="m-card-body m-muted">' +
            '    页面骨架已就绪。当前显示的是示例数据（stats.dashboard），' +
            '    请把 load() 与 renderData() 换成真实业务。' +
            '  </p>' +
            '  <p class="m-card-body">累计收入：¥' +
            escapeHtml(String((data && data.totalRevenue) || 0)) +
            '　订单数：' + escapeHtml(String((data && data.totalOrders) || 0)) +
            '  </p>' +
            '</section>';
    }

    function load() {
        state.generation += 1;
        var gen = state.generation;

        if (abortCtrl) abortCtrl.abort();
        abortCtrl = new AbortController();

        setBusy('加载中…');

        // TODO 换成真正的领域方法，例如 orders.list({ page: 1, pageSize: 20 }, { signal: abortCtrl.signal })
        stats.dashboard({ signal: abortCtrl.signal })
            .then(function (res) {
                // 代际判断：快速切换页面/重复点重试时，丢弃过期响应
                if (state.disposed || gen !== state.generation) return;
                renderData(res && res.data);
            })
            .catch(function (err) {
                if (state.disposed || gen !== state.generation) return;
                if (err && err.aborted) return;
                renderError(err);
                toast.error(err.message || '加载失败');
            });
    }

    load();

    return {
        destroy: function () {
            state.disposed = true;
            state.generation += 1;
            if (abortCtrl) abortCtrl.abort();
        }
    };
}
`;

/* ============================================================
 * 2. registry.js / nav.js 的文本改动
 * ========================================================== */

function insertRegistry(src) {
    let out = src;

    // 2.1 补 import（放在最后一个 import 之后）
    const importLine = `import { ${mountFn} } from './${fileName}';\n`;
    const lastImport = out.lastIndexOf('\nimport ');
    if (lastImport === -1) throw new Error('registry.js 里找不到 import 语句，请手工登记');
    const eol = out.indexOf('\n', lastImport + 1);
    out = out.slice(0, eol + 1) + importLine + out.slice(eol + 1);

    // 2.2 补注册项（插在「新增页面模板」注释之前；找不到就插在对象闭合之前）
    const anchor = '    // 新增页面模板：';
    let idx = out.indexOf(anchor);
    if (idx === -1) {
        const close = out.indexOf('\n};');
        if (close === -1) throw new Error('registry.js 结构不认识，请手工登记');
        idx = close;
    }

    let head = out.slice(0, idx).replace(/\s+$/, '');
    // 前一项结尾必须有逗号，否则插入后语法错误
    if (head.slice(-1) !== ',') head += ',';

    // 带连字符的名字（如 order-detail）不能直接当对象字面量键：
    // `{ order-detail: {...} }` 是**非法 JS**，而 verify-mobile 只做静态扫描、
    // 不解析语法，所以这个错误会一路溜到 vite build 才炸 —— 实测踩过。
    const regKey = /^[A-Za-z_$][\w$]*$/.test(name) ? name : "'" + name + "'";

    const block = '\n\n    ' + regKey + ': {\n        mount: ' + mountFn +
        (flush ? ',\n        flush: true' : '') + '\n    },';

    const tail = out.slice(idx).replace(/^\s*/, '\n\n    ');
    out = head + block + tail;

    return out;
}

/** 单引号字符串字面量里不能裸奔的字符（label 里带撇号时，不加这层会直接语法错） */
function esc(value) {
    return String(value).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

function insertNav(src) {
    let out = src;

    const arrStart = out.indexOf('MOBILE_NAV = [');
    if (arrStart === -1) throw new Error('nav.js 里找不到 MOBILE_NAV 数组');

    const arrEnd = out.indexOf('\n];', arrStart);
    if (arrEnd === -1) throw new Error('nav.js 的 MOBILE_NAV 数组没有正常闭合');

    let head = out.slice(0, arrEnd).replace(/\s+$/, '');
    if (head.slice(-1) !== ',') head += ',';

    const item =
        '\n\n    {' +
        "\n        path: '" + esc(routePath) + "'," +
        "\n        label: '" + esc(labelArg) + "'," +
        "\n        subtitle: '" + esc(subtitle) + "'," +
        "\n        panel: '" + esc(name) + "'," +
        "\n        icon: '" + esc(icon) + "'" +
        '\n    }';

    return head + item + out.slice(arrEnd);
}

/**
 * 子页面写进 routes.js 的 SUBPAGE_ROUTES，**不碰 nav.js**。
 * 这就是「详情页不该出现在导航栏」这条规则在工具层的落点 ——
 * 靠人记迟早会错，靠模式判定不会。
 */
function insertSubpageRoute(src) {
    let out = src;

    const arrStart = out.indexOf('SUBPAGE_ROUTES = [');
    if (arrStart === -1) throw new Error('routes.js 里找不到 SUBPAGE_ROUTES 数组');

    const arrEnd = out.indexOf('\n];', arrStart);
    if (arrEnd === -1) throw new Error('routes.js 的 SUBPAGE_ROUTES 数组没有正常闭合');

    let head = out.slice(0, arrEnd).replace(/\s+$/, '');
    if (head.slice(-1) !== ',') head += ',';

    const item =
        '\n\n    {' +
        "\n        path: '" + esc(routePath) + "'," +
        "\n        panel: '" + esc(name) + "'," +
        "\n        label: '" + esc(labelArg) + "'," +
        "\n        parent: '" + esc(parent) + "'" +
        '\n    }';

    return head + item + out.slice(arrEnd);
}

/* ============================================================
 * 执行
 * ========================================================== */

const targetConfig = isSubpage ? ROUTES : NAV;
const targetLabel = isSubpage ? '子页面（routes.js）' : '导航项（nav.js）';

const before = {
    registry: fs.readFileSync(REGISTRY, 'utf8'),
    config: fs.readFileSync(targetConfig, 'utf8')
};

let nextRegistry;
let nextConfig;
try {
    nextRegistry = insertRegistry(before.registry);
    nextConfig = isSubpage ? insertSubpageRoute(before.config) : insertNav(before.config);
} catch (e) {
    console.error('✗ 生成失败：' + e.message);
    process.exit(1);
}

if (dryRun) {
    console.log('');
    console.log('（--dry-run，不写文件）');
    console.log('');
    console.log('模式：' + (isSubpage ? '子页面（不进导航栏）' : '一级页面（进导航栏）'));
    console.log('将新建：' + path.relative(ROOT, panelPath) + '（' + panelSource.split('\n').length + ' 行）');
    console.log('将修改：' + path.relative(ROOT, REGISTRY) + '（补 import + 登记 ' + name + '）');
    console.log('将修改：' + path.relative(ROOT, targetConfig) + '（' + targetLabel + '，路径 ' + routePath + '）');
    console.log('');
    process.exit(0);
}

// 先写面板文件，再改两个配置文件；任何一步失败都整体回滚
try {
    fs.writeFileSync(panelPath, panelSource);
    fs.writeFileSync(REGISTRY, nextRegistry);
    fs.writeFileSync(targetConfig, nextConfig);
} catch (e) {
    rollback();
    console.error('✗ 写入失败，已回滚：' + e.message);
    process.exit(1);
}

function rollback() {
    try {
        if (fs.existsSync(panelPath)) fs.unlinkSync(panelPath);
        fs.writeFileSync(REGISTRY, before.registry);
        fs.writeFileSync(targetConfig, before.config);
    } catch (e) {
        console.error('回滚也失败了，请手工检查这三个文件：');
        console.error('  ' + panelPath);
        console.error('  ' + REGISTRY);
        console.error('  ' + targetConfig);
    }
}

// 校验：接线必须通过，否则回滚
const verify = spawnSync('node', ['tools/verify-mobile.js'], {
    cwd: ROOT,
    encoding: 'utf8',
    shell: process.platform === 'win32'
});

if (verify.status !== 0) {
    console.error('');
    console.error('✗ 生成后校验未通过，已回滚：');
    console.error(((verify.stdout || '') + (verify.stderr || '')).trim());
    rollback();
    process.exit(1);
}

console.log('');
console.log('✓ 已生成页面：' + labelArg + '（' + routePath + '）');
console.log('  模式：' + (isSubpage ? '子页面，不进导航栏，靠路径/列表点击进入' : '一级页面，已挂到右侧导航栏'));
console.log('');
console.log('  新建  ' + path.relative(ROOT, panelPath));
console.log('  修改  ' + path.relative(ROOT, REGISTRY) + '（import + 登记）');
console.log('  修改  ' + path.relative(ROOT, targetConfig) + '（' + targetLabel + '）');
console.log('');
console.log('下一步：');
console.log('  1. 打开面板文件，把两处 TODO 换成真实业务（load / renderData）');
console.log('  2. 列表页别自己写分页和下拉刷新，用 src/components/list-view.js');
if (isSubpage) {
    var idPrefix = routePath.replace(/\/:[^/]+$/, '') + '/';
    console.log('  3. 详情页的 id 在 route.params.id 里；列表页跳转用 navigate(\'' + idPrefix + '\' + id)');
}
console.log('  4. 跑 node tools/check-all.js 确认没有新增违规');
console.log('');
