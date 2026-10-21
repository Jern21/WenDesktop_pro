/**
 * 应用更新日志（顶栏「更新日志」按钮）
 *
 * 维护方式：在 CHANGELOG 数组顶部追加新版本条目，并更新 LATEST_VERSION。
 */
(function (global) {
    'use strict';

    var LATEST_VERSION = '2.0.0';
    var STORAGE_KEY = 'wt_changelog_seen_version';

    /** @type {Array<{version:string,date:string,title:string,tag?:string,highlights:string[]}>} */
    var CHANGELOG = [
        {
            version: '2.0.0',
            date: '2026-10-21',
            title: '真 SPA 架构优化',
            tag: '重大更新',
            highlights: [
                '单一入口 app.html：全局脚本与样式只维护一份，加资源不用改 18 个页面',
                'core 框架层：统一路由（History API）、视图生命周期 mount/unmount、自动清理定时器与监听',
                '18 个业务页全部迁入 js/views，支持刷新、深链接、浏览器前进后退',
                '三平台内容页合并为一套模板 + 配置工厂（抖音 / 闲鱼 / 小红书）',
                '公共能力收敛：App.dom 安全转义、App.ui 统一 Toast / 弹窗',
                '后端鉴权：本机可免登录，局域网/公网需密码；API 与页面访问统一守卫',
                '自动化验收：路由对账、冒烟与表单模块测试，降低迁移回归风险'
            ]
        },
        {
            version: '1.2.0',
            date: '2026-07',
            title: '业务能力与体验',
            tag: '功能',
            highlights: [
                '智能仪表盘：收入统计、订单趋势、平台发布与待办聚合',
                '订单 / 客户 / 报价全流程与多维筛选、回收站',
                '宣传素材库、画布、数据统计与项目看板',
                '待办提醒、备忘、账号书签、简历与系统设置（备份 / 导出）'
            ]
        },
        {
            version: '1.0.0',
            date: '2026-03',
            title: '项目工作台首发',
            tag: '首发',
            highlights: [
                'Node.js + Express 本地服务，JSON 文件存储与自动备份',
                '多平台发帖台账（小红书 / 闲鱼 / 抖音）',
                '原生 JavaScript + Tailwind + ECharts，无构建工具，改完刷新即生效'
            ]
        }
    ];

    function escapeHtml(value) {
        if (global.App && global.App.dom && global.App.dom.escapeHtml) {
            return global.App.dom.escapeHtml(value);
        }
        return String(value == null ? '' : value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function tagClass(tag) {
        if (tag === '重大更新') return 'bg-brand-50 text-brand-700';
        if (tag === '首发') return 'bg-purple-50 text-purple-700';
        return 'bg-gray-100 text-gray-600';
    }

    function buildContentHtml() {
        var parts = [
            '<p class="text-sm text-gray-500 mb-4">当前版本 <span class="font-semibold text-gray-800">v' +
                escapeHtml(LATEST_VERSION) + '</span>。以下为各版本主要变化，新条目会出现在最上方。</p>',
            '<div class="space-y-5">'
        ];

        CHANGELOG.forEach(function (entry, index) {
            var isLatest = index === 0;
            parts.push(
                '<section class="relative pl-4 border-l-2 ' + (isLatest ? 'border-brand-500' : 'border-gray-200') + '">',
                '<div class="flex flex-wrap items-center gap-2 mb-1">',
                '<span class="text-sm font-bold text-gray-900">v' + escapeHtml(entry.version) + '</span>',
                '<span class="text-xs text-gray-400">' + escapeHtml(entry.date) + '</span>'
            );
            if (entry.tag) {
                parts.push(
                    '<span class="text-[10px] font-semibold px-2 py-0.5 rounded-full ' +
                    tagClass(entry.tag) + '">' + escapeHtml(entry.tag) + '</span>'
                );
            }
            parts.push(
                '</div>',
                '<h4 class="text-sm font-medium text-gray-800 mb-2">' + escapeHtml(entry.title) + '</h4>',
                '<ul class="space-y-1.5 text-sm text-gray-600 leading-relaxed list-disc pl-4">'
            );
            (entry.highlights || []).forEach(function (line) {
                parts.push('<li>' + escapeHtml(line) + '</li>');
            });
            parts.push('</ul></section>');
        });

        parts.push('</div>');
        return parts.join('');
    }

    function markSeen() {
        try {
            localStorage.setItem(STORAGE_KEY, LATEST_VERSION);
        } catch (e) { /* ignore */ }
        syncBadge();
    }

    function hasUnread() {
        try {
            return localStorage.getItem(STORAGE_KEY) !== LATEST_VERSION;
        } catch (e) {
            return true;
        }
    }

    function syncBadge() {
        var badge = document.getElementById('changelog-badge');
        if (!badge) return;
        badge.style.display = hasUnread() ? 'block' : 'none';
    }

    function openFallbackModal() {
        var overlay = document.createElement('div');
        overlay.className = 'fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-[100000]';
        overlay.innerHTML =
            '<div class="bg-white rounded-xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden shadow-xl">' +
            '<div class="flex items-center justify-between px-5 py-4 border-b border-gray-100">' +
            '<h3 class="text-base font-medium text-gray-900">更新日志</h3>' +
            '<button type="button" id="changelog-fallback-close" class="text-gray-400 hover:text-gray-600">' +
            '<i class="ph ph-x text-lg"></i></button></div>' +
            '<div class="flex-1 overflow-y-auto px-5 py-4">' + buildContentHtml() + '</div></div>';
        document.body.appendChild(overlay);
        document.body.style.overflow = 'hidden';
        function close() {
            if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
            document.body.style.overflow = '';
            markSeen();
        }
        overlay.addEventListener('click', function (e) {
            if (e.target === overlay || e.target.closest('#changelog-fallback-close')) close();
        });
        markSeen();
    }

    function open() {
        var title = '更新日志';
        if (global.App && global.App.ui && typeof global.App.ui.modal === 'function') {
            global.App.ui.modal({
                title: title,
                width: 'max-w-2xl',
                content: buildContentHtml(),
                onClose: syncBadge
            });
            markSeen();
            return;
        }
        openFallbackModal();
    }

    global.AppChangelog = {
        version: LATEST_VERSION,
        entries: CHANGELOG,
        open: open,
        hasUnread: hasUnread,
        markSeen: markSeen,
        syncBadge: syncBadge
    };
})(typeof window !== 'undefined' ? window : this);
