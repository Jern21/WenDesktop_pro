import './styles/app.css';
import { registerSW } from 'virtual:pwa-register';
import { fetchAuthStatus } from './api/auth.js';
import { getPath, navigate, startRouter, subscribe } from './router.js';
import { mountLogin } from './views/login.js';
import { mountHome } from './views/home.js';

registerSW({ immediate: true });

var authState = null;

function isAuthed() {
    if (!authState) return false;
    if (!authState.authRequired) return true;
    return !!authState.authenticated;
}

function ensureAuthForRoute(path) {
    if (path === '/login') return;
    if (!isAuthed()) {
        navigate('/login?next=' + encodeURIComponent(path), { replace: true });
    }
}

async function refreshAuth() {
    try {
        authState = await fetchAuthStatus();
    } catch (e) {
        authState = { authRequired: true, authenticated: false };
    }
}

function renderRoute(path) {
    var root = document.getElementById('app');
    if (!root) return;

    if (path === '/login') {
        if (isAuthed()) {
            navigate('/', { replace: true });
            return;
        }
        mountLogin(root);
        return;
    }

    if (path !== '/' && path !== '/home') {
        mountHome(root);
        var p = document.createElement('p');
        p.className = 'muted';
        p.style.padding = '16px';
        p.textContent = '页面「' + path + '」尚未实现';
        root.appendChild(p);
        return;
    }

    ensureAuthForRoute(path);
    if (!isAuthed()) return;

    mountHome(root);
}

async function boot() {
    startRouter();
    await refreshAuth();

    var path = getPath();
    if (path !== '/login') {
        ensureAuthForRoute(path);
    }

    subscribe(async function (nextPath) {
        await refreshAuth();
        renderRoute(nextPath);
    });

    renderRoute(getPath());
}

boot();
