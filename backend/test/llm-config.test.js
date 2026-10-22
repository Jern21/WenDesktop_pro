/**
 * 大模型配置 + 对话代理测试（独立数据目录，不起真实外网请求）
 *
 *   node backend/test/llm-config.test.js
 *
 * 上游是本地起的一个假 OpenAI 兼容服务，所以：
 *   · 不需要真 API Key，也不需要联网
 *   · 能断言「我们到底发了什么过去」（URL、Authorization、messages 结构）
 *
 * 覆盖：
 *   [1] settings-repository：llm.apiKey 的加密 / 脱敏 / 防覆盖（纯逻辑）
 *   [2] outbound-http.normalizeTimeoutMs 的单位归一
 *   [3] 未配置时 /chat 返回 200 + configured:false（**不能是 4xx**）
 *   [4] 保存配置：接口只回脱敏值，磁盘上是 enc:v1: 密文，回写脱敏值不覆盖真密钥
 *   [5] /test 与 /chat 真的打到上游：Bearer、path、system prompt 与 history 顺序
 *   [6] 失败路径：上游 5xx → 502、上游不响应 → 超时、空消息 → 400
 *   [7] clearApiKey 能把密钥删掉并退回未配置
 */
'use strict';

var fs = require('fs');
var os = require('os');
var path = require('path');
var http = require('http');
var assert = require('assert');

// ========== 环境准备必须在任何 require 之前 ==========

var TMP_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'wt-llm-test-'));
var DATA_DIR = path.join(TMP_DIR, 'data');
fs.mkdirSync(DATA_DIR, { recursive: true });

process.env.APP_DATA_DIR = DATA_DIR;
process.env.AUTH_DATA_DIR = path.join(TMP_DIR, 'auth');
process.env.AUTH_ENABLED = '0';          // 免登录（注意：此时接口仍算 admin，见下方 API_SCOPE）
process.env.APP_USERNAME = 'llmtest';    // 让"接口到底写到哪个目录"这件事变得可断言
delete process.env.APP_PASSWORD;

var settingsRepository = require('../src/utils/settings-repository');
var dataBackups = require('../src/utils/data-backups');
var outboundHttp = require('../src/utils/outbound-http');

var passed = 0;
var failed = 0;

/**
 * AUTH_ENABLED=0 时 getSessionFromRequest() 会直接返回 { username: getUsername() }
 * （auth.js:292），也就是**所有请求都会被当成 admin 账号**，数据落 users/<APP_USERNAME>/，
 * 而不是 data 根目录。这不是 bug，但测试里必须跟着走，否则会读错文件。
 */
var API_SCOPE = { username: 'llmtest' };

function apiSettingsFile() {
    return dataBackups.getDataFilePath('settings', API_SCOPE);
}

/** 纯净的逻辑测试用独立账号，别和接口那份数据混在一起 */
var UNIT_SCOPE = { username: 'llm-unit' };

function test(name, fn) {
    var out = fn();
    if (out && typeof out.then === 'function') {
        return out.then(function () {
            passed++;
            console.log('  PASS  ' + name);
        }, function (e) {
            failed++;
            console.log('  FAIL  ' + name);
            console.log('        ' + (e && e.message));
        });
    }
    passed++;
    console.log('  PASS  ' + name);
    return Promise.resolve();
}

/** 递归找出所有 settings.json（不管数据最终落在根目录还是用户目录，都能查到） */
function findSettingsFiles(dir) {
    var out = [];
    (function walk(current) {
        var entries;
        try {
            entries = fs.readdirSync(current, { withFileTypes: true });
        } catch (e) {
            return;
        }
        entries.forEach(function (entry) {
            var full = path.join(current, entry.name);
            if (entry.isDirectory()) {
                if (entry.name === 'backups' || entry.name === 'node_modules') return;
                walk(full);
            } else if (entry.name === 'settings.json') {
                out.push(full);
            }
        });
    })(dir);
    return out;
}

