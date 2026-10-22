/**
 * 敏感字段加密测试
 *
 * 分两层：
 *   A. 单元（本进程，数据目录指向临时目录）
 *      - secret-box 的加解密、幂等、老数据兼容、篡改检测、换密钥的后果
 *      - secret-migration 的幂等与「不留明文」
 *   B. 端到端（子进程起真实服务，独立数据目录）
 *      - 接口写完后磁盘上是密文；读接口仍返回明文
 *      - /api/settings 不给浏览器明文 apiKey，脱敏值回写也不会覆盖真实密钥
 *
 *   node backend/test/secret-box.test.js
 */
'use strict';

var fs = require('fs');
var os = require('os');
var path = require('path');
var crypto = require('crypto');
var execFileSync = require('child_process').execFileSync;

// ⚠️ 必须在 require 任何业务模块之前设置数据目录
var UNIT_DIR = path.join(os.tmpdir(), 'wt-secret-unit-' + process.pid);
fs.mkdirSync(UNIT_DIR, { recursive: true });
process.env.APP_DATA_DIR = UNIT_DIR;
delete process.env.APP_SECRET;

var box = require('../src/utils/secret-box');
var migration = require('../src/utils/secret-migration');

var pass = 0;
var fail = 0;

function check(name, ok, extra) {
    if (ok) { pass++; console.log('PASS  ' + name + (extra !== undefined ? '  [' + extra + ']' : '')); }
    else { fail++; console.log('FAIL  ' + name + (extra !== undefined ? '  [' + extra + ']' : '')); }
}

function sha(v) {
    return crypto.createHash('sha256').update(String(v)).digest('hex').slice(0, 16);
}

// ============================================================
// A. secret-box 单元测试
// ============================================================
console.log('\n--- A. secret-box ---');

[
    ['普通 ASCII', 'PlainPass123'],
    ['中文', '中文密码'],
    ['emoji', 'p@ss🔐word'],
    ['很短', '12'],
    ['很长', 'x'.repeat(2000)],
    ['含换行', 'line1\nline2\ttab'],
    ['含 enc: 字样', 'enc:v1:not-a-real-cipher']
].forEach(function (pair) {
    var plain = pair[1];
    var enc = box.encrypt(plain);
    check('加密后与明文不同：' + pair[0], enc !== plain);
    check('解密可还原：' + pair[0], box.decrypt(enc) === plain);
});

check('空串不加密', box.encrypt('') === '');
check('null 不加密', box.encrypt(null) === null);
check('undefined 不加密', box.encrypt(undefined) === undefined);
check('空串解密仍是空串', box.decrypt('') === '');

var once = box.encrypt('same-value');
check('二次加密幂等（不会套两层）', box.encrypt(once) === once);
check('密文带版本前缀', once.indexOf('enc:v1:') === 0);

check('同一明文两次加密结果不同（随机 IV）', box.encrypt('same-value') !== once);
check('老数据明文直通', box.decrypt('plain-old-value') === 'plain-old-value');

var tampered = once.slice(0, -4) + 'AAAA';
check('篡改密文解不开，返回 null', box.decrypt(tampered) === null);
check('decryptField 解不开时给空串', box.decryptField(tampered) === '');

var keyFile = path.join(UNIT_DIR, '.secret');
check('密钥文件已自动生成', fs.existsSync(keyFile), keyFile);
check('密钥为 32 字节', Buffer.from(fs.readFileSync(keyFile, 'utf-8').trim(), 'base64').length === 32);

// 换密钥必须解不开：子进程用 APP_SECRET 加密，本进程用文件密钥解密
var otherCipher = execFileSync(process.execPath, ['-e', [
    'process.env.APP_DATA_DIR = ' + JSON.stringify(UNIT_DIR),
    'process.env.APP_SECRET = "another-secret";',
    'var b = require(' + JSON.stringify(path.join(__dirname, '..', 'src', 'utils', 'secret-box.js')) + ');',
    'process.stdout.write(b.encrypt("should-not-decrypt"));'
].join('\n')], { encoding: 'utf-8' });
check('换密钥后解不开（返回 null）', box.decrypt(otherCipher) === null);

