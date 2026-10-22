/**
 * 移动端静态对账（补上 tools/ 下两个 verify 脚本从没覆盖 mobile-pwa 的空白）
 *
 * 跑法：node tools/verify-mobile.js
 *
 * 查的都是「不报错但会烂掉」的问题 —— 这类问题最贵，因为编译能过、页面能开：
 *
 *  1. nav.js 里写了 panel 名字，但 registry.js 没登记
 *     → 静默落到占位页，看起来像「这页还没做」，其实是漏登记
 *  2. registry 里登记了，但 nav 里没有任何入口
 *     → 孤儿代码，没人知道它该不该删
 *  3. 相对 import 指向不存在的文件
 *     → vite 开发时白屏、build 时才报错，定位时间长
 *  4. panel 文件没有导出 mount 函数
 *     → 运行时 TypeError: entry.mount is not a function
 *  5. **视图里绕过封装层直接打接口**（`api.get('/api/...')`）
 *     → 这正是 workbench 当初的写法，接口一改名就要全项目搜字符串
 *  6. **视图里用 window.alert/confirm**
 *     → 阻塞 JS、打断手势、样式不可控
 *  7. **视图里重复实现 lib/format.js 已有的函数**（escapeHtml/formatMoney...）
 *     → 复制粘贴一旦开始，两边的数量级/四舍五入规则就会慢慢分叉
 *  8. CSS 里 var(--x) 引用了从未定义的变量
 *     → 样式静默失效，页面上完全看不出是变量名拼错了
 *  9. **路由表自身的完整性**（重复路径、parent 指不到、导航项和子页面撞路径）
 *     → 表现是「返回按钮退到占位页」「同一路径有两个入口」，不报错、很难查
 * 10. **语法错误**（用 acorn 真解析一遍）
 *     → 前 9 项都是正则，看不见语法错；实测有非法对象键一路溜到 vite build 才炸
 * 11. **壳层生命周期**（进登录页必须 destroyMobileShell）
 *     → 只置 shellActive=false 时页面看起来正常，泄漏全在监听和定时器里，肉眼零症状
 *
 * 第 9 项不走正则猜，而是**真的把 config/routes.js 加载进来**对账
 * （mobile-pwa/package.json 是 type:module，可以直接 import）。
 * 正则解析 JS 对象早晚会被注释/换行/模板字符串搞挂，那还不如不查。
 *
 * 退出码：0 全部通过（允许 warn）；1 有 error。
 */
'use strict';

var fs = require('fs');
var path = require('path');
var pathToFileURL = require('url').pathToFileURL;

var PROJECT_ROOT = path.join(__dirname, '..');
var MOBILE_ROOT = path.join(PROJECT_ROOT, 'mobile-pwa');
var SRC = path.join(MOBILE_ROOT, 'src');

var errors = [];
var warnings = [];

function err(file, line, msg) {
    errors.push({ file: rel(file), line: line, msg: msg });
}

function warn(file, line, msg) {
    warnings.push({ file: rel(file), line: line, msg: msg });
}

function rel(p) {
    return path.relative(PROJECT_ROOT, p).replace(/\\/g, '/');
}

/* ============================================================
 * 收集文件
 * ========================================================== */

function walk(dir, acc, exts) {
    if (!fs.existsSync(dir)) return acc;
    fs.readdirSync(dir, { withFileTypes: true }).forEach(function (ent) {
        var full = path.join(dir, ent.name);
        if (ent.isDirectory()) {
            if (ent.name === 'node_modules' || ent.name === 'dist') return;
            walk(full, acc, exts);
        } else if (exts.indexOf(path.extname(ent.name)) !== -1) {
            acc.push(full);
        }
    });
    return acc;
}

var jsFiles = walk(SRC, [], ['.js']);
var cssFiles = walk(SRC, [], ['.css']);

function lines(file) {
    return fs.readFileSync(file, 'utf8').split(/\r?\n/);
}

/* ============================================================
 * 1 & 2. nav ↔ registry 对账
 * ========================================================== */

