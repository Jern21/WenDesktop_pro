/**
 * 会话层 —— 登录状态的唯一入口
 *
 * 分层约定（改代码前先看一眼，别把职责搅在一起）：
 *
 *   client.js     最底：发请求、错误规范化、401 收口。**不知道什么是登录页**。
 *   auth.js（本文件）  会话：拿 token、写 localStorage、loginTrial、登出、查状态。
 *   resources.js  业务：订单/客户/待办…（不含登录，见该文件 auth 段注释）。
 *   views/**      页面：只调 resources 和本文件，不直接操作 token。
 *
 * 为什么把 token 的读写锁在这一层：
 * token 同时存在于 localStorage 和后端 Cookie 两处，
 * 图片（`<img src>`）只能靠 Cookie，接口靠 Bearer，两者必须同时存在才正常。
 * 如果散落到各页面去写 token，就一定会出现「接口能通但图片全裂」的诡异现象。
 */
import { api, setStoredToken, getStoredToken } from './client.js';

/**
 * 查询登录状态。
 *
 * 加了 in-flight 去重：路由每次切换都会调它（app.js 的 subscribe），
 * 连点导航会并发发出好几个 /api/auth/status，纯属浪费。
 * 注意这里只复用「正在飞的那一个请求」，不做时间缓存 ——
 * 缓存会让「刚登录完立刻判断」读到旧状态。
 */
var statusInFlight = null;

export function fetchAuthStatus() {
    if (statusInFlight) return statusInFlight;

    statusInFlight = api.get('/api/auth/status')
        .then(function (res) {
            return res && res.data ? res.data : null;
        })
        .finally(function () {
            statusInFlight = null;
        });

    return statusInFlight;
}

/**
 * 免密试用登录（用户名从后端 status 里取，别写死）
 * @returns {Promise<{ ok: boolean, error?: string, code?: string }>}
 */
export async function loginTrial() {
    var status = await fetchAuthStatus();
    var name = (status && status.trialUsername) || 'trial';
    return loginWithCredentials(name, '', false);
}

/**
 * 账号密码登录。失败**不抛异常**，返回结构化结果 ——
 * 登录失败是预期内的业务分支，让调用方写 try/catch 反而容易漏。
 * @returns {Promise<{ ok: boolean, error?: string, code?: string }>}
 */
export async function loginWithCredentials(username, password, remember) {
    try {
        var res = await api.post('/api/auth/login', {
            username: username,
            password: password,
            remember: !!remember
        });
        if (res.success && res.data && res.data.token) {
            setStoredToken(res.data.token);
        }
        return { ok: true };
    } catch (e) {
        var payload = e.payload || {};
        return {
            ok: false,
            error: payload.error || e.message || '登录失败',
            code: payload.code
        };
    }
}

/**
 * 清掉旧版 Service Worker 留下的接口缓存。
 * 现在 /api 已改为 NetworkOnly，但已经装过的设备里 api-cache 还在，
 * 不删的话换账号、断网时仍会读到上一个人的数据。
 */
export function clearApiCache() {
    if (typeof caches === 'undefined' || !caches.keys) return Promise.resolve(false);
    return caches.keys().then(function (keys) {
        return Promise.all(keys.filter(function (name) {
            return name === 'api-cache' || name.indexOf('api-cache') !== -1;
        }).map(function (name) {
            return caches.delete(name);
        }));
    }).catch(function () {
        return false;
    });
}

/**
 * 登出。
 * 即使后端请求失败也要清本地 token —— 用户的意图是「退出」，
 * 不能因为网络不好就把他留在已登录状态。同时清掉旧的接口缓存。
 */
export async function logout() {
    try {
        await api.post('/api/auth/logout', {});
    } catch (e) { /* 网络失败也要往下走 */ }
    setStoredToken('');
    await clearApiCache();
}

export function hasLocalToken() {
    return !!getStoredToken();
}

/** 改密码（需要登录态） */
export function changePassword(body) {
    return api.post('/api/auth/password', body);
}