// ========== [1] settings-repository 的密钥路径 ==========

function runRepositoryTests() {
    console.log('\n[1] settings-repository：SECRET_PATHS 覆盖 llm.apiKey');

    return test('llm.apiKey 落盘为密文，读回为明文', function () {
        var settings = settingsRepository.read(UNIT_SCOPE);
        settings.llm = { apiUrl: 'https://api.example.com/v1', model: 'm', timeout: 60, apiKey: 'sk-plain-abcdefgh' };
        settingsRepository.save(settings, { scope: UNIT_SCOPE });

        var file = dataBackups.getDataFilePath('settings', UNIT_SCOPE);
        assert.ok(fs.existsSync(file), '没有生成 settings.json：' + file);

        var raw = fs.readFileSync(file, 'utf-8');
        assert.ok(raw.indexOf('sk-plain-abcdefgh') === -1, '磁盘上不应出现明文密钥');
        assert.ok(raw.indexOf('enc:v1:') !== -1, '磁盘上应出现 enc:v1: 密文');

        var back = settingsRepository.read(UNIT_SCOPE);
        assert.strictEqual(back.llm.apiKey, 'sk-plain-abcdefgh', '读回时应已解密');
    })
    .then(function () {
        return test('maskSecrets 同时脱敏 imageGen 与 llm，并给出 apiKeyConfigured', function () {
            var masked = settingsRepository.maskSecrets({
                imageGen: { apiKey: 'sk-image-1234567' },
                llm: { apiKey: 'sk-llm-abcdefgh' }
            });
            assert.strictEqual(masked.imageGen.apiKey, 'sk-i****4567');
            assert.strictEqual(masked.llm.apiKey, 'sk-l****efgh');
            assert.strictEqual(masked.imageGen.apiKeyConfigured, true);
            assert.strictEqual(masked.llm.apiKeyConfigured, true);
        });
    })
    .then(function () {
        return test('stripMaskedSecrets 丢弃 llm 的脱敏值，不动真值', function () {
            var out = settingsRepository.stripMaskedSecrets({
                llm: { apiKey: 'sk-l****efgh', model: 'x' },
                imageGen: { apiKey: 'sk-real-key-here' }
            });
            assert.strictEqual(out.llm.apiKey, undefined, '脱敏值必须被丢掉');
            assert.strictEqual(out.llm.model, 'x', '非密钥字段应保留');
            assert.strictEqual(out.imageGen.apiKey, 'sk-real-key-here', '明文新密钥不能被误删');
        });
    })
    .then(function () {
        return test('空密钥不加密、不报错', function () {
            var out = settingsRepository.maskSecrets({ llm: { apiKey: '' } });
            assert.strictEqual(out.llm.apiKey, '');
            assert.strictEqual(out.llm.apiKeyConfigured, false);
        });
    });
}

// ========== [2] 超时归一化 ==========

function runTimeoutTests() {
    console.log('\n[2] outbound-http.normalizeTimeoutMs');

    return test('小于 1000 当秒，其余当毫秒', function () {
        assert.strictEqual(outboundHttp.normalizeTimeoutMs(60, 30000), 60000);
        assert.strictEqual(outboundHttp.normalizeTimeoutMs('5', 30000), 5000);
        assert.strictEqual(outboundHttp.normalizeTimeoutMs(30000, 30000), 30000);
    })
    .then(function () {
        return test('空值/非法值退回 fallback', function () {
            assert.strictEqual(outboundHttp.normalizeTimeoutMs(0, 30000), 30000);
            assert.strictEqual(outboundHttp.normalizeTimeoutMs(null, 30000), 30000);
            assert.strictEqual(outboundHttp.normalizeTimeoutMs('abc', 30000), 30000);
            assert.strictEqual(outboundHttp.normalizeTimeoutMs(undefined), outboundHttp.DEFAULT_TIMEOUT_MS);
        });
    });
}

// ========== 假上游 ==========

