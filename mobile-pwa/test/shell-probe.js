/**
 * 外壳路由探针
 *
 * 验证的契约（重构后的核心）：
 *   路径 → matchRoute() → panel 名字 → PANEL_REGISTRY 查表 → entry.mount(container, route) → 页面出来
 *
 * 这条链路一旦断（登记漏了、key 拼错、flush 标记没生效、路径匹配不上），
 * 表现是「所有页面都变成占位页」或者「内容区多了/少了内边距」，
 * 但 build 完全能过 —— 所以必须有探针盯着。
 *
 * 另外验证三件事：
 *  1. 「切走再回来」：workbench 每次 mount 都会新绑事件，
 *     如果 shell 没调 destroy() 就会重复绑定（点一次触发两次）。
 *  2. 参数化路由：/orders/:id 能进详情页、顶栏标题变、返回按钮出现。
 *  3. 返回的两种分支：有上一页走 history.back()；
 *     直接打开详情页（深度 0）走 fallback 退到父级 —— 后者是 PWA 从微信点进来的真实场景，
 *     写错的表现是「点返回直接退出应用」。
 *  4. **壳层生命周期**（第 10 节）：退出登录时壳层必须被彻底销毁。
 *     只置 shellActive = false 不叫销毁 —— 面板 destroy 不调用、document 点击监听不摘，
 *     每登录一次泄漏一份。DOM 上看不出来，所以这里直接数「监听净增」和「destroy 调用次数」。
 */
import { loginWithCredentials } from '../src/api/auth.js';
import { startRouter, subscribe, navigate, goBack, getPath } from '../src/router.js';
import {
    mountMobileShell,
    updateMobileShell,
    destroyMobileShell
} from '../src/mobile-shell.js';
import { PANEL_REGISTRY } from '../src/views/panels/registry.js';

var results = [];

function record(name, ok, detail) {
    results.push({ name: name, ok: ok, detail: detail || '' });
}

function sleep(ms) {
    return new Promise(function (r) { setTimeout(r, ms); });
}

async function waitFor(fn, timeout, label) {
    var deadline = Date.now() + (timeout || 12000);
    while (Date.now() < deadline) {
        var v = fn();
        if (v) return v;
        await sleep(80);
    }
    throw new Error('等待超时：' + (label || ''));
}

