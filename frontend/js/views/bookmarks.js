/**
 * 收藏网址视图
 *
 * 迁移自 pages/personal/bookmarks.html 的 373 行内联脚本，改造要点：
 *   1. 原 escapeHtml 用 div.innerHTML 实现（不转义引号，拼进属性会逃逸）→ 改用 App.dom.escapeHtml
 *   2. 原依赖旧 window.ui 的 ui.toast.error / ui.confirm(回调式) → 改用 App.ui.toast / App.ui.confirm(Promise)
 *   3. 5 处静态 onclick + 3 处动态 onclick → data-act 事件委托
 *   4. 筛选/搜索/上传/文字图标切换的监听器全部登记到 ctx.onCleanup，切页自动解绑
 *   5. 顺手修掉旧 bug：搜索时用的是 bm.desc（字段不存在，恒为 undefined），改为 bm.description
 */
(function (global) {
    'use strict';

    var App = global.App = global.App || {};
    var dom = App.dom;

    var CATEGORY_ICON_MAP = {
        docs: { icon: 'ph-file-text', color: 'category-docs' },
        tools: { icon: 'ph-wrench', color: 'category-tools' },
        learning: { icon: 'ph-graduation-cap', color: 'category-learning' },
        design: { icon: 'ph-paint-brush', color: 'category-design' },
        community: { icon: 'ph-users', color: 'category-community' },
        other: { icon: 'ph-dots-three', color: 'category-other' }
    };

    var FALLBACK_ICON = '/assets/svg/网站.svg';

    App.view('bookmarks', {
        path: '/bookmarks',
        nav: 'bookmarks.html',
        title: '收藏夹',
        template: 'views/bookmarks.html',
        styles: 'css/views/bookmarks.css',

        async mount(root, ctx) {
            var state = {
                list: [],
                categoryConfig: {},
                editingId: null,
                icon: null,
                useTextIcon: false
            };

            var $ = function (sel) { return root.querySelector(sel); };

            // ---------- 数据 ----------

            async function loadCategories() {
                try {
                    var res = await fetch('/api/bookmarks/categories', { signal: ctx.signal });
                    var result = await res.json();
                    if (!result.success) return;

                    state.categoryConfig = {};
                    result.data.forEach(function (c) {
                        var iconConfig = CATEGORY_ICON_MAP[c.id] || CATEGORY_ICON_MAP.other;
                        state.categoryConfig[c.id] = {
                            name: c.name,
                            icon: iconConfig.icon,
                            color: 'category-' + c.color
                        };
                    });

                    var select = $('#filter-category');
                    if (select) {
                        select.innerHTML = '<option value="">全部分类</option>' +
                            result.data.map(function (c) {
                                return '<option value="' + dom.escapeAttr(c.id) + '">' +
                                    dom.escapeHtml(c.name) + '</option>';
                            }).join('');
                    }
                } catch (e) {
                    if (e && e.name === 'AbortError') return;
                    console.error('[bookmarks] 分类加载失败:', e);
                }
            }

            async function loadBookmarks() {
                try {
                    var res = await fetch('/api/bookmarks', { signal: ctx.signal });
                    var result = await res.json();
                    if (result.success) {
                        state.list = result.data || [];
                        render();
                    }
                } catch (e) {
                    if (e && e.name === 'AbortError') return;
                    console.error('[bookmarks] 加载失败:', e);
                    App.ui.toast('收藏加载失败', 'error');
                }
            }

            // ---------- 渲染 ----------

            function buildIconHtml(bm) {
                if (bm.useTextIcon) {
                    var text = (bm.title || '?').charAt(0).toUpperCase();
                    return '<div class="w-10 h-10 rounded-lg bg-brand-500 text-white flex items-center justify-center text-lg font-bold flex-shrink-0">' +
                        dom.escapeHtml(text) + '</div>';
                }
                if (bm.customIcon) {
                    return '<div class="w-10 h-10 rounded-lg bg-gray-50 flex items-center justify-center overflow-hidden flex-shrink-0">' +
                        '<img src="' + dom.escapeAttr(bm.customIcon) + '" class="w-full h-full object-contain"></div>';
                }
                var faviconUrl = bm.favicon ||
                    ('https://www.google.com/s2/favicons?domain=' + encodeURIComponent(bm.url) + '&sz=64');
                return '<img src="' + dom.escapeAttr(faviconUrl) +
                    '" alt="" class="w-10 h-10 rounded-lg bg-gray-50 object-contain flex-shrink-0" ' +
                    'onerror="if(!this.dataset.fallback){this.dataset.fallback=1;this.src=\'' + FALLBACK_ICON + '\';}">';
            }

            function render() {
                var grid = $('#bookmarks-grid');
                var emptyState = $('#empty-state');
                var filterEl = $('#filter-category');
                var searchEl = $('#search-input');
                if (!grid || !emptyState) return;

                var filterCategory = filterEl ? filterEl.value : '';
                var keyword = searchEl ? searchEl.value.trim().toLowerCase() : '';

                var filtered = state.list.filter(function (bm) {
                    if (filterCategory && bm.category !== filterCategory) return false;
                    if (!keyword) return true;
                    // 修正：旧代码用的 bm.desc 字段并不存在
                    var text = [
                        bm.title || '',
                        bm.tags || '',
                        bm.description || ''
                    ].join(' ').toLowerCase();
                    return text.indexOf(keyword) !== -1;
                });

                if (filtered.length === 0) {
                    grid.innerHTML = '';
                    emptyState.classList.remove('hidden');
                    return;
                }
                emptyState.classList.add('hidden');

                grid.innerHTML = filtered.map(function (bm) {
                    var config = state.categoryConfig[bm.category] ||
                        state.categoryConfig.other ||
                        { name: '其他', color: 'category-other' };
                    var id = dom.escapeAttr(bm.id);

                    return '<div class="bookmark-card group">' +
                        '<div class="flex items-start gap-3 mb-3">' +
                        buildIconHtml(bm) +
                        '<div class="flex-1 min-w-0">' +
                        '<h4 class="font-semibold text-gray-800 truncate">' + dom.escapeHtml(bm.title) + '</h4>' +
                        '<span class="category-badge ' + config.color + '">' + dom.escapeHtml(config.name) + '</span>' +
                        '</div></div>' +
                        '<p class="text-xs text-gray-400 mb-2 line-clamp-2">' +
                        dom.escapeHtml(bm.description || '暂无描述') + '</p>' +
                        '<div class="flex items-center justify-between pt-2 border-t border-gray-50">' +
                        '<a href="' + dom.escapeAttr(bm.url) + '" target="_blank" rel="noopener" ' +
                        'data-act="record" data-id="' + id + '" ' +
                        'class="text-sm text-brand-500 hover:text-brand-600 flex items-center gap-1">' +
                        '<i class="ph ph-arrow-square-out"></i> 访问</a>' +
                        '<div class="flex items-center gap-2">' +
                        '<span class="text-xs text-gray-400">' + (bm.clickCount || 0) + ' 次访问</span>' +
                        '<div class="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">' +
                        '<button type="button" data-act="edit" data-id="' + id + '" class="p-1.5 text-gray-400 hover:text-brand-500 hover:bg-brand-50 rounded transition-colors">' +
                        '<i class="ph ph-pencil"></i></button>' +
                        '<button type="button" data-act="delete" data-id="' + id + '" class="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors">' +
                        '<i class="ph ph-trash"></i></button>' +
                        '</div></div></div></div>';
                }).join('');
            }

            // ---------- 抽屉 ----------

            function openForm(id) {
                state.editingId = id || null;
                state.icon = null;
                state.useTextIcon = false;

                var titleEl = $('#drawer-title');
                var formEl = $('#bookmark-form');
                var textPreview = $('#bookmark-text-icon-preview');
                var checkbox = $('#use-bookmark-text-icon');
                var iconPreview = $('#bookmark-icon-preview');

                if (titleEl) titleEl.textContent = id ? '编辑收藏' : '添加收藏';
                if (formEl) formEl.reset();
                if (textPreview) textPreview.classList.add('hidden');
                if (checkbox) checkbox.checked = false;
                if (iconPreview) iconPreview.innerHTML = '<i class="ph ph-image text-xl text-gray-400"></i>';

                if (id) {
                    var bm = state.list.find(function (b) { return b.id === id; });
                    if (bm) {
                        $('#bookmark-id').value = bm.id;
                        $('#bookmark-title').value = bm.title || '';
                        $('#bookmark-url').value = bm.url || '';
                        $('#bookmark-category').value = bm.category || '';
                        $('#bookmark-tags').value = bm.tags || '';
                        $('#bookmark-desc').value = bm.description || '';

                        if (bm.useTextIcon) {
                            state.useTextIcon = true;
                            if (checkbox) checkbox.checked = true;
                            toggleTextIcon();
                        } else if (bm.customIcon) {
                            state.icon = bm.customIcon;
                            if (iconPreview) {
                                iconPreview.innerHTML = '<img src="' + dom.escapeAttr(state.icon) +
                                    '" class="w-full h-full object-contain">';
                            }
                        }
                    }
                }

                var drawer = $('#bookmark-drawer');
                var panel = $('#bookmark-drawer-panel');
                if (drawer) drawer.classList.remove('hidden');
                setTimeout(function () {
                    if (panel) panel.classList.remove('translate-x-full');
                }, 10);
            }

            function closeForm() {
                var panel = $('#bookmark-drawer-panel');
                var drawer = $('#bookmark-drawer');
                if (panel) panel.classList.add('translate-x-full');
                setTimeout(function () {
                    if (drawer) drawer.classList.add('hidden');
                }, 300);
            }

            // ---------- 操作 ----------

            async function save() {
                var title = ($('#bookmark-title').value || '').trim();
                var url = ($('#bookmark-url').value || '').trim();
                var category = $('#bookmark-category').value;

                if (!title) return App.ui.toast('请输入网站名称', 'error');
                if (!url) return App.ui.toast('请输入网址', 'error');
                if (!category) return App.ui.toast('请选择分类', 'error');

                if (url.indexOf('http://') !== 0 && url.indexOf('https://') !== 0) {
                    url = 'https://' + url;
                }

                var payload = {
                    title: title,
                    url: url,
                    category: category,
                    description: ($('#bookmark-desc').value || '').trim(),
                    customIcon: state.icon,
                    useTextIcon: state.useTextIcon
                };

                try {
                    var res = await fetch(
                        state.editingId ? '/api/bookmarks/' + encodeURIComponent(state.editingId) : '/api/bookmarks',
                        {
                            method: state.editingId ? 'PUT' : 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            signal: ctx.signal,
                            body: JSON.stringify(payload)
                        }
                    );
                    var result = await res.json();
                    if (result.success) {
                        App.ui.toast('保存成功', 'success');
                        await loadBookmarks();
                        closeForm();
                    } else {
                        App.ui.toast(result.message || '保存失败', 'error');
                    }
                } catch (e) {
                    if (e && e.name === 'AbortError') return;
                    console.error('[bookmarks] 保存失败:', e);
                    App.ui.toast('保存失败，请重试', 'error');
                }
            }

            async function remove(id) {
                var ok = await App.ui.confirm({
                    title: '删除收藏',
                    message: '确定删除这个收藏吗？删除后无法恢复。',
                    confirmText: '删除'
                });
                if (!ok) return;

                try {
                    var res = await fetch('/api/bookmarks/' + encodeURIComponent(id), {
                        method: 'DELETE',
                        signal: ctx.signal
                    });
                    var result = await res.json();
                    if (result.success) {
                        App.ui.toast('删除成功', 'success');
                        await loadBookmarks();
                    } else {
                        App.ui.toast(result.message || '删除失败', 'error');
                    }
                } catch (e) {
                    if (e && e.name === 'AbortError') return;
                    console.error('[bookmarks] 删除失败:', e);
                    App.ui.toast('删除失败，请重试', 'error');
                }
            }

            function recordClick(id) {
                // 不阻塞链接跳转，fire-and-forget
                fetch('/api/bookmarks/' + encodeURIComponent(id) + '/click', { method: 'POST' })
                    .catch(function (e) { console.error('[bookmarks] 记录点击失败:', e); });
            }

            async function uploadIcon(file) {
                if (!file) return;
                var formData = new FormData();
                formData.append('file', file);

                try {
                    var res = await fetch('/api/upload', {
                        method: 'POST',
                        body: formData,
                        signal: ctx.signal
                    });
                    var result = await res.json();
                    if (result.success) {
                        state.icon = result.data.url;
                        var preview = $('#bookmark-icon-preview');
                        if (preview) {
                            preview.innerHTML = '<img src="' + dom.escapeAttr(state.icon) +
                                '" class="w-full h-full object-contain">';
                        }
                        var checkbox = $('#use-bookmark-text-icon');
                        if (checkbox) checkbox.checked = false;
                        state.useTextIcon = false;
                        var textPreview = $('#bookmark-text-icon-preview');
                        if (textPreview) textPreview.classList.add('hidden');
                    } else {
                        App.ui.toast('图标上传失败: ' + (result.error || '未知错误'), 'error');
                    }
                } catch (e) {
                    if (e && e.name === 'AbortError') return;
                    console.error('[bookmarks] 上传图标失败:', e);
                    App.ui.toast('图标上传失败，请重试', 'error');
                }
            }

            function toggleTextIcon() {
                var checkbox = $('#use-bookmark-text-icon');
                state.useTextIcon = !!(checkbox && checkbox.checked);
                var textPreview = $('#bookmark-text-icon-preview');
                var iconPreview = $('#bookmark-icon-preview');
                var display = $('#bookmark-text-icon-display');

                if (state.useTextIcon) {
                    var title = ($('#bookmark-title').value || '');
                    var text = title ? title.charAt(0).toUpperCase() : '网';
                    if (display) display.textContent = text;
                    if (textPreview) textPreview.classList.remove('hidden');

                    state.icon = null;
                    if (iconPreview) {
                        iconPreview.innerHTML = '<i class="ph ph-image text-xl text-gray-400"></i>';
                    }
                } else {
                    if (textPreview) textPreview.classList.add('hidden');
                }
            }

            function updateTextIconPreview() {
                if (!state.useTextIcon) return;
                var title = ($('#bookmark-title').value || '');
                var display = $('#bookmark-text-icon-display');
                if (display) display.textContent = title ? title.charAt(0).toUpperCase() : '网';
            }

            // ---------- 事件绑定 ----------

            ctx.onCleanup(dom.delegate(root, '[data-act]', 'click', function (e, target) {
                var act = target.getAttribute('data-act');
                var id = target.getAttribute('data-id');

                switch (act) {
                    case 'new':
                        openForm();
                        break;
                    case 'close':
                        closeForm();
                        break;
                    case 'save':
                        save();
                        break;
                    case 'pick-icon':
                        var fileInput = $('#bookmark-icon-upload');
                        if (fileInput) fileInput.click();
                        break;
                    case 'edit':
                        openForm(id);
                        break;
                    case 'delete':
                        remove(id);
                        break;
                    case 'record':
                        recordClick(id);
                        // 不 preventDefault，保持链接 target=_blank 的正常跳转
                        break;
                }
            }));

            var filterEl = $('#filter-category');
            if (filterEl) ctx.onCleanup(dom.on(filterEl, 'change', render));

            var searchEl = $('#search-input');
            if (searchEl) ctx.onCleanup(dom.on(searchEl, 'input', render));

            var titleInput = $('#bookmark-title');
            if (titleInput) ctx.onCleanup(dom.on(titleInput, 'input', updateTextIconPreview));

            var checkboxEl = $('#use-bookmark-text-icon');
            if (checkboxEl) ctx.onCleanup(dom.on(checkboxEl, 'change', toggleTextIcon));

            var uploadEl = $('#bookmark-icon-upload');
            if (uploadEl) {
                ctx.onCleanup(dom.on(uploadEl, 'change', function (e) {
                    uploadIcon(e.target.files && e.target.files[0]);
                }));
            }

            // ESC 关闭抽屉
            ctx.onCleanup(dom.on(document, 'keydown', function (e) {
                if (e.key === 'Escape') closeForm();
            }));

            // 离开时确保抽屉隐藏，避免影响下一页
            ctx.onCleanup(function () {
                var drawer = $('#bookmark-drawer');
                if (drawer) drawer.classList.add('hidden');
            });

            // ---------- 首屏 ----------
            await loadCategories();
            await loadBookmarks();
        }
    });

})(typeof window !== 'undefined' ? window : this);
