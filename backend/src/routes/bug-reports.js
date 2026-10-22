/**
 * Bug 记录路由
 *
 * API:
 *   GET    /api/bug-reports      - 获取 Bug 记录列表
 *   POST   /api/bug-reports      - 创建 Bug 记录
 *   DELETE /api/bug-reports/:id  - 删除 Bug 记录，并清理关联上传文件
 */
'use strict';

var express = require('express');
var router = express.Router();
var Storage = require('../utils/storage');
var resp = require('../utils/response');
var uploads = require('../utils/uploads');

var reports = new Storage('bug-reports');

function normalizeAttachments(value) {
    if (!Array.isArray(value)) return [];
    return value.map(function (file) {
        return {
            url: file.url || '',
            filename: file.filename || '',
            originalName: file.originalName || file.name || '',
            size: Number(file.size) || 0,
            mimetype: file.mimetype || ''
        };
    }).filter(function (file) {
        return file.url || file.filename || file.originalName;
    }).slice(0, 6);
}

function removeUploadFile(file, req) {
    if (!file) return;
    if (file.url) {
        uploads.deleteByUrl(file.url, req);
        return;
    }
    if (file.filename) uploads.deleteByFilename(file.filename, req);
}

router.get('/', resp.asyncHandler(function (req, res) {
    return resp.success(res, reports.findAll());
}));

router.post('/', resp.asyncHandler(function (req, res) {
    var body = req.body || {};
    var title = String(body.title || '').trim();
    if (!title) {
        return resp.error(res, '请填写 Bug 标题', 400);
    }

    var attachments = normalizeAttachments(body.attachments);
    var foreign = attachments.filter(function (file) {
        return !uploads.attachmentOwnedBy(file, req);
    });
    if (foreign.length) {
        return resp.error(res, '附件不属于当前账号', 400);
    }

    var record = reports.create({
        title: title,
        page: String(body.page || '').trim(),
        severity: String(body.severity || '中').trim(),
        description: String(body.description || '').trim(),
        status: String(body.status || '待处理').trim(),
        attachments: attachments
    });

    return resp.success(res, record, 201);
}));

router.delete('/:id', resp.asyncHandler(function (req, res) {
    var id = req.params.id;
    var record = reports.findById(id);
    if (!record) return resp.notFound(res, 'Bug 记录不存在');

    (record.attachments || []).forEach(function (file) {
        removeUploadFile(file, req);
    });
    var ok = reports.remove(id);
    if (!ok) return resp.notFound(res, 'Bug 记录不存在');
    return resp.success(res, { id: id });
}));

module.exports = router;