var upstream = {
    mode: 'ok',
    lastRequest: null,
    server: null,
    port: 0
};

function startUpstream() {
    return new Promise(function (resolve) {
        var server = http.createServer(function (req, res) {
            var chunks = [];
            req.on('data', function (c) { chunks.push(c); });
            req.on('end', function () {
                var raw = Buffer.concat(chunks).toString('utf-8');
                var parsed = null;
                try { parsed = JSON.parse(raw); } catch (e) { /* 上游只需要记录原文 */ }

                upstream.lastRequest = {
                    method: req.method,
                    url: req.url,
                    authorization: req.headers.authorization || '',
                    body: parsed,
                    raw: raw
                };

                if (upstream.mode === 'error') {
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: { message: '模型炸了' } }));
                    return;
                }

                if (upstream.mode === 'slow') {
                    var timer = setTimeout(function () {
                        res.writeHead(200, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ choices: [{ message: { content: '太慢了' } }] }));
                    }, 5000);
                    req.on('close', function () { clearTimeout(timer); });
                    return;
                }

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    choices: [{ message: { role: 'assistant', content: '收到，汪' } }]
                }));
            });
        });

        server.listen(0, '127.0.0.1', function () {
            upstream.server = server;
            upstream.port = server.address().port;
            resolve();
        });
    });
}

// ========== 后端实例 ==========

var backendPort = 0;
var BASE = '';

function pickFreePort() {
    return new Promise(function (resolve, reject) {
        var probe = http.createServer(function (req, res) { res.end('probe'); });
        probe.listen(0, '127.0.0.1', function () {
            var port = probe.address().port;
            probe.close(function () { resolve(port); });
        });
        probe.on('error', reject);
    });
}

function startBackend() {
    return pickFreePort().then(function (port) {
        backendPort = port;
        BASE = 'http://127.0.0.1:' + port;
        process.env.PORT = String(port);
        require('../server.js');
        return waitForHealth();
    });
}

function waitForHealth() {
    var deadline = Date.now() + 15000;
    return new Promise(function (resolve, reject) {
        (function poll() {
            callApi('GET', '/api/health').then(function (result) {
                if (result.body && result.body.data && result.body.data.service === 'wen-workbench-backend') {
                    return resolve();
                }
                retry();
            }, retry);
        })();

        function retry() {
            if (Date.now() > deadline) return reject(new Error('后端未在 15s 内就绪（端口 ' + backendPort + '）'));
            setTimeout(poll, 200);
        }
    });
}

/** 直接 fetch，不包薄壳：本文件就是要看原始 HTTP 行为 */
function callApi(method, url, body) {
    var options = { method: method, headers: {} };
    if (body !== undefined) {
        options.headers['Content-Type'] = 'application/json';
        options.body = JSON.stringify(body);
    }
    return fetch(BASE + url, options).then(function (res) {
        return res.text().then(function (text) {
            var parsed = null;
            try { parsed = JSON.parse(text); } catch (e) { /* 保留原文 */ }
            return { status: res.status, body: parsed, raw: text };
        });
    });
}

// ========== [3]~[8] 接口层 ==========

