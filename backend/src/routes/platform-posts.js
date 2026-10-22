/**
 * 平台发布路由
 *
 * 字段来源：platform.html 总览 + douyin/xianyu/xiaohongshu.html 各平台页
 *
 * API：
 *   GET    /api/platform-posts      - 查询列表（支持 platform/status/category 筛选）
 *   GET    /api/platform-posts/:id  - 查询单条
 *   POST   /api/platform-posts      - 新建
 *   PUT    /api/platform-posts/:id  - 更新
 *   DELETE /api/platform-posts/:id  - 删除
 *   GET    /api/platform-posts/stats/overview - 各平台统计概览
 */
'use strict';

var express = require('express');
var router = express.Router();
var Storage = require('../utils/storage');
var resp = require('../utils/response');
var uploads = require('../utils/uploads');
var pickFields = require('../utils/pick-fields').pickFields;
var warnIgnored = require('../utils/pick-fields').warnIgnored;

var posts = new Storage('platform-posts');

// ========== 灌入种子数据 ==========

router.post('/seed', resp.asyncHandler(function (req, res) {
    var seedData = require('../data/seed-platform-posts');
    posts.clear();
    var records = posts.createMany(seedData);
    return resp.success(res, { count: records.length });
}));

var POST_EDITABLE = [
    'title', 'platform', 'category', 'content', 'images', 'videoUrl', 'videoDuration',
    'publishTime', 'publishType', 'status', 'stats', 'posterId', 'tags'
];

function deleteFileByUrl(url, req) {
    uploads.deleteByUrl(url, req);
}

// 批量删除图片文件
function deleteFilesByUrls(urls, req) {
    if (!Array.isArray(urls)) return;
    urls.forEach(function (url) { deleteFileByUrl(url, req); });
}

// ========== 统计概览 ==========
router.get('/stats/overview', resp.asyncHandler(function (req, res) {
    var all = posts.findAll();
    var platforms = ['xianyu', 'xiaohongshu', 'douyin'];
    var overview = {};

    platforms.forEach(function (pf) {
        var pfPosts = all.filter(function (p) { return p.platform === pf; });
        var published = pfPosts.filter(function (p) { return p.status === 'published'; });
        var draft = pfPosts.filter(function (p) { return p.status === 'draft'; });
        var totalViews = 0;
        var totalLikes = 0;
        var totalRevenue = 0;

        published.forEach(function (p) {
            totalViews += parseInt(p.stats && p.stats.views) || 0;
            totalLikes += parseInt(p.stats && p.stats.likes) || 0;
            totalRevenue += parseFloat(p.stats && p.stats.revenue) || 0;
        });

        overview[pf] = {
            total: pfPosts.length,
            published: published.length,
            draft: draft.length,
            totalViews: totalViews,
            totalLikes: totalLikes,
            totalRevenue: totalRevenue,
            avgViews: published.length > 0 ? Math.round(totalViews / published.length) : 0,
            avgRevenue: published.length > 0 ? Math.round(totalRevenue / published.length) : 0
        };
    });

    overview.all = {
        total: all.length,
        published: all.filter(function (p) { return p.status === 'published'; }).length
    };

    return resp.success(res, overview);
}));

// ========== 查询列表 ==========
router.get('/', resp.asyncHandler(function (req, res) {
    var all = posts.findAll();
    var platform = req.query.platform;
    var status = req.query.status;
    var category = req.query.category;
    var keyword = req.query.keyword;
    var page = parseInt(req.query.page) || 1;
    var pageSize = parseInt(req.query.pageSize) || 50;

    if (platform) {
        all = all.filter(function (p) { return p.platform === platform; });
    }
    if (status) {
        all = all.filter(function (p) { return p.status === status; });
    }
    if (category) {
        all = all.filter(function (p) { return p.category === category; });
    }
    if (keyword) {
        var kw = keyword.toLowerCase();
        all = all.filter(function (p) {
            return (p.title && p.title.toLowerCase().indexOf(kw) !== -1) ||
                   (p.content && p.content.toLowerCase().indexOf(kw) !== -1);
        });
    }

    // 分页
    var start = (page - 1) * pageSize;
    var paged = all.slice(start, start + pageSize);

    return resp.success(res, {
        list: paged,
        total: all.length,
        page: page,
        pageSize: pageSize
    });
}));

// ========== 查询单条 ==========
router.get('/:id', resp.asyncHandler(function (req, res) {
    var record = posts.findById(req.params.id);
    if (!record) return resp.notFound(res, '发布记录不存在');
    return resp.success(res, record);
}));

// ========== 新建 ==========
router.post('/', resp.asyncHandler(function (req, res) {
    var body = req.body || {};

    if (!body.title) return resp.error(res, '内容标题为必填项');
    if (!body.platform) return resp.error(res, '发布平台为必填项');

    var record = posts.create({
        title: body.title,
        platform: body.platform,         // xianyu | xiaohongshu | douyin
        category: body.category || '',
        content: body.content || '',
        images: body.images || [],
        videoUrl: body.videoUrl || '',
        videoDuration: body.videoDuration || '',
        publishTime: body.publishTime || '',
        publishType: body.publishType || 'manual', // manual | scheduled
        status: body.status || 'draft',   // draft | pending | published | offline
        // 数据统计
        stats: body.stats || {
            views: 0,
            likes: 0,
            comments: 0,
            shares: 0,
            inquiries: 0,
            revenue: 0
        },
        // 关联
        posterId: body.posterId || '',
        tags: body.tags || []
    });

    return resp.success(res, record, 201);
}));

// ========== 更新 ==========
router.put('/:id', resp.asyncHandler(function (req, res) {
    var existing = posts.findById(req.params.id);
    if (!existing) return resp.notFound(res, '发布记录不存在');

    var picked = pickFields(req.body, POST_EDITABLE);
    warnIgnored('platform-posts 更新', picked.ignored);

    if (Object.prototype.hasOwnProperty.call(picked.fields, 'title') && !String(picked.fields.title || '').trim()) {
        return resp.error(res, '内容标题为必填项');
    }
    if (Object.prototype.hasOwnProperty.call(picked.fields, 'platform') && !String(picked.fields.platform || '').trim()) {
        return resp.error(res, '发布平台为必填项');
    }

    if (picked.fields.images !== undefined && Array.isArray(existing.images)) {
        var newImages = picked.fields.images || [];
        existing.images.forEach(function (oldUrl) {
            if (newImages.indexOf(oldUrl) === -1) {
                deleteFileByUrl(oldUrl, req);
            }
        });
    }

    var updated = posts.update(req.params.id, picked.fields);
    return resp.success(res, updated);
}));

// ========== 删除 ==========
router.delete('/:id', resp.asyncHandler(function (req, res) {
    var record = posts.findById(req.params.id);
    if (!record) return resp.notFound(res, '发布记录不存在');

    // 删除关联的图片文件
    if (Array.isArray(record.images)) {
        deleteFilesByUrls(record.images, req);
    }

    posts.remove(req.params.id);
    return resp.success(res, { id: req.params.id });
}));

module.exports = router;
