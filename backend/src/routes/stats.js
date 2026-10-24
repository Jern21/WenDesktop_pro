/**
 * 数据统计路由
 *
 * 聚合各实体数据，为首页与 stats.html 提供图表数据
 *
 * API：
 *   GET    /api/stats/home-metrics   - 首页顶部指标（含真实环比）
 *   GET    /api/stats/dashboard      - 首页仪表盘统计
 *   GET    /api/stats/monthly-overview - 本月数据概览（含真实环比）
 *   GET    /api/stats/revenue        - 收入趋势（按月）
 *   GET    /api/stats/revenue/daily  - 订单趋势（?days=7|30|all）
 *   GET    /api/stats/platform       - 平台分布
 *   GET    /api/stats/project-type   - 项目类型分布
 *   GET    /api/stats/orders-monthly - 月度订单量
 *   GET    /api/stats/customer-level - 客户等级分布
 *   GET    /api/stats/funnel         - 转化漏斗
 *   GET    /api/stats/todos          - 首页待办统计
 *   GET    /api/stats/monthly-detail - 月度明细
 */
'use strict';

var express = require('express');
var router = express.Router();
var Storage = require('../utils/storage');
var resp = require('../utils/response');
var orderRules = require('../utils/order-rules');
var customerOrders = require('../utils/customer-orders');
var dateRange = require('../utils/date-range');
var paymentLedger = require('../utils/payment-ledger');
var orderTrend = require('../utils/order-trend');

var normalizeStatsRange = dateRange.normalizeStatsRange;
var createRangeMeta = dateRange.createRangeMeta;
var matchRangeDate = dateRange.matchRangeDate;
var paymentCostForEntry = paymentLedger.paymentCostForEntry;
var eachPaymentEntry = paymentLedger.eachPaymentEntry;

var orders = new Storage('orders');
var customers = new Storage('customers');
var posters = new Storage('posters');
var projects = new Storage('projects');
var posts = new Storage('platform-posts');
var reminders = new Storage('reminders');

var localDateStr = orderRules.localDateStr;
var paidAmount = orderRules.paidAmount;
var paidCost = orderRules.paidCost;
var hasPayment = orderRules.hasPayment;

/** 环比增长率；基准为 0 时：当前>0 视为 100，否则 0 */
function calcGrowth(current, previous) {
    if (previous > 0) return Math.round((current - previous) / previous * 100);
    if (current > 0) return 100;
    return 0;
}

function ordersCreatedOnDate(allOrders, dateStr) {
    return allOrders.filter(function (o) {
        return o.createdAt && o.createdAt.startsWith(dateStr);
    });
}

function goodRateOf(list) {
    var rated = list.filter(function (o) { return o.rating && o.rating > 0; });
    if (!rated.length) return 0;
    var good = rated.filter(function (o) { return o.rating >= 4; }).length;
    return Math.round(good / rated.length * 100);
}

var repeatRateOf = customerOrders.repeatRate;

function recordDate(record, fields) {
    for (var i = 0; i < fields.length; i++) {
        if (record && record[fields[i]]) return record[fields[i]];
    }
    return '';
}

function filterOrdersByRange(allOrders, meta, previous) {
    if (meta.range === 'all') return previous ? [] : allOrders.slice();
    return allOrders.filter(function (o) {
        return matchRangeDate(o.orderDate, meta, previous);
    });
}

function sumPaymentAmountByDate(allOrders, matcher) {
    var total = 0;
    eachPaymentEntry(allOrders, function (order, entry) {
        if (matcher(entry.date, order, entry)) total += entry.amount;
    });
    return total;
}

function sumPaymentCostByRange(allOrders, meta, previous) {
    var total = 0;
    eachPaymentEntry(allOrders, function (order, entry) {
        if (matchRangeDate(entry.date, meta, previous)) {
            total += paymentCostForEntry(order, entry);
        }
    });
    return total;
}

