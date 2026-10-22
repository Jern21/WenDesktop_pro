/**
 * 用户数据归属迁移：**只能在明确要求时执行**
 *
 * 背景：这段逻辑原来被无条件挂在 server.js 的启动流程里。后果是
 * 任何新数据目录（测试临时目录、换机器、全新部署）首启都会跑一遍：
 * 根目录 data/*.json 被复制到 users/trial/、原文件搬进 _legacy_root_data/、
 * admin 被置空 —— 等于**示例数据全归到免密的 trial 账号**，
 * 而如果有人已经在 admin 下存了真实数据，会被直接抹掉（旧实现是无条件覆盖）。
 *
 * 现在锁死三条：
 *   1. 默认（不设 USER_SCOPE_MIGRATE）启动**一个字节都不动**；
 *   2. 显式 USER_SCOPE_MIGRATE=1 时才迁移，且 trial 拿到数据 / admin 置空 / 原件进 legacy；
 *   3. 置空任何账号前，先把它原有的非空数据备份到 _legacy_root_data/admin-backup-*。
 *
 * 用独立临时目录，绝不碰 backend/data。
 */
'use strict';

var fs = require('fs');
var os = require('os');
var path = require('path');
var test = require('node:test');
var assert = require('node:assert/strict');

var TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'user-data-migrate-'));
process.env.APP_DATA_DIR = TMP;

var migrate = require('../src/utils/user-data-migrate');

var USERS = { trial: 'trial', admin: 'admin' };

function getUsers() {
    return USERS;
}

function resetDataDir() {
    fs.readdirSync(TMP).forEach(function (name) {
        fs.rmSync(path.join(TMP, name), { recursive: true, force: true });
    });
}

function rootFile(name) {
    return path.join(TMP, name + '.json');
}

function writeRoot(name, data) {
    fs.writeFileSync(rootFile(name), JSON.stringify(data, null, 2), 'utf-8');
}

function readRoot(name) {
    var p = rootFile(name);
    if (!fs.existsSync(p)) return null;
    return JSON.parse(fs.readFileSync(p, 'utf-8'));
}

function userFile(user, name) {
    return path.join(TMP, 'users', user, name + '.json');
}

function readUser(user, name) {
    var p = userFile(user, name);
    if (!fs.existsSync(p)) return null;
    return JSON.parse(fs.readFileSync(p, 'utf-8'));
}

function orders(count) {
    var out = [];
    for (var i = 1; i <= count; i++) {
        out.push({ id: 'o' + i, projectName: '项目' + i, amount: i * 100 });
    }
    return out;
}

function adminBackupDirs() {
    var legacy = path.join(TMP, '_legacy_root_data');
    if (!fs.existsSync(legacy)) return [];
    return fs.readdirSync(legacy).filter(function (n) {
        return n.indexOf('admin-backup-') === 0;
    });
}

// ========== 1. 默认不跑（核心） ==========

test('默认启动：不搬动任何数据，不创建 users / legacy / marker', function () {
    resetDataDir();
    writeRoot('orders', orders(3));

    var result = migrate.maybeRunOnStartup({ env: {}, getUsers: getUsers });

    assert.equal(result.skipped, true);
    assert.match(result.reason, /disabled/);

    // 根目录数据原封不动
    assert.equal(readRoot('orders').length, 3);
    // 没有生成任何用户数据目录
    assert.equal(fs.existsSync(path.join(TMP, 'users')), false);
    assert.equal(fs.existsSync(path.join(TMP, '_legacy_root_data')), false);
    assert.equal(fs.existsSync(path.join(TMP, '.user-scope-migrated')), false);
});

test('显式传 0 / false 同样不跑', function () {
    ['0', 'false', '', ' '].forEach(function (value) {
        resetDataDir();
        writeRoot('orders', orders(2));

        var result = migrate.maybeRunOnStartup({
            env: { USER_SCOPE_MIGRATE: value },
            getUsers: getUsers
        });

        assert.equal(result.skipped, true, 'USER_SCOPE_MIGRATE=' + JSON.stringify(value) + ' 不应触发迁移');
        assert.equal(readRoot('orders').length, 2);
        assert.equal(fs.existsSync(path.join(TMP, 'users')), false);
    });
});

// ========== 2. 显式开启才迁移 ==========

test('USER_SCOPE_MIGRATE=1：trial 拿到数据、admin 置空、原件进 legacy', function () {
    resetDataDir();
    writeRoot('orders', orders(3));
    writeRoot('customers', [{ id: 'c1', name: '客户甲' }]);

    var result = migrate.maybeRunOnStartup({
        env: { USER_SCOPE_MIGRATE: '1' },
        getUsers: getUsers
    });

    assert.equal(result.skipped, false);
    assert.equal(result.moved, 2);
    assert.equal(result.trial, 'trial');
    assert.equal(result.admin, 'admin');

    // trial 拿到全部数据
    assert.deepEqual(readUser('trial', 'orders').map(function (o) { return o.id; }), ['o1', 'o2', 'o3']);
    assert.equal(readUser('trial', 'customers').length, 1);

    // admin 是空的
    assert.deepEqual(readUser('admin', 'orders'), []);

    // 根目录原件已搬进 legacy，不会留双份
    assert.equal(fs.existsSync(rootFile('orders')), false);
    assert.equal(fs.existsSync(path.join(TMP, '_legacy_root_data', 'orders.json')), true);
    assert.ok(fs.existsSync(path.join(TMP, '.user-scope-migrated')));
});

