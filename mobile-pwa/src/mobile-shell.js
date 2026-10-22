import './styles/shell.css';
import { MOBILE_NAV } from './config/nav.js';
import { matchRoute, railPathOf } from './config/routes.js';
import { NAV_ICONS, ICON_BACK } from './icons.js';
import { goBack, navigate } from './router.js';
import { logout, fetchAuthStatus } from './api/auth.js';
import { settings as settingsApi } from './api/resources.js';
import { PANEL_REGISTRY } from './views/panels/registry.js';
import { mountPlaceholderPanel } from './views/panels/placeholder.js';

var THEME_KEY = 'wt_theme';

var shellState = {
    root: null,
    contentEl: null,
    titleBtn: null,
    labelEl: null,
    subtitleEl: null,
    backBtn: null,
    topbarInner: null,
    userWrap: null,
    userBtn: null,
    path: '/',
    route: null,
    sessionUser: null,
    // 挂在 document 上的那个点击监听（关闭用户菜单用）。
    // 必须留引用，否则销毁时摘不掉 —— 匿名监听是摘不掉的，这是上一版的泄漏点。
    docClickHandler: null,
    // 生命周期代数：销毁/重建时 +1，让还在飞的异步结果（如 refreshTopbarUser）自动作废。
    // 没有它的话，退出登录后旧账号的顶栏头像可能被回写到新会话的顶栏上。
    generation: 0
};

function escapeXml(value) {
    return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}

function avatarFromName(name) {
    var label = String(name || '用').trim().charAt(0) || '用';
    var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96">' +
        '<rect width="96" height="96" rx="48" fill="#1d1d1f"/>' +
        '<text x="50%" y="50%" dy=".08em" text-anchor="middle" dominant-baseline="middle" ' +
        'font-family="Inter, system-ui, sans-serif" font-size="40" font-weight="600" fill="#fff">' +
        escapeXml(label) + '</text></svg>';
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
}

function resolveDisplayName(user, profile) {
    if (profile && profile.nickname) return profile.nickname;
    if (!user) return '用户';
    return user.displayName || user.username || '用户';
}

function applyTopbarUser(user, profile) {
    shellState.sessionUser = user || null;
    var img = document.getElementById('mobile-topbar-avatar');
    var nameEl = document.getElementById('mobile-topbar-user-name');
    var menuLine = document.getElementById('mobile-topbar-user');
    if (!user) {
        if (nameEl) nameEl.textContent = '…';
        return;
    }
    var name = resolveDisplayName(user, profile);
    if (nameEl) nameEl.textContent = name;
    if (menuLine) {
        menuLine.textContent = user.isTrial
            ? '试用账号 · ' + user.username
            : '账号 · ' + user.username;
    }
    if (img) {
        img.src = (profile && profile.avatar) ? profile.avatar : avatarFromName(name);
        img.alt = name;
    }
}

function refreshTopbarUser() {
    var gen = shellState.generation;
    return Promise.all([
        fetchAuthStatus(),
        settingsApi.get().catch(function () { return null; })
    ]).then(function (pair) {
        // 期间壳层被销毁/重建过（退出登录、快速切换账号）→ 结果已过期，丢弃。
        // 不丢的话会把上一个账号的名字/头像写进下一个会话的顶栏。
        if (gen !== shellState.generation) return;
        var status = pair[0];
        var settingsRes = pair[1];
        var user = status && status.user;
        var profile = settingsRes && settingsRes.success && settingsRes.data
            ? settingsRes.data.profile
            : null;
        applyTopbarUser(user, profile);
        syncTopbar(matchRoute(shellState.path));
    }).catch(function () { /* ignore */ });
}

function applyThemeFromStorage() {
    try {
        var t = localStorage.getItem(THEME_KEY);
        if (t === 'dark' || t === 'light') {
            document.documentElement.setAttribute('data-theme', t);
        }
    } catch (e) { /* ignore */ }
}

function destroyActivePanel() {
    if (shellState.panel && typeof shellState.panel.destroy === 'function') {
        try { shellState.panel.destroy(); } catch (e) { /* ignore */ }
    }
    shellState.panel = null;
}

/**
 * 销毁整个壳层 —— 退出登录（进入登录页）前必须调。
 *
 * 为什么需要它：app.js 进登录页时只把 shellActive 置 false 然后替换 DOM，
 * 面板从来没被 destroy（定时器、轮询、后续 fetch 都还在跑），
 * document 上那个关用户菜单的点击监听也还挂着。
 * 一个登录周期泄漏一份：隔离实测跑两轮 = 全局点击监听 2 个、面板 destroy 调用 0 次。
 *
 * 幂等：没挂载过、重复调用都安全（mountMobileShell 开头也会先调一次兜底，
 * 这样即使将来别处新加了挂载入口而忘了先销毁，也不会叠加监听）。
 */
