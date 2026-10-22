/**
 * Storage 必须跟随「当前请求的用户」，而不是模块加载时的状态
 *
 * 踩过的坑（表现：trial 登录进去，订单 / 客户 / 海报全是 0 条）：
 *
 *   class Storage {
 *       constructor(fileName) {
 *           this.filePath = dataBackups.getDataFilePath(fileName);  // ← 算死了
 *       }
 *   }
 *
 * 所有 Storage 实例都是「模块加载时」创建的（routes 顶层的
 * `var orders = new Storage('orders')`），那一刻请求还没进来、userContext 是空的，
 * 于是 filePath 永久指向根目录 data/ —— 此后**所有用户都读写同一份根目录文件**，
 * 用户隔离完全失效。磁盘上 users/trial/*.json 明明有 16 条订单，接口返回 0 条。
 *
 * 本文件锁死：
 *   1. 实例在「无用户上下文」时创建，之后切换用户，读写必须跟着走；
 *   2. 两个用户的数据互不可见、互不覆盖；
 *   3. 没有用户上下文时仍落回根目录（CLI 脚本 / 迁移工具依赖这个行为）。
 */
'use strict';

var fs = require('fs');
var os = require('os');
var path = require('path');
var test = require('node:test');
var assert = require('node:assert/strict');

var TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'storage-user-scope-'));
process.env.APP_DATA_DIR = TMP;

var Storage = require('../src/utils/storage');
var userContext = require('../src/utils/user-context');

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

// 关键：在**没有用户上下文**时创建实例，模拟 routes 模块被 require 的那一刻
var orders = new Storage('orders');

test('实例在无上下文时创建，切到某个用户后写入落到该用户目录', function () {
    // 模块加载态：无用户
    assert.equal(userContext.get(), null);

    userContext.enter('alice');
    try {
        orders.create({ projectName: 'alice 的订单' });
        assert.equal(orders.findAll().length, 1);
    } finally {
        userContext.leave();
    }

    var aliceData = readJson(userFile('alice', 'orders'));
    assert.ok(aliceData, 'alice 的数据文件应存在');
    assert.equal(aliceData.length, 1);
    assert.equal(aliceData[0].projectName, 'alice 的订单');

    // 不能写到根目录去
    var root = readJson(rootFile('orders'));
    assert.ok(!root || root.length === 0, '根目录不该被写入：' + JSON.stringify(root));
});

test('两个用户的数据互不可见、互不覆盖', function () {
    userContext.enter('bob');
    try {
        assert.deepEqual(orders.findAll(), [], 'bob 不该看到 alice 的数据');
        orders.create({ projectName: 'bob 的订单' });
        assert.equal(orders.findAll().length, 1);
    } finally {
        userContext.leave();
    }

    userContext.enter('alice');
    try {
        var alice = orders.findAll();
        assert.equal(alice.length, 1, 'alice 仍只有自己那 1 条');
        assert.equal(alice[0].projectName, 'alice 的订单');
    } finally {
        userContext.leave();
    }

    assert.equal(readJson(userFile('bob', 'orders')).length, 1);
});

test('同一个实例可以连续服务不同用户（请求切换）', function () {
    var quote = new Storage('quotes');

    userContext.enter('alice');
    try { quote.create({ id: 'q-alice', title: '支付宝' }); } finally { userContext.leave(); }

    userContext.enter('bob');
    try { quote.create({ id: 'q-bob', title: '鲍勃报价' }); } finally { userContext.leave(); }

    userContext.enter('alice');
    try {
        var list = quote.findAll();
        assert.equal(list.length, 1);
        assert.equal(list[0].title, '支付宝');
    } finally { userContext.leave(); }
});

test('按 id 更新 / 删除都落在当前用户，不会误伤别人', function () {
    var memo = new Storage('memos');

    userContext.enter('alice');
    var mine;
    try {
        mine = memo.create({ text: 'alice 的备忘' });
    } finally { userContext.leave(); }

    userContext.enter('bob');
    try {
        // bob 用 alice 的 id 去改 / 删，都应该找不到
        assert.equal(memo.update(mine.id, { text: '改掉别人的' }), null);
        assert.equal(memo.remove(mine.id), false);
        assert.equal(memo.findById(mine.id), null);
    } finally { userContext.leave(); }

    userContext.enter('alice');
    try {
        var still = memo.findById(mine.id);
        assert.ok(still, 'alice 的记录必须还在');
        assert.equal(still.text, 'alice 的备忘', '不能被 bob 改掉');
    } finally { userContext.leave(); }
});

test('没有用户上下文时仍落回根目录（CLI / 迁移工具依赖）', function () {
    var reminders = new Storage('reminders');
    reminders.create({ title: '无用户上下文的记录' });

    var root = readJson(rootFile('reminders'));
    assert.ok(root, '根目录文件应存在');
    assert.equal(root.length, 1);
});

test('filePath 是动态的：同一实例在不同上下文下指向不同文件', function () {
    var s = new Storage('projects');

    assert.equal(path.normalize(s.filePath), path.normalize(rootFile('projects')));

    userContext.enter('alice');
    try {
        assert.equal(
            path.normalize(s.filePath),
            path.normalize(userFile('alice', 'projects')),
            '切到 alice 后 filePath 必须跟着变'
        );
    } finally { userContext.leave(); }

    userContext.enter('trial');
    try {
        assert.equal(
            path.normalize(s.filePath),
            path.normalize(userFile('trial', 'projects'))
        );
    } finally { userContext.leave(); }
});
