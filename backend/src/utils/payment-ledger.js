'use strict';

var orderRules = require('./order-rules');

function paymentCostForEntry(order, entry) {
    var amount = parseFloat(order && order.amount) || 0;
    var cost = parseFloat(order && order.cost) || 0;
    var paid = parseFloat(entry && entry.amount) || 0;
    if (amount <= 0 || cost <= 0 || paid <= 0) return 0;
    return Math.min(cost, cost * Math.min(paid / amount, 1));
}

function eachPaymentEntry(allOrders, iterator) {
    (allOrders || []).forEach(function (order) {
        orderRules.paymentEntries(order).forEach(function (entry) {
            var date = entry && entry.date ? String(entry.date).slice(0, 10) : '';
            if (!date) return;
            iterator(order, {
                date: date,
                amount: parseFloat(entry.amount) || 0,
                note: entry.note || ''
            });
        });
    });
}

module.exports = {
    paymentCostForEntry: paymentCostForEntry,
    eachPaymentEntry: eachPaymentEntry
};
