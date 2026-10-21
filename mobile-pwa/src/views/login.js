import '../styles/login.css';
import { loginWithCredentials, loginTrial, fetchAuthStatus } from '../api/auth.js';
import { navigate, safeNextFromQuery } from '../router.js';

export function mountLogin(root) {
    root.innerHTML = '';
    root.className = 'login-screen';

    var wrap = document.createElement('div');
    wrap.className = 'login-wrap';

    wrap.innerHTML =
        '<div class="login-brand">' +
        '  <div class="login-logo" aria-hidden="true">文</div>' +
        '  <h1 class="login-title">文的项目工作台</h1>' +
        '  <p class="login-subtitle">移动版 · 用户名与密码登录</p>' +
        '</div>' +
        '<form class="login-card" id="login-form" novalidate>' +
        '  <label class="login-label" for="login-username">用户名</label>' +
        '  <input id="login-username" class="login-input login-input-block" type="text" autocomplete="username" placeholder="默认 admin" />' +
        '  <label class="login-label" for="login-password">密码</label>' +
        '  <div class="login-pwd-row">' +
        '    <input id="login-password" class="login-input" type="password" autocomplete="current-password" placeholder="请输入密码" />' +
        '    <button type="button" class="login-pwd-toggle" id="login-toggle-pwd" aria-label="显示密码">显示</button>' +
        '  </div>' +
        '  <label class="login-remember">' +
        '    <input type="checkbox" id="login-remember" checked />' +
        '    <span>30 天内免登录</span>' +
        '  </label>' +
        '  <p class="login-error" id="login-error" hidden></p>' +
        '  <button type="submit" class="login-submit" id="login-submit">登录</button>' +
        '  <button type="button" class="login-submit login-submit-trial" id="login-trial" hidden>试用账号登录（免密）</button>' +
        '</form>' +
        '<p class="login-foot">忘记账号可删除服务端 <code>auth.json</code> 重启生成，或设置 <code>APP_USERNAME</code> / <code>APP_PASSWORD</code>。</p>';

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
        toggleBtn.textContent = show ? '隐藏' : '显示';
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
            var next = safeNextFromQuery();
            navigate(next, { replace: true });
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
        trialBtn.textContent = '试用账号登录（免密）';
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