function paymentOrdersByRange(allOrders, meta, previous) {
    var seen = {};
    var list = [];
    eachPaymentEntry(allOrders, function (order, entry) {
        if (!matchRangeDate(entry.date, meta, previous)) return;
        var key = order.id || order.orderNo || JSON.stringify(order);
        if (seen[key]) return;
        seen[key] = true;
        list.push(order);
    });
    return list;
}

function filterCustomersByRange(allCustomers, meta, previous) {
    if (meta.range === 'all') return previous ? [] : allCustomers.slice();
    return allCustomers.filter(function (c) {
        return matchRangeDate(recordDate(c, ['addTime', 'createdAt']), meta, previous);
    });
}

function filterPostsByRange(allPosts, meta, previous) {
    if (meta.range === 'all') return previous ? [] : allPosts.slice();
    return allPosts.filter(function (p) {
        return matchRangeDate(recordDate(p, ['publishTime', 'createdAt', 'updatedAt']), meta, previous);
    });
}

var uniqueOrderCustomerCount = customerOrders.uniqueCustomerCount;

// ========== 首页顶部指标（含真实环比） ==========
router.get('/home-metrics', resp.asyncHandler(function (req, res) {
    var allOrders = orders.findAll();
    var today = new Date();
    var todayStr = localDateStr(today);

    var yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    var yesterdayStr = localDateStr(yesterday);

    var thisMonth = todayStr.substring(0, 7);
    var lastMonthDate = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    var lastMonth = localDateStr(lastMonthDate).substring(0, 7);
    var thisYear = String(today.getFullYear());
    var lastYear = String(today.getFullYear() - 1);

    var todayCreated = ordersCreatedOnDate(allOrders, todayStr);
    var yesterdayCreated = ordersCreatedOnDate(allOrders, yesterdayStr);

    var todayOrders = todayCreated.length;
    var yesterdayOrders = yesterdayCreated.length;
    var todayRevenue = sumPaymentAmountByDate(allOrders, function (date) {
        return date === todayStr;
    });
    var yesterdayRevenue = sumPaymentAmountByDate(allOrders, function (date) {
        return date === yesterdayStr;
    });

    var activeOrders = allOrders.filter(function (o) {
        return orderRules.isActiveProcessing(o);
    }).length;

    var monthRevenue = sumPaymentAmountByDate(allOrders, function (date) {
        return date && date.startsWith(thisMonth);
    });
    var lastMonthRevenue = sumPaymentAmountByDate(allOrders, function (date) {
        return date && date.startsWith(lastMonth);
    });

    var yearRevenue = sumPaymentAmountByDate(allOrders, function (date) {
        return date && date.startsWith(thisYear);
    });
    var lastYearRevenue = sumPaymentAmountByDate(allOrders, function (date) {
        return date && date.startsWith(lastYear);
    });
    var totalRevenue = sumPaymentAmountByDate(allOrders, function () { return true; });

    return resp.success(res, {
        todayOrders: todayOrders,
        todayOrdersGrowth: calcGrowth(todayOrders, yesterdayOrders),
        activeOrders: activeOrders,
        todayRevenue: todayRevenue,
        todayRevenueGrowth: calcGrowth(todayRevenue, yesterdayRevenue),
        monthRevenue: monthRevenue,
        monthRevenueGrowth: calcGrowth(monthRevenue, lastMonthRevenue),
        yearRevenue: yearRevenue,
        yearRevenueGrowth: calcGrowth(yearRevenue, lastYearRevenue),
        totalRevenue: totalRevenue
    });
}));