export function destroyMobileShell() {
    destroyActivePanel();

    if (shellState.docClickHandler) {
        document.removeEventListener('click', shellState.docClickHandler);
        shellState.docClickHandler = null;
    }

    if (shellState.root) {
        shellState.root.innerHTML = '';
        shellState.root.className = '';
    }

    // 代数 +1：让还在飞的 refreshTopbarUser 结果作废，
    // 否则上一个账号的头像/用户名会被写进下一个会话的顶栏。
    shellState.generation += 1;

    shellState.root = null;
    shellState.contentEl = null;
    shellState.titleBtn = null;
    shellState.labelEl = null;
    shellState.subtitleEl = null;
    shellState.backBtn = null;
    shellState.topbarInner = null;
    shellState.userWrap = null;
    shellState.userBtn = null;
    shellState.path = '/';
    shellState.route = null;
    shellState.sessionUser = null;
}

/**
 * 渲染当前页面。
 *
 * 这里不再出现任何具体页面的名字 —— 全部交给 PANEL_REGISTRY。
 * 想在 nav 里加一个新页面，只需要在注册表里登记，shell 无需改动（详见 registry.js）。
 *
 * 传下去的是**整个路由对象**（route），不是 nav 项：
 * 详情页需要 route.params.id，nav 项里没有这个字段。
 */
function renderPanel(route) {
    if (!shellState.contentEl) return;
    destroyActivePanel();
    var container = shellState.contentEl;
    var entry = PANEL_REGISTRY[route.panel];

    container.classList.toggle('mobile-content--flush', !!(entry && entry.flush));

    if (!entry) {
        // 没登记的面板走占位页：这不是错误，而是「页面还没做」的正常状态。
        // 但如果 nav.js / routes.js 里写了 panel 名字却忘了登记，控制台会有提示（见 tools/verify-mobile.js）。
        shellState.panel = mountPlaceholderPanel(
            container,
            route.placeholderTitle || route.label,
            route.placeholderHint
        );
        return;
    }

    shellState.panel = entry.mount(container, route) || null;
}

function syncTopbar(route) {
    if (!shellState.labelEl || !shellState.subtitleEl) return;
    shellState.labelEl.textContent = route.label;
    shellState.subtitleEl.textContent = route.subtitle || '';

    // 返回按钮只在子页面出现。用 hidden 属性而不是删节点：
    // 反复增删 DOM 会让顶栏抖动，也会让之前绑过监听的引用失效。
    if (shellState.backBtn) {
        if (route.isSubpage) {
            shellState.backBtn.removeAttribute('hidden');
            shellState.backBtn.setAttribute('aria-label', '返回' + (route.parent || ''));
        } else {
            shellState.backBtn.setAttribute('hidden', '');
        }
    }
}

function syncRail(activePath) {
    if (!shellState.root) return;
    var buttons = shellState.root.querySelectorAll('.mobile-rail-btn');
    buttons.forEach(function (btn) {
        var path = btn.getAttribute('data-path');
        btn.classList.toggle('is-active', path === activePath || (path === '/' && activePath === '/home'));
    });
}

export function updateMobileShell(path) {
    // 壳层没挂载（例如刚被 destroyMobileShell 拆掉）时直接忽略：
    // 退出登录过程中可能还有一次迟到的路由通知，不能让它去动用空引用。
    if (!shellState.root) return;
    applyThemeFromStorage();
    var route = matchRoute(path);
    shellState.path = route.path;
    shellState.route = route;
    syncTopbar(route);
    syncRail(railPathOf(route));
    renderPanel(route);
}

