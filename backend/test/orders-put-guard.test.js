/**
 * PUT /api/orders/:id 防篡改回归测试（接口级）
 *
 * 走真实 HTTP（随机端口 + 独立临时数据目录），验证：
 *   1. 请求体里塞 id / createdAt / orderNo 不会写进数据文件；
 *   2. 塞 id 之后原记录仍能按原 id 查到，记录总数不变（不会"凭空消失"或产生同 id）；
 *   3. 金额 / 必填项 / 状态取值非法时返回 400（不是 500），且盘上数据一个字节都不变；
 *   4. 正常的部分更新仍然工作，未提交的字段保持不变。
 *
 * 用 port 0 拿系统分配的端口：固定端口 + 上一次测试的子进程残留，
 * 会导致新进程绑不上而探针连到旧进程（这个坑已经踩过一次，表现为"测试假失败/假通过"）。
 */
'use strict';

var fs = require('fs');
var os = require('os');
var path = require('path');
var test = require('node:test');
var assert = require('node:assert/strict');

var TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'orders-put-guard-'));
process.env.APP_DATA_DIR = TMP;

var express = require('express');
var ordersRouter = require('../src/routes/orders');

var app = express();
app.use(express.json());
app.use('/api/orders', ordersRouter);

var server = null;
var base = '';
var createdId = null;

test.before(function () {
    return new Promise(function (resolve, reject) {
        server = app.listen(0, '127.0.0.1', function () {
            base = 'http://127.0.0.1:' + server.address().port;
            resolve();
        });
        server.on('error', reject);
    });
});

test.after(function () {
    return new Promise(function (resolve) {
        if (!server) return resolve();
        server.close(function () { resolve(); });
    });
});

function request(method, url, body) {
    var options = { method: method, headers: {} };
    if (body !== undefined) {
        options.headers['Content-Type'] = 'application/json';
        options.body = JSON.stringify(body);
    }
    return fetch(base + url, options).then(function (res) {
        return res.json().then(function (json) {
            return { status: res.status, body: json };
        });
    });
}

function ordersOnDisk() {
    var file = path.join(TMP, 'orders.json');
    if (!fs.existsSync(file)) return [];
    return JSON.parse(fs.readFileSync(file, 'utf-8'));
}

function orderOnDisk(id) {
    return ordersOnDisk().filter(function (o) { return o.id === id; })[0] || null;
}

function validOrderBody() {
    return {
        customerNick: '张先生',
        projectType: '网站开发',
        projectName: '企业官网',
        amount: 1000,
        orderDate: '2026-10-01'
    };
}

// ========== 创建 ==========

test('POST：服务端字段不接受客户端传入（id / createdAt / orderNo）', function () {
    var body = validOrderBody();
    body.id = 'hacked';
    body.createdAt = '1999-01-01T00:00:00.000Z';
    body.orderNo = 'HACKED-001';

    return request('POST', '/api/orders', body).then(function (r) {
        assert.equal(r.status, 201);
        createdId = r.body.data.id;

        assert.notEqual(r.body.data.id, 'hacked');
        assert.notEqual(r.body.data.createdAt, '1999-01-01T00:00:00.000Z');
        assert.notEqual(r.body.data.orderNo, 'HACKED-001');
        assert.match(r.body.data.orderNo, /^DD\d{11}$/, 'orderNo 应由服务端生成：' + r.body.data.orderNo);

        assert.equal(orderOnDisk('hacked'), null);
        assert.equal(ordersOnDisk().length, 1);
    });
});

test('POST：缺必填项返回 400（不是 500）', function () {
    var body = validOrderBody();
    delete body.customerNick;

    return request('POST', '/api/orders', body).then(function (r) {
        assert.equal(r.status, 400);
        assert.equal(r.body.success, false);
        assert.match(r.body.error, /客户昵称/);
        assert.equal(ordersOnDisk().length, 1, '校验失败不能写入数据文件');
    });
});

// ========== 更新：防篡改 ==========

test('PUT：请求体里带 id 不会把记录改成另一个 id', function () {
    var before = orderOnDisk(createdId);
    assert.ok(before, '前置条件：订单应已存在');

    return request('PUT', '/api/orders/' + createdId, {
        id: 'hijacked-id',
        projectName: '改名成功'
    }).then(function (r) {
        assert.equal(r.status, 200);
        assert.equal(r.body.data.id, createdId, 'id 必须保持不变');
        assert.equal(r.body.data.projectName, '改名成功', '白名单内的字段要正常更新');

        // 盘上：原 id 还在，没有多出一条 hijacked-id
        assert.ok(orderOnDisk(createdId), '原 id 必须仍能查到');
        assert.equal(orderOnDisk('hijacked-id'), null, '不能写入被劫持的 id');
        assert.equal(ordersOnDisk().length, 1, '记录总数不能变');
    });
});