function runApiTests() {
    console.log('\n[3] 未配置状态：不是错误');

    return test('GET /config 初始为未配置', function () {
        return callApi('GET', '/api/llm/config').then(function (r) {
            assert.strictEqual(r.status, 200);
            assert.strictEqual(r.body.success, true);
            assert.strictEqual(r.body.data.configured, false);
            assert.strictEqual(r.body.data.apiKeyConfigured, false);
            return r;
        });
    })
    .then(function () {
        return test('/chat 未配置时返回 200 + configured:false + 中文提示', function () {
            return callApi('POST', '/api/llm/chat', { message: '你好' }).then(function (r) {
                assert.strictEqual(r.status, 200, '未配置不能返回 4xx，否则前端会把常态当异常');
                assert.strictEqual(r.body.success, true);
                assert.strictEqual(r.body.data.configured, false);
                assert.strictEqual(r.body.data.reason, 'not-configured');
                assert.ok(r.body.data.hint.indexOf('大模型配置') !== -1, '应提示去设置中心');
                assert.strictEqual(upstream.lastRequest, null, '未配置时不应发起任何出站请求');
            });
        });
    })
    .then(function () {
        console.log('\n[4] 保存配置：脱敏与加密');

        return test('PUT /config 保存后，接口只回脱敏密钥', function () {
            return callApi('PUT', '/api/llm/config', {
                apiUrl: 'http://127.0.0.1:' + upstream.port + '/v1',
                apiKey: 'sk-test-abcdefgh1234',
                model: 'fake-model',
                timeout: 30
            }).then(function (r) {
                assert.strictEqual(r.status, 200);
                assert.ok(r.raw.indexOf('sk-test-abcdefgh1234') === -1, '响应里不能出现完整密钥');
                return callApi('GET', '/api/llm/config');
            }).then(function (r) {
                assert.strictEqual(r.body.data.configured, true);
                assert.strictEqual(r.body.data.apiKeyMasked, 'sk-t****1234');
                assert.ok(r.raw.indexOf('sk-test-abcdefgh1234') === -1, 'GET /config 也不能吐明文密钥');
            });
        });
    })
    .then(function () {
        return test('磁盘上 llm.apiKey 是密文（全目录扫一遍，任何 settings.json 都不许有明文）', function () {
            var file = apiSettingsFile();
            assert.ok(fs.existsSync(file), '接口没有写到预期位置：' + file);

            var files = findSettingsFiles(DATA_DIR);
            var raw = files.map(function (f) { return fs.readFileSync(f, 'utf-8'); }).join('\n');
            assert.ok(raw.indexOf('sk-test-abcdefgh1234') === -1, '磁盘上不应出现明文密钥');
            assert.ok(raw.indexOf('enc:v1:') !== -1, '磁盘上应有 enc:v1: 密文');
        });
    })
    .then(function () {
        return test('回写脱敏值不会覆盖真密钥', function () {
            return callApi('PUT', '/api/llm/config', {
                apiUrl: 'http://127.0.0.1:' + upstream.port + '/v1',
                apiKey: 'sk-t****1234',
                model: 'fake-model',
                timeout: 30
            }).then(function () {
                var saved = settingsRepository.read(API_SCOPE);
                assert.strictEqual(saved.llm.apiKey, 'sk-test-abcdefgh1234', '脱敏值不能被当成新密钥写盘');
            });
        });
    })
    .then(function () {
        console.log('\n[5] /test 与 /chat 真的打到上游');

        upstream.mode = 'ok';
        upstream.lastRequest = null;

        return test('/test 带 Bearer 打到 /v1/chat/completions', function () {
            return callApi('POST', '/api/llm/test').then(function (r) {
                assert.strictEqual(r.status, 200);
                assert.ok(r.body.data.message.indexOf('收到') !== -1, '应带回模型回复：' + r.body.data.message);
                assert.ok(upstream.lastRequest, '上游没收到请求');
                assert.strictEqual(upstream.lastRequest.url, '/v1/chat/completions');
                assert.strictEqual(upstream.lastRequest.authorization, 'Bearer sk-test-abcdefgh1234');
                assert.strictEqual(upstream.lastRequest.body.model, 'fake-model');
            });
        });
    })
    .then(function () {
        upstream.lastRequest = null;

        return test('/chat 组装 system + history + 当前消息', function () {
            return callApi('POST', '/api/llm/chat', {
                message: '今天几号',
                history: [
                    { role: 'user', text: '在吗' },
                    { role: 'assistant', text: '在的汪' },
                    { role: 'system', text: '这条应被丢掉' },
                    { role: 'user', text: '   ' }
                ]
            }).then(function (r) {
                assert.strictEqual(r.status, 200);
                assert.strictEqual(r.body.data.configured, true);
                assert.strictEqual(r.body.data.reply, '收到，汪');

                var messages = upstream.lastRequest.body.messages;
                assert.strictEqual(messages[0].role, 'system', 'system prompt 必须排第一');
                assert.ok(messages[0].content.indexOf('小柴') !== -1, 'system prompt 应设定小柴人设');
                assert.deepStrictEqual(
                    messages.slice(1),
                    [
                        { role: 'user', content: '在吗' },
                        { role: 'assistant', content: '在的汪' },
                        { role: 'user', content: '今天几号' }
                    ],
                    'history 应被清洗（丢系统消息与空白），当前消息排最后'
                );
            });
        });
    })
    .then(function () {
        console.log('\n[6] 失败路径：错误要能被前端读懂');

        upstream.mode = 'error';

        return test('上游 500 → 502 + 中文提示（含原始报文）', function () {
            return callApi('POST', '/api/llm/chat', { message: '你好' }).then(function (r) {
                assert.strictEqual(r.status, 502, '上游 5xx 应转成 502，不能原样透传成 500');
                assert.strictEqual(r.body.success, false);
                assert.ok(r.body.error.indexOf('调用大模型失败') !== -1, r.body.error);
                assert.ok(r.body.error.indexOf('模型炸了') !== -1, '应带上游错误详情：' + r.body.error);
            });
        });
    })
    .then(function () {
        upstream.mode = 'slow';

        return test('上游不响应 → 超时被兜住（中文）', function () {
            // 把超时压到 1 秒：normalizeTimeoutMs 会把 <1000 当秒
            return callApi('PUT', '/api/llm/config', { timeout: 1 }).then(function () {
                return callApi('POST', '/api/llm/chat', { message: '在吗' });
            }).then(function (r) {
                assert.strictEqual(r.body.success, false);
                assert.ok(r.body.error.indexOf('超时') !== -1, '应提示超时：' + r.body.error);
            });
        });
    })
    .then(function () {
        upstream.mode = 'ok';
        return test('空消息直接拒绝', function () {
            return callApi('POST', '/api/llm/chat', { message: '   ' }).then(function (r) {
                assert.strictEqual(r.status, 400);
                assert.ok(r.body.error.indexOf('不能为空') !== -1);
            });
        });
    })
    .then(function () {
        console.log('\n[7] 删除密钥');

        return test('clearApiKey:true 清空密钥并回到未配置', function () {
            return callApi('PUT', '/api/llm/config', { clearApiKey: true })
                .then(function () { return callApi('GET', '/api/llm/config'); })
                .then(function (r) {
                    assert.strictEqual(r.body.data.apiKeyConfigured, false);
                    assert.strictEqual(r.body.data.configured, false);
                    assert.strictEqual(settingsRepository.read(API_SCOPE).llm.apiKey, '', '密钥应被清空');
                    return callApi('POST', '/api/llm/chat', { message: '还在吗' });
                })
                .then(function (r) {
                    assert.strictEqual(r.status, 200);
                    assert.strictEqual(r.body.data.configured, false, '删掉密钥后应退回未配置话术');
                });
        });
    });
}

// ========== 收尾 ==========

function cleanup() {
    if (upstream.server) {
        try { upstream.server.close(); } catch (e) { /* ignore */ }
    }
    try {
        fs.rmSync(TMP_DIR, { recursive: true, force: true });
    } catch (e) {
        console.log('  （临时目录未清理：' + TMP_DIR + '）');
    }
}

function summary() {
    console.log('\n' + '─'.repeat(60));
    console.log('结果：' + passed + ' 通过，' + failed + ' 失败');
    console.log('─'.repeat(60));
}

runRepositoryTests()
    .then(runTimeoutTests)
    .then(startUpstream)
    .then(startBackend)
    .then(runApiTests)
    .then(function () {
        cleanup();
        summary();
        process.exit(failed === 0 ? 0 : 1);
    })
    .catch(function (err) {
        console.error('\n测试脚本异常：', err);
        cleanup();
        process.exit(1);
    });
