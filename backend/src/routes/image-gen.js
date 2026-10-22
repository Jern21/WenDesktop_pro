/**
 * AI 图片生成路由
 *
 * 作为前端与第三方 AI 生图 API 之间的代理层。
 * API 地址和密钥在「设置中心 → AI生图配置」中维护，持久化到 data/settings.json。
 *
 * 默认兼容 OpenAI Images API 格式（POST JSON，Bearer 鉴权，返回 { data:[{ url }] }），
 * 同时自动适配多种常见响应结构。
 *
 * API：
 *   GET    /api/image-gen/config     - 读取生图配置（密钥脱敏）
 *   PUT    /api/image-gen/config     - 更新生图配置
 *   POST   /api/image-gen/generate   - 调用第三方 API 生成图片
 *   POST   /api/image-gen/test       - 测试 API 连通性（轻量探测）
 */
'use strict';

var express = require('express');
var router = express.Router();
var https = require('https');
var http = require('http');
var resp = require('../utils/response');
var settingsRepository = require('../utils/settings-repository');
var dataBackups = require('../utils/data-backups');
var outboundHttp = require('../utils/outbound-http');

var DEFAULT_CONFIG = {
    apiUrl: '',
    apiKey: '',
    model: 'dall-e-3',
    timeout: 90000
};

function normalizeImageApiUrl(value) {
    var apiUrl = String(value || '').trim();
    if (!apiUrl) return '';

    var parsedUrl;
    try {
        parsedUrl = new URL(apiUrl);
    } catch (e) {
        return apiUrl;
    }

    var pathname = parsedUrl.pathname.replace(/\/+$/, '');
    if (!pathname || pathname === '/') {
        parsedUrl.pathname = '/v1/images/generations';
        return parsedUrl.toString();
    }
    if (/\/images\/generations$/i.test(pathname)) {
        parsedUrl.pathname = pathname;
        return parsedUrl.toString();
    }
    if (/\/v1$/i.test(pathname)) {
        parsedUrl.pathname = pathname + '/images/generations';
        return parsedUrl.toString();
    }

    return apiUrl;
}

function formatResponsePreview(response) {
    var contentType = response.headers && response.headers['content-type']
        ? String(response.headers['content-type']).split(';')[0]
        : 'unknown';
    var snippet = String(response.body || '')
        .replace(/<script[\s\S]*?<\/script>/gi, '')
        .replace(/<style[\s\S]*?<\/style>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 180);
    return 'HTTP ' + response.statusCode + ' / ' + contentType + (snippet ? ' / ' + snippet : '');
}

function getConfig(scope) {
    var settings = settingsRepository.read(scope || dataBackups.captureScope());
    return Object.assign({}, DEFAULT_CONFIG, settings.imageGen || {});
}

// ========== 从多种响应格式中提取图片地址 ==========

function extractImageUrl(body) {
    // 1. OpenAI 格式: { data: [{ url: "..." }] } 或 { data: [{ b64_json: "..." }] }
    if (body.data && Array.isArray(body.data) && body.data.length > 0) {
        if (body.data[0].url) return body.data[0].url;
        if (body.data[0].b64_json) return 'data:image/png;base64,' + body.data[0].b64_json;
    }
    // 2. 直接返回 { url: "..." }
    if (body.url) return body.url;
    // 3. { image: "..." }
    if (body.image) return body.image;
    // 4. { output: "..." } 或 { output: ["..."] }（Replicate 风格）
    if (body.output) {
        return Array.isArray(body.output) ? body.output[0] : body.output;
    }
    // 5. { images: [{ url: "..." }] }（部分国内 API）
    if (body.images && Array.isArray(body.images) && body.images.length > 0) {
        if (body.images[0].url) return body.images[0].url;
        if (typeof body.images[0] === 'string') return body.images[0];
    }
    // 6. { result: { url: "..." } }
    if (body.result && body.result.url) return body.result.url;
    // 7. { b64: "..." } 纯 base64
    if (body.b64) return 'data:image/png;base64,' + body.b64;

    return '';
}

// ========== 宽高比 → 像素尺寸映射 ==========

var RATIO_SIZE_MAP = {
    '1:1': '1024x1024',
    '16:9': '1792x1024',
    '9:16': '1024x1792',
    '4:3': '1344x1024',
    '3:4': '1024x1344'
};

