/**
 * 大模型对话路由（OpenAI 兼容 /v1/chat/completions）
 *
 * 谁在用：设置中心「大模型配置」维护，侧栏小柴犬对话窗口调用 /chat。
 *
 * 设计要点：
 *   1. **未配置不是错误**。返回 200 + { configured:false }，
 *      让前端自己走"你还没接大模型"的话术 —— 用 4xx 会让前端把常态当异常处理。
 *   2. 密钥走 settings.json 的 llm.apiKey，落盘由 settings-repository 加密（enc:v1:）。
 *   3. 出站请求复用 utils/outbound-http.js，不要在路由里再写一份。
 *
 * API：
 *   GET  /api/llm/config   - 读取配置（密钥脱敏）
 *   PUT  /api/llm/config   - 更新配置（传 clearApiKey:true 表示删除密钥）
 *   POST /api/llm/test     - 轻量连通性测试（max_tokens 很小）
 *   POST /api/llm/chat     - 一轮对话
 */
'use strict';

var express = require('express');
var router = express.Router();
var resp = require('../utils/response');
var settingsRepository = require('../utils/settings-repository');
var dataBackups = require('../utils/data-backups');
var outboundHttp = require('../utils/outbound-http');

var DEFAULT_CONFIG = {
    apiUrl: '',
    apiKey: '',
    model: '',
    timeout: 60
};

/** 单条用户消息上限：防止一次粘贴整本说明书，把额度烧掉 */
var MAX_MESSAGE_CHARS = 4000;

/** 带进上下文的历史条数上限（只算 user/assistant） */
var MAX_HISTORY_TURNS = 12;

var DEFAULT_SYSTEM_PROMPT = [
    '你是「文的项目工作台」侧栏里的桌面助手，叫小柴（一只柴犬），主人是文总。',
    '说话简短口语化，偶尔末尾带一声「汪」，但不要每句都带。',
    '你只负责聊天和给建议；不要编造业务数据（订单、客户、金额、日期都不许猜）。',
    '需要真实数据时，提示文总去对应页面看，或告诉他可以接上 Agent 查询能力。',
    '不确定的事就说不知道，别硬编。'
].join('');

// ========== 配置读写 ==========

function getConfig(scope) {
    var settings = settingsRepository.read(scope || dataBackups.captureScope());
    return Object.assign({}, DEFAULT_CONFIG, settings.llm || {});
}

function isConfigured(config) {
    return !!(config.apiUrl && config.apiKey && config.model);
}

/**
 * 把用户填的地址补成对话接口。
 * 三种常见写法都接受：只填域名、填到 /v1、填完整 /v1/chat/completions。
 */
function normalizeChatApiUrl(value) {
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
        parsedUrl.pathname = '/v1/chat/completions';
        return parsedUrl.toString();
    }
    if (/\/chat\/completions$/i.test(pathname)) {
        parsedUrl.pathname = pathname;
        return parsedUrl.toString();
    }
    if (/\/v1$/i.test(pathname)) {
        parsedUrl.pathname = pathname + '/chat/completions';
        return parsedUrl.toString();
    }
    return apiUrl;
}

// ========== 消息组装与解析 ==========

function normalizeHistory(history) {
    if (!Array.isArray(history)) return [];
    var out = [];
    history.forEach(function (item) {
        if (!item || typeof item !== 'object') return;
        var role = item.role === 'assistant' ? 'assistant' : (item.role === 'user' ? 'user' : null);
        if (!role) return;
        var content = item.text != null ? item.text : item.content;
        content = String(content == null ? '' : content).trim();
        if (!content) return;
        out.push({ role: role, content: content });
    });
    return out.slice(-MAX_HISTORY_TURNS);
}

function buildMessages(history, message) {
    var messages = [{ role: 'system', content: DEFAULT_SYSTEM_PROMPT }];
    normalizeHistory(history).forEach(function (item) { messages.push(item); });
    messages.push({ role: 'user', content: message });
    return messages;
}

/** content 可能是字符串，也可能是 [{type:'text',text:'...'}] 这种分段结构 */
function readContent(content) {
    if (typeof content === 'string') return content;
    if (Array.isArray(content)) {
        return content.map(function (part) {
            if (!part) return '';
            if (typeof part === 'string') return part;
            return part.text || part.content || '';
        }).join('');
    }
    return '';
}

function extractReply(body) {
    if (!body || typeof body !== 'object') return '';

    if (Array.isArray(body.choices) && body.choices.length) {
        var choice = body.choices[0];
        if (choice.message) {
            var fromMessage = readContent(choice.message.content);
            if (fromMessage) return fromMessage;
        }
        if (choice.text) return String(choice.text);
    }
    if (body.output_text) return String(body.output_text);
    if (typeof body.content === 'string') return body.content;
    if (typeof body.reply === 'string') return body.reply;

    return '';
}

function extractErrorMessage(response) {
    var detail = '';
    try {
        var errBody = JSON.parse(response.body);
        detail = (errBody.error && (errBody.error.message || errBody.error))
            || errBody.message
            || errBody.detail
            || '';
        if (typeof detail !== 'string') detail = JSON.stringify(detail);
    } catch (e) {
        detail = String(response.body || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 160);
    }
    return 'HTTP ' + response.statusCode + (detail ? '：' + detail : '');
}

