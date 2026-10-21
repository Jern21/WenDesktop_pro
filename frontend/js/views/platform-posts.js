/**
 * 平台内容视图（抖音 / 闲鱼 / 小红书）
 *
 * 重构收益示例：旧架构下这三个页面是三个近乎相同的 81 行 HTML 文件，
 * 容器结构**字节级完全一致**，只有 PlatformManager.init() 的参数不同。
 * 现在合并为：
 *   - 1 个模板 views/platform-posts.html
 *   - 1 个工厂函数，按配置注册 3 个视图
 * 以后加平台只需要在 PLATFORMS 里加一条配置。
 */
(function (global) {
    'use strict';

    var App = global.App = global.App || {};

    // 各平台差异全部收敛到这里
    var PLATFORMS = {
        douyin: {
            label: '抖音',
            color: 'gray',
            accentClass: 'bg-black text-white',
            accentLight: 'bg-gray-100 text-gray-800 border-gray-400',
            accentText: 'text-gray-800',
            categories: ['起号攻略', '案例展示', '引流视频', '工具推荐', '其他'],
            aspectRatio: 'aspect-[3/4]',
            isVideo: true
        },
        xianyu: {
            label: '闲鱼',
            color: 'yellow',
            accentClass: 'bg-yellow-400 text-yellow-900',
            accentLight: 'bg-yellow-50 text-yellow-700 border-yellow-300',
            accentText: 'text-yellow-500',
            categories: ['引流海报', '毕设代做', '接单定制', '设计服务', '其他'],
            aspectRatio: 'aspect-[3/4]',
            isVideo: false
        },
        xiaohongshu: {
            label: '小红书',
            color: 'red',
            accentClass: 'bg-red-500 text-white',
            accentLight: 'bg-red-50 text-red-600 border-red-300',
            accentText: 'text-red-500',
            categories: ['干货分享', '案例展示', '引流文案', '客户反馈', '其他'],
            aspectRatio: 'aspect-[3/4]',
            isVideo: false
        }
    };

    /**
     * 清理 platform-manager 挂载在 body 上的浮层。
     * 它自己也会监听 spa:cleanup-forms，这里做双保险（幂等操作）。
     */
    function cleanupPlatformOverlays() {
        ['pm-form-modal', 'pm-data-modal'].forEach(function (id) {
            var el = document.getElementById(id);
            if (el) el.remove();
        });
        document.body.style.overflow = '';
    }

    function registerPlatform(key, conf) {
        App.view('platform-' + key, {
            path: '/' + key,
            nav: key + '.html',
            title: conf.label,
            template: 'views/platform-posts.html',

            async mount(root, ctx) {
                if (!global.PlatformManager || typeof global.PlatformManager.init !== 'function') {
                    App.ui.toast('平台模块未加载', 'error');
                    return;
                }

                // 注意：platform-manager.js 的 init() 未提供 destroy，
                // 每次 init 会向 window 追加一个 spa:cleanup-forms 监听（幂等，影响可控）。
                // 后续若要把 platform-manager 也纳入新架构，应给它补一个 destroy()。
                global.PlatformManager.init(Object.assign({ platform: key }, conf));

                ctx.onCleanup(cleanupPlatformOverlays);
            }
        });
    }

    Object.keys(PLATFORMS).forEach(function (key) {
        registerPlatform(key, PLATFORMS[key]);
    });

    // 暴露配置，便于调试或后续扩展
    App.platformConfigs = PLATFORMS;

})(typeof window !== 'undefined' ? window : this);
