/**
 * api.js 重试策略 / 超时 / 取消 单元测试
 *
 * 修的三个问题：
 *   1. 原来无论什么方法失败都重试，包括 POST ——
 *      服务端可能已经写入、只是响应丢了，重试会**重复创建记录**；
 *   2. `config.retryCount || CONFIG.retryCount` 用 || 兜底，
 *      传 retryCount: 0 会被静默换成默认值，等于关不掉重试；
 *   3. CONFIG.timeout = 30000 从来没被用过（代码里没有 AbortController），
 *      调用方的 signal 也没传进 fetch —— 切页时请求不会停。
 *
 * api.js 是浏览器全局 IIFE（最后挂 window.api），这里用 vm 沙箱 + mock fetch 加载。
 */
'use strict';

var fs = require('fs');
var path = require('path');
var vm = require('vm');
var test = require('node:test');
var assert = require('node:assert/strict');

var API_SRC = fs.readFileSync(path.join(__dirname, '..', 'js/api.js'), 'utf-8');

/** 在沙箱里加载 api.js，返回 window.api */
function loadApi(mockFetch) {
    var sandbox = {
        console: console,
        setTimeout: setTimeout,
        clearTimeout: clearTimeout,
        Promise: Promise,
        URLSearchParams: URLSearchParams,
        FormData: FormData,
        AbortController: AbortController,
        fetch: mockFetch,
        window: {}
    };
    vm.createContext(sandbox);
    vm.runInContext(API_SRC, sandbox);
    var api = sandbox.window.api;
    api.config({ retryDelay: 0 });   // 测试里不要真的等 1 秒
    return api;
}

function abortError() {
    var e = new Error('The operation was aborted');
    e.name = 'AbortError';
    return e;
}

/**
 * 模拟「一直不返回、只能被 abort 打断」的请求。
 * 真浏览器里 fetch 拿到已经 aborted 的 signal 会立刻 reject，
 * mock 必须照做，否则请求会永久挂起、测试卡死。
 */
function pendingFetch(onCall) {
    return function (url, options) {
        if (onCall) onCall();
        if (options.signal && options.signal.aborted) return Promise.reject(abortError());
        return new Promise(function (resolve, reject) {
            if (!options.signal) return;   // 没有 signal 就真的永不返回
            options.signal.addEventListener('abort', function () { reject(abortError()); });
        });
    };
}

function okJson(payload) {
    return {
        ok: true,
        status: 200,
        headers: { get: function () { return 'application/json'; } },
        json: function () { return Promise.resolve(payload); },
        text: function () { return Promise.resolve(JSON.stringify(payload)); }
    };
}

test('写请求失败不自动重试（POST 只调一次 fetch）', async function () {
    var calls = 0;
    var api = loadApi(function () {
        calls++;
        return Promise.reject(new Error('network down'));
    });

    await assert.rejects(function () { return api.post('/api/orders', { a: 1 }); }, /network down/);
    assert.equal(calls, 1, 'POST 不能重试，否则可能重复创建记录');
});

test('PUT / DELETE 同样不自动重试', async function () {
    var calls = 0;
    var api = loadApi(function () {
        calls++;
        return Promise.reject(new Error('boom'));
    });

    await assert.rejects(function () { return api.put('/api/orders/1', { a: 1 }); });
    await assert.rejects(function () { return api.delete('/api/orders/1'); });
    assert.equal(calls, 2, 'PUT 与 DELETE 各只尝试一次');
});

test('GET 失败会重试（默认 retryCount=1 → 共 2 次）', async function () {
    var calls = 0;
    var api = loadApi(function () {
        calls++;
        return Promise.reject(new Error('network down'));
    });

    await assert.rejects(function () { return api.get('/api/orders'); });
    assert.equal(calls, 2);
});

test('retryCount: 0 真的能关掉重试（不会被 || 兜底成默认值）', async function () {
    var calls = 0;
    var api = loadApi(function () {
        calls++;
        return Promise.reject(new Error('network down'));
    });

    await assert.rejects(function () {
        return api.get('/api/orders', null, { retryCount: 0 });
    });
    assert.equal(calls, 1, 'retryCount: 0 必须生效');
});

test('retryUnsafe: true 时写请求可以显式开启重试', async function () {
    var calls = 0;
    var api = loadApi(function () {
        calls++;
        return Promise.reject(new Error('network down'));
    });

    await assert.rejects(function () {
        return api.put('/api/orders/1', { a: 1 }, { retryUnsafe: true });
    });
    assert.equal(calls, 2);
});

test('请求成功时正常解析 JSON', async function () {
    var api = loadApi(function () {
        return Promise.resolve(okJson({ success: true, data: { id: 'x' } }));
    });
    var result = await api.get('/api/orders');
    assert.equal(result.success, true);
    assert.equal(result.data.id, 'x');
});

test('超时会中止请求并抛出 ETIMEDOUT（原来 timeout 配置完全没生效）', async function () {
    var api = loadApi(pendingFetch());

    var err = await api.get('/api/slow', null, { timeout: 60 }).then(
        function () { return null; },
        function (e) { return e; }
    );

    assert.ok(err, '必须抛错');
    assert.equal(err.code, 'ETIMEDOUT', '超时错误应带 code=ETIMEDOUT，实际：' + err.message);
    assert.match(err.message, /请求超时/);
});

test('超时不重试（避免总耗时翻倍）', async function () {
    var calls = 0;
    var api = loadApi(pendingFetch(function () { calls++; }));

    await assert.rejects(function () { return api.get('/api/slow', null, { timeout: 50 }); });
    assert.equal(calls, 1);
});

