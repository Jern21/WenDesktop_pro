'use strict';

/**
 * 当前请求对应的业务数据用户（由 apiGuard 在鉴权后注入）
 */
var currentUsername = null;

module.exports = {
    enter: function (username) {
        currentUsername = username ? String(username).trim().toLowerCase() : null;
    },
    leave: function () {
        currentUsername = null;
    },
    get: function () {
        return currentUsername;
    }
};
