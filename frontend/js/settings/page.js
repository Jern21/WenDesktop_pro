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
        /**
         * 设置页统一走公共请求层。
         * body 传对象或 FormData，不要先 JSON.stringify。
         * 成功时返回后端整包 { success, data }；success:false 或 HTTP 错误会抛出。
         */
        call: function (url, options) {
            options = options || {};
            var api = global.api;
            if (!api || typeof api.call !== 'function') {
                return Promise.reject(new Error('请求层未加载'));
            }
            return api.call(url, options).then(function (result) {
                if (result && typeof result === 'object' && result.success === false) {
                    throw new Error(result.error || result.message || '请求失败');
                }
                return result;
            });
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