// ============================================================
// A2. 迁移单元测试
// ============================================================
console.log('\n--- A2. secret-migration ---');

fs.writeFileSync(path.join(UNIT_DIR, 'accounts.json'), JSON.stringify([
    { id: '1', accountName: 'a', password: 'MigrateMe-1' },
    { id: '2', accountName: 'b', password: '' },
    { id: '3', accountName: 'c', password: 'MigrateMe-3' }
], null, 2), 'utf-8');

fs.writeFileSync(path.join(UNIT_DIR, 'settings.json'), JSON.stringify({
    theme: 'pure-white',
    imageGen: { apiKey: 'sk-MigrateMe', model: 'gpt-image-1', timeout: 60 }
}, null, 2), 'utf-8');

var before = JSON.parse(fs.readFileSync(path.join(UNIT_DIR, 'accounts.json'), 'utf-8'));
var beforeHashes = before.map(function (a) { return sha(a.password); });

var r1 = migration.runAll();
var acc = r1.filter(function (r) { return r.file === 'accounts.json'; })[0] || {};
check('迁移了 2 条明文密码（空密码跳过）', acc.changed === 2, 'changed=' + acc.changed);

var after = JSON.parse(fs.readFileSync(path.join(UNIT_DIR, 'accounts.json'), 'utf-8'));
check('迁移后条数不变', after.length === before.length);
check('迁移后磁盘上无明文',
    after.every(function (a) { return !a.password || box.isEncrypted(a.password); }));
check('迁移后每条都能解回原值（指纹一致）',
    after.every(function (a, i) { return sha(box.decryptField(a.password)) === beforeHashes[i]; }));

var rawSettings = JSON.parse(fs.readFileSync(path.join(UNIT_DIR, 'settings.json'), 'utf-8'));
check('settings 的 apiKey 已加密', box.isEncrypted(rawSettings.imageGen.apiKey));
check('settings 的相邻字段没被破坏',
    rawSettings.theme === 'pure-white' &&
    rawSettings.imageGen.model === 'gpt-image-1' &&
    rawSettings.imageGen.timeout === 60,
    JSON.stringify(rawSettings));

var snapshot = fs.readFileSync(path.join(UNIT_DIR, 'accounts.json'), 'utf-8');
var r2 = migration.runAll();
check('二次迁移不再改动（幂等）',
    r2.every(function (r) { return !r.changed; }), JSON.stringify(r2));
check('二次迁移后文件内容完全一致',
    fs.readFileSync(path.join(UNIT_DIR, 'accounts.json'), 'utf-8') === snapshot);

// 文件不存在时不应报错
var emptyDir = path.join(os.tmpdir(), 'wt-secret-empty-' + process.pid);
fs.mkdirSync(emptyDir, { recursive: true });
var r3 = JSON.parse(execFileSync(process.execPath, ['-e', [
    'process.env.APP_DATA_DIR = ' + JSON.stringify(emptyDir),
    'var m = require(' + JSON.stringify(path.join(__dirname, '..', 'src', 'utils', 'secret-migration.js')) + ');',
    'process.stdout.write(JSON.stringify(m.runAll()));'
].join('\n')], { encoding: 'utf-8' }));
check('数据文件不存在时安全跳过',
    r3.every(function (r) { return r.skipped || !r.changed; }), JSON.stringify(r3));

// ============================================================
// B. 端到端：真实服务 + 独立数据目录
// ============================================================
console.log('\n--- B. HTTP 端到端 ---');

var PORT = 3987;
var HTTP_DIR = path.join(os.tmpdir(), 'wt-secret-int-' + process.pid);
var child = null;