test('重复执行幂等：marker 存在就不再搬（默认行为）', function () {
    resetDataDir();
    writeRoot('orders', orders(2));

    var first = migrate.runUserDataMigration({ getUsers: getUsers });
    assert.equal(first.skipped, false);

    // 迁移后再往根目录塞一份数据，模拟"又跑了一次启动"
    writeRoot('orders', orders(9));

    var second = migrate.maybeRunOnStartup({
        env: { USER_SCOPE_MIGRATE: '1' },
        getUsers: getUsers
    });
    assert.equal(second.skipped, true);
    assert.match(second.reason, /already migrated/);

    // trial 还是原来那 2 条，新塞进去的 9 条没被搬
    assert.equal(readUser('trial', 'orders').length, 2);
    assert.equal(readRoot('orders').length, 9);
});

test('force: true 可以强制重跑', function () {
    resetDataDir();
    writeRoot('orders', orders(2));
    migrate.runUserDataMigration({ getUsers: getUsers });

    writeRoot('quotes', [{ id: 'q1' }]);
    var again = migrate.runUserDataMigration({ force: true, getUsers: getUsers });

    assert.equal(again.skipped, false);
    assert.equal(readUser('trial', 'quotes').length, 1);
});

// ========== 3. 置空前必须备份 ==========

test('admin 已有真实数据：先备份再置空，不直接抹掉', function () {
    resetDataDir();

    // 模拟 admin 已经用过系统
    fs.mkdirSync(path.join(TMP, 'users', 'admin'), { recursive: true });
    fs.writeFileSync(userFile('admin', 'orders'), JSON.stringify(orders(5), null, 2), 'utf-8');

    writeRoot('orders', orders(2));

    var result = migrate.runUserDataMigration({ getUsers: getUsers });

    // 备份出来了
    assert.equal(result.backedUp.length, 1);
    var dirs = adminBackupDirs();
    assert.equal(dirs.length, 1);
    var backed = JSON.parse(
        fs.readFileSync(path.join(TMP, '_legacy_root_data', dirs[0], 'orders.json'), 'utf-8')
    );
    assert.equal(backed.length, 5, 'admin 原来的 5 条必须完整备份下来');

    // 置空生效
    assert.deepEqual(readUser('admin', 'orders'), []);
    // trial 拿到根目录那 2 条
    assert.equal(readUser('trial', 'orders').length, 2);
});

test('admin 本来就是空数组 / 空设置模板：不产生多余备份', function () {
    resetDataDir();
    writeRoot('orders', orders(2));

    // 第一次迁移会把 admin 写成空模板
    migrate.runUserDataMigration({ getUsers: getUsers });
    assert.equal(adminBackupDirs().length, 0);

    // 再强制跑一次：admin 仍是空模板，不该再备份
    var second = migrate.runUserDataMigration({ force: true, getUsers: getUsers });
    assert.equal(second.backedUp.length, 0);
    assert.equal(adminBackupDirs().length, 0);
});

test('admin 数据文件读不懂时也先备份（宁可多备份，不能直接覆盖）', function () {
    resetDataDir();
    fs.mkdirSync(path.join(TMP, 'users', 'admin'), { recursive: true });
    fs.writeFileSync(userFile('admin', 'orders'), '{"这不是数组": 1}', 'utf-8');
    writeRoot('orders', orders(1));

    var result = migrate.runUserDataMigration({ getUsers: getUsers });

    assert.equal(result.backedUp.length, 1, '解析不了的文件必须先备份再置空');
    var dirs = adminBackupDirs();
    var raw = fs.readFileSync(path.join(TMP, '_legacy_root_data', dirs[0], 'orders.json'), 'utf-8');
    assert.match(raw, /这不是数组/);
});

// ========== 4. 辅助函数与兼容性 ==========

test('hasMeaningfulData：空数组/空模板不算数据，非空才算', function () {
    resetDataDir();
    fs.writeFileSync(rootFile('orders'), '[]', 'utf-8');
    assert.equal(migrate.hasMeaningfulData('orders', rootFile('orders')), false);

    fs.writeFileSync(rootFile('orders'), '[{"id":"x"}]', 'utf-8');
    assert.equal(migrate.hasMeaningfulData('orders', rootFile('orders')), true);

    fs.writeFileSync(rootFile('orders'), '', 'utf-8');
    assert.equal(migrate.hasMeaningfulData('orders', rootFile('orders')), false);

    assert.equal(migrate.hasMeaningfulData('orders', rootFile('nope')), false);
});

test('兼容老签名：runUserDataMigration(function () {...})', function () {
    resetDataDir();
    writeRoot('orders', orders(1));

    var result = migrate.runUserDataMigration(function () {
        return { trial: 'trial', admin: 'admin' };
    });

    assert.equal(result.skipped, false);
    assert.equal(readUser('trial', 'orders').length, 1);
});

test('server.js 启动钩子必须走 maybeRunOnStartup，不能裸调迁移', function () {
    var src = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');

    assert.match(src, /maybeRunOnStartup\s*\(/, '启动时应调用 maybeRunOnStartup');
    assert.doesNotMatch(
        src,
        /\.runUserDataMigration\s*\(/,
        'server.js 不能无条件调用 runUserDataMigration —— 那会让全新部署把数据全塞给 trial'
    );
});
