/**
 * 【临时核实脚本，不属于测试集】
 *
 * 核实：/uploads/<user>/<file> 静态托管是否做了「文件归属」校验。
 * 也就是：免密的 trial 账号，能不能读到主账号 admin 的上传附件？
 *
 * 用法：node backend/test/_verify-upload-scope.js <port>
 *
 * 只读不写代码，跑完自己清理临时目录。
 */
'use strict';

var fs = require('fs');
var os = require('os');
var path = require('path');
var cp = require('child_process');

var PORT = process.argv[2] || '3491';
var DATA_DIR = path.join(os.tmpdir(), 'wt-verify-upload-' + PORT);
var BASE = 'http://127.0.0.1:' + PORT;

function rmrf(dir) {
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch (e) { /* ignore */ }
}

// ---------- 1. 造一份两个用户都有附件的临时数据 ----------
rmrf(DATA_DIR);
var adminUploads = path.join(DATA_DIR, 'users', 'admin', 'uploads');
var trialUploads = path.join(DATA_DIR, 'users', 'trial', 'uploads');
fs.mkdirSync(adminUploads, { recursive: true });
fs.mkdirSync(trialUploads, { recursive: true });

var ADMIN_SECRET = 'ADMIN-机密-客户合同-2026';
var TRIAL_FILE = 'trial 自己的备忘';
fs.writeFileSync(path.join(adminUploads, 'contract.txt'), ADMIN_SECRET, 'utf8');
fs.writeFileSync(path.join(trialUploads, 'memo.txt'), TRIAL_FILE, 'utf8');

// 迁移前的老布局（扁平目录，没有用户归属）
fs.mkdirSync(path.join(DATA_DIR, 'uploads'), { recursive: true });
fs.writeFileSync(path.join(DATA_DIR, 'uploads', 'legacy.txt'), 'LEGACY-老附件', 'utf8');
// 迁移后 URL 已改成带用户段、但文件本体还留在老目录的那种（回退分支）
fs.writeFileSync(path.join(DATA_DIR, 'uploads', 'only-in-legacy.txt'), 'LEGACY-只在老目录', 'utf8');

console.log('数据目录: ' + DATA_DIR);

// ---------- 2. 起一个真实服务实例 ----------
var env = Object.assign({}, process.env, {
    PORT: PORT,
    APP_DATA_DIR: DATA_DIR,
    AUTH_DATA_DIR: path.join(DATA_DIR, 'auth'),
    APP_USERNAME: 'admin',
    APP_PASSWORD: 'AdminPass123',
    AUTH_ENABLED: '1',
    TRIAL_LOGIN: '1'
    // 刻意不设 AUTH_TRUST_LOCALHOST：要测的是「登录后的越权」，
    // 本机免登录会把这一层直接跳过
});
delete env.AUTH_TRUST_LOCALHOST;
delete env.USER_SCOPE_MIGRATE;
delete env.ASSIGN_DATA_TO_TRIAL;

var server = cp.spawn(process.execPath, [path.join(__dirname, '..', 'server.js')], {
    env: env,
    stdio: ['ignore', 'pipe', 'pipe']
});
var serverLog = '';
server.stdout.on('data', function (d) { serverLog += d.toString(); });
server.stderr.on('data', function (d) { serverLog += d.toString(); });

function sleep(ms) {
    return new Promise(function (r) { setTimeout(r, ms); });
}

async function waitReady() {
    for (var i = 0; i < 60; i++) {
        try {
            var res = await fetch(BASE + '/api/health');
            if (res.ok) return true;
        } catch (e) { /* not yet */ }
        await sleep(250);
    }
    return false;
}

function extractCookie(res) {
    var raw = res.headers.getSetCookie ? res.headers.getSetCookie() : [];
    if (!raw.length) {
        var single = res.headers.get('set-cookie');
        if (single) raw = [single];
    }
    return raw.map(function (c) { return String(c).split(';')[0]; }).join('; ');
}

async function get(url, cookie) {
    var headers = {};
    if (cookie) headers['Cookie'] = cookie;
    var res = await fetch(BASE + url, { headers: headers, redirect: 'manual' });
    var body = '';
    try { body = await res.text(); } catch (e) { body = '<unreadable>'; }
    return { status: res.status, body: body.slice(0, 120), location: res.headers.get('location') };
}

