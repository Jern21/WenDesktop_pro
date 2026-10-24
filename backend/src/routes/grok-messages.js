/**
 * GrokBot 对话消息 —— Grok 与「GrokBot 连接器」页面对话窗口之间的通道
 *
 * API：
 *   GET  /api/grok-messages          → 当前用户的消息流（数组，时间序）
 *   POST /api/grok-messages          → 追加一条 { id, role, text, at }
 *        body: { text: string(必填), role: 'bot'|'user'(默认 'bot'),
 *                username?: 声明身份，必须与凭证归属一致 }
 *
 * 鉴权：挂在 apiGuard 之后 —— 页面走会话 Cookie，Grok 走
 * `Authorization: Bearer gck_...`（GrokCtrl-Key），两侧写同一条消息流。
 * Grok 发消息时带 username 做交叉校验，防止 key 用错账号。
 */
'use strict';

var express = require('express');
var router = express.Router();
var resp = require('../utils/response');
var grokMessages = require('../utils/grok-messages');

var VALID_ROLES = ['bot', 'user'];

router.get('/', resp.asyncHandler(function (req, res) {
    return resp.success(res, grokMessages.list());
}));

router.post('/', resp.asyncHandler(function (req, res) {
    var body = req.body || {};
    var text = typeof body.text === 'string' ? body.text.trim() : '';
    if (!text) {
        return resp.error(res, 'text 必填', 400);
    }
    if (text.length > 4000) {
        return resp.error(res, 'text 超过 4000 字', 400);
    }
    var role = body.role || 'bot';
    if (VALID_ROLES.indexOf(role) === -1) {
        return resp.error(res, 'role 只能是 bot 或 user', 400);
    }
    // Grok 声明 username 时做交叉校验：key 归属与声明必须一致
    if (body.username != null
        && String(body.username).trim().toLowerCase() !== req.wtSession.username) {
        return resp.error(res, 'username 与凭证归属不一致', 403);
    }
    var msg = grokMessages.append(role, text);
    return resp.success(res, msg, 201);
}));

router.delete('/', resp.asyncHandler(function (req, res) {
    grokMessages.clear();
    return resp.success(res, { cleared: true });
}));

module.exports = router;
