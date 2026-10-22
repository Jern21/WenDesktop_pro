/**
 * 移动端 API 客户端
 *
 * 与桌面端 `frontend/js/core/api.js` 保持同一套错误语义，但更精简。
 *
 * 三条硬规则（踩过坑，别改回去）：
 *
 * ① 非 2xx 必须把响应体读出来。
 *    只写 `throw new Error('HTTP ' + status)` 会把后端所有中文校验文案全丢掉，
 *    用户只能看到「保存失败：HTTP 400: Bad Request」。
 *    后端统一返回 `{ success:false, error:'订单状态取值非法：xxx' }`，
 *    这里的 buildErrorMessage() 就是负责把它捞出来。
 *
 * ② 写请求不自动重试。
 *    服务端可能已经写入了、只是响应在路上丢了，重试会重复创建记录。
 *    只有 GET/HEAD/OPTIONS 在网络层失败时重试。
 *
 * ③ 登录态失效（401）统一在这里处理。
 *    页面层不用各自判断「是不是过期了」，注册一个 onUnauthorized 回调即可。
 *    但 /api/auth/login 自己返回 401（密码错）不能被当成"过期"，
 *    否则登录页会被自己的错误踢回登录页，形成死循环。
 */
import { getApiBase, AUTH_TOKEN_KEY } from '../lib/config.js';

var DEFAULT_TIMEOUT_MS = 20000;

/** 这些路径的 401 是业务结果（凭据错误），不触发全局登出 */
var AUTH_BUSINESS_PATHS = ['/api/auth/login', '/api/auth/logout', '/api/auth/password'];

/** 只有这些方法失败后重试是安全的 */
var RETRYABLE_METHODS = ['GET', 'HEAD', 'OPTIONS'];

/* ============================================================
 * 错误对象
 * ========================================================== */

/**
 * @param {string} message 可直接展示给用户的中文文案
 * @param {Object} [meta]
 * @param {number} [meta.status] HTTP 状态码；0 表示没拿到响应（网络/超时/取消）
 * @param {string} [meta.code] 后端业务码，如 BAD_CREDENTIALS / UNAUTHORIZED
 * @param {*} [meta.payload] 解析后的 JSON 响应体
 * @param {string} [meta.body] 原始响应文本
 * @param {boolean} [meta.isHttpError] 是否是服务端明确返回的错误状态
 * @param {boolean} [meta.aborted] 是否被主动取消
 * @param {boolean} [meta.timeout] 是否超时
 */
export class ApiError extends Error {
    constructor(message, meta) {
        super(message);
        var m = meta || {};
        this.name = 'ApiError';
        this.status = m.status || 0;
        this.code = m.code || '';
        this.payload = m.payload === undefined ? null : m.payload;
        this.body = m.body || '';
        this.isHttpError = !!m.isHttpError;
        this.aborted = !!m.aborted;
        this.timeout = !!m.timeout;
    }

    /** 是否是「没连上」这一类（区别于服务端明确拒绝） */
    get isNetworkError() {
        return this.status === 0 && !this.aborted;
    }
}

/* ============================================================
 * Token 存储
 * ========================================================== */

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
    } catch (e) { /* 隐私模式下 localStorage 会抛，忽略 */ }
}

/* ============================================================
 * 未授权回调
 * ========================================================== */

var unauthorizedHandlers = [];

/** @param {(err: ApiError) => void} fn */
export function onUnauthorized(fn) {
    if (typeof fn === 'function') unauthorizedHandlers.push(fn);
    return function off() {
        var i = unauthorizedHandlers.indexOf(fn);
        if (i !== -1) unauthorizedHandlers.splice(i, 1);
    };
}

function notifyUnauthorized(err) {
    unauthorizedHandlers.forEach(function (fn) {
        try { fn(err); } catch (e) { console.error('[api] onUnauthorized 回调异常', e); }
    });
}

/* ============================================================
 * 工具
 * ========================================================== */

