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
     * 旧代码里形如 `window.spaNavigate('settings.html')` 的调用点
     * （header.js 的通知跳转、canvas 的「去配置」）需要这个函数名，
     * 内部统一转成新路由。
     *
     * 旧版这里还有一张「页面名 → pages/xxx.html」的兜底表。
     * 旧页面文件已经全部删除，那张表只会把人送到 404，所以整张去掉了。
     */
    global.spaNavigate = function (pageName) {
        if (!pageName) return;
        var found = findViewByNav(pageName);
        if (found) {
            App.router.navigate(found.definition.path);
            return;
        }
        console.warn('[app] spaNavigate 找不到对应视图:', pageName);
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
            // 已注册视图 → SPA 内切，不整页刷新
            e.preventDefault();
            App.router.navigate(found.definition.path).catch(function (err) {
                console.error('[app] SPA 导航失败，回退整页跳转:', err);
                global.location.href = link.getAttribute('href');
            });
            return;
        }

        // 没找到视图就不拦截，交给浏览器按 href 走（最终会落到 SPA 入口）
        console.warn('[app] 侧边栏导航项没有对应视图:', page);
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