// ========== 路由 ==========

// 读取配置（密钥脱敏）
router.get('/config', resp.asyncHandler(function (req, res) {
    var config = getConfig();
    var masked = {
        apiUrl: config.apiUrl,
        model: config.model,
        timeout: config.timeout,
        apiKeyMasked: config.apiKey ? (config.apiKey.slice(0, 4) + '****' + config.apiKey.slice(-4)) : '',
        apiKeyConfigured: !!config.apiKey
    };
    return resp.success(res, masked);
}));

// 更新配置
router.put('/config', resp.asyncHandler(function (req, res) {
    var scope = dataBackups.captureScope();
    var settings = settingsRepository.read(scope);
    settings.imageGen = settings.imageGen || {};

    var body = req.body || {};
    if (typeof body.apiUrl === 'string') settings.imageGen.apiUrl = body.apiUrl.trim();
    if (typeof body.model === 'string') settings.imageGen.model = body.model.trim();
    if (body.timeout !== undefined) settings.imageGen.timeout = parseInt(body.timeout, 10) || 90000;
    // 仅当传入的 apiKey 不含脱敏标记时才更新
    if (typeof body.apiKey === 'string' && body.apiKey.indexOf('****') === -1 && body.apiKey.length > 0) {
        settings.imageGen.apiKey = body.apiKey.trim();
    }

    settingsRepository.save(settings, { scope: scope });
    return resp.success(res, { message: '配置已保存' });
}));

// 生成图片
router.post('/generate', resp.asyncHandler(async function (req, res) {
    var config = getConfig();
    var prompt = (req.body && req.body.prompt) || '';
    var ratio = (req.body && req.body.ratio) || '1:1';
    var size = RATIO_SIZE_MAP[ratio] || '1024x1024';

    if (!prompt.trim()) {
        return resp.error(res, '请提供提示词');
    }

    if (!config.apiUrl || !config.apiKey) {
        return resp.error(res, 'AI生图服务未配置，请先在「设置中心 → AI生图配置」中填写API地址和密钥', 400);
    }

    // 构建请求体（OpenAI 兼容格式）
    var requestBody = JSON.stringify({
        model: config.model || 'dall-e-3',
        prompt: prompt,
        n: 1,
        size: size
    });

    try {
        var apiUrl = normalizeImageApiUrl(config.apiUrl);
        var response = await outboundHttp.request(apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + config.apiKey
            },
            timeout: outboundHttp.normalizeTimeoutMs(config.timeout, DEFAULT_CONFIG.timeout)
        }, requestBody);

        if (response.statusCode < 200 || response.statusCode >= 300) {
            var errMsg = 'AI生图服务返回错误（HTTP ' + response.statusCode + '）';
            try {
                var errBody = JSON.parse(response.body);
                if (errBody.error && errBody.error.message) {
                    errMsg = errBody.error.message;
                } else if (errBody.message) {
                    errMsg = errBody.message;
                } else if (errBody.detail) {
                    errMsg = typeof errBody.detail === 'string' ? errBody.detail : JSON.stringify(errBody.detail);
                }
            } catch (e) {
                errMsg += '：' + formatResponsePreview(response);
            }
            return resp.error(res, errMsg, response.statusCode >= 400 && response.statusCode < 500 ? response.statusCode : 500);
        }

        var result;
        try {
            result = JSON.parse(response.body);
        } catch (e) {
            return resp.error(res, 'AI生图服务返回了非JSON格式的数据，请检查API地址是否正确：' + formatResponsePreview(response));
        }

        var imageUrl = extractImageUrl(result);

        if (!imageUrl) {
            return resp.error(res, '无法从API响应中解析图片地址，请检查API返回格式或联系开发者适配');
        }

        return resp.success(res, {
            imageUrl: imageUrl,
            prompt: prompt,
            size: size,
            model: config.model
        });
    } catch (e) {
        var msg = e.message || '未知错误';
        if (msg.indexOf('ENOTFOUND') !== -1) msg = '无法连接到API服务器，请检查API地址是否正确';
        if (msg.indexOf('ECONNREFUSED') !== -1) msg = 'API服务器拒绝连接，请确认服务是否可用';
        if (msg.indexOf('ETIMEDOUT') !== -1 || msg.indexOf('超时') !== -1) msg = '请求超时，请稍后重试或增加超时时间';
        return resp.error(res, '调用AI生图服务失败: ' + msg, 500);
    }
}));

