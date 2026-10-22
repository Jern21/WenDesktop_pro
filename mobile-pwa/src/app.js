import './styles/app.css';
import { registerSW } from 'virtual:pwa-register';
import { fetchAuthStatus } from './api/auth.js';
import { getPath, navigate, startRouter, subscribe } from './router.js';
import { mountLogin } from './views/login.js';
import { mountMobileShell, updateMobileShell } from './mobile-shell.js';

registerSW({ immediate: true });

var authState = null;
var shellActive = false;

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
        shellActive = false;
        if (isAuthed()) {
            navigate('/', { replace: true });
            return;
        }
        mountLogin(root);
        return;
    }

    ensureAuthForRoute(path);
    if (!isAuthed()) return;

    if (!shellActive) {
        mountMobileShell(root, path);
        shellActive = true;
    } else {
        updateMobileShell(path);
    }
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
