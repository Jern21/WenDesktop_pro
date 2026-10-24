import './styles/app.css';
import './styles/components.css';
import { startPlatform } from '@mobile-platform';
import { clearApiCache, fetchAuthStatus } from './api/auth.js';
import { onUnauthorized } from './api/client.js';
import { toast } from './lib/toast.js';
import { getPath, navigate, startRouter, subscribe } from './router.js';
import { mountLogin } from './views/login.js';
import { mountMobileShell, updateMobileShell, destroyMobileShell } from './mobile-shell.js';

startPlatform();

var authState = null;
var shellActive = false;
var navGeneration = 0;

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
        // 进登录页 = 壳层生命周期的终点，必须先彻底拆掉再换页面。
        // 只置 shellActive = false 是不够的：面板的 destroy 不会被调用（定时器/请求继续跑），
        // document 上关用户菜单的点击监听也不会被摘掉 —— 一个登录周期泄漏一份。
        // 无条件调用（而不是 if (shellActive)）：destroy 是幂等的，
        // 即使 shellActive 因为异常路径跟真实状态脱节，这里也能兜住。
        destroyMobileShell();
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
    // 先用 await 清完旧版 Service Worker 留下的 api-cache，再查登录态。
    // 顺序是有意的：不等它完成就 refreshAuth()，可能从旧缓存里读到上一个账号的状态，
    // 于是先渲染成「已登录」再闪回登录页（换账号时最容易撞上）。
    await clearApiCache();
    startRouter();

    // 登录态失效统一收口：任何页面收到 401 都走这里，页面自己不用各判断一遍。
    // 加一道 currentPath 判断，避免在登录页又被踢回登录页（会闪一下）。
    onUnauthorized(function (err) {
        if (getPath() === '/login') return;
        toast.warn(err && err.message ? err.message : '登录已过期，请重新登录');
        navigate('/login?next=' + encodeURIComponent(getPath()), { replace: true });
    });

    await refreshAuth();

    var path = getPath();
    if (path !== '/login') {
        ensureAuthForRoute(path);
    }

    subscribe(async function (nextPath) {
        var ticket = ++navGeneration;
        await refreshAuth();
        if (ticket !== navGeneration) return;
        renderRoute(nextPath);
    });

    renderRoute(getPath());
}

boot();