/**
 * 服务端实际读写的用户目录。
 *
 * 开启认证 + 本机信任后，本机请求被当成 APP_USERNAME 这个账号，
 * 数据落在 `<HTTP_DIR>/users/<user>/`，不再是根目录。
 * 这里必须和 `_start-secret-server.js` 里的 APP_USERNAME 保持一致 ——
 * 对不上的话就是"测试读根目录、服务读用户目录"，文件永远找不到。
 */
var HTTP_USER = 'admin';

function httpDataFile(name) {
    return path.join(HTTP_DIR, 'users', HTTP_USER, name);
}

function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

/**
 * 用「那个目录自己的密钥」解密一个密文。
 *
 * 为什么要开子进程：本进程的 box 绑定的是 UNIT_DIR 的密钥，
 * 直接拿它去解 HTTP_DIR 的密文必然解不开（每个数据目录一把钥匙）。
 */
var BOX_PATH = path.join(__dirname, '..', 'src', 'utils', 'secret-box.js');
function decryptInDir(dir, cipher) {
    return execFileSync(process.execPath, ['-e',
        'process.env.APP_DATA_DIR = ' + JSON.stringify(dir) + ';\n' +
        'var b = require(' + JSON.stringify(BOX_PATH) + ');\n' +
        'process.stdout.write(b.decryptField(process.argv[1]));',
        String(cipher)], { encoding: 'utf-8' });
}

function waitForHealth(timeoutMs) {
    var started = Date.now();
    return (async function loop() {
        for (;;) {
            try {
                var res = await fetch('http://127.0.0.1:' + PORT + '/api/health');
                if (res.ok) return true;
            } catch (e) { /* 还没起来 */ }
            if (Date.now() - started > (timeoutMs || 15000)) return false;
            await sleep(200);
        }
    })();
}