// 测试连通性（发送一个最小请求，不消耗大量资源）
router.post('/test', resp.asyncHandler(async function (req, res) {
    var config = getConfig();

    if (!config.apiUrl) {
        return resp.error(res, '请先填写API地址');
    }
    if (!config.apiKey) {
        return resp.error(res, '请先填写API密钥');
    }

    // 发送一个带简短 prompt 的请求来验证连通性和鉴权
    // 使用最小 size 以减少消耗
    var requestBody = JSON.stringify({
        model: config.model || 'dall-e-3',
        prompt: 'a dot',
        n: 1,
        size: '1024x1024'
    });

    try {
        var apiUrl = normalizeImageApiUrl(config.apiUrl);
        var response = await outboundHttp.request(apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + config.apiKey
            },
            timeout: outboundHttp.normalizeTimeoutMs(config.timeout, DEFAULT_CONFIG.timeout)
        }, requestBody);

        if (response.statusCode >= 200 && response.statusCode < 300) {
            return resp.success(res, { status: 'ok', message: '连接成功，API配置有效' });
        } else if (response.statusCode === 401 || response.statusCode === 403) {
            return resp.error(res, '鉴权失败，请检查API密钥是否正确');
        } else if (response.statusCode === 404) {
            return resp.error(res, 'API地址不存在（404），请检查URL是否正确');
        } else {
            // 其他状态码：服务可达但可能有参数问题
            var detail = '';
            try {
                var errBody = JSON.parse(response.body);
                detail = errBody.error && errBody.error.message ? errBody.error.message : (errBody.message || '');
            } catch (e) {
                detail = formatResponsePreview(response);
            }
            return resp.error(res, '服务可达但返回异常（HTTP ' + response.statusCode + '）' + (detail ? ': ' + detail : ''));
        }
    } catch (e) {
        var msg = e.message || '未知错误';
        if (msg.indexOf('ENOTFOUND') !== -1) msg = '无法解析域名，请检查API地址';
        if (msg.indexOf('ECONNREFUSED') !== -1) msg = '服务器拒绝连接';
        if (msg.indexOf('超时') !== -1) msg = '连接超时';
        return resp.error(res, '连接失败: ' + msg);
    }
}));

// 代理下载图片（解决前端 CORS 跨域下载问题）
router.get('/proxy', function (req, res) {
    var targetUrl = req.query.url;
    if (!targetUrl) {
        return resp.error(res, '缺少 url 参数');
    }

    // data URI 直接返回
    if (targetUrl.indexOf('data:') === 0) {
        var matches = targetUrl.match(/^data:([^;]+);base64,(.*)$/);
        if (matches) {
            var buf = Buffer.from(matches[2], 'base64');
            res.setHeader('Content-Type', matches[1]);
            res.setHeader('Content-Disposition', 'attachment; filename="canvas_' + Date.now() + '.png"');
            return res.send(buf);
        }
        return resp.error(res, '无效的 data URI');
    }

    var parsedUrl;
    try {
        parsedUrl = new URL(targetUrl);
    } catch (e) {
        return resp.error(res, '无效的图片地址');
    }

    var lib = parsedUrl.protocol === 'https:' ? https : http;

    var proxyReq = lib.get(targetUrl, { timeout: 30000 }, function (proxyRes) {
        if (proxyRes.statusCode !== 200) {
            return resp.error(res, '获取图片失败（HTTP ' + proxyRes.statusCode + '）', 500);
        }
        var contentType = proxyRes.headers['content-type'] || 'image/png';
        res.setHeader('Content-Type', contentType);
        res.setHeader('Content-Disposition', 'attachment; filename="canvas_' + Date.now() + '.png"');
        proxyRes.pipe(res);
    });

    proxyReq.on('error', function (e) {
        if (!res.headersSent) {
            return resp.error(res, '下载失败: ' + e.message, 500);
        }
    });

    proxyReq.on('timeout', function () {
        proxyReq.destroy(new Error('下载超时'));
    });
});

module.exports = router;