// ========== 首页仪表盘统计 ==========
router.get('/dashboard', resp.asyncHandler(function (req, res) {
    var allOrders = orders.findAll();
    var allCustomers = customers.findAll();
    var allProjects = projects.findAll();
    var allPosts = posts.findAll();

    var totalRevenue = 0;
    var totalProfit = 0;
    var activeProjects = 0;

    allOrders.forEach(function (o) {
        if (!hasPayment(o)) return;
        totalRevenue += paidAmount(o);
        totalProfit += paidAmount(o) - paidCost(o);
    });

    activeProjects = allProjects.filter(function (p) {
        return p.status === 'in_progress' || p.status === 'todo';
    }).length;

    var paidOrders = allOrders.filter(hasPayment).length;
    var pendingPayment = allOrders.reduce(function (sum, o) {
        if (o.orderStatus === 'closed') return sum;
        var rest = (parseFloat(o.amount) || 0) - paidAmount(o);
        return rest > 0 ? sum + rest : sum;
    }, 0);

    var publishedPosts = allPosts.filter(function (p) { return p.status === 'published'; }).length;

    return resp.success(res, {
        totalRevenue: totalRevenue,
        totalProfit: totalProfit,
        totalOrders: allOrders.length,
        paidOrders: paidOrders,
        pendingPayment: Math.round(pendingPayment * 100) / 100,
        totalCustomers: allCustomers.length,
        activeProjects: activeProjects,
        totalProjects: allProjects.length,
        publishedPosts: publishedPosts,
        totalPosters: posters.count()
    });
}));

// ========== 本月数据概览 ==========
router.get('/monthly-overview', resp.asyncHandler(function (req, res) {
    var allOrders = orders.findAll();
    var allCustomers = customers.findAll();
    var range = normalizeStatsRange(req, 'all');
    var meta = createRangeMeta(range);
    var hasComparison = range !== 'all';

    var monthOrders = filterOrdersByRange(allOrders, meta, false);
    var lastMonthOrders = filterOrdersByRange(allOrders, meta, true);
    var monthPaid = paymentOrdersByRange(allOrders, meta, false);
    var lastMonthPaid = paymentOrdersByRange(allOrders, meta, true);

    var monthRevenue = sumPaymentAmountByDate(allOrders, function (date) {
        return matchRangeDate(date, meta, false);
    });
    var lastMonthRevenue = sumPaymentAmountByDate(allOrders, function (date) {
        return matchRangeDate(date, meta, true);
    });
    var monthCost = sumPaymentCostByRange(allOrders, meta, false);
    var monthProfit = monthRevenue - monthCost;

    var revenueGrowth = hasComparison ? calcGrowth(monthRevenue, lastMonthRevenue) : null;
    var orderCountGrowth = hasComparison ? calcGrowth(monthOrders.length, lastMonthOrders.length) : null;

    var avgOrderValue = monthPaid.length > 0
        ? Math.round(monthRevenue / monthPaid.length)
        : 0;
    var lastAvgOrderValue = lastMonthPaid.length > 0
        ? Math.round(lastMonthRevenue / lastMonthPaid.length)
        : 0;
    var avgOrderValueGrowth = hasComparison ? calcGrowth(avgOrderValue, lastAvgOrderValue) : null;

    var currentCustomers = filterCustomersByRange(allCustomers, meta, false);
    var monthNewCustomers = currentCustomers.length;

    var yearMeta = createRangeMeta('year');
    var yearRevenue = sumPaymentAmountByDate(allOrders, function (date) {
        return matchRangeDate(date, yearMeta, false);
    });
    var lastYearRevenue = sumPaymentAmountByDate(allOrders, function (date) {
        return matchRangeDate(date, yearMeta, true);
    });
    var yearGrowth = calcGrowth(yearRevenue, lastYearRevenue);

    var customerCount = uniqueOrderCustomerCount(monthPaid);
    var lastCustomerCount = uniqueOrderCustomerCount(lastMonthPaid);
    var customerGrowth = hasComparison ? calcGrowth(customerCount, lastCustomerCount) : null;

    // 好评率：按当前统计范围
    var goodRate = goodRateOf(monthOrders);
    var lastMonthGoodRate = goodRateOf(lastMonthOrders);
    var goodRateGrowth = hasComparison ? calcGrowth(goodRate, lastMonthGoodRate) : null;

    // 复购率：按当前统计范围
    var repeatRate = repeatRateOf(monthOrders);
    var lastMonthRepeatRate = repeatRateOf(lastMonthOrders);
    var repeatRateGrowth = hasComparison ? calcGrowth(repeatRate, lastMonthRepeatRate) : null;

    return resp.success(res, {
        range: range,
        label: meta.label,
        hasComparison: hasComparison,
        month: meta.label,
        orderCount: monthOrders.length,
        orderCountGrowth: orderCountGrowth,
        revenue: monthRevenue,
        cost: monthCost,
        profit: monthProfit,
        avgOrderValue: avgOrderValue,
        avgOrderValueGrowth: avgOrderValueGrowth,
        newCustomers: monthNewCustomers,
        revenueGrowth: revenueGrowth,
        lastMonthRevenue: lastMonthRevenue,
        yearRevenue: yearRevenue,
        yearGrowth: yearGrowth,
        customerCount: customerCount,
        totalCustomers: customerCount,
        customerGrowth: customerGrowth,
        goodRate: goodRate,
        goodRateGrowth: goodRateGrowth,
        repeatRate: repeatRate,
        repeatRateGrowth: repeatRateGrowth
    });
}));

