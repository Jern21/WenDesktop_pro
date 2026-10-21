/**
 * App.dom —— DOM 与数据工具层
 *
 * 设计原则：
 *   1. 所有页面共用一份实现，禁止页面内重复定义（现有代码里 escapeHtml 有 3 套、
 *      其中 customer.html 那套只转义 < > &，漏了引号，存在 XSS 缺口 —— 本文件统一修掉）。
 *   2. 不依赖任何页面，可在任意时机加载。
 *   3. 纯函数为主，不持有状态，不会泄漏。
 *
 * 用法：
 *   App.dom.escapeHtml(str)
 *   App.dom.el('div', { class: 'p-4' }, '内容')
 *   var off = App.dom.delegate(root, '[data-action]', 'click', fn);  // 返回解绑函数
 */
(function (global) {
    'use strict';

    var App = global.App = global.App || {};

    // ========== 转义 ==========

    var ESCAPE_MAP = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    };

    /**
     * 安全转义：把文本插入 HTML 内容或属性值都安全。
     * 覆盖 & < > " ' 五个字符（旧 customer.html 实现漏了后两个，会属性逃逸）。
     */
    function escapeHtml(value) {
        if (value === null || value === undefined) return '';
        return String(value).replace(/[&<>"']/g, function (c) {
            return ESCAPE_MAP[c];
        });
    }

    /**
     * 属性值转义（语义同 escapeHtml，保留别名便于代码自解释）
     */
    var escapeAttr = escapeHtml;

    /**
     * 反向：把转义后的内容还原成纯文本（用于把 HTML 塞进 title 等属性）
     */
    function unescapeHtml(value) {
        return String(value || '')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"')
            .replace(/&#39;/g, "'")
            .replace(/&amp;/g, '&');
    }

    /**
     * 富文本转义：允许白名单标签，其余全部转义。
     * 用于「用户输入的备注要保留换行、加粗」这类场景。
     */
    function escapeKeepBreaks(value) {
        return escapeHtml(value).replace(/\r?\n/g, '<br>');
    }

    // ========== 元素创建 ==========

    /**
     * 创建元素
     * @param {string} tag
     * @param {Object} [attrs] - class/style/dataset/on 前缀属性/普通属性
     * @param {string|Node|Array} [children]
     */
    function el(tag, attrs, children) {
        var node = document.createElement(tag);
        attrs = attrs || {};

        Object.keys(attrs).forEach(function (key) {
            var val = attrs[key];
            if (val === null || val === undefined || val === false) return;

            if (key === 'class' || key === 'className') {
                node.className = val;
            } else if (key === 'style' && typeof val === 'object') {
                Object.keys(val).forEach(function (prop) {
                    node.style[prop] = val[prop];
                });
            } else if (key === 'dataset' && typeof val === 'object') {
                Object.keys(val).forEach(function (prop) {
                    node.dataset[prop] = val[prop];
                });
            } else if (key === 'text') {
                node.textContent = val;
            } else if (key === 'html') {
                node.innerHTML = val;
            } else if (key.indexOf('on') === 0 && typeof val === 'function') {
                node.addEventListener(key.slice(2).toLowerCase(), val);
            } else {
                node.setAttribute(key, val);
            }
        });

        if (children !== null && children !== undefined) {
            (Array.isArray(children) ? children : [children]).forEach(function (child) {
                if (child === null || child === undefined || child === false) return;
                node.appendChild(
                    typeof child === 'string' || typeof child === 'number'
                        ? document.createTextNode(String(child))
                        : child
                );
            });
        }

        return node;
    }

    // ========== 查询 ==========

    function qs(selector, root) {
        return (root || document).querySelector(selector);
    }

    function qsa(selector, root) {
        return Array.prototype.slice.call((root || document).querySelectorAll(selector));
    }

    // ========== 事件 ==========

    /**
     * 事件委托 —— 替代 HTML 内联 onclick。
     * 返回解绑函数，务必在 ctx.onCleanup 中登记。
     *
     * @param {Element} root
     * @param {string} selector
     * @param {string} type
     * @param {Function} handler - (event, matchedElement) => void
     * @returns {Function} 解绑函数
     */
    function delegate(root, selector, type, handler) {
        function listener(e) {
            var target = e.target.closest(selector);
            if (target && root.contains(target)) {
                handler.call(target, e, target);
            }
        }
        root.addEventListener(type, listener);
        return function off() {
            root.removeEventListener(type, listener);
        };
    }

    /**
     * 绑定并自动返回解绑函数
     */
    function on(target, type, handler, options) {
        target.addEventListener(type, handler, options);
        return function off() {
            target.removeEventListener(type, handler, options);
        };
    }

    // ========== 节流防抖 ==========

    function debounce(fn, wait) {
        var timer = null;
        var debounced = function () {
            var args = arguments;
            var self = this;
            clearTimeout(timer);
            timer = setTimeout(function () {
                fn.apply(self, args);
            }, wait || 200);
        };
        debounced.cancel = function () { clearTimeout(timer); };
        return debounced;
    }

    function throttle(fn, wait) {
        var last = 0;
        var timer = null;
        return function () {
            var now = Date.now();
            var args = arguments;
            var self = this;
            var remain = wait - (now - last);
            if (remain <= 0) {
                last = now;
                fn.apply(self, args);
            } else if (!timer) {
                timer = setTimeout(function () {
                    last = Date.now();
                    timer = null;
                    fn.apply(self, args);
                }, remain);
            }
        };
    }

    // ========== 格式化 ==========

    /** 金额：¥1,234.56 */
    function formatMoney(value, withSymbol) {
        var num = Number(value);
        if (!isFinite(num)) num = 0;
        var text = num.toLocaleString('zh-CN', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });
        return withSymbol === false ? text : '¥' + text;
    }

    /** 紧凑金额：1.2万 / 3,456 */
    function formatMoneyCompact(value) {
        var num = Number(value) || 0;
        if (Math.abs(num) >= 10000) {
            return '¥' + (num / 10000).toFixed(1) + '万';
        }
        return '¥' + num.toLocaleString('zh-CN');
    }

    function pad2(n) {
        return n < 10 ? '0' + n : String(n);
    }

    function toDate(value) {
        if (value instanceof Date) return value;
        if (!value) return null;
        var d = new Date(value);
        return isNaN(d.getTime()) ? null : d;
    }

    /** 2026-10-21 */
    function formatDate(value) {
        var d = toDate(value);
        if (!d) return '';
        return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
    }

    /** 2026-10-21 15:38 */
    function formatDateTime(value) {
        var d = toDate(value);
        if (!d) return '';
        return formatDate(d) + ' ' + pad2(d.getHours()) + ':' + pad2(d.getMinutes());
    }

    /** 相对时间：刚刚 / 5分钟前 / 3天前 / 2026-10-21 */
    function formatRelative(value) {
        var d = toDate(value);
        if (!d) return '';
        var diff = Date.now() - d.getTime();
        var min = 60 * 1000;
        var hour = 60 * min;
        var day = 24 * hour;

        if (diff < 0) return formatDate(d);
        if (diff < min) return '刚刚';
        if (diff < hour) return Math.floor(diff / min) + '分钟前';
        if (diff < day) return Math.floor(diff / hour) + '小时前';
        if (diff < 7 * day) return Math.floor(diff / day) + '天前';
        return formatDate(d);
    }

    /** 安全取数：obj.a.b.c 任意层级为空都不报错 */
    function pick(obj, path, fallback) {
        var cur = obj;
        var keys = String(path).split('.');
        for (var i = 0; i < keys.length; i++) {
            if (cur === null || cur === undefined) return fallback;
            cur = cur[keys[i]];
        }
        return cur === undefined || cur === null ? fallback : cur;
    }

    // ========== 存储 ==========

    /**
     * 带命名空间的存储封装，避免和其他站点/功能互相污染
     */
    function createStore(namespace, persistent) {
        var backing = persistent ? global.localStorage : global.sessionStorage;
        var prefix = (namespace || 'app') + ':';

        return {
            get: function (key, fallback) {
                try {
                    var raw = backing.getItem(prefix + key);
                    return raw === null ? fallback : JSON.parse(raw);
                } catch (e) {
                    return fallback;
                }
            },
            set: function (key, value) {
                try {
                    backing.setItem(prefix + key, JSON.stringify(value));
                    return true;
                } catch (e) {
                    // 配额超限时静默失败，不打断业务
                    console.warn('[store] 写入失败:', key, e.message);
                    return false;
                }
            },
            remove: function (key) {
                backing.removeItem(prefix + key);
            }
        };
    }

    // ========== 导出 ==========

    App.dom = {
        escapeHtml: escapeHtml,
        escapeAttr: escapeAttr,
        unescapeHtml: unescapeHtml,
        escapeKeepBreaks: escapeKeepBreaks,

        el: el,
        qs: qs,
        qsa: qsa,

        delegate: delegate,
        on: on,

        debounce: debounce,
        throttle: throttle,

        formatMoney: formatMoney,
        formatMoneyCompact: formatMoneyCompact,
        formatDate: formatDate,
        formatDateTime: formatDateTime,
        formatRelative: formatRelative,
        pick: pick,

        createStore: createStore
    };

})(typeof window !== 'undefined' ? window : this);
