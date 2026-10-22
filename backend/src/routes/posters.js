/**
 * 海报路由
 *
 * 字段来源：poster-form.js collectData()
 *
 * API：
 *   GET    /api/posters             - 查询列表（支持 platform/keyword/label 筛选）
 *   GET    /api/posters/labels      - 获取标签分类列表（上限7个）
 *   GET    /api/posters/:id         - 查询单条
 *   POST   /api/posters             - 新建
 *   PUT    /api/posters/:id         - 更新
 *   DELETE /api/posters/:id         - 删除
 *   POST   /api/posters/batch       - 批量删除
 */
'use strict';

var express = require('express');
var router = express.Router();
var Storage = require('../utils/storage');
var resp = require('../utils/response');
var uploads = require('../utils/uploads');
var pickFields = require('../utils/pick-fields').pickFields;
var warnIgnored = require('../utils/pick-fields').warnIgnored;

var posters = new Storage('posters');

var POSTER_EDITABLE = [
    'title', 'platform', 'labelText', 'labelColor', 'ratio', 'sortOrder',
    'tags', 'onlineDate', 'offlineDate', 'target', 'effect', 'remark',
    'sourceUrl', 'projectRef', 'image', 'imageHtml'
];

function deleteFileByUrl(url) {
    uploads.deleteByUrl(url);
}

// ========== 批量删除 ==========
router.post('/batch', resp.asyncHandler(function (req, res) {
    var ids = req.body.ids || [];
    if (!ids.length) return resp.error(res, '请选择要删除的海报');

    // 清理关联的图片文件
    ids.forEach(function (id) {
        var record = posters.findById(id);
        if (record && record.image) {
            deleteFileByUrl(record.image);
        }
    });

    var removed = posters.removeMany(ids);
    return resp.success(res, { removed: removed });
}));

// ========== 标签分类列表（上限7个，不含"全部海报"） ==========
router.get('/labels', resp.asyncHandler(function (req, res) {
    var all = posters.findAll();
    var platform = req.query.platform;

    if (platform) {
        all = all.filter(function (p) { return p.platform === platform; });
    }

    // 统计每个 labelText 出现次数
    var labelMap = {};
    all.forEach(function (p) {
        var label = p.labelText || '自定义标签';
        if (!labelMap[label]) {
            labelMap[label] = { label: label, count: 0, color: p.labelColor || '#10b981' };
        }
        labelMap[label].count++;
    });

    // 按数量降序排列，取前7个
    var labels = Object.values(labelMap)
        .sort(function (a, b) { return b.count - a.count; })
        .slice(0, 7);

    return resp.success(res, labels);
}));

// ========== 查询列表 ==========
router.get('/', resp.asyncHandler(function (req, res) {
    var all = posters.findAll();
    var platform = req.query.platform;
    var label = req.query.label;
    var keyword = req.query.keyword;

    if (platform) {
        all = all.filter(function (p) { return p.platform === platform; });
    }
    if (label) {
        all = all.filter(function (p) { return (p.labelText || '自定义标签') === label; });
    }
    if (keyword) {
        var kw = keyword.toLowerCase();
        all = all.filter(function (p) {
            return (p.title && p.title.toLowerCase().indexOf(kw) !== -1) ||
                   (p.tags && p.tags.some(function (t) { return t.toLowerCase().indexOf(kw) !== -1; }));
        });
    }

    // 按 sortOrder 降序排列
    all.sort(function (a, b) {
        return (b.sortOrder || 0) - (a.sortOrder || 0);
    });

    return resp.success(res, all);
}));

// ========== 查询单条 ==========
router.get('/:id', resp.asyncHandler(function (req, res) {
    var record = posters.findById(req.params.id);
    if (!record) return resp.notFound(res, '海报不存在');
    return resp.success(res, record);
}));

// ========== 新建 ==========
router.post('/', resp.asyncHandler(function (req, res) {
    var body = req.body || {};

    if (!body.title) return resp.error(res, '海报标题为必填项');
    if (!body.platform) return resp.error(res, '发布平台为必填项');

    var record = posters.create({
        title: body.title,
        platform: body.platform,
        labelText: body.labelText || '自定义标签',
        labelColor: body.labelColor || '#10b981',
        ratio: body.ratio || '3/4',
        sortOrder: parseInt(body.sortOrder) || 0,
        tags: body.tags || [],
        onlineDate: body.onlineDate || '',
        offlineDate: body.offlineDate || '',
        target: body.target || '',
        effect: body.effect || '',
        remark: body.remark || '',
        sourceUrl: body.sourceUrl || '',
        projectRef: body.projectRef || '',
        image: body.image || null,
        imageHtml: body.imageHtml || null
    });

    return resp.success(res, record, 201);
}));

// ========== 更新 ==========
router.put('/:id', resp.asyncHandler(function (req, res) {
    var existing = posters.findById(req.params.id);
    if (!existing) return resp.notFound(res, '海报不存在');

    var picked = pickFields(req.body, POSTER_EDITABLE);
    warnIgnored('posters 更新', picked.ignored);

    if (Object.prototype.hasOwnProperty.call(picked.fields, 'title') && !String(picked.fields.title || '').trim()) {
        return resp.error(res, '海报标题为必填项');
    }
    if (Object.prototype.hasOwnProperty.call(picked.fields, 'platform') && !String(picked.fields.platform || '').trim()) {
        return resp.error(res, '发布平台为必填项');
    }

    if (picked.fields.image !== undefined && existing.image && picked.fields.image !== existing.image) {
        deleteFileByUrl(existing.image);
    }

    var updated = posters.update(req.params.id, picked.fields);
    return resp.success(res, updated);
}));

// ========== 删除 ==========
router.delete('/:id', resp.asyncHandler(function (req, res) {
    var record = posters.findById(req.params.id);
    if (!record) return resp.notFound(res, '海报不存在');

    // 删除关联的图片文件
    if (record.image) {
        deleteFileByUrl(record.image);
    }

    posters.remove(req.params.id);
    return resp.success(res, { id: req.params.id });
}));

module.exports = router;
