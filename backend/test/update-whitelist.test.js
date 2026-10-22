/**
 * 客户 / 海报 PUT 白名单：请求体带 id 不能改身份字段，聚合字段不能被覆盖。
 */
'use strict';

var fs = require('fs');
var os = require('os');
var path = require('path');
var test = require('node:test');
var assert = require('node:assert/strict');

var TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'update-whitelist-'));
process.env.APP_DATA_DIR = TMP;

var express = require('express');
var customersRouter = require('../src/routes/customers');
var postersRouter = require('../src/routes/posters');

var app = express();
app.use(express.json());
app.use('/api/customers', customersRouter);
app.use('/api/posters', postersRouter);

var server = null;
var base = '';
var customerId = null;
var posterId = null;

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

function readJson(name) {
    var file = path.join(TMP, name + '.json');
    if (!fs.existsSync(file)) return [];
    return JSON.parse(fs.readFileSync(file, 'utf-8'));
}

test('客户 PUT：id / 消费聚合字段不能被请求体改掉', function () {
    return request('POST', '/api/customers', { name: '客户A', phone: '13800000001' }).then(function (created) {
        assert.equal(created.status, 201);
        customerId = created.body.data.id;
        var createdAt = created.body.data.createdAt;

        return request('PUT', '/api/customers/' + customerId, {
            id: 'hijacked',
            createdAt: '1999-01-01T00:00:00.000Z',
            name: '客户A改名',
            orderCount: 99,
            totalAmount: '¥ 99999',
            amount: '¥ 99999',
            firstDeal: '1999-01-01'
        }).then(function (r) {
            assert.equal(r.status, 200);
            assert.equal(r.body.data.id, customerId);
            assert.equal(r.body.data.name, '客户A改名');
            assert.equal(r.body.data.orderCount, 0);
            assert.notEqual(r.body.data.createdAt, '1999-01-01T00:00:00.000Z');

            var onDisk = readJson('customers').filter(function (c) { return c.id === customerId; })[0];
            assert.ok(onDisk);
            assert.equal(onDisk.id, customerId);
            assert.equal(onDisk.createdAt, createdAt);
            assert.equal(onDisk.orderCount, 0);
            assert.equal(readJson('customers').filter(function (c) { return c.id === 'hijacked'; }).length, 0);
        });
    });
});

test('客户 PUT：姓名不能改成空', function () {
    return request('PUT', '/api/customers/' + customerId, { name: '  ' }).then(function (r) {
        assert.equal(r.status, 400);
        assert.match(r.body.error, /客户姓名/);
        var onDisk = readJson('customers').filter(function (c) { return c.id === customerId; })[0];
        assert.equal(onDisk.name, '客户A改名');
    });
});

test('海报 PUT：id 不能被覆盖，标题不能清空', function () {
    return request('POST', '/api/posters', {
        title: '春季海报',
        platform: 'xiaohongshu'
    }).then(function (created) {
        assert.equal(created.status, 201);
        posterId = created.body.data.id;

        return request('PUT', '/api/posters/' + posterId, {
            id: 'poster-hijack',
            title: '春季海报改',
            unknownField: 'drop-me'
        }).then(function (r) {
            assert.equal(r.status, 200);
            assert.equal(r.body.data.id, posterId);
            assert.equal(r.body.data.title, '春季海报改');
            assert.equal(r.body.data.unknownField, undefined);

            var onDisk = readJson('posters').filter(function (p) { return p.id === posterId; })[0];
            assert.equal(onDisk.id, posterId);
            assert.equal(Object.prototype.hasOwnProperty.call(onDisk, 'unknownField'), false);

            return request('PUT', '/api/posters/' + posterId, { title: '' });
        }).then(function (r) {
            assert.equal(r.status, 400);
            assert.match(r.body.error, /海报标题/);
        });
    });
});
