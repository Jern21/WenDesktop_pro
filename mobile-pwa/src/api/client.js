import { getApiBase, AUTH_TOKEN_KEY } from './config.js';

function mergeUrl(path) {
    var base = getApiBase();
    var p = path.startsWith('/') ? path : '/' + path;
    return base + p;
}

export function getStoredToken() {
    try {
        return localStorage.getItem(AUTH_TOKEN_KEY) || '';
    } catch (e) {
        return '';
    }
}

export function setStoredToken(token) {
    try {
        if (token) localStorage.setItem(AUTH_TOKEN_KEY, token);
        else localStorage.removeItem(AUTH_TOKEN_KEY);
    } catch (e) { /* ignore */ }
}

/**
 * 与桌面端 api.js 类似的最小封装；跨端口时用 Bearer，代理模式下也可用 cookie。
 */
export async function apiRequest(path, options) {
    var opts = options || {};
    var headers = Object.assign({ Accept: 'application/json' }, opts.headers || {});

    var token = getStoredToken();
    if (token) headers.Authorization = 'Bearer ' + token;

    var init = {
        method: opts.method || 'GET',
        headers: headers,
        credentials: 'include'
    };

    if (opts.body !== undefined && opts.body !== null) {
        if (opts.body instanceof FormData) {
            init.body = opts.body;
        } else {
            headers['Content-Type'] = 'application/json';
            init.body = JSON.stringify(opts.body);
        }
    }

    var res = await fetch(mergeUrl(path), init);
    var json = null;
    var text = await res.text();
    try {
        json = text ? JSON.parse(text) : null;
    } catch (e) {
        json = { success: false, error: '响应不是 JSON' };
    }

    if (!res.ok) {
        var err = new Error((json && json.error) || res.statusText || '请求失败');
        err.status = res.status;
        err.payload = json;
        throw err;
    }
    return json;
}

export const api = {
    get: function (path) { return apiRequest(path, { method: 'GET' }); },
    post: function (path, body) { return apiRequest(path, { method: 'POST', body: body }); }
};
