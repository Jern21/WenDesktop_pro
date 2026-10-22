'use strict';

var orderRules = require('./order-rules');

function normalizeStatsRange(req, defaultRange) {
    var range = ((req.query && (req.query.range || req.query.period)) || defaultRange || 'all').toLowerCase();
    if (['all', 'month', 'year'].indexOf(range) === -1) range = defaultRange || 'all';
    return range;
}

function createRangeMeta(range) {
    var today = new Date();
    var todayStr = orderRules.localDateStr(today);
    var thisMonth = todayStr.substring(0, 7);
    var lastMonth = orderRules.localDateStr(new Date(today.getFullYear(), today.getMonth() - 1, 1)).substring(0, 7);
    var thisYear = String(today.getFullYear());
    var lastYear = String(today.getFullYear() - 1);
    var labelMap = { all: '全量汇总', month: thisMonth, year: thisYear };
    return {
        range: range,
        label: labelMap[range] || labelMap.all,
        thisMonth: thisMonth,
        lastMonth: lastMonth,
        thisYear: thisYear,
        lastYear: lastYear
    };
}

function matchRangeDate(dateStr, meta, previous) {
    if (!dateStr) return false;
    if (meta.range === 'all') return !previous;
    if (meta.range === 'month') return String(dateStr).startsWith(previous ? meta.lastMonth : meta.thisMonth);
    if (meta.range === 'year') return String(dateStr).startsWith(previous ? meta.lastYear : meta.thisYear);
    return false;
}

function ledgerRangeMeta(range) {
    return { range: range, thisYear: String(new Date().getFullYear()) };
}

function ledgerInRange(dateStr, meta) {
    if (!dateStr) return false;
    if (meta.range === 'all') return true;
    return String(dateStr).indexOf(meta.thisYear) === 0;
}

module.exports = {
    normalizeStatsRange: normalizeStatsRange,
    createRangeMeta: createRangeMeta,
    matchRangeDate: matchRangeDate,
    ledgerRangeMeta: ledgerRangeMeta,
    ledgerInRange: ledgerInRange
};
