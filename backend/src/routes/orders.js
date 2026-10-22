/**
 * 订单路由
 *
 * 字段来源：order-form.js collectData()
 *
 * API：
 *   GET    /api/orders              - 查询列表（支持 status/projectType/customerSource/paymentStatus/customerTag/keyword/overdue 筛选）
 *   GET    /api/orders/:id          - 查询单条
 *   POST   /api/orders              - 新建（自动生成 orderNo）
 *   PUT    /api/orders/:id          - 更新
 *   DELETE /api/orders/:id          - 删除
 *   POST   /api/orders/batch        - 批量删除
 *   GET    /api/orders/stats/summary - 统计摘要（含逾期、今日到期）
 */
'use strict';

var express = require('express');
var router = express.Router();
var Storage = require('../utils/storage');
var resp = require('../utils/response');
var orderRules = require('../utils/order-rules');
var orderPayload = require('../utils/order-payload');

var orders = new Storage('orders');

/** 白名单外的字段被丢弃时留个痕，方便发现前端多传/传错字段名 */
function warnIgnoredFields(action, ignored) {
    if (!ignored || !ignored.length) return;
    console.warn('[orders] ' + action + ' 忽略非法字段:', ignored.join(', '));
}

// ========== 辅助函数 ==========

/**
 * 生成订单编号: DD + YYYYMMDD + 3位序号
 * 序号基于当天已有订单数量递增
 */
function generateOrderNo() {
    var now = new Date();
    var y = now.getFullYear();
    var m = String(now.getMonth() + 1).padStart(2, '0');
    var d = String(now.getDate()).padStart(2, '0');
    var dateStr = y + m + d;

    var all = orders.findAll();
    var prefix = 'DD' + dateStr;
    var count = 0;
    all.forEach(function (o) {
        if (o.orderNo && o.orderNo.indexOf(prefix) === 0) count++;
    });
    var seq = String(count + 1).padStart(3, '0');
    return prefix + seq;
}

// 付款字段推导、附件归一化、字段白名单与校验统一放在 utils/order-payload.js，
// 创建与更新共用同一份规则（以前 PUT 完全绕过校验，能把 id / 金额 / 必填项改坏）。

// ========== 统计摘要 ==========
router.get('/stats/summary', resp.asyncHandler(function (req, res) {
    var all = orders.findAll();
    var totalRevenue = 0;
    var totalCost = 0;
    var totalHours = 0;
    var statusCounts = { pending: 0, processing: 0, acceptance: 0, completed: 0, closed: 0 };
    var paymentCounts = { '未付款': 0, '部分付款': 0, '已结清': 0 };
    var overdueCount = 0;
    var dueTodayCount = 0;

    all.forEach(function (o) {
        if (orderRules.hasPayment(o)) {
            totalRevenue += orderRules.paidAmount(o);
            totalCost += orderRules.paidCost(o);
        }
        totalHours += parseFloat(o.hours) || 0;
        if (statusCounts[o.orderStatus] !== undefined) statusCounts[o.orderStatus]++;
        if (paymentCounts[o.paymentStatus] !== undefined) paymentCounts[o.paymentStatus]++;
        if (orderRules.isOverdue(o)) overdueCount++;
        if (orderRules.isDueToday(o)) dueTodayCount++;
    });

    var processingCount = all.filter(function (o) { return orderRules.isActiveProcessing(o); }).length;
    var acceptanceCount = statusCounts.acceptance;
    var completedCount = statusCounts.completed;

    return resp.success(res, {
        total: all.length,
        totalRevenue: totalRevenue,
        totalCost: totalCost,
        totalProfit: totalRevenue - totalCost,
        totalHours: totalHours,
        avgRate: totalHours > 0 ? (totalRevenue - totalCost) / totalHours : 0,
        statusCounts: statusCounts,
        paymentCounts: paymentCounts,
        // 概览卡片
        processing: processingCount,
        acceptance: acceptanceCount,
        completed: completedCount,
        // 特殊状态
        overdue: overdueCount,
        dueToday: dueTodayCount,
        // 百分比
        processingRate: all.length > 0 ? +(processingCount / all.length * 100).toFixed(1) : 0,
        acceptanceRate: all.length > 0 ? +(acceptanceCount / all.length * 100).toFixed(1) : 0,
        completedRate: all.length > 0 ? +(completedCount / all.length * 100).toFixed(1) : 0
    });
}));

// ========== 批量删除 ==========
router.post('/batch', resp.asyncHandler(function (req, res) {
    var ids = req.body.ids || [];
    if (!ids.length) return resp.error(res, '请选择要删除的订单');
    var removed = orders.removeMany(ids);
    return resp.success(res, { removed: removed });
}));

