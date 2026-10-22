/**
 * 订单载荷构建器测试（创建 / 更新的白名单 + 归一化 + 校验）
 *
 * 锁死的问题：
 *   1. PUT 以前是 `Object.assign({}, body)` 直接当 patch，请求体带 id 就能
 *      把记录改成另一个 id（原 id 查不到 = 订单"凭空消失"；新 id 若已存在 = 两条同 id）；
 *   2. PUT 完全没有校验，能把成交金额改成 0、客户昵称清空、状态改成字典外的值；
 *   3. POST 与 PUT 各写一套字段处理，越走越远。
 *
 * 纯函数测试，不起服务、不碰 backend/data。
 */
'use strict';

var test = require('node:test');
var assert = require('node:assert/strict');

var orderPayload = require('../src/utils/order-payload');
var buildCreatePayload = orderPayload.buildCreatePayload;
var buildUpdatePayload = orderPayload.buildUpdatePayload;

function isPayloadError(field, messagePart) {
    return function (err) {
        assert.equal(err.name, 'OrderPayloadError');
        assert.equal(err.status, 400);
        if (field) assert.equal(err.field, field);
        if (messagePart) assert.match(err.message, new RegExp(messagePart));
        return true;
    };
}

function validBody() {
    return {
        customerNick: '张先生',
        projectType: '网站开发',
        projectName: '企业官网',
        amount: 1000,
        orderDate: '2026-10-01'
    };
}

// ========== 创建 ==========

test('创建：必填齐全时补全默认值', function () {
    var built = buildCreatePayload(validBody());
    var p = built.payload;

    assert.equal(p.customerNick, '张先生');
    assert.equal(p.amount, 1000);
    assert.equal(p.orderStatus, 'pending');
    assert.equal(p.paymentStatus, '未付款');
    assert.equal(p.paymentRatio, 0);
    assert.equal(p.customerSource, '其他');
    assert.deepEqual(p.customerTags, []);
    assert.deepEqual(p.paymentRecords, []);
    assert.deepEqual(p.uploadedFiles, {
        screenshot: null, showcase: null, quote: null, taskBook: null, paymentRecord: []
    });
    assert.deepEqual(built.ignored, []);
});

test('创建：缺必填项各自报错，且带 field', function () {
    var cases = [
        ['customerNick', '客户昵称'],
        ['projectType', '项目类型'],
        ['projectName', '项目名称'],
        ['orderDate', '接单日期']
    ];
    cases.forEach(function (pair) {
        var body = validBody();
        delete body[pair[0]];
        assert.throws(function () { buildCreatePayload(body); }, isPayloadError(pair[0], pair[1]));
    });
});

test('创建：金额必须大于 0（0 / 负数 / 非数字 / 空串都拒绝）', function () {
    [0, -1, 'abc', '', null].forEach(function (amount) {
        var body = validBody();
        body.amount = amount;
        assert.throws(function () { buildCreatePayload(body); }, isPayloadError('amount', '大于 0'));
    });
});

test('创建：id / createdAt / orderNo 一律不进载荷，并回报为 ignored', function () {
    var body = validBody();
    body.id = 'hacked';
    body.createdAt = '1999-01-01T00:00:00.000Z';
    body.updatedAt = '1999-01-01T00:00:00.000Z';
    body.orderNo = 'HACKED-001';

    var built = buildCreatePayload(body);
    assert.equal(built.payload.id, undefined);
    assert.equal(built.payload.createdAt, undefined);
    assert.equal(built.payload.updatedAt, undefined);
    assert.equal(built.payload.orderNo, undefined);
    ['id', 'createdAt', 'updatedAt', 'orderNo'].forEach(function (key) {
        assert.ok(built.ignored.indexOf(key) !== -1, key + ' 应出现在 ignored 里');
    });
});

test('创建：未知字段被丢弃并回报', function () {
    var body = validBody();
    body.__protoHack = 'x';
    body.paymentRatioHacked = 999;

    var built = buildCreatePayload(body);
    assert.equal(built.payload.__protoHack, undefined);
    assert.equal(built.payload.paymentRatioHacked, undefined);
    assert.deepEqual(built.ignored.sort(), ['__protoHack', 'paymentRatioHacked']);
});

test('创建：状态取值非法直接拒绝', function () {
    var body = validBody();
    body.orderStatus = '不存在的状态';
    assert.throws(function () { buildCreatePayload(body); }, isPayloadError('orderStatus', '订单状态取值非法'));

    body = validBody();
    body.paymentStatus = '随便付付';
    assert.throws(function () { buildCreatePayload(body); }, isPayloadError('paymentStatus', '付款状态取值非法'));
});

test('创建：付款比例由打款记录推导，不信任客户端传的值', function () {
    var body = validBody();
    body.amount = 1000;
    body.paymentStatus = '部分付款';
    body.paymentRatio = 99;   // 客户端乱填
    body.paymentRecords = [{ date: '2026-10-02', amount: 300 }];

    var built = buildCreatePayload(body);
    assert.equal(built.payload.paymentRatio, 30);
    assert.equal(built.payload.paymentRecords.length, 1);
});

