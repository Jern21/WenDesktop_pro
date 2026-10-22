/**
 * 项目读写。body 传对象，取消信号用当前页面的 ctx.signal。
 */
(function (global) {
    'use strict';

    var page = global.ProjectPage = global.ProjectPage || {};
    page.state = page.state || { cache: [], byId: {}, detailId: null, signal: null };
    page.board = page.board || {};
    page.list = page.list || {};
    page.detail = page.detail || {};
    page.form = page.form || {};

    var AVATAR_COLORS = [
        { bg: 'bfdbfe', color: '1d4ed8' },
        { bg: 'd1fae5', color: '047857' },
        { bg: 'fef3c7', color: '92400e' },
        { bg: 'fecaca', color: 'b91c1c' },
        { bg: 'e0e7ff', color: '4338ca' },
        { bg: 'fde68a', color: 'b45309' },
        { bg: 'f3f4f6', color: '6b7280' }
    ];

    page.avatar = function (name) {
        var ch = (name || '?').charAt(0);
        var hash = 0;
        var text = name || '';
        for (var i = 0; i < text.length; i++) { hash = ((hash << 5) - hash + text.charCodeAt(i)) | 0; }
        var c = AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
        return 'https://ui-avatars.com/api/?name=' + encodeURIComponent(ch) + '&background=' + c.bg + '&color=' + c.color;
    };

    page.escape = function (str) {
        if (!str) return '';
        return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    };

    page.money = function (amount) {
        if (!amount) return '—';
        return '¥' + Number(amount).toLocaleString();
    };

    page.date = function (dateStr) {
        if (!dateStr) return '—';
        var parts = String(dateStr).split('-');
        if (parts.length >= 2) return parts[1] + '-' + parts[2];
        return dateStr;
    };

    page.days = function (dateStr) {
        if (!dateStr) return null;
        var target = new Date(dateStr);
        var now = new Date();
        now.setHours(0, 0, 0, 0);
        target.setHours(0, 0, 0, 0);
        return Math.ceil((target - now) / 86400000);
    };

    page.get = function (projectId) {
        if (projectId && page.state.byId[projectId]) {
            var d = page.state.byId[projectId];
            if (!d.nginxConfigs) d.nginxConfigs = [];
            if (!d.desc) d.desc = d.description || '';
            return d;
        }
        return { id: '', code: '', name: '', status: '待确认需求', priority: '中', type: '网站开发', scope: 'enterprise', deadline: '', amount: '', progress: 0, desc: '', description: '', customer: '', tags: '', notes: '', localPath: '', cloudEnabled: false, cloudPath: '', cloudType: 'baidu', serverEnabled: false, serverAddr: '', serverSpec: '', nginxConfigs: [] };
    };

    page.copy = function (text) {
        if (!text) return false;
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(text).then(function () {}, function () { fallbackCopy(text); });
        } else {
            fallbackCopy(text);
        }
        return true;
    };

    function fallbackCopy(text) {
        var ta = document.createElement('textarea');
        ta.value = text;
        ta.style.cssText = 'position:fixed;opacity:0;pointer-events:none;';
        document.body.appendChild(ta);
        ta.select();
        try { document.execCommand('copy'); } catch (e) {}
        ta.remove();
    }

    function call(url, options) {
        options = options || {};
        // 用本文件持有的 page，不要再读 global.ProjectPage。
        // 视图卸载时 restoreGlobals 会删掉挂载期间新增的全局，
        // 第二次进入时闭包里的 state.signal 还在，全局对象已经没了。
        if (page.state && page.state.signal && !options.signal) {
            options.signal = page.state.signal;
        }
        var api = global.api;
        if (!api || typeof api.call !== 'function') {
            return Promise.reject(new Error('请求层未加载'));
        }
        return api.call(url, options);
    }

    global.ProjectsApi = {
        list: function () {
            return call('/api/projects');
        },
        save: function (data, isEdit, projectId) {
            if (isEdit && projectId) {
                return call('/api/projects/' + encodeURIComponent(projectId), {
                    method: 'PUT',
                    body: data
                });
            }
            return call('/api/projects', { method: 'POST', body: data });
        },
        moveStatus: function (projectId, status) {
            return call('/api/projects/' + encodeURIComponent(projectId), {
                method: 'PUT',
                body: { status: status }
            });
        }
    };

    page.api = global.ProjectsApi;
})(typeof window !== 'undefined' ? window : this);
