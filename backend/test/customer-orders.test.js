/**
 * 客户 ↔ 订单 关联规则测试
 *
 * 锁死的问题：订单已显式绑定 customerId 时，旧实现只要 ID 对不上就继续走
 * 名称/电话匹配，于是「两个同名客户」或「客户改名后遗留的旧昵称订单」
 * 会被同时算进两边 —— 消费额翻倍、订单数翻倍，
 * 客户详情里还能点开不属于自己的订单。
 */
'use strict';

var test = require('node:test');
var assert = require('node:assert/strict');

var customerOrders = require('../src/utils/customer-orders');
var matchOrders = customerOrders.matchOrders;
var uniqueCustomerCount = customerOrders.uniqueCustomerCount;
var repeatRate = customerOrders.repeatRate;

var CUSTOMER_A = { id: 'cust-a', name: '张先生', phone: '13800000001' };
var CUSTOMER_B = { id: 'cust-b', name: '张先生', phone: '13800000002' }; // 同名，不同 ID

test('绑定了 customerId 的订单只认 ID，不因同名算到别的客户头上', function () {
    var orders = [
        { id: 'o1', customerId: 'cust-a', customerNick: '张先生', customerPhone: '13800000001' }
    ];
    assert.equal(matchOrders(CUSTOMER_A, orders).length, 1);
    assert.equal(matchOrders(CUSTOMER_B, orders).length, 0);
});

test('ID 明确指向别人的订单，即使昵称/电话一样也不能挂过来', function () {
    var orders = [
        // 昵称和电话都像 A，但绑定的是 B
        { id: 'o1', customerId: 'cust-b', customerNick: '张先生', customerPhone: '13800000001' }
    ];
    assert.equal(matchOrders(CUSTOMER_A, orders).length, 0);
    assert.equal(matchOrders(CUSTOMER_B, orders).length, 1);
});

test('未绑定 ID 的历史订单仍按昵称匹配', function () {
    var orders = [
        { id: 'o1', customerId: '', customerNick: '张先生' },
        { id: 'o2', customerNick: '张先生' },              // 字段缺失等同未绑定
        { id: 'o3', customerId: null, customerName: '张先生' },
        { id: 'o4', customerNick: '李女士' }
    ];
    var matched = matchOrders(CUSTOMER_A, orders).map(function (o) { return o.id; });
    assert.deepEqual(matched.sort(), ['o1', 'o2', 'o3']);
});

test('未绑定 ID 的订单按电话兜底匹配', function () {
    var orders = [
        { id: 'o1', customerNick: '别的昵称', customerPhone: '13800000002' }
    ];
    // A 的电话是 ...0001，不该匹配；B 的电话是 ...0002
    assert.equal(matchOrders(CUSTOMER_A, orders).length, 0);
    assert.equal(matchOrders(CUSTOMER_B, orders).length, 1);
});

test('同名客户各算各的：ID 绑定优先，未绑定的才两边都算', function () {
    var orders = [
        { id: 'o-bound-a', customerId: 'cust-a', customerNick: '张先生' },
        { id: 'o-bound-b', customerId: 'cust-b', customerNick: '张先生' },
        { id: 'o-legacy', customerNick: '张先生' }         // 无 ID，两边都算（历史数据的已知代价）
    ];
    var a = matchOrders(CUSTOMER_A, orders).map(function (o) { return o.id; }).sort();
    var b = matchOrders(CUSTOMER_B, orders).map(function (o) { return o.id; }).sort();
    assert.deepEqual(a, ['o-bound-a', 'o-legacy']);
    assert.deepEqual(b, ['o-bound-b', 'o-legacy']);
});

test('客户已删除（ID 不存在）时，绑定过它的订单不会再挂到任何客户名下', function () {
    var orders = [
        { id: 'o1', customerId: 'cust-deleted', customerNick: '张先生', customerPhone: '13800000001' }
    ];
    assert.equal(matchOrders(CUSTOMER_A, orders).length, 0);
    assert.equal(matchOrders(CUSTOMER_B, orders).length, 0);
});

test('结果按日期倒序（缺失 orderDate 时退回 createdAt）', function () {
    var orders = [
        { id: 'old', customerId: 'cust-a', orderDate: '2026-01-01' },
        { id: 'new', customerId: 'cust-a', orderDate: '2026-09-01' },
        { id: 'ct', customerId: 'cust-a', createdAt: '2026-12-01T00:00:00.000Z' }
    ];
    var ids = matchOrders(CUSTOMER_A, orders).map(function (o) { return o.id; });
    assert.deepEqual(ids, ['ct', 'new', 'old']);
});

test('入参健壮性：空订单数组 / 空客户对象都不抛', function () {
    assert.deepEqual(matchOrders(CUSTOMER_A, []), []);
    assert.deepEqual(matchOrders(CUSTOMER_A, null), []);
    assert.deepEqual(matchOrders(null, [{ id: 'o1', customerNick: '张先生' }]), []);
});

test('统计去重：同名但不同 customerId 算两个客户', function () {
    var orders = [
        { customerId: 'cust-a', customerNick: '张先生' },
        { customerId: 'cust-b', customerNick: '张先生' }
    ];
    assert.equal(uniqueCustomerCount(orders), 2);
    assert.equal(repeatRate(orders), 0);
});

test('统计去重：有 ID 的订单不和同名无 ID 历史单合并', function () {
    var orders = [
        { customerId: 'cust-a', customerNick: '张先生' },
        { customerId: '', customerNick: '张先生' }
    ];
    assert.equal(uniqueCustomerCount(orders), 2);
});

test('统计去重：两张无 ID 的同名同电话历史单算同一个人', function () {
    var orders = [
        { customerNick: '张先生', customerPhone: '13800000001' },
        { customerNick: '张先生', customerPhone: '13800000001' }
    ];
    assert.equal(uniqueCustomerCount(orders), 1);
    assert.equal(repeatRate(orders), 100);
});
