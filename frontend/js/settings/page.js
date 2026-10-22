/**
 * 设置页只负责登记子模块、挂载和销毁。
 * 资料、主题、菜单、AI、Bug、备份各自一个文件，互不共享闭包。
 */
(function (global) {
    'use strict';

    var sections = [];

    global.SettingsPage = {
        section: function (mount) {
            sections.push(mount);
        },
        mount: function (ctx) {
            var destroys = [];
            sections.forEach(function (mount) {
                try {
                    var destroy = mount(ctx);
                    if (typeof destroy === 'function') destroys.push(destroy);
                } catch (e) {
                    console.error('[Settings] 子模块挂载失败:', e);
                }
            });
            if (ctx && typeof ctx.onCleanup === 'function') {
                ctx.onCleanup(function () {
                    destroys.reverse().forEach(function (destroy) {
                        try { destroy(); } catch (e) { console.error('[Settings] 子模块销毁失败:', e); }
                    });
                });
            }
        }
    };
})(typeof window !== 'undefined' ? window : this);
