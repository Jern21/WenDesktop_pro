/**
 * 设置中心「菜单选项」：开关来自侧栏真实菜单，偏好由 SidebarMenuPrefs 保存。
 */
(function (global) {
    'use strict';

    global.SettingsPage.section(function (ctx) {
        var root = document.getElementById('menu-options');
        var list = document.getElementById('menu-options-list');
        var totalEl = document.getElementById('menu-options-total');
        var hiddenEl = document.getElementById('menu-options-hidden-count');
        var resetBtn = document.getElementById('menu-options-reset');
        var hideAllBtn = document.getElementById('menu-options-hide-all');
        if (!root || !list || root.dataset.menuBound) return;
        if (!global.SidebarMenuPrefs) {
            list.innerHTML = '<p class="text-xs text-gray-400 py-6 text-center">菜单偏好模块未加载</p>';
            return;
        }

        function escapeHtml(value) {
            return String(value == null ? '' : value)
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;');
        }

        function paint() {
            var prefs = global.SidebarMenuPrefs;
            var catalog = prefs.getCatalog();
            var hidden = {};
            prefs.getHidden().forEach(function (key) { hidden[key] = true; });

            if (totalEl) totalEl.textContent = String(catalog.length);
            if (hiddenEl) hiddenEl.textContent = String(prefs.getHidden().length);

            if (!catalog.length) {
                list.innerHTML = '<p class="text-xs text-gray-400 py-6 text-center">没有读到侧栏菜单</p>';
                return;
            }

            list.innerHTML = catalog.map(function (item) {
                var parentOff = item.parent && hidden[item.parent];
                var disabled = item.locked || parentOff;
                var checked = item.locked || !hidden[item.key];
                var pad = item.parent ? ' pl-8' : '';
                return [
                    '<label class="flex items-center justify-between gap-3 px-3 py-2 rounded-lg border border-gray-100' + pad + '" data-menu-row="' + escapeHtml(item.key) + '">',
                    '<span class="text-sm text-gray-700">' + escapeHtml(item.label) + '</span>',
                    '<input type="checkbox" data-menu-toggle="' + escapeHtml(item.key) + '"',
                    checked ? ' checked' : '',
                    disabled ? ' disabled' : '',
                    '>',
                    '</label>'
                ].join('');
            }).join('');
        }

        list.addEventListener('change', function (e) {
            var input = e.target;
            if (!input || !input.getAttribute) return;
            var key = input.getAttribute('data-menu-toggle');
            if (!key) return;
            var ok = global.SidebarMenuPrefs.setVisible(key, !!input.checked);
            if (!ok) input.checked = true;
            paint();
        });

        if (resetBtn) {
            resetBtn.addEventListener('click', function () {
                global.SidebarMenuPrefs.reset();
                paint();
            });
        }
        if (hideAllBtn) {
            hideAllBtn.addEventListener('click', function () {
                global.SidebarMenuPrefs.hideAll();
                paint();
            });
        }

        if (ctx && typeof ctx.listen === 'function') {
            ctx.listen(window, 'sidebar-menu-prefs-change', paint);
        }

        root.dataset.menuBound = '1';
        paint();
    });
})(typeof window !== 'undefined' ? window : this);
