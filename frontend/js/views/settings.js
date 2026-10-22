/**
 * 设置中心入口。
 * 各块的加载、保存和状态提示在 js/settings/ 下，这里只负责挂上和卸下。
 * 监听用 ctx.listen，离开页面时由视图上下文卸掉，这里不再替换全局 addEventListener。
 */
(function (global) {
    'use strict';

    var App = global.App = global.App || {};

    App.view('settings', {
        path: '/settings',
        nav: 'settings.html',
        title: '设置中心',
        template: 'views/settings.html',
        styles: 'css/views/settings.css',

        async mount(root, ctx) {
            if (!global.SettingsPage) throw new Error('SettingsPage 未加载');
            global.SettingsPage.mount(ctx);
        }
    });
})(typeof window !== 'undefined' ? window : this);
