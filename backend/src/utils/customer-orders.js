/**
 * 客户 ↔ 订单 关联规则
 *
 * 单独成模块的原因：这是一条会被多处依赖的**数据归属规则**
 * （客户列表的消费额、客户详情的订单列表、跟进统计都吃它的结果），
 * 但它写在路由文件里是模块私有的，没法单独测 —— 之前只能靠人眼看。
 *
 * 规则：
 *   1. 订单显式带 customerId 时，**只认这个 ID**。
 *      以前 ID 对不上还会继续走名称匹配，于是两个同名客户、或者客户改名后
 *      遗留的旧订单，会同时算进两边：消费额翻倍、订单数翻倍，
 *      客户详情里还能点开不属于自己的订单。
 *   2. 没绑定 ID 的历史订单，才退回按 昵称 / 姓名 / 电话 匹配。
 */
'use strict';

function toText(value) {
    return String(value === undefined || value === null ? '' : value).trim();
}

/**
 * 统计用的客户身份键。
 *
 * 有 customerId 时只认 ID，避免两个同名客户被合成一个人。
 * 没有 ID 的历史单才退回「昵称+电话」；有 ID 的单和没 ID 的同名单也不合并，
 * 否则会把别人的订单算进复购。
 */
function orderCustomerKey(order) {
    if (!order) return '';
    var id = toText(order.customerId);
    if (id) return 'id:' + id;

    var nick = toText(order.customerNick || order.customerName || order.customer);
    var phone = toText(order.customerPhone);
    if (nick && phone) return 'legacy:' + nick + '|' + phone;
    if (nick) return 'legacy:nick:' + nick;
    if (phone) return 'legacy:phone:' + phone;
    return '';
}

function uniqueCustomerCount(list) {
    var seen = {};
    (list || []).forEach(function (o) {
        var key = orderCustomerKey(o);
        if (key) seen[key] = true;
    });
    return Object.keys(seen).length;
}

function repeatRate(list) {
    var counts = {};
    (list || []).forEach(function (o) {
        var key = orderCustomerKey(o);
        if (!key) return;
        counts[key] = (counts[key] || 0) + 1;
    });
    var keys = Object.keys(counts);
    if (!keys.length) return 0;
    var repeat = keys.filter(function (k) { return counts[k] >= 2; }).length;
    return Math.round(repeat / keys.length * 100);
}

/**
 * 找出属于某个客户的订单，按日期倒序。
 *
 * @param {Object} customer
 * @param {Array<Object>} allOrders
 * @returns {Array<Object>}
 */
function matchOrders(customer, allOrders) {
    customer = customer || {};
    var customerId = toText(customer.id);
    var name = toText(customer.name);
    var phone = toText(customer.phone);

    return (allOrders || []).filter(function (o) {
        if (!o) return false;

        // 已绑定客户 ID：以 ID 为唯一依据
        if (o.customerId) return toText(o.customerId) === customerId;

        // 未绑定 ID 的历史订单才退回名称/电话匹配
        var nick = toText(o.customerNick);
        var cname = toText(o.customerName);
        var ophone = toText(o.customerPhone);
        return !!((name && (nick === name || cname === name)) || (phone && ophone && phone === ophone));
    }).sort(function (a, b) {
        return String(b.orderDate || b.createdAt || '').localeCompare(String(a.orderDate || a.createdAt || ''));
    });
}

module.exports = {
    matchOrders: matchOrders,
    orderCustomerKey: orderCustomerKey,
    uniqueCustomerCount: uniqueCustomerCount,
    repeatRate: repeatRate
};
