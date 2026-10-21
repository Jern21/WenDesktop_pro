import { api } from '../api/client.js';
import { logout } from '../api/auth.js';
import { navigate } from '../router.js';

export function mountHome(root) {
    root.innerHTML = '';
    root.className = 'home-screen';

    var header = document.createElement('header');
    header.className = 'app-header';
    header.innerHTML =
        '<div class="app-title-wrap" id="home-title-wrap">' +
        '  <h1 class="app-title" id="home-title" tabindex="0">工作台 <span class="app-title-caret" aria-hidden="true">▾</span></h1>' +
        '  <p class="muted">移动版首页（开发中）</p>' +
        '  <div class="title-dropdown" id="home-title-menu" role="menu">' +
        '    <button type="button" class="title-dropdown-item" id="home-logout" role="menuitem">退出登录</button>' +
        '  </div>' +
        '</div>';

    var card = document.createElement('section');
    card.className = 'card';
    card.innerHTML = '<h2>连接状态</h2><p class="muted" id="home-status">检测中…</p>';

    root.appendChild(header);
    root.appendChild(card);

    var titleWrap = header.querySelector('#home-title-wrap');
    var titleEl = header.querySelector('#home-title');
    var titleMenu = header.querySelector('#home-title-menu');

    function closeMenu() {
        titleWrap.classList.remove('title-menu-open');
    }

    titleEl.addEventListener('click', function (e) {
        e.stopPropagation();
        titleWrap.classList.toggle('title-menu-open');
    });

    document.addEventListener('click', function (e) {
        if (!titleWrap.contains(e.target)) closeMenu();
    });

    api.get('/api/health')
        .then(function (res) {
            var el = document.getElementById('home-status');
            if (!el) return;
            if (res.success) {
                el.textContent = 'API 正常 · ' + (res.data && res.data.service || 'backend');
            } else {
                el.textContent = 'API 异常';
            }
        })
        .catch(function (e) {
            var el = document.getElementById('home-status');
            if (el) el.textContent = '无法连接 API：' + (e.message || '');
        });

    header.querySelector('#home-logout').addEventListener('click', async function (e) {
        e.preventDefault();
        closeMenu();
        await logout();
        navigate('/login', { replace: true });
    });
}
