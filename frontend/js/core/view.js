/**
 * App.view —— 视图注册与生命周期管理
 *
 * 这是真 SPA 的心脏。伪 SPA 时代最大的隐患是「切页后全局状态残留」：
 * 定时器还在跑、window 上的监听还在、ECharts 实例还占着 canvas。
 * 旧代码靠 spa-router.js 里的 cleanupGlobalOverlays() 手工枚举选择器兜底，
 * 属于「漏一个就出 bug」的补救式清理。
 *
 * 本模块改为「登记制」：view 在 mount 时通过 ctx.onCleanup(fn) 登记清理函数，
 * 框架在离开页面时统一逆序执行，不再依赖人工穷举。
 *
 * 用法：
 *   App.view('orders', {
 *       path: '/orders',
 *       title: '我的订单',
 *       template: 'views/orders.html',
 *       async mount(root, ctx) {
 *           var timer = setInterval(poll, 5000);
 *           ctx.listen(window, 'resize', onResize);
 *           ctx.onCleanup(function () { clearInterval(timer); });
 *       }
 *   });
 */
(function (global) {
    'use strict';

    var App = global.App = global.App || {};
    var nativeWindowAdd = typeof global.addEventListener === 'function'
        ? global.addEventListener.bind(global)
        : function () {};
    var nativeDocumentAdd = (typeof document !== 'undefined' && typeof document.addEventListener === 'function')
        ? document.addEventListener.bind(document)
        : function () {};

    var registry = {};        // name -> definition
    var cleanupStack = [];    // 当前 view 登记的清理函数（逆序执行）
    var currentName = null;
    var currentDef = null;

    /**
     * 注册视图
     * @param {string} name
     * @param {Object} definition
     * @param {string} definition.path        - 路由路径，支持 /orders/:id
     * @param {string} definition.template    - HTML 片段路径（相对 frontend 根）
     * @param {string} [definition.title]     - 页面标题
     * @param {Function} definition.mount     - async (root, ctx) => void
     * @param {Function} [definition.unmount] - () => void
     */
    function view(name, definition) {
        if (!name || typeof definition !== 'object') {
            throw new Error('[view] 注册失败：缺少 name 或 definition');
        }
        registry[name] = definition;
        return definition;
    }

    function get(name) {
        return registry[name] || null;
    }

    function all() {
        return registry;
    }

    function current() {
        return { name: currentName, definition: currentDef };
    }

    /**
     * 构建传给 mount 的上下文
     */
    function createContext(params, path) {
        var controller = typeof AbortController !== 'undefined' ? new AbortController() : null;

        var ctx = {
            params: params || {},
            path: path,
            signal: controller ? controller.signal : null,

            /** 登记清理函数（离开页面时逆序执行） */
            onCleanup: function (fn) {
                if (typeof fn === 'function') cleanupStack.push(fn);
                return fn;
            },

            /** 站内跳转 */
            navigate: function (to, options) {
                return App.router.navigate(to, options);
            },

            /**
             * 注册监听，并在离开页面时卸掉。
             * 用创建上下文时拿到的原始 addEventListener，
             * 避免视图里临时替换 window.addEventListener 之后，异步回调注册的监听进不了清理列表。
             */
            listen: function (target, type, handler, options) {
                if (!target || typeof target.addEventListener !== 'function') return function () {};
                var add = target.addEventListener;
                if (target === global) add = nativeWindowAdd;
                else if (typeof document !== 'undefined' && target === document) add = nativeDocumentAdd;
                add.call(target, type, handler, options);
                var remove = function () {
                    target.removeEventListener(type, handler, options);
                };
                ctx.onCleanup(remove);
                return remove;
            }
        };

        // 把 abort 也纳入清理，切页时自动取消未完成的请求
        if (controller) {
            cleanupStack.push(function () {
                controller.abort();
            });
        }

        return ctx;
    }

    /**
     * 执行当前 view 的全部清理函数（逆序，类似 React effect cleanup）
     */
    function runCleanup() {
        while (cleanupStack.length) {
            var fn = cleanupStack.pop();
            try {
                fn();
            } catch (e) {
                console.error('[view] 清理函数执行失败:', e);
            }
        }
    }

    /**
     * 兜底清理：扫描容器内残留的 ECharts 实例并释放。
     * 即使 view 作者忘了 dispose，也不会累积内存。
     */
    function disposeCharts(root) {
        if (!root || typeof global.echarts === 'undefined') return;
        try {
            if (typeof global.echarts.getInstanceByDom !== 'function') return;
            Array.prototype.slice.call(
                root.querySelectorAll('[id$="Chart"], [id$="chart"], [_echarts_instance_]')
            ).forEach(function (node) {
                var instance = global.echarts.getInstanceByDom(node);
                if (instance) instance.dispose();
            });
        } catch (e) {
            console.warn('[view] ECharts 释放失败:', e.message);
        }
    }

    /**
     * 全局作用域快照 / 回收
     *
     * 旧页面脚本为了配合模板里的内联 `onclick="prevPage()"`，
     * 会把自己定义的处理函数挂到 window（`window.prevPage = prevPage`）。
     * 迁移到视图后这些赋值仍然存在：
     *   ✔ 好处：内联 onclick（含 JS 拼接出来的）继续可用，无需逐处改委托
     *   ✘ 坏处：切页后 window 上残留上一个页面的函数，闭包还抓着已卸载的 DOM
     *
     * 因此在 mount 前后对 window 的「自有键集」做快照，卸载时把本次新增的键删掉。
     * 这样既保住了旧代码的兼容性，又不会跨页泄漏。
     */
    // 框架自身与第三方库：由壳层维护，任何视图都不得回收
    var KEEP_GLOBALS = {
        App: true,
        echarts: true,
        tailwind: true,
        pdfjsLib: true,
        Sortable: true,
        html2canvas: true,
        Chart: true,
        JSZip: true,
        XLSX: true,
        QRCode: true
    };

    function snapshotGlobals() {
        var before = Object.create(null);
        Object.keys(global).forEach(function (k) {
            before[k] = true;
        });
        return before;
    }

    function restoreGlobals(before) {
        Object.keys(global).forEach(function (k) {
            if (before[k] || KEEP_GLOBALS[k]) return;
            try {
                delete global[k];
            } catch (e) {
                // 少数宿主属性不可 delete，退回置空，避免继续被误用
                try { global[k] = undefined; } catch (e2) { /* ignore */ }
            }
        });
    }

    /**
     * 切换视图的完整流程（由 router 调用）
     */
    async function activate(name, params, path) {
        var def = get(name);
        if (!def) throw new Error('[view] 未注册的视图: ' + name);

        var prevName = currentName;
        var prevDef = currentDef;

        // 1. 卸载上一个 view
        if (prevDef && typeof prevDef.unmount === 'function') {
            try {
                prevDef.unmount();
            } catch (e) {
                console.error('[view] unmount 失败:', prevName, e);
            }
        }
        runCleanup();

        // 2. 更新当前状态
        currentName = name;
        currentDef = def;

        return {
            definition: def,
            previous: prevName,
            // 供 router 在 DOM 替换后调用
            mount: async function (root) {
                var ctx = createContext(params, path);
                // 先拍快照再登记回收：回收要排在视图自己的清理之后执行
                var before = snapshotGlobals();
                ctx.onCleanup(function () {
                    restoreGlobals(before);
                });
                if (typeof def.mount === 'function') {
                    await def.mount(root, ctx);
                }
                return ctx;
            }
        };
    }

    App.view = view;
    App.views = {
        get: get,
        all: all,
        current: current,
        runCleanup: runCleanup,
        disposeCharts: disposeCharts,
        activate: activate
    };
    // 兼容简写：App.view 既是注册函数，也挂载查询能力
    App.view.get = get;
    App.view.all = all;

})(typeof window !== 'undefined' ? window : this);
