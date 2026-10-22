import { logout } from '../../api/auth.js';
import { navigate } from '../../router.js';

var THEME_KEY = 'wt_theme';

export function mountSettingsPanel(container) {
    var dark = document.documentElement.getAttribute('data-theme') === 'dark';

    container.innerHTML =
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

    themeBtn.addEventListener('click', function () {
        var next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', next);
        try {
            localStorage.setItem(THEME_KEY, next);
        } catch (e) { /* ignore */ }
        var meta = document.querySelector('meta[name="theme-color"]');
        if (meta) meta.setAttribute('content', next === 'dark' ? '#000000' : '#f5f5f7');
        switchEl.classList.toggle('m-switch-on', next === 'dark');
    });

    container.querySelector('#panel-logout').addEventListener('click', async function () {
        await logout();
        navigate('/login', { replace: true });
    });
}
