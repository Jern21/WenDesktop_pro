'use strict';

var fs = require('fs');
var os = require('os');
var path = require('path');
var test = require('node:test');
var assert = require('node:assert/strict');

var TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'round-contracts-'));
process.env.APP_DATA_DIR = TMP;

var dataBackups = require('../src/utils/data-backups');
var settingsRepository = require('../src/utils/settings-repository');
var nextOrderNo = require('../src/utils/order-no').nextOrderNo;

test('订单编号取当天最大值加一，删除中间记录后不重复', function () {
    var day = new Date(2026, 9, 22);
    var existing = ['DD20261022001', 'DD20261022002', 'DD20261022003'];
    existing.splice(1, 1);
    assert.equal(nextOrderNo(existing, day), 'DD20261022004');
    assert.equal(nextOrderNo(['DD20261022004'], day), 'DD20261022005');
});

test('两次读取的默认设置不共享嵌套对象', function () {
    var alice = settingsRepository.read({ username: 'alice' });
    alice.backup.lastBackup = 'alice-time';
    var bob = settingsRepository.read({ username: 'bob' });
    assert.equal(bob.backup.lastBackup, null);
});

test('整包恢复在写入前校验结构，失败时不改已有订单', function () {
    var scope = { username: 'alice' };
    dataBackups.writeJsonFile('orders', [{ id: 'keep' }], { scope: scope, backup: false });

    assert.throws(function () {
        dataBackups.restoreBundle({
            _meta: { version: '1' },
            orders: { invalid: 'object' }
        }, scope);
    }, /备份校验失败/);

    assert.equal(dataBackups.readJsonFile('orders', [], scope)[0].id, 'keep');

    assert.throws(function () {
        dataBackups.restoreBundle({
            _meta: { version: '1' },
            orders: [{ id: 'next' }],
            auth: { password: 'nope' }
        }, scope);
    }, /auth 不是可恢复的数据集/);
    assert.equal(dataBackups.readJsonFile('orders', [], scope)[0].id, 'keep');

    var restored = dataBackups.restoreBundle({
        _meta: { version: '1' },
        orders: [{ id: 'restored' }]
    }, scope);
    assert.deepEqual(restored, ['orders']);
    assert.equal(dataBackups.readJsonFile('orders', [], scope)[0].id, 'restored');
});
