/**
 * GrokCtrl-Key 管理 —— 子页面（/grok/keys，从 GrokBot 页的接入指南进入）
 *
 * GrokBot 不靠账号密码接入：这里签发长寿命 Key，它用
 * `Authorization: Bearer gck_...` 直接调 /api/*，作用域=当前账号。
 * 明文只在生成当次返回一次，列表里只能看到 id；泄露就吊销重建。
 *
 * ⚠️ destroy() 必须保留：切走页面时 shell 会调它。
 */
import { escapeHtml } from '../../lib/format.js';
import { toast } from '../../lib/toast.js';
import { getApiBase } from '../../lib/config.js';
import { grokKeys } from '../../api/resources.js';
import { WB_ICONS } from '../../icons.js';
import '../../styles/grok-keys.css';

/**
 * @param {HTMLElement} container .mobile-content 滚动容器
 * @param {Object} route matchRoute() 的结果
 */
export function mountGrokKeysPanel(container, route) {
    var state = { disposed: false, busy: false };

    function render() {
        container.innerHTML =
            '<div class="gk-root">' +
            '  <section class="gk-intro">' +
            '    <span class="gk-intro-mark">' + WB_ICONS.grok + '</span>' +
            '    <div>' +
            '      <p class="gk-intro-title">GrokCtrl-Key</p>' +
            '      <p class="gk-intro-sub">GrokBot 的专属通行证 —— 不用给账号密码，' +
            '        它拿 Key 就能操作你的账号；泄露随时吊销。</p>' +
            '    </div>' +
            '  </section>' +
            '  <div id="gk-fresh"></div>' +
            '  <button type="button" class="gk-create" id="gk-create">生成新 Key</button>' +
            '  <section class="gk-card">' +
            '    <p class="gk-list-title">已有 Key</p>' +
            '    <div id="gk-list"><p class="gk-empty">载入中…</p></div>' +
            '  </section>' +
            '  <p class="gk-tip">Key 能读写你的全部数据，只喂给你自己的 GrokBot；' +
            '    完整明文只在生成时显示一次，丢了就吊销重建一枚。</p>' +
            '</div>';

        container.querySelector('#gk-create').addEventListener('click', createKey);
    }

    /* ---------- 新 Key 明文展示（只出现一次） ---------- */

    function renderFresh(freshKey) {
        var box = container.querySelector('#gk-fresh');
        if (!box) return;
        var base = getApiBase() || location.origin;
        box.innerHTML =
            '<section class="gk-fresh">' +
            '  <p class="gk-fresh-label">新 Key 只显示这一次，请收好：</p>' +
            '  <code class="gk-key-value">' + escapeHtml(freshKey) + '</code>' +
            '  <code class="gk-key-value gk-key-value--dim">BASE_URL=' + escapeHtml(base) + '</code>' +
            '  <div class="gk-fresh-actions">' +
            '    <button type="button" class="gk-copy" data-copy="' + escapeHtml(freshKey) + '">复制 Key</button>' +
            '    <button type="button" class="gk-copy gk-copy--ghost" data-copy="' +
            escapeHtml('BASE_URL=' + base + '\nGROK_KEY=' + freshKey) + '">复制 BASE_URL + Key</button>' +
            '  </div>' +
            '</section>';
        box.querySelectorAll('.gk-copy').forEach(function (btn) {
            btn.addEventListener('click', function () {
                var text = btn.getAttribute('data-copy');
                if (navigator.clipboard && navigator.clipboard.writeText) {
                    navigator.clipboard.writeText(text).then(function () {
                        toast.success('已复制');
                    }).catch(function () { toast.error('复制失败'); });
                } else {
                    toast.info(text);
                }
            });
        });
    }

    /* ---------- 列表 ---------- */

    function renderList(keys) {
        var list = container.querySelector('#gk-list');
        if (!list) return;
        if (!keys.length) {
            list.innerHTML = '<p class="gk-empty">还没有 Key，点上面按钮生成一枚</p>';
            return;
        }
        list.innerHTML = keys.map(function (k) {
            return '<div class="gk-key-row">' +
                '<span class="gk-key-id">' + escapeHtml(k.id) + '</span>' +
                '<span class="gk-key-time">' + escapeHtml(String(k.createdAt || '').slice(0, 10)) + '</span>' +
                '<button type="button" class="gk-revoke" data-id="' + escapeHtml(k.id) + '">吊销</button>' +
                '</div>';
        }).join('');
        list.querySelectorAll('.gk-revoke').forEach(function (btn) {
            btn.addEventListener('click', function () {
                var id = btn.getAttribute('data-id');
                btn.disabled = true;
                grokKeys.revoke(id)
                    .then(function () {
                        if (state.disposed) return;
                        toast.success('已吊销 ' + id);
                        loadKeys();
                    })
                    .catch(function (err) {
                        btn.disabled = false;
                        if (!state.disposed) toast.error((err && err.message) || '吊销失败');
                    });
            });
        });
    }

    function loadKeys() {
        grokKeys.list()
            .then(function (res) {
                if (state.disposed) return;
                renderList((res && res.data) || []);
            })
            .catch(function (err) {
                if (state.disposed) return;
                var list = container.querySelector('#gk-list');
                if (list) {
                    list.innerHTML = '<p class="gk-empty gk-empty--err">' +
                        escapeHtml((err && err.message) || '列表加载失败') + '</p>';
                }
            });
    }

    /* ---------- 生成 ---------- */

    function createKey() {
        if (state.busy) return;
        state.busy = true;
        var btn = container.querySelector('#gk-create');
        if (btn) {
            btn.disabled = true;
            btn.textContent = '生成中…';
        }
        grokKeys.create()
            .then(function (res) {
                if (state.disposed) return;
                var d = res && res.data;
                if (!d || !d.key) return;
                renderFresh(d.key);
                loadKeys();
                toast.success('已生成 GrokCtrl-Key');
            })
            .catch(function (err) {
                if (!state.disposed) toast.error((err && err.message) || '生成失败');
            })
            .finally(function () {
                state.busy = false;
                if (!state.disposed && btn) {
                    btn.disabled = false;
                    btn.textContent = '生成新 Key';
                }
            });
    }

    render();
    loadKeys();

    return {
        destroy: function () {
            state.disposed = true;
        }
    };
}