// ========== 收入趋势（按月） ==========
router.get('/revenue', resp.asyncHandler(function (req, res) {
    var range = normalizeStatsRange(req, 'all');
    var meta = createRangeMeta(range);
    var allOrders = orders.findAll();
    var months = {};

    eachPaymentEntry(allOrders, function (o, entry) {
        if (!matchRangeDate(entry.date, meta, false)) return;
        var month = entry.date.substring(0, 7); // YYYY-MM
        if (!months[month]) months[month] = { revenue: 0, cost: 0, profit: 0, count: 0 };
        var rev = entry.amount;
        var cost = paymentCostForEntry(o, entry);
        months[month].revenue += rev;
        months[month].cost += cost;
        months[month].profit += rev - cost;
        months[month].count++;
    });

    // 按月份排序
    var sorted = Object.keys(months).sort().map(function (m) {
        return Object.assign({ month: m }, months[m]);
    });

    return resp.success(res, sorted);
}));

// ========== 订单趋势（近 7 天 / 近 30 天 / 总览） ==========
router.get('/revenue/daily', resp.asyncHandler(function (req, res) {
    return resp.success(res, orderTrend.build(orders.findAll(), {
        days: req.query.days,
        today: new Date()
    }));
}));

// ========== 平台分布（客源平台分布）==========
router.get('/platform', resp.asyncHandler(function (req, res) {
    var range = normalizeStatsRange(req, 'all');
    var meta = createRangeMeta(range);
    var allCustomers = filterCustomersByRange(customers.findAll(), meta, false);
    var sourceMap = {};

    // 统计各来源平台的客户数量
    allCustomers.forEach(function (c) {
        var source = c.source || '其他';
        if (!sourceMap[source]) {
            sourceMap[source] = { platform: source, count: 0 };
        }
        sourceMap[source].count++;
    });

    // 转换为数组并按数量降序排序
    var distribution = Object.values(sourceMap).sort(function (a, b) {
        return b.count - a.count;
    });

    return resp.success(res, distribution);
}));

// ========== 项目类型分布 ==========
router.get('/project-type', resp.asyncHandler(function (req, res) {
    var range = normalizeStatsRange(req, 'all');
    var meta = createRangeMeta(range);
    var allOrders = filterOrdersByRange(orders.findAll(), meta, false);
    var types = {};

    allOrders.forEach(function (o) {
        var type = o.projectType || '其他';
        if (!types[type]) types[type] = { count: 0, revenue: 0 };
        types[type].count++;
        types[type].revenue += paidAmount(o);
    });

    var result = Object.keys(types).map(function (t) {
        return Object.assign({ type: t }, types[t]);
    });

    return resp.success(res, result);
}));

