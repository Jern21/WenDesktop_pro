/**
 * 开发小账 / 收支记账
 *
 *   GET  /api/ledger/workbench?range=year|all  - 移动端工作台聚合（订单回款 + 手工记账）
 *   GET  /api/ledger                           - 手工记账列表
 *   POST /api/ledger                           - 新增一笔（收入/支出）
 *   DELETE /api/ledger/:id                     - 删除手工记账
 */
'use strict';

var express = require('express');
var router = express.Router();
var Storage = require('../utils/storage');
var resp = require('../utils/response');
var dateRange = require('../utils/date-range');
var paymentLedger = require('../utils/payment-ledger');
var settingsRepository = require('../utils/settings-repository');

var orders = new Storage('orders');
var ledger = new Storage('ledger');

var DEFAULT_GOAL = 20000;

function recentLimit(req) {
    var n = parseInt(req.query && req.query.recentLimit, 10);
    if (!isFinite(n) || n < 1) return 8;
    return Math.min(n, 100);
}

function normalizeRange(req) {
    var range = ((req.query && req.query.range) || 'year').toLowerCase();
    return range === 'all' ? 'all' : 'year';
}

var rangeMeta = dateRange.ledgerRangeMeta;
var inRange = dateRange.ledgerInRange;
var paymentCostForEntry = paymentLedger.paymentCostForEntry;
var eachOrderPayment = paymentLedger.eachPaymentEntry;

function incomeTitle(order, entry) {
    if (entry.note) return entry.note;
    var name = (order && (order.projectName || order.customerNick)) || '开发收入';
    if (order && order.paymentStatus === '部分付款') return name + ' · 回款';
    if (order && order.paymentStatus === '已结清') return name + ' · 尾款';
    return name;
}

function buildOrderTransactions(allOrders, meta) {
    var list = [];
    eachOrderPayment(allOrders, function (order, entry) {
        if (!inRange(entry.date, meta)) return;
        if (entry.amount > 0) {
            list.push({
                id: 'order-pay-' + order.id + '-' + entry.date + '-' + entry.amount,
                source: 'order',
                type: 'income',
                title: incomeTitle(order, entry),
                category: '开发收入',
                amount: entry.amount,
                date: entry.date,
                orderId: order.id
            });
        }
        var costPart = paymentCostForEntry(order, entry);
        if (costPart > 0) {
            list.push({
                id: 'order-cost-' + order.id + '-' + entry.date + '-' + costPart,
                source: 'order',
                type: 'expense',
                title: (order.projectName || '项目') + ' · 成本',
                category: '项目成本',
                amount: costPart,
                date: entry.date,
                orderId: order.id
            });
        }
    });
    return list;
}

function buildManualTransactions(meta) {
    return ledger.findAll().filter(function (row) {
        return inRange(row.date, meta);
    }).map(function (row) {
        return {
            id: row.id,
            source: 'manual',
            type: row.type === 'expense' ? 'expense' : 'income',
            title: row.title || (row.type === 'expense' ? '支出' : '收入'),
            category: row.category || (row.type === 'expense' ? '工具支出' : '开发收入'),
            amount: Math.abs(parseFloat(row.amount) || 0),
            date: String(row.date || '').slice(0, 10),
            note: row.note || ''
        };
    });
}

function sumByType(list, type) {
    return list.filter(function (t) { return t.type === type; })
        .reduce(function (sum, t) { return sum + (parseFloat(t.amount) || 0); }, 0);
}

function monthKey(dateStr) {
    return String(dateStr || '').slice(0, 7);
}

function buildTrend(allOrders, meta) {
    var buckets = {};
    eachOrderPayment(allOrders, function (order, entry) {
        if (!inRange(entry.date, meta)) return;
        var mk = monthKey(entry.date);
        if (!mk) return;
        if (!buckets[mk]) buckets[mk] = 0;
        buckets[mk] += entry.amount;
    });
    ledger.findAll().forEach(function (row) {
        if (row.type !== 'income') return;
        var d = String(row.date || '').slice(0, 10);
        if (!inRange(d, meta)) return;
        var mk = monthKey(d);
        if (!buckets[mk]) buckets[mk] = 0;
        buckets[mk] += Math.abs(parseFloat(row.amount) || 0);
    });

    var keys = Object.keys(buckets).sort();
    if (meta.range === 'year') {
        keys = keys.filter(function (k) { return k.indexOf(meta.thisYear) === 0; });
    }
    var last = keys.slice(-6);
    return last.map(function (k) {
        var parts = k.split('-');
        var label = parts[1] ? (parseInt(parts[1], 10) + '月') : k;
        return { month: k, label: label, income: Math.round(buckets[k] * 100) / 100 };
    });
}

