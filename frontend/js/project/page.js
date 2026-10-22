/**
 * 项目页入口：范围切换、拉数、挂上看板/列表/详情/表单，离开前可取消请求。
 */
(function (P) {
    'use strict';

    function toastType(icon, iconColor) {
        var iconText = String(icon || '');
        var color = String(iconColor || '');
        if (iconText.indexOf('warning') !== -1 || color === '#fbbf24') return 'warning';
        if (iconText.indexOf('check') !== -1 || color === '#4ade80') return 'success';
        if (color === '#ef4444' || color === '#f87171') return 'error';
        return 'info';
    }

    P.toast = function (msg, icon, iconColor) {
        var ui = window.App && window.App.ui;
        if (!ui || typeof ui.toast !== 'function') return;
        ui.toast(msg == null ? '' : String(msg), toastType(icon, iconColor));
    };

    function ensureStyles() {
        if (document.getElementById('proj-page-styles')) return;
        var styleEl = document.createElement('style');
        styleEl.id = 'proj-page-styles';
        styleEl.textContent = [
                '.pf-modal-overlay { position: fixed; inset: 0; z-index: 60; background: rgba(0,0,0,0.2); opacity: 0; transition: opacity 0.2s ease; }',
                '.pf-modal-overlay.show { opacity: 1; }',
                '.pf-modal-panel { position: absolute; right: 0; top: 0; bottom: 0; width: 100%; max-width: 480px; background: #fff; box-shadow: -10px 0 25px -5px rgba(0,0,0,0.15); display: flex; flex-direction: column; transform: translateX(100%); transition: transform 0.3s ease; }',
                '.pf-modal-overlay.show .pf-modal-panel { transform: translateX(0); }',
                '.pf-form-input { width: 100%; border: 1px solid #e5e7eb; border-radius: 0.5rem; padding: 0.5rem 0.75rem; font-size: 0.875rem; outline: none; transition: border-color 0.15s ease, box-shadow 0.15s ease; background: #fff; }',
                '.pf-form-input:focus { border-color: #3b82f6; box-shadow: 0 0 0 3px rgba(59,130,246,0.1); }',
                '.pf-form-label { display: block; font-size: 0.75rem; color: #6b7280; margin-bottom: 0.375rem; font-weight: 500; }',
                '.pf-toggle-switch { position: relative; display: inline-block; width: 44px; height: 24px; }',
                '.pf-toggle-switch input { opacity: 0; width: 0; height: 0; }',
                '.pf-toggle-slider { position: absolute; cursor: pointer; inset: 0; background: #d1d5db; border-radius: 9999px; transition: 0.3s; }',
                '.pf-toggle-slider:before { content: ""; position: absolute; height: 18px; width: 18px; left: 3px; bottom: 3px; background: #fff; border-radius: 50%; transition: 0.3s; box-shadow: 0 1px 3px rgba(0,0,0,0.2); }',
                '.pf-toggle-switch input:checked + .pf-toggle-slider { background: #3b82f6; }',
                '.pf-toggle-switch input:checked + .pf-toggle-slider:before { transform: translateX(20px); }',
                '.proj-ctx-menu { position: fixed; z-index: 70; background: #fff; border-radius: 0.5rem; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.15), 0 0 0 1px rgba(0,0,0,0.05); padding: 0.3rem; width: 11rem; opacity: 0; transform: scale(0.95); transform-origin: top left; transition: opacity 0.12s ease, transform 0.12s ease; pointer-events: none; }',
                '.proj-ctx-menu.show { opacity: 1; transform: scale(1); pointer-events: auto; }',
                '.proj-ctx-item { width: 100%; padding: 0.5rem 0.75rem; text-align: left; font-size: 0.8125rem; color: #374151; display: flex; align-items: center; gap: 0.5rem; border-radius: 0.375rem; transition: background 0.12s ease; cursor: pointer; }',
                '.proj-ctx-item:hover { background: #f3f4f6; }',
                '.proj-ctx-item.disabled { color: #d1d5db; cursor: not-allowed; }',
                '.proj-ctx-item.disabled:hover { background: transparent; }',
                '.proj-ctx-sep { height: 1px; background: #f1f5f9; margin: 0.25rem 0; }',
                '.proj-ctx-header { padding: 0.4rem 0.75rem 0.5rem; font-size: 0.6875rem; color: #9ca3af; border-bottom: 1px solid #f1f5f9; margin-bottom: 0.25rem; }',
                '.proj-ctx-label { padding: 0.3rem 0.75rem 0.2rem; font-size: 0.6875rem; color: #9ca3af; display: flex; align-items: center; gap: 0.375rem; }',
                '.proj-ctx-sub-wrap { position: relative; }',
                '.proj-ctx-sub-arrow { margin-left: auto; font-size: 0.7rem; color: #9ca3af; transition: transform 0.15s ease; }',
                '.proj-ctx-sub-wrap:hover .proj-ctx-sub-arrow { transform: translateX(2px); }',
                '.proj-ctx-submenu { position: absolute; left: 100%; top: -0.3rem; margin-left: 0.25rem; background: #fff; border-radius: 0.5rem; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.15), 0 0 0 1px rgba(0,0,0,0.05); padding: 0.3rem; width: 11rem; opacity: 0; transform: translateX(-4px) scale(0.95); transform-origin: left center; transition: opacity 0.12s ease, transform 0.12s ease; pointer-events: none; }',
                '.proj-ctx-sub-wrap:hover .proj-ctx-submenu { opacity: 1; transform: translateX(0) scale(1); pointer-events: auto; }',
                '.proj-ctx-menu.flip-left .proj-ctx-submenu { left: auto; right: 100%; top: -0.3rem; margin-left: 0; margin-right: 0.25rem; transform-origin: right center; transform: translateX(4px) scale(0.95); }',
                '.proj-ctx-menu.flip-left .proj-ctx-sub-wrap:hover .proj-ctx-submenu { transform: translateX(0) scale(1); }',
                '.proj-ctx-menu.flip-left .proj-ctx-sub-arrow { transform: rotate(180deg); }',
                '.proj-ctx-menu.flip-left .proj-ctx-sub-wrap:hover .proj-ctx-sub-arrow { transform: rotate(180deg) translateX(2px); }',
                '.proj-ctx-submenu.flip-up { transform-origin: left bottom; }',
                '.proj-ctx-menu.flip-left .proj-ctx-submenu.flip-up { transform-origin: right bottom; }',
                '#proj-detail-drawer.show { transform: translateX(0); }',
                '.pd-status-gray { background: #f3f4f6; color: #6b7280; border: 1px solid #e5e7eb; }',
                '.pd-status-green { background: #ecfdf5; color: #059669; border: 1px solid #a7f3d0; }',
                '.pd-status-blue { background: #eff6ff; color: #2563eb; border: 1px solid #bfdbfe; }',
                '.pd-status-purple { background: #f5f3ff; color: #7c3aed; border: 1px solid #ddd6fe; }',
                '.pd-priority-high { background: #fef2f2; color: #dc2626; border: 1px solid #fecaca; }',
                '.pd-priority-mid { background: #fffbeb; color: #d97706; border: 1px solid #fde68a; }',
                '.pd-priority-low { background: #f0fdf4; color: #16a34a; border: 1px solid #bbf7d0; }',
                // 梦幻极光主题适配
                '[data-theme="aurora"] .proj-ctx-menu { background: #1a1825 !important; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.4), 0 0 0 1px #2d2a40 !important; }',
                '[data-theme="aurora"] .proj-ctx-item { color: #a09bb8 !important; }',
                '[data-theme="aurora"] .proj-ctx-item:hover { background: #232032 !important; }',
                '[data-theme="aurora"] .proj-ctx-header { color: #6b6786 !important; border-color: #2d2a40 !important; }',
                '[data-theme="aurora"] .proj-ctx-sep { background: #2d2a40 !important; }',
                '[data-theme="aurora"] .proj-ctx-submenu { background: #1a1825 !important; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.4), 0 0 0 1px #2d2a40 !important; }',
                '[data-theme="aurora"] #proj-detail-drawer { background: #1a1825 !important; border-color: #2d2a40 !important; color: #e2e0f0 !important; }',
                '[data-theme="aurora"] .pf-modal-panel { background: #1a1825 !important; }',
                '[data-theme="aurora"] .pf-form-input { background: #232032 !important; border-color: #2d2a40 !important; color: #e2e0f0 !important; }',
                // 微光数字主题适配
                '[data-theme="glow-digital"] .proj-ctx-menu { background: rgba(255,255,255,0.85) !important; backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); box-shadow: 0 10px 25px -5px rgba(99,102,241,0.12), 0 0 0 1px rgba(148,163,184,0.25) !important; }',
                '[data-theme="glow-digital"] .proj-ctx-item { color: #475569 !important; }',
                '[data-theme="glow-digital"] .proj-ctx-item:hover { background: rgba(99,102,241,0.08) !important; }',
                '[data-theme="glow-digital"] .proj-ctx-header { color: #94a3b8 !important; border-color: rgba(148,163,184,0.25) !important; }',
                '[data-theme="glow-digital"] .proj-ctx-sep { background: rgba(148,163,184,0.2) !important; }',
                '[data-theme="glow-digital"] .proj-ctx-submenu { background: rgba(255,255,255,0.9) !important; backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); box-shadow: 0 10px 25px -5px rgba(99,102,241,0.12), 0 0 0 1px rgba(148,163,184,0.25) !important; }',
                '[data-theme="glow-digital"] #proj-detail-drawer { background: rgba(255,255,255,0.88) !important; backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); border-color: rgba(148,163,184,0.25) !important; color: #1e293b !important; }',
                '[data-theme="glow-digital"] .pf-modal-panel { background: rgba(255,255,255,0.92) !important; backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); }',
                '[data-theme="glow-digital"] .pf-form-input { background: #ffffff !important; border-color: rgba(148,163,184,0.4) !important; color: #1e293b !important; }',
                // 微光数字暗主题适配
                '[data-theme="glow-digital-dark"] .proj-ctx-menu { background: rgba(15,23,42,0.92) !important; backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); box-shadow: 0 10px 25px -5px rgba(0,0,0,0.5), 0 0 0 1px rgba(99,102,241,0.2) !important; }',
                '[data-theme="glow-digital-dark"] .proj-ctx-item { color: #94a3b8 !important; }',
                '[data-theme="glow-digital-dark"] .proj-ctx-item:hover { background: rgba(129,140,248,0.12) !important; }',
                '[data-theme="glow-digital-dark"] .proj-ctx-header { color: #64748b !important; border-color: rgba(99,102,241,0.18) !important; }',
                '[data-theme="glow-digital-dark"] .proj-ctx-sep { background: rgba(99,102,241,0.15) !important; }',
                '[data-theme="glow-digital-dark"] .proj-ctx-submenu { background: rgba(15,23,42,0.95) !important; backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); box-shadow: 0 10px 25px -5px rgba(0,0,0,0.5), 0 0 0 1px rgba(99,102,241,0.2) !important; }',
                '[data-theme="glow-digital-dark"] #proj-detail-drawer { background: rgba(15,23,42,0.9) !important; backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); border-color: rgba(99,102,241,0.18) !important; color: #e2e8f0 !important; }',
                '[data-theme="glow-digital-dark"] .pf-modal-panel { background: rgba(15,23,42,0.92) !important; backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); }',
                '[data-theme="glow-digital-dark"] .pf-form-input { background: #0f172a !important; border-color: rgba(99,102,241,0.3) !important; color: #e2e8f0 !important; }'
        ].join('\n');
        document.head.appendChild(styleEl);
    }

        var viewActive = 'px-3 py-1.5 bg-white shadow-sm rounded-md text-gray-800 text-xs font-medium flex items-center gap-1.5 transition-all';
        var viewInactive = 'px-3 py-1.5 text-gray-500 hover:text-gray-800 rounded-md text-xs font-medium flex items-center gap-1.5 transition-all';
        var scopeActive = 'px-4 py-2 bg-white shadow-sm rounded-md text-gray-800 text-sm font-medium flex items-center gap-2 transition-all';
        var scopeInactive = 'px-4 py-2 text-gray-500 hover:text-gray-800 rounded-md text-sm font-medium flex items-center gap-2 transition-all';

        function switchView(view, scope) {
            var prefix = scope === 'personal' ? 'p-' : '';
            var kanbanBtn = document.getElementById(prefix + 'view-kanban');
            var listBtn = document.getElementById(prefix + 'view-list');
            var kanbanView = document.getElementById(prefix + 'kanban-view');
            var listView = document.getElementById(prefix + 'list-view');
            if (!kanbanBtn || !listBtn || !kanbanView || !listView) return;

            if (view === 'list') {
                kanbanView.classList.add('hidden');
                listView.classList.remove('hidden');
                kanbanBtn.className = viewInactive;
                listBtn.className = viewActive;
            } else {
                listView.classList.add('hidden');
                kanbanView.classList.remove('hidden');
                listBtn.className = viewInactive;
                kanbanBtn.className = viewActive;
            }
        }

        function switchScope(scope) {
            var entBtn = document.getElementById('scope-enterprise');
            var perBtn = document.getElementById('scope-personal');
            var entContent = document.getElementById('scope-enterprise-content');
            var perContent = document.getElementById('scope-personal-content');
            if (!entBtn || !perBtn || !entContent || !perContent) return;

            if (scope === 'personal') {
                entContent.classList.add('hidden');
                perContent.classList.remove('hidden');
                entBtn.className = scopeInactive;
                perBtn.className = scopeActive;
            } else {
                perContent.classList.add('hidden');
                entContent.classList.remove('hidden');
                perBtn.className = scopeInactive;
                entBtn.className = scopeActive;
            }
        }

    P.renderAll = function () {
        P.board.summary('enterprise');
        P.board.summary('personal');
        P.board.kanban('enterprise');
        P.board.kanban('personal');
        P.list.render('enterprise');
        P.list.render('personal');
        P.board.bindMenu();
    };

    P.load = function () {
        return P.api.list().then(function (res) {
            if (!res || !res.success) {
                console.error('[Project] 加载失败:', res && res.error);
                return;
            }
            var list = res.data || [];
            P.state.cache = list;
            P.state.byId = {};
            list.forEach(function (p) {
                if (!p.desc) p.desc = p.description || '';
                if (!p.nginxConfigs) p.nginxConfigs = [];
                if (p.id) P.state.byId[p.id] = p;
            });
            P.renderAll();
        }).catch(function (err) {
            if (err && err.name === 'AbortError') return;
            console.error('[Project] 加载失败:', err);
        });
    };

    P.setSignal = function (signal) {
        P.state.signal = signal || null;
    };

    function exposeGlobals() {
        window.openEditForm = function (projectId) {
            P.form.open(projectId || null);
        };
    }

    function init() {
        exposeGlobals();
        ensureStyles();
        P.board.clearDemo();

        var entScopeBtn = document.getElementById('scope-enterprise');
        var perScopeBtn = document.getElementById('scope-personal');
        if (entScopeBtn && !entScopeBtn.dataset.bound) {
            entScopeBtn.dataset.bound = 'true';
            entScopeBtn.addEventListener('click', function () { switchScope('enterprise'); });
        }
        if (perScopeBtn && !perScopeBtn.dataset.bound) {
            perScopeBtn.dataset.bound = 'true';
            perScopeBtn.addEventListener('click', function () { switchScope('personal'); });
        }

        var eKanbanBtn = document.getElementById('view-kanban');
        var eListBtn = document.getElementById('view-list');
        if (eKanbanBtn && !eKanbanBtn.dataset.bound) {
            eKanbanBtn.dataset.bound = 'true';
            eKanbanBtn.addEventListener('click', function () { switchView('kanban', 'enterprise'); });
        }
        if (eListBtn && !eListBtn.dataset.bound) {
            eListBtn.dataset.bound = 'true';
            eListBtn.addEventListener('click', function () { switchView('list', 'enterprise'); });
        }

        var pKanbanBtn = document.getElementById('p-view-kanban');
        var pListBtn = document.getElementById('p-view-list');
        if (pKanbanBtn && !pKanbanBtn.dataset.bound) {
            pKanbanBtn.dataset.bound = 'true';
            pKanbanBtn.addEventListener('click', function () { switchView('kanban', 'personal'); });
        }
        if (pListBtn && !pListBtn.dataset.bound) {
            pListBtn.dataset.bound = 'true';
            pListBtn.addEventListener('click', function () { switchView('list', 'personal'); });
        }

        P.board.bindMenu();
        P.detail.bind();
        P.load();
    }

    function isProjectPageMounted() {
        return !!(document.getElementById('scope-enterprise-content') && document.getElementById('kanban-view'));
    }

    function initWhenProjectPageMounted() {
        if (!isProjectPageMounted()) return;
        init();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initWhenProjectPageMounted);
    }

    if (!document._projectPageSpaReadyBound) {
        document._projectPageSpaReadyBound = true;
        window.addEventListener('spa:ready', function (e) {
            var page = (e.detail && e.detail.page) || '';
            if (page && page.indexOf('project') === -1) return;
            initWhenProjectPageMounted();
        });
    }

    window.__projectPage = {
        init: init,
        exposeGlobals: exposeGlobals,
        setSignal: P.setSignal
    };
})(window.ProjectPage);
