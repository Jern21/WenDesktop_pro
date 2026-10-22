/**
 * 轻提示 + 确认弹层
 *
 * 为什么要替代 `window.alert` / `window.confirm`：
 *  - 原生弹窗会阻塞 JS，移动端 PWA 里还会打断下拉刷新手势；
 *  - 样式不可控，且 iOS 会把弹窗当作页面切换处理，返回手势会错乱；
 *  - 出错时（比如订单状态保存失败）alert 只有一个「确定」，用户看不到上下文。
 *
 * 用法：
 *   import { toast, confirmSheet } from '../lib/toast.js';
 *   toast.success('已标记完成');
 *   toast.error(err.message);
 *   const ok = await confirmSheet({ title:'确认关闭订单？', message:'...', danger:true });
 */

/* ============================================================
 * Toast
 * ========================================================== */

var host = null;
var queue = [];

function ensureHost() {
    if (host && document.body.contains(host)) return host;
    host = document.createElement('div');
    host.className = 'toast-host';
    host.setAttribute('role', 'status');
    host.setAttribute('aria-live', 'polite');
    document.body.appendChild(host);
    return host;
}

function dismiss(node) {
    if (!node) return;
    if (node.__toastTimer) clearTimeout(node.__toastTimer);
    node.classList.remove('is-in');
    setTimeout(function () {
        if (node.parentNode) node.parentNode.removeChild(node);
        var i = queue.indexOf(node);
        if (i !== -1) queue.splice(i, 1);
    }, 220);
}

function mountToast(node, duration) {
    var parent = ensureHost();
    parent.appendChild(node);
    queue.push(node);

    while (queue.length > 3) {
        var old = queue.shift();
        if (old && old.parentNode) old.parentNode.removeChild(old);
    }

    requestAnimationFrame(function () {
        node.classList.add('is-in');
    });

    node.__toastTimer = setTimeout(function () { dismiss(node); }, duration);
}

function show(message, type, duration) {
    var text = String(message || '').trim();
    if (!text) return;

    var node = document.createElement('div');
    node.className = 'toast toast--' + (type || 'info');
    node.innerHTML = '<span class="toast-text"></span>';
    node.querySelector('.toast-text').textContent = text;
    var ms = duration === undefined ? (type === 'error' ? 3200 : 2000) : duration;
    mountToast(node, ms);
}

function showUndo(message, onUndo) {
    var text = String(message || '').trim();
    if (!text) return;

    var node = document.createElement('div');
    node.className = 'toast toast--info toast--action';
    node.innerHTML = '<span class="toast-text"></span><button type="button" class="toast-undo">撤销</button>';
    node.querySelector('.toast-text').textContent = text;
    var acted = false;
    node.querySelector('.toast-undo').addEventListener('click', function () {
        if (acted) return;
        acted = true;
        dismiss(node);
        if (onUndo) onUndo();
    });
    mountToast(node, 3200);
}


function toastFn(message, type, duration) {
    show(message, type, duration);
}

toastFn.info = function (m, d) { show(m, 'info', d); };
toastFn.success = function (m, d) { show(m, 'success', d); };
toastFn.error = function (m, d) { show(m, 'error', d); };
toastFn.warn = function (m, d) { show(m, 'warn', d); };
toastFn.undo = function (message, onUndo) { showUndo(message, onUndo); };

export var toast = toastFn;

/* ============================================================
 * 确认弹层
 * ========================================================== */

/**
 * @param {Object} opts
 * @param {string} opts.title
 * @param {string} [opts.message]
 * @param {string} [opts.confirmText] 默认「确定」
 * @param {string} [opts.cancelText] 默认「取消」
 * @param {boolean} [opts.danger] 危险操作：确认按钮标红
 * @returns {Promise<boolean>} 用户是否确认
 */
export function confirmSheet(opts) {
    var o = opts || {};
    return new Promise(function (resolve) {
        var backdrop = document.createElement('div');
        backdrop.className = 'sheet-backdrop';

        var confirmCls = o.danger ? 'sheet-btn sheet-btn--danger' : 'sheet-btn sheet-btn--primary';
        backdrop.innerHTML =
            '<div class="sheet-panel" role="dialog" aria-modal="true">' +
            '  <h3 class="sheet-title"></h3>' +
            (o.message ? '  <p class="sheet-message"></p>' : '') +
            '  <div class="sheet-actions">' +
            '    <button type="button" class="sheet-btn" data-act="cancel"></button>' +
            '    <button type="button" class="' + confirmCls + '" data-act="confirm"></button>' +
            '  </div>' +
            '</div>';

        // 文案一律用 textContent，不拼进 innerHTML —— 标题里可能有客户名带 < >
        backdrop.querySelector('.sheet-title').textContent = o.title || '确认操作';
        if (o.message) backdrop.querySelector('.sheet-message').textContent = o.message;
        backdrop.querySelector('[data-act="cancel"]').textContent = o.cancelText || '取消';
        backdrop.querySelector('[data-act="confirm"]').textContent = o.confirmText || '确定';

        var settled = false;
        function done(val) {
            if (settled) return;
            settled = true;
            backdrop.classList.remove('is-in');
            setTimeout(function () {
                if (backdrop.parentNode) backdrop.parentNode.removeChild(backdrop);
            }, 200);
            resolve(val);
        }

        backdrop.addEventListener('click', function (e) {
            if (e.target === backdrop) done(false);
            var act = e.target.getAttribute && e.target.getAttribute('data-act');
            if (act === 'cancel') done(false);
            if (act === 'confirm') done(true);
        });

        document.body.appendChild(backdrop);
        requestAnimationFrame(function () { backdrop.classList.add('is-in'); });
    });
}
