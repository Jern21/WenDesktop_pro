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

function currentIndex() {
    var st = history.state;
    return st && typeof st[STATE_KEY] === 'number' ? st[STATE_KEY] : 0;
}

export function getPath() {
    return normalizePath(location.pathname);
}

export function safeNextFromQuery() {
    var raw = new URLSearchParams(location.search).get('next') || '/';
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
    var url = targetPath + search;

    if (getPath() === targetPath && location.search === search) {
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
    window.addEventListener('popstate', function () { notify(); });
}
