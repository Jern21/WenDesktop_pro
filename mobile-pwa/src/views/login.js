import '../styles/login.css';
import { loginWithCredentials, loginTrial, fetchAuthStatus } from '../api/auth.js';
import { navigate, safeNextFromQuery } from '../router.js';

var THEME_KEY = 'wt_theme';

var ICON_SUN =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" aria-hidden="true">' +
    '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></svg>';
var ICON_MOON =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" aria-hidden="true">' +
    '<path d="M21 14.5A8.5 8.5 0 0 1 9.5 3 7 7 0 1 0 21 14.5z"/></svg>';
var ICON_EYE =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" aria-hidden="true">' +
    '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/></svg>';
var ICON_EYE_OFF =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" aria-hidden="true">' +
    '<path d="M3 3l18 18M10.6 10.6a3 3 0 0 0 4.24 4.24"/><path d="M9.88 5.1A10.4 10.4 0 0 1 12 5c6.5 0 10 7 10 7a18.2 18.2 0 0 1-4.11 5.12M6.12 6.12A18.5 18.5 0 0 0 2 12s3.5 7 10 7a10.3 10.3 0 0 0 5.12-1.38"/></svg>';

function readInitialTheme() {
    try {
        var saved = localStorage.getItem(THEME_KEY);
        if (saved === 'dark' || saved === 'light') return saved;
    } catch (e) { /* ignore */ }
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
        return 'dark';
    }
    return 'light';
}

function applyTheme(mode) {
    document.documentElement.setAttribute('data-theme', mode);
    try {
        localStorage.setItem(THEME_KEY, mode);
    } catch (e) { /* ignore */ }
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) {
        meta.setAttribute('content', mode === 'dark' ? '#000000' : '#f5f5f7');
    }
}

function syncThemeToggle(btn) {
    if (!btn) return;
    var dark = document.documentElement.getAttribute('data-theme') === 'dark';
    btn.innerHTML = dark ? ICON_MOON : ICON_SUN;
    btn.setAttribute('aria-label', dark ? '切换到亮色外观' : '切换到暗色外观');
}

export function mountLogin(root) {
    root.innerHTML = '';
    root.className = 'login-screen';

    var theme = readInitialTheme();
    applyTheme(theme);

    var themeBtn = document.createElement('button');
    themeBtn.type = 'button';
    themeBtn.className = 'login-theme-toggle';
    themeBtn.id = 'login-theme-toggle';
    syncThemeToggle(themeBtn);
    themeBtn.addEventListener('click', function () {
        var next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
        applyTheme(next);
        syncThemeToggle(themeBtn);
    });
    root.appendChild(themeBtn);

    var wrap = document.createElement('div');
    wrap.className = 'login-wrap';

    wrap.innerHTML =
        '<header class="login-brand">' +
        '  <div class="login-logo">' +
        '    <img src="/assets/gif/logo.gif" alt="" width="64" height="64" />' +
        '  </div>' +
        '  <h1 class="login-title">文的项目工作台</h1>' +
        '  <p class="login-subtitle">登录以继续</p>' +
        '</header>' +
        '<form class="login-card" id="login-form" novalidate>' +
        '  <div class="login-field">' +
        '    <label class="login-label" for="login-username">用户名</label>' +
        '    <div class="login-input-wrap">' +
        '      <input id="login-username" class="login-input" type="text" autocomplete="username" placeholder="admin" />' +
        '    </div>' +
        '  </div>' +
        '  <div class="login-field">' +
        '    <label class="login-label" for="login-password">密码</label>' +
        '    <div class="login-input-wrap">' +
        '      <input id="login-password" class="login-input" type="password" autocomplete="current-password" placeholder="密码" />' +
        '      <button type="button" class="login-pwd-toggle" id="login-toggle-pwd" aria-label="显示密码">' +
        ICON_EYE +
        '      </button>' +
        '    </div>' +
        '  </div>' +
        '  <label class="login-remember">' +
        '    <input type="checkbox" id="login-remember" checked />' +
        '    <span>30 天内免登录</span>' +
        '  </label>' +
        '  <p class="login-error" id="login-error" hidden></p>' +
        '  <button type="submit" class="login-submit" id="login-submit">登录</button>' +
        '  <button type="button" class="login-submit login-submit-trial" id="login-trial" hidden>试用账号登录</button>' +
        '</form>' +
        '<p class="login-foot">忘记账号可删除服务端 <code>auth.json</code> 重启，或设置 <code>APP_USERNAME</code> / <code>APP_PASSWORD</code>。</p>';

    root.appendChild(wrap);

    var form = wrap.querySelector('#login-form');
    var user = wrap.querySelector('#login-username');
    var pwd = wrap.querySelector('#login-password');
    var remember = wrap.querySelector('#login-remember');
    var errorEl = wrap.querySelector('#login-error');
    var submitBtn = wrap.querySelector('#login-submit');
    var trialBtn = wrap.querySelector('#login-trial');
    var toggleBtn = wrap.querySelector('#login-toggle-pwd');

    function showError(msg) {
        errorEl.textContent = msg;
        errorEl.hidden = !msg;
    }

    toggleBtn.addEventListener('click', function () {
        var show = pwd.type === 'password';
        pwd.type = show ? 'text' : 'password';
        toggleBtn.innerHTML = show ? ICON_EYE_OFF : ICON_EYE;
        toggleBtn.setAttribute('aria-label', show ? '隐藏密码' : '显示密码');
        pwd.focus();
    });

    user.addEventListener('input', function () { showError(''); });
    pwd.addEventListener('input', function () { showError(''); });

    form.addEventListener('submit', async function (e) {
        e.preventDefault();
        showError('');

        var username = user.value.trim();
        var value = pwd.value;
        if (!username) {
            showError('请输入用户名');
            user.focus();
            return;
        }
        if (!value) {
            showError('请输入密码');
            pwd.focus();
            return;
        }

        submitBtn.disabled = true;
        submitBtn.textContent = '登录中…';

        var result = await loginWithCredentials(username, value, remember.checked);
        if (result.ok) {
            navigate(safeNextFromQuery(), { replace: true });
            return;
        }

        var msg = result.error || '登录失败';
        if (result.code === 'LOCKED') {
            msg = result.error;
        }
        showError(msg);
        submitBtn.disabled = false;
        submitBtn.textContent = '登录';
        pwd.select();
    });

    trialBtn.addEventListener('click', async function () {
        showError('');
        submitBtn.disabled = true;
        trialBtn.disabled = true;
        trialBtn.textContent = '登录中…';
        var result = await loginTrial();
        if (result.ok) {
            navigate(safeNextFromQuery(), { replace: true });
            return;
        }
        showError(result.error || '试用登录失败');
        submitBtn.disabled = false;
        trialBtn.disabled = false;
        trialBtn.textContent = '试用账号登录';
    });

    fetchAuthStatus().then(function (data) {
        if (data && data.usernameHint && !user.value) {
            user.value = data.usernameHint;
        }
        if (data && data.trialLoginAvailable) {
            trialBtn.hidden = false;
        }
    }).catch(function () { /* ignore */ });

    requestAnimationFrame(function () { user.focus(); });
}