async function run() {
    var appEl = document.getElementById('app');

    /* ---- 生命周期埋点：数「document 上 click 监听净增」与「panel.destroy 调用次数」 ----
     * 这两个数在 DOM 里完全看不出来，只能靠拦截 EventTarget 和包一层 mount 才能测。 */
    var clickStats = { add: 0, remove: 0 };
    var rawDocAdd = document.addEventListener;
    var rawDocRemove = document.removeEventListener;
    document.addEventListener = function (type, fn, opts) {
        if (type === 'click') clickStats.add++;
        return rawDocAdd.call(document, type, fn, opts);
    };
    document.removeEventListener = function (type, fn, opts) {
        if (type === 'click') clickStats.remove++;
        return rawDocRemove.call(document, type, fn, opts);
    };

    var destroyCount = 0;
    Object.keys(PANEL_REGISTRY).forEach(function (key) {
        var entry = PANEL_REGISTRY[key];
        var origMount = entry.mount;
        entry.mount = function (container, route) {
            var inst = origMount.call(entry, container, route);
            if (inst && typeof inst.destroy === 'function') {
                var origDestroy = inst.destroy;
                inst.destroy = function () {
                    destroyCount++;
                    return origDestroy.apply(inst, arguments);
                };
            }
            return inst;
        };
    });

    var login = await loginWithCredentials('trial', '', false);
    if (!login.ok) throw new Error('trial 登录失败：' + (login.error || ''));

    /* ---- 挂外壳 ---- */
    startRouter();
    subscribe(function (path) { updateMobileShell(path); });
    mountMobileShell(appEl, '/');

    await waitFor(function () { return appEl.querySelector('.mobile-shell'); }, 8000, '外壳');
    record('外壳挂载成功', true, '');

    var content = appEl.querySelector('.mobile-content');
    record('内容区存在', !!content, '');

    /* ---- 1. 默认路由 / → registry 里的 workbench ---- */
    await waitFor(function () { return appEl.querySelector('.wb-root'); }, 12000, '工作台面板');
    record('/ 路由命中 workbench 面板', true, '');
    record('workbench 的 flush 标记生效',
        content.classList.contains('mobile-content--flush'),
        'class=' + content.className);
    record('右侧导航栏渲染了 12 个入口',
        appEl.querySelectorAll('.mobile-rail-btn').length === 12,
        appEl.querySelectorAll('.mobile-rail-btn').length + ' 个');
    record('导航分组之间画了 2 条分隔线',
        appEl.querySelectorAll('.mobile-rail-sep').length === 2,
        appEl.querySelectorAll('.mobile-rail-sep').length + ' 条');
    record('rail 可滚动（矮屏放不下时的兜底）',
        getComputedStyle(appEl.querySelector('.mobile-rail')).overflowY === 'auto',
        getComputedStyle(appEl.querySelector('.mobile-rail')).overflowY);
    record('当前导航项高亮',
        !!appEl.querySelector('.mobile-rail-btn.is-active'),
        '');
    record('顶级页面不显示返回按钮',
        appEl.querySelector('#mobile-topbar-back').hasAttribute('hidden'),
        '');

    /* ---- 2. 切到 /settings → settings 面板，且 flush 要撤掉 ---- */
    navigate('/settings');
    await waitFor(function () { return appEl.querySelector('#panel-theme-toggle'); }, 6000, '设置面板');
    record('/settings 路由命中 settings 面板', true, '');
    record('切页后 flush 标记被撤掉',
        !content.classList.contains('mobile-content--flush'),
        'class=' + content.className);
    record('顶栏标题跟着路由变化',
        appEl.querySelector('#mobile-topbar-label').textContent === '设置',
        appEl.querySelector('#mobile-topbar-label').textContent);

    /* ---- 3. 切到未登记的路径 → 占位页（不是白屏、不是报错） ---- */
    navigate('/not-in-nav');
    await waitFor(function () { return appEl.querySelector('.m-card-center'); }, 6000, '占位页');
    record('未登记的路径落到占位页',
        appEl.querySelector('.m-card-title-lg').textContent === '页面开发中',
        appEl.querySelector('.m-card-title-lg').textContent);

    /* ---- 4. 切回 / → 重新挂载，且不叠加 ---- */
    navigate('/');
    await waitFor(function () { return appEl.querySelector('.wb-root'); }, 12000, '回到工作台');
    record('切回后工作台重新挂载', true, '');
    record('没有叠加出两个工作台',
        appEl.querySelectorAll('.wb-root').length === 1,
        appEl.querySelectorAll('.wb-root').length + ' 个 .wb-root');
    record('没有残留的设置面板',
        !appEl.querySelector('#panel-theme-toggle'),
        '');

    /* ---- 5. 主题切换（设置面板的实际功能） ---- */
    navigate('/settings');
    await waitFor(function () { return appEl.querySelector('#panel-theme-toggle'); }, 6000, '设置面板二次进入');
    var toggle = appEl.querySelector('#panel-theme-toggle');
    var before = document.documentElement.getAttribute('data-theme');
    toggle.click();
    await sleep(60);
    var after = document.documentElement.getAttribute('data-theme');
    record('主题切换生效', before !== after, before + ' → ' + after);

    /* ---- 6. 一级页判定：设置现在是 rail 上的一级项，不该有返回按钮 ---- */
    record('/settings 是一级页面，不显示返回按钮',
        appEl.querySelector('#mobile-topbar-back').hasAttribute('hidden'), '');
    record('rail 高亮当前一级页（设置）',
        appEl.querySelector('.mobile-rail-btn[data-path="/settings"]').classList.contains('is-active'),
        '');

    /* ---- 7. 长尾页直接从 rail 进入（不再经过「更多」这一层） ---- */
    navigate('/stats');
    await waitFor(function () {
        var t = appEl.querySelector('#mobile-topbar-label');
        return t && t.textContent === '数据看板';
    }, 6000, '数据看板占位页');
    record('rail 上的长尾页可直接进入', getPath() === '/stats', getPath());
    record('数据看板 rail 高亮自己',
        appEl.querySelector('.mobile-rail-btn[data-path="/stats"]').classList.contains('is-active'),
        '');
    record('数据看板不是子页面，无返回按钮',
        appEl.querySelector('#mobile-topbar-back').hasAttribute('hidden'), '');

    /* ---- 8. 参数化路由 /orders/:id ---- */
    navigate('/orders');
    await waitFor(function () {
        var t = appEl.querySelector('#mobile-topbar-label');
        return t && t.textContent === '订单' && appEl.querySelector('.ord-page');
    }, 8000, '订单列表');
    navigate('/orders/abc123');
    await waitFor(function () {
        var t = appEl.querySelector('#mobile-topbar-label');
        return t && t.textContent === '订单详情';
    }, 6000, '订单详情');
    record('参数化路由进入详情页', getPath() === '/orders/abc123', getPath());

    var backBtn = appEl.querySelector('#mobile-topbar-back');
    record('详情页显示返回按钮', !backBtn.hasAttribute('hidden'), '');
    record('详情页 rail 高亮订单',
        appEl.querySelector('.mobile-rail-btn[data-path="/orders"]').classList.contains('is-active'),
        '');

    backBtn.click();
    await waitFor(function () {
        var t = appEl.querySelector('#mobile-topbar-label');
        return t && t.textContent === '订单';
    }, 8000, '点返回回到订单列表');
    record('点返回回到上一页（history.back）', getPath() === '/orders', getPath());
    record('回到列表页后返回按钮消失', backBtn.hasAttribute('hidden'), '');

    /* ---- 9. 直接打开详情页（深度 0）返回走 fallback ----
     * 这是「从微信点分享链接进来」的真实场景：history 里没有上一页，
     * 无脑 history.back() 会直接退出站点，在 PWA 里等于关掉应用。 */
    history.replaceState({ __mobIndex: 0 }, '', '/orders/abc123');
    var usedHistory = goBack('/orders');
    record('深度 0 时返回走 fallback 而不是退出站点',
        usedHistory === false && getPath() === '/orders',
        'usedHistory=' + usedHistory + ' path=' + getPath());

    /* ---- 10. 壳层生命周期：退出登录必须彻底销毁 ----
     * 这一节盯的是「退出登录只置 shellActive = false」那类泄漏：
     * 面板 destroy 没调用（定时器/请求继续跑）、document 点击监听不摘（每轮 +1）。
     * 全部用计数判断，不靠肉眼。 */
    navigate('/settings');
    await waitFor(function () { return appEl.querySelector('#panel-theme-toggle'); }, 6000, '设置面板（视口）');

    function settingsBtn() {
        return appEl.querySelector('.mobile-rail-btn[data-path="/settings"]');
    }
    function settingsVisible() {
        var btn = settingsBtn();
        var railEl = appEl.querySelector('.mobile-rail');
        if (!btn || !railEl) return false;
        var box = btn.getBoundingClientRect();
        var railBox = railEl.getBoundingClientRect();
        return box.height > 8 && box.top >= railBox.top - 1 && box.bottom <= railBox.bottom + 1;
    }

    var shell = appEl.querySelector('.mobile-shell');
    var rail = appEl.querySelector('.mobile-rail');
    shell.style.width = '360px';
    shell.style.height = '320px';
    shell.style.maxHeight = '320px';
    rail.style.paddingBottom = '34px';
    await sleep(40);
    if (!settingsVisible()) rail.scrollTop = rail.scrollHeight;
    await sleep(40);
    record('短屏加安全区后，设置按钮可以滚到',
        settingsVisible() && settingsBtn().classList.contains('is-active'),
        'scrollTop=' + rail.scrollTop + ' client=' + rail.clientHeight);

    shell.style.width = '700px';
    shell.style.height = '240px';
    shell.style.maxHeight = '240px';
    appEl.querySelectorAll('.mobile-rail-btn').forEach(function (btn) {
        btn.style.flex = '0 0 44px';
        btn.style.height = '44px';
        btn.style.minHeight = '44px';
    });
    rail.scrollTop = 0;
    await sleep(40);
    var hiddenBeforeScroll = !settingsVisible();
    rail.scrollTop = rail.scrollHeight;
    await sleep(40);
    record('横屏矮高度下，设置按钮滚到底后仍可选中',
        hiddenBeforeScroll && settingsVisible() && settingsBtn().classList.contains('is-active'),
        'beforeHidden=' + hiddenBeforeScroll + ' scrollTop=' + rail.scrollTop);

    destroyMobileShell();   // 先把前面几节挂的壳层清掉，从干净状态开始数
    var base = { add: clickStats.add, remove: clickStats.remove, destroy: destroyCount };

    /* 10a. 没先销毁就重复挂载 → 不能叠加（mountMobileShell 内部有兜底销毁） */
    mountMobileShell(appEl, '/');
    mountMobileShell(appEl, '/');
    await sleep(80);
    record('重复挂载不叠加壳层',
        appEl.querySelectorAll('.mobile-shell').length === 1,
        appEl.querySelectorAll('.mobile-shell').length + ' 个 .mobile-shell');
    record('重复挂载前会先销毁上一份面板',
        destroyCount - base.destroy >= 1,
        'destroy ' + (destroyCount - base.destroy) + ' 次');

    /* 10b. 用户菜单的「点外部关闭」监听必须仍然有效（别为了防泄漏把监听摘过头） */
    var userBtn = appEl.querySelector('#mobile-topbar-user-btn');
    var userWrap = appEl.querySelector('#mobile-topbar-user-wrap');
    userBtn.click();
    var menuOpened = userWrap.classList.contains('is-open');
    document.body.click();
    record('用户菜单点外部可关闭（全局监听仍在）',
        menuOpened && !userWrap.classList.contains('is-open'),
        'open=' + menuOpened + ' closed=' + !userWrap.classList.contains('is-open'));

    /* 10c. 完整登录周期 ×2：挂载 → 销毁，逐轮查 destroy 与 DOM 残留 */
    var cycles = [];
    for (var i = 0; i < 2; i++) {
        mountMobileShell(appEl, '/');
        await waitFor(function () { return appEl.querySelector('.mobile-shell'); }, 8000, '第 ' + (i + 1) + ' 次挂载');
        await sleep(50);
        var beforeDestroy = destroyCount;
        destroyMobileShell();
        cycles.push({
            destroy: destroyCount - beforeDestroy,
            shellLeft: !!appEl.querySelector('.mobile-shell'),
            btnLeft: !!appEl.querySelector('#mobile-topbar-user-btn')
        });
    }
    record('每个登录周期都调用了面板 destroy',
        cycles.every(function (c) { return c.destroy === 1; }),
        cycles.map(function (c) { return c.destroy; }).join(','));
    record('销毁后壳层与顶栏 DOM 全部清掉',
        cycles.every(function (c) { return !c.shellLeft && !c.btnLeft; }),
        cycles.map(function (c) { return 'shell=' + c.shellLeft + ',btn=' + c.btnLeft; }).join(' | '));

    /* 10d. 净残留：两个完整周期后，document 上的 click 监听必须一个不剩 */
    var addedClicks = clickStats.add - base.add;
    var removedClicks = clickStats.remove - base.remove;
    record('两个登录周期后全局点击监听净增 0',
        addedClicks === removedClicks,
        'add=' + addedClicks + ' remove=' + removedClicks + ' 净残留=' + (addedClicks - removedClicks));

    return results;
}

