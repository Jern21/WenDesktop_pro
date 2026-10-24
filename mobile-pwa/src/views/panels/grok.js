/**
 * GrokBot 连接器 —— 对话页
 *
 * 主体是聊天窗。后端走 /api/llm/chat（OpenAI 兼容，配置在设置中心）；
 * 没接模型时不拦人 —— 照样能发，打字机效果之后随机回一句提示文案，
 * 让用户先体验流程（本地模拟，不耗 API 额度）。
 *
 * 「接入文档」是副功能：消息流顶部一条悬浮小条，随时可下载
 * GROK_BOT_CONNECTION.md（GET /api/grok-doc → Blob 下载）。
 *
 * 消息通道：/api/grok-messages —— 页面发的消息会写进去，Grok 用
 * GrokCtrl-Key 往同一个接口 POST 就能以它名义把消息送进来；
 * 页面每 4s 轮询拉新。切走页面历史不丢（存在服务端）。
 *
 * ⚠️ destroy() 必须保留：切走页面时 shell 会调它。
 */
import { escapeHtml } from '../../lib/format.js';
import { toast } from '../../lib/toast.js';
import { llm, grokMessages, grokKeys } from '../../api/resources.js';
import { navigate } from '../../router.js';
import { NAV_ICONS, WB_ICONS } from '../../icons.js';
import '../../styles/grok.css';

/** 对话历史传给后端的条数上限（与后端 MAX_HISTORY_TURNS 保持一致） */
var MAX_HISTORY_TURNS = 12;

var SUGGESTIONS = [
    '最近生意怎么样？',
    '本月收入和支出帮我总结一下',
    '有哪些订单还没回款？',
    '接下来一周我该重点做什么？'
];

/** 未接入时的模拟回复池 —— 模拟思考后随机挑一句 */
/** 接入指南四步 —— 悬浮条点开的弹层里展示 */
var STEPS = [
    '点下面按钮，下载 GROK_BOT_CONNECTION.md',
    '进入 GrokCtrl-Key 管理页，生成一枚 Key',
    '把 md + BASE_URL + Key 一起喂给你的 GrokBot',
    '它做完连通检查后，就能遥控工作台了'
];

var OFFLINE_REPLIES = [
    '收到～不过我这边还没接上线，暂时回不了真东西。去生成一枚 GrokCtrl-Key 喂给我，马上就能帮你查订单、记备忘。',
    '记下了！等我接入完成就能真正干活 —— 点上面的接入指南，把 md + Key 喂给你的 GrokBot 就行。',
    '这条我听见了。等我接入完成，订单、台账、提醒随叫随到。',
    '暂时只能陪你聊到这里 —— 我还缺一把 Key。去接入指南里生成一枚喂给我，马上变聪明。',
    '已阅～接入完成后，我会真的分析你的数据再回你。'
];

/**
 * @param {HTMLElement} container .mobile-content 滚动容器
 * @param {Object} route matchRoute() 的结果
 */
