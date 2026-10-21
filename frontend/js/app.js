/**
 * 应用启动入口（新 SPA）
 *
 * 职责：
 *   1. 导航桥接 —— 拦截侧边栏链接，已迁移的页面走 SPA 内切，未迁移的整页跳回旧页面。
 *      这让迁移期间系统始终可用：迁一个页面就接管一个，剩下的照常工作。
 *   2. 启动 router。
 *
 * 各视图在 js/views/*.js 里自注册，本文件不关心具体业务。
 */
(function (global) {
    'use strict';

    var App = global.App;
    if (!App || !App.router) {
        console.error('[app] 核心层未加载，请检查 js/core/*.js 的引入顺序');
        return;
    }

    /**
     * 按侧边栏的 data-page 键找已迁移的视图
     */
    function findViewByNav(navKey) {
        var views = App.views.all();
        var names = Object.keys(views);
        for (var i = 0; i < names.length; i++) {
            var def = views[names[i]];
            if (def && def.nav === navKey && def.path) {
                return { name: names[i], definition: def };
            }
        }
        return null;
    }

    /**
     * 取第一个带路由的视图，作为无匹配路径时的落地页
     */
    function firstRoutableView() {
        var views = App.views.all();
        var names = Object.keys(views);
        for (var i = 0; i < names.length; i++) {
            var def = views[names[i]];
            if (def && def.path) return def;
        }
        return null;
    }

    // ========== 兼容层：旧 spaNavigate ==========

    /**
     * 旧页面文件 → 物理路径（仅用于「尚未迁移」页面的整页跳转兜底）
     */
    var LEGACY_ROUTES = {
        'index.html': 'index.html',
        'orders.html': 'pages/business/orders.html',
        'quote.html': 'pages/business/quote.html',
        'customer.html': 'pages/business/customer.html',
        'platform.html': 'pages/platform/platform.html',
        'xianyu.html': 'pages/platform/xianyu.html',
        'xiaohongshu.html': 'pages/platform/xiaohongshu.html',
        'douyin.html': 'pages/platform/douyin.html',
        'posters.html': 'pages/content/posters.html',
        'canvas.html': 'pages/content/canvas.html',
        'stats.html': 'pages/content/stats.html',
        'project.html': 'pages/content/project.html',
        'accounts.html': 'pages/personal/accounts.html',
        'bookmarks.html': 'pages/personal/bookmarks.html',
        'resume.html': 'pages/personal/resume.html',
        'memo.html': 'pages/personal/memo.html',
        'reminder.html': 'pages/personal/reminder.html',
        'settings.html': 'pages/personal/settings.html'
    };

    /**
     * 旧代码里形如 `window.spaNavigate('settings.html')` 的调用点
     * （header.js 通知跳转、canvas.html 的「去配置」）在新入口里没有实现，
     * 这里补上：已迁移走 SPA，未迁移整页跳旧页面。
     */
    global.spaNavigate = function (pageName) {
        if (!pageName) return;
        var found = findViewByNav(pageName);
        if (found) {
            App.router.navigate(found.definition.path);
            return;
        }
        var legacy = LEGACY_ROUTES[pageName];
        if (legacy) global.location.href = '/' + legacy;
    };

    // ========== 导航桥接 ==========

    document.addEventListener('click', function (e) {
        var link = e.target.closest('a[data-page]');
        if (!link) return;

        var page = link.getAttribute('data-page');
        if (!page || page === '#') return;

        // 尊重用户的新标签页 / 修饰键意图
        if (link.target === '_blank' || e.metaKey || e.ctrlKey || e.shiftKey) return;

        var found = findViewByNav(page);
        if (found) {
            // 已迁移 → SPA 内切，不整页刷新
            e.preventDefault();
            App.router.navigate(found.definition.path).catch(function (err) {
                console.error('[app] SPA 导航失败，回退整页跳转:', err);
                global.location.href = link.getAttribute('href');
            });
            return;
        }

        // 未迁移 → 不拦截，按原 href 正常跳转到旧页面（迁移期正常现象）
    });

    // ========== 启动 ==========

    function bootstrap() {
        var current = App.router.match(global.location.pathname);

        if (current) {
            App.router.start();
            return;
        }

        // 入口页本身（如 /app.html）不对应任何路由时，落到第一个视图
        var fallback = firstRoutableView();
        if (!fallback) {
            console.warn('[app] 没有注册任何带路由的视图');
            return;
        }
        App.router.start({ initial: fallback.path });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', bootstrap);
    } else {
        bootstrap();
    }

    // 暴露给调试用
    App.findViewByNav = findViewByNav;

})(typeof window !== 'undefined' ? window : this);