// ========== 查询列表 ==========
router.get('/', resp.asyncHandler(function (req, res) {
    var all = orders.findAll();
    var status = req.query.status;
    var projectType = req.query.projectType;
    var customerSource = req.query.customerSource;
    var paymentStatus = req.query.paymentStatus;
    var customerTag = req.query.customerTag;
    var customerId = req.query.customerId;
    var keyword = req.query.keyword;
    var overdue = req.query.overdue;
    var excludeOverdue = req.query.excludeOverdue;
    var dueToday = req.query.dueToday;
    var dateFrom = req.query.dateFrom;
    var dateTo = req.query.dateTo;
    var sort = req.query.sort || 'orderDate_desc'; // orderDate_desc | orderDate_asc | amount_desc | amount_asc
    var page = parseInt(req.query.page) || 1;
    var pageSize = parseInt(req.query.pageSize) || 50;

    var filtered = all;

    // 状态筛选
    if (status) {
        filtered = filtered.filter(function (o) { return o.orderStatus === status; });
    }
    // 项目类型筛选
    if (projectType && projectType !== '全部类型') {
        filtered = filtered.filter(function (o) { return o.projectType === projectType; });
    }
    // 客户来源筛选
    if (customerSource && customerSource !== '全部来源') {
        filtered = filtered.filter(function (o) { return o.customerSource === customerSource; });
    }
    // 付款状态筛选
    if (paymentStatus && paymentStatus !== '全部付款状态') {
        filtered = filtered.filter(function (o) { return o.paymentStatus === paymentStatus; });
    }
    // 客户标签筛选
    if (customerTag && customerTag !== '全部标签') {
        filtered = filtered.filter(function (o) {
            return Array.isArray(o.customerTags) && o.customerTags.indexOf(customerTag) !== -1;
        });
    }
    // 客户详情关联筛选
    if (customerId) {
        filtered = filtered.filter(function (o) { return o.customerId === customerId; });
    }
    // 时间范围筛选
    if (dateFrom) {
        filtered = filtered.filter(function (o) {
            return o.orderDate && o.orderDate >= dateFrom;
        });
    }
    if (dateTo) {
        filtered = filtered.filter(function (o) {
            return o.orderDate && o.orderDate <= dateTo;
        });
    }
    // 关键词搜索
    if (keyword) {
        var kw = keyword.toLowerCase();
        filtered = filtered.filter(function (o) {
            return (o.customerNick && o.customerNick.toLowerCase().indexOf(kw) !== -1) ||
                   (o.projectName && o.projectName.toLowerCase().indexOf(kw) !== -1) ||
                   (o.customerName && o.customerName.toLowerCase().indexOf(kw) !== -1) ||
                   (o.orderNo && o.orderNo.toLowerCase().indexOf(kw) !== -1);
        });
    }
    // 逾期筛选
    if (overdue === '1' || overdue === 'true') {
        filtered = filtered.filter(function (o) { return orderRules.isOverdue(o); });
    }
    if (excludeOverdue === '1' || excludeOverdue === 'true') {
        filtered = filtered.filter(function (o) { return !orderRules.isOverdue(o); });
    }
    // 今日到期筛选
    if (dueToday === '1' || dueToday === 'true') {
        filtered = filtered.filter(function (o) { return orderRules.isDueToday(o); });
    }

    // 排序
    if (sort === 'orderDate_asc') {
        filtered.sort(function (a, b) {
            return (a.orderDate || '').localeCompare(b.orderDate || '');
        });
    } else if (sort === 'amount_desc') {
        filtered.sort(function (a, b) {
            return (parseFloat(b.amount) || 0) - (parseFloat(a.amount) || 0);
        });
    } else if (sort === 'amount_asc') {
        filtered.sort(function (a, b) {
            return (parseFloat(a.amount) || 0) - (parseFloat(b.amount) || 0);
        });
    } else {
        // 默认: orderDate_desc
        filtered.sort(function (a, b) {
            return (b.orderDate || '').localeCompare(a.orderDate || '');
        });
    }

    // 分页
    var start = (page - 1) * pageSize;
    var paged = filtered.slice(start, start + pageSize);

    return resp.success(res, {
        list: paged,
        total: filtered.length,
        page: page,
        pageSize: pageSize
    });
}));

// ========== 查询单条 ==========
router.get('/:id', resp.asyncHandler(function (req, res) {
    var record = orders.findById(req.params.id);
    if (!record) return resp.notFound(res, '订单不存在');
    return resp.success(res, record);
}));

// ========== 新建 ==========
router.post('/', resp.asyncHandler(function (req, res) {
    // 白名单 + 归一化 + 必填校验；校验失败抛 OrderPayloadError(status=400)
    var built = orderPayload.buildCreatePayload(req.body || {});
    warnIgnoredFields('创建', built.ignored);

    // 订单编号一律由服务端生成：客户端能指定编号就能造出重复单号，
    // 而 generateOrderNo() 是按"当天已有数量"推算序号的，一旦重复就再也对不上。
    var record = orders.create(Object.assign({}, built.payload, {
        orderNo: generateOrderNo()
    }));

    return resp.success(res, record, 201);
}));

// ========== 更新 ==========
router.put('/:id', resp.asyncHandler(function (req, res) {
    var existing = orders.findById(req.params.id);
    if (!existing) return resp.notFound(res, '订单不存在');

    // 只允许白名单字段进入 patch；id / createdAt / updatedAt / orderNo 会被丢弃
    var built = orderPayload.buildUpdatePayload(req.body || {}, existing);
    warnIgnoredFields('更新', built.ignored);

    var updated = orders.update(req.params.id, built.patch);
    return resp.success(res, updated);
}));

// ========== 删除 ==========
router.delete('/:id', resp.asyncHandler(function (req, res) {
    var ok = orders.remove(req.params.id);
    if (!ok) return resp.notFound(res, '订单不存在');
    return resp.success(res, { id: req.params.id });
}));

module.exports = router;
