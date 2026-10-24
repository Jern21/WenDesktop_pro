/**
 * 路由内核 —— 只管 History 与订阅，**不做路径到页面的映射**
 *
 * 映射在 config/routes.js（matchRoute），这里只负责：
 *   navigate / getPath / subscribe / goBack / startRouter
 *
 * 为什么中间要留一层索引（history.state.__mobIndex）：
 *   详情页的返回按钮不能无脑用 history.back()。
 *   用户从微信直接打开 /orders/123 时，history 里没有上一条本站记录，
 *   history.back() 会把人**退出站点**（PWA 里是直接关闭），很难受。
 *   所以自己数一层深度：深度 > 0 才回退，否则退回父级路径（replace，不留空档）。
 *
 *   之前想过用 history.length，但它把「打开新标签前的整段会话」也算进去，
 *   在 PWA 里恒为非零，等于永远走 history.back()，fallback 永远不生效。
 */
import { normalizePath } from './lib/path.js';

var listeners = [];

var STATE_KEY = '__mobIndex';

/* ---------- hash 路由 ----------
 * URL 形态：/#/orders/123?x=1 —— 真实 pathname 恒为 '/'，
 * 站内路径和查询都塞在 # 后面。
 * 为什么不用裸路径：iOS standalone/webclip 只认启动 URL，
 * pathname 一变（哪怕是同源 pushState）就弹出地址栏 + 底部工具栏；
 * 只有 hash 变化时 iOS 认为「还在同一页」，边框不会出来。
 * 外部深链 /orders/123 在 startRouter() 里归并进 hash。 */
function hashRoute() {
    var h = location.hash || '';
    if (h.charAt(0) === '#') h = h.slice(1);
    // 非站内锚点（如 #section）不当路由，按 '/' 处理
    return h.charAt(0) === '/' ? h : '';
}

/** hash 里的 ?query 部分（含 ?），没有返回 '' */
function hashQuery() {
    var h = hashRoute();
    var i = h.indexOf('?');
    return i === -1 ? '' : h.slice(i);
}

function currentIndex() {
    var st = history.state;
    return st && typeof st[STATE_KEY] === 'number' ? st[STATE_KEY] : 0;
}

export function getPath() {
    var h = hashRoute();
    var p = h ? h.split('?')[0] : '/';
    return normalizePath(p);
}

export function safeNextFromQuery() {
    var raw = new URLSearchParams(hashQuery()).get('next') || '/';
    if (raw.charAt(0) !== '/' || raw.charAt(1) === '/' || raw.indexOf('\\') !== -1) {
        return '/';
    }
    return normalizePath(raw);
}

export function navigate(path, options) {
    var opts = options || {};
    var raw = String(path || '/');
    var qIndex = raw.indexOf('?');
    var pathname = qIndex === -1 ? raw : raw.slice(0, qIndex);
    var search = qIndex === -1 ? '' : raw.slice(qIndex);
    var targetPath = normalizePath(pathname);
    var url = '/#' + targetPath + search;

    if (getPath() === targetPath && hashQuery() === search) {
        notify();
        return;
    }
    if (opts.replace) {
        history.replaceState({ [STATE_KEY]: currentIndex() }, '', url);
    } else {
        history.pushState({ [STATE_KEY]: currentIndex() + 1 }, '', url);
    }
    notify();
}

/**
 * 返回上一页；没有上一页时退到 fallbackPath。
 *
 * @param {String} fallbackPath 直接打开详情页（深度为 0）时的去处，一般是路由的 parent
 * @returns {Boolean} true = 走了浏览器返回，false = 走了 fallback 跳转
 */
export function goBack(fallbackPath) {
    if (currentIndex() > 0) {
        history.back();
        return true;
    }
    navigate(fallbackPath || '/', { replace: true });
    return false;
}

export function subscribe(fn) {
    listeners.push(fn);
    return function () {
        var i = listeners.indexOf(fn);
        if (i !== -1) listeners.splice(i, 1);
    };
}

function notify() {
    listeners.forEach(function (fn) {
        try { fn(getPath()); } catch (e) { console.error(e); }
    });
}

export function startRouter() {
    // 外部深链 /orders/123 → 归并成 /#/orders/123（真实 pathname 统一 '/'）
    // 已有 hash 的不动；/index.html、空 path 也跳过。
    if (location.pathname && location.pathname !== '/' && location.pathname !== '/index.html') {
        var url = '/#' + normalizePath(location.pathname) + (location.search || '');
        history.replaceState({ [STATE_KEY]: 0 }, '', url);
    }
    window.addEventListener('popstate', function () { notify(); });
}
