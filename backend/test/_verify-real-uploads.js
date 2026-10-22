/**
 * 【临时核实脚本，不属于测试集】
 *
 * 拿真实 data 目录的**副本**起一个实例，遍历 trial 自己数据里引用的所有
 * /uploads/... URL，逐个请求，确认修完越权之后「自己的附件全都还能打开」。
 *
 * 只读真实数据（先复制到临时目录，服务对着副本跑，绝不动原始文件）。
 *
 * 用法：node backend/test/_verify-real-uploads.js <port>
 */
'use strict';

var fs = require('fs');
var os = require('os');
var path = require('path');
var cp = require('child_process');

var PORT = process.argv[2] || '3501';
var SRC = path.join(__dirname, '..', 'data');
var DATA_DIR = path.join(os.tmpdir(), 'wt-verify-real-' + PORT);
var BASE = 'http://127.0.0.1:' + PORT;

function rmrf(dir) {
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch (e) { /* ignore */ }
}

rmrf(DATA_DIR);
fs.cpSync(SRC, DATA_DIR, { recursive: true });
console.log('已把真实数据复制到: ' + DATA_DIR);

var env = Object.assign({}, process.env, {
    PORT: PORT,
    APP_DATA_DIR: DATA_DIR,
    AUTH_DATA_DIR: path.join(DATA_DIR, 'auth'),
    APP_USERNAME: 'admin',
    APP_PASSWORD: 'AdminPass123',
    AUTH_ENABLED: '1',
    TRIAL_LOGIN: '1'
});
delete env.AUTH_TRUST_LOCALHOST;
delete env.USER_SCOPE_MIGRATE;
delete env.ASSIGN_DATA_TO_TRIAL;

var server = cp.spawn(process.execPath, [path.join(__dirname, '..', 'server.js')], {
    env: env, stdio: ['ignore', 'pipe', 'pipe']
});
var serverLog = '';
server.stdout.on('data', function (d) { serverLog += d.toString(); });
server.stderr.on('data', function (d) { serverLog += d.toString(); });

function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

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
        var one = res.headers.get('set-cookie');
        if (one) raw = [one];
    }
    return raw.map(function (c) { return String(c).split(';')[0]; }).join('; ');
}