function readGoalAmount() {
    try {
        var settings = settingsRepository.read();
        var goal = parseFloat(settings.devLedger && settings.devLedger.goalAmount);
        return goal > 0 ? goal : DEFAULT_GOAL;
    } catch (e) {
        return DEFAULT_GOAL;
    }
}

function buildMilestones(totalIncome) {
    return [
        {
            id: 'first',
            title: '首笔收入',
            subtitle: '迈出第一步',
            achieved: totalIncome > 0
        },
        {
            id: '10k',
            title: '突破一万元',
            subtitle: '每一份努力都有回响',
            achieved: totalIncome >= 10000
        }
    ];
}

router.get('/workbench', resp.asyncHandler(function (req, res) {
    var meta = rangeMeta(normalizeRange(req));
    var allOrders = orders.findAll();
    var transactions = buildOrderTransactions(allOrders, meta)
        .concat(buildManualTransactions(meta));

    var totalIncome = sumByType(transactions, 'income');
    var totalExpense = sumByType(transactions, 'expense');
    var goalAmount = readGoalAmount();
    var progress = goalAmount > 0 ? Math.min(100, Math.round(totalIncome / goalAmount * 100)) : 0;
    var remaining = Math.max(0, goalAmount - totalIncome);

    transactions.sort(function (a, b) {
        return String(b.date).localeCompare(String(a.date));
    });

    var rangeIncome = totalIncome;
    if (meta.range === 'year') {
        rangeIncome = totalIncome;
    }

    return resp.success(res, {
        title: '开发小账',
        subtitle: '记录每一份开发所得',
        range: meta.range,
        summary: {
            totalIncome: Math.round(totalIncome * 100) / 100,
            totalExpense: Math.round(totalExpense * 100) / 100,
            netIncome: Math.round((totalIncome - totalExpense) * 100) / 100
        },
        goal: {
            amount: goalAmount,
            progress: progress,
            remaining: Math.round(remaining * 100) / 100,
            hint: progress >= 100
                ? '目标已达成，继续保持！'
                : '已完成 ' + progress + '% · 再赚 ¥' + formatCompact(remaining) + ' 就达成'
        },
        trend: {
            rangeLabel: meta.range === 'year' ? '今年' : '全部',
            rangeIncome: Math.round(rangeIncome * 100) / 100,
            months: buildTrend(allOrders, meta)
        },
        milestones: buildMilestones(totalIncome),
        recent: transactions.slice(0, recentLimit(req))
    });
}));

function formatCompact(n) {
    var v = Math.round(n * 100) / 100;
    if (v >= 10000) return (v / 10000).toFixed(v % 10000 === 0 ? 0 : 1) + '万';
    return String(v).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

router.get('/', resp.asyncHandler(function (req, res) {
    var list = ledger.findAll().sort(function (a, b) {
        return String(b.date || '').localeCompare(String(a.date || ''));
    });
    return resp.success(res, list);
}));

router.post('/', resp.asyncHandler(function (req, res) {
    var body = req.body || {};
    var type = body.type === 'expense' ? 'expense' : 'income';
    var amount = Math.abs(parseFloat(body.amount) || 0);
    if (amount <= 0) return resp.error(res, '金额必须大于 0');
    if (!body.title) return resp.error(res, '标题为必填项');
    if (!body.date) return resp.error(res, '日期为必填项');

    var record = ledger.create({
        type: type,
        title: String(body.title).trim(),
        category: body.category || (type === 'expense' ? '工具支出' : '开发收入'),
        amount: amount,
        date: String(body.date).slice(0, 10),
        note: body.note || ''
    });
    return resp.success(res, record, 201);
}));

router.delete('/:id', resp.asyncHandler(function (req, res) {
    var ok = ledger.remove(req.params.id);
    if (!ok) return resp.notFound(res, '记录不存在');
    return resp.success(res, { id: req.params.id });
}));

module.exports = router;
