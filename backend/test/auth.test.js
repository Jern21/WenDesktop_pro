/**
 * 认证模块测试（隔离数据目录，不影响真实 auth.json）
 *
 *   node backend/test/auth.test.js
 */
'use strict';

var fs = require('fs');
var os = require('os');
var path = require('path');
var assert = require('assert');

// 必须在 require auth 之前设置，auth.js 在模块加载时读取该变量
var TMP_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'wt-auth-test-'));
process.env.AUTH_DATA_DIR = TMP_DIR;
delete process.env.APP_PASSWORD;
process.env.AUTH_ENABLED = '1';
process.env.AUTH_TRUST_LOCALHOST = '0';

var auth = require('../src/utils/auth');

var passed = 0;
var failed = 0;

function test(name, fn) {
    try {
        fn();
        passed++;
        console.log('  PASS  ' + name);
    } catch (e) {
        failed++;
        console.log('  FAIL  ' + name);
        console.log('        ' + e.message);
    }
}

console.log('\n[1] 首次初始化');
var init1;
test('首次 init 生成随机密码', function () {
    init1 = auth.init();
    assert.strictEqual(init1.generated, true, '应标记为自动生成');
    assert.ok(init1.password && init1.password.length >= 10, '密码长度应 >= 10');
});
test('auth.json 已落盘且不含明文密码', function () {
    var file = path.join(TMP_DIR, 'auth.json');
    assert.ok(fs.existsSync(file), 'auth.json 未创建');
    var raw = fs.readFileSync(file, 'utf-8');
    assert.ok(raw.indexOf(init1.password) === -1, '文件中不应出现明文密码');
    var data = JSON.parse(raw);
    assert.ok(data.salt && data.hash, '应包含 salt 与 hash');
});

console.log('\n[2] 密码校验');
test('正确密码通过', function () {
    assert.strictEqual(auth.verifyPassword(init1.password), true);
});
test('正确用户名+密码通过', function () {
    assert.strictEqual(auth.verifyCredentials(init1.username || 'admin', init1.password), true);
});
test('错误用户名拒绝', function () {
    assert.strictEqual(auth.verifyCredentials('not-admin', init1.password), false);
});
test('试用账号免密通过', function () {
    assert.strictEqual(auth.isTrialLogin('trial'), true);
    assert.strictEqual(auth.verifyCredentials('trial', ''), true);
});
test('非试用用户仍需密码', function () {
    assert.strictEqual(auth.verifyCredentials('admin', ''), false);
});
test('错误密码拒绝', function () {
    assert.strictEqual(auth.verifyPassword('wrong-password'), false);
});
test('空密码拒绝', function () {
    assert.strictEqual(auth.verifyPassword(''), false);
});
test('相似密码拒绝（仅差一个字符）', function () {
    assert.strictEqual(auth.verifyPassword(init1.password.slice(0, -1)), false);
});

console.log('\n[3] Token 签发与校验');
var token;
test('签发的 token 可校验通过', function () {
    token = auth.issueToken();
    assert.ok(token && token.indexOf('.') > 0, 'token 格式应为 payload.sig');
    assert.strictEqual(auth.verifyToken(token), true);
});
test('篡改 payload 后失效', function () {
    var parts = token.split('.');
    var forged = (Number(parts[0]) + 999999) + '.' + parts[1];
    assert.strictEqual(auth.verifyToken(forged), false);
});
test('篡改签名后失效', function () {
    var parts = token.split('.');
    assert.strictEqual(auth.verifyToken(parts[0] + '.AAAA' + parts[1].slice(4)), false);
});
test('已过期的 token 失效', function () {
    var expired = auth.issueToken(-1000);
    assert.strictEqual(auth.verifyToken(expired), false);
});
test('空值 / 乱码 token 拒绝', function () {
    assert.strictEqual(auth.verifyToken(''), false);
    assert.strictEqual(auth.verifyToken(null), false);
    assert.strictEqual(auth.verifyToken('abc'), false);
    assert.strictEqual(auth.verifyToken('a.b'), false);
});

console.log('\n[4] 修改密码');
test('旧密码错误时拒绝修改', function () {
    assert.strictEqual(auth.changePassword('wrong', 'newpassword123'), false);
});
test('新密码过短时拒绝修改', function () {
    assert.strictEqual(auth.changePassword(init1.password, '123'), false);
});
test('正确旧密码可修改', function () {
    assert.strictEqual(auth.changePassword(init1.password, 'MyNewPass2026'), true);
});
test('新密码生效、旧密码失效', function () {
    assert.strictEqual(auth.verifyPassword('MyNewPass2026'), true);
    assert.strictEqual(auth.verifyPassword(init1.password), false);
});
test('改密码后旧 token 立即失效（签名密钥随密码变化）', function () {
    assert.strictEqual(auth.verifyToken(token), false, '旧 token 应当失效');
});
test('改密码后新签发的 token 有效', function () {
    assert.strictEqual(auth.verifyToken(auth.issueToken()), true);
});

console.log('\n[5] 请求判定');
function fakeReq(opts) {
    opts = opts || {};
    return {
        headers: opts.headers || {},
        ip: opts.ip || '127.0.0.1',
        connection: { remoteAddress: opts.ip || '127.0.0.1' }
    };
}
test('本机请求被识别为 loopback', function () {
    assert.strictEqual(auth.isLoopback(fakeReq({ ip: '127.0.0.1' })), true);
    assert.strictEqual(auth.isLoopback(fakeReq({ ip: '::1' })), true);
    assert.strictEqual(auth.isLoopback(fakeReq({ ip: '::ffff:127.0.0.1' })), true);
});
test('局域网 IP 不算 loopback', function () {
    assert.strictEqual(auth.isLoopback(fakeReq({ ip: '192.168.1.20' })), false);
});
test('本机无 token 也需登录（默认不信任本机）', function () {
    assert.strictEqual(auth.isAuthenticated(fakeReq({ ip: '127.0.0.1' })), false);
});
test('外部 IP 无 token 被拒', function () {
    assert.strictEqual(auth.isAuthenticated(fakeReq({ ip: '192.168.1.20' })), false);
});
test('外部 IP 带合法 cookie 通过', function () {
    var t = auth.issueToken();
    var req = fakeReq({
        ip: '192.168.1.20',
        headers: { cookie: auth.COOKIE_NAME + '=' + encodeURIComponent(t) }
    });
    assert.strictEqual(auth.isAuthenticated(req), true);
});
test('外部 IP 带 Bearer token 通过', function () {
    var t = auth.issueToken();
    var req = fakeReq({
        ip: '192.168.1.20',
        headers: { authorization: 'Bearer ' + t }
    });
    assert.strictEqual(auth.isAuthenticated(req), true);
});

// 清理
try {
    fs.rmSync(TMP_DIR, { recursive: true, force: true });
} catch (e) { /* ignore */ }

console.log('\n' + '='.repeat(46));
console.log('  通过 ' + passed + ' 项，失败 ' + failed + ' 项');
console.log('='.repeat(46) + '\n');

if (failed > 0) process.exitCode = 1;
