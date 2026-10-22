/**
 * 柴犬对话浮窗 —— 点击桌宠打开，可输入。
 *
 * 大脑来源有两级：
 *   1. agentProvider（可选，由页面通过 registerAgentProvider 注入，优先级最高）
 *   2. 设置中心「大模型配置」里的 OpenAI 兼容接口（/api/llm/chat）
 * 两者都没有时走 defaultAgentReply 的兜底话术（同样会"想" 1~2 秒）。
 *
 * ShibaDialogue.registerAgentProvider(async function (ctx) {
 *   // ctx.userMessage, ctx.view, ctx.history
 *   var res = await api.post('/api/agent/shiba', { message: ctx.userMessage });
 *   return res.data.reply;
 * });
 */
(function (global) {
    'use strict';

    var agentProvider = null;
    var timerHook = null;
    var panelOpen = false;
    var chatBound = false;
    var panelPortaled = false;
    var panelPositionBound = false;
    var sending = false;
    var lastCtx = {};
    var history = [];

    var WELCOME =
        '汪！我是小柴～\n有什么想聊的或要我帮忙的，直接输入发送就行（Agent 能力后续接入）。';

    function getBubbleEls() {
        return {
            bubble: document.getElementById('shiba-bubble'),
            text: document.getElementById('shiba-bubble-text'),
            tag: document.getElementById('shiba-bubble-tag')
        };
    }

    function getPanelEls() {
        return {
            panel: document.getElementById('shiba-chat-panel'),
            log: document.getElementById('shiba-chat-log'),
            form: document.getElementById('shiba-chat-form'),
            input: document.getElementById('shiba-chat-input'),
            close: document.getElementById('shiba-chat-close')
        };
    }

    function setSpeechTimer(frames) {
        if (typeof timerHook === 'function') timerHook(frames);
    }

    function isPanelOpen() {
        return panelOpen;
    }

    function ensurePanelPortal() {
        var els = getPanelEls();
        if (!els.panel || panelPortaled) return;
        document.body.appendChild(els.panel);
        els.panel.classList.add('shiba-chat-panel--portal');
        panelPortaled = true;
    }

    function updatePanelPosition() {
        var els = getPanelEls();
        var anchor = document.getElementById('shiba-pet-area');
        if (!els.panel || !anchor) return;
        var rect = anchor.getBoundingClientRect();
        var gap = 14;
        var preferredW = 440;
        var minW = 300;
        var maxW = Math.min(preferredW, window.innerWidth - rect.left - 20);
        if (maxW < minW) {
            maxW = Math.min(minW, window.innerWidth - 24);
        }
        var left = Math.max(12, rect.left);
        els.panel.style.left = left + 'px';
        els.panel.style.bottom = (window.innerHeight - rect.top + gap) + 'px';
        els.panel.style.width = maxW + 'px';
    }

    function bindPanelPosition() {
        if (panelPositionBound) return;
        panelPositionBound = true;
        global.addEventListener('resize', function () {
            if (panelOpen) updatePanelPosition();
        });
        global.addEventListener('scroll', function () {
            if (panelOpen) updatePanelPosition();
        }, true);
    }

    function appendMessage(role, text) {
        var els = getPanelEls();
        if (!els.log || !text) return;
        var row = document.createElement('div');
        row.className = 'shiba-chat-msg shiba-chat-msg--' + (role === 'user' ? 'user' : 'bot');
        var label = document.createElement('span');
        label.className = 'shiba-chat-msg-label';
        label.textContent = role === 'user' ? '你' : '小柴';
        var body = document.createElement('p');
        body.className = 'shiba-chat-msg-text';
        body.textContent = text;
        row.appendChild(label);
        row.appendChild(body);
        els.log.appendChild(row);
        els.log.scrollTop = els.log.scrollHeight;
    }

    function setPanelOpen(open) {
        var els = getPanelEls();
        if (!els.panel) return;
        panelOpen = !!open;
        if (panelOpen) {
            ensurePanelPortal();
            bindPanelPosition();
            els.panel.removeAttribute('hidden');
            els.panel.setAttribute('aria-hidden', 'false');
            els.panel.classList.add('shiba-chat-panel--open');
            updatePanelPosition();
            hideToast();
            setSpeechTimer(0);
            if (els.log && els.log.childElementCount === 0) {
                appendMessage('bot', WELCOME);
            }
            if (els.input) {
                setTimeout(function () { els.input.focus(); }, 80);
            }
        } else {
            els.panel.setAttribute('hidden', '');
            els.panel.setAttribute('aria-hidden', 'true');
            els.panel.classList.remove('shiba-chat-panel--open');
        }
    }

    function togglePanel(ctx) {
        lastCtx = ctx || lastCtx || {};
        global.dispatchEvent(new CustomEvent('shiba:click', { detail: lastCtx }));
        setPanelOpen(!panelOpen);
    }

    function hideToast() {
        var els = getBubbleEls();
        if (!els.bubble) return;
        els.bubble.classList.remove('shiba-bubble-visible');
        els.bubble.style.opacity = '0';
        els.bubble.style.transform = 'translateX(-50%) translateY(4px) scale(0.85)';
    }

    function showToast(opts) {
        if (panelOpen) return;
        opts = opts || {};
        var els = getBubbleEls();
        if (!els.bubble || !els.text) return;

        var kind = opts.kind || 'chat';
        if (els.tag) {
            if (kind === 'agent' || kind === 'hint' || kind === 'thinking') {
                els.tag.textContent = kind === 'agent' ? '小柴 · Agent' : '小柴';
                els.tag.classList.remove('hidden');
            } else {
                els.tag.classList.add('hidden');
            }
        }

        els.text.textContent = opts.text || '';
        els.bubble.classList.add('shiba-bubble-visible');
        els.bubble.style.opacity = '1';
        els.bubble.style.transform = 'translateX(-50%) translateY(0) scale(1)';
        els.bubble.setAttribute('data-kind', kind);

        var duration = opts.pinned ? 99999 : (opts.duration != null ? opts.duration : 160);
        setSpeechTimer(duration);

        global.dispatchEvent(new CustomEvent('shiba:dialogue', {
            detail: { text: opts.text, kind: kind, pinned: !!opts.pinned }
        }));
    }

    // ========== 大模型接入 ==========
    //
    // 小柴的「大脑」是设置中心里配的那套 OpenAI 兼容接口（/api/llm/chat）。
    // 没配也能聊，只是它会先说一句「你还没接大模型」。
    //
    // 一个刻意的设计：**没接大模型时也必须先"想"1~2 秒**。
    // 秒回会让人觉得它根本没在处理（而且一眼看出是本地写死的文案）；
    // 有了这段延迟，用户看到的是「正在想…」→ 一句吐槽，体验才连贯。

    var FALLBACK_REPLIES = [
        '汪…你还没给我接大模型呢，我现在满脑子只有狗粮，真没法跟你聊这个 🐶',
        '不是我不理你，是你还没接入大模型喔 —— 我现在只会「汪」，你听得懂吗？',
        '我脑子里现在是空的。去「设置中心 → 大模型配置」给我装个脑子吧，不然我只能陪你摇尾巴。',
        '汪？（悄悄说：接上大模型我就能听懂人话了，现在纯属装模作样）',
        '我这颗脑袋还没通电…填个 API Key 我就立刻变聪明，真的，狗不骗人。'
    ];

    /** 最短"思考"时间；加一点随机抖动，免得每次都恰好 1000ms 显得机械 */
    var THINKING_MIN_MS = 1000;
    var THINKING_JITTER_MS = 900;

    function sleep(ms) {
        return new Promise(function (resolve) { setTimeout(resolve, ms); });
    }

    function llmEndpoint() {
        var root = global.ROOT_URL || '/';
        return root.replace(/\/+$/, '') + '/api/llm/chat';
    }

    function pickFallbackReply() {
        return FALLBACK_REPLIES[Math.floor(Math.random() * FALLBACK_REPLIES.length)];
    }

    /** 补足到至少 minMs —— 用于「请求已经花了时间」的场景，别叠加两次等待 */
    function thinkAtLeast(startedAt, minMs, value) {
        var wait = minMs - (Date.now() - startedAt);
        if (wait <= 0) return Promise.resolve(value);
        return sleep(wait).then(function () { return value; });
    }

    /**
     * 问大模型。永远 resolve，不 reject —— 出错也要有话说，不能让对话卡住。
     * @param {string} message 用户这句话
     * @param {object} ctx 携带 history（[{role,text}]，后端负责裁到最近 N 轮）
     */
    function askLlm(message, ctx) {
        var startedAt = Date.now();
        var api = global.api;

        if (!api || typeof api.call !== 'function') {
            // 请求层没加载（比如离线演示页）：照样装一下思考
            return thinkAtLeast(startedAt, THINKING_MIN_MS, pickFallbackReply());
        }

        return api.call(llmEndpoint(), {
            method: 'POST',
            body: {
                message: message,
                history: (ctx && ctx.history) || []
            },
            timeout: 65000
        }).then(function (result) {
            var data = (result && result.data) || {};

            if (!data.configured) {
                return sleep(THINKING_MIN_MS + Math.random() * THINKING_JITTER_MS)
                    .then(function () { return pickFallbackReply(); });
            }
            if (!data.reply) {
                return thinkAtLeast(startedAt, THINKING_MIN_MS, '汪…大模型这次什么都没说，再问一遍试试？');
            }
            return data.reply;
        }).catch(function (err) {
            var reason = (err && err.message) ? err.message : '未知错误';
            return thinkAtLeast(startedAt, THINKING_MIN_MS,
                '汪汪…我跟大模型走丢了（' + reason + '）。\n' +
                '去「设置中心 → 大模型配置」看一眼地址、密钥、模型名对不对？');
        });
    }

    function defaultAgentReply(ctx) {
        var msg = (ctx && ctx.userMessage) ? String(ctx.userMessage).trim() : '';
        if (!msg) {
            return sleep(600).then(function () { return '先输入一句话再发送汪～'; });
        }
        return askLlm(msg, ctx);
    }

    function pushHistory(role, text) {
        history.push({ role: role, text: text });
        if (history.length > 40) history = history.slice(-40);
    }

    function sendUserMessage() {
        var els = getPanelEls();
        if (!els.input || sending) return;
        var raw = els.input.value;
        var text = raw.replace(/\s+$/g, '').replace(/^\s+/g, '');
        if (!text) return;

        els.input.value = '';
        appendMessage('user', text);
        pushHistory('user', text);

        var typing = document.createElement('div');
        typing.className = 'shiba-chat-msg shiba-chat-msg--bot shiba-chat-typing';
        typing.textContent = '小柴正在想…';
        els.log.appendChild(typing);
        els.log.scrollTop = els.log.scrollHeight;

        sending = true;
        var ctx = Object.assign({}, lastCtx, {
            userMessage: text,
            history: history.slice(0, -1)
        });

        var provider = agentProvider || defaultAgentReply;
        Promise.resolve(provider(ctx))
            .then(function (reply) {
                var replyText = reply && reply.text != null ? reply.text : reply;
                if (!replyText) replyText = '（没有回复内容）';
                replyText = String(replyText);
                appendMessage('bot', replyText);
                pushHistory('assistant', replyText);
                global.dispatchEvent(new CustomEvent('shiba:reply', {
                    detail: { userMessage: text, reply: replyText, ctx: ctx }
                }));
            })
            .catch(function (err) {
                console.warn('[ShibaDialogue] send failed:', err);
                appendMessage('bot', '汪汪？出错了，稍后再试～');
            })
            .then(function () {
                if (typing.parentNode) typing.parentNode.removeChild(typing);
                sending = false;
                if (els.input) els.input.focus();
            });
    }

    function bindChatPanel() {
        if (chatBound) return;
        var els = getPanelEls();
        if (!els.panel || !els.form) return;

        els.panel.addEventListener('click', function (e) {
            e.stopPropagation();
        });
        els.panel.addEventListener('mousedown', function (e) {
            e.stopPropagation();
        });

        if (els.close) {
            els.close.addEventListener('click', function (e) {
                e.preventDefault();
                e.stopPropagation();
                setPanelOpen(false);
            });
        }

        els.form.addEventListener('submit', function (e) {
            e.preventDefault();
            e.stopPropagation();
            sendUserMessage();
        });

        if (els.input) {
            els.input.addEventListener('keydown', function (e) {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    sendUserMessage();
                }
            });
        }

        chatBound = true;
    }

    function init() {
        ensurePanelPortal();
        bindPanelPosition();
        bindChatPanel();
    }

    function handlePetClick(ctx) {
        lastCtx = ctx || {};
        bindChatPanel();
        togglePanel(lastCtx);
    }

    function registerAgentProvider(fn) {
        agentProvider = typeof fn === 'function' ? fn : null;
    }

    function setTimerHook(fn) {
        timerHook = fn;
    }

    global.ShibaDialogue = {
        init: init,
        show: showToast,
        hide: hideToast,
        handlePetClick: handlePetClick,
        openPanel: function (ctx) {
            lastCtx = ctx || {};
            bindChatPanel();
            setPanelOpen(true);
        },
        closePanel: function () { setPanelOpen(false); },
        isPanelOpen: isPanelOpen,
        registerAgentProvider: registerAgentProvider,
        setTimerHook: setTimerHook,
        /** 供设置页/探针复用：走大模型问一句话，永远 resolve */
        askLlm: askLlm
    };

    global.triggerShibaSpeech = function (text) {
        if (panelOpen) {
            appendMessage('bot', text);
            return;
        }
        showToast({ text: text, kind: 'chat' });
    };
})(typeof window !== 'undefined' ? window : this);
