/**
 * GrokCtrl-Key 管理
 *
 * 给外部 Agent（GrokBot）用的长寿命凭证，签发后它用
 * `Authorization: Bearer gck_...` 直接调 /api/*，不再需要账号密码。
 * 作用域跟随当前登录用户；只能吊销自己名下的 key。
 *
 * API：
 *   GET    /api/grok-keys      → 我的 key 列表（只有 id/时间，不含明文）
 *   POST   /api/grok-keys      → 新建，明文 key 只返回这一次
 *   DELETE /api/grok-keys/:id  → 吊销
 */
'use strict';

var express = require('express');
var router = express.Router();
var resp = require('../utils/response');
var auth = require('../utils/auth');

router.get('/', resp.asyncHandler(function (req, res) {
    return resp.success(res, auth.listGrokKeys(req.wtSession.username));
}));

router.post('/', resp.asyncHandler(function (req, res) {
    var created = auth.issueGrokKey(req.wtSession.username);
    if (!created) return resp.error(res, '创建失败', 500);
    return resp.success(res, created, 201);
}));

router.delete('/:id', resp.asyncHandler(function (req, res) {
    if (!auth.revokeGrokKey(req.params.id, req.wtSession.username)) {
        return resp.error(res, 'Key 不存在或不属于你', 404);
    }
    return resp.success(res, { revoked: req.params.id });
}));

module.exports = router;
