/**
 * 柴犬对话浮窗 —— 点击桌宠打开，可输入；预留 Agent 接入
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

    function defaultAgentReply(ctx) {
        var msg = (ctx && ctx.userMessage) ? String(ctx.userMessage).trim() : '';
        if (!msg) return '先输入一句话再发送汪～';
        return (
            '收到：「' + msg + '」\n' +
            '（演示回复）后端 Agent 还没接上，接入后会根据当前页面帮你查数据、写待办。'
        );
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
        setTimerHook: setTimerHook
    };

    global.triggerShibaSpeech = function (text) {
        if (panelOpen) {
            appendMessage('bot', text);
            return;
        }
        showToast({ text: text, kind: 'chat' });
    };
})(typeof window !== 'undefined' ? window : this);
