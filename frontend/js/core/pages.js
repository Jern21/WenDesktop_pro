/**
 * App.pages —— 全站唯一的切页入口
 *
 * 侧边栏、window.spaNavigate、小柴对话都走这里。
 * 不要在业务里再写一套「名字 → 路径」或直接调 router.navigate。
 *
 * 能认的目标：
 *   视图名   orders
 *   路由     /orders
 *   侧栏键   orders.html
 *   页面标题 我的订单
 *   口头叫法 订单、数据统计（见 ALIASES）
 */
(function (global) {
    'use strict';

    var App = global.App = global.App || {};

    /** 口头叫法 → 视图名。新增页面时只改这一张表。 */
    var ALIASES = {
        '首页': 'dashboard',
        '订单': 'orders',
        '我的订单': 'orders',
        '报价': 'quote',
        '报价管理': 'quote',
        '海报': 'posters',
        '宣传海报': 'posters',
        '画布': 'canvas',
        '无限画布': 'canvas',
        '平台': 'platform',
        '平台管理': 'platform',
        '总览看板': 'platform',
        '闲鱼': 'platform-xianyu',
        '小红书': 'platform-xiaohongshu',
        '抖音': 'platform-douyin',
        '客户': 'customer',
        '客户管理': 'customer',
        '统计': 'stats',
        '数据统计': 'stats',
        '项目': 'project',
        '项目管理': 'project',
        '账号': 'accounts',
        '账号管理': 'accounts',
        '收藏': 'bookmarks',
        '网址收藏': 'bookmarks',
        '简历': 'resume',
        '简历管理': 'resume',
        '备忘': 'memo',
        '备忘录': 'memo',
        '信息备忘录': 'memo',
        '提醒': 'reminder',
        '日期提醒': 'reminder',
        '设置': 'settings',
        '设置中心': 'settings'
    };

    function views() {
        if (!App.views || typeof App.views.all !== 'function') return [];
        var all = App.views.all();
        return Object.keys(all).map(function (name) {
            return { name: name, definition: all[name] };
        }).filter(function (item) {
            return item.definition && item.definition.path;
        });
    }

    function byName(name) {
        var list = views();
        for (var i = 0; i < list.length; i++) {
            if (list[i].name === name) return list[i];
        }
        return null;
    }

    function describe(item) {
        var def = item.definition;
        return {
            name: item.name,
            path: def.path,
            title: def.title || item.name,
            nav: def.nav || '',
            definition: def
        };
    }

    /**
     * 把各种叫法解析成已注册视图。认不出返回 null。
     * @param {string} target
     */
    function resolve(target) {
        var raw = String(target == null ? '' : target).trim();
        if (!raw) return null;

        var list = views();
        var i;
        var item;

        if (raw.charAt(0) === '/' && App.router && App.router.normalizePath) {
            var path = App.router.normalizePath(raw);
            for (i = 0; i < list.length; i++) {
                if (list[i].definition.path === path) return describe(list[i]);
            }
        }

        item = byName(raw);
        if (item) return describe(item);

        var alias = ALIASES[raw];
        if (alias) {
            item = byName(alias);
            if (item) return describe(item);
        }

        for (i = 0; i < list.length; i++) {
            var def = list[i].definition;
            if (def.nav === raw || def.title === raw) return describe(list[i]);
        }
        return null;
    }

    /**
     * 切到目标页。
     * @returns {Promise<{ok:boolean, already?:boolean, name?:string, path?:string, title?:string, reason?:string, target?:string}>}
     */
    function go(target, options) {
        var found = resolve(target);
        if (!found) {
            return Promise.resolve({ ok: false, reason: 'unknown', target: String(target || '') });
        }
        if (!App.router || typeof App.router.navigate !== 'function') {
            return Promise.resolve({ ok: false, reason: 'router', target: String(target || '') });
        }

        var current = App.router.normalizePath(global.location.pathname);
        var dest = App.router.normalizePath(found.path);
        var result = {
            ok: true,
            already: current === dest,
            name: found.name,
            path: found.path,
            title: found.title
        };
        if (result.already && !(options && options.force)) {
            return Promise.resolve(result);
        }
        return Promise.resolve(App.router.navigate(found.path, options)).then(function () {
            return result;
        });
    }

    App.pages = {
        resolve: resolve,
        go: go
    };
})(typeof window !== 'undefined' ? window : this);