export function mountMobileShell(root, path) {
    // 兜底：重复挂载前先彻底拆掉上一份，避免监听/面板叠加（幂等，未挂载时是空操作）。
    destroyMobileShell();

    applyThemeFromStorage();
    root.innerHTML = '';
    root.className = 'mobile-app-root';

    var route = matchRoute(path);
    shellState.path = route.path;
    shellState.route = route;
    shellState.root = root;

    var shell = document.createElement('div');
    shell.className = 'mobile-shell';

    var topbar = document.createElement('header');
    topbar.className = 'mobile-topbar';
    topbar.innerHTML =
        '<div class="mobile-topbar-row">' +
        '  <div class="mobile-topbar-page">' +
        '    <button type="button" class="mobile-topbar-back" id="mobile-topbar-back" aria-label="返回" hidden>' +
        ICON_BACK +
        '    </button>' +
        '    <div class="mobile-topbar-titles">' +
        '      <h1 class="mobile-topbar-title" id="mobile-topbar-label">' + route.label + '</h1>' +
        '      <p class="mobile-topbar-sub" id="mobile-topbar-sub">' + (route.subtitle || '') + '</p>' +
        '    </div>' +
        '  </div>' +
        '  <div class="mobile-topbar-user-wrap" id="mobile-topbar-user-wrap">' +
        '    <button type="button" class="mobile-topbar-user-btn" id="mobile-topbar-user-btn" aria-haspopup="true" aria-expanded="false">' +
        '      <img class="mobile-topbar-avatar" id="mobile-topbar-avatar" src="" alt="" width="32" height="32" />' +
        '      <span class="mobile-topbar-user-name" id="mobile-topbar-user-name">…</span>' +
        '    </button>' +
        '    <div class="mobile-topbar-menu" id="mobile-topbar-menu" role="menu">' +
        '      <p class="mobile-topbar-user" id="mobile-topbar-user"></p>' +
        '      <button type="button" role="menuitem" data-action="logout" class="danger">退出登录</button>' +
        '    </div>' +
        '  </div>' +
        '</div>';

    var body = document.createElement('div');
    body.className = 'mobile-body';

    var content = document.createElement('main');
    content.className = 'mobile-content';
    content.id = 'mobile-content';
    content.setAttribute('role', 'main');

    var rail = document.createElement('nav');
    rail.className = 'mobile-rail';
    rail.setAttribute('aria-label', '页面切换');

    var activeRailPath = railPathOf(route);
    var lastGroup = null;
    MOBILE_NAV.forEach(function (item) {
        // 换组处插一条分隔线。12 个纯图标并排、没有文字，
        // 不画分隔的话「订单」和「数据看板」看起来就是同一坨。
        if (lastGroup && item.group && item.group !== lastGroup) {
            var sep = document.createElement('div');
            sep.className = 'mobile-rail-sep';
            sep.setAttribute('aria-hidden', 'true');
            rail.appendChild(sep);
        }
        lastGroup = item.group || lastGroup;

        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'mobile-rail-btn';
        btn.setAttribute('data-path', item.path);
        btn.setAttribute('aria-label', item.label);
        btn.setAttribute('title', item.label);
        btn.innerHTML = NAV_ICONS[item.icon] || NAV_ICONS.grid;
        if (item.path === activeRailPath) btn.classList.add('is-active');
        btn.addEventListener('click', function () {
            // 点当前页的按钮：如果当前在它的详情页，等于「回到列表」，是符合直觉的
            if (item.path === shellState.path) return;
            navigate(item.path);
        });
        rail.appendChild(btn);
    });

    body.appendChild(content);
    body.appendChild(rail);
    shell.appendChild(topbar);
    shell.appendChild(body);
    root.appendChild(shell);

    shellState.contentEl = content;
    shellState.labelEl = topbar.querySelector('#mobile-topbar-label');
    shellState.subtitleEl = topbar.querySelector('#mobile-topbar-sub');
    shellState.backBtn = topbar.querySelector('#mobile-topbar-back');
    shellState.userWrap = topbar.querySelector('#mobile-topbar-user-wrap');
    shellState.userBtn = topbar.querySelector('#mobile-topbar-user-btn');

    if (shellState.backBtn) {
        shellState.backBtn.addEventListener('click', function () {
            var current = shellState.route || matchRoute(shellState.path);
            goBack(current.parent || '/');
        });
    }

    function closeUserMenu() {
        if (!shellState.userWrap) return;
        shellState.userWrap.classList.remove('is-open');
        if (shellState.userBtn) shellState.userBtn.setAttribute('aria-expanded', 'false');
    }

    if (shellState.userBtn) {
        shellState.userBtn.addEventListener('click', function (e) {
            e.stopPropagation();
            var open = shellState.userWrap.classList.toggle('is-open');
            shellState.userBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
        });
    }

    // 具名引用存进 shellState —— 匿名函数 destroy 时摘不掉，那是上一版泄漏的根源。
    shellState.docClickHandler = function (e) {
        if (shellState.userWrap && !shellState.userWrap.contains(e.target)) closeUserMenu();
    };
    document.addEventListener('click', shellState.docClickHandler);

    topbar.querySelector('[data-action="logout"]').addEventListener('click', async function () {
        closeUserMenu();
        await logout();
        navigate('/login', { replace: true });
    });

    syncTopbar(route);
    renderPanel(route);
    refreshTopbarUser();
}
