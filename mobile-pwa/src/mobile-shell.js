import './styles/shell.css';
import { MOBILE_NAV, findNavByPath } from './config/nav.js';
import { NAV_ICONS } from './icons.js';
import { navigate } from './router.js';
import { logout, fetchAuthStatus } from './api/auth.js';
import { api } from './api/client.js';
import { mountWorkbenchPanel } from './views/panels/workbench.js';
import { mountPlaceholderPanel } from './views/panels/placeholder.js';
import { mountSettingsPanel } from './views/panels/settings.js';

var THEME_KEY = 'wt_theme';

var shellState = {
    root: null,
    contentEl: null,
    titleBtn: null,
    labelEl: null,
    subtitleEl: null,
    topbarInner: null,
    userWrap: null,
    userBtn: null,
    path: '/',
    sessionUser: null
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
    return Promise.all([
        fetchAuthStatus(),
        api.get('/api/settings').catch(function () { return null; })
    ]).then(function (pair) {
        var status = pair[0];
        var settingsRes = pair[1];
        var user = status && status.user;
        var profile = settingsRes && settingsRes.success && settingsRes.data
            ? settingsRes.data.profile
            : null;
        applyTopbarUser(user, profile);
        syncTopbar(findNavByPath(shellState.path));
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

function renderPanel(nav) {
    if (!shellState.contentEl) return;
    destroyActivePanel();
    var panel = nav.panel;
    var container = shellState.contentEl;

    container.classList.toggle('mobile-content--flush', panel === 'workbench');

    if (panel === 'workbench') {
        shellState.panel = mountWorkbenchPanel(container);
        return;
    }
    if (panel === 'settings') {
        shellState.panel = mountSettingsPanel(container);
        return;
    }
    shellState.panel = mountPlaceholderPanel(
        container,
        nav.placeholderTitle || nav.label,
        nav.placeholderHint
    );
}

function syncTopbar(nav) {
    if (!shellState.labelEl || !shellState.subtitleEl) return;
    shellState.labelEl.textContent = nav.label;
    shellState.subtitleEl.textContent = nav.subtitle || '';
}

function syncRail(activePath) {
    if (!shellState.root) return;
    var buttons = shellState.root.querySelectorAll('.mobile-rail-btn');
    buttons.forEach(function (btn) {
        var path = btn.getAttribute('data-path');
        btn.classList.toggle('is-active', path === activePath || (path === '/' && activePath === '/home'));
    });
}

function normalizePath(path) {
    return path === '/home' ? '/' : path;
}

export function updateMobileShell(path) {
    applyThemeFromStorage();
    var nav = findNavByPath(path);
    shellState.path = normalizePath(path);
    syncTopbar(nav);
    syncRail(shellState.path);
    renderPanel(nav);
}

export function mountMobileShell(root, path) {
    applyThemeFromStorage();
    root.innerHTML = '';
    root.className = 'mobile-app-root';

    var nav = findNavByPath(path);
    shellState.path = normalizePath(path);
    shellState.root = root;

    var shell = document.createElement('div');
    shell.className = 'mobile-shell';

    var topbar = document.createElement('header');
    topbar.className = 'mobile-topbar';
    topbar.innerHTML =
        '<div class="mobile-topbar-row">' +
        '  <div class="mobile-topbar-page">' +
        '    <h1 class="mobile-topbar-title" id="mobile-topbar-label">' + nav.label + '</h1>' +
        '    <p class="mobile-topbar-sub" id="mobile-topbar-sub">' + (nav.subtitle || '') + '</p>' +
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

    MOBILE_NAV.forEach(function (item) {
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'mobile-rail-btn';
        btn.setAttribute('data-path', item.path);
        btn.setAttribute('aria-label', item.label);
        btn.setAttribute('title', item.label);
        btn.innerHTML = NAV_ICONS[item.icon] || NAV_ICONS.grid;
        if (item.path === shellState.path) btn.classList.add('is-active');
        btn.addEventListener('click', function () {
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
    shellState.userWrap = topbar.querySelector('#mobile-topbar-user-wrap');
    shellState.userBtn = topbar.querySelector('#mobile-topbar-user-btn');

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

    document.addEventListener('click', function (e) {
        if (shellState.userWrap && !shellState.userWrap.contains(e.target)) closeUserMenu();
    });

    topbar.querySelector('[data-action="logout"]').addEventListener('click', async function () {
        closeUserMenu();
        await logout();
        navigate('/login', { replace: true });
    });

    renderPanel(nav);
    refreshTopbarUser();
}