// ========== 订单量统计（支持总/年度/月度切换）==========
router.get('/orders-monthly', resp.asyncHandler(function (req, res) {
    var range = normalizeStatsRange(req, 'all');
    var meta = createRangeMeta(range);
    var allOrders = filterOrdersByRange(orders.findAll(), meta, false);
    var type = req.query.type || 'total'; // total, annual, monthly

    if (type === 'total') {
        // 总订单量 - 按项目类型统计
        var typeStats = {};
        allOrders.forEach(function (o) {
            var pt = o.projectType || '其他';
            if (!typeStats[pt]) {
                typeStats[pt] = { completed: 0, cancelled: 0 };
            }
            if (o.orderStatus === 'closed') {
                typeStats[pt].cancelled++;
            } else {
                typeStats[pt].completed++;
            }
        });

        var result = Object.keys(typeStats).map(function (t) {
            return { name: t, completed: typeStats[t].completed, cancelled: typeStats[t].cancelled };
        }).sort(function (a, b) {
            return (b.completed + b.cancelled) - (a.completed + a.cancelled);
        });

        return resp.success(res, { type: 'total', data: result });

    } else if (type === 'annual') {
        // 年度订单量
        var years = {};
        allOrders.forEach(function (o) {
            if (o.orderDate) {
                var year = o.orderDate.substring(0, 4);
                if (!years[year]) {
                    years[year] = { completed: 0, cancelled: 0 };
                }
                if (o.orderStatus === 'closed') {
                    years[year].cancelled++;
                } else {
                    years[year].completed++;
                }
            }
        });

        var sorted = Object.keys(years).sort().map(function (y) {
            return { name: y + '年', completed: years[y].completed, cancelled: years[y].cancelled };
        });

        return resp.success(res, { type: 'annual', data: sorted });

    } else {
        // 月度订单量（默认）
        var months = {};
        allOrders.forEach(function (o) {
            if (o.orderDate) {
                var month = o.orderDate.substring(0, 7);
                if (!months[month]) {
                    months[month] = { completed: 0, cancelled: 0 };
                }
                if (o.orderStatus === 'closed') {
                    months[month].cancelled++;
                } else {
                    months[month].completed++;
                }
            }
        });

        var sorted = Object.keys(months).sort().map(function (m) {
            return { name: m, completed: months[m].completed, cancelled: months[m].cancelled };
        });

        return resp.success(res, { type: 'monthly', data: sorted });
    }
}));

// ========== 客户等级分布 ==========
router.get('/customer-level', resp.asyncHandler(function (req, res) {
    var range = normalizeStatsRange(req, 'all');
    var meta = createRangeMeta(range);
    var allCustomers = filterCustomersByRange(customers.findAll(), meta, false);

    // 等级映射：将后端存储的格式映射为前端显示的格式
    var levelMap = {
        'A 高价值': '高价值客户',
        'B 普通客户': '普通客户',
        'C 潜在客户': '潜在客户'
    };

    // 初始化所有等级为0
    var levels = {
        '高价值客户': 0,
        '普通客户': 0,
        '潜在客户': 0,
        '流失客户': 0
    };

    allCustomers.forEach(function (c) {
        var level = c.level || 'B 普通客户';
        var mappedLevel = levelMap[level];

        if (mappedLevel) {
            levels[mappedLevel]++;
        } else {
            // 如果等级不在映射表中，尝试根据类型判断
            if (c.type === '流失客户' || c.status === '已流失') {
                levels['流失客户']++;
            } else if (c.type === '潜在客户') {
                levels['潜在客户']++;
            } else {
                levels['普通客户']++;
            }
        }
    });

    // 转换为数组格式
    var result = Object.keys(levels).map(function (l) {
        return { level: l, count: levels[l] };
    });

    return resp.success(res, result);
}));