test('创建：未付款时清空打款记录、比例归零', function () {
    var body = validBody();
    body.paymentStatus = '未付款';
    body.paymentRecords = [{ date: '2026-10-02', amount: 300 }];
    body.paymentRatio = 50;

    var built = buildCreatePayload(body);
    assert.equal(built.payload.paymentRatio, 0);
    assert.deepEqual(built.payload.paymentRecords, []);
});

test('创建：客户标签去空白去重、附件归一化', function () {
    var body = validBody();
    body.customerTags = [' 爽快型 ', '爽快型', '', null, '急单'];
    body.uploadedFiles = {
        screenshot: { name: 'a.png', url: '/uploads/a.png' },
        showcase: {},
        paymentRecord: [{ name: 'p1.png', url: '/uploads/p1.png' }, null]
    };

    var built = buildCreatePayload(body);
    assert.deepEqual(built.payload.customerTags, ['爽快型', '急单']);
    assert.equal(built.payload.uploadedFiles.screenshot.name, 'a.png');
    assert.equal(built.payload.uploadedFiles.showcase, null);
    assert.equal(built.payload.uploadedFiles.paymentRecord.length, 1);
});

// ========== 更新 ==========

function existingOrder(overrides) {
    return Object.assign({
        id: 'order-1',
        orderNo: 'DD20261001001',
        createdAt: '2026-10-01T00:00:00.000Z',
        updatedAt: '2026-10-01T00:00:00.000Z',
        customerNick: '张先生',
        projectType: '网站开发',
        projectName: '企业官网',
        amount: 1000,
        orderDate: '2026-10-01',
        orderStatus: 'processing',
        paymentStatus: '未付款',
        paymentRatio: 0,
        payDate: '',
        paymentRecords: []
    }, overrides || {});
}

test('更新：patch 只包含请求里真正给出的字段', function () {
    var built = buildUpdatePayload({ projectName: '新名字' }, existingOrder());
    assert.equal(built.patch.projectName, '新名字');
    assert.equal(Object.prototype.hasOwnProperty.call(built.patch, 'customerNick'), false);
    assert.equal(Object.prototype.hasOwnProperty.call(built.patch, 'amount'), false);
});

test('更新：patch 里绝不出现 id / createdAt / updatedAt / orderNo', function () {
    var built = buildUpdatePayload({
        id: 'hacked',
        createdAt: '1999-01-01T00:00:00.000Z',
        updatedAt: '1999-01-01T00:00:00.000Z',
        orderNo: 'HACKED-001',
        projectName: '改名'
    }, existingOrder());

    assert.equal(built.patch.id, undefined);
    assert.equal(built.patch.createdAt, undefined);
    assert.equal(built.patch.updatedAt, undefined);
    assert.equal(built.patch.orderNo, undefined);
    assert.equal(built.patch.projectName, '改名');
    assert.deepEqual(built.ignored.sort(), ['createdAt', 'id', 'orderNo', 'updatedAt']);
});

test('更新：不能把必填项改成空 / 0', function () {
    assert.throws(function () {
        buildUpdatePayload({ customerNick: '' }, existingOrder());
    }, isPayloadError('customerNick'));

    assert.throws(function () {
        buildUpdatePayload({ projectName: '   ' }, existingOrder());
    }, isPayloadError('projectName'));

    assert.throws(function () {
        buildUpdatePayload({ amount: 0 }, existingOrder());
    }, isPayloadError('amount', '大于 0'));

    assert.throws(function () {
        buildUpdatePayload({ orderDate: '' }, existingOrder());
    }, isPayloadError('orderDate'));
});

test('更新：状态取值非法直接拒绝', function () {
    assert.throws(function () {
        buildUpdatePayload({ orderStatus: 'done' }, existingOrder());
    }, isPayloadError('orderStatus'));
});

test('更新：历史脏数据不阻塞其他字段编辑（只校验本次提供的字段）', function () {
    var dirty = existingOrder({ projectName: '', amount: 0 });
    // 改一个无关字段应当放行
    var built = buildUpdatePayload({ projectDesc: '补充说明' }, dirty);
    assert.equal(built.patch.projectDesc, '补充说明');
    // 但主动把必填项改成空仍然要拒绝
    assert.throws(function () {
        buildUpdatePayload({ projectName: '' }, dirty);
    }, isPayloadError('projectName'));
});

test('更新：改金额后付款比例按 merge 后的记录重算', function () {
    var existing = existingOrder({
        amount: 1000,
        paymentStatus: '部分付款',
        paymentRecords: [{ date: '2026-10-02', amount: 300 }]
    });
    var built = buildUpdatePayload({ amount: 500 }, existing);
    assert.equal(built.patch.paymentRatio, 60);
});

test('更新：附件归一化后写入（空对象不会变成脏数据）', function () {
    var built = buildUpdatePayload({
        uploadedFiles: { quote: { name: 'q.pdf', url: '/uploads/q.pdf' }, taskBook: {} }
    }, existingOrder());
    assert.equal(built.patch.uploadedFiles.quote.name, 'q.pdf');
    assert.equal(built.patch.uploadedFiles.taskBook, null);
    assert.deepEqual(built.patch.uploadedFiles.paymentRecord, []);
});

test('更新：空请求体只重算付款字段，不改业务字段', function () {
    var built = buildUpdatePayload({}, existingOrder());
    var keys = Object.keys(built.patch).sort();
    assert.deepEqual(keys, ['payDate', 'paymentRatio', 'paymentRecords', 'paymentStatus']);
});
