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
var resp = require('../utils/response');
var dataBackups = require('../utils/data-backups');
var accountsRepository = require('../utils/accounts-repository');

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

function readAccounts(scope) {
    return accountsRepository.read(scope || dataBackups.captureScope());
}

function saveAccounts(accounts, scope) {
    return accountsRepository.save(accounts, scope || dataBackups.captureScope());
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

    var scope = dataBackups.captureScope();
    var accounts = readAccounts(scope);

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
    saveAccounts(accounts, scope);

    return resp.success(res, newAccount);
}));

// ========== 更新账号 ==========
router.put('/:id', resp.asyncHandler(function (req, res) {
    var id = req.params.id;
    var data = req.body;
    var scope = dataBackups.captureScope();
    var accounts = readAccounts(scope);

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

    saveAccounts(accounts, scope);
    return resp.success(res, accounts[index]);
}));

// ========== 删除账号 ==========
router.delete('/:id', resp.asyncHandler(function (req, res) {
    var id = req.params.id;
    var scope = dataBackups.captureScope();
    var accounts = readAccounts(scope);

    var index = accounts.findIndex(function (a) { return a.id === id; });
    if (index === -1) {
        return resp.error(res, '账号不存在', 404);
    }

    accounts.splice(index, 1);
    saveAccounts(accounts, scope);

    return resp.success(res, null);
}));

module.exports = router;