function friendlyNetworkError(message) {
    var msg = message || '未知错误';
    if (msg.indexOf('ENOTFOUND') !== -1) return '无法解析域名，请检查 API 地址';
    if (msg.indexOf('ECONNREFUSED') !== -1) return '服务器拒绝连接，请确认服务是否可用';
    if (msg.indexOf('超时') !== -1 || msg.indexOf('ETIMEDOUT') !== -1) return '请求超时，请稍后重试或加大超时时间';
    return msg;
}

async function callChat(config, messages, maxTokens) {
    var apiUrl = normalizeChatApiUrl(config.apiUrl);
    var payload = JSON.stringify({
        model: config.model,
        messages: messages,
        temperature: 0.7,
        max_tokens: maxTokens || 800,
        stream: false
    });

    var response = await outboundHttp.request(apiUrl, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + config.apiKey
        },
        timeout: outboundHttp.normalizeTimeoutMs(config.timeout, DEFAULT_CONFIG.timeout)
    }, payload);

    if (response.statusCode < 200 || response.statusCode >= 300) {
        var err = new Error(extractErrorMessage(response));
        err.status = (response.statusCode >= 400 && response.statusCode < 500) ? response.statusCode : 502;
        throw err;
    }

    var body;
    try {
        body = JSON.parse(response.body);
    } catch (e) {
        throw new Error('大模型返回了非 JSON 数据，请检查 API 地址是否指向对话接口');
    }

    return extractReply(body);
}

// ========== 路由 ==========

router.get('/config', resp.asyncHandler(function (req, res) {
    var config = getConfig();
    return resp.success(res, {
        apiUrl: config.apiUrl,
        model: config.model,
        timeout: config.timeout,
        apiKeyMasked: config.apiKey ? (config.apiKey.slice(0, 4) + '****' + config.apiKey.slice(-4)) : '',
        apiKeyConfigured: !!config.apiKey,
        configured: isConfigured(config)
    });
}));

router.put('/config', resp.asyncHandler(function (req, res) {
    var scope = dataBackups.captureScope();
    var settings = settingsRepository.read(scope);
    settings.llm = settings.llm || {};

    var body = req.body || {};
    if (typeof body.apiUrl === 'string') settings.llm.apiUrl = body.apiUrl.trim();
    if (typeof body.model === 'string') settings.llm.model = body.model.trim();
    if (body.timeout !== undefined) settings.llm.timeout = parseInt(body.timeout, 10) || DEFAULT_CONFIG.timeout;

    if (body.clearApiKey === true) {
        // 显式清除：设置页把已配置的密钥清空再保存，就是「删掉这把钥匙」
        settings.llm.apiKey = '';
    } else if (typeof body.apiKey === 'string' && body.apiKey.indexOf('****') === -1) {
        // 脱敏值（含 ****）回写时丢弃，别拿它覆盖真实密钥
        if (body.apiKey.trim()) settings.llm.apiKey = body.apiKey.trim();
    }

    settingsRepository.save(settings, { scope: scope });
    return resp.success(res, { message: '配置已保存' });
}));

router.post('/test', resp.asyncHandler(async function (req, res) {
    var config = getConfig();

    if (!config.apiUrl) return resp.error(res, '请先填写 API 地址');
    if (!config.apiKey) return resp.error(res, '请先填写 API 密钥');
    if (!config.model) return resp.error(res, '请先填写模型名称');

    try {
        var reply = await callChat(config, [{ role: 'user', content: '请只回复两个字：收到' }], 16);
        return resp.success(res, {
            status: 'ok',
            model: config.model,
            message: reply ? ('连接成功，模型回复：' + reply.slice(0, 40)) : '连接成功，但模型没有返回内容'
        });
    } catch (e) {
        return resp.error(res, '连接失败：' + friendlyNetworkError(e.message));
    }
}));

router.post('/chat', resp.asyncHandler(async function (req, res) {
    var body = req.body || {};
    var message = String(body.message == null ? '' : body.message).trim();

    if (!message) return resp.error(res, '消息不能为空');
    if (message.length > MAX_MESSAGE_CHARS) {
        message = message.slice(0, MAX_MESSAGE_CHARS);
    }

    var config = getConfig();

    // 未配置是常态，不是错误 —— 交给前端说"你还没接大模型"
    if (!isConfigured(config)) {
        return resp.success(res, {
            configured: false,
            reply: '',
            reason: 'not-configured',
            hint: '在「设置中心 → 大模型配置」里填 API 地址、密钥和模型名即可'
        });
    }

    try {
        var reply = await callChat(config, buildMessages(body.history, message), 800);
        if (!reply) {
            return resp.error(res, '模型没有返回内容，请检查模型名是否可用');
        }
        return resp.success(res, {
            configured: true,
            reply: reply,
            model: config.model
        });
    } catch (e) {
        return resp.error(res, '调用大模型失败：' + friendlyNetworkError(e.message), e.status || 502);
    }
}));

module.exports = router;