(async function main() {
    var ok = await waitReady();
    if (!ok) {
        console.error('服务没起来。日志：\n' + serverLog.slice(-2000));
        server.kill();
        process.exit(1);
    }
    console.log('服务已就绪 ' + BASE);

    // ---------- 3. 用免密的 trial 身份登录 ----------
    var loginRes = await fetch(BASE + '/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'trial' })
    });
    var trialCookie = extractCookie(loginRes);
    var loginBody = await loginRes.text();
    console.log('\n[登录 trial] status=' + loginRes.status +
        ' cookie=' + (trialCookie ? trialCookie.slice(0, 40) + '...' : '(无)'));
    console.log('  body: ' + loginBody.slice(0, 160));

    // 对照：admin 登录
    var adminLogin = await fetch(BASE + '/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'admin', password: 'AdminPass123' })
    });
    var adminCookie = extractCookie(adminLogin);
    console.log('[登录 admin] status=' + adminLogin.status + ' cookie=' + (adminCookie ? '有' : '(无)'));

    // ---------- 4. 核心断言：trial 去读 admin 的附件 ----------
    console.log('\n========== 核实结果 ==========');

    var anon = await get('/uploads/admin/contract.txt', null);
    console.log('① 未登录  GET /uploads/admin/contract.txt  → ' + anon.status +
        (anon.status === 401 || anon.status === 302 ? ' (已拦住)' : ' (!!! 不该放行)'));

    var cross = await get('/uploads/admin/contract.txt', trialCookie);
    var leaked = cross.status === 200 && cross.body.indexOf('ADMIN-机密') !== -1;
    console.log('② trial   GET /uploads/admin/contract.txt  → ' + cross.status +
        (leaked ? '  ⚠️ 读到 admin 的文件内容：「' + cross.body.slice(0, 30) + '」' : ''));
    console.log('   越权判定：' + (leaked ? '❌ 越权成立（trial 可读 admin 附件）' : '✅ 未越权'));

    var own = await get('/uploads/trial/memo.txt', trialCookie);
    console.log('③ trial   GET /uploads/trial/memo.txt      → ' + own.status +
        ' (自己的文件，应为 200)');

    var adminOwn = await get('/uploads/admin/contract.txt', adminCookie);
    console.log('④ admin   GET /uploads/admin/contract.txt  → ' + adminOwn.status + ' (应 200)');

    // ---------- 5. 顺带看老布局和路径穿越 ----------
    var legacy = await get('/uploads/legacy.txt', trialCookie);
    console.log('⑤ trial   GET /uploads/legacy.txt           → ' + legacy.status +
        ' (老扁平布局归主账号，trial 应 404)');

    // ---------- 6. 反向回归：主账号自己的历史附件必须照常能看 ----------
    // 修越权最容易顺手把主账号也一起关在门外，这一步专门盯这个
    var adminLegacy = await get('/uploads/legacy.txt', adminCookie);
    console.log('⑧ admin   GET /uploads/legacy.txt           → ' + adminLegacy.status +
        (adminLegacy.status === 200 && adminLegacy.body.indexOf('LEGACY') !== -1
            ? '  ✅ 历史附件正常'
            : '  ❌ 主账号读不到自己的历史附件'));

    var adminFallback = await get('/uploads/admin/only-in-legacy.txt', adminCookie);
    console.log('⑨ admin   GET /uploads/admin/only-in-legacy → ' + adminFallback.status +
        (adminFallback.status === 200 ? '  ✅ 回退到老目录成功' : '  ❌ 回退分支被误伤'));

    var traversal = await get('/uploads/trial/..%2f..%2fadmin%2fuploads%2fcontract.txt', trialCookie);
    console.log('⑥ trial   GET 编码穿越 ..%2f → ' + traversal.status +
        (traversal.body.indexOf('ADMIN-机密') !== -1 ? '  ⚠️ 穿越成功' : ' (未穿越)'));

    var wrongUser = await get('/uploads/nobody/contract.txt', trialCookie);
    console.log('⑦ trial   GET /uploads/nobody/...           → ' + wrongUser.status + ' (不存在的用户目录)');

    console.log('==============================\n');

    server.kill();
    await sleep(300);
    rmrf(DATA_DIR);
    process.exit(0);
})().catch(function (e) {
    console.error('核实脚本异常: ' + e.message);
    console.error(serverLog.slice(-1500));
    try { server.kill(); } catch (err) { /* ignore */ }
    process.exit(1);
});