// ========== 转化漏斗 ==========
router.get('/funnel', resp.asyncHandler(function (req, res) {
    var range = normalizeStatsRange(req, 'all');
    var meta = createRangeMeta(range);
    var allPosts = filterPostsByRange(posts.findAll(), meta, false);
    var allOrders = filterOrdersByRange(orders.findAll(), meta, false);
    var allCustomers = filterCustomersByRange(customers.findAll(), meta, false);

    var totalViews = 0;
    var totalInquiries = 0;
    var allPublished = allPosts.filter(function (p) { return p.status === 'published'; });

    allPublished.forEach(function (p) {
        totalViews += parseInt(p.stats && p.stats.views) || 0;
        totalInquiries += parseInt(p.stats && p.stats.inquiries) || 0;
    });

    // 返回前端期望的格式：{ name: '阶段名', value: 数量 }
    return resp.success(res, [
        { name: '浏览量', value: totalViews },
        { name: '私信咨询', value: totalInquiries },
        { name: '成交订单', value: allOrders.filter(hasPayment).length },
        { name: '积累客户', value: allCustomers.length }
    ]);
}));

// ========== 首页待办事项统计 ==========
router.get('/todos', resp.asyncHandler(function (req, res) {
    var allOrders = orders.findAll();
    var allPosts = posts.findAll();
    var allCustomers = customers.findAll();
    var allReminders = reminders.findAll();
    var allProjects = projects.findAll();

    var today = new Date();
    var todayStr = localDateStr(today);
    var sevenDaysLater = new Date(today);
    sevenDaysLater.setDate(today.getDate() + 7);

    // 待回复客户消息（跟进中 / 潜在客户）
    var pendingReply = allCustomers.filter(function (c) {
        return c.followStatus === '跟进中' || c.type === '潜在客户';
    }).length;

    // 待报价订单
    var pendingQuote = allOrders.filter(function (o) {
        return o.orderStatus === 'pending';
    }).length;

    // 平台审核中
    var platformReviewing = allPosts.filter(function (p) {
        return p.status === 'pending' || p.status === 'reviewing';
    }).length;

    // 即将到期订单（7天内）
    var expiringSoon = allOrders.filter(function (o) {
        if (!o.finalDate || o.orderStatus === 'completed' || o.orderStatus === 'closed') return false;
        var finalDate = new Date(o.finalDate);
        return finalDate >= today && finalDate <= sevenDaysLater;
    }).length;

    // 待验收订单
    var pendingAcceptance = allOrders.filter(function (o) {
        return o.orderStatus === 'acceptance';
    }).length;

    // 逾期订单（截止日期已过且未完成）
    var overdueOrders = allOrders.filter(function (o) {
        if (!o.finalDate || o.orderStatus === 'completed' || o.orderStatus === 'closed') return false;
        return new Date(o.finalDate) < today;
    }).length;

    // 今日提醒（未完成）
    var todayReminders = allReminders.filter(function (r) {
        return r.date === todayStr && !r.done;
    }).length;

    // 进行中项目
    var activeProjects = allProjects.filter(function (p) {
        return p.status === 'in_progress' || p.status === 'todo' || p.status === 'doing';
    }).length;

    return resp.success(res, {
        pendingReply: pendingReply,
        pendingQuote: pendingQuote,
        platformReviewing: platformReviewing,
        expiringSoon: expiringSoon,
        pendingAcceptance: pendingAcceptance,
        overdueOrders: overdueOrders,
        todayReminders: todayReminders,
        activeProjects: activeProjects
    });
}));

