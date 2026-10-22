/**
 * App.ui —— 统一 UI 反馈层
 *
 * 替代现状：项目里 showToast 有 4 套互不相同的实现（customer 用 #cust-action-toast、
 * orders 用 #order-action-toast、memo 用动态 div、canvas 又一套配色），
 * 以及 window.ui 里那套没人使用的旧 toast。本文件收敛为唯一实现。
 *
 * 所有浮层统一挂载到 body 下的 #app-overlay-root，
 * 由 router 在切页时调用 App.ui.closeAll() 一次性清理 —— 这取代了原先
 * spa-router.js 里 cleanupGlobalOverlays() 手工枚举选择器 + :scope > .fixed 兜底的做法。
 */
(function (global) {
    'use strict';

    var App = global.App = global.App || {};
    var dom = App.dom;

    var OVERLAY_ID = 'app-overlay-root';
    var openOverlays = [];   // 当前打开的可关闭浮层句柄

    function getOverlayRoot() {
        var root = document.getElementById(OVERLAY_ID);
        if (!root) {
            root = document.createElement('div');
            root.id = OVERLAY_ID;
            // 自身不拦截点击，只有子元素（遮罩）才拦截
            root.style.cssText = 'position:relative;z-index:99999;';
            document.body.appendChild(root);
        }
        return root;
    }

    function track(handle) {
        openOverlays.push(handle);
        return handle;
    }

    function untrack(handle) {
        var i = openOverlays.indexOf(handle);
        if (i !== -1) openOverlays.splice(i, 1);
    }

    /** 关闭所有浮层（切页时由 router 调用） */
    function closeAll() {
        openOverlays.slice().forEach(function (handle) {
            try {
                handle.close();
            } catch (e) {
                console.warn('[ui] 关闭浮层失败:', e.message);
            }
        });
        openOverlays.length = 0;

        // 兜底：清掉 overlay root 下所有残留节点
        var root = document.getElementById(OVERLAY_ID);
        if (root) root.innerHTML = '';

        // 恢复滚动锁
        document.body.style.overflow = '';
    }

    // ========== Toast ==========

    var toastQueue = [];
    var TOAST_MAX = 3;
    // 图标沿用项目已有的 Phosphor 字体
    var TOAST_STYLE = {
        success: { icon: 'ph-check-circle', cls: 'bg-green-500' },
        error: { icon: 'ph-warning-circle', cls: 'bg-red-500' },
        warning: { icon: 'ph-warning', cls: 'bg-amber-500' },
        info: { icon: 'ph-info', cls: 'bg-gray-800' }
    };

    /**
     * 轻提示
     * @param {string} message
     * @param {'success'|'error'|'warning'|'info'} [type='success']
     * @param {number} [duration=2200]
     */
    function toast(message, type, duration) {
        var conf = TOAST_STYLE[type] || TOAST_STYLE.success;
        var root = getOverlayRoot();

        var wrap = document.createElement('div');
        wrap.className = 'fixed left-1/2 top-5 z-[99999] flex flex-col items-center gap-2 pointer-events-none';
        wrap.style.transform = 'translateX(-50%)';

        var node = document.createElement('div');
        node.className = 'flex items-center gap-2 px-5 py-3 rounded-lg text-white text-sm ' +
            conf.cls + ' transition-all duration-200';
        node.style.cssText = 'opacity:0;transform:translateY(-8px);';
        var iconEl = document.createElement('i');
        iconEl.className = 'ph ' + conf.icon + ' text-base';
        var textEl = document.createElement('span');
        textEl.textContent = message == null ? '' : String(message);
        node.appendChild(iconEl);
        node.appendChild(textEl);

        wrap.appendChild(node);
        root.appendChild(wrap);

        toastQueue.push(wrap);
        // 超过上限时移除最早的
        while (toastQueue.length > TOAST_MAX) {
            var old = toastQueue.shift();
            if (old && old.parentNode) old.parentNode.removeChild(old);
        }

        requestAnimationFrame(function () {
            node.style.opacity = '1';
            node.style.transform = 'translateY(0)';
        });

        var timer = setTimeout(function () {
            node.style.opacity = '0';
            node.style.transform = 'translateY(-8px)';
            setTimeout(function () {
                if (wrap.parentNode) wrap.parentNode.removeChild(wrap);
                var i = toastQueue.indexOf(wrap);
                if (i !== -1) toastQueue.splice(i, 1);
            }, 220);
        }, duration || 2200);

        return {
            close: function () {
                clearTimeout(timer);
                if (wrap.parentNode) wrap.parentNode.removeChild(wrap);
            }
        };
    }

    // ========== Confirm ==========

    /**
     * 确认框（Promise 版，替代项目中各种自定义 confirm 模态框）
     * @returns {Promise<boolean>}
     */
    function confirm(options) {
        var opts = typeof options === 'string' ? { message: options } : (options || {});
        var title = opts.title || '确认操作';
        var confirmText = opts.confirmText || '确定';
        var cancelText = opts.cancelText || '取消';
        var danger = opts.danger !== false;

        return new Promise(function (resolve) {
            var root = getOverlayRoot();

            var overlay = document.createElement('div');
            overlay.className = 'fixed inset-0 bg-black/40 flex items-center justify-center p-4';
            overlay.style.zIndex = '100000';

            var dialog = document.createElement('div');
            dialog.className = 'bg-white rounded-xl w-full max-w-sm overflow-hidden';
            dialog.style.cssText = 'transform:scale(.95);opacity:0;transition:all .18s ease;';
            dialog.innerHTML =
                '<div class="px-5 pt-5 pb-2">' +
                    '<h3 class="text-base font-medium text-gray-900">' + dom.escapeHtml(title) + '</h3>' +
                    '<p class="mt-2 text-sm text-gray-500 leading-relaxed">' + dom.escapeHtml(opts.message || '') + '</p>' +
                '</div>' +
                '<div class="flex gap-2 px-5 py-4">' +
                    '<button type="button" data-act="cancel" class="flex-1 py-2 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50">' + dom.escapeHtml(cancelText) + '</button>' +
                    '<button type="button" data-act="ok" class="flex-1 py-2 rounded-lg text-sm text-white ' + (danger ? 'bg-red-500 hover:bg-red-600' : 'bg-blue-500 hover:bg-blue-600') + '">' + dom.escapeHtml(confirmText) + '</button>' +
                '</div>';

            overlay.appendChild(dialog);
            root.appendChild(overlay);

            requestAnimationFrame(function () {
                dialog.style.transform = 'scale(1)';
                dialog.style.opacity = '1';
            });

            var settled = false;
            var handle = {
                close: function () {
                    if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
                    untrack(handle);
                }
            };
            track(handle);

            function settle(result) {
                if (settled) return;
                settled = true;
                handle.close();
                resolve(result);
            }

            overlay.addEventListener('click', function (e) {
                var act = e.target.getAttribute && e.target.getAttribute('data-act');
                if (act === 'ok') settle(true);
                else if (act === 'cancel') settle(false);
                else if (e.target === overlay) settle(false);
            });

            // 键盘：Enter 确认 / Esc 取消
            function onKey(e) {
                if (e.key === 'Enter') settle(true);
                else if (e.key === 'Escape') settle(false);
            }
            document.addEventListener('keydown', onKey);
            var originClose = handle.close;
            handle.close = function () {
                document.removeEventListener('keydown', onKey);
                originClose();
            };

            var okBtn = dialog.querySelector('[data-act="ok"]');
            if (okBtn) okBtn.focus();
        });
    }

    // ========== Modal ==========

    /**
     * 通用模态框
     * @param {Object} options
     * @param {string} options.title
     * @param {string|Node} options.content - HTML 字符串或 DOM 节点
     * @param {string} [options.width='max-w-lg']
     * @param {Function} [options.onClose]
     * @returns {{close: Function, el: HTMLElement}}
     */
    function modal(options) {
        var opts = options || {};
        var root = getOverlayRoot();

        var overlay = document.createElement('div');
        overlay.className = 'fixed inset-0 bg-black/40 flex items-center justify-center p-4';
        overlay.style.zIndex = '100000';

        var dialog = document.createElement('div');
        dialog.className = 'bg-white rounded-xl w-full ' + (opts.width || 'max-w-lg') +
            ' max-h-[90vh] flex flex-col overflow-hidden';
        dialog.style.cssText = 'transform:scale(.96);opacity:0;transition:all .18s ease;';

        var header = document.createElement('div');
        header.className = 'flex items-center justify-between px-5 py-4 border-b border-gray-100';
        header.innerHTML = '<h3 class="text-base font-medium text-gray-900">' +
            dom.escapeHtml(opts.title || '') + '</h3>';

        var closeBtn = document.createElement('button');
        closeBtn.type = 'button';
        closeBtn.className = 'text-gray-400 hover:text-gray-600';
        closeBtn.innerHTML = '<i class="ph ph-x text-lg"></i>';
        header.appendChild(closeBtn);

        var body = document.createElement('div');
        body.className = 'flex-1 overflow-y-auto px-5 py-4';
        if (typeof opts.content === 'string') {
            body.innerHTML = opts.content;
        } else if (opts.content) {
            body.appendChild(opts.content);
        }

        dialog.appendChild(header);
        dialog.appendChild(body);

        if (opts.footer) {
            var footer = document.createElement('div');
            footer.className = 'px-5 py-4 border-t border-gray-100';
            if (typeof opts.footer === 'string') footer.innerHTML = opts.footer;
            else footer.appendChild(opts.footer);
            dialog.appendChild(footer);
        }

        overlay.appendChild(dialog);
        root.appendChild(overlay);

        document.body.style.overflow = 'hidden';

        requestAnimationFrame(function () {
            dialog.style.transform = 'scale(1)';
            dialog.style.opacity = '1';
        });

        var closed = false;
        var handle = {
            el: dialog,
            body: body,
            close: function () {
                if (closed) return;
                closed = true;
                dialog.style.transform = 'scale(.96)';
                dialog.style.opacity = '0';
                setTimeout(function () {
                    if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
                    document.body.style.overflow = '';
                    if (typeof opts.onClose === 'function') opts.onClose();
                }, 180);
                untrack(handle);
            }
        };
        track(handle);

        closeBtn.addEventListener('click', handle.close);
        overlay.addEventListener('click', function (e) {
            if (e.target === overlay) handle.close();
        });

        return handle;
    }

    // ========== 分页 ==========

    /**
     * 页码按钮 HTML（上一页 / 页码 / 下一页 / 每页条数）。
     * 页面自己决定包一层、写 info 文案，以及点完之后干什么。
     */
    function paginationButtonsHtml(options) {
        options = options || {};
        var page = parseInt(options.page, 10) || 1;
        var pageSize = parseInt(options.pageSize, 10) || 10;
        var total = parseInt(options.total, 10) || 0;
        var totalPages = Math.ceil(total / pageSize) || 1;
        var maxVisible = parseInt(options.maxVisible, 10) || 5;
        var prevClass = options.prevClass || 'page-prev';
        var nextClass = options.nextClass || 'page-next';
        var btnClass = options.btnClass || 'page-btn';
        var sizeSelectId = options.sizeSelectId || '';
        var sizes = options.sizes || [10, 20, 50];

        var startPage = Math.max(1, page - 2);
        var endPage = Math.min(totalPages, startPage + maxVisible - 1);
        if (endPage - startPage < maxVisible - 1) startPage = Math.max(1, endPage - maxVisible + 1);

        var disabled = ' opacity-40 pointer-events-none';
        var html = '';
        html += '<button type="button" class="' + prevClass + ' w-8 h-8 rounded flex items-center justify-center border border-gray-200 hover:bg-gray-50' +
            (page <= 1 ? disabled : '') + '"><i class="ph ph-caret-left"></i></button>';

        var i;
        for (i = startPage; i <= endPage; i++) {
            if (i === page) {
                html += '<button type="button" class="' + btnClass + ' w-8 h-8 rounded flex items-center justify-center border border-brand-500 bg-brand-50 text-brand-600 font-medium" data-page="' + i + '">' + i + '</button>';
            } else {
                html += '<button type="button" class="' + btnClass + ' w-8 h-8 rounded flex items-center justify-center hover:bg-gray-50" data-page="' + i + '">' + i + '</button>';
            }
        }
        if (endPage < totalPages) {
            html += '<span>...</span>';
            html += '<button type="button" class="' + btnClass + ' w-8 h-8 rounded flex items-center justify-center hover:bg-gray-50" data-page="' + totalPages + '">' + totalPages + '</button>';
        }

        html += '<button type="button" class="' + nextClass + ' w-8 h-8 rounded flex items-center justify-center border border-gray-200 hover:bg-gray-50' +
            (page >= totalPages ? disabled : '') + '"><i class="ph ph-caret-right"></i></button>';

        if (sizeSelectId) {
            html += '<select id="' + sizeSelectId + '" class="ml-2 border border-gray-200 rounded px-2 py-1 bg-white outline-none">';
            sizes.forEach(function (s) {
                html += '<option value="' + s + '"' + (s === pageSize ? ' selected' : '') + '>' + s + '条/页</option>';
            });
            html += '</select>';
        }
        return html;
    }

    function bindPagination(container, options) {
        if (!container) return;
        options = options || {};
        var page = parseInt(options.page, 10) || 1;
        var pageSize = parseInt(options.pageSize, 10) || 10;
        var total = parseInt(options.total, 10) || 0;
        var totalPages = Math.ceil(total / pageSize) || 1;
        var prevClass = options.prevClass || 'page-prev';
        var nextClass = options.nextClass || 'page-next';
        var btnClass = options.btnClass || 'page-btn';
        var onChange = options.onChange;
        if (typeof onChange !== 'function') return;

        Array.prototype.slice.call(container.querySelectorAll('.' + btnClass)).forEach(function (btn) {
            btn.addEventListener('click', function () {
                onChange(parseInt(btn.getAttribute('data-page'), 10), pageSize);
            });
        });
        var prevBtn = container.querySelector('.' + prevClass);
        if (prevBtn) {
            prevBtn.addEventListener('click', function () {
                if (page > 1) onChange(page - 1, pageSize);
            });
        }
        var nextBtn = container.querySelector('.' + nextClass);
        if (nextBtn) {
            nextBtn.addEventListener('click', function () {
                if (page < totalPages) onChange(page + 1, pageSize);
            });
        }
        var sizeSel = options.sizeSelectId
            ? (document.getElementById(options.sizeSelectId) || container.querySelector('#' + options.sizeSelectId))
            : null;
        if (sizeSel) {
            sizeSel.addEventListener('change', function () {
                onChange(1, parseInt(sizeSel.value, 10) || pageSize);
            });
        }
    }

    // ========== Loading ==========

    var loadingNode = null;

    function showLoading(text) {
        if (loadingNode) return;
        var root = getOverlayRoot();
        loadingNode = document.createElement('div');
        loadingNode.className = 'fixed inset-0 bg-white/60 flex items-center justify-center';
        loadingNode.style.zIndex = '100001';
        loadingNode.innerHTML =
            '<div class="flex flex-col items-center gap-3">' +
                '<div class="w-8 h-8 border-2 border-gray-200 border-t-blue-500 rounded-full animate-spin"></div>' +
                (text ? '<p class="text-sm text-gray-500">' + dom.escapeHtml(text) + '</p>' : '') +
            '</div>';
        root.appendChild(loadingNode);
    }

    function hideLoading() {
        if (loadingNode && loadingNode.parentNode) {
            loadingNode.parentNode.removeChild(loadingNode);
        }
        loadingNode = null;
    }

    // ========== 导出 ==========

    App.ui = {
        toast: toast,
        confirm: confirm,
        modal: modal,
        paginationButtonsHtml: paginationButtonsHtml,
        bindPagination: bindPagination,
        showLoading: showLoading,
        hideLoading: hideLoading,
        closeAll: closeAll,
        getOverlayRoot: getOverlayRoot
    };

    // ========== 兼容层：旧 window.ui ==========

    /**
     * 旧项目里有一个全局 `ui`（js/ui-components.js），
     * dashboard / accounts / bookmarks / memo / platform-posts 都在用，
     * 且写的是老式回调风格：`ui.toast.error(msg)`、`ui.confirm(msg, onOk, onCancel)`。
     *
     * 这次重构的目标之一就是把散落的 4 套提示框收敛成 1 套，
     * 所以这里不再加载那份旧实现，而是让 `ui` 直接转接到 App.ui：
     * 老代码照常跑，视觉与行为只有一个来源。
     */
    function toastShorthand(type) {
        return function (message, duration) {
            toast(message, type, duration);
        };
    }

    global.ui = {
        toast: {
            success: toastShorthand('success'),
            error: toastShorthand('error'),
            warning: toastShorthand('warning'),
            info: toastShorthand('info')
        },
        showLoading: showLoading,
        hideLoading: hideLoading,

        /**
         * 兼容回调式调用：
         *   ui.confirm('确定删除？', onOk, onCancel)
         *   ui.confirm({ message, title }, onOk, onCancel)
         * 不传回调时返回 Promise，与 App.ui.confirm 一致。
         */
        confirm: function (messageOrOptions, onConfirm, onCancel) {
            var options = typeof messageOrOptions === 'string'
                ? { message: messageOrOptions }
                : (messageOrOptions || {});

            if (typeof onConfirm === 'function' || typeof onCancel === 'function') {
                // 回调式：内部把 Promise 转成回调
                confirm(options).then(function (ok) {
                    if (ok) {
                        if (typeof onConfirm === 'function') onConfirm();
                    } else if (typeof onCancel === 'function') {
                        onCancel();
                    }
                });
                return;
            }
            return confirm(options);
        }
    };

})(typeof window !== 'undefined' ? window : this);
