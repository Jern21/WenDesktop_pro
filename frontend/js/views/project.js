/**
 * 项目管理 视图
 *
 * 这一页比较特殊：旧页面里**没有内联脚本**，全部逻辑都在 js/project-page.js
 * （一个 100KB 的全局 IIFE），它自身已经做了两件事：
 *   1. 用 isProjectPageMounted() 判断 DOM 是否就位；
 *   2. 监听 spa:ready 重新初始化（并在 window.__projectPageSpaReadyBound 上防重复绑定）。
 *
 * 所以这个视图只负责「元信息 + 按需加载脚本 + 通知它页面已就绪 + 离开时收浮层」，
 * 不搬任何业务代码 —— 等后续要拆 project-page.js 时再逐块迁进来。
 */
(function (global) {
    'use strict';

    var App = global.App = global.App || {};

    var SCRIPT_SRC = 'js/project-page.js';
    var SCRIPT_FLAG = 'data-project-page';
    var loadPromise = null;
    // 抓到 project-page.js 暴露的入口，存在闭包里跨挂载存活。
    // 不能只靠 window.__projectPage：那是「挂载期间新增的 window 键」，
    // 会被 core/view.js 的 restoreGlobals 在离开时删掉。
    var pageApi = null;

    /**
     * 按需加载 project-page.js（只加载一次）
     */
    function ensureScript() {
        if (loadPromise) return loadPromise;

        loadPromise = new Promise(function (resolve, reject) {
            // 已经加载过（例如旧页面跳过来）就直接复用
            if (document.querySelector('script[' + SCRIPT_FLAG + ']')) {
                resolve();
                return;
            }
            var s = document.createElement('script');
            s.src = SCRIPT_SRC;
            s.async = false;
            s.setAttribute(SCRIPT_FLAG, '1');
            s.onload = function () { resolve(); };
            s.onerror = function () {
                loadPromise = null;     // 允许下次重试
                reject(new Error('project-page.js 加载失败'));
            };
            document.head.appendChild(s);
        }).then(function () {
            // 脚本执行完毕，把入口抓进闭包
            pageApi = global.__projectPage || null;
            if (!pageApi) {
                console.warn('[project] project-page.js 未暴露 __projectPage，' +
                    '全局入口（openEditForm）在二次进入时可能失效');
            }
        });

        return loadPromise;
    }

    /**
     * 清掉 project-page.js 挂到 body 上的浮层
     */
    function cleanupOverlays() {
        ['pf-modal', 'proj-detail-drawer'].forEach(function (id) {
            var el = document.getElementById(id);
            if (el) el.remove();
        });
        Array.prototype.slice.call(document.querySelectorAll('.proj-ctx-menu')).forEach(function (el) {
            el.remove();
        });
        document.body.style.overflow = '';
    }

    App.view('project', {
        path: '/project',
        nav: 'project.html',
        title: '项目管理',
        template: 'views/project.html',
        styles: 'css/views/project.css',

        async mount(root, ctx) {
            try {
                await ensureScript();
            } catch (err) {
                console.error('[project] 加载失败:', err);
                root.innerHTML =
                    '<div class="flex-1 flex flex-col items-center justify-center text-center p-10">' +
                        '<i class="ph ph-warning-circle text-4xl text-red-400"></i>' +
                        '<p class="mt-3 text-sm text-gray-500">项目管理脚本加载失败，请刷新重试</p>' +
                    '</div>';
                return;
            }

            // 每次挂载都重新暴露全局入口：
            // 上一次离开时 view.js 的 restoreGlobals 已经把 openEditForm 删掉了，
            // 而脚本不会重新执行，只能靠这里主动补回来。
            if (pageApi && typeof pageApi.exposeGlobals === 'function') {
                pageApi.exposeGlobals();
            }

            // 脚本加载完成时 spa:ready 可能已经派发过了，这里补发一次，
            // 让 project-page.js 内部的 spa:ready 监听执行初始化。
            // detail.page 用旧页面标识，与它内部的 page.indexOf('project') 守卫对齐。
            global.dispatchEvent(new CustomEvent('spa:ready', {
                detail: { page: 'project.html', view: 'project', path: '/project' }
            }));

            ctx.onCleanup(cleanupOverlays);
        }
    });

})(typeof window !== 'undefined' ? window : this);