test('PUT：orderNo / createdAt 也不能被覆盖', function () {
    var before = orderOnDisk(createdId);

    return request('PUT', '/api/orders/' + createdId, {
        orderNo: 'DD99999999999',
        createdAt: '1999-01-01T00:00:00.000Z'
    }).then(function (r) {
        assert.equal(r.status, 200);
        assert.equal(r.body.data.orderNo, before.orderNo);
        assert.equal(r.body.data.createdAt, before.createdAt);
    });
});

test('PUT：所有记录的 id 唯一且不为空', function () {
    var all = ordersOnDisk();
    var seen = {};
    all.forEach(function (o) {
        assert.ok(o.id, '记录必须有 id');
        assert.equal(seen[o.id], undefined, '出现重复 id：' + o.id);
        seen[o.id] = true;
    });
});

// ========== 更新：校验 ==========

test('PUT：成交金额不能改成 0 / 负数，且盘上数据不变', function () {
    var snapshot = JSON.stringify(orderOnDisk(createdId));

    return request('PUT', '/api/orders/' + createdId, { amount: 0 }).then(function (r) {
        assert.equal(r.status, 400);
        assert.match(r.body.error, /成交金额/);
        assert.equal(JSON.stringify(orderOnDisk(createdId)), snapshot, '被拒绝的更新不能动盘上数据');

        return request('PUT', '/api/orders/' + createdId, { amount: -5 });
    }).then(function (r) {
        assert.equal(r.status, 400);
        assert.equal(JSON.stringify(orderOnDisk(createdId)), snapshot);
    });
});

test('PUT：必填项不能清空', function () {
    var cases = [
        [{ customerNick: '' }, /客户昵称/],
        [{ projectType: '   ' }, /项目类型/],
        [{ projectName: '' }, /项目名称/],
        [{ orderDate: '' }, /接单日期/]
    ];

    var chain = Promise.resolve();
    cases.forEach(function (pair) {
        chain = chain.then(function () {
            return request('PUT', '/api/orders/' + createdId, pair[0]).then(function (r) {
                assert.equal(r.status, 400, JSON.stringify(pair[0]) + ' 应被拒绝');
                assert.match(r.body.error, pair[1]);
            });
        });
    });
    return chain;
});

test('PUT：状态取值非法返回 400', function () {
    return request('PUT', '/api/orders/' + createdId, { orderStatus: 'done' }).then(function (r) {
        assert.equal(r.status, 400);
        assert.match(r.body.error, /订单状态取值非法/);
    });
});

// ========== 更新：正常路径 ==========

test('PUT：部分更新只改提交的字段，其余保持原样', function () {
    var before = orderOnDisk(createdId);

    return request('PUT', '/api/orders/' + createdId, {
        projectDesc: '补充一句说明',
        orderStatus: 'processing'
    }).then(function (r) {
        assert.equal(r.status, 200);
        assert.equal(r.body.data.projectDesc, '补充一句说明');
        assert.equal(r.body.data.orderStatus, 'processing');
        assert.equal(r.body.data.customerNick, before.customerNick);
        assert.equal(r.body.data.amount, before.amount);
        assert.equal(r.body.data.orderDate, before.orderDate);
    });
});

test('PUT：改金额后付款比例按打款记录重算', function () {
    return request('PUT', '/api/orders/' + createdId, {
        amount: 1000,
        paymentStatus: '部分付款',
        paymentRecords: [{ date: '2026-10-02', amount: 300 }]
    }).then(function (r) {
        assert.equal(r.status, 200);
        assert.equal(r.body.data.paymentRatio, 30);

        return request('PUT', '/api/orders/' + createdId, { amount: 500 });
    }).then(function (r) {
        assert.equal(r.status, 200);
        assert.equal(r.body.data.paymentRatio, 60, '300 / 500 = 60%');
    });
});

test('PUT：不存在的订单返回 404', function () {
    return request('PUT', '/api/orders/not-exist-id', { projectName: 'x' }).then(function (r) {
        assert.equal(r.status, 404);
    });
});
