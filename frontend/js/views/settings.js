/**
 * 设置中心入口。
 * 各块的加载、保存和状态提示在 js/settings/ 下，这里只负责挂上和卸下。
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
            var _docAdd = document.addEventListener;
            var _winAdd = window.addEventListener;
            var _listeners = [];
            document.addEventListener = function (t, f, o) {
                _listeners.push(['doc', t, f, o]);
                return _docAdd.call(document, t, f, o);
            };
            window.addEventListener = function (t, f, o) {
                _listeners.push(['win', t, f, o]);
                return _winAdd.call(window, t, f, o);
            };
            ctx.onCleanup(function () {
                document.addEventListener = _docAdd;
                window.addEventListener = _winAdd;
                _listeners.forEach(function (row) {
                    try {
                        (row[0] === 'doc' ? document : window).removeEventListener(row[1], row[2], row[3]);
                    } catch (e) { /* ignore */ }
                });
            });

            try {
                if (!global.SettingsPage) throw new Error('SettingsPage 未加载');
                global.SettingsPage.mount(ctx);
            } finally {
                document.addEventListener = _docAdd;
                window.addEventListener = _winAdd;
            }
        }
    });
})(typeof window !== 'undefined' ? window : this);
