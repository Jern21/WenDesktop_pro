/**
 * 同一个仓储在请求交错时必须仍读写发起请求的那个用户。
 * 进程级 currentUsername 做不到这一点：A 让出执行权后，B 的 enter/leave
 * 会把 A 的后续写入带到 B 或根目录。
 */
'use strict';

var fs = require('fs');
var os = require('os');
var path = require('path');
var test = require('node:test');
var assert = require('node:assert/strict');

var TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'user-scope-async-'));
process.env.APP_DATA_DIR = TMP;

var userContext = require('../src/utils/user-context');
var Storage = require('../src/utils/storage');
var JsonFileStore = require('../src/utils/json-file-store');
var accountsRepository = require('../src/utils/accounts-repository');

function userFile(user, name) {
    return path.join(TMP, 'users', user, name + '.json');
}

function rootFile(name) {
    return path.join(TMP, name + '.json');
}

function readJson(filePath) {
    if (!fs.existsSync(filePath)) return null;
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

var orders = new Storage('orders');

test('run() 里让出执行权后，另一个用户的 run 不会改掉自己的身份', async function () {
    var seen = userContext.run('alice', function () {
        return Promise.resolve().then(function () {
            return new Promise(function (resolve) { setImmediate(resolve); });
        }).then(function () {
            return userContext.get();
        });
    });

    await Promise.resolve();
    var bob = await userContext.run('bob', function () {
        return userContext.get();
    });

    assert.equal(bob, 'bob');
    assert.equal(await seen, 'alice');
    assert.equal(userContext.get(), null);
});

test('交错之后写入仍落在发起请求的用户目录，根目录和对方文件不动', async function () {
    fs.mkdirSync(path.join(TMP, 'users', 'alice'), { recursive: true });
    fs.mkdirSync(path.join(TMP, 'users', 'bob'), { recursive: true });
    fs.writeFileSync(userFile('alice', 'orders'), JSON.stringify([{ id: 'A1', projectName: 'alice-original' }]));
    fs.writeFileSync(userFile('bob', 'orders'), JSON.stringify([{ id: 'B1', projectName: 'bob-original' }]));
    fs.writeFileSync(rootFile('orders'), JSON.stringify([{ id: 'ROOT', projectName: 'root' }]));

    var aliceWrite = userContext.run('alice', function () {
        return Promise.resolve().then(function () {
            return new Promise(function (resolve) { setImmediate(resolve); });
        }).then(function () {
            return orders.create({ projectName: 'alice-late' });
        });
    });

    await Promise.resolve();
    await userContext.run('bob', function () {
        assert.deepEqual(orders.findAll().map(function (row) { return row.id; }), ['B1']);
    });

    var created = await aliceWrite;
    assert.equal(created.projectName, 'alice-late');

    var alice = readJson(userFile('alice', 'orders'));
    var bob = readJson(userFile('bob', 'orders'));
    var root = readJson(rootFile('orders'));
    assert.equal(alice[0].projectName, 'alice-late');
    assert.ok(alice.some(function (row) { return row.id === 'A1'; }));
    assert.deepEqual(bob.map(function (row) { return row.id; }), ['B1']);
    assert.deepEqual(root.map(function (row) { return row.id; }), ['ROOT']);
});

test('enter 之后创建的异步延续，不会被后续 leave 清掉', async function () {
    userContext.enter('alice');
    var later = Promise.resolve().then(function () {
        return new Promise(function (resolve) { setImmediate(resolve); });
    }).then(function () {
        return userContext.get();
    });
    userContext.enter('bob');
    userContext.leave();
    assert.equal(await later, 'alice');
    assert.equal(userContext.get(), null);
});

test('账号文件损坏时读取抛错，调用方到不了保存，原文件保持原样', function () {
    var corrupt = '{"password":';
    var file = rootFile('accounts');
    fs.writeFileSync(file, corrupt);

    var rows = null;
    assert.throws(function () { rows = accountsRepository.read(); });
    assert.equal(rows, null);
    assert.equal(fs.readFileSync(file, 'utf-8'), corrupt);
});

test('收藏文件损坏时读取抛错，不会被当成空列表', function () {
    var corrupt = 'not-json';
    var file = rootFile('bookmarks');
    fs.writeFileSync(file, corrupt);
    var store = new JsonFileStore('bookmarks', { shape: 'array' });
    assert.throws(function () { return store.read(); });
    assert.equal(fs.readFileSync(file, 'utf-8'), corrupt);
});
