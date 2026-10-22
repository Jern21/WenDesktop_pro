/**
 * 客户路由
 *
 * 字段来源：customer.html 表单 + 详情面板
 *
 * 数据模型：
 *   - name / phone / source / type / level / followStatus / desc / tags
 *   - notes / avatar / followLogs[] / addTime / followTime / status
 *   - 订单相关展示字段（orderCount / totalAmount / firstDeal / amount）由订单实时聚合
 *
 * API：
 *   GET    /api/customers              - 列表（含订单聚合）
 *   GET    /api/customers/:id          - 单条（含订单聚合）
 *   GET    /api/customers/:id/detail   - 详情（客户 + 订单记录 + 跟进记录）
 *   POST   /api/customers              - 新建
 *   POST   /api/customers/:id/follows  - 新增跟进记录
 *   POST   /api/customers/seed         - 灌入种子数据
 *   PUT    /api/customers/:id          - 更新
 *   DELETE /api/customers/:id          - 删除
 */
'use strict';

var express = require('express');
var router = express.Router();
var Storage = require('../utils/storage');
var resp = require('../utils/response');
var orderRules = require('../utils/order-rules');
var customerOrders = require('../utils/customer-orders');
var pickFields = require('../utils/pick-fields').pickFields;
var warnIgnored = require('../utils/pick-fields').warnIgnored;

var customers = new Storage('customers');
var orders = new Storage('orders');
var paidAmount = orderRules.paidAmount;

var CUSTOMER_EDITABLE = [
    'name', 'phone', 'source', 'type', 'level', 'followStatus', 'desc', 'tags',
    'followTime', 'addTime', 'status', 'notes', 'avatar', 'followLogs'
];

function formatMoney(num) {
    var n = Math.round(num || 0);
    if (!n) return '-';
    return '¥ ' + n.toLocaleString('zh-CN');
}

function formatDateTime(d) {
    var pad = function (x) { return String(x).padStart(2, '0'); };
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) +
        ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
}

/**
 * 按 customerId 或客户昵称/姓名匹配订单
 *
 * 规则已抽到 utils/customer-orders.js（数据归属规则必须可单测）：
 * 订单一旦显式绑定了 customerId，就只认这个 ID。
 */
var matchOrders = customerOrders.matchOrders;

/** 用订单数据聚合客户消费字段 */
function enrichCustomer(customer, allOrders) {
    var related = matchOrders(customer, allOrders);
    var totalPaid = 0;
    var firstDeal = '';

    related.forEach(function (o) {
        totalPaid += paidAmount(o);
        if (o.orderDate && (!firstDeal || o.orderDate < firstDeal)) {
            firstDeal = o.orderDate;
        }
    });

    var followLogs = Array.isArray(customer.followLogs) ? customer.followLogs : [];
    var latestFollow = followLogs.length
        ? followLogs.slice().sort(function (a, b) {
            return String(b.createdAt || '').localeCompare(String(a.createdAt || ''));
        })[0]
        : null;

    return Object.assign({}, customer, {
        orderCount: related.length,
        totalAmount: formatMoney(totalPaid),
        amount: formatMoney(totalPaid),
        firstDeal: firstDeal || customer.firstDeal || '—',
        followLogs: followLogs,
        followTime: latestFollow
            ? formatDateTime(new Date(latestFollow.createdAt))
            : (customer.followTime || '')
    });
}

function generateFollowId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

// ========== 灌入种子数据 ==========

router.post('/seed', resp.asyncHandler(function (req, res) {
    var seedData = require('../data/seed-customers');
    customers.clear();
    var records = customers.createMany(seedData);
    return resp.success(res, { count: records.length });
}));

// ========== 查询列表 ==========

router.get('/', resp.asyncHandler(function (req, res) {
    var all = customers.findAll();
    var allOrders = orders.findAll();
    var keyword = req.query.keyword;
    var type = req.query.type;
    var source = req.query.source;
    var level = req.query.level;

    if (type) {
        all = all.filter(function (c) { return c.type === type; });
    }
    if (source) {
        all = all.filter(function (c) { return c.source === source; });
    }
    if (level) {
        all = all.filter(function (c) { return c.level === level; });
    }
    if (keyword) {
        var kw = keyword.toLowerCase();
        all = all.filter(function (c) {
            return (c.name && c.name.toLowerCase().indexOf(kw) !== -1) ||
                   (c.phone && c.phone.indexOf(kw) !== -1) ||
                   (c.desc && c.desc.toLowerCase().indexOf(kw) !== -1);
        });
    }

    all.sort(function (a, b) {
        return new Date(b.createdAt) - new Date(a.createdAt);
    });

    var enriched = all.map(function (c) {
        return enrichCustomer(c, allOrders);
    });

    return resp.success(res, enriched);
}));

