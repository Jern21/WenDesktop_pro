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

test('静态托管：用户目录文件能通过 /uploads/<user>/<file> 读到', function () {
    var dir = dataPaths.userUploadsDir('trial');
    fs.writeFileSync(path.join(dir, 'hello.txt'), 'ok-content');

    var app = express();
    app.use('/uploads', uploads.staticHandler());

    return new Promise(function (resolve, reject) {
        var server = app.listen(0, '127.0.0.1', function () {
            var base = 'http://127.0.0.1:' + server.address().port;
            fetch(base + '/uploads/trial/hello.txt')
                .then(function (res) {
                    assert.equal(res.status, 200);
                    return res.text();
                })
                .then(function (text) {
                    assert.equal(text, 'ok-content');
                    return fetch(base + '/uploads/trial/missing.txt');
                })
                .then(function (res) {
                    assert.equal(res.status, 404);
                })
                .then(function () {
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
