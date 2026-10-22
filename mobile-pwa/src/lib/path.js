/**
 * 路径工具 —— 全项目**唯一**的路径归一化实现
 *
 * 为什么要单独一层：
 *   router.js（浏览器 History）和 config/routes.js（路由匹配）都需要「把路径弄干净」，
 *   但两边关心的脏东西不一样：History 只面对 location.pathname，路由匹配还要处理
 *   带 ?query 的字符串和过时的 /home 别名。
 *   各自写一份的后果不是立刻报错，而是**慢慢分叉** ——
 *   某天有人给 router 加了去尾斜杠却没同步给 routes，于是 /orders/ 匹配不上 /orders，
 *   表现是「从微信分享进来的链接打不开」，很难查。
 *
 * 所以：底层归一化只在这里，上层各自在它之上补自己的规则。
 */

/**
 * 去 hash、去尾斜杠、空值兜底。
 * 注意**不处理** query —— location.pathname 本来就不含 query，
 * 而调用方如果传入带 query 的字符串，应该自己先切开（它知道 query 有没有语义）。
 */
export function normalizePath(pathname) {
    if (!pathname) return '/';
    var p = String(pathname).split('#')[0];
    if (p.length > 1 && p.charAt(p.length - 1) === '/') p = p.slice(0, -1);
    return p || '/';
}

/** 切成非空片段：'/orders/123' → ['orders','123']，'/' → [] */
export function pathSegments(p) {
    var raw = String(p || '').split('/');
    var out = [];
    for (var i = 0; i < raw.length; i++) {
        if (raw[i] !== '') out.push(raw[i]);
    }
    return out;
}

/** decodeURIComponent 遇到坏编码会抛，路径解析不该因为这个整页挂掉 */
export function safeDecode(value) {
    try {
        return decodeURIComponent(value);
    } catch (e) {
        return value;
    }
}
