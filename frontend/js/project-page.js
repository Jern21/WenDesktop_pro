/**
 * 项目管理页面脚本。
 * 从 pages/content/project.html 拆出，保持页面 HTML 更轻，便于后续继续拆分。
 */
(function () {
        'use strict';

        // ========== SPA 模式下注入自定义 CSS ==========
        if (!document.getElementById('proj-page-styles')) {
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

        // ========== 视图/Scope 切换 ==========
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

        // ========== 项目数据（从后端 API 加载） ==========
        var projectCache = [];
        var projectMap = {};

        // 看板列配置
        var KANBAN_COLUMNS = [
            { key: '待确认需求', dotClass: 'bg-gray-400', colClass: 'bg-gray-50', headerBorder: 'border-gray-100' },
            { key: '开发/设计中', dotClass: 'bg-green-500', colClass: 'bg-green-50/30', headerBorder: 'border-green-100/50' },
            { key: '待验收', dotClass: 'bg-orange-500', colClass: 'bg-orange-50/30', headerBorder: 'border-orange-100/50' },
            { key: '已完成', dotClass: 'bg-purple-500', colClass: 'bg-purple-50/30', headerBorder: 'border-purple-100/50' },
            { key: '已关闭', dotClass: 'bg-gray-400', colClass: 'bg-gray-50', headerBorder: 'border-gray-100' }
        ];

        // 类型标签样式映射
        var TYPE_TAG_STYLES = {
            '网站开发': 'bg-blue-50 text-blue-600 border-blue-100',
            '小程序': 'bg-cyan-50 text-cyan-600 border-cyan-100',
            'UI/设计': 'bg-purple-50 text-purple-600 border-purple-100',
            '平面设计': 'bg-orange-50 text-orange-600 border-orange-100',
            '视频剪辑': 'bg-gray-100 text-gray-600 border-gray-200',
            '内容创作': 'bg-green-50 text-green-600 border-green-100',
            '其他': 'bg-gray-100 text-gray-600 border-gray-200'
        };

        // 优先级样式映射
        var PRIORITY_STYLES = {
            '高': { badge: 'text-red-600 bg-red-50 border-red-100', label: '高优先级' },
            '中': { badge: 'text-yellow-600 bg-yellow-50 border-yellow-100', label: '中优先级' },
            '低': { badge: 'text-gray-500 bg-gray-50 border-gray-200', label: '低优先级' }
        };

        // 状态样式映射（列表视图）
        var STATUS_BADGE_STYLES = {
            '待确认需求': 'text-gray-600 bg-gray-50 border-gray-200',
            '开发/设计中': 'text-green-600 bg-green-50 border-green-100',
            '待验收': 'text-orange-600 bg-orange-50 border-orange-100',
            '已完成': 'text-purple-600 bg-purple-50 border-purple-100',
            '已关闭': 'text-gray-500 bg-gray-100 border-gray-200'
        };

        // 状态圆点颜色（列表视图）
        var STATUS_DOT_STYLES = {
            '待确认需求': 'bg-gray-400',
            '开发/设计中': 'bg-green-500',
            '待验收': 'bg-orange-500',
            '已完成': 'bg-purple-500',
            '已关闭': 'bg-gray-400'
        };

        // 进度条颜色
        var PROGRESS_BAR_STYLES = {
            '待确认需求': 'bg-gray-300',
            '开发/设计中': 'bg-brand-500',
            '待验收': 'bg-green-500',
            '已完成': 'bg-green-500',
            '已关闭': 'bg-gray-300'
        };

        // 头像背景色池
        var AVATAR_COLORS = [
            { bg: 'bfdbfe', color: '1d4ed8' },
            { bg: 'd1fae5', color: '047857' },
            { bg: 'fef3c7', color: '92400e' },
            { bg: 'fecaca', color: 'b91c1c' },
            { bg: 'e0e7ff', color: '4338ca' },
            { bg: 'fde68a', color: 'b45309' },
            { bg: 'f3f4f6', color: '6b7280' }
        ];

        function getAvatarUrl(name) {
            var ch = (name || '?').charAt(0);
            var hash = 0;
            for (var i = 0; i < (name || '').length; i++) { hash = ((hash << 5) - hash + name.charCodeAt(i)) | 0; }
            var c = AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
            return 'https://ui-avatars.com/api/?name=' + encodeURIComponent(ch) + '&background=' + c.bg + '&color=' + c.color;
        }

        function escapeHtml(str) {
            if (!str) return '';
            return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
        }

        function renderKanbanLoading(scope) {
            var kanban = document.getElementById(scope === 'personal' ? 'p-kanban-view' : 'kanban-view');
            if (!kanban) return;
            kanban.innerHTML = KANBAN_COLUMNS.map(function (col) {
                return '<div class="flex-shrink-0 w-72 ' + col.colClass + ' rounded-xl border border-gray-100 flex flex-col max-h-[calc(100vh-260px)]">' +
                    '<div class="p-4 border-b ' + col.headerBorder + ' flex items-center justify-between">' +
                    '<div class="flex items-center gap-2">' +
                    '<span class="w-2 h-2 rounded-full ' + col.dotClass + '"></span>' +
                    '<h3 class="font-semibold text-gray-700 text-sm">' + col.key + '</h3>' +
                    '</div>' +
                    '<span class="text-xs text-gray-400 bg-white px-2 py-0.5 rounded-full border border-gray-200">0</span>' +
                    '</div>' +
                    '<div class="flex-1 p-3">' +
                    '<div class="rounded-lg border border-dashed border-gray-200 bg-white/70 py-8 text-center text-xs text-gray-400">' +
                    '<i class="ph ph-spinner-gap animate-spin text-lg block mb-2"></i>加载项目中...' +
                    '</div>' +
                    '</div></div>';
            }).join('');
            kanban.style.visibility = 'visible';
            kanban.removeAttribute('data-project-static-demo');
        }

        function clearStaticProjectDemo() {
            ['enterprise', 'personal'].forEach(function (scope) {
                var kanban = document.getElementById(scope === 'personal' ? 'p-kanban-view' : 'kanban-view');
                if (kanban && kanban.getAttribute('data-project-static-demo') === 'true') {
                    renderKanbanLoading(scope);
                } else if (kanban) {
                    kanban.style.visibility = 'visible';
                }
            });

            [
                { id: 'ent-list-tbody', colspan: 9 },
                { id: 'per-list-tbody', colspan: 9 }
            ].forEach(function (cfg) {
                var tbody = document.getElementById(cfg.id);
                if (tbody && tbody.getAttribute('data-project-static-demo') === 'true') {
                    tbody.innerHTML = '<tr><td colspan="' + cfg.colspan + '" class="py-8 text-center text-gray-400 text-sm"><i class="ph ph-spinner-gap animate-spin mr-1"></i>加载项目中...</td></tr>';
                    tbody.removeAttribute('data-project-static-demo');
                }
            });

            ['list-view', 'p-list-view'].forEach(function (id) {
                var el = document.getElementById(id);
                if (el && el.getAttribute('data-project-static-demo') === 'true') {
                    el.style.visibility = 'visible';
                    el.removeAttribute('data-project-static-demo');
                } else if (el) {
                    el.style.visibility = 'visible';
                }
            });
        }

        function formatAmount(amount) {
            if (!amount) return '—';
            return '¥' + Number(amount).toLocaleString();
        }

        function formatDate(dateStr) {
            if (!dateStr) return '—';
            var parts = dateStr.split('-');
            if (parts.length >= 2) return parts[1] + '-' + parts[2];
            return dateStr;
        }

        function daysUntil(dateStr) {
            if (!dateStr) return null;
            var target = new Date(dateStr);
            var now = new Date();
            now.setHours(0, 0, 0, 0);
            target.setHours(0, 0, 0, 0);
            return Math.ceil((target - now) / 86400000);
        }

        // ========== API 调用 ==========
        function loadProjects() {
            return fetch('/api/projects').then(function (r) { return r.json(); }).then(function (res) {
                if (!res.success) { console.error('[Project] 加载失败:', res.error); return; }
                projectCache = res.data || [];
                projectMap = {};
                projectCache.forEach(function (p) {
                    // 兼容 description / desc 字段
                    if (!p.desc) p.desc = p.description || '';
                    if (!p.nginxConfigs) p.nginxConfigs = [];
                    projectMap[p.name] = p;
                });
                renderAll();
            }).catch(function (err) {
                console.error('[Project] 加载失败:', err);
            });
        }

        function saveProjectToAPI(data, isEdit, editId) {
            var url = '/api/projects';
            var method = 'POST';
            if (isEdit && editId) {
                url = '/api/projects/' + encodeURIComponent(editId);
                method = 'PUT';
            }
            return fetch(url, {
                method: method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            }).then(function (r) { return r.json(); });
        }

        function moveProjectToAPI(id, newStatus) {
            return fetch('/api/projects/' + encodeURIComponent(id), {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: newStatus })
            }).then(function (r) { return r.json(); });
        }

        // ========== 渲染：摘要卡片 ==========
        function renderSummary(scope) {
            var containerId = scope === 'personal' ? 'per-summary' : 'ent-summary';
            var container = document.getElementById(containerId);
            if (!container) return;

            var items = projectCache.filter(function (p) { return p.scope === scope; });
            var today = new Date().toISOString().slice(0, 10);
            var total = items.length;
            var inProgress = items.filter(function (p) { return p.status === '开发/设计中'; }).length;
            var review = items.filter(function (p) { return p.status === '待验收'; }).length;
            var completed = items.filter(function (p) { return p.status === '已完成'; }).length;
            var overdue = items.filter(function (p) {
                return p.deadline && p.deadline < today && p.status !== '已完成' && p.status !== '已关闭';
            }).length;

            var cards = [
                { label: '全部项目', value: total, sub: '', icon: 'ph-fill ph-kanban', iconBg: 'bg-blue-50 text-blue-500' },
                { label: '进行中', value: inProgress, sub: total ? '占比 ' + Math.round(inProgress / total * 100) + '%' : '', icon: 'ph-fill ph-arrows-clockwise', iconBg: 'bg-green-50 text-green-500' },
                { label: '待验收', value: review, sub: total ? '占比 ' + Math.round(review / total * 100) + '%' : '', icon: 'ph-fill ph-hourglass-high', iconBg: 'bg-orange-50 text-orange-500' },
                { label: '已完成', value: completed, sub: total ? '占比 ' + Math.round(completed / total * 100) + '%' : '', icon: 'ph-fill ph-check-circle', iconBg: 'bg-purple-50 text-purple-500' }
            ];

            var html = cards.map(function (c) {
                return '<div class="rounded-xl border border-gray-100 bg-white p-4 shadow-soft relative overflow-hidden">' +
                    '<p class="text-gray-500 text-xs">' + c.label + '</p>' +
                    '<h3 class="text-2xl font-bold text-gray-800 mt-1 mb-0.5">' + c.value + '</h3>' +
                    '<p class="text-[10px] text-gray-400">' + c.sub + '</p>' +
                    '<div class="absolute right-3 top-3 w-9 h-9 rounded-lg ' + c.iconBg + ' flex items-center justify-center">' +
                    '<i class="' + c.icon + ' text-lg"></i></div></div>';
            }).join('');

            // 逾期卡片
            html += '<div class="rounded-xl border border-red-100 bg-red-50/30 p-4 shadow-soft relative overflow-hidden">' +
                '<p class="text-red-500 text-xs">已逾期</p>' +
                '<h3 class="text-2xl font-bold text-red-600 mt-1 mb-0.5">' + overdue + '</h3>' +
                '<p class="text-[10px] text-red-400">需及时处理</p>' +
                '<div class="absolute right-3 top-3 w-9 h-9 rounded-lg bg-red-100 text-red-500 flex items-center justify-center">' +
                '<i class="ph-fill ph-warning text-lg"></i></div></div>';

            container.innerHTML = html;
        }

        // ========== 渲染：看板视图 ==========
        function renderKanban(scope) {
            var kanbanId = scope === 'personal' ? 'p-kanban-view' : 'kanban-view';
            var kanban = document.getElementById(kanbanId);
            if (!kanban) return;

            var items = projectCache.filter(function (p) { return p.scope === scope; });

            var html = KANBAN_COLUMNS.map(function (col) {
                var colItems = items.filter(function (p) { return p.status === col.key; });
                var cardsHtml = colItems.map(function (p) { return buildKanbanCard(p); }).join('');
                return '<div class="flex-shrink-0 w-72 ' + col.colClass + ' rounded-xl border border-gray-100 flex flex-col max-h-[calc(100vh-260px)]">' +
                    '<div class="p-4 border-b ' + col.headerBorder + ' flex items-center justify-between">' +
                    '<div class="flex items-center gap-2">' +
                    '<span class="w-2 h-2 rounded-full ' + col.dotClass + '"></span>' +
                    '<h3 class="font-semibold ' + (col.key === '已关闭' ? 'text-gray-500' : 'text-gray-700') + ' text-sm">' + col.key + '</h3>' +
                    '</div>' +
                    '<span class="text-xs text-gray-400 bg-white px-2 py-0.5 rounded-full border border-gray-200">' + colItems.length + '</span>' +
                    '</div>' +
                    '<div class="flex-1 overflow-y-auto p-3 space-y-3">' +
                    cardsHtml +
                    '<button class="w-full py-2.5 border border-dashed border-gray-300 text-gray-400 rounded-lg hover:text-brand-600 hover:border-brand-400 transition-colors text-xs flex items-center justify-center gap-1" onclick="window.openEditForm(null)">' +
                    '<i class="ph ph-plus"></i> 添加项目</button>' +
                    '</div></div>';
            }).join('');

            kanban.innerHTML = html;
        }

        function buildKanbanCard(p) {
            var priStyle = PRIORITY_STYLES[p.priority];
            var typeStyle = TYPE_TAG_STYLES[p.type] || TYPE_TAG_STYLES['其他'];
            var isCompleted = p.status === '已完成';
            var isClosed = p.status === '已关闭';
            var opacityClass = isCompleted ? ' opacity-90' : (isClosed ? ' opacity-70' : '');
            var titleColor = isClosed ? 'text-gray-600' : 'text-gray-800';

            // 优先级徽章
            var badgeHtml = '';
            if (isCompleted) {
                badgeHtml = '<span class="text-[10px] text-green-600 bg-green-50 border border-green-100 px-1.5 py-0.5 rounded font-medium flex items-center gap-0.5"><i class="ph ph-check"></i> 已交付</span>';
            } else if (isClosed) {
                badgeHtml = '<span class="text-[10px] text-gray-500 bg-gray-100 border border-gray-200 px-1.5 py-0.5 rounded font-medium">已关闭</span>';
            } else if (priStyle) {
                badgeHtml = '<span class="text-[10px] ' + priStyle.badge + ' border px-1.5 py-0.5 rounded font-medium">' + priStyle.label + '</span>';
            }

            // 副标题行
            var subtitle = '';
            if (p.status === '开发/设计中' || p.status === '待验收') {
                var parts = [];
                if (p.code) parts.push(p.code);
                if (p.amount) parts.push(formatAmount(p.amount));
                subtitle = parts.join(' · ');
            } else {
                subtitle = p.description || '';
            }

            // 进度条（仅开发中/待验收显示）
            var progressHtml = '';
            if ((p.status === '开发/设计中' || p.status === '待验收') && p.progress > 0) {
                var progColor = p.status === '待验收' ? 'bg-green-500' : 'bg-brand-500';
                progressHtml = '<div class="mb-3">' +
                    '<div class="flex justify-between text-[10px] text-gray-400 mb-1"><span>进度</span><span>' + p.progress + '%</span></div>' +
                    '<div class="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden"><div class="' + progColor + ' h-full rounded-full" style="width:' + p.progress + '%"></div></div>' +
                    '</div>';
            }

            // 日期/剩余天数
            var dateHtml = '';
            if (p.deadline && !isCompleted && !isClosed) {
                var days = daysUntil(p.deadline);
                if (days !== null) {
                    if (days < 0) {
                        dateHtml = '<span class="text-xs text-red-500 flex items-center gap-1"><i class="ph ph-warning"></i> 逾期' + Math.abs(days) + '天</span>';
                    } else if (days === 0) {
                        dateHtml = '<span class="text-xs text-orange-500 flex items-center gap-1"><i class="ph ph-clock"></i> 今天截止</span>';
                    } else {
                        dateHtml = '<span class="text-xs text-gray-400 flex items-center gap-1"><i class="ph ph-clock"></i> 剩余' + days + '天</span>';
                    }
                }
            } else if (isCompleted || isClosed) {
                dateHtml = '<span class="text-xs text-gray-400">' + formatDate(p.deadline || '') + '</span>';
            } else {
                dateHtml = '<span class="text-xs text-gray-400 flex items-center gap-1"><i class="ph ph-calendar"></i> ' + formatDate(p.deadline) + '</span>';
            }

            // 标签
            var tagsHtml = '<span class="tag ' + typeStyle + '">' + escapeHtml(p.type) + '</span>';
            if (p.tags) {
                var tags = p.tags.split(/[,，]/).filter(function (t) { return t.trim(); });
                for (var i = 0; i < tags.length; i++) {
                    tagsHtml += '<span class="tag bg-yellow-50 text-yellow-600 border border-yellow-100">' + escapeHtml(tags[i].trim()) + '</span>';
                }
            }

            var avatarClass = isClosed ? 'grayscale' : '';

            return '<div class="bg-white rounded-lg border border-gray-100 p-4 shadow-sm cursor-pointer hover:shadow-md transition-shadow group' + opacityClass + '">' +
                '<div class="flex items-start justify-between mb-2">' + badgeHtml +
                '<button class="text-gray-300 hover:text-gray-600 opacity-0 group-hover:opacity-100 transition-opacity"><i class="ph ph-dots-three-vertical"></i></button>' +
                '</div>' +
                '<h4 class="font-medium ' + titleColor + ' text-sm mb-1">' + escapeHtml(p.name) + '</h4>' +
                (subtitle ? '<p class="text-xs text-gray-500 mb-2 ' + (p.status === '开发/设计中' || p.status === '待验收' ? '' : 'line-clamp-2') + '">' + escapeHtml(subtitle) + '</p>' : '') +
                progressHtml +
                '<div class="flex items-center gap-2 mb-3">' + tagsHtml + '</div>' +
                '<div class="flex items-center justify-between">' +
                '<div class="flex items-center gap-1.5">' +
                '<img src="' + getAvatarUrl(p.customer) + '" class="w-6 h-6 rounded-full ' + avatarClass + '">' +
                '<span class="text-xs ' + (isClosed ? 'text-gray-400' : 'text-gray-600') + '">' + escapeHtml(p.customer) + '</span>' +
                '</div>' + dateHtml + '</div></div>';
        }

        // ========== 渲染：列表视图 ==========
        function renderList(scope) {
            var tbodyId = scope === 'personal' ? 'per-list-tbody' : 'ent-list-tbody';
            var tbody = document.getElementById(tbodyId);
            if (!tbody) return;

            var items = projectCache.filter(function (p) { return p.scope === scope; });
            if (items.length === 0) {
                tbody.innerHTML = '<tr><td colspan="9" class="py-8 text-center text-gray-400 text-sm">暂无项目数据</td></tr>';
                return;
            }

            tbody.innerHTML = items.map(function (p) { return buildListRow(p, scope); }).join('');
        }

        function buildListRow(p, scope) {
            var dotClass = STATUS_DOT_STYLES[p.status] || 'bg-gray-400';
            var statusBadge = STATUS_BADGE_STYLES[p.status] || STATUS_BADGE_STYLES['待确认需求'];
            var priStyle = PRIORITY_STYLES[p.priority];
            var typeStyle = TYPE_TAG_STYLES[p.type] || TYPE_TAG_STYLES['其他'];
            var progBarClass = PROGRESS_BAR_STYLES[p.status] || 'bg-gray-300';

            // 优先级
            var priHtml = '';
            if (p.priority === '高') priHtml = '<span class="text-[10px] text-red-600 bg-red-50 border border-red-100 px-1.5 py-0.5 rounded font-medium">高</span>';
            else if (p.priority === '中') priHtml = '<span class="text-[10px] text-yellow-600 bg-yellow-50 border border-yellow-100 px-1.5 py-0.5 rounded font-medium">中</span>';
            else if (p.priority === '低') priHtml = '<span class="text-[10px] text-gray-500 bg-gray-50 border border-gray-200 px-1.5 py-0.5 rounded font-medium">低</span>';
            else priHtml = '<span class="text-[10px] text-gray-400">—</span>';

            var scopeLabel = scope === 'personal' ? '个人' : escapeHtml(p.customer || '—');

            return '<tr class="border-b border-gray-50 hover:bg-gray-50/80 transition-colors cursor-pointer">' +
                '<td class="py-3 px-4"><div class="flex items-center gap-2"><span class="w-2 h-2 rounded-full ' + dotClass + ' flex-shrink-0"></span>' +
                '<span class="font-medium text-gray-800 truncate">' + escapeHtml(p.name) + '</span></div>' +
                (p.code ? '<p class="text-xs text-gray-400 mt-0.5 truncate">' + escapeHtml(p.code) + '</p>' : '') +
                '</td>' +
                '<td class="py-3 px-2"><span class="text-xs ' + statusBadge + ' border px-1.5 py-0.5 rounded">' + p.status + '</span></td>' +
                '<td class="py-3 px-2">' + priHtml + '</td>' +
                '<td class="py-3 px-2"><span class="tag ' + typeStyle + '">' + escapeHtml(p.type) + '</span></td>' +
                '<td class="py-3 px-2"><span class="text-xs text-gray-500">' + scopeLabel + '</span></td>' +
                '<td class="py-3 px-2 text-xs text-gray-500">' + (p.amount ? formatAmount(p.amount) : '—') + '</td>' +
                '<td class="py-3 px-2"><div class="flex items-center gap-2"><div class="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden max-w-[80px]"><div class="' + progBarClass + ' h-full rounded-full" style="width:' + (p.progress || 0) + '%"></div></div><span class="text-[10px] text-gray-400">' + (p.progress || 0) + '%</span></div></td>' +
                '<td class="py-3 px-2 text-xs text-gray-500">' + formatDate(p.deadline) + '</td>' +
                '<td class="py-3 px-2 text-center"><button class="w-7 h-7 rounded border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-100 hover:text-gray-800 transition mx-auto"><i class="ph ph-dots-three"></i></button></td>' +
                '</tr>';
        }

        // ========== 渲染全部 ==========
        function renderAll() {
            renderSummary('enterprise');
            renderSummary('personal');
            renderKanban('enterprise');
            renderKanban('personal');
            renderList('enterprise');
            renderList('personal');
            // 重新绑定右键菜单（因为 DOM 已重建）
            bindContextMenu();
        }

        // ========== Toast ==========
        var toastTimer = null;
        function showToast(msg, icon, iconColor) {
            var existing = document.getElementById('proj-toast');
            if (existing) existing.remove();
            if (toastTimer) clearTimeout(toastTimer);

            var toast = document.createElement('div');
            toast.id = 'proj-toast';
            toast.style.cssText = 'position:fixed;bottom:2.5rem;left:50%;transform:translateX(-50%) translateY(2.5rem);background:#1e293b;color:#fff;padding:0.5rem 1rem;border-radius:0.5rem;box-shadow:0 10px 15px -3px rgba(0,0,0,0.1);display:flex;align-items:center;gap:0.5rem;font-size:0.875rem;opacity:0;transition:all 0.3s ease;pointer-events:none;z-index:90;';
            toast.innerHTML = '<i class="' + (icon || 'ph-fill ph-check-circle') + '" style="color:' + (iconColor || '#4ade80') + '"></i><span>' + msg + '</span>';
            document.body.appendChild(toast);

            requestAnimationFrame(function () {
                toast.style.opacity = '1';
                toast.style.transform = 'translateX(-50%) translateY(0)';
            });

            toastTimer = setTimeout(function () {
                toast.style.opacity = '0';
                toast.style.transform = 'translateX(-50%) translateY(2.5rem)';
                setTimeout(function () { toast.remove(); }, 300);
            }, 2500);
        }

        // ========== 复制到剪贴板 ==========
        function copyToClipboard(text) {
            if (!text) return false;
            if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(text).then(function () {}, function () {
                    fallbackCopy(text);
                });
            } else {
                fallbackCopy(text);
            }
            return true;
        }
        function fallbackCopy(text) {
            var ta = document.createElement('textarea');
            ta.value = text;
            ta.style.cssText = 'position:fixed;opacity:0;pointer-events:none;';
            document.body.appendChild(ta);
            ta.select();
            try { document.execCommand('copy'); } catch (e) {}
            ta.remove();
        }

        // ========== 获取项目名称 ==========
        function getProjectNameFromCard(card) {
            var h4 = card.querySelector('h4');
            if (h4) return h4.textContent.trim();
            return '';
        }
        function getProjectNameFromRow(row) {
            var span = row.querySelector('td span.font-medium');
            if (span) return span.textContent.trim();
            return '';
        }
        function getProjectData(name) {
            if (name && projectMap[name]) {
                var d = projectMap[name];
                if (!d.nginxConfigs) d.nginxConfigs = [];
                if (!d.desc) d.desc = d.description || '';
                return d;
            }
            // 返回默认空数据（新建项目）
            return { id: '', code: '', status: '待确认需求', priority: '中', type: '网站开发', scope: 'enterprise', deadline: '', amount: '', progress: 0, desc: '', description: '', customer: '', tags: '', notes: '', localPath: '', cloudEnabled: false, cloudPath: '', cloudType: 'baidu', serverEnabled: false, serverAddr: '', serverSpec: '', nginxConfigs: [] };
        }

        // ========== 右键上下文菜单 ==========
        var ctxMenu = null;

        function hideContextMenu() {
            if (ctxMenu) {
                ctxMenu.remove();
                ctxMenu = null;
            }
        }

        // 所有状态列表（顺序即看板列顺序）
        var ALL_STATUSES = ['待确认需求', '开发/设计中', '待验收', '已完成', '已关闭'];
        var STATUS_COLORS = {
            '待确认需求': 'gray',
            '开发/设计中': 'green',
            '待验收': 'orange',
            '已完成': 'purple',
            '已关闭': 'gray'
        };

        function showContextMenu(x, y, projectName) {
            hideContextMenu();
            var data = getProjectData(projectName);
            var hasLocal = !!data.localPath;
            var hasCloud = data.cloudEnabled && !!data.cloudPath;
            var currentStatus = data.status || '待确认需求';

            // 构建「移动至」子项（排除当前状态）
            var moveItems = [];
            for (var i = 0; i < ALL_STATUSES.length; i++) {
                var st = ALL_STATUSES[i];
                if (st === currentStatus) continue;
                moveItems.push('<div class="proj-ctx-item" data-action="move" data-status="' + st + '"><span class="w-1.5 h-1.5 rounded-full bg-' + STATUS_COLORS[st] + '-400"></span> 移动至 ' + st + '</div>');
            }

            ctxMenu = document.createElement('div');
            ctxMenu.className = 'proj-ctx-menu';
            ctxMenu.innerHTML = [
'<div class="proj-ctx-header"><i class="ph ph-folder-simple-user"></i> ' + projectName + '</div>',
'<div class="proj-ctx-item" data-action="view-detail"><i class="ph ph-eye text-brand-600"></i> 查看详情</div>',
'<div class="proj-ctx-item" data-action="edit"><i class="ph ph-pencil-simple text-gray-500"></i> 编辑项目</div>',
                '<div class="proj-ctx-sep"></div>',
                '<div class="proj-ctx-item' + (hasLocal ? '' : ' disabled') + '" data-action="copy-local"><i class="ph ph-hard-drive text-gray-500"></i> 复制本地地址</div>',
                '<div class="proj-ctx-item' + (hasCloud ? '' : ' disabled') + '" data-action="copy-cloud"><i class="ph ph-cloud text-sky-500"></i> 复制云端地址</div>',
                '<div class="proj-ctx-item' + ((hasLocal || hasCloud) ? '' : ' disabled') + '" data-action="copy-all"><i class="ph ph-copy text-gray-500"></i> 复制项目地址</div>',
                '<div class="proj-ctx-sep"></div>',
                '<div class="proj-ctx-item' + (hasLocal ? '' : ' disabled') + '" data-action="open-folder"><i class="ph ph-folder-open text-gray-500"></i> 在文件夹中打开</div>',
                '<div class="proj-ctx-item' + (hasCloud ? '' : ' disabled') + '" data-action="open-cloud"><i class="ph ph-arrow-square-out text-gray-500"></i> 打开云端链接</div>',
                '<div class="proj-ctx-sep"></div>',
                '<div class="proj-ctx-item proj-ctx-sub-wrap"><i class="ph ph-arrows-left-right text-gray-500"></i> 更多操作 <i class="ph ph-caret-right proj-ctx-sub-arrow"></i>',
                '  <div class="proj-ctx-submenu">',
                '    <div class="proj-ctx-label"><i class="ph ph-swap text-gray-400"></i> 移动状态</div>',
                moveItems.join(''),
                '  </div>',
                '</div>'
            ].join('');
            document.body.appendChild(ctxMenu);

            // 先测量尺寸并定位，再触发显示动画（避免位置变化被过渡）
            // 注意：不能用 inline opacity:0，否则会覆盖 .show 类的 opacity:1
            ctxMenu.style.left = '0px';
            ctxMenu.style.top = '0px';
            ctxMenu.style.visibility = 'hidden';
            var rect = ctxMenu.getBoundingClientRect();
            var finalX = Math.min(x, window.innerWidth - rect.width - 8);
            var finalY = Math.min(y, window.innerHeight - rect.height - 8);
            ctxMenu.style.left = finalX + 'px';
            ctxMenu.style.top = finalY + 'px';
            ctxMenu.style.visibility = '';

            // 检测右侧空间是否足够放二级菜单（约 190px），不够则翻转到左侧
            if (finalX + rect.width + 190 > window.innerWidth) {
                ctxMenu.classList.add('flip-left');
            }

            // 检测底部空间：二级菜单从「更多操作」项位置开始向下展开，
            // 如果会超出视口底部，则让二级菜单向上展开（bottom 对齐父项）
            var moreItem = ctxMenu.querySelector('.proj-ctx-sub-wrap');
            var submenu = ctxMenu.querySelector('.proj-ctx-submenu');
            if (moreItem && submenu) {
                var moreRect = moreItem.getBoundingClientRect();
                var subHeight = 230; // 二级菜单预估高度
                if (moreRect.top + subHeight > window.innerHeight - 8) {
                    submenu.classList.add('flip-up');
                    submenu.style.top = 'auto';
                    submenu.style.bottom = '-0.3rem';
                }
            }

            requestAnimationFrame(function () {
                ctxMenu.classList.add('show');
            });

            // 绑定菜单项点击（排除二级菜单的父项，避免点击父项就关闭）
            var items = ctxMenu.querySelectorAll('.proj-ctx-item');
            for (var i = 0; i < items.length; i++) {
                (function (item) {
                    // 跳过「更多操作」父项本身（它是二级菜单的触发器，不应关闭主菜单）
                    if (item.classList.contains('proj-ctx-sub-wrap')) return;
                    item.addEventListener('click', function (e) {
                        e.stopPropagation();
                        if (item.classList.contains('disabled')) return;
                        var action = item.dataset.action;
                        handleCtxAction(action, projectName, data, item);
                        hideContextMenu();
                    });
                })(items[i]);
            }
        }

        function handleCtxAction(action, projectName, data, item) {
            switch (action) {
case 'view-detail':
showProjectDetail(projectName);
break;
case 'edit':
openEditForm(projectName);
break;
                case 'copy-local':
                    if (data.localPath) {
                        copyToClipboard(data.localPath);
                        showToast('本地地址已复制到剪贴板', 'ph-fill ph-check-circle', '#4ade80');
                    }
                    break;
                case 'copy-cloud':
                    if (data.cloudPath) {
                        copyToClipboard(data.cloudPath);
                        showToast('云端地址已复制到剪贴板', 'ph-fill ph-check-circle', '#4ade80');
                    }
                    break;
                case 'copy-all':
                    var addr = '';
                    if (data.localPath) addr += '本地：' + data.localPath;
                    if (data.cloudEnabled && data.cloudPath) {
                        if (addr) addr += '\n';
                        addr += '云端：' + data.cloudPath;
                    }
                    if (addr) {
                        copyToClipboard(addr);
                        showToast('项目地址已复制到剪贴板', 'ph-fill ph-check-circle', '#4ade80');
                    }
                    break;
                case 'open-folder':
                    showToast('正在打开文件夹：' + data.localPath, 'ph ph-folder-open', '#60a5fa');
                    break;
                case 'open-cloud':
                    if (data.cloudPath) {
                        window.open(data.cloudPath, '_blank');
                    }
                    break;
                case 'move':
                    var newStatus = item ? item.dataset.status : '';
                    if (newStatus) {
                        moveProjectStatus(projectName, newStatus);
                    }
                    break;
            }
        }

        // ========== 移动项目状态（看板卡片迁移 + 列表行更新 + 数据同步） ==========
        // 状态对应的看板列配置
        var STATUS_COLUMN_MAP = {
            '待确认需求': { kanban: 'kanban-view', pKanban: 'p-kanban-view', colClass: 'bg-gray-50', dotClass: 'bg-gray-400', headerClass: 'border-gray-100' },
            '开发/设计中': { kanban: 'kanban-view', pKanban: 'p-kanban-view', colClass: 'bg-green-50/30', dotClass: 'bg-green-500', headerClass: 'border-green-100/50' },
            '待验收': { kanban: 'kanban-view', pKanban: 'p-kanban-view', colClass: 'bg-orange-50/30', dotClass: 'bg-orange-500', headerClass: 'border-orange-100/50' },
            '已完成': { kanban: 'kanban-view', pKanban: 'p-kanban-view', colClass: 'bg-purple-50/30', dotClass: 'bg-purple-500', headerClass: 'border-purple-100/50' },
            '已关闭': { kanban: 'kanban-view', pKanban: 'p-kanban-view', colClass: 'bg-gray-50', dotClass: 'bg-gray-400', headerClass: 'border-gray-100' }
        };

        function moveProjectStatus(projectName, newStatus) {
            if (!projectName || !newStatus) return;
            var data = getProjectData(projectName);
            var oldStatus = data.status || '待确认需求';
            if (oldStatus === newStatus) return;

            // 1. 乐观更新本地数据
            data.status = newStatus;
            if (projectMap[projectName]) projectMap[projectName].status = newStatus;

            // 2. 重新渲染看板和列表
            renderAll();

            // 3. 同步到后端 API
            if (data.id) {
                moveProjectToAPI(data.id, newStatus).then(function (res) {
                    if (!res.success) {
                        console.error('[Project] 移动状态失败:', res.error);
                        showToast('移动状态失败，正在恢复...', 'ph ph-warning', '#fbbf24');
                        data.status = oldStatus;
                        if (projectMap[projectName]) projectMap[projectName].status = oldStatus;
                        renderAll();
                    }
                }).catch(function (err) {
                    console.error('[Project] 移动状态失败:', err);
                });
            }

            showToast('已移动至「' + newStatus + '」', 'ph-fill ph-arrows-left-right', '#60a5fa');
        }

        // 找到看板中指定项目名称的卡片，迁移到目标列
        function updateKanbanCardStatus(projectName, oldStatus, newStatus) {
            var kanbanIds = ['kanban-view', 'p-kanban-view'];
            for (var k = 0; k < kanbanIds.length; k++) {
                var kanban = document.getElementById(kanbanIds[k]);
                if (!kanban) continue;

                // 找到卡片
                var cards = kanban.querySelectorAll('div.group');
                var targetCard = null;
                for (var i = 0; i < cards.length; i++) {
                    var h4 = cards[i].querySelector('h4');
                    if (h4 && h4.textContent.trim() === projectName) {
                        targetCard = cards[i];
                        break;
                    }
                }
                if (!targetCard) continue;

                // 找到目标列（通过列标题文本匹配）
                var columns = kanban.querySelectorAll(':scope > div');
                var targetCol = null;
                for (var j = 0; j < columns.length; j++) {
                    var h3 = columns[j].querySelector('h3');
                    if (h3 && h3.textContent.trim() === newStatus) {
                        targetCol = columns[j];
                        break;
                    }
                }
                if (!targetCol) continue;

                // 找到目标列中的"添加项目"按钮（卡片插入在按钮之前）
                var addBtn = targetCol.querySelector('button.border-dashed');
                var cardContainer = addBtn ? addBtn.parentElement : targetCol.querySelector('.flex-1');
                if (cardContainer) {
                    // 淡出动画
                    targetCard.style.transition = 'opacity 0.2s ease, transform 0.2s ease';
                    targetCard.style.opacity = '0';
                    targetCard.style.transform = 'scale(0.9)';

                    setTimeout(function (card, container) {
                        container.insertBefore(card, container.firstChild);
                        // 更新卡片内的优先级标签（已关闭状态特殊处理）
                        card.style.opacity = '';
                        card.style.transform = '';
                    }, 200, targetCard, cardContainer);
                }

                // 更新目标列计数
                updateColumnCount(targetCol);
                // 更新原列计数
                var oldCol = null;
                for (var m = 0; m < columns.length; m++) {
                    var h3old = columns[m].querySelector('h3');
                    if (h3old && h3old.textContent.trim() === oldStatus) {
                        oldCol = columns[m];
                        break;
                    }
                }
                if (oldCol) updateColumnCount(oldCol);
            }
        }

        function updateColumnCount(col) {
            var countBadge = col.querySelector('.p-4 span.text-xs.text-gray-400');
            if (!countBadge) return;
            var cards = col.querySelectorAll('div.group');
            countBadge.textContent = cards.length;
        }

        // 更新列表行中的状态标签
        function updateListRowStatus(projectName, newStatus) {
            var listIds = ['list-view', 'p-list-view'];
            var statusStyles = {
                '待确认需求': 'text-xs text-gray-600 bg-gray-50 border border-gray-200 px-1.5 py-0.5 rounded',
                '开发/设计中': 'text-xs text-green-600 bg-green-50 border border-green-100 px-1.5 py-0.5 rounded',
                '待验收': 'text-xs text-orange-600 bg-orange-50 border border-orange-100 px-1.5 py-0.5 rounded',
                '已完成': 'text-xs text-purple-600 bg-purple-50 border border-purple-100 px-1.5 py-0.5 rounded',
                '已关闭': 'text-xs text-gray-500 bg-gray-100 border border-gray-200 px-1.5 py-0.5 rounded'
            };
            var dotStyles = {
                '待确认需求': 'bg-gray-400',
                '开发/设计中': 'bg-green-500',
                '待验收': 'bg-orange-500',
                '已完成': 'bg-purple-500',
                '已关闭': 'bg-gray-400'
            };
            var opacityMap = { '已完成': '0.9', '已关闭': '0.7' };

            for (var i = 0; i < listIds.length; i++) {
                var list = document.getElementById(listIds[i]);
                if (!list) continue;
                var rows = list.querySelectorAll('tbody tr');
                for (var j = 0; j < rows.length; j++) {
                    var span = rows[j].querySelector('td span.font-medium');
                    if (span && span.textContent.trim() === projectName) {
                        // 更新状态标签（第2列）
                        var tds = rows[j].querySelectorAll('td');
                        if (tds[1]) {
                            var statusSpan = tds[1].querySelector('span');
                            if (statusSpan) {
                                statusSpan.className = statusStyles[newStatus] || statusStyles['待确认需求'];
                                statusSpan.textContent = newStatus;
                            }
                        }
                        // 更新状态圆点（第1列）
                        if (tds[0]) {
                            var dot = tds[0].querySelector('span.rounded-full');
                            if (dot) dot.className = 'w-2 h-2 rounded-full ' + (dotStyles[newStatus] || 'bg-gray-400') + ' flex-shrink-0';
                        }
                        // 更新行透明度
                        rows[j].style.opacity = opacityMap[newStatus] || '1';
                        break;
                    }
                }
            }
        }

        // ========== 编辑表单模态框 ==========
        function computeRootUrl() {
            var base = window.PAGE_BASE || '';
            var url = window.location.href.split('#')[0].split('?')[0];
            url = url.substring(0, url.lastIndexOf('/'));
            if (base) {
                var ups = (base.match(/\.\.\//g) || []).length;
                for (var i = 0; i < ups; i++) {
                    url = url.substring(0, url.lastIndexOf('/'));
                }
            }
            return url + '/';
        }

        function openEditForm(projectName) {
            // 移除已有模态框
            var existing = document.getElementById('pf-modal');
            if (existing) existing.remove();

            var isNew = !projectName; // projectName 为空表示新建
            var data = getProjectData(projectName);
            var rootUrl = computeRootUrl();
            var formUrl = rootUrl + 'pages/content/project-form.html';

            fetch(formUrl)
                .then(function (resp) { return resp.text(); })
                .then(function (html) {
                    var parser = new DOMParser();
                    var doc = parser.parseFromString(html, 'text/html');
                    var panel = doc.getElementById('project-form-panel');
                    if (!panel) { buildFormFallback(projectName, data); return; }

                    var panelHTML = panel.outerHTML;

                    var modal = document.createElement('div');
                    modal.id = 'pf-modal';
                    modal.className = 'pf-modal-overlay';
                    modal.innerHTML = '<div class="absolute inset-0"></div>' + panelHTML;

                    var panelEl = modal.querySelector('#project-form-panel');
                    if (panelEl) {
                        panelEl.classList.add('z-10', 'pf-modal-panel');
                    }

                    document.body.appendChild(modal);
                    document.body.style.overflow = 'hidden';

                    // 触发淡入 + 滑入动画
                    requestAnimationFrame(function () {
                        modal.classList.add('show');
                    });

                    // 填充表单数据
                    fillFormData(modal, projectName, data);

                    // 绑定事件
                    bindFormEvents(modal, projectName);
                })
                .catch(function () {
                    buildFormFallback(projectName, data);
                });
        }

        // ========== Nginx 配置动态增删辅助函数 ==========
        function addNginxEntryToModal(modal, name, config) {
            var nginxList = modal.querySelector('#pf-nginx-list');
            if (!nginxList) return;
            var wrapper = document.createElement('div');
            wrapper.className = 'pf-nginx-item rounded-lg border border-gray-200 overflow-hidden';
            var header = document.createElement('div');
            header.className = 'flex items-center gap-2 px-3 py-2 bg-gray-50 border-b border-gray-100';
            var nameInput = document.createElement('input');
            nameInput.type = 'text';
            nameInput.className = 'pf-nginx-name pf-form-input text-xs py-1 flex-1';
            nameInput.placeholder = '配置名称（如：前端服务）';
            nameInput.value = name || '';
            var delBtn = document.createElement('button');
            delBtn.type = 'button';
            delBtn.className = 'pf-nginx-del w-7 h-7 rounded text-gray-400 hover:text-red-500 hover:bg-red-50 transition flex items-center justify-center shrink-0';
            delBtn.title = '删除';
            delBtn.innerHTML = '<i class="ph ph-trash text-sm"></i>';
            header.appendChild(nameInput);
            header.appendChild(delBtn);
            var configArea = document.createElement('textarea');
            configArea.className = 'pf-nginx-config pf-form-input rounded-none border-0';
            configArea.rows = 4;
            configArea.placeholder = '粘贴 Nginx 配置内容...';
            configArea.style.cssText = 'resize:vertical;font-family:monospace;font-size:0.8rem;';
            configArea.value = config || '';
            wrapper.appendChild(header);
            wrapper.appendChild(configArea);
            bindNginxDelete(wrapper);
            nginxList.appendChild(wrapper);
        }

        function bindNginxDelete(item) {
            var delBtn = item.querySelector('.pf-nginx-del');
            if (delBtn) {
                delBtn.addEventListener('click', function () {
                    item.remove();
                });
            }
        }

        function collectNginxConfigs(modal) {
            var items = modal.querySelectorAll('.pf-nginx-item');
            var result = [];
            for (var i = 0; i < items.length; i++) {
                var nameEl = items[i].querySelector('.pf-nginx-name');
                var configEl = items[i].querySelector('.pf-nginx-config');
                var name = nameEl ? nameEl.value.trim() : '';
                var config = configEl ? configEl.value : '';
                // 跳过完全空的项
                if (!name && !config.trim()) continue;
                result.push({ name: name, config: config });
            }
            return result;
        }

        function fillFormData(modal, projectName, data) {
            function setVal(id, val) { var el = modal.querySelector('#' + id); if (el) el.value = val; }
            function setSelect(id, val) {
                var sel = modal.querySelector('#' + id);
                if (!sel) return;
                for (var i = 0; i < sel.options.length; i++) {
                    if (sel.options[i].value === val) { sel.selectedIndex = i; return; }
                }
            }

            // 标题
            var title = modal.querySelector('#pf-title');
            var subtitle = modal.querySelector('#pf-subtitle');
            var isNew = !projectName;
            if (title) title.textContent = isNew ? '新建项目' : '编辑项目';
            if (subtitle) subtitle.textContent = isNew ? '填写项目信息与存放地址' : projectName;

            setVal('pf-name', isNew ? '' : projectName);
            setVal('pf-code', data.code);
            setSelect('pf-status', data.status);
            setSelect('pf-priority', data.priority || '中');
            setSelect('pf-type', data.type);
            setSelect('pf-scope', data.scope);
            setVal('pf-deadline', data.deadline);
            setVal('pf-amount', data.amount);
            setVal('pf-progress', data.progress);
            setVal('pf-desc', data.desc);
            setVal('pf-local-path', data.localPath);
            setVal('pf-cloud-path', data.cloudPath);
            setSelect('pf-cloud-type', data.cloudType);
            setVal('pf-customer', data.customer);
            setVal('pf-tags', data.tags);
            setVal('pf-notes', data.notes);

            // 进度显示
            var progVal = modal.querySelector('#pf-progress-val');
            if (progVal) progVal.textContent = data.progress + '%';

            // 云端开关
            var cloudToggle = modal.querySelector('#pf-cloud-enabled');
            var cloudSection = modal.querySelector('#pf-cloud-section');
            if (cloudToggle) cloudToggle.checked = data.cloudEnabled;
            if (cloudSection) {
                if (data.cloudEnabled) cloudSection.classList.remove('hidden');
                else cloudSection.classList.add('hidden');
            }

            // 服务器配置
            var serverToggle = modal.querySelector('#pf-server-enabled');
            var serverSection = modal.querySelector('#pf-server-section');
            if (serverToggle) serverToggle.checked = !!data.serverEnabled;
            if (serverSection) {
                if (data.serverEnabled) serverSection.classList.remove('hidden');
                else serverSection.classList.add('hidden');
            }
            setVal('pf-server-addr', data.serverAddr || '');
            setVal('pf-server-spec', data.serverSpec || '');

            // Nginx 配置列表
            var nginxList = modal.querySelector('#pf-nginx-list');
            if (nginxList) {
                nginxList.innerHTML = '';
                var configs = data.nginxConfigs || [];
                if (configs.length === 0) configs = [{ name: '', config: '' }];
                for (var i = 0; i < configs.length; i++) {
                    addNginxEntryToModal(modal, configs[i].name || '', configs[i].config || '');
                }
            }
        }

        function bindFormEvents(modal, projectName) {
            function closeModal() {
                modal.classList.remove('show');
                setTimeout(function () {
                    modal.remove();
                    document.body.style.overflow = '';
                }, 300);
            }

            // 关闭/取消
            var closeBtn = modal.querySelector('#pf-close');
            var cancelBtn = modal.querySelector('#pf-cancel');
            if (closeBtn) closeBtn.addEventListener('click', closeModal);
            if (cancelBtn) cancelBtn.addEventListener('click', closeModal);

            // 点击遮罩关闭
            modal.addEventListener('click', function (e) {
                if (!e.target.closest('#project-form-panel')) closeModal();
            });

            // ESC 关闭
            document.addEventListener('keydown', function esc(e) {
                if (e.key === 'Escape' && document.getElementById('pf-modal')) {
                    document.removeEventListener('keydown', esc);
                    closeModal();
                }
            });

            // 进度滑块
            var progInput = modal.querySelector('#pf-progress');
            var progVal = modal.querySelector('#pf-progress-val');
            if (progInput && progVal) {
                progInput.addEventListener('input', function () {
                    progVal.textContent = this.value + '%';
                });
            }

            // 云端开关联动
            var cloudToggle = modal.querySelector('#pf-cloud-enabled');
            var cloudSection = modal.querySelector('#pf-cloud-section');
            if (cloudToggle && cloudSection) {
                cloudToggle.addEventListener('change', function () {
                    if (this.checked) cloudSection.classList.remove('hidden');
                    else cloudSection.classList.add('hidden');
                });
            }

            // 服务器开关联动
            var serverToggle = modal.querySelector('#pf-server-enabled');
            var serverSection = modal.querySelector('#pf-server-section');
            if (serverToggle && serverSection) {
                serverToggle.addEventListener('change', function () {
                    if (this.checked) serverSection.classList.remove('hidden');
                    else serverSection.classList.add('hidden');
                });
            }

            // Nginx 配置动态增删
            var nginxList = modal.querySelector('#pf-nginx-list');
            var nginxAddBtn = modal.querySelector('#pf-nginx-add');
            if (nginxAddBtn) {
                nginxAddBtn.addEventListener('click', function () {
                    addNginxEntryToModal(modal, '', '');
                });
            }
            // 绑定已有项的删除按钮
            var nginxItems = modal.querySelectorAll('.pf-nginx-item');
            for (var ni = 0; ni < nginxItems.length; ni++) {
                bindNginxDelete(nginxItems[ni]);
            }

            // 浏览文件夹
            var browseBtn = modal.querySelector('#pf-browse');
            var localPathInput = modal.querySelector('#pf-local-path');
            var localPathHint = modal.querySelector('#pf-local-path-hint');
            if (browseBtn && localPathInput) {
                browseBtn.addEventListener('click', function () {
                    if (localPathHint) localPathHint.classList.remove('hidden');
                    if (!localPathInput.value) {
                        localPathInput.value = 'D:\\Projects\\' + (projectName || '新项目');
                    }
                    showToast('请输入或粘贴本地文件夹路径', 'ph ph-info', '#60a5fa');
                });
            }

            // 复制云端地址
            var cloudCopyBtn = modal.querySelector('#pf-cloud-copy');
            var cloudPathInput = modal.querySelector('#pf-cloud-path');
            if (cloudCopyBtn && cloudPathInput) {
                cloudCopyBtn.addEventListener('click', function () {
                    var val = cloudPathInput.value.trim();
                    if (val) {
                        copyToClipboard(val);
                        showToast('云端地址已复制', 'ph-fill ph-check-circle', '#4ade80');
                    } else {
                        showToast('请先填写云端地址', 'ph ph-warning', '#fbbf24');
                    }
                });
            }

            // 保存
            var saveBtn = modal.querySelector('#pf-save');
            if (saveBtn) {
                saveBtn.addEventListener('click', function () {
                    var nameEl = modal.querySelector('#pf-name');
                    var name = nameEl ? nameEl.value.trim() : '';
                    if (!name) { showToast('请输入项目名称', 'ph ph-warning', '#fbbf24'); return; }

                    // 收集表单数据
                    var updated = {
                        name: name,
                        code: (modal.querySelector('#pf-code') || {}).value || '',
                        status: (modal.querySelector('#pf-status') || {}).value || '',
                        priority: (modal.querySelector('#pf-priority') || {}).value || '',
                        type: (modal.querySelector('#pf-type') || {}).value || '',
                        scope: (modal.querySelector('#pf-scope') || {}).value || '',
                        deadline: (modal.querySelector('#pf-deadline') || {}).value || '',
                        amount: (modal.querySelector('#pf-amount') || {}).value || '',
                        progress: parseInt((modal.querySelector('#pf-progress') || {}).value) || 0,
                        desc: (modal.querySelector('#pf-desc') || {}).value || '',
                        customer: (modal.querySelector('#pf-customer') || {}).value || '',
                        tags: (modal.querySelector('#pf-tags') || {}).value || '',
                        notes: (modal.querySelector('#pf-notes') || {}).value || '',
                        localPath: (modal.querySelector('#pf-local-path') || {}).value || '',
                        cloudEnabled: (modal.querySelector('#pf-cloud-enabled') || {}).checked || false,
                        cloudPath: (modal.querySelector('#pf-cloud-path') || {}).value || '',
                        cloudType: (modal.querySelector('#pf-cloud-type') || {}).value || 'baidu',
                        serverEnabled: (modal.querySelector('#pf-server-enabled') || {}).checked || false,
                        serverAddr: (modal.querySelector('#pf-server-addr') || {}).value || '',
                        serverSpec: (modal.querySelector('#pf-server-spec') || {}).value || '',
                        nginxConfigs: collectNginxConfigs(modal)
                    };

                    var isEdit = !!projectName && !!data.id;
                    var editId = data.id;

                    showToast('正在保存...', 'ph ph-spinner', '#60a5fa');
                    saveBtn.disabled = true;

                    saveProjectToAPI(updated, isEdit, editId).then(function (res) {
                        saveBtn.disabled = false;
                        if (!res.success) {
                            showToast('保存失败：' + (res.error || ''), 'ph ph-warning', '#fbbf24');
                            return;
                        }
                        showToast('项目信息已保存', 'ph-fill ph-check-circle', '#4ade80');
                        closeModal();

                        // 重新从 API 加载数据并渲染
                        loadProjects().then(function () {
                            // 如果详情面板打开，刷新内容
                            if (currentDetailProject !== null) {
                                var newName = (name !== projectName) ? name : projectName;
                                currentDetailProject = newName;
                                showProjectDetail(newName);
                            }
                        });
                    }).catch(function (err) {
                        saveBtn.disabled = false;
                        console.error('[Project] 保存失败:', err);
                        showToast('保存失败，请检查网络', 'ph ph-warning', '#fbbf24');
                    });
                });
            }
        }

        // fetch 失败时的内联表单（降级方案）
        function buildFormFallback(projectName, data) {
            var isNew = !projectName;
            var titleText = isNew ? '新建项目' : '编辑项目';
            var subtitleText = isNew ? '填写项目信息与存放地址' : projectName;
            var modal = document.createElement('div');
            modal.id = 'pf-modal';
            modal.className = 'pf-modal-overlay';
            modal.innerHTML = [
                '<div class="absolute inset-0 bg-black/20"></div>',
                '<div class="relative pf-modal-panel z-10">',
                '  <div class="flex justify-between items-center px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white shrink-0">',
                '    <div class="flex items-center gap-3">',
                '      <div class="w-10 h-10 rounded-lg bg-brand-50 text-brand-600 flex items-center justify-center"><i class="ph-fill ph-folder-open text-xl"></i></div>',
                '      <div><h3 class="font-semibold text-gray-800 text-base">' + titleText + '</h3><p class="text-xs text-gray-400 mt-0.5">' + subtitleText + '</p></div>',
                '    </div>',
                '    <button id="pf-close" class="w-8 h-8 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition flex items-center justify-center"><i class="ph ph-x text-lg"></i></button>',
                '  </div>',
                '  <div class="px-6 py-5 space-y-5 flex-1 overflow-y-auto">',
                '    <div><label class="pf-form-label">本地存放地址</label><input type="text" id="pf-local-path" class="pf-form-input" value="' + (data.localPath || '') + '" placeholder="如：D:\\Projects\\项目名"></div>',
                '    <div class="flex items-center gap-3 p-3 rounded-lg border border-gray-100 bg-gray-50/50">',
                '      <span class="text-sm font-medium text-gray-700">云端备份存放</span>',
                '      <label class="pf-toggle-switch"><input type="checkbox" id="pf-cloud-enabled"' + (data.cloudEnabled ? ' checked' : '') + '><span class="pf-toggle-slider"></span></label>',
                '    </div>',
                '    <div id="pf-cloud-section"' + (data.cloudEnabled ? '' : ' class="hidden"') + '>',
                '      <label class="pf-form-label">云端存放地址</label>',
                '      <input type="text" id="pf-cloud-path" class="pf-form-input" value="' + (data.cloudPath || '') + '" placeholder="云端链接地址">',
                '    </div>',
                '    <div class="flex items-center gap-3 p-3 rounded-lg border border-gray-100 bg-gray-50/50">',
                '      <span class="text-sm font-medium text-gray-700">已购买服务器</span>',
                '      <label class="pf-toggle-switch"><input type="checkbox" id="pf-server-enabled"' + (data.serverEnabled ? ' checked' : '') + '><span class="pf-toggle-slider"></span></label>',
                '    </div>',
                '    <div id="pf-server-section"' + (data.serverEnabled ? '' : ' class="hidden"') + '>',
                '      <div class="mb-3"><label class="pf-form-label">服务器地址</label><input type="text" id="pf-server-addr" class="pf-form-input" value="' + (data.serverAddr || '') + '" placeholder="如：192.168.1.100"></div>',
                '      <div class="mb-3"><label class="pf-form-label">服务器配置（账号密码等）</label><textarea id="pf-server-spec" rows="3" class="pf-form-input" placeholder="记录服务器账号、密码等..." style="resize:vertical;">' + (data.serverSpec || '') + '</textarea></div>',
                '      <div><label class="pf-form-label">Nginx 配置</label><div id="pf-nginx-list" class="space-y-3"></div><button type="button" id="pf-nginx-add" class="mt-2 text-xs text-brand-600 hover:text-brand-700 flex items-center gap-1 transition"><i class="ph ph-plus"></i> 添加配置</button></div>',
                '    </div>',
                '  </div>',
                '  <div class="flex justify-end gap-3 px-6 py-4 border-t border-gray-100 bg-gray-50/50 shrink-0">',
                '    <button id="pf-cancel" class="px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition">取消</button>',
                '    <button id="pf-save" class="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-sm font-medium transition">保存</button>',
                '  </div>',
                '</div>'
            ].join('');
            document.body.appendChild(modal);
            document.body.style.overflow = 'hidden';

            requestAnimationFrame(function () { modal.classList.add('show'); });

            function closeModal() { modal.classList.remove('show'); setTimeout(function () { modal.remove(); document.body.style.overflow = ''; }, 300); }
            modal.querySelector('#pf-close').addEventListener('click', closeModal);
            modal.querySelector('#pf-cancel').addEventListener('click', closeModal);
            modal.addEventListener('click', function (e) { if (!e.target.closest('.pf-modal-panel')) closeModal(); });
            var cloudToggle = modal.querySelector('#pf-cloud-enabled');
            var cloudSection = modal.querySelector('#pf-cloud-section');
            if (cloudToggle && cloudSection) {
                cloudToggle.addEventListener('change', function () {
                    if (this.checked) cloudSection.classList.remove('hidden');
                    else cloudSection.classList.add('hidden');
                });
            }
            var serverToggle = modal.querySelector('#pf-server-enabled');
            var serverSection = modal.querySelector('#pf-server-section');
            if (serverToggle && serverSection) {
                serverToggle.addEventListener('change', function () {
                    if (this.checked) serverSection.classList.remove('hidden');
                    else serverSection.classList.add('hidden');
                });
            }
            // Nginx 动态增删（降级表单）
            var nginxAddBtn = modal.querySelector('#pf-nginx-add');
            if (nginxAddBtn) {
                nginxAddBtn.addEventListener('click', function () {
                    addNginxEntryToModal(modal, '', '');
                });
            }
            var initConfigs = data.nginxConfigs || [];
            if (initConfigs.length === 0) initConfigs = [{ name: '', config: '' }];
            for (var ci = 0; ci < initConfigs.length; ci++) {
                addNginxEntryToModal(modal, initConfigs[ci].name || '', initConfigs[ci].config || '');
            }
            modal.querySelector('#pf-save').addEventListener('click', function () {
                var localPath = modal.querySelector('#pf-local-path').value;
                var cloudEnabled = modal.querySelector('#pf-cloud-enabled').checked;
                var cloudPath = modal.querySelector('#pf-cloud-path').value;
                var serverEnabled = modal.querySelector('#pf-server-enabled').checked;
                var serverAddr = modal.querySelector('#pf-server-addr').value;
                var serverSpec = modal.querySelector('#pf-server-spec').value;
                var nginxConfigs = collectNginxConfigs(modal);

                var updated = Object.assign({}, data, {
                    localPath: localPath,
                    cloudEnabled: cloudEnabled,
                    cloudPath: cloudPath,
                    serverEnabled: serverEnabled,
                    serverAddr: serverAddr,
                    serverSpec: serverSpec,
                    nginxConfigs: nginxConfigs
                });

                var isEdit = !!projectName && !!data.id;
                var editId = data.id;

                showToast('正在保存...', 'ph ph-spinner', '#60a5fa');
                saveProjectToAPI(updated, isEdit, editId).then(function (res) {
                    if (!res.success) {
                        showToast('保存失败：' + (res.error || ''), 'ph ph-warning', '#fbbf24');
                        return;
                    }
                    showToast('项目信息已保存', 'ph-fill ph-check-circle', '#4ade80');
                    closeModal();
                    loadProjects();
                }).catch(function (err) {
                    console.error('[Project] 保存失败:', err);
                    showToast('保存失败，请检查网络', 'ph ph-warning', '#fbbf24');
                });
            });
        }

        // ========== 项目详情常驻面板 ==========
        var CLOUD_TYPE_NAMES = {
            baidu: '百度网盘', aliyun: '阿里云盘', github: 'GitHub', gitee: 'Gitee', onedrive: 'OneDrive', other: '其他'
        };
        var STATUS_BADGE_CLASS = {
            '待确认需求': 'pd-status-gray', '开发/设计中': 'pd-status-green', '待验收': 'pd-status-blue', '已完成': 'pd-status-purple', '已关闭': 'pd-status-gray'
        };
        var PRIORITY_BADGE_CLASS = { '高': 'pd-priority-high', '中': 'pd-priority-mid', '低': 'pd-priority-low' };
        var currentDetailProject = null;

        function showProjectDetail(projectName) {
            var drawer = document.getElementById('proj-detail-drawer');
            if (!drawer) return;

            var data = getProjectData(projectName);
            currentDetailProject = projectName;

            // 填充内容
            setText('pd-name', projectName);
            setText('pd-code', data.code || '无编号');
            setText('pd-desc', data.desc || '暂无描述');
            setText('pd-type', data.type || '—');
            setText('pd-scope', data.scope === 'personal' ? '个人项目' : '企业项目');
            setText('pd-deadline', data.deadline || '—');
            setText('pd-amount', data.amount ? '¥ ' + Number(data.amount).toLocaleString() : '—');
            setText('pd-customer', data.customer || '—');
            setText('pd-notes', data.notes || '—');

            // 状态标签
            var statusBadge = drawer.querySelector('#pd-status-badge');
            if (statusBadge) {
                statusBadge.textContent = data.status || '待确认需求';
                statusBadge.className = 'text-[10px] py-0.5 px-1.5 rounded font-medium ' + (STATUS_BADGE_CLASS[data.status] || 'pd-status-gray');
            }
            // 优先级标签
            var priBadge = drawer.querySelector('#pd-priority-badge');
            if (priBadge) {
                var pri = data.priority || '';
                if (pri === '高') { priBadge.textContent = '高优先级'; priBadge.className = 'text-[10px] py-0.5 px-1.5 rounded font-medium pd-priority-high'; }
                else if (pri === '中') { priBadge.textContent = '中优先级'; priBadge.className = 'text-[10px] py-0.5 px-1.5 rounded font-medium pd-priority-mid'; }
                else if (pri === '低') { priBadge.textContent = '低优先级'; priBadge.className = 'text-[10px] py-0.5 px-1.5 rounded font-medium pd-priority-low'; }
                else { priBadge.textContent = '无优先级'; priBadge.className = 'text-[10px] py-0.5 px-1.5 rounded font-medium pd-status-gray'; }
            }

            // 进度
            var progVal = drawer.querySelector('#pd-progress-val');
            var progBar = drawer.querySelector('#pd-progress-bar');
            if (progVal) progVal.textContent = data.progress || 0;
            if (progBar) progBar.style.width = (data.progress || 0) + '%';

            // 标签
            var tagsEl = drawer.querySelector('#pd-tags');
            if (tagsEl) {
                if (data.tags) {
                    var tags = data.tags.split(/[,，]/).filter(function (t) { return t.trim(); });
                    tagsEl.innerHTML = tags.map(function (t) {
                        return '<span class="text-[10px] text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">' + t.trim() + '</span>';
                    }).join('');
                } else {
                    tagsEl.innerHTML = '<span class="text-sm text-gray-400">—</span>';
                }
            }

            // 本地路径
            setText('pd-local-path', data.localPath || '未设置');

            // 云端
            var cloudEnabledEl = drawer.querySelector('#pd-cloud-enabled');
            var cloudSection = drawer.querySelector('#pd-cloud-section');
            if (data.cloudEnabled) {
                if (cloudEnabledEl) { cloudEnabledEl.textContent = '已启用'; cloudEnabledEl.className = 'text-sm text-green-600 flex items-center gap-1'; cloudEnabledEl.innerHTML = '<i class="ph-fill ph-check-circle"></i> 已启用'; }
                if (cloudSection) cloudSection.classList.remove('hidden');
                setText('pd-cloud-path', data.cloudPath || '—');
                setText('pd-cloud-type', CLOUD_TYPE_NAMES[data.cloudType] || data.cloudType || '—');
            } else {
                if (cloudEnabledEl) { cloudEnabledEl.innerHTML = '<i class="ph ph-x-circle text-gray-400"></i> 未启用'; cloudEnabledEl.className = 'text-sm text-gray-400 flex items-center gap-1'; }
                if (cloudSection) cloudSection.classList.add('hidden');
            }

            // 服务器配置
            var serverEnabledEl = drawer.querySelector('#pd-server-enabled');
            var serverSectionEl = drawer.querySelector('#pd-server-section');
            if (data.serverEnabled) {
                if (serverEnabledEl) { serverEnabledEl.innerHTML = '<i class="ph-fill ph-check-circle"></i> 已购买'; serverEnabledEl.className = 'text-sm text-green-600 flex items-center gap-1'; }
                if (serverSectionEl) serverSectionEl.classList.remove('hidden');
                setText('pd-server-addr', data.serverAddr || '—');
                var specEl = drawer.querySelector('#pd-server-spec');
                if (specEl) specEl.textContent = data.serverSpec || '—';
                // 渲染多个 Nginx 配置
                var nginxListEl = drawer.querySelector('#pd-nginx-list');
                if (nginxListEl) {
                    var configs = data.nginxConfigs || [];
                    if (configs.length === 0) {
                        nginxListEl.innerHTML = '<div class="bg-gray-50 rounded-lg p-3 border border-gray-100"><pre class="text-xs text-gray-400 whitespace-pre-wrap" style="font-family:monospace;">—</pre></div>';
                    } else {
                        nginxListEl.innerHTML = '';
                        for (var ni = 0; ni < configs.length; ni++) {
                            var item = document.createElement('div');
                            item.className = 'bg-gray-50 rounded-lg p-3 border border-gray-100';
                            var label = configs[ni].name || ('配置 ' + (ni + 1));
                            item.innerHTML =
                                '<div class="flex items-center justify-between mb-1">' +
                                    '<span class="text-[11px] font-medium text-indigo-500 flex items-center gap-1"><i class="ph ph-file-code"></i> ' + label + '</span>' +
                                    '<button class="pd-copy-nginx w-6 h-6 rounded text-gray-400 hover:text-brand-600 hover:bg-brand-50 transition flex items-center justify-center" data-config="' + ni + '" title="复制配置"><i class="ph ph-copy text-xs"></i></button>' +
                                '</div>' +
                                '<pre class="text-xs text-gray-600 whitespace-pre-wrap break-all max-h-48 overflow-y-auto" style="font-family:monospace;">' + (configs[ni].config || '—') + '</pre>';
                            nginxListEl.appendChild(item);
                        }
                        // 绑定复制按钮
                        var copyBtns = nginxListEl.querySelectorAll('.pd-copy-nginx');
                        for (var cb = 0; cb < copyBtns.length; cb++) {
                            (function (btn) {
                                btn.addEventListener('click', function () {
                                    var idx = parseInt(btn.getAttribute('data-config'));
                                    var cfg = configs[idx];
                                    if (cfg && cfg.config) {
                                        copyToClipboard(cfg.config);
                                        showToast('Nginx 配置已复制', 'ph-fill ph-check-circle', '#4ade80');
                                    }
                                });
                            })(copyBtns[cb]);
                        }
                    }
                }
            } else {
                if (serverEnabledEl) { serverEnabledEl.innerHTML = '<i class="ph ph-x-circle text-gray-400"></i> 未购买'; serverEnabledEl.className = 'text-sm text-gray-400 flex items-center gap-1'; }
                if (serverSectionEl) serverSectionEl.classList.add('hidden');
            }

            // 显示面板
            drawer.classList.add('show');
        }

        function hideProjectDetail() {
            var drawer = document.getElementById('proj-detail-drawer');
            if (drawer) drawer.classList.remove('show');
            currentDetailProject = null;
        }

        function setText(id, text) {
            var el = document.getElementById(id);
            if (el) el.textContent = text;
        }

        function bindDetailDrawer() {
            var drawer = document.getElementById('proj-detail-drawer');
            if (!drawer || drawer.dataset.bound) return;
            drawer.dataset.bound = 'true';

            // 关闭按钮
            var closeBtn = drawer.querySelector('#pd-close');
            if (closeBtn) closeBtn.addEventListener('click', hideProjectDetail);

            function setDetailTab(target) {
                var infoTab = drawer.querySelector('#pd-tab-info');
                var filesTab = drawer.querySelector('#pd-tab-files');
                var serverTab = drawer.querySelector('#pd-tab-server');
                for (var j = 0; j < tabs.length; j++) {
                    var isActive = tabs[j].dataset.tab === target;
                    tabs[j].classList.toggle('border-brand-600', isActive);
                    tabs[j].classList.toggle('text-brand-600', isActive);
                    tabs[j].classList.toggle('font-medium', isActive);
                    tabs[j].classList.toggle('border-transparent', !isActive);
                    tabs[j].classList.toggle('text-gray-500', !isActive);
                    tabs[j].classList.toggle('hover:text-gray-800', !isActive);
                }
                if (infoTab) infoTab.classList.toggle('hidden', target !== 'info');
                if (filesTab) filesTab.classList.toggle('hidden', target !== 'files');
                if (serverTab) serverTab.classList.toggle('hidden', target !== 'server');
            }

            // Tab 切换
            var tabs = drawer.querySelectorAll('.pd-tab');
            for (var i = 0; i < tabs.length; i++) {
                (function (tab) {
                    tab.addEventListener('click', function () {
                        setDetailTab(tab.dataset.tab);
                    });
                })(tabs[i]);
            }
            setDetailTab('info');

            // 编辑项目
            var editBtn = drawer.querySelector('#pd-edit-btn');
            if (editBtn) editBtn.addEventListener('click', function () {
                if (currentDetailProject) openEditForm(currentDetailProject);
            });

            // 打开目录
            var openBtn = drawer.querySelector('#pd-open-folder');
            if (openBtn) openBtn.addEventListener('click', function () {
                var data = getProjectData(currentDetailProject || '');
                if (data.localPath) {
                    copyToClipboard(data.localPath);
                    showToast('本地路径已复制，请在文件管理器中打开', 'ph-fill ph-check-circle', '#4ade80');
                } else {
                    showToast('该项目未设置本地路径', 'ph ph-warning', '#fbbf24');
                }
            });

            // 复制本地地址
            var copyLocalBtn = drawer.querySelector('#pd-copy-local');
            if (copyLocalBtn) copyLocalBtn.addEventListener('click', function () {
                var data = getProjectData(currentDetailProject || '');
                if (data.localPath) {
                    copyToClipboard(data.localPath);
                    showToast('本地地址已复制', 'ph-fill ph-check-circle', '#4ade80');
                } else {
                    showToast('未设置本地地址', 'ph ph-warning', '#fbbf24');
                }
            });

            // 复制云端地址
            var copyCloudBtn = drawer.querySelector('#pd-copy-cloud');
            if (copyCloudBtn) copyCloudBtn.addEventListener('click', function () {
                var data = getProjectData(currentDetailProject || '');
                if (data.cloudPath) {
                    copyToClipboard(data.cloudPath);
                    showToast('云端地址已复制', 'ph-fill ph-check-circle', '#4ade80');
                } else {
                    showToast('未设置云端地址', 'ph ph-warning', '#fbbf24');
                }
            });

            // 复制服务器地址
            var copyServerBtn = drawer.querySelector('#pd-copy-server-addr');
            if (copyServerBtn) copyServerBtn.addEventListener('click', function () {
                var data = getProjectData(currentDetailProject || '');
                if (data.serverAddr) {
                    copyToClipboard(data.serverAddr);
                    showToast('服务器地址已复制', 'ph-fill ph-check-circle', '#4ade80');
                } else {
                    showToast('未设置服务器地址', 'ph ph-warning', '#fbbf24');
                }
            });
        }

        // ========== 绑定左键菜单 ==========
        function bindContextMenu() {
            // 看板卡片左键
            var kanbanContainers = document.querySelectorAll('#kanban-view, #p-kanban-view');
            for (var i = 0; i < kanbanContainers.length; i++) {
                (function (container) {
                    if (container.dataset.ctxBound) return;
                    container.dataset.ctxBound = 'true';
                    // 捕获阶段拦截，阻止全局 click 立刻关闭菜单
                    container.addEventListener('click', function (e) {
                        var card = e.target.closest('div.group');
                        if (!card) return;
                        if (card.tagName === 'BUTTON') return;
                        // 如果点到的是卡片内的按钮（如三点按钮），不弹菜单
                        if (e.target.closest('button')) return;
                        e.preventDefault();
                        e.stopImmediatePropagation();
                        var name = getProjectNameFromCard(card);
                        if (!name) return;
                        showContextMenu(e.clientX, e.clientY, name);
                    }, true);
                })(kanbanContainers[i]);
            }

            // 列表行左键
            var listTables = document.querySelectorAll('#list-view table tbody, #p-list-view table tbody');
            for (var j = 0; j < listTables.length; j++) {
                (function (tbody) {
                    if (tbody.dataset.ctxBound) return;
                    tbody.dataset.ctxBound = 'true';
                    tbody.addEventListener('click', function (e) {
                        var row = e.target.closest('tr');
                        if (!row) return;
                        // 如果点到的是行内按钮（如三点按钮），不弹菜单
                        if (e.target.closest('button')) return;
                        e.preventDefault();
                        e.stopImmediatePropagation();
                        var name = getProjectNameFromRow(row);
                        if (!name) return;
                        showContextMenu(e.clientX, e.clientY, name);
                    }, true);
                })(listTables[j]);
            }

            // 全局点击关闭菜单（捕获阶段，确保在卡片 click 之前执行判断）
            if (!document._projCtxBound) {
                document._projCtxBound = true;
                document.addEventListener('click', function () { hideContextMenu(); });
            }
        }

        // ========== 全局入口（可重复执行）==========
        /*
         * 顶部栏「新建项目」按钮是内联 onclick="openEditForm(null)"，
         * 只能从 window 上找这个函数；看板里的「新建项目」卡片同理（见上文 innerHTML）。
         *
         * 但 SPA 的 core/view.js 在离开视图时会把「挂载期间新增的 window 键」全部删掉
         * （restoreGlobals），openEditForm 正好落在其中。
         * 本脚本又只被加载一次（views/project.js 用 loadPromise 缓存），
         * 原先的顶层赋值不会重跑 —— 于是第二次进入时按钮一点就
         * "Uncaught ReferenceError: openEditForm is not defined"。
         *
         * 所以赋值必须收进这个函数，由 init() 与视图每次 mount 时调用（幂等）。
         */
        function exposeGlobals() {
            window.openEditForm = function (projectName) {
                openEditForm(projectName || null);
            };
        }

        // ========== 初始化 ==========
        function init() {
            // 先把全局入口补回来，再干别的
            exposeGlobals();

            clearStaticProjectDemo();

            // Scope toggle
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

            // Enterprise kanban/list toggle
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

            // Personal kanban/list toggle
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

            // 右键菜单绑定
            bindContextMenu();
            // 详情面板绑定
            bindDetailDrawer();
            // 从后端加载项目数据
            loadProjects();
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
        } else {
            initWhenProjectPageMounted();
        }

        // 防止脚本被重复执行时叠加 spa:ready 监听。
        // 哨兵刻意挂在 document 上而不是 window：
        // window 上的自有键会被 core/view.js 的 restoreGlobals 删掉，
        // 但 addEventListener 注册的监听删不掉 —— 哨兵若被删而监听还在，
        // 状态就与真实绑定情况脱节。document 不在回收范围内，可作为脚本级单例标志。
        if (!document._projectPageSpaReadyBound) {
            document._projectPageSpaReadyBound = true;
            window.addEventListener('spa:ready', function (e) {
                var page = (e.detail && e.detail.page) || '';
                if (page && page.indexOf('project') === -1) return;
                initWhenProjectPageMounted();
            });
        }

        // 暴露给 views/project.js 的显式契约。
        // 视图在 ensureScript() 之后把这个对象抓进自己的闭包，每次 mount 调 exposeGlobals()，
        // 因此即使 window 上的键被 SPA 清掉，重新进入页面也能立刻恢复。
        window.__projectPage = {
            init: init,
            exposeGlobals: exposeGlobals
        };
    })();

