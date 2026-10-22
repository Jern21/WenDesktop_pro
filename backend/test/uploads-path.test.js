/**
 * 上传路径：写入目录、对外 URL、静态托管必须对齐，并跟随 APP_DATA_DIR。
 */
'use strict';

var fs = require('fs');
var os = require('os');
var path = require('path');
var test = require('node:test');
var assert = require('node:assert/strict');

var TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'uploads-path-'));
process.env.APP_DATA_DIR = TMP;

var uploads = require('../src/utils/uploads');
var dataPaths = require('../src/utils/data-paths');
var userContext = require('../src/utils/user-context');
var express = require('express');

var BACKEND = path.join(__dirname, '..');

test('APP_DATA_DIR 生效：用户目录不在默认 backend/data 下', function () {
    assert.equal(dataPaths.DATA_DIR, TMP);
    assert.ok(dataPaths.userUploadsDir('trial').indexOf(TMP) === 0);
    assert.equal(
        path.normalize(dataPaths.userUploadsDir('trial')),
        path.normalize(path.join(TMP, 'users', 'trial', 'uploads'))
    );
});

test('新 URL /uploads/<user>/<file> 解析到用户目录', function () {
    var dir = dataPaths.userUploadsDir('trial');
    var file = path.join(dir, 'shot.jpg');
    fs.writeFileSync(file, 'img');
    assert.equal(
        path.normalize(uploads.resolveFromUrl('/uploads/trial/shot.jpg')),
        path.normalize(file)
    );
});

test('旧 URL /uploads/<file> 解析到扁平 uploads 目录', function () {
    var dir = dataPaths.UPLOADS_DIR;
    fs.mkdirSync(dir, { recursive: true });
    var file = path.join(dir, 'legacy.pdf');
    fs.writeFileSync(file, 'pdf');
    assert.equal(
        path.normalize(uploads.resolveFromUrl('/uploads/legacy.pdf')),
        path.normalize(file)
    );
});

test('解析失败的路径遍历返回 null，且不创建假用户目录', function () {
    assert.equal(uploads.resolveFromUrl('/uploads/../package.json'), null);
    assert.equal(uploads.resolveFromUrl('/uploads/trial/../../server.js'), null);
    assert.equal(uploads.parseUploadsUrl('/uploads/not-a-user/../../secret'), null);

    var missing = uploads.resolveFromUrl('/uploads/ghostuser/nope.jpg');
    assert.ok(missing);
    assert.equal(fs.existsSync(path.join(TMP, 'users', 'ghostuser')), false);
});

test('publicUrl 带上当前用户前缀', function () {
    userContext.enter('trial');
    try {
        assert.equal(uploads.publicUrl('a.png'), '/uploads/trial/a.png');
    } finally {
        userContext.leave();
    }
});

/**
 * 假的会话中间件：用 x-test-user 头模拟「当前登录的是谁」。
 *
 * 真实服务里这一步是 auth.attachUserContext 干的（从 cookie 解出会话写进 req.wtSession）。
 * 这里必须模拟出来，否则 req.wtSession 为空，
 * usernameFromRequest() 会退化成把所有人当成主账号 admin ——
 * 那正好就是被修掉的那个越权形态，测出来的结论会完全失真。
 */
function stubSession(req, res, next) {
    var who = req.headers['x-test-user'];
    if (who) req.wtSession = { username: String(who) };
    next();
}