/**
 * 输出结果。
 * 异常中断时也把**已经跑过的项**打出来 —— 只打印一句「探针异常」会把前面全绿的证据一起丢掉，
 * 排查时等于从零开始猜是哪一步挂的。
 */
function report(list, errorMessage) {
    var failed = list.filter(function (r) { return !r.ok; });
    var allOk = !errorMessage && failed.length === 0;

    var text = list.map(function (r) {
        return (r.ok ? '✓ ' : '✗ ') + r.name + (r.detail ? '  [' + r.detail + ']' : '');
    });
    if (errorMessage) {
        text.push('');
        text.push('探针异常：' + errorMessage);
    }
    text.push('');
    text.push(allOk
        ? ('全部通过：' + list.length + ' 项')
        : ('失败 ' + (failed.length + (errorMessage ? 1 : 0)) + ' / 共 ' + list.length + ' 项（含异常）'));

    var pre = document.getElementById('result');
    pre.textContent = text.join('\n');
    pre.className = allOk ? 'ok' : 'bad';
    document.body.setAttribute('data-probe-result', allOk ? 'OK' : (errorMessage ? 'ERROR' : 'FAIL'));
}

run().then(function (list) {
    report(list, '');
}).catch(function (e) {
    report(results, e && e.message ? e.message : String(e));
});
