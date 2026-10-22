/**
 * 首页「订单趋势」的时间桶。
 *
 * days=7 / 30：从今天往前数，按天补零。
 * days=all：从最早一笔有效日期到今天。间隔不超过 92 天时仍按天；
 * 再长就按月，否则横轴会密到看不清，而且多年的 MM-DD 会重复。
 */
'use strict';

var orderRules = require('./order-rules');
var paymentLedger = require('./payment-ledger');

var localDateStr = orderRules.localDateStr;
var MONTHLY_AFTER_DAYS = 92;
var EARLIEST_DATE = '2000-01-01';

function normalizeTrendDays(value) {
    if (value === 'all') return 'all';
    return parseInt(value, 10) === 30 ? 30 : 7;
}

function isDayKey(value) {
    return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && value >= EARLIEST_DATE;
}

function addDays(date, days) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days, 12, 0, 0, 0);
}

function daySpan(startKey, endKey) {
    var start = orderRules.parseLocalDate(startKey);
    var end = orderRules.parseLocalDate(endKey);
    return Math.round((end.getTime() - start.getTime()) / 86400000);
}

function collectBoundDates(allOrders, todayKey) {
    var earliest = '';

    function consider(value) {
        var key = String(value || '').slice(0, 10);
        if (!isDayKey(key) || key > todayKey) return;
        if (!earliest || key < earliest) earliest = key;
    }

    (allOrders || []).forEach(function (order) {
        consider(order && order.orderDate);
    });
    paymentLedger.eachPaymentEntry(allOrders, function (_order, entry) {
        consider(entry.date);
    });

    return earliest;
}

function fillCounts(buckets, keyOf) {
    return function (allOrders) {
        (allOrders || []).forEach(function (order) {
            var key = keyOf(order && order.orderDate);
            if (buckets[key]) buckets[key].count++;
        });
        paymentLedger.eachPaymentEntry(allOrders, function (_order, entry) {
            var key = keyOf(entry.date);
            if (buckets[key]) buckets[key].revenue += entry.amount;
        });
    };
}

function buildDaily(allOrders, startKey, endKey, labelOf) {
    var buckets = {};
    var keys = [];
    var cursor = orderRules.parseLocalDate(startKey);
    var guard = 0;

    while (guard < 4000) {
        var key = localDateStr(cursor);
        keys.push(key);
        buckets[key] = { date: labelOf(key, startKey, endKey), fullDate: key, revenue: 0, count: 0 };
        if (key === endKey) break;
        cursor = addDays(cursor, 1);
        guard++;
    }

    fillCounts(buckets, function (value) {
        var key = String(value || '').slice(0, 10);
        return isDayKey(key) ? key : '';
    })(allOrders);

    return keys.map(function (key) { return buckets[key]; });
}

function buildMonthly(allOrders, startKey, endKey) {
    var buckets = {};
    var keys = [];
    var cursor = orderRules.parseLocalDate(startKey.slice(0, 7) + '-01');
    var endMonth = endKey.slice(0, 7);
    var guard = 0;

    while (guard < 600) {
        var key = localDateStr(cursor).slice(0, 7);
        keys.push(key);
        buckets[key] = { date: key, fullDate: key, revenue: 0, count: 0 };
        if (key === endMonth) break;
        cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1, 12, 0, 0, 0);
        guard++;
    }

    fillCounts(buckets, function (value) {
        var key = String(value || '').slice(0, 10);
        return isDayKey(key) ? key.slice(0, 7) : '';
    })(allOrders);

    return keys.map(function (key) { return buckets[key]; });
}

function recentDayLabel(key) {
    return key.substring(5);
}

function allTimeDayLabel(key, startKey, endKey) {
    if (startKey.slice(0, 4) !== endKey.slice(0, 4)) return key.slice(2);
    return key.substring(5);
}

/**
 * @param {Array} allOrders
 * @param {{ days?: string|number, today?: Date }} options
 * @returns {Array<{date: string, fullDate: string, revenue: number, count: number}>}
 */
function build(allOrders, options) {
    var opts = options || {};
    var mode = normalizeTrendDays(opts.days);
    var today = opts.today instanceof Date ? opts.today : new Date();
    var todayKey = localDateStr(today);

    if (mode !== 'all') {
        var start = addDays(today, -(mode - 1));
        return buildDaily(allOrders, localDateStr(start), todayKey, recentDayLabel);
    }

    var earliest = collectBoundDates(allOrders, todayKey) || todayKey;
    if (daySpan(earliest, todayKey) > MONTHLY_AFTER_DAYS) {
        return buildMonthly(allOrders, earliest, todayKey);
    }
    return buildDaily(allOrders, earliest, todayKey, allTimeDayLabel);
}

module.exports = {
    build: build,
    normalizeTrendDays: normalizeTrendDays
};