test('静态托管：读自己的文件能读到，跨用户的读不到', function () {
    // 两个用户各放一个同名文件，内容不同 —— 这样才能分辨「读到的是谁的」
    fs.writeFileSync(path.join(dataPaths.userUploadsDir('trial'), 'hello.txt'), 'trial-content');
    fs.writeFileSync(path.join(dataPaths.userUploadsDir('admin'), 'hello.txt'), 'admin-content');

    // 迁移前的老扁平目录：归主账号
    fs.mkdirSync(dataPaths.UPLOADS_DIR, { recursive: true });
    fs.writeFileSync(path.join(dataPaths.UPLOADS_DIR, 'legacy.txt'), 'legacy-content');

    var app = express();
    app.use('/uploads', stubSession, uploads.staticHandler());

    function getText(base, url, asUser) {
        var headers = asUser ? { 'x-test-user': asUser } : {};
        return fetch(base + url, { headers: headers });
    }

    return new Promise(function (resolve, reject) {
        var server = app.listen(0, '127.0.0.1', function () {
            var base = 'http://127.0.0.1:' + server.address().port;

            getText(base, '/uploads/trial/hello.txt', 'trial')
                .then(function (res) {
                    assert.equal(res.status, 200, 'trial 读自己的文件应 200');
                    return res.text();
                })
                .then(function (text) {
                    assert.equal(text, 'trial-content', '读到的必须是 trial 自己那份');

                    // ↓↓↓ 本次修复的核心回归：跨用户读取必须被拦住 ↓↓↓
                    return getText(base, '/uploads/admin/hello.txt', 'trial');
                })
                .then(function (res) {
                    assert.equal(res.status, 404, 'trial 读 admin 的文件必须 404（越权）');
                    return getText(base, '/uploads/trial/hello.txt', 'admin');
                })
                .then(function (res) {
                    assert.equal(res.status, 404, 'admin 读 trial 的文件同样必须 404');

                    // 老扁平布局归主账号：主账号能读，trial 不能
                    return getText(base, '/uploads/legacy.txt', 'admin');
                })
                .then(function (res) {
                    assert.equal(res.status, 200, '主账号读历史附件应 200');
                    return getText(base, '/uploads/legacy.txt', 'trial');
                })
                .then(function (res) {
                    assert.equal(res.status, 404, 'trial 读老共享目录必须 404');

                    // 自己的目录里没有、但老目录里有时，只有主账号能回退
                    return getText(base, '/uploads/admin/legacy.txt', 'admin');
                })
                .then(function (res) {
                    assert.equal(res.status, 200, '主账号应能回退到老目录找到文件');
                    return getText(base, '/uploads/trial/legacy.txt', 'trial');
                })
                .then(function (res) {
                    assert.equal(res.status, 404, 'trial 不得借回退分支读到老目录文件');
                    return getText(base, '/uploads/trial/missing.txt', 'trial');
                })
                .then(function (res) {
                    assert.equal(res.status, 404, '不存在的文件应 404');
                    server.close(function () { resolve(); });
                })
                .catch(function (err) {
                    server.close(function () { reject(err); });
                });
        });
        server.on('error', reject);
    });
});

test('上传相关源码不再硬编码 backend/data/uploads', function () {
    var files = [
        'server.js',
        'src/routes/upload.js',
        'src/routes/resume.js',
        'src/routes/posters.js',
        'src/routes/bug-reports.js',
        'src/routes/platform-posts.js'
    ];
    files.forEach(function (rel) {
        var src = fs.readFileSync(path.join(BACKEND, rel), 'utf8');
        assert.doesNotMatch(
            src,
            /path\.join\(__dirname,\s*'data',\s*'uploads'\)/,
            rel + ' 仍写死 server 相对 data/uploads'
        );
        assert.doesNotMatch(
            src,
            /path\.join\(__dirname,\s*'\.\.',\s*'\.\.',\s*'data',\s*'uploads'\)/,
            rel + ' 仍写死 routes 相对 data/uploads'
        );
    });
});

test('trial 不能删掉 admin 的附件，也不能删旧共享目录', function () {
    var adminDir = dataPaths.userUploadsDir('admin');
    fs.mkdirSync(adminDir, { recursive: true });
    var adminFile = path.join(adminDir, 'secret.pdf');
    fs.writeFileSync(adminFile, 'admin');

    var legacyDir = dataPaths.UPLOADS_DIR;
    fs.mkdirSync(legacyDir, { recursive: true });
    var legacyFile = path.join(legacyDir, 'shared.pdf');
    fs.writeFileSync(legacyFile, 'shared');

    var trial = { wtSession: { username: 'trial' } };
    assert.equal(uploads.deleteByUrl('/uploads/admin/secret.pdf', trial), false);
    assert.equal(fs.readFileSync(adminFile, 'utf8'), 'admin');
    assert.equal(uploads.deleteByFilename('shared.pdf', trial), false);
    assert.equal(fs.readFileSync(legacyFile, 'utf8'), 'shared');

    var admin = { wtSession: { username: 'admin' } };
    assert.equal(uploads.deleteByUrl('/uploads/admin/secret.pdf', admin), true);
    assert.equal(fs.existsSync(adminFile), false);
    assert.equal(uploads.deleteByFilename('shared.pdf', admin), true);
    assert.equal(fs.existsSync(legacyFile), false);
});

test('/uploads 必须挂 attachUserContext（否则越权检查会退化成「所有人都是主账号」）', function () {
    var src = fs.readFileSync(path.join(BACKEND, 'server.js'), 'utf8');
    var line = src.split('\n').filter(function (l) {
        return /app\.use\(\s*'\/uploads'/.test(l);
    })[0];

    assert.ok(line, 'server.js 里找不到 /uploads 的挂载语句');

    // 关键：staticHandler 靠 req.wtSession 判断「这份文件是不是你的」。
    // pageGuard 只回答「登录了没」，不回答「你是谁」——
    // 少了 attachUserContext，req.wtSession 永远是空的，
    // usernameFromRequest() 会兜底成 admin，于是任何登录用户都被当成主账号。
    assert.match(line, /attachUserContext/,
        '/uploads 丢了 attachUserContext：' + line.trim());

    // 顺序也要求：先有身份，再做静态托管
    assert.ok(line.indexOf('attachUserContext') < line.indexOf('staticHandler'),
        'attachUserContext 必须在 staticHandler 之前');
});
