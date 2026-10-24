'use strict';
var test = require('node:test');
var assert = require('node:assert/strict');
var policy = require('../policy');

test('域名默认进入桌面入口，保留自定义路径、端口、查询和路由', function () {
    assert.equal(policy.parseServerUrl(' https://work.example.com '), 'https://work.example.com/app.html');
    assert.equal(policy.parseServerUrl('https://work.example.com:8443/app.html?q=1#/orders'),
        'https://work.example.com:8443/app.html?q=1#/orders');
});
test('允许本机 HTTP 调试，包括 IPv6', function () {
    ['localhost', '127.0.0.1', '[::1]'].forEach(function (host) {
        assert.equal(policy.parseServerUrl('http://' + host + ':3456'), 'http://' + host + ':3456/app.html');
    });
});
test('拒绝无效地址、明文公网和其他协议', function () {
    ['', 'undefined', 'work.example.com', 'http://work.example.com', 'http://192.168.1.2',
        'file:///C:/test', 'javascript:alert(1)', 'data:text/html,test'].forEach(function (url) {
        assert.throws(function () { policy.parseServerUrl(url); });
    });
});
test('配置地址不能携带凭据', function () {
    assert.throws(function () { policy.parseServerUrl('https://admin:secret@work.example.com'); });
});
test('站点匹配比较完整 origin，拒绝相似域名和协议端口变化', function () {
    var site = 'https://work.example.com/app.html';
    assert.ok(policy.isSameSite('https://work.example.com/uploads/a.pdf', site));
    ['https://work.example.com.evil.test', 'http://work.example.com', 'https://work.example.com:444',
        'javascript:alert(1)', 'invalid'].forEach(function (url) {
        assert.equal(policy.isSameSite(url, site), false);
    });
});
test('系统浏览器仅接收不带凭据的 HTTP(S) 地址', function () {
    assert.ok(policy.isExternalLink('https://example.com'));
    ['file:///C:/test', 'cmd:calc', 'javascript:alert(1)', 'https://a:b@example.com', 'bad'].forEach(function (url) {
        assert.equal(policy.isExternalLink(url), false);
    });
});
