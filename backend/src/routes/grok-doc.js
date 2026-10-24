/**
 * GrokBot 接入文档下载
 *
 * 谁在用：移动端 GrokBot 连接器页（/grok）的「下载接入文档」按钮。
 * 仓库根的 GROK_BOT_CONNECTION.md 是唯一事实来源 —— 接口读文件返回，
 * 不要在别处再复制一份副本，否则文档改了这里就发旧版。
 *
 * API：
 *   GET /api/grok-doc  →  { name, content }
 */
'use strict';

var express = require('express');
var router = express.Router();
var resp = require('../utils/response');
var connectDocs = require('../utils/connect-docs');

router.get('/', resp.asyncHandler(function (req, res) {
    return resp.success(res, connectDocs.readConnectDoc('grok'));
}));

module.exports = router;
