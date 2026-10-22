/**
 * 【临时核实脚本，不属于测试集】
 *
 * 核实：后端返回的中文校验文案，前端到底能不能拿到。
 *
 * 关键：这里**真的把 frontend/js/api.js 加载进 vm 里跑**，
 *       不是照着它的代码手写一遍模拟。手写模拟永远只会复述我以为的逻辑，
 *       改了 api.js 也不会反映出来（第一版就踩了这个坑，白测一轮）。
 *
 * 用法：node backend/test/_verify-error-message.js <port>
 */
'use strict';

var fs = require('fs');
var os = require('os');
var path = require('path');
var vm = require('vm');
var cp = require('child_process');

var PORT = process.argv[2] || '3492';
var DATA_DIR = path.join(os.tmpdir(), 'wt-verify-err-' + PORT);
var BASE = 'http://127.0.0.1:' + PORT;

function rmrf(dir) {
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch (e) { /* ignore */ }
}

rmrf(DATA_DIR);
fs.mkdirSync(path.join(DATA_DIR, 'users', 'admin'), { recursive: true });
fs.writeFileSync(path.join(DATA_DIR, 'users', 'admin', 'orders.json'), '[]', 'utf8');

var env = Object.assign({}, process.env, {
    PORT: PORT,
    APP_DATA_DIR: DATA_DIR,
    AUTH_DATA_DIR: path.join(DATA_DIR, 'auth'),
    APP_USERNAME: 'admin',
    APP_PASSWORD: 'AdminPass123',
    AUTH_ENABLED: '1',
    AUTH_TRUST_LOCALHOST: '1'   // 本条核实与身份无关，免登录省事
});
delete env.USER_SCOPE_MIGRATE;
delete env.ASSIGN_DATA_TO_TRIAL;

var server = cp.spawn(process.execPath, [path.join(__dirname, '..', 'server.js')], {
    env: env,
    stdio: ['ignore', 'pipe', 'pipe']
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

/** 记录每个 URL 被打了几次，用来验证「4xx 不重试」 */
var hitCount = {};

function countingFetch(input, opts) {
    var u = String(input);
    var abs = /^https?:\/\//.test(u) ? u : BASE + u;
    hitCount[u] = (hitCount[u] || 0) + 1;
    return fetch(abs, opts);
}

/**
 * 把真实 api.js 加载进隔离上下文，返回 window.api
 */
function loadRealApi() {
    var file = path.join(__dirname, '..', '..', 'frontend', 'js', 'api.js');
    var code = fs.readFileSync(file, 'utf8');
    var sandbox = {
        window: {},
        console: console,
        fetch: countingFetch,
        AbortController: AbortController,
        URLSearchParams: URLSearchParams,
        FormData: FormData,
        Object: Object,
        Promise: Promise,
        setTimeout: setTimeout,
        clearTimeout: clearTimeout,
        Error: Error,
        JSON: JSON,
        String: String,
        parseInt: parseInt,
        isNaN: isNaN
    };
    vm.createContext(sandbox);
    vm.runInContext(code, sandbox, { filename: 'frontend/js/api.js' });
    if (!sandbox.window.api) throw new Error('api.js 没有暴露 window.api');
    return sandbox.window.api;
}

(async function main() {
    if (!(await waitReady())) {
        console.error('服务没起来:\n' + serverLog.slice(-1500));
        server.kill();
        process.exit(1);
    }
    console.log('服务已就绪 ' + BASE);

    var api = loadRealApi();
    console.log('已加载真实的 frontend/js/api.js（vm 内执行）\n');

    var cases = [
        { name: '下单缺客户昵称', url: '/api/orders', body: { projectName: '只有项目名' } },
        { name: '金额为非数字', url: '/api/orders', body: { customerNick: '张三', projectName: 'x', amount: 'abc' } }
    ];

    var allPassed = true;

    for (var i = 0; i < cases.length; i++) {
        var c = cases[i];
        var shown = '';
        var errStatus = null;
        var errCode = null;

        // 每个用例单独计数：两个用例打的是同一个 URL，不清零会累计成「重试了」
        hitCount = {};

        try {
            await api.post(c.url, c.body);
            shown = '(没有抛错，请求成功了)';
        } catch (err) {
            shown = err.message;
            errStatus = err.status;
            errCode = err.code;
        }

        console.log('【' + c.name + '】POST ' + c.url);
        console.log('  发送 body       : ' + JSON.stringify(c.body));
        console.log('  前端 err.message : ' + shown);
        console.log('  err.status/code  : ' + errStatus + ' / ' + errCode);

        var lost = /^HTTP \d+/.test(shown);
        var retried = (hitCount[c.url] || 0) > 1;
        if (lost || retried) allPassed = false;

        console.log('  文案判定         : ' + (lost ? '❌ 仍是状态码，文案丢失' : '✅ 已透传后端文案'));
        console.log('  实际请求次数     : ' + (hitCount[c.url] || 0) +
            (retried ? '  ❌ 4xx 被重试了' : '  ✅ 4xx 没重试'));
        console.log('');
    }

    // 404 也不该重试
    hitCount = {};
    try {
        await api.get('/api/orders/does-not-exist-' + Date.now());
    } catch (e) {
        console.log('【GET 不存在的订单】err.message = ' + e.message + '  (status=' + e.status + ')');
    }
    var getHits = Object.keys(hitCount).reduce(function (n, k) { return n + hitCount[k]; }, 0);
    var getRetried = getHits > 1;
    if (getRetried) allPassed = false;
    console.log('  GET 404 实际请求次数: ' + getHits + (getRetried ? '  ❌ 被重试' : '  ✅ 没重试'));

    console.log('\n================ 总结: ' + (allPassed ? '✅ 全部通过' : '❌ 仍有问题') + ' ================\n');

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