async function main() {
    var spawn = require('child_process').spawn;
    child = spawn(process.execPath, [
        path.join(__dirname, '_start-secret-server.js'),
        String(PORT),
        HTTP_DIR
    ], { stdio: ['ignore', 'pipe', 'pipe'] });

    var serverLog = '';
    child.stdout.on('data', function (d) { serverLog += d.toString(); });
    child.stderr.on('data', function (d) { serverLog += d.toString(); });

    var healthy = await waitForHealth();
    if (!healthy) {
        check('测试服务启动成功', false, serverLog.slice(-500));
        return;
    }
    check('测试服务启动成功', true, 'port ' + PORT);

    var BASE = 'http://127.0.0.1:' + PORT;

    // ---- 启动时的迁移应该已经把种子数据加密了 ----
    var diskAccounts = JSON.parse(fs.readFileSync(httpDataFile('accounts.json'), 'utf-8'));
    var seeded = diskAccounts.filter(function (a) { return a.id === 'seed-1'; })[0];
    check('启动迁移：磁盘上的种子密码已是密文',
        box.isEncrypted(seeded.password), String(seeded.password).slice(0, 12));
    check('启动迁移：磁盘上不留明文',
        diskAccounts.every(function (a) { return !a.password || box.isEncrypted(a.password); }));

    // ---- 读接口返回明文（前端要能展示/复制） ----
    var listRes = await fetch(BASE + '/api/accounts');
    var listJson = await listRes.json();
    var seedFromApi = (listJson.data || []).filter(function (a) { return a.id === 'seed-1'; })[0];
    check('GET /api/accounts 返回明文密码（可用）',
        !!seedFromApi && seedFromApi.password === 'PlainSeedPass123',
        seedFromApi ? seedFromApi.password : '未找到');

    // ---- 新建账号：响应明文，磁盘密文 ----
    var created = await (await fetch(BASE + '/api/accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platform: 'gitee', accountName: 'new_guy', password: 'NewPass!234' })
    })).json();
    check('POST /api/accounts 成功', !!created.success, created.error);
    var newId = created.data && created.data.id;
    check('创建响应里密码是明文', created.data && created.data.password === 'NewPass!234');

    var diskAfterCreate = JSON.parse(fs.readFileSync(httpDataFile('accounts.json'), 'utf-8'));
    var createdOnDisk = diskAfterCreate.filter(function (a) { return a.id === newId; })[0];
    check('新账号密码落盘即密文',
        !!createdOnDisk && box.isEncrypted(createdOnDisk.password),
        createdOnDisk ? String(createdOnDisk.password).slice(0, 12) : '未找到');
    check('磁盘上找不到明文密码',
        fs.readFileSync(httpDataFile('accounts.json'), 'utf-8').indexOf('NewPass!234') === -1);

    // ---- 更新密码 ----
    // ⚠️ 校验要走接口读回来：本进程的密钥属于 UNIT_DIR，
    //    拿它去解 HTTP_DIR 的密文必然解不开（两个进程两把钥匙）。
    await fetch(BASE + '/api/accounts/' + newId, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: 'UpdatedPass!567' })
    });
    var listAfterUpdate = await (await fetch(BASE + '/api/accounts')).json();
    var updatedFromApi = (listAfterUpdate.data || []).filter(function (a) { return a.id === newId; })[0];
    check('更新后接口返回新密码',
        !!updatedFromApi && updatedFromApi.password === 'UpdatedPass!567',
        updatedFromApi ? updatedFromApi.password : '未找到');

    var diskAfterUpdate = JSON.parse(fs.readFileSync(httpDataFile('accounts.json'), 'utf-8'));
    var updated = diskAfterUpdate.filter(function (a) { return a.id === newId; })[0];
    check('更新后落盘仍是密文', box.isEncrypted(updated.password));
    check('更新后密文确实换了（不是沿用旧的）', updated.password !== createdOnDisk.password);
    check('旧密码没留在文件里',
        fs.readFileSync(httpDataFile('accounts.json'), 'utf-8').indexOf('NewPass!234') === -1);

    // ---- settings：apiKey 不裸奔 ----
    var settingsRes = await (await fetch(BASE + '/api/settings')).json();
    var apiKeyOut = settingsRes.data && settingsRes.data.imageGen && settingsRes.data.imageGen.apiKey;
    check('GET /api/settings 不返回明文 apiKey',
        !!apiKeyOut && String(apiKeyOut).indexOf('****') !== -1 && String(apiKeyOut).indexOf('PlainSeedKey') === -1,
        apiKeyOut);

    var diskSettings = JSON.parse(fs.readFileSync(httpDataFile('settings.json'), 'utf-8'));
    check('settings.json 里 apiKey 是密文', box.isEncrypted(diskSettings.imageGen.apiKey));

    // 把脱敏值原样 PUT 回去，真实密钥不能被覆盖
    await fetch(BASE + '/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageGen: { apiKey: apiKeyOut } })
    });
    var diskSettings2 = JSON.parse(fs.readFileSync(httpDataFile('settings.json'), 'utf-8'));
    // 密文本身会变（AES-GCM 每次用随机 IV，同一明文两次加密结果不同），
    // 所以不能比密文字节，要比「解出来的值」。
    check('脱敏值回写后密钥值未变',
        decryptInDir(HTTP_DIR, diskSettings2.imageGen.apiKey) === 'sk-PlainSeedKey-ABCD1234',
        decryptInDir(HTTP_DIR, diskSettings2.imageGen.apiKey));

    var settingsAfter = await (await fetch(BASE + '/api/settings')).json();
    check('真实密钥仍在（脱敏尾号一致）',
        settingsAfter.data.imageGen.apiKey === apiKeyOut,
        settingsAfter.data.imageGen.apiKey);
}

main()
    .catch(function (e) {
        check('测试过程未抛异常', false, e && e.message);
    })
    .then(function () {
        if (child) { try { child.kill(); } catch (e) { /* ignore */ } }
        console.log('');
        console.log('通过 ' + pass + ' 项，失败 ' + fail + ' 项');
        process.exit(fail === 0 ? 0 : 1);
    });
