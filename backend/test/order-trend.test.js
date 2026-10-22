'use strict';

var test = require('node:test');
var assert = require('node:assert/strict');
var trend = require('../src/utils/order-trend');

var today = new Date(2026, 9, 22, 15, 0, 0, 0);

function countsOf(rows) {
    return rows.map(function (row) { return row.count; });
}

test('近 7 天按天补齐，只统计窗口内的下单日和回款', function () {
    var rows = trend.build([
        { orderDate: '2026-10-20', amount: 100, paymentRecords: [{ date: '2026-10-21', amount: 40 }] },
        { orderDate: '2026-10-15', amount: 50 }
    ], { days: 7, today: today });

    assert.equal(rows.length, 7);
    assert.equal(rows[0].fullDate, '2026-10-16');
    assert.equal(rows[0].date, '10-16');
    assert.equal(rows[6].fullDate, '2026-10-22');
    assert.deepEqual(countsOf(rows), [0, 0, 0, 0, 1, 0, 0]);
    assert.equal(rows[5].revenue, 40);
});

test('非法天数回落到近 7 天，30 天返回 30 个点', function () {
    assert.equal(trend.build([], { days: 'nope', today: today }).length, 7);
    assert.equal(trend.build([], { days: 30, today: today }).length, 30);
    assert.equal(trend.normalizeTrendDays('all'), 'all');
});

test('总览在三个月以内按天连成一条线，并补上没有订单的日期', function () {
    var rows = trend.build([
        { orderDate: '2026-10-01' },
        { orderDate: '2026-10-01' },
        { orderDate: '2026-10-22' }
    ], { days: 'all', today: today });

    assert.equal(rows.length, 22);
    assert.equal(rows[0].date, '10-01');
    assert.equal(rows[0].count, 2);
    assert.equal(rows[21].count, 1);
    assert.equal(rows[1].count, 0);
});

test('总览跨年且不超过 92 天时，横轴带上年份', function () {
    var rows = trend.build([
        { orderDate: '2025-12-20' }
    ], { days: 'all', today: new Date(2026, 0, 10, 12, 0, 0, 0) });

    assert.equal(rows[0].date, '25-12-20');
    assert.equal(rows[rows.length - 1].fullDate, '2026-01-10');
    assert.ok(rows.length <= 92);
});

test('总览超过 92 天改为按月，空月份补 0，未来日期不拉长横轴', function () {
    var rows = trend.build([
        { orderDate: '2026-01-05', amount: 200, paymentRecords: [{ date: '2026-02-02', amount: 80 }] },
        { orderDate: '2026-01-20' },
        { orderDate: '2027-03-01' }
    ], { days: 'all', today: today });

    assert.equal(rows[0].fullDate, '2026-01');
    assert.equal(rows[rows.length - 1].fullDate, '2026-10');
    assert.equal(rows.length, 10);
    assert.equal(rows[0].count, 2);
    assert.equal(rows[1].count, 0);
    assert.equal(rows[1].revenue, 80);
});
