'use strict';

/**
 * 当前请求对应的业务数据用户。
 *
 * 用 AsyncLocalStorage，而不是进程里的一个变量：
 * 请求 A 在 await 之后继续执行时，仍然看到进入 A 时的用户，
 * 不会被请求 B 的 enter / 响应结束时的清空改掉。
 *
 * apiGuard 用 run() 包住后续处理。
 * enter / leave 留给同步脚本和测试：leave 只影响当前这段执行，
 * 已经创建的异步延续仍保留 enter 时的用户。
 */

var asyncHooks = require('async_hooks');
var als = new asyncHooks.AsyncLocalStorage();

function normalize(username) {
    if (username == null) return null;
    var value = String(username).trim().toLowerCase();
    return value || null;
}

function current() {
    var value = als.getStore();
    return value == null ? null : value;
}

module.exports = {
    run: function (username, fn) {
        return als.run(normalize(username), fn);
    },
    enter: function (username) {
        als.enterWith(normalize(username));
    },
    leave: function () {
        als.enterWith(null);
    },
    get: function () {
        return current();
    }
};
