/**
 * 数据目录解析（单一来源）
 *
 * 优先级：APP_DATA_DIR 环境变量 > backend/data
 *
 * 为什么要抽这一层：
 *   1. **测试**：要验证「接口写完盘上是不是密文」，必须把整个后端指向临时目录，
 *      否则每跑一次测试就把真实数据洗一遍。
 *   2. **部署**：数据要放到持久化卷（如 /var/lib/xxx/data）时，改一个环境变量即可，
 *      不用满仓库找 path.join(__dirname, '..', '..', 'data')。
 *
 * 之前 7 个文件各自写死了同一个路径，改一处漏一处；现在统一从这里取。
 */
'use strict';

var fs = require('fs');
var path = require('path');

var DATA_DIR = process.env.APP_DATA_DIR || path.join(__dirname, '..', '..', 'data');
var USERS_DIR = path.join(DATA_DIR, 'users');

function normalizeUsername(username) {
    var s = String(username == null ? '' : username).trim().toLowerCase();
    return s || 'admin';
}

function userDataDir(username) {
    return path.join(USERS_DIR, normalizeUsername(username));
}

function ensureUserDataDir(username) {
    var dir = userDataDir(username);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
    return dir;
}

function userUploadsDir(username) {
    var dir = path.join(ensureUserDataDir(username), 'uploads');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    return dir;
}

module.exports = {
    DATA_DIR: DATA_DIR,
    USERS_DIR: USERS_DIR,
    BACKUP_DIR: path.join(DATA_DIR, 'backups'),
    UPLOADS_DIR: path.join(DATA_DIR, 'uploads'),
    normalizeUsername: normalizeUsername,
    userDataDir: userDataDir,
    ensureUserDataDir: ensureUserDataDir,
    userUploadsDir: userUploadsDir,
    /** 取数据文件的绝对路径，如 file('accounts.json') */
    file: function (name) {
        return path.join(DATA_DIR, name);
    }
};