// ========== 月度明细数据（用于统计页表格）==========
router.get('/monthly-detail', resp.asyncHandler(function (req, res) {
    var range = normalizeStatsRange(req, 'all');
    var meta = createRangeMeta(range);
    var allOrders = orders.findAll();
    var rangeOrders = filterOrdersByRange(allOrders, meta, false);
    var allCustomers = filterCustomersByRange(customers.findAll(), meta, false);
    var periodStats = {};
    var periodPaidOrderMap = {};

    function periodKey(dateStr) {
        if (!dateStr) return '';
        return range === 'month' ? String(dateStr).substring(0, 10) : String(dateStr).substring(0, 7);
    }

    function ensurePeriod(key) {
        if (!key) return null;
        if (!periodStats[key]) {
            periodStats[key] = {
                period: key,
                orderCount: 0,
                paidCount: 0,
                revenue: 0,
                newCustomers: 0,
                orders: []
            };
        }
        return periodStats[key];
    }

    var today = new Date();
    if (range === 'month') {
        for (var day = 1; day <= today.getDate(); day++) {
            ensurePeriod(meta.thisMonth + '-' + String(day).padStart(2, '0'));
        }
    } else if (range === 'year') {
        for (var monthIndex = 0; monthIndex <= today.getMonth(); monthIndex++) {
            ensurePeriod(meta.thisYear + '-' + String(monthIndex + 1).padStart(2, '0'));
        }
    }

    // 统计订单数据：订单数按接单日期归属
    rangeOrders.forEach(function (o) {
        var stat = ensurePeriod(periodKey(o.orderDate));
        if (stat) {
            stat.orderCount++;
            stat.orders.push(o);
        }
    });

    // 统计收入数据：成交额按实际付款日期归属
    eachPaymentEntry(allOrders, function (o, entry) {
        if (!matchRangeDate(entry.date, meta, false)) return;
        var stat = ensurePeriod(periodKey(entry.date));
        if (!stat) return;
        stat.revenue += entry.amount;
        if (!periodPaidOrderMap[stat.period]) periodPaidOrderMap[stat.period] = {};
        periodPaidOrderMap[stat.period][o.id || o.orderNo || entry.date + ':' + entry.amount] = true;
    });

    // 统计新增客户
    allCustomers.forEach(function (c) {
        var stat = ensurePeriod(periodKey(recordDate(c, ['addTime', 'createdAt'])));
        if (stat) {
            stat.newCustomers++;
        }
    });

    // 转换为数组并计算派生指标
    var result = Object.keys(periodStats).sort().reverse().map(function (period, index, arr) {
        var stat = periodStats[period];
        var paidCount = Object.keys(periodPaidOrderMap[period] || {}).length;
        var avgOrderValue = paidCount > 0 ? Math.round(stat.revenue / paidCount) : 0;

        // 计算环比（与上一周期比较）
        var prevPeriod = arr[index + 1];
        var growth = 0;
        if (prevPeriod && periodStats[prevPeriod]) {
            var prevRevenue = periodStats[prevPeriod].revenue;
            growth = prevRevenue > 0 ? Math.round((stat.revenue - prevRevenue) / prevRevenue * 100) : 0;
        }

        return {
            month: period,
            orderCount: stat.orderCount,
            revenue: stat.revenue,
            newCustomers: stat.newCustomers,
            avgOrderValue: avgOrderValue,
            repeatRate: repeatRateOf(stat.orders),
            goodRate: goodRateOf(stat.orders),
            growth: growth
        };
    });

    return resp.success(res, result);
}));

// ========== 通知中心：聚合提醒与待办 ==========

