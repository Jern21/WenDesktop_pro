/**
 * 出站 HTTP 请求（http / https 通用）
 *
 * 唯一实现：routes/image-gen.js 与 routes/llm.js 都从这里取，
 * 不要再在路由里各写一份（两份必然在超时、错误处理上慢慢走偏）。
 *
 * 只管「发出去、把状态码+响应文本拿回来」，不认识任何业务格式。
 */
'use strict';

var https = require('https');
var http = require('http');

var DEFAULT_TIMEOUT_MS = 30000;

/**
 * 超时归一化。
 *
 * 设置页里填的单位是「秒」，但历史数据里存过毫秒值，所以小于 1000 的一律当秒。
 * @param {*} value 原始值
 * @param {number} [fallbackMs] 取不到值时用这个
 */
function normalizeTimeoutMs(value, fallbackMs) {
    var timeout = parseInt(value, 10);
    if (!timeout || timeout <= 0) return fallbackMs || DEFAULT_TIMEOUT_MS;
    return timeout < 1000 ? timeout * 1000 : timeout;
}

/**
 * @param {string} url 完整地址
 * @param {{method?:string, headers?:object, timeout?:*} [options] timeout 会被 normalizeTimeoutMs 处理
 * @param {string} [body]
 * @returns {Promise<{statusCode:number, headers:object, body:string}>}
 */
function request(url, options, body) {
    options = options || {};

    return new Promise(function (resolve, reject) {
        var parsedUrl;
        try {
            parsedUrl = new URL(url);
        } catch (e) {
            return reject(new Error('无效的 API 地址: ' + url));
        }

        var lib = parsedUrl.protocol === 'https:' ? https : http;

        var reqOptions = {
            hostname: parsedUrl.hostname,
            port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
            path: parsedUrl.pathname + parsedUrl.search,
            method: options.method || 'POST',
            headers: options.headers || {}
        };

        var req = lib.request(reqOptions, function (res) {
            var chunks = [];
            res.on('data', function (chunk) { chunks.push(chunk); });
            res.on('end', function () {
                resolve({
                    statusCode: res.statusCode,
                    headers: res.headers,
                    body: Buffer.concat(chunks).toString('utf-8')
                });
            });
        });

        req.on('error', reject);

        var timeoutMs = normalizeTimeoutMs(options.timeout, options.fallbackTimeoutMs);
        req.setTimeout(timeoutMs, function () {
            req.destroy(new Error('请求超时（' + Math.round(timeoutMs / 1000) + 's）'));
        });

        if (body) req.write(body);
        req.end();
    });
}

module.exports = {
    request: request,
    normalizeTimeoutMs: normalizeTimeoutMs,
    DEFAULT_TIMEOUT_MS: DEFAULT_TIMEOUT_MS
};
