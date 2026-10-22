'use strict';

var test = require('node:test');
var assert = require('node:assert/strict');
var rules = require('../src/utils/order-rules');

test('order payment helpers calculate paid amount and cost consistently', function () {
    assert.equal(rules.paidAmount({ amount: 1000, paymentStatus: '未付款' }), 0);
    assert.equal(rules.paidAmount({ amount: 1000, paymentStatus: '部分付款', paymentRatio: 50 }), 500);
    assert.equal(rules.paidCost({ cost: 300, paymentStatus: '部分付款', paymentRatio: 50 }), 150);
    assert.equal(rules.paidAmount({ amount: 1000, paymentStatus: '部分付款', paymentRatio: 150 }), 1000);
    assert.equal(rules.paidAmount({ amount: 1000, paymentStatus: '已结清' }), 1000);
    assert.equal(rules.sumPaidAmount([
        { amount: 1000, paymentStatus: '部分付款', paymentRatio: 50 },
        { amount: 300, paymentStatus: '未付款' },
        { amount: 200, paymentStatus: '已结清' }
    ]), 700);
});

test('付款记录负数金额夹成 0，与前端预览口径一致', function () {
    var records = rules.normalizePaymentRecords([
        { date: '2026-01-01', amount: -100, note: '退款' },
        { date: '2026-01-02', amount: '80' }
    ]);
    assert.equal(records[0].amount, 0);
    assert.equal(records[1].amount, 80);
    assert.equal(rules.paymentRecordAmount({ paymentRecords: records }), 80);
});

test('active processing excludes overdue and terminal orders', function () {
    var today = new Date(2026, 6, 13);

    assert.equal(rules.isActiveProcessing({
        orderStatus: 'processing',
        finalDate: '2026-07-14'
    }, today), true);

    assert.equal(rules.isActiveProcessing({
        orderStatus: 'processing',
        finalDate: '2026-07-12'
    }, today), false);

    assert.equal(rules.isOverdue({
        orderStatus: 'completed',
        finalDate: '2026-07-12'
    }, today), false);

    assert.equal(rules.isDueToday({
        orderStatus: 'processing',
        finalDate: '2026-07-13'
    }, today), true);
});
