/**
 * 认证路由 /api/auth/*
 *
 * 注意：本路由必须在 apiGuard 之前挂载，否则登录接口自己会被拦。
 */
'use strict';

var express = require('express');
var router = express.Router();
var auth = require('../utils/auth');

// ========== 简易登录限流（防暴力破解，进程内存即可） ==========

var MAX_FAILS = 5;
var LOCK_MS = 5 * 60 * 1000;
var failRecords = {};   // ip -> { count, firstAt, lockedUntil }

function getRecord(req) {
    var ip = req.ip || (req.connection && req.connection.remoteAddress) || 'unknown';
    var rec = failRecords[ip];
    if (!rec) {
        rec = { count: 0, firstAt: Date.now(), lockedUntil: 0 };
        failRecords[ip] = rec;
    }
    return rec;
}

function checkLocked(req) {
    var rec = getRecord(req);
    if (rec.lockedUntil && Date.now() < rec.lockedUntil) {
        return Math.ceil((rec.lockedUntil - Date.now()) / 1000);
    }
    return 0;
}

function recordFail(req) {
    var rec = getRecord(req);
    // 超过统计窗口则重置
    if (Date.now() - rec.firstAt > LOCK_MS) {
        rec.count = 0;
        rec.firstAt = Date.now();
        rec.lockedUntil = 0;
    }
    rec.count++;
    if (rec.count >= MAX_FAILS) {
        rec.lockedUntil = Date.now() + LOCK_MS;
    }
}

function clearFail(req) {
    var ip = req.ip || (req.connection && req.connection.remoteAddress) || 'unknown';
    delete failRecords[ip];
}

// ========== 登录状态 ==========

router.get('/status', function (req, res) {
    var local = auth.isLoopback(req);
    res.json({
        success: true,
        data: {
            enabled: auth.enabled,
            authenticated: auth.isAuthenticated(req),
            trustedLocal: auth.trustLocalhost && local,
            authRequired: auth.enabled && !(auth.trustLocalhost && local)
        }
    });
});

// ========== 登录 ==========

router.post('/login', function (req, res) {
    if (!auth.enabled) {
        return res.json({ success: true, data: { message: '认证已关闭' } });
    }

    var lockedFor = checkLocked(req);
    if (lockedFor > 0) {
        return res.status(429).json({
            success: false,
            error: '尝试次数过多，请 ' + Math.ceil(lockedFor / 60) + ' 分钟后再试',
            code: 'LOCKED'
        });
    }

    var password = req.body && req.body.password;
    if (!password) {
        return res.status(400).json({ success: false, error: '请输入密码' });
    }

    if (!auth.verifyPassword(password)) {
        recordFail(req);
        var rec = getRecord(req);
        var left = MAX_FAILS - rec.count;
        return res.status(401).json({
            success: false,
            error: left > 0 ? '密码错误（还可尝试 ' + left + ' 次）' : '密码错误次数过多，已临时锁定',
            code: 'BAD_PASSWORD'
        });
    }

    clearFail(req);

    // remember=true 记 30 天，否则仅会话级（这里仍给 12 小时，避免频繁登录）
    var remember = !!(req.body && req.body.remember);
    var ttl = remember ? auth.DEFAULT_TTL_MS : 12 * 60 * 60 * 1000;
    var token = auth.setCookie(res, req, ttl);

    res.json({
        success: true,
        data: {
            // 同时返回 token，便于非浏览器客户端用 Authorization: Bearer
            token: token,
            expiresIn: ttl
        }
    });
});

// ========== 登出 ==========

router.post('/logout', function (req, res) {
    auth.clearCookie(res);
    res.json({ success: true, data: { message: '已退出登录' } });
});

// ========== 修改密码 ==========

router.post('/password', function (req, res) {
    if (!auth.enabled) {
        return res.status(400).json({ success: false, error: '认证未启用' });
    }
    // 改密码必须已登录（即使是本机也要求提供旧密码）
    if (!auth.isAuthenticated(req)) {
        return res.status(401).json({ success: false, error: '未登录', code: 'UNAUTHORIZED' });
    }

    var oldPassword = req.body && req.body.oldPassword;
    var newPassword = req.body && req.body.newPassword;

    if (!oldPassword || !newPassword) {
        return res.status(400).json({ success: false, error: '请提供旧密码与新密码' });
    }
    if (String(newPassword).length < 6) {
        return res.status(400).json({ success: false, error: '新密码至少 6 位' });
    }
    if (!auth.changePassword(oldPassword, newPassword)) {
        return res.status(400).json({ success: false, error: '旧密码不正确' });
    }

    // 密码已变更，旧 token 全部失效，重新签发一个给当前客户端
    auth.setCookie(res, req, auth.DEFAULT_TTL_MS);
    res.json({ success: true, data: { message: '密码已更新，其他设备需重新登录' } });
});

module.exports = router;
