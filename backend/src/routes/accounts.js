/**
 * 账号管理路由
 *
 * 字段来源：accounts.html 账号管理页面
 *
 * API：
 *   GET    /api/accounts           - 获取所有账号
 *   POST   /api/accounts           - 创建新账号
 *   PUT    /api/accounts/:id       - 更新账号
 *   DELETE /api/accounts/:id       - 删除账号
 *   GET    /api/accounts/platforms  - 获取平台列表
 */
'use strict';

var express = require('express');
var router = express.Router();
var fs = require('fs');
var path = require('path');
var resp = require('../utils/response');
var secretBox = require('../utils/secret-box');
var dataPaths = require('../utils/data-paths');

var DATA_DIR = dataPaths.DATA_DIR;
var ACCOUNTS_FILE = dataPaths.file('accounts.json');

// 默认平台列表
var DEFAULT_PLATFORMS = [
    { id: 'github', name: 'GitHub', color: 'github' },
    { id: 'gitee', name: 'Gitee', color: 'gitee' },
    { id: 'coding', name: 'Coding', color: 'coding' },
    { id: 'leetcode', name: 'LeetCode', color: 'leetcode' },
    { id: 'juejin', name: '掘金', color: 'juejin' },
    { id: 'csdn', name: 'CSDN', color: 'csdn' },
    { id: 'zhihu', name: '知乎', color: 'zhihu' },
    { id: 'other', name: '其他', color: 'other' }
];

// 确保数据文件存在
function ensureDataFile() {
    if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (!fs.existsSync(ACCOUNTS_FILE)) {
        fs.writeFileSync(ACCOUNTS_FILE, JSON.stringify([], null, 2), 'utf-8');
    }
}

// 读取账号数据
//
// 密码在磁盘上是密文（AES-256-GCM，见 utils/secret-box.js），
// 内存里始终是明文 —— 上层路由、返回给前端的字段完全不用改，
// 加密/解密只集中在这两个函数里。
// 兼容老数据：没有 enc: 前缀的明文会被原样读出来，下次保存时自动变成密文。
function readAccounts() {
    ensureDataFile();
    var list;
    try {
        list = JSON.parse(fs.readFileSync(ACCOUNTS_FILE, 'utf-8'));
    } catch (e) {
        return [];
    }
    if (!Array.isArray(list)) return [];

    return list.map(function (a) {
        if (!a || typeof a !== 'object') return a;
        var copy = Object.assign({}, a);
        if (typeof copy.password === 'string') {
            copy.password = secretBox.decryptField(copy.password);
        }
        return copy;
    });
}

// 保存账号数据（写盘前加密；临时文件 + rename 原子写，防写一半断电损坏）
function saveAccounts(accounts) {
    ensureDataFile();

    var toWrite = (accounts || []).map(function (a) {
        if (!a || typeof a !== 'object') return a;
        var copy = Object.assign({}, a);
        if (typeof copy.password === 'string') {
            copy.password = secretBox.encrypt(copy.password);
        }
        return copy;
    });

    var tmp = ACCOUNTS_FILE + '.' + process.pid + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(toWrite, null, 2), 'utf-8');
    fs.renameSync(tmp, ACCOUNTS_FILE);
}

// ========== 获取所有账号 ==========
router.get('/', resp.asyncHandler(function (req, res) {
    var accounts = readAccounts();
    var platform = req.query.platform;
    var keyword = req.query.keyword;

    // 平台筛选
    if (platform && platform !== 'all') {
        accounts = accounts.filter(function (a) { return a.platform === platform; });
    }

    // 关键词搜索
    if (keyword) {
        var lowerKeyword = keyword.toLowerCase();
        accounts = accounts.filter(function (a) {
            return (a.accountName && a.accountName.toLowerCase().includes(lowerKeyword)) ||
                   (a.email && a.email.toLowerCase().includes(lowerKeyword)) ||
                   (a.remark && a.remark.toLowerCase().includes(lowerKeyword));
        });
    }

    return resp.success(res, accounts);
}));

// ========== 获取平台列表 ==========
router.get('/platforms', resp.asyncHandler(function (req, res) {
    return resp.success(res, DEFAULT_PLATFORMS);
}));

// ========== 创建新账号 ==========
router.post('/', resp.asyncHandler(function (req, res) {
    var data = req.body;

    if (!data.platform || !data.accountName) {
        return resp.error(res, '平台类型和账号名称不能为空', 400);
    }

    var accounts = readAccounts();

    var newAccount = {
        id: Date.now().toString(),
        platform: data.platform,
        accountName: data.accountName,
        email: data.email || '',
        password: data.password || '',
        remark: data.remark || '',
        icon: data.icon || null,
        useTextIcon: data.useTextIcon || false,
        customPlatform: data.customPlatform || null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };

    accounts.push(newAccount);
    saveAccounts(accounts);

    return resp.success(res, newAccount);
}));

// ========== 更新账号 ==========
router.put('/:id', resp.asyncHandler(function (req, res) {
    var id = req.params.id;
    var data = req.body;
    var accounts = readAccounts();

    var index = accounts.findIndex(function (a) { return a.id === id; });
    if (index === -1) {
        return resp.error(res, '账号不存在', 404);
    }

    accounts[index] = {
        ...accounts[index],
        platform: data.platform || accounts[index].platform,
        accountName: data.accountName || accounts[index].accountName,
        email: data.email !== undefined ? data.email : accounts[index].email,
        password: data.password !== undefined ? data.password : accounts[index].password,
        remark: data.remark !== undefined ? data.remark : accounts[index].remark,
        icon: data.icon !== undefined ? data.icon : accounts[index].icon,
        useTextIcon: data.useTextIcon !== undefined ? data.useTextIcon : accounts[index].useTextIcon,
        customPlatform: data.customPlatform !== undefined ? data.customPlatform : accounts[index].customPlatform,
        updatedAt: new Date().toISOString()
    };

    saveAccounts(accounts);
    return resp.success(res, accounts[index]);
}));

// ========== 删除账号 ==========
router.delete('/:id', resp.asyncHandler(function (req, res) {
    var id = req.params.id;
    var accounts = readAccounts();

    var index = accounts.findIndex(function (a) { return a.id === id; });
    if (index === -1) {
        return resp.error(res, '账号不存在', 404);
    }

    accounts.splice(index, 1);
    saveAccounts(accounts);

    return resp.success(res, null);
}));

module.exports = router;
