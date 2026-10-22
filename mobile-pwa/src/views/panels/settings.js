/**
 * 设置：主题在本机切换，退出时清掉接口缓存。
 * 资料只读。配图密钥即使服务端已打码，也不写进页面。
 */
import { settings } from '../../api/resources.js';
import { logout } from '../../api/auth.js';
import { escapeHtml, formatDate, maskPhone } from '../../lib/format.js';
import { navigate } from '../../router.js';

var THEME_KEY = 'wt_theme';

function applyTheme(next) {
    document.documentElement.setAttribute('data-theme', next);
    try {
        localStorage.setItem(THEME_KEY, next);
    } catch (e) { /* ignore */ }
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', next === 'dark' ? '#000000' : '#f5f5f7');
}

function profileLines(data) {
    var profile = data && data.profile ? data.profile : {};
    var lines = [];
    lines.push(profile.nickname || profile.realName || '未填写昵称');
    var role = [profile.role, profile.city].filter(Boolean).join(' · ');
    if (role) lines.push(role);
    if (profile.phone) lines.push(maskPhone(profile.phone));
    if (profile.email) lines.push(profile.email);
    var backup = data && data.backup && data.backup.lastBackup;
    if (backup) lines.push('最近备份 ' + (formatDate(backup, 'datetime') || backup));
    var configured = data && data.imageGen && data.imageGen.apiKeyConfigured;
    if (data && data.imageGen) lines.push(configured ? '配图密钥已配置' : '配图密钥未配置');
    return lines;
}

export function mountSettingsPanel(container) {
    var disposed = false;
    var dark = document.documentElement.getAttribute('data-theme') === 'dark';

    container.innerHTML =
        '<section class="m-card">' +
        '  <h2 class="m-card-title">资料</h2>' +
        '  <div class="m-card-body" data-profile><p>加载中…</p></div>' +
        '</section>' +
        '<section class="m-card">' +
        '  <h2 class="m-card-title">外观</h2>' +
        '  <button type="button" class="m-row-btn" id="panel-theme-toggle">' +
        '    <span>深色模式</span>' +
        '    <span class="m-switch' + (dark ? ' m-switch-on' : '') + '" aria-hidden="true"><span class="m-switch-knob"></span></span>' +
        '  </button>' +
        '</section>' +
        '<section class="m-card">' +
        '  <h2 class="m-card-title">账户</h2>' +
        '  <button type="button" class="m-row-btn m-row-btn-danger" id="panel-logout">退出登录</button>' +
        '</section>';

    var themeBtn = container.querySelector('#panel-theme-toggle');
    var switchEl = themeBtn.querySelector('.m-switch');
    var profileEl = container.querySelector('[data-profile]');

    function onTheme() {
        var next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
        applyTheme(next);
        switchEl.classList.toggle('m-switch-on', next === 'dark');
    }

    async function onLogout() {
        await logout();
        if (disposed) return;
        navigate('/login', { replace: true });
    }

    themeBtn.addEventListener('click', onTheme);
    container.querySelector('#panel-logout').addEventListener('click', onLogout);

    settings.get().then(function (res) {
        if (disposed) return;
        var lines = profileLines(res && res.data);
        profileEl.innerHTML = lines.map(function (line) {
            return '<p>' + escapeHtml(line) + '</p>';
        }).join('');
    }).catch(function (err) {
        if (disposed) return;
        profileEl.innerHTML = '<p></p>';
        profileEl.querySelector('p').textContent = (err && err.message) || '资料加载失败';
    });

    return {
        destroy: function () {
            disposed = true;
            themeBtn.removeEventListener('click', onTheme);
            var logoutBtn = container.querySelector('#panel-logout');
            if (logoutBtn) logoutBtn.removeEventListener('click', onLogout);
        }
    };
}