test('调用方 signal 能取消请求，且取消后不重试', async function () {
    var calls = 0;
    var api = loadApi(pendingFetch(function () { calls++; }));

    var controller = new AbortController();
    var p = api.get('/api/orders', null, { signal: controller.signal, timeout: 5000 });
    setTimeout(function () { controller.abort(); }, 40);

    var err = await p.then(function () { return null; }, function (e) { return e; });
    assert.ok(err, '必须抛错');
    assert.equal(err.name, 'AbortError', '应保留 AbortError 而不是变成超时错误');
    assert.equal(calls, 1, '取消是调用方的意图，不能重试');
});

test('signal 已经 aborted 时立刻失败', async function () {
    var calls = 0;
    var api = loadApi(pendingFetch(function () { calls++; }));

    var controller = new AbortController();
    controller.abort();

    await assert.rejects(function () {
        return api.get('/api/orders', null, { signal: controller.signal });
    });
    assert.equal(calls, 1);
});

test('api.call 对 POST 不自动重试，并 JSON 序列化 body', async function () {
    var calls = 0;
    var lastBody = null;
    var api = loadApi(function (url, options) {
        calls++;
        lastBody = options.body;
        return Promise.reject(new Error('network down'));
    });

    await assert.rejects(function () {
        return api.call('/api/customers', { method: 'POST', body: { name: '张先生' } });
    }, /network down/);
    assert.equal(calls, 1, 'call(POST) 不能重试');
    assert.equal(lastBody, JSON.stringify({ name: '张先生' }));
});

test('请求拦截器改写 method 后，按新方法决定是否重试', async function () {
    var calls = 0;
    var api = loadApi(function () {
        calls++;
        return Promise.reject(new Error('network down'));
    });

    // 把 GET 改成 POST：拦截器有权这么干，重试策略必须听改写后的
    api.interceptors.request(function (cfg) {
        cfg.method = 'POST';
        return cfg;
    });

    await assert.rejects(function () { return api.get('/api/orders'); });
    assert.equal(calls, 1, '改写为 POST 后不应重试');
});

// ============ 非 2xx 的错误文案 ============
//
// 原来这里直接 throw new Error('HTTP ' + status + ': ' + statusText)，从不读 body。
// 后端明明返回 {"error":"客户昵称为必填项"}，用户界面却统一显示
// 「保存失败：HTTP 400: Bad Request」—— 哪一项填错了完全看不出来。

/** 模拟非 2xx 响应 */
function errResponse(status, body, contentType) {
    return {
        ok: false,
        status: status,
        statusText: status === 400 ? 'Bad Request' : (status === 404 ? 'Not Found' : 'Server Error'),
        headers: { get: function () { return contentType || 'application/json'; } },
        json: function () { return Promise.resolve(JSON.parse(body)); },
        text: function () { return Promise.resolve(body); }
    };
}

test('非 2xx 时 err.message 用后端的中文文案，而不是 HTTP 状态码', async function () {
    var api = loadApi(function () {
        return Promise.resolve(errResponse(400, JSON.stringify({
            success: false, error: '客户昵称为必填项'
        })));
    });

    await assert.rejects(
        function () { return api.post('/api/orders', {}); },
        function (err) {
            assert.equal(err.message, '客户昵称为必填项');
            assert.equal(err.status, 400);
            assert.equal(err.code, 'HTTP_400');
            assert.equal(err.isHttpError, true);
            return true;
        }
    );
});

test('后端返回 code 字段时原样带出（便于前端按错误类型分支）', async function () {
    var api = loadApi(function () {
        return Promise.resolve(errResponse(404, JSON.stringify({
            success: false, error: '订单不存在', code: 'ORDER_NOT_FOUND'
        })));
    });

    await assert.rejects(
        function () { return api.get('/api/orders/x'); },
        function (err) {
            assert.equal(err.message, '订单不存在');
            assert.equal(err.code, 'ORDER_NOT_FOUND');
            assert.equal(err.status, 404);
            return true;
        }
    );
});

test('4xx 不重试（GET 也一样）—— 重试注定失败，白打一次请求', async function () {
    var calls = 0;
    var api = loadApi(function () {
        calls++;
        return Promise.resolve(errResponse(404, JSON.stringify({ error: '订单不存在' })));
    });

    await assert.rejects(function () { return api.get('/api/orders/nope'); });
    assert.equal(calls, 1, '404 属于 4xx，不能重试');
});

test('5xx 仍按幂等方法重试（服务端临时故障值得再试一次）', async function () {
    var calls = 0;
    var api = loadApi(function () {
        calls++;
        return Promise.resolve(errResponse(500, JSON.stringify({ error: '数据库连接失败' })));
    });

    await assert.rejects(function () { return api.get('/api/orders'); });
    assert.equal(calls, 2, 'GET + 500 应该重试 1 次');
});

test('服务端返回 HTML 错误页时不把标签糊到用户脸上', async function () {
    var api = loadApi(function () {
        return Promise.resolve(errResponse(500, '<!DOCTYPE html><html><body>stack...</body></html>', 'text/html'));
    });

    await assert.rejects(
        function () { return api.get('/api/orders'); },
        function (err) {
            assert.ok(err.message.indexOf('<') === -1, '不能把 HTML 标签当错误文案：' + err.message);
            assert.match(err.message, /HTTP 500/);
            return true;
        }
    );
});