function mergeUrl(path) {
    var base = getApiBase();
    var p = String(path || '');
    if (/^https?:\/\//i.test(p)) return p;
    if (p.charAt(0) !== '/') p = '/' + p;
    return base + p;
}

function pathOnly(path) {
    return String(path || '').split('?')[0];
}

export function buildErrorMessage(res, payload, text) {
    if (payload) {
        if (payload.error) return String(payload.error);
        if (payload.message) return String(payload.message);
    }
    var trimmed = String(text || '').trim();
    if (trimmed && trimmed.charAt(0) === '<') {
        return '服务器返回了非预期的页面（状态 ' + res.status + '），请检查服务是否正常';
    }
    if (trimmed) {
        // 纯文本错误体，截断避免把整个堆栈糊到界面上
        return trimmed.length > 200 ? trimmed.slice(0, 200) + '…' : trimmed;
    }
    if (res.status === 401) return '登录已过期，请重新登录';
    if (res.status === 403) return '没有权限执行此操作';
    if (res.status === 404) return '请求的数据不存在';
    if (res.status === 429) return '操作太频繁，请稍后再试';
    if (res.status >= 500) return '服务器出错了（' + res.status + '），请稍后重试';
    return '请求失败（' + res.status + '）';
}

function isAbortError(e) {
    return e && (e.name === 'AbortError' || e.code === 20);
}

/* ============================================================
 * 核心请求
 * ========================================================== */

/**
 * @param {string} path 以 / 开头（或完整 URL）
 * @param {Object} [options]
 * @param {string} [options.method]
 * @param {*} [options.body] 普通对象自动 JSON 化；FormData 原样发
 * @param {Object} [options.headers]
 * @param {AbortSignal} [options.signal] 外部取消信号（页面卸载时用）
 * @param {number} [options.timeout] 毫秒，0 表示不限
 * @param {boolean} [options.anonymous] true 时不带 Authorization（登录接口用）
 * @param {number} [options.retryCount] 网络层失败重试次数，只有幂等方法生效
 */
async function request(path, options) {
    var opts = options || {};
    var method = String(opts.method || 'GET').toUpperCase();
    var timeout = opts.timeout === undefined ? DEFAULT_TIMEOUT_MS : opts.timeout;

    // 用「有没有传」判断，不能用 ||，否则 retryCount:0 会被吞掉
    var retryCount = Object.prototype.hasOwnProperty.call(opts, 'retryCount')
        ? Math.max(0, parseInt(opts.retryCount, 10) || 0)
        : (RETRYABLE_METHODS.indexOf(method) !== -1 ? 1 : 0);

    var attempt = 0;
    var lastErr = null;

    while (attempt <= retryCount) {
        try {
            return await once(path, opts, method, timeout);
        } catch (e) {
            lastErr = e;
            // 只重试「网络层失败」+ 幂等方法；服务端明确的 4xx/5xx 不重试。
            //
            // ⚠️ 超时（e.timeout）必须排除在重试之外：
            //    默认超时 20 秒，重试一次就是 40 秒挂在那儿，用户早以为卡死了。
            //    超时的正确处理是「快速失败、让用户点重试」，而不是默默再等一轮。
            //    （实测踩过：这条判断漏了 !e.timeout，端到端测试里表现为
            //      「明明设了 1ms 超时却不报错」，因为重试把错误吞掉了。）
            var canRetry = e instanceof ApiError
                && e.isNetworkError
                && !e.aborted
                && !e.timeout
                && RETRYABLE_METHODS.indexOf(method) !== -1
                && attempt < retryCount;
            if (!canRetry) throw e;
            attempt += 1;
            // 简单退避，避免瞬间打三次
            await new Promise(function (r) { setTimeout(r, 300 * attempt); });
        }
    }
    throw lastErr;
}

async function once(path, opts, method, timeout) {
    var headers = Object.assign({ Accept: 'application/json' }, opts.headers || {});

    if (!opts.anonymous) {
        var token = getStoredToken();
        if (token) headers.Authorization = 'Bearer ' + token;
    }

    var body = opts.body;
    var isForm = typeof FormData !== 'undefined' && body instanceof FormData;
    if (body !== undefined && body !== null && !isForm) {
        headers['Content-Type'] = 'application/json';
    }

    var controller = new AbortController();
    var timer = null;
    if (timeout > 0) {
        timer = setTimeout(function () { controller.abort(); }, timeout);
    }

    // 把外部 signal 接到内部 controller 上
    var external = opts.signal;
    var onExternalAbort = null;
    if (external) {
        if (external.aborted) controller.abort();
        else {
            onExternalAbort = function () { controller.abort(); };
            external.addEventListener('abort', onExternalAbort);
        }
    }

    var init = {
        method: method,
        headers: headers,
        credentials: 'include',
        signal: controller.signal
    };
    if (body !== undefined && body !== null) {
        init.body = isForm ? body : JSON.stringify(body);
    }

    var res;
    var text;
    try {
        res = await fetch(mergeUrl(path), init);
        text = await res.text();
    } catch (e) {
        if (isAbortError(e)) {
            if (external && external.aborted) {
                throw new ApiError('请求已取消', { status: 0, code: 'ABORTED', aborted: true });
            }
            throw new ApiError(
                '请求超时（' + Math.round(timeout / 1000) + ' 秒），请检查网络或服务状态',
                { status: 0, code: 'TIMEOUT', timeout: true }
            );
        }
        throw new ApiError('网络连接失败，请确认后端服务已启动', {
            status: 0,
            code: 'NETWORK',
            body: e && e.message ? String(e.message) : ''
        });
    } finally {
        if (timer) clearTimeout(timer);
        if (external && onExternalAbort) external.removeEventListener('abort', onExternalAbort);
    }

    var payload = null;
    if (text) {
        try {
            payload = JSON.parse(text);
        } catch (e) {
            payload = null;
        }
    }

    if (!res.ok) {
        var err = new ApiError(buildErrorMessage(res, payload, text), {
            status: res.status,
            code: (payload && payload.code) || '',
            payload: payload,
            body: text,
            isHttpError: true
        });

        var businessPath = AUTH_BUSINESS_PATHS.indexOf(pathOnly(path)) !== -1;
        if (res.status === 401 && !opts.anonymous && !businessPath) {
            setStoredToken('');
            notifyUnauthorized(err);
        }
        throw err;
    }

    // 204 / 空响应体：给个空对象而不是 null，省得调用方到处判空
    return payload === null ? { success: true, data: null } : payload;
}

/* ============================================================
 * 对外接口
 * ========================================================== */

export const api = {
    request: request,

    get: function (path, options) {
        return request(path, Object.assign({}, options, { method: 'GET' }));
    },

    post: function (path, body, options) {
        return request(path, Object.assign({}, options, { method: 'POST', body: body }));
    },

    put: function (path, body, options) {
        return request(path, Object.assign({}, options, { method: 'PUT', body: body }));
    },

    patch: function (path, body, options) {
        return request(path, Object.assign({}, options, { method: 'PATCH', body: body }));
    },

    /** delete 是保留字，只能叫 del */
    del: function (path, options) {
        return request(path, Object.assign({}, options, { method: 'DELETE' }));
    },

    /** 文件上传：FormData 原样发，不设 Content-Type（浏览器要自己写 boundary） */
    postForm: function (path, formData, options) {
        return request(path, Object.assign({}, options, { method: 'POST', body: formData }));
    }
};
