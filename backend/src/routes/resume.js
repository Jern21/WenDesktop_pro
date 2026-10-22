/**
 * 简历路由
 *
 * 字段来源：resume.html 前端页面（岗位制简历管理 + PDF 上传）
 *
 * 数据模型：
 *   - 每条记录 = 一个岗位的简历版本
 *   - 包含岗位名称、公司、PDF 文件路径等
 *
 * API：
 *   GET    /api/resume              - 查询简历列表
 *   GET    /api/resume/:id          - 查询单条
 *   POST   /api/resume              - 新建简历（含 PDF URL）
 *   PUT    /api/resume/:id          - 更新简历
 *   PUT    /api/resume/:id/activate - 设为当前激活简历
 *   DELETE /api/resume/:id          - 删除简历
 *   POST   /api/resume/:id/pdf      - 上传/替换 PDF（multipart form-data）
 */
'use strict';

var express = require('express');
var router = express.Router();
var multer = require('multer');
var path = require('path');
var Storage = require('../utils/storage');
var resp = require('../utils/response');
var uploads = require('../utils/uploads');
var pickFields = require('../utils/pick-fields').pickFields;
var warnIgnored = require('../utils/pick-fields').warnIgnored;

var resumes = new Storage('resume');

var RESUME_EDITABLE = [
    'title', 'company', 'pdfUrl', 'pdfName', 'pageCount',
    'name', 'phone', 'email', 'location', 'github', 'summary',
    'skills', 'projects', 'workExperience', 'education',
    'versionLabel', 'active'
];

// ========== PDF 上传配置 ==========

var pdfStorage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploads.dirForRequest(req));
    },
    filename: function (req, file, cb) {
        var ext = path.extname(file.originalname).toLowerCase() || '.pdf';
        var name = 'resume-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8) + ext;
        cb(null, name);
    }
});

var pdfUpload = multer({
    storage: pdfStorage,
    limits: { fileSize: 20 * 1024 * 1024 }, // 20MB
    fileFilter: function (req, file, cb) {
        var ext = path.extname(file.originalname).toLowerCase();
        if (ext === '.pdf') {
            cb(null, true);
        } else {
            cb(new Error('仅支持 PDF 格式'));
        }
    }
});

// ========== 查询列表 ==========

router.get('/', resp.asyncHandler(function (req, res) {
    var all = resumes.findAll();
    var keyword = req.query.keyword;

    if (keyword) {
        var kw = keyword.toLowerCase();
        all = all.filter(function (r) {
            return (r.title && r.title.toLowerCase().indexOf(kw) !== -1) ||
                   (r.company && r.company.toLowerCase().indexOf(kw) !== -1);
        });
    }

    // 激活的排在最前面，然后按创建时间降序
    all.sort(function (a, b) {
        if (a.active && !b.active) return -1;
        if (!a.active && b.active) return 1;
        return new Date(b.createdAt) - new Date(a.createdAt);
    });

    return resp.success(res, all);
}));

// ========== 查询单条 ==========

router.get('/:id', resp.asyncHandler(function (req, res) {
    var record = resumes.findById(req.params.id);
    if (!record) return resp.notFound(res, '简历不存在');
    return resp.success(res, record);
}));

// ========== 上传 PDF（独立端点，先上传再关联） ==========

router.post('/upload-pdf', function (req, res, next) {
    pdfUpload.single('file')(req, res, function (err) {
        if (err) {
            var msg = err.code === 'LIMIT_FILE_SIZE' ? 'PDF 大小超过 20MB 限制' : (err.message || '上传失败');
            return resp.error(res, msg, 400);
        }
        if (!req.file) {
            return resp.error(res, '请选择 PDF 文件');
        }
        return resp.success(res, {
            url: uploads.publicUrl(req.file.filename, req),
            filename: req.file.filename,
            originalName: req.file.originalname,
            size: req.file.size
        }, 201);
    });
});

// ========== 新建 ==========

router.post('/', resp.asyncHandler(function (req, res) {
    var body = req.body || {};

    if (!body.title) return resp.error(res, '岗位名称为必填项');

    var record = resumes.create({
        title: body.title,
        company: body.company || '',
        // PDF 关联
        pdfUrl: body.pdfUrl || '',
        pdfName: body.pdfName || '',
        pageCount: parseInt(body.pageCount) || 0,
        // 结构化简历信息（可选，兼容旧模型）
        name: body.name || '',
        phone: body.phone || '',
        email: body.email || '',
        location: body.location || '',
        github: body.github || '',
        summary: body.summary || '',
        skills: body.skills || [],
        projects: body.projects || [],
        workExperience: body.workExperience || [],
        education: body.education || {},
        // 版本管理
        versionLabel: body.versionLabel || '',
        active: body.active || false
    });

    // 如果设为激活，取消其他简历的激活
    if (record.active) {
        _deactivateOthers(record.id);
    }

    return resp.success(res, record, 201);
}));

// ========== 更新 ==========

router.put('/:id', resp.asyncHandler(function (req, res) {
    var existing = resumes.findById(req.params.id);
    if (!existing) return resp.notFound(res, '简历不存在');

    var picked = pickFields(req.body, RESUME_EDITABLE);
    warnIgnored('resume 更新', picked.ignored);
    if (Object.prototype.hasOwnProperty.call(picked.fields, 'title') && !String(picked.fields.title || '').trim()) {
        return resp.error(res, '岗位名称为必填项');
    }

    var updated = resumes.update(req.params.id, picked.fields);
    if (!updated) return resp.notFound(res, '简历不存在');

    if (picked.fields.active) {
        _deactivateOthers(req.params.id);
    }

    return resp.success(res, updated);
}));

// ========== 为已有简历上传/替换 PDF ==========

router.post('/:id/pdf', function (req, res, next) {
    pdfUpload.single('file')(req, res, function (err) {
        if (err) {
            return resp.error(res, err.message || '上传失败', 400);
        }
        if (!req.file) {
            return resp.error(res, '请选择 PDF 文件');
        }

        var record = resumes.findById(req.params.id);
        if (!record) return resp.notFound(res, '简历不存在');

        if (record.pdfUrl) uploads.deleteByUrl(record.pdfUrl);

        var updated = resumes.update(req.params.id, {
            pdfUrl: uploads.publicUrl(req.file.filename, req),
            pdfName: req.file.originalname,
            pageCount: parseInt(req.body.pageCount) || 0
        });

        return resp.success(res, updated);
    });
});

// ========== 设为当前激活简历 ==========

router.put('/:id/activate', resp.asyncHandler(function (req, res) {
    var record = resumes.findById(req.params.id);
    if (!record) return resp.notFound(res, '简历不存在');

    _deactivateOthers(req.params.id);
    var updated = resumes.update(req.params.id, { active: true });
    return resp.success(res, updated);
}));

// ========== 删除 ==========

router.delete('/:id', resp.asyncHandler(function (req, res) {
    var record = resumes.findById(req.params.id);
    if (!record) return resp.notFound(res, '简历不存在');

    if (record.pdfUrl) uploads.deleteByUrl(record.pdfUrl);

    resumes.remove(req.params.id);
    return resp.success(res, { id: req.params.id });
}));

// ========== 私有：取消其他简历的激活状态 ==========

function _deactivateOthers(activeId) {
    var all = resumes.findAll();
    all.forEach(function (r) {
        if (r.id !== activeId && r.active) {
            resumes.update(r.id, { active: false });
        }
    });
}

module.exports = router;
