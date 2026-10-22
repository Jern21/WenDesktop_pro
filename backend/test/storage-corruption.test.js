/**
 * Storage 数据损坏防护测试
 *
 * 背景：storage.js 的 _read() 原先把「读取失败 / JSON 解析失败」都 catch 成返回 []，
 * 而 create / update / remove 都是「_read() → 改内存 → _write(全量)」的模式，
 * 于是数据文件一旦损坏，下一次写入就用新数据把整个文件覆盖掉 ——
 * 「数据损坏」被伪装成「没有数据」，没有任何告警。
 *
 * 本测试锁死三条：
 *   1. 读不懂就抛 StorageError，绝不返回空数组；
 *   2. 抛错之后原文件一个字节都不能变；
 *   3. 提供 recoverFromBackup() 作为显式恢复入口。
 *
 * 用独立临时目录，绝不碰 backend/data。
 */
'use strict';

var fs = require('fs');
var os = require('os');
var path = require('path');
var test = require('node:test');
var assert = require('node:assert/strict');

// 必须在 require storage 之前设置，否则 data-paths 会解析到真实数据目录
var TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'storage-corruption-'));
process.env.APP_DATA_DIR = TMP;

var Storage = require('../src/utils/storage');
var StorageError = Storage.StorageError;

function fileOf(name) {
    return path.join(TMP, name + '.json');
}

function writeRaw(name, text) {
    fs.writeFileSync(fileOf(name), text, 'utf-8');
}

function readRaw(name) {
    return fs.readFileSync(fileOf(name), 'utf-8');
}

function isStorageError(err) {
    return err instanceof StorageError && err.name === 'StorageError';
}

test('正常路径：写入后能读回，且落盘是数组', function () {
    var s = new Storage('ok');
    var rec = s.create({ name: '正常记录' });
    assert.equal(rec.name, '正常记录');
    assert.equal(s.findAll().length, 1);
    assert.ok(Array.isArray(JSON.parse(readRaw('ok'))));
});

test('文件损坏：读取抛 StorageError，而不是静默返回空数组', function () {
    writeRaw('corrupt-read', '{"broken": ');

    var s = new Storage('corrupt-read');
    assert.throws(function () { return s.findAll(); }, isStorageError);
});

test('文件损坏：create 必须失败，且原文件一个字节都不能变', function () {
    var corrupt = '{"this is": "corrupt JSON';
    writeRaw('corrupt-create', corrupt);

    var before = readRaw('corrupt-create');
    var s = new Storage('corrupt-create');

    assert.throws(function () { return s.create({ name: '新记录' }); }, isStorageError);

    assert.equal(readRaw('corrupt-create'), before,
        '数据损坏时不允许用空数组覆盖原文件');
});

test('文件损坏：update / remove / count 同样抛错且不改文件', function () {
    var corrupt = 'not json at all';
    writeRaw('corrupt-write', corrupt);

    var s = new Storage('corrupt-write');
    assert.throws(function () { return s.update('any-id', { a: 1 }); }, isStorageError);
    assert.throws(function () { return s.remove('any-id'); }, isStorageError);
    assert.throws(function () { return s.count(); }, isStorageError);
    assert.throws(function () { return s.createMany([{ a: 1 }]); }, isStorageError);

    assert.equal(readRaw('corrupt-write'), corrupt);
});

test('顶层不是数组：同样抛 StorageError', function () {
    writeRaw('not-array', '{"a":1}');
    var s = new Storage('not-array');
    assert.throws(function () { return s.findAll(); }, isStorageError);
});

test('空文件：按空数据处理，不抛（确实没有可丢的内容）', function () {
    writeRaw('empty', '  \n');
    var s = new Storage('empty');
    assert.deepEqual(s.findAll(), []);
});

test('构造时不建文件；读返回空数组，写入时才落盘', function () {
    var s = new Storage('brand-new');

    // 构造时不该在磁盘上留痕：
    // Storage 实例是模块加载时创建的，那时还没进请求、userContext 是空的，
    // 此时建文件会在根目录造出一堆空 json，还会和用户实际读写的那份对不上。
    assert.equal(fs.existsSync(fileOf('brand-new')), false, '构造时不该建文件');

    // 但读取语义不变：没有文件 = 没有数据
    assert.deepEqual(s.findAll(), []);

    // 第一次写入时自动创建
    s.create({ name: '第一条' });
    assert.ok(fs.existsSync(fileOf('brand-new')), '写入时应创建文件');
    assert.equal(s.findAll().length, 1);
});

test('recoverFromBackup：能从备份恢复被写坏的文件', function () {
    var s = new Storage('recover');

    // 写两次，第二次写入前会自动备份第一版
    s.create({ name: '第一条' });
    s.create({ name: '第二条' });
    assert.equal(s.findAll().length, 2);

    // 人为损坏
    writeRaw('recover', '<<<彻底坏掉>>>');

    var broken = new Storage('recover');
    assert.throws(function () { return broken.findAll(); }, isStorageError);

    var result = broken.recoverFromBackup();
    assert.ok(result.count >= 1, '恢复后至少有 1 条记录，实际 ' + result.count);
    assert.ok(result.restoredFrom, '应返回恢复来源');
    assert.equal(broken.findAll().length, result.count, '恢复后能正常读取');
});

test('recoverFromBackup：没有备份时明确报错，不静默', function () {
    writeRaw('no-backup', '坏的');
    var s = new Storage('no-backup');
    assert.throws(function () { return s.recoverFromBackup(); }, /没有可用备份/);
});

test('recoverFromBackup：指定不存在的备份时报错', function () {
    var s = new Storage('bad-name');

    // 没有任何备份时，报的是「没有可用备份」
    assert.throws(function () { return s.recoverFromBackup('orders-2099.json'); }, /没有可用备份/);

    // 写两次：第二次写入前会自动备份第一版，于是有备份了
    s.create({ a: 1 });
    s.create({ a: 2 });

    // 有备份，但指定了一个不存在的名字
    assert.throws(function () { return s.recoverFromBackup('orders-2099.json'); }, /找不到指定备份/);
});

test('update 不能改 id / createdAt，即使 patch 里带了', function () {
    var s = new Storage('id-guard');
    var rec = s.create({ name: '原名' });
    var originalCreated = rec.createdAt;

    var updated = s.update(rec.id, {
        id: 'hijacked',
        createdAt: '1999-01-01T00:00:00.000Z',
        name: '新名'
    });

    assert.equal(updated.id, rec.id);
    assert.equal(updated.createdAt, originalCreated);
    assert.equal(updated.name, '新名');
    assert.equal(s.findById(rec.id).name, '新名');
    assert.equal(s.findById('hijacked'), null);
    assert.equal(s.findAll().length, 1);
});