/** 将日期差值转为友好时间文案 */
function relativeTime(dateStr) {
    if (!dateStr) return '';
    var target = new Date(dateStr + 'T00:00:00');
    var today = new Date();
    today.setHours(0, 0, 0, 0);
    var diffDays = Math.round((target - today) / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return '今天';
    if (diffDays === 1) return '明天';
    if (diffDays === -1) return '昨天';
    if (diffDays < 0) return '逾期 ' + Math.abs(diffDays) + ' 天';
    return diffDays + ' 天后';
}

router.get('/notifications', resp.asyncHandler(function (req, res) {
    var allReminders = reminders.findAll();
    var allOrders = orders.findAll();
    var today = new Date();
    var todayStr = localDateStr(today);
    var threeDaysLater = new Date(today);
    threeDaysLater.setDate(today.getDate() + 3);
    var threeDaysLaterStr = localDateStr(threeDaysLater);

    var items = [];

    // 1. 逾期提醒（日期已过且未完成）— 最高优先级
    var overdue = allReminders.filter(function (r) {
        return !r.done && r.date < todayStr;
    }).sort(function (a, b) {
        return new Date(a.date) - new Date(b.date);
    });

    if (overdue.length) {
        items.push({
            type: 'overdue',
            icon: 'ph ph-warning-circle',
            color: 'red',
            title: overdue.length + ' 条提醒已逾期',
            desc: overdue.slice(0, 2).map(function (r) { return r.title; }).join('、') + (overdue.length > 2 ? ' 等' : ''),
            time: relativeTime(overdue[0].date),
            count: overdue.length
        });
    }

    // 2. 今日提醒（未完成）
    var todayList = allReminders.filter(function (r) {
        return !r.done && r.date === todayStr;
    }).sort(function (a, b) {
        return (a.time || '').localeCompare(b.time || '');
    });

    if (todayList.length) {
        items.push({
            type: 'today',
            icon: 'ph ph-clock-countdown',
            color: 'amber',
            title: '今日有 ' + todayList.length + ' 项待办提醒',
            desc: todayList.slice(0, 2).map(function (r) { return r.title; }).join('、') + (todayList.length > 2 ? ' 等' : ''),
            time: todayList[0].time ? todayList[0].time : '今天',
            count: todayList.length
        });
    }

    // 3. 近 3 天即将到来的提醒
    var upcoming = allReminders.filter(function (r) {
        return !r.done && r.date > todayStr && r.date <= threeDaysLaterStr;
    }).sort(function (a, b) {
        return new Date(a.date) - new Date(b.date);
    });

    if (upcoming.length) {
        items.push({
            type: 'upcoming',
            icon: 'ph ph-calendar-blank',
            color: 'blue',
            title: '近 3 天有 ' + upcoming.length + ' 项提醒',
            desc: upcoming.slice(0, 2).map(function (r) { return r.title + ' (' + relativeTime(r.date) + ')'; }).join('、'),
            time: relativeTime(upcoming[0].date),
            count: upcoming.length
        });
    }

    // 4. 待报价订单
    var pendingQuoteOrders = allOrders.filter(function (o) {
        return o.orderStatus === 'pending';
    });
    if (pendingQuoteOrders.length) {
        items.push({
            type: 'pending-quote',
            icon: 'ph ph-receipt',
            color: 'indigo',
            title: pendingQuoteOrders.length + ' 个订单待报价',
            desc: pendingQuoteOrders.slice(0, 2).map(function (o) { return o.projectName || o.title || '--'; }).join('、'),
            time: '待处理',
            count: pendingQuoteOrders.length
        });
    }

    // 5. 待验收订单
    var acceptanceOrders = allOrders.filter(function (o) {
        return o.orderStatus === 'acceptance';
    });
    if (acceptanceOrders.length) {
        items.push({
            type: 'acceptance',
            icon: 'ph ph-check-circle',
            color: 'emerald',
            title: acceptanceOrders.length + ' 个订单待验收',
            desc: acceptanceOrders.slice(0, 2).map(function (o) { return o.projectName || o.title || '--'; }).join('、'),
            time: '待处理',
            count: acceptanceOrders.length
        });
    }

    var unreadCount = items.reduce(function (sum, item) { return sum + item.count; }, 0);

    return resp.success(res, {
        unreadCount: unreadCount,
        items: items
    });
}));

module.exports = router;