function checkRegistry() {
    var navFile = path.join(SRC, 'config', 'nav.js');
    var routesFile = path.join(SRC, 'config', 'routes.js');
    var regFile = path.join(SRC, 'views', 'panels', 'registry.js');

    if (!fs.existsSync(navFile) || !fs.existsSync(regFile)) {
        err(navFile, 0, '找不到 nav.js 或 registry.js，无法对账');
        return;
    }

    // 面板名字有两个来源：导航项（nav.js）和子页面（routes.js）。
    // 只扫 nav.js 会把 settings 这种「已经收进更多、不在导航栏」的页误判成孤儿。
    var declared = {};
    [navFile, routesFile].forEach(function (file) {
        if (!fs.existsSync(file)) return;
        lines(file).forEach(function (text, i) {
            var trimmed = text.trim();
            if (trimmed.indexOf('//') === 0) return;   // 跳过整行注释
            var m = trimmed.match(/panel\s*:\s*['"]([\w-]+)['"]/);
            if (m) declared[m[1]] = { file: file, line: i + 1 };
        });
    });

    // 只取 PANEL_REGISTRY 对象里的 key
    var regSrc = fs.readFileSync(regFile, 'utf8');
    var body = regSrc.slice(regSrc.indexOf('PANEL_REGISTRY'));
    var regKeys = {};
    body.split(/\r?\n/).forEach(function (text, i) {
        // 只认「顶层 key: {」这种形式，跳过注释行
        var trimmed = text.trim();
        if (trimmed.indexOf('//') === 0) return;
        // 键可能带引号（order-detail 这种带连字符的名字必须写成 'order-detail':）——
        // 不认引号的话，合法的注册项会被误报成「没登记」，而真正的语法错误又查不出来。
        var m = trimmed.match(/^(['"]?)([A-Za-z_$][\w$-]*)\1\s*:\s*\{/);
        if (m) regKeys[m[2]] = i + 1;
    });

    // 声明了非 placeholder 的 panel，必须已登记
    Object.keys(declared).forEach(function (name) {
        if (name === 'placeholder') return;   // 占位是回退态，不需要登记
        if (!regKeys[name]) {
            var d = declared[name];
            err(d.file, d.line,
                '用了 panel:「' + name + '」，但 registry.js 没有登记 → 会静默落到占位页');
        }
    });

    // registry 里的每个 key 都应该有入口（否则是孤儿）
    Object.keys(regKeys).forEach(function (name) {
        if (!declared[name]) {
            warn(regFile, regKeys[name],
                'registry 登记了「' + name + '」，但 nav.js / routes.js 里没有对应入口（孤儿注册项？）');
        }
    });
}

/* ============================================================
 * 9. 路由表完整性（加载真实模块对账，不靠正则）
 * ========================================================== */

async function checkRoutes() {
    var navFile = path.join(SRC, 'config', 'nav.js');
    var routesFile = path.join(SRC, 'config', 'routes.js');

    if (!fs.existsSync(routesFile)) {
        err(routesFile, 0,
            '缺少 config/routes.js：路径 → 页面的映射必须有唯一实现，不能在 shell 里散着写');
        return;
    }

    var mod;
    var navMod;
    try {
        mod = await import(pathToFileURL(routesFile).href);
        navMod = await import(pathToFileURL(navFile).href);
    } catch (e) {
        err(routesFile, 0, '路由表加载失败：' + (e && e.message ? e.message : e));
        return;
    }

    var routes = mod.ROUTES || [];
    var subpages = mod.SUBPAGE_ROUTES || [];
    var navItems = navMod.MOBILE_NAV || [];

    if (!routes.length) {
        err(routesFile, 0, 'ROUTES 是空的');
        return;
    }

    var byPattern = Object.create(null);
    routes.forEach(function (r) {
        if (byPattern[r.pattern]) {
            err(routesFile, 0, '路由重复登记：「' + r.pattern + '」出现了两次（后一条永远匹配不到）');
        }
        byPattern[r.pattern] = r;
    });

    routes.forEach(function (r) {
        if (r.parent && !byPattern[r.parent]) {
            err(routesFile, 0,
                '子页面「' + r.pattern + '」的 parent「' + r.parent + '」不是已登记路径 → 返回按钮会退到占位页');
        }
    });

    // 同一路径既是导航项又是子页面 → rail 出按钮、顶栏又出返回按钮，两个入口打架
    var navPaths = Object.create(null);
    navItems.forEach(function (item) { navPaths[item.path] = true; });
    subpages.forEach(function (item) {
        if (navPaths[item.path]) {
            err(routesFile, 0,
                '「' + item.path + '」既是导航项又在 SUBPAGE_ROUTES 里 → 会出现「导航按钮 + 返回按钮」两个入口');
        }
    });

    // 导航项必须有 icon，否则 rail 上全变成默认格子，用户分不清
    navItems.forEach(function (item) {
        if (!item.icon) {
            err(navFile, 0, '导航项「' + item.path + '」没有 icon → rail 上会退化成默认图标');
        }
    });

    // rail 是纵向的，条目多了会顶出屏幕底部（.mobile-body 是 overflow:hidden）。
    // 40px 按钮 + 4px 间距 + 分隔线，12 项约 546px，667px 视口刚好放下。
    if (navItems.length > 12) {
        warn(navFile, 0,
            '导航栏有 ' + navItems.length + ' 项，超过 12 项后矮屏（≤667px）会需要滚动才能点到最后一个；' +
            '要么压缩按钮高度，要么重新引入一层收纳');
    }

    // 冒烟：matchRoute 对几个关键路径必须给出预期结果
    var cases = [
        { input: '/', label: '工作台', parent: null },
        { input: '/home', label: '工作台', parent: null },
        { input: '/settings', label: '设置', parent: null },
        { input: '/stats', label: '数据看板', parent: null },
        { input: '/orders/abc', label: '订单详情', parent: '/orders' }
    ];
    cases.forEach(function (c) {
        var got = mod.matchRoute(c.input);
        if (!got || got.label !== c.label || got.parent !== c.parent) {
            err(routesFile, 0,
                'matchRoute("' + c.input + '") 预期 label=「' + c.label + '」parent=' + c.parent +
                '，实际 label=「' + (got && got.label) + '」parent=' + (got && got.parent));
        }
    });

    var withParams = mod.matchRoute('/orders/abc123');
    if (!withParams.params || withParams.params.id !== 'abc123') {
        err(routesFile, 0, 'matchRoute 没有正确提取路径参数（/orders/abc123 → params.id 应为 abc123）');
    }
}

/* ============================================================
 * 3. 相对 import 目标存在
 * ========================================================== */

function checkImports() {
    jsFiles.forEach(function (file) {
        lines(file).forEach(function (text, i) {
            var re = /(?:from\s+|import\s*)['"](\.[^'"]+)['"]/g;
            var m;
            while ((m = re.exec(text)) !== null) {
                var spec = m[1];
                var target = path.resolve(path.dirname(file), spec);
                if (!fs.existsSync(target)) {
                    err(file, i + 1, 'import 目标不存在：' + spec);
                }
            }
        });
    });
}

/* ============================================================
 * 4. panel 契约：必须导出 mount*Panel
 * ========================================================== */

function checkPanelContract() {
    var dir = path.join(SRC, 'views', 'panels');
    if (!fs.existsSync(dir)) return;

    fs.readdirSync(dir).forEach(function (name) {
        if (path.extname(name) !== '.js') return;
        if (name === 'registry.js' || name === 'placeholder.js') return;
        var file = path.join(dir, name);
        var src = fs.readFileSync(file, 'utf8');
        if (!/export\s+(async\s+)?function\s+mount\w*Panel/.test(src)) {
            err(file, 0, 'panel 文件应导出 `export function mountXxxPanel(container)`');
        }
    });
}

/* ============================================================
 * 5 & 6 & 7. 视图层守卫
 * ========================================================== */

var FORMAT_HELPERS = [
    'escapeHtml', 'formatMoney', 'formatMoneyInt', 'formatMoneyCompact',
    'formatPercent', 'formatGrowth', 'formatDate', 'formatDateLabel',
    'maskPhone', 'toDateKey', 'truncate'
];

function checkViewGuards() {
    var viewFiles = jsFiles.filter(function (f) {
        var r = rel(f);
        return r.indexOf('mobile-pwa/src/views/') === 0 ||
            r.indexOf('mobile-pwa/src/components/') === 0;
    });

    viewFiles.forEach(function (file) {
        lines(file).forEach(function (text, i) {
            var lineNo = i + 1;

            // 5. 绕过封装层直连接口
            if (/api\.(get|post|put|patch|del|request)\s*\(\s*['"`]\/api/.test(text)) {
                err(file, lineNo,
                    '视图里直接拼了接口路径，请改走 api/resources.js（' + text.trim().slice(0, 60) + '）');
            }

            // 6. 原生阻塞弹窗（有正当理由时同行加 // allow-alert）
            if (/window\.(alert|confirm)\s*\(/.test(text) && text.indexOf('allow-alert') === -1) {
                err(file, lineNo, '不要用 window.alert/confirm，改用 lib/toast.js 的 toast / confirmSheet');
            }

            // 7. 重复实现格式化函数
            FORMAT_HELPERS.forEach(function (fn) {
                // 三种定义写法都要认：function fn( / export function fn( / const fn =
                // （export 形式最容易漏，verify-arch 那边实测漏过一次）
                var re = new RegExp('^\\s*(?:export\\s+(?:default\\s+)?)?(?:function\\s+' + fn + '\\b|(?:var|let|const)\\s+' + fn + '\\s*=)');
                if (re.test(text)) {
                    err(file, lineNo, '本地重复定义了 ' + fn + '()，应 import 自 lib/format.js');
                }
            });
        });
    });
}

/* ============================================================
 * 8. CSS 变量：使用处必须有定义
 * ========================================================== */

function checkCssVars() {
    var defined = Object.create(null);
    var usage = [];

    cssFiles.forEach(function (file) {
        var text = fs.readFileSync(file, 'utf8');
        var defRe = /(--[\w-]+)\s*:/g;
        var m;
        while ((m = defRe.exec(text)) !== null) defined[m[1]] = true;

        lines(file).forEach(function (line, i) {
            var useRe = /var\(\s*(--[\w-]+)/g;
            var u;
            while ((u = useRe.exec(line)) !== null) {
                usage.push({ file: file, line: i + 1, name: u[1] });
            }
        });
    });

    usage.forEach(function (u) {
        if (!defined[u.name]) {
            warn(u.file, u.line, 'CSS 变量 ' + u.name + ' 从未定义（拼错了？样式会静默失效）');
        }
    });
}

/* ============================================================
 * 10. 语法检查（真的解析一遍，不是数括号）
 *
 * 为什么需要：第 1~9 项全是正则扫描，**看不见语法错误**。
 * 实测踩过：脚手架给带连字符的面板名生成 `project-detail: {`，这玩意儿不是合法 JS，
 * 但所有静态检查全绿，一路溜到 `vite build` 才炸 —— 而 build 不在 check-all 快速档里。
 *
 * 用 acorn（mobile-pwa 装 vite 时已经带了的传递依赖）在**同一进程**里解析：
 * 23 个文件约 20ms。换成 `node --check` 每个文件 spawn 一次，实测要 10.6 秒，不可接受。
 * ========================================================== */

function checkSyntax() {
    var acorn;
    try {
        acorn = require(path.join(MOBILE_ROOT, 'node_modules', 'acorn'));
    } catch (e) {
        warn(SRC, 0, '找不到 acorn（mobile-pwa 的传递依赖），跳过语法检查；在 mobile-pwa 里跑一次 npm install 可恢复');
        return;
    }

    jsFiles.forEach(function (file) {
        var text = fs.readFileSync(file, 'utf8');
        try {
            acorn.parse(text, { ecmaVersion: 'latest', sourceType: 'module', locations: true });
        } catch (e) {
            err(file, (e && e.loc && e.loc.line) || 0, '语法错误：' + (e && e.message));
        }
    });
}

/* ============================================================
 * 11. 壳层生命周期：进登录页前必须销毁壳层
 *
 * 为什么单列一条：这个问题在 DOM 上完全看不出来 —— 登录页照样显示，
 * 只是面板的 destroy 没被调用（定时器/请求继续跑）、document 上的点击监听每轮 +1。
 * 隔离实测过：两轮登录 = 2 个全局监听、0 次 destroy。
 * 探针（test/shell-probe.html 第 10 节）能抓到，但它需要浏览器 + 后端；
 * 这里加一道静态护栏，改坏了在 check-all 就会响。
 * ========================================================== */

function checkShellLifecycle() {
    var shellFile = path.join(SRC, 'mobile-shell.js');
    var appFile = path.join(SRC, 'app.js');
    if (!fs.existsSync(shellFile) || !fs.existsSync(appFile)) return;

    var shellSrc = fs.readFileSync(shellFile, 'utf8');
    if (!/export\s+function\s+destroyMobileShell\s*\(/.test(shellSrc)) {
        err(shellFile, 0, '缺少 export function destroyMobileShell()：壳层没有销毁入口，退出登录必然泄漏');
    }
    if (!/removeEventListener\s*\(\s*['"]click['"]/.test(shellSrc)) {
        err(shellFile, 0, '销毁逻辑里没有摘掉 document 的 click 监听（匿名监听是摘不掉的，必须留引用）');
    }

    var appLines = lines(appFile);
    var loginLine = -1;
    appLines.forEach(function (text, i) {
        // 只认「带代码块的 if (path === '/login') {」——
        // ensureAuthForRoute 里也有一句 `if (path === '/login') return;`，
        // 按第一处匹配会抓错分支（实测抓到了第 24 行）。
        if (loginLine === -1 && /if\s*\(\s*path\s*===\s*['"]\/login['"]\s*\)\s*\{/.test(text)) loginLine = i;
    });
    if (loginLine === -1) {
        err(appFile, 0, '找不到 app.js 里的 /login 分支，无法核对壳层销毁');
        return;
    }
    // 该分支内（向下 20 行内）必须调用 destroyMobileShell
    var block = appLines.slice(loginLine, loginLine + 20).join('\n');
    if (block.indexOf('destroyMobileShell(') === -1) {
        err(appFile, loginLine + 1,
            '进登录页没有调用 destroyMobileShell()：只置 shellActive=false 不会 destroy 面板、也不会摘掉全局监听');
    }
}

/* ============================================================
 * 执行
 * ========================================================== */

async function main() {
    checkRegistry();
    checkImports();
    checkPanelContract();
    checkViewGuards();
    checkCssVars();
    checkSyntax();
    checkShellLifecycle();
    await checkRoutes();

    console.log('');
    console.log('移动端静态对账（' + jsFiles.length + ' 个 js / ' + cssFiles.length + ' 个 css）');
    console.log('─'.repeat(64));

    if (warnings.length) {
        console.log('');
        console.log('提醒（' + warnings.length + '）：');
        warnings.forEach(function (w) {
            console.log('  · ' + w.file + (w.line ? ':' + w.line : '') + '  ' + w.msg);
        });
    }

    if (errors.length) {
        console.log('');
        console.log('错误（' + errors.length + '）：');
        errors.forEach(function (e) {
            console.log('  ✗ ' + e.file + (e.line ? ':' + e.line : '') + '  ' + e.msg);
        });
        console.log('');
        console.log('失败：' + errors.length + ' 个错误 / ' + warnings.length + ' 个提醒');
        process.exit(1);
    }

    console.log('');
    console.log('✓ 通过：0 个错误 / ' + warnings.length + ' 个提醒');
}

main().catch(function (e) {
    console.error('对账脚本自身异常：' + (e && e.stack ? e.stack : e));
    process.exit(2);
});