// ========== 客户详情（含订单 / 跟进）==========
// 注意：必须写在 /:id 之前，避免被当作 id

router.get('/:id/detail', resp.asyncHandler(function (req, res) {
    var record = customers.findById(req.params.id);
    if (!record) return resp.notFound(res, '客户不存在');

    var allOrders = orders.findAll();
    var related = matchOrders(record, allOrders);
    var enriched = enrichCustomer(record, allOrders);

    var orderList = related.map(function (o) {
        return Object.assign({}, o, {
            customerId: o.customerId || '',
            projectName: o.projectName || o.title || '',
            amount: parseFloat(o.amount) || 0,
            cost: parseFloat(o.cost) || 0,
            hours: parseFloat(o.hours) || 0,
            paymentRatio: o.paymentRatio || 0,
            paidAmount: Math.round(paidAmount(o)),
            uploadedFiles: o.uploadedFiles || {}
        });
    });

    var followLogs = (enriched.followLogs || []).slice().sort(function (a, b) {
        return String(b.createdAt || '').localeCompare(String(a.createdAt || ''));
    });

    return resp.success(res, {
        customer: enriched,
        orders: orderList,
        followLogs: followLogs,
        stats: {
            orderCount: orderList.length,
            totalPaid: orderList.reduce(function (s, o) { return s + (o.paidAmount || 0); }, 0),
            totalAmount: orderList.reduce(function (s, o) { return s + (o.amount || 0); }, 0)
        }
    });
}));

// ========== 新增跟进记录 ==========

router.post('/:id/follows', resp.asyncHandler(function (req, res) {
    var record = customers.findById(req.params.id);
    if (!record) return resp.notFound(res, '客户不存在');

    var content = ((req.body && req.body.content) || '').trim();
    if (!content) return resp.error(res, '跟进内容不能为空');

    var follow = {
        id: generateFollowId(),
        content: content,
        createdAt: new Date().toISOString(),
        author: (req.body && req.body.author) || '我'
    };

    var logs = Array.isArray(record.followLogs) ? record.followLogs.slice() : [];
    logs.unshift(follow);

    var updated = customers.update(req.params.id, {
        followLogs: logs,
        followTime: formatDateTime(new Date()),
        followStatus: (req.body && req.body.followStatus) || record.followStatus
    });

    return resp.success(res, {
        follow: follow,
        customer: enrichCustomer(updated, orders.findAll())
    }, 201);
}));

// ========== 查询单条 ==========

router.get('/:id', resp.asyncHandler(function (req, res) {
    var record = customers.findById(req.params.id);
    if (!record) return resp.notFound(res, '客户不存在');
    return resp.success(res, enrichCustomer(record, orders.findAll()));
}));

// ========== 新建 ==========

router.post('/', resp.asyncHandler(function (req, res) {
    var body = req.body || {};

    if (!body.name) return resp.error(res, '客户姓名为必填项');

    var now = new Date();
    var record = customers.create({
        name: body.name,
        phone: body.phone || '',
        source: body.source || '闲鱼',
        type: body.type || '潜在客户',
        level: body.level || 'B 普通客户',
        followStatus: body.followStatus || '待跟进',
        desc: body.desc || '',
        tags: body.tags || [],
        amount: body.amount || '-',
        orderCount: 0,
        followTime: body.followTime || '',
        addTime: body.addTime || formatDateTime(now),
        totalAmount: '-',
        firstDeal: '—',
        status: body.status || '正常',
        notes: body.notes || '',
        avatar: body.avatar || '',
        followLogs: Array.isArray(body.followLogs) ? body.followLogs : []
    });

    return resp.success(res, enrichCustomer(record, orders.findAll()), 201);
}));

// ========== 更新 ==========

router.put('/:id', resp.asyncHandler(function (req, res) {
    var existing = customers.findById(req.params.id);
    if (!existing) return resp.notFound(res, '客户不存在');

    var picked = pickFields(req.body, CUSTOMER_EDITABLE);
    warnIgnored('customers 更新', picked.ignored);

    if (Object.prototype.hasOwnProperty.call(picked.fields, 'name') && !String(picked.fields.name || '').trim()) {
        return resp.error(res, '客户姓名为必填项');
    }

    var updated = customers.update(req.params.id, picked.fields);
    if (!updated) return resp.notFound(res, '客户不存在');
    return resp.success(res, enrichCustomer(updated, orders.findAll()));
}));

// ========== 删除 ==========

router.delete('/:id', resp.asyncHandler(function (req, res) {
    var ok = customers.remove(req.params.id);
    if (!ok) return resp.notFound(res, '客户不存在');
    return resp.success(res, { id: req.params.id });
}));

module.exports = router;