/** 从某个用户目录下的所有 json 里，捞出所有 /uploads/... 引用 */
function collectUploadUrls(dir) {
    var found = [];
    function walk(d) {
        var entries;
        try { entries = fs.readdirSync(d, { withFileTypes: true }); } catch (e) { return; }
        entries.forEach(function (e) {
            var full = path.join(d, e.name);
            if (e.isDirectory()) {
                if (e.name === 'uploads' || e.name === 'auth' || e.name === 'backups') return;
                walk(full);
                return;
            }
            if (!/\.json$/.test(e.name)) return;
            var raw;
            try { raw = fs.readFileSync(full, 'utf8'); } catch (err) { return; }
            var re = /\/uploads\/[^"'\s,\\]*/g;
            var m;
            while ((m = re.exec(raw)) !== null) {
                if (found.indexOf(m[0]) === -1) found.push(m[0]);
            }
        });
    }
    walk(dir);
    return found;
}

(async function main() {
    if (!(await waitReady())) {
        console.error('服务没起来:\n' + serverLog.slice(-1500));
        server.kill();
        process.exit(1);
    }
    console.log('服务已就绪 ' + BASE + '\n');

    var accounts = [['trial', null], ['admin', 'AdminPass123']];
    var failures = 0;

    for (var a = 0; a < accounts.length; a++) {
        var name = accounts[a][0];
        var pwd = accounts[a][1];
        var loginBody = pwd ? { username: name, password: pwd } : { username: name };
        var loginRes = await fetch(BASE + '/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(loginBody)
        });
        var cookie = extractCookie(loginRes);
        if (loginRes.status !== 200) {
            console.log('[' + name + '] 登录失败 ' + loginRes.status);
            continue;
        }

        var userDir = path.join(DATA_DIR, 'users', name);
        var urls = collectUploadUrls(userDir);
        console.log('【' + name + '】自己数据里引用了 ' + urls.length + ' 个附件 URL');

        for (var i = 0; i < urls.length; i++) {
            var res = await fetch(BASE + urls[i], { headers: { Cookie: cookie } });
            if (res.status !== 200) {
                failures++;
                console.log('   ❌ ' + res.status + '  ' + urls[i]);
            } else {
                console.log('   ✅ 200  ' + urls[i]);
            }
        }
        console.log('');
    }

    // 越权抽查：trial 拿 admin 目录里的文件名试猜（真实数据里 admin/uploads 是空的，
    // 用老共享目录里的文件名拼 admin 前缀，这正是攻击者会试的方式）
    var legacyFiles = [];
    try { legacyFiles = fs.readdirSync(path.join(DATA_DIR, 'uploads')); } catch (e) { /* none */ }
    var trialLogin = await fetch(BASE + '/api/auth/login', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'trial' })
    });
    var trialCookie = extractCookie(trialLogin);

    console.log('【越权抽查】trial 猜测 admin 的文件名（共 ' + legacyFiles.length + ' 个）');
    for (var k = 0; k < legacyFiles.length; k++) {
        var probe = '/uploads/admin/' + legacyFiles[k];
        var r = await fetch(BASE + probe, { headers: { Cookie: trialCookie } });
        if (r.status === 200) {
            failures++;
            console.log('   ❌ 竟然读到了: ' + probe);
        } else {
            console.log('   ✅ ' + r.status + '  ' + probe);
        }
    }
    // 老扁平路径 /uploads/<file>：归属按「自己的 uploads 目录里有没有同名文件」判。
    // 有同名副本 = 这就是我自己的文件（迁移留下的冗余），200 才是对的；
    // 没有 = 别人的孤本，必须 404。
    console.log('\n【老扁平 URL 归属判定】');
    for (var k2 = 0; k2 < legacyFiles.length; k2++) {
        var f = legacyFiles[k2];
        var mineHas = fs.existsSync(path.join(DATA_DIR, 'users', 'trial', 'uploads', f));
        var probe2 = '/uploads/' + f;
        var r2 = await fetch(BASE + probe2, { headers: { Cookie: trialCookie } });
        var expect = mineHas ? 200 : 404;
        var good = r2.status === expect;
        if (!good) failures++;
        console.log('   ' + (good ? '✅' : '❌') + ' ' + r2.status + '  ' + probe2 +
            '  (trial 目录里' + (mineHas ? '有' : '没有') + '同名文件，期望 ' + expect + ')');
    }

    // 真·越权探针：只在 admin 目录里放一个文件，trial 用老扁平 URL 去猜
    var adminOnly = 'admin-only-private.txt';
    fs.mkdirSync(path.join(DATA_DIR, 'users', 'admin', 'uploads'), { recursive: true });
    fs.writeFileSync(path.join(DATA_DIR, 'users', 'admin', 'uploads', adminOnly), 'ADMIN-ONLY');
    fs.writeFileSync(path.join(DATA_DIR, 'uploads', adminOnly), 'ADMIN-ONLY');

    console.log('\n【真·越权探针】trial 猜 /uploads/' + adminOnly);
    var p1 = await fetch(BASE + '/uploads/' + adminOnly, { headers: { Cookie: trialCookie } });
    if (p1.status === 200) { failures++; console.log('   ❌ 老扁平路径读到了 admin 专属文件'); }
    else console.log('   ✅ ' + p1.status + '  老扁平路径已拦住');

    var p2 = await fetch(BASE + '/uploads/admin/' + adminOnly, { headers: { Cookie: trialCookie } });
    if (p2.status === 200) { failures++; console.log('   ❌ 用户名路径读到了 admin 专属文件'); }
    else console.log('   ✅ ' + p2.status + '  用户名路径已拦住');

    // 同一个文件，admin 自己必须读得到
    var adminLogin2 = await fetch(BASE + '/api/auth/login', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'admin', password: 'AdminPass123' })
    });
    var adminCookie2 = extractCookie(adminLogin2);
    var p3 = await fetch(BASE + '/uploads/' + adminOnly, { headers: { Cookie: adminCookie2 } });
    if (p3.status === 200) console.log('   ✅ 200  admin 读自己的文件正常');
    else { failures++; console.log('   ❌ ' + p3.status + '  admin 读不到自己的文件（误伤）'); }

    console.log('\n================ ' + (failures === 0
        ? '✅ 真实数据下：自己的附件全通、别人的全拦'
        : '❌ 有 ' + failures + ' 处异常') + ' ================\n');

    server.kill();
    await sleep(300);
    rmrf(DATA_DIR);
    process.exit(failures === 0 ? 0 : 1);
})().catch(function (e) {
    console.error('异常: ' + e.message);
    console.error(serverLog.slice(-1500));
    try { server.kill(); } catch (err) { /* ignore */ }
    process.exit(1);
});