export function mountGrokPanel(container, route) {
    var state = {
        disposed: false,
        configured: null,   // null=配置加载中，true/false=已确认
        hasKey: false,      // 有没有签过 GrokCtrl-Key（决定开场文案档位）
        sending: false,
        downloading: false,
        messages: [],       // { role:'user'|'assistant', content:'…' }（喂 llm.chat 的内存历史）
        seenIds: {},        // 服务端消息 id → true，轮询去重用
        pollTimer: null
    };

    var msgsEl = null;
    var inputEl = null;
    var sendEl = null;

    function scrollBottom() {
        // 消息流在 .grok-msgs 内部滚，不滚整页
        if (msgsEl) msgsEl.scrollTop = msgsEl.scrollHeight;
    }

    function pickRandom(list) {
        return list[Math.floor(Math.random() * list.length)];
    }

    /* ---------- 消息渲染 ---------- */

    function bubbleRow(role, innerHtml) {
        var row = document.createElement('div');
        row.className = 'grok-row' + (role === 'user' ? ' is-user' : '');
        row.innerHTML =
            (role === 'assistant' ? '<span class="grok-avatar">' + WB_ICONS.grok + '</span>' : '') +
            '<div class="grok-bubble">' + innerHtml + '</div>';
        return row;
    }

    function appendMsg(role, text, isError) {
        var row = bubbleRow(role, escapeHtml(text));
        if (isError) row.querySelector('.grok-bubble').classList.add('is-err');
        msgsEl.appendChild(row);
        scrollBottom();
        return row;
    }

    function appendTyping() {
        var row = bubbleRow('assistant',
            '<i class="grok-dot"></i><i class="grok-dot"></i><i class="grok-dot"></i>');
        row.classList.add('grok-typing');
        msgsEl.appendChild(row);
        scrollBottom();
        return row;
    }

    /* ---------- 服务端消息流（/api/grok-messages） ---------- */

    var POLL_MS = 4000;

    /** 渲染一条服务端消息；role 'bot' → 左侧 Grok 泡 */
    function appendPersisted(msg) {
        appendMsg(msg.role === 'user' ? 'user' : 'assistant', msg.text || '');
    }

    /** 有历史就回放，没有才放开场问候（问候文案按有没有 Key 分档） */
    function loadHistory() {
        Promise.all([
            grokMessages.list().catch(function () { return null; }),
            grokKeys.list().catch(function () { return null; })
        ]).then(function (rs) {
            if (state.disposed) return;
            var keys = rs[1] && rs[1].data;
            state.hasKey = !!(keys && keys.length);

            var list = (rs[0] && rs[0].data) || [];
            if (!list.length && !msgsEl.childElementCount) {
                renderWelcome();
                return;
            }
            msgsEl.innerHTML = '';
            list.slice(-80).forEach(function (m) {
                state.seenIds[m.id] = true;
                appendPersisted(m);
            });
            scrollBottom();
        });
    }

    /** 轮询拉新：Grok 用 Key POST 进来的消息会在这里冒泡 */
    function pollOnce() {
        grokMessages.list()
            .then(function (res) {
                if (state.disposed) return;
                var list = (res && res.data) || [];
                list.forEach(function (m) {
                    if (state.seenIds[m.id]) return;
                    state.seenIds[m.id] = true;
                    var chips = container.querySelector('.grok-chips');
                    if (chips) chips.remove();
                    appendPersisted(m);
                });
            })
            .catch(function () { /* 断网/未登录都静默，下一轮再试 */ });
    }

    function startPolling() {
        if (state.pollTimer) return;
        state.pollTimer = setInterval(pollOnce, POLL_MS);
    }

    /** 开场：问候 + 建议词条（文案按是否接入区分） */
    function renderWelcome() {
        msgsEl.innerHTML = '';
        var greeting = state.hasKey
            ? '我是 GrokBot。你已经给我发过钥匙了，我现在能接收 GrokBot 指令 —— 请为我派活吧！'
            : '我是 GrokBot。先创建一枚 GrokCtrl-Key 我才能帮你干活 —— 点上面的接入指南，' +
              '生成 Key 喂给我就行啦。';
        msgsEl.appendChild(bubbleRow('assistant', escapeHtml(greeting)));

        var chips = document.createElement('div');
        chips.className = 'grok-chips';
        SUGGESTIONS.forEach(function (text) {
            var btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'grok-chip';
            btn.textContent = text;
            btn.addEventListener('click', function () { send(text); });
            chips.appendChild(btn);
        });
        msgsEl.appendChild(chips);
        scrollBottom();
    }

    /* ---------- 接入文档下载（副功能，顶部悬浮条） ---------- */

    function downloadDoc() {
        if (state.downloading) return;
        state.downloading = true;
        var label = container.querySelector('#grok-dl');
        if (label) label.textContent = '下载中…';

        llm.connectDoc()
            .then(function (res) {
                if (state.disposed) return;
                var d = res && res.data;
                if (!d || !d.content) throw new Error('文档内容为空');

                var blob = new Blob([d.content], { type: 'text/markdown;charset=utf-8' });
                var url = URL.createObjectURL(blob);
                var a = document.createElement('a');
                a.href = url;
                a.download = d.name || 'GROK_BOT_CONNECTION.md';
                document.body.appendChild(a);
                a.click();
                a.remove();
                setTimeout(function () { URL.revokeObjectURL(url); }, 3000);

                toast.success('已下载，把它喂给 GrokBot 即可畅享功能');
            })
            .catch(function (err) {
                if (!state.disposed) {
                    toast.error((err && err.message) || '下载失败');
                }
            })
            .finally(function () {
                state.downloading = false;
                if (!state.disposed) {
                    var t = container.querySelector('#grok-dl');
                    if (t) t.textContent = '下载接入文档（.md）';
                }
            });
    }

    /** 接入指南弹层（副功能完整内容：下载按钮 + 四步 + 提示） */
    function openGuide() {
        if (document.querySelector('.grok-sheet-backdrop')) return;

        var stepsHtml = STEPS.map(function (s, i) {
            return '<li><i class="grok-step-no">' + (i + 1) + '</i><span>' +
                escapeHtml(s) + '</span></li>';
        }).join('');

        var backdrop = document.createElement('div');
        backdrop.className = 'grok-sheet-backdrop';
        backdrop.innerHTML =
            '<div class="grok-sheet" role="dialog" aria-modal="true">' +
            '  <div class="grok-guide-head">' +
            '    <span class="grok-hero-mark">' + WB_ICONS.grok + '</span>' +
            '    <p class="grok-guide-title">接入 GrokBot</p>' +
            '    <p class="grok-guide-sub">把接入文档喂给它，就能查订单、记备忘、操作系统</p>' +
            '  </div>' +
            '  <button type="button" class="grok-dl" id="grok-dl">' +
            '    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" aria-hidden="true">' +
            '      <path d="M12 4v11m0 0l-4-4m4 4l4-4"/><path d="M4 19h16"/>' +
            '    </svg>' +
            '    下载接入文档（.md）</button>' +
            '  <ol class="grok-steps">' + stepsHtml + '</ol>' +
            '  <button type="button" class="grok-keys-link" id="grok-keys-go">GrokCtrl-Key 管理 ›</button>' +
            '  <p class="grok-tip">不用把账号密码给 GrokBot —— Key 只对当前账号生效、随时可吊销；' +
            '    完整 Key 只显示一次，丢了重新生成一枚即可。</p>' +
            '  <button type="button" class="grok-sheet-close">知道了</button>' +
            '</div>';

        backdrop.addEventListener('click', function (e) {
            if (e.target === backdrop) backdrop.remove();
        });
        backdrop.querySelector('.grok-sheet-close').addEventListener('click', function () {
            backdrop.remove();
        });
        backdrop.querySelector('#grok-dl').addEventListener('click', downloadDoc);
        backdrop.querySelector('#grok-keys-go').addEventListener('click', function () {
            backdrop.remove();
            navigate('/grok/keys');
        });

        document.body.appendChild(backdrop);
    }

    /* ---------- 发送 ---------- */

    function setSending(on) {
        state.sending = on;
        if (sendEl) sendEl.disabled = on;
    }

    function send(text) {
        var message = String(text || '').trim();
        if (!message || state.sending || state.configured === null) return;

        // 清掉开场建议词条（第一条问候保留），进入消息流
        var chips = container.querySelector('.grok-chips');
        if (chips) chips.remove();

        setSending(true);
        inputEl.value = '';
        inputEl.focus();

        appendMsg('user', message);
        var typing = appendTyping();

        // 写进服务端消息流 —— Grok 轮询同一个接口就能看到用户说了什么。
        // 失败不打扰：本地气泡照常在，下一条再试。
        grokMessages.push('user', message)
            .then(function (res) {
                var id = res && res.data && res.data.id;
                if (id) state.seenIds[id] = true;
            })
            .catch(function () {});

        // 未接入：模拟「想一想」的停顿后随机回一句，不走接口
        if (state.configured !== true) {
            var thinkMs = 900 + Math.random() * 1100;
            setTimeout(function () {
                typing.remove();
                if (state.disposed) return;
                var reply = pickRandom(OFFLINE_REPLIES);
                appendMsg('assistant', reply);
                state.messages.push({ role: 'user', content: message });
                state.messages.push({ role: 'assistant', content: reply });
                setSending(false);
            }, thinkMs);
            return;
        }

        var history = state.messages.slice(-MAX_HISTORY_TURNS);
        llm.chat({ message: message, history: history })
            .then(function (res) {
                typing.remove();
                if (state.disposed) return;
                var reply = res && res.data && res.data.reply;
                if (!reply) {
                    appendMsg('assistant', '模型没有返回内容，请检查配置。', true);
                    return;
                }
                appendMsg('assistant', reply);
                state.messages.push({ role: 'user', content: message });
                state.messages.push({ role: 'assistant', content: reply });
            })
            .catch(function (err) {
                typing.remove();
                if (state.disposed) return;
                appendMsg('assistant', (err && err.message) || '发送失败，请稍后再试', true);
            })
            .finally(function () {
                if (!state.disposed) setSending(false);
            });
    }

    /* ---------- 骨架与事件 ---------- */

    function bind() {
        msgsEl = container.querySelector('#grok-msgs');
        inputEl = container.querySelector('#grok-input');
        sendEl = container.querySelector('#grok-send');

        sendEl.addEventListener('click', function () { send(inputEl.value); });
        inputEl.addEventListener('keydown', function (e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                send(inputEl.value);
            }
        });
        container.querySelector('#grok-guide').addEventListener('click', openGuide);

        var menuBtn = container.querySelector('#grok-menu');
        var menuPop = container.querySelector('#grok-menu-pop');
        menuBtn.addEventListener('click', function () {
            menuPop.hidden = !menuPop.hidden;
        });
        menuPop.querySelector('#grok-clear').addEventListener('click', function () {
            menuPop.hidden = true;
            clearHistory();
        });
        // 点菜单外面收起
        document.addEventListener('click', state.onDocClick = function (e) {
            if (menuPop.hidden) return;
            if (!e.target.closest || !e.target.closest('.grok-menu-wrap')) {
                menuPop.hidden = true;
            }
        });
    }

    /** 清理会话历史：服务端清空 + 本地回到开场 */
    function clearHistory() {
        grokMessages.clear()
            .then(function () {
                if (state.disposed) return;
                state.seenIds = {};
                state.messages = [];
                renderWelcome();
                toast.success('会话历史已清理');
            })
            .catch(function (err) {
                if (!state.disposed) toast.error((err && err.message) || '清理失败');
            });
    }

    function render() {
        container.innerHTML =
            '<div class="grok-root">' +
            '  <button type="button" class="grok-docbar" id="grok-guide">' +
            '    <span class="grok-docbar-mark">' + WB_ICONS.grok + '</span>' +
            '    <span class="grok-docbar-text">接入指南 · 把 md 喂给 GrokBot</span>' +
            '    <span class="grok-docbar-arrow">›</span>' +
            '  </button>' +
            '  <div class="grok-msgs" id="grok-msgs"></div>' +
            '  <div class="grok-bar">' +
            '    <div class="grok-menu-wrap">' +
            '      <button type="button" class="grok-menu-btn" id="grok-menu" aria-label="更多">' +
            '        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true">' +
            '          <path d="M12 5v14M5 12h14"/></svg>' +
            '      </button>' +
            '      <div class="grok-menu-pop" id="grok-menu-pop" hidden>' +
            '        <button type="button" class="grok-menu-item" id="grok-clear">清理会话历史</button>' +
            '      </div>' +
            '    </div>' +
            '    <input class="grok-input" id="grok-input" type="text" maxlength="4000"' +
            '      placeholder="跟 GrokBot 聊聊…" autocomplete="off" />' +
            '    <button type="button" class="grok-send" id="grok-send" aria-label="发送">' +
            NAV_ICONS.send + '</button>' +
            '  </div>' +
            '</div>';
        bind();
        loadHistory();
        startPolling();
    }

    /* ---------- 启动：先探模型配置，再决定开场文案 ---------- */

    // 本页骨架高度锁死，外层滚动对本页无效 —— 标记宿主禁止外层滚动
    container.classList.add('is-fixed-page');

    llm.config()
        .catch(function () { return null; })
        .then(function (res) {
            if (state.disposed) return;
            var d = res && res.data;
            state.configured = !!(d && d.configured);
            render();
        });

    return {
        destroy: function () {
            state.disposed = true;
            container.classList.remove('is-fixed-page');
            if (state.pollTimer) {
                clearInterval(state.pollTimer);
                state.pollTimer = null;
            }
            if (state.onDocClick) {
                document.removeEventListener('click', state.onDocClick);
                state.onDocClick = null;
            }
        }
    };
}
