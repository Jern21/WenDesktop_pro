/**
 * 网址收藏路由
 *
 * 字段来源：bookmarks.html 网址收藏页面
 *
 * API：
 *   GET    /api/bookmarks           - 获取所有收藏
 *   POST   /api/bookmarks           - 创建新收藏
 *   PUT    /api/bookmarks/:id       - 更新收藏
 *   DELETE /api/bookmarks/:id       - 删除收藏
 *   GET    /api/bookmarks/categories - 获取分类列表
 */
'use strict';

var express = require('express');
var router = express.Router();
var resp = require('../utils/response');
var dataBackups = require('../utils/data-backups');
var JsonFileStore = require('../utils/json-file-store');

var bookmarkStore = new JsonFileStore('bookmarks', { shape: 'array' });

// 默认分类列表
var DEFAULT_CATEGORIES = [
    { id: 'docs', name: '技术文档', color: 'docs' },
    { id: 'tools', name: '开发工具', color: 'tools' },
    { id: 'learning', name: '学习资源', color: 'learning' },
    { id: 'design', name: '设计资源', color: 'design' },
    { id: 'community', name: '技术社区', color: 'community' },
    { id: 'other', name: '其他', color: 'other' }
];

function readBookmarks(scope) {
    return bookmarkStore.read(scope || dataBackups.captureScope());
}

function saveBookmarks(bookmarks, scope) {
    bookmarkStore.write(bookmarks, scope || dataBackups.captureScope());
}

// ========== 获取所有收藏 ==========
router.get('/', resp.asyncHandler(function (req, res) {
    var bookmarks = readBookmarks();
    var category = req.query.category;
    var keyword = req.query.keyword;

    // 分类筛选
    if (category && category !== 'all') {
        bookmarks = bookmarks.filter(function (b) { return b.category === category; });
    }

    // 关键词搜索
    if (keyword) {
        var lowerKeyword = keyword.toLowerCase();
        bookmarks = bookmarks.filter(function (b) {
            return (b.title && b.title.toLowerCase().includes(lowerKeyword)) ||
                   (b.url && b.url.toLowerCase().includes(lowerKeyword)) ||
                   (b.description && b.description.toLowerCase().includes(lowerKeyword));
        });
    }

    // 按点击次数排序
    bookmarks.sort(function (a, b) { return b.clickCount - a.clickCount; });

    return resp.success(res, bookmarks);
}));

// ========== 获取分类列表 ==========
router.get('/categories', resp.asyncHandler(function (req, res) {
    return resp.success(res, DEFAULT_CATEGORIES);
}));

// ========== 创建新收藏 ==========
router.post('/', resp.asyncHandler(function (req, res) {
    var data = req.body;

    if (!data.title || !data.url) {
        return resp.error(res, '标题和网址不能为空', 400);
    }

    var scope = dataBackups.captureScope();
    var bookmarks = readBookmarks(scope);

    var newBookmark = {
        id: Date.now().toString(),
        title: data.title,
        url: data.url,
        category: data.category || 'other',
        description: data.description || '',
        favicon: data.favicon || '',
        customIcon: data.customIcon || null,
        useTextIcon: data.useTextIcon || false,
        clickCount: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };

    bookmarks.push(newBookmark);
    saveBookmarks(bookmarks, scope);

    return resp.success(res, newBookmark);
}));

// ========== 更新收藏 ==========
router.put('/:id', resp.asyncHandler(function (req, res) {
    var id = req.params.id;
    var data = req.body;
    var scope = dataBackups.captureScope();
    var bookmarks = readBookmarks(scope);

    var index = bookmarks.findIndex(function (b) { return b.id === id; });
    if (index === -1) {
        return resp.error(res, '收藏不存在', 404);
    }

    bookmarks[index] = {
        ...bookmarks[index],
        title: data.title || bookmarks[index].title,
        url: data.url || bookmarks[index].url,
        category: data.category || bookmarks[index].category,
        description: data.description !== undefined ? data.description : bookmarks[index].description,
        favicon: data.favicon !== undefined ? data.favicon : bookmarks[index].favicon,
        customIcon: data.customIcon !== undefined ? data.customIcon : bookmarks[index].customIcon,
        useTextIcon: data.useTextIcon !== undefined ? data.useTextIcon : bookmarks[index].useTextIcon,
        updatedAt: new Date().toISOString()
    };

    saveBookmarks(bookmarks, scope);
    return resp.success(res, bookmarks[index]);
}));

// ========== 删除收藏 ==========
router.delete('/:id', resp.asyncHandler(function (req, res) {
    var id = req.params.id;
    var scope = dataBackups.captureScope();
    var bookmarks = readBookmarks(scope);

    var index = bookmarks.findIndex(function (b) { return b.id === id; });
    if (index === -1) {
        return resp.error(res, '收藏不存在', 404);
    }

    bookmarks.splice(index, 1);
    saveBookmarks(bookmarks, scope);

    return resp.success(res, null);
}));

// ========== 增加点击次数 ==========
router.post('/:id/click', resp.asyncHandler(function (req, res) {
    var id = req.params.id;
    var scope = dataBackups.captureScope();
    var bookmarks = readBookmarks(scope);

    var index = bookmarks.findIndex(function (b) { return b.id === id; });
    if (index === -1) {
        return resp.error(res, '收藏不存在', 404);
    }

    bookmarks[index].clickCount = (bookmarks[index].clickCount || 0) + 1;
    bookmarks[index].updatedAt = new Date().toISOString();

    saveBookmarks(bookmarks, scope);
    return resp.success(res, bookmarks[index]);
}));

module.exports = router;
