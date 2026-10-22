/**
 * 备忘视图
 *
 * 迁移自 pages/personal/memo.html 的 473 行内联脚本，改造要点：
 *   1. 全部函数收进 mount 闭包 —— 不再污染 window，也不会和其他页面的同名函数打架
 *      （旧代码里 escapeHtml / formatDate / showToast 在 12 个页面各有一份）
 *   2. 本地 escapeHtml → App.dom.escapeHtml（安全实现，转义引号）
 *   3. 本地 showToast → App.ui.toast（统一实现）
 *   4. 原生 confirm → App.ui.confirm（Promise，样式统一）
 *   5. onclick 内联属性 → data-act + 事件委托，且委托解绑函数登记到 ctx.onCleanup
 *   6. 状态在每次 mount 时重建 —— 不再需要手动重置残留状态
 */
(function (global) {
    'use strict';

    var App = global.App = global.App || {};
    var dom = App.dom;

    // ========== 静态配置（模块级共享，只读） ==========

    var CATEGORIES = [
        { name: '全部笔记', value: '', icon: 'ph-squares-four', color: 'brand' },
        { name: '客户信息', value: '客户信息', icon: 'ph-users', color: 'blue' },
        { name: '项目笔记', value: '项目笔记', icon: 'ph-kanban', color: 'green' },
        { name: '技术方案', value: '技术方案', icon: 'ph-code', color: 'purple' },
        { name: '报价参考', value: '报价参考', icon: 'ph-currency-cny', color: 'orange' },
        { name: '灵感记录', value: '灵感记录', icon: 'ph-lightbulb', color: 'yellow' },
        { name: '其他', value: '其他', icon: 'ph-tag', color: 'gray' }
    ];

    var CATEGORY_COLORS = {
        '客户信息': 'blue',
        '项目笔记': 'green',
        '技术方案': 'purple',
        '报价参考': 'orange',
        '灵感记录': 'yellow',
        '其他': 'gray'
    };

    var TAG_COLORS = {
        '重要': 'blue',
        '紧急': 'red',
        '已处理': 'green',
        '待跟进': 'orange',
        '参考': 'purple',
        '备忘': 'gray'
    };

    var ALL_TAGS = ['重要', '紧急', '已处理', '待跟进', '参考', '备忘'];

    /**
     * 备忘时间格式：今天 15:30 / 昨天 09:12 / 10-19 14:05
     * 与 App.dom.formatRelative（"3天前"）语义不同，故保留本地实现。
     */
    function formatMemoTime(dateStr) {
        if (!dateStr) return '';
        var d = new Date(dateStr);
        if (isNaN(d.getTime())) return '';
        var now = new Date();

        var hh = String(d.getHours()).padStart(2, '0');
        var mi = String(d.getMinutes()).padStart(2, '0');
        var mm = String(d.getMonth() + 1).padStart(2, '0');
        var dd = String(d.getDate()).padStart(2, '0');

        if (d.toDateString() === now.toDateString()) return '今天 ' + hh + ':' + mi;

        var yesterday = new Date(now.getTime() - 86400000);
        if (d.toDateString() === yesterday.toDateString()) return '昨天 ' + hh + ':' + mi;

        return mm + '-' + dd + ' ' + hh + ':' + mi;
    }

    // ========== 视图定义 ==========

    App.view('memo', {
        path: '/memo',
        nav: 'memo.html',
        title: '备忘',
        template: 'views/memo.html',
        styles: 'css/views/memo.css',

        async mount(root, ctx) {
            // 每次进入都是全新状态，天然无残留
            var state = {
                list: [],
                map: {},
                currentId: null,
                category: '',
                keyword: '',
                sort: 'updated'
            };

            var offline = false;   // 请求竞态保护：只渲染最后一次请求的结果

            // ---------- 数据 ----------

            function request(url, options) {
                options = options || {};
                options.signal = ctx.signal;
                return global.api.call(url, options);
            }

            function load() {
                var params = new URLSearchParams();
                if (state.category) params.append('category', state.category);
                if (state.keyword) params.append('keyword', state.keyword);
                params.append('sortBy', state.sort);

                var token = ++load.seq;
                return request('/api/memos?' + params.toString())
                    .then(function (res) {
                        // 慢请求后到，丢弃（旧代码没有这个保护，快速切换分类会看到错乱数据）
                        if (token !== load.seq) return;
                        if (res && res.success) {
                            state.list = res.data || [];
                            state.map = {};
                            state.list.forEach(function (m) { state.map[m.id] = m; });
                            renderAll();
                        }
                    })
                    .catch(function (err) {
                        if (err && err.name === 'AbortError') return;   // 切页取消，属正常
                        offline = true;
                        console.error('[memo] 加载失败:', err);
                        App.ui.toast('备忘加载失败', 'error');
                    });
            }
            load.seq = 0;

            // ---------- 渲染 ----------

            function renderCategories() {
                var counts = { '': state.list.length };
                CATEGORIES.forEach(function (cat) {
                    if (cat.value) {
                        counts[cat.value] = state.list.filter(function (m) {
                            return m.category === cat.value;
                        }).length;
                    }
                });

                var listEl = root.querySelector('#category-list');
                if (!listEl) return;

                listEl.innerHTML = CATEGORIES.map(function (cat) {
                    var isActive = state.category === cat.value;
                    var activeCls = isActive
                        ? 'bg-brand-50 text-brand-600 font-medium'
                        : 'text-gray-600 hover:bg-gray-50';
                    var countCls = isActive ? 'bg-white' : 'text-gray-400';
                    return '<button type="button" data-act="select-category" data-category="' +
                        dom.escapeAttr(cat.value) + '" class="w-full flex items-center justify-between px-3 py-2 rounded-lg ' +
                        activeCls + ' text-sm transition-colors">' +
                        '<span class="flex items-center gap-2"><i class="ph ' + cat.icon +
                        ' text-' + cat.color + '-500"></i> ' + dom.escapeHtml(cat.name) + '</span>' +
                        '<span class="text-[10px] ' + countCls + ' px-1.5 py-0.5 rounded-full">' +
                        (counts[cat.value] || 0) + '</span>' +
                        '</button>';
                }).join('');
            }

            function renderTags() {
                var listEl = root.querySelector('#tag-list');
                if (!listEl) return;
                listEl.innerHTML = ALL_TAGS.map(function (tag) {
                    var color = TAG_COLORS[tag] || 'gray';
                    return '<span class="px-2 py-0.5 text-[10px] text-' + color + '-600 bg-' + color +
                        '-50 border border-' + color + '-100 rounded cursor-pointer hover:bg-' + color +
                        '-100 transition-colors">' + dom.escapeHtml(tag) + '</span>';
                }).join('');
            }

            function buildCardHtml(memo) {
                var catColor = CATEGORY_COLORS[memo.category] || 'gray';
                var tagsHtml = (memo.tags || []).map(function (tag) {
                    var tColor = TAG_COLORS[tag] || 'gray';
                    return '<span class="text-[10px] text-' + tColor + '-600 bg-' + tColor +
                        '-50 border border-' + tColor + '-100 px-1.5 py-0.5 rounded">' +
                        dom.escapeHtml(tag) + '</span>';
                }).join('');

                var id = dom.escapeAttr(memo.id);
                var pinnedBtn = memo.pinned
                    ? '<button type="button" data-act="pin" data-memo-id="' + id +
                      '" class="absolute top-3 right-3 text-brand-500 hover:text-brand-700"><i class="ph-fill ph-push-pin text-sm"></i></button>'
                    : '';

                var cardBg = memo.pinned
                    ? 'bg-gradient-to-br from-' + catColor + '-50 to-white border border-' + catColor + '-100'
                    : 'bg-white border border-gray-100';

                return '<div data-act="open" data-memo-id="' + id +
                    '" class="memo-card ' + cardBg + ' rounded-xl p-5 shadow-soft hover:shadow-md transition-shadow group relative">' +
                    pinnedBtn +
                    '<div class="flex items-center gap-2 mb-2">' +
                    '<span class="text-[10px] text-' + catColor + '-600 bg-' + catColor +
                    '-50 px-1.5 py-0.5 rounded font-medium">' +
                    dom.escapeHtml(memo.category || '其他') + '</span>' +
                    tagsHtml +
                    '</div>' +
                    '<h4 class="font-bold text-gray-800 text-sm mb-2">' + dom.escapeHtml(memo.title) + '</h4>' +
                    '<p class="text-xs text-gray-600 leading-relaxed mb-3 line-clamp-3">' +
                    dom.escapeHtml(memo.content) + '</p>' +
                    '<div class="flex items-center justify-between">' +
                    '<span class="text-[10px] text-gray-400">' +
                    formatMemoTime(memo.updatedAt || memo.createdAt) + '</span>' +
                    '<div class="card-actions flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">' +
                    '<button type="button" data-act="pin" data-memo-id="' + id +
                    '" class="w-6 h-6 rounded border border-gray-200 flex items-center justify-center text-gray-400 hover:text-brand-500 hover:bg-brand-50 transition-colors" title="置顶"><i class="ph ph-push-pin text-xs"></i></button>' +
                    '<button type="button" data-act="edit" data-memo-id="' + id +
                    '" class="w-6 h-6 rounded border border-gray-200 flex items-center justify-center text-gray-400 hover:text-brand-500 hover:bg-brand-50 transition-colors" title="编辑"><i class="ph ph-pencil-simple text-xs"></i></button>' +
                    '<button type="button" data-act="delete" data-memo-id="' + id +
                    '" class="w-6 h-6 rounded border border-gray-200 flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors" title="删除"><i class="ph ph-trash text-xs"></i></button>' +
                    '</div></div></div>';
            }

            function renderAll() {
                renderCategories();
                renderTags();

                var pinned = state.list.filter(function (m) { return m.pinned; });
                var normal = state.list.filter(function (m) { return !m.pinned; });

                var pinnedSection = root.querySelector('#pinned-section');
                var pinnedGrid = root.querySelector('#pinned-grid');
                if (pinnedSection && pinnedGrid) {
                    if (pinned.length > 0) {
                        pinnedSection.style.display = '';
                        pinnedGrid.innerHTML = pinned.map(buildCardHtml).join('');
                    } else {
                        pinnedSection.style.display = 'none';
                    }
                }

                var notesGrid = root.querySelector('#notes-grid');
                if (notesGrid) {
                    if (normal.length === 0 && pinned.length === 0) {
                        notesGrid.innerHTML =
                            '<div class="col-span-full text-center py-12 text-gray-400">' +
                            '<i class="ph ph-notebook text-3xl mb-2 block"></i>暂无备忘数据</div>';
                    } else if (normal.length === 0) {
                        notesGrid.innerHTML = '';
                    } else {
                        notesGrid.innerHTML = normal.map(buildCardHtml).join('');
                    }
                }

                var countEl = root.querySelector('#total-count');
                if (countEl) countEl.textContent = state.list.length + ' 条';
                var labelEl = root.querySelector('#current-category-label');
                if (labelEl) labelEl.textContent = state.category || '全部笔记';
            }

            // ---------- 详情抽屉 ----------

            function openDetailDrawer(id) {
                var memo = state.map[id];
                if (!memo) return;
                state.currentId = id;

                var pinBtn = root.querySelector('#drawer-pin-btn');
                if (pinBtn) {
                    pinBtn.innerHTML = memo.pinned
                        ? '<i class="ph-fill ph-push-pin text-lg text-brand-500"></i>'
                        : '<i class="ph ph-push-pin text-lg"></i>';
                }

                var catColor = CATEGORY_COLORS[memo.category] || 'gray';
                var tagsHtml = (memo.tags || []).map(function (tag) {
                    var tColor = TAG_COLORS[tag] || 'gray';
                    return '<span class="text-[10px] text-' + tColor + '-600 bg-' + tColor +
                        '-50 border border-' + tColor + '-100 px-2 py-1 rounded">' +
                        dom.escapeHtml(tag) + '</span>';
                }).join('');

                var contentEl = root.querySelector('#drawer-content');
                if (contentEl) {
                    contentEl.innerHTML =
                        '<div class="mb-6 border-l-4 border-brand-500 pl-4">' +
                        '<div class="flex items-center gap-2 mb-3">' +
                        '<span class="text-[10px] text-' + catColor + '-600 bg-' + catColor +
                        '-50 px-2 py-1 rounded font-medium">' +
                        dom.escapeHtml(memo.category || '其他') + '</span>' + tagsHtml + '</div>' +
                        '<h2 class="text-xl font-bold text-gray-800 mb-2">' +
                        dom.escapeHtml(memo.title) + '</h2>' +
                        '<div class="flex items-center gap-1.5 text-xs text-gray-400">' +
                        '<i class="ph ph-clock text-brand-500"></i><span>' +
                        formatMemoTime(memo.updatedAt || memo.createdAt) + '</span></div></div>' +
                        '<div class="bg-gray-50 rounded-xl p-5">' +
                        '<div class="flex items-center gap-2 mb-3">' +
                        '<i class="ph-fill ph-text-t text-brand-500"></i>' +
                        '<span class="text-xs font-medium text-gray-500 uppercase tracking-wider">备忘内容</span></div>' +
                        '<div class="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">' +
                        dom.escapeHtml(memo.content) + '</div></div>';
                }

                var overlay = root.querySelector('#detail-drawer-overlay');
                var drawer = root.querySelector('#detail-drawer');
                if (overlay) overlay.classList.add('active');
                if (drawer) drawer.classList.add('active');
                document.body.style.overflow = 'hidden';
            }

            function closeDrawer() {
                var overlay = root.querySelector('#detail-drawer-overlay');
                var drawer = root.querySelector('#detail-drawer');
                if (overlay) overlay.classList.remove('active');
                if (drawer) drawer.classList.remove('active');
                document.body.style.overflow = '';
                state.currentId = null;
            }

            // ---------- 操作 ----------

            function editMemo(id) {
                if (state.map[id] && typeof global.openMemoForm === 'function') {
                    global.openMemoForm(state.map[id]);
                }
            }

            function togglePin(id) {
                return request('/api/memos/' + encodeURIComponent(id) + '/pin', {
                    method: 'PUT'
                })
                    .then(function (res) {
                        if (res && res.success) {
                            App.ui.toast(res.data.pinned ? '已置顶' : '已取消置顶', 'success');
                            if (state.currentId === id) {
                                state.map[id] = res.data;
                                openDetailDrawer(id);
                            }
                            return load();
                        }
                        App.ui.toast((res && res.error) || '操作失败', 'error');
                    })
                    .catch(function (err) {
                        if (err && err.name === 'AbortError') return;
                        console.error('[memo] 置顶失败:', err);
                        App.ui.toast('操作失败', 'error');
                    });
            }

            function deleteMemo(id) {
                var memo = state.map[id];
                if (!memo) return Promise.resolve();

                return App.ui.confirm({
                    title: '删除备忘',
                    message: '确定要删除「' + memo.title + '」吗？此操作不可撤销。',
                    confirmText: '删除'
                }).then(function (ok) {
                    if (!ok) return;
                    return request('/api/memos/' + encodeURIComponent(id), {
                        method: 'DELETE'
                    })
                        .then(function (res) {
                            if (res && res.success) {
                                App.ui.toast('已删除', 'success');
                                if (state.currentId === id) closeDrawer();
                                return load();
                            }
                            App.ui.toast((res && res.error) || '删除失败', 'error');
                        })
                        .catch(function (err) {
                            if (err && err.name === 'AbortError') return;
                            console.error('[memo] 删除失败:', err);
                            App.ui.toast('删除失败', 'error');
                        });
                });
            }

            function quickAdd() {
                var input = root.querySelector('#quick-add-input');
                var categoryEl = root.querySelector('#quick-add-category');
                if (!input) return Promise.resolve();

                var title = input.value.trim();
                if (!title) return Promise.resolve();

                return request('/api/memos', {
                    method: 'POST',
                    body: {
                        title: title,
                        category: (categoryEl && categoryEl.value) || '其他',
                        tags: [],
                        content: title,
                        pinned: false
                    }
                })
                    .then(function (res) {
                        if (res && res.success) {
                            input.value = '';
                            App.ui.toast('备忘已创建', 'success');
                            return load();
                        }
                        App.ui.toast((res && res.error) || '创建失败', 'error');
                    })
                    .catch(function (err) {
                        if (err && err.name === 'AbortError') return;
                        console.error('[memo] 快速添加失败:', err);
                        App.ui.toast('添加失败', 'error');
                    });
            }

            function submitForm(data) {
                var isEdit = !!data.id && !!state.map[data.id];
                var url = isEdit ? '/api/memos/' + encodeURIComponent(data.id) : '/api/memos';

                return request(url, {
                    method: isEdit ? 'PUT' : 'POST',
                    body: {
                        title: data.title,
                        category: data.category,
                        tags: data.tags,
                        content: data.content,
                        pinned: data.pinned
                    }
                })
                    .then(function (res) {
                        if (res && res.success) {
                            App.ui.toast(isEdit ? '备忘已更新' : '备忘已创建', 'success');
                            return load();
                        }
                        App.ui.toast((res && res.error) || '保存失败', 'error');
                    })
                    .catch(function (err) {
                        if (err && err.name === 'AbortError') return;
                        console.error('[memo] 保存失败:', err);
                        App.ui.toast('保存失败', 'error');
                    });
            }

            // ---------- 事件绑定 ----------

            // 统一委托：所有 [data-act] 走这里，取代原来散落在 HTML 里的 onclick
            ctx.onCleanup(dom.delegate(root, '[data-act]', 'click', function (e, target) {
                var act = target.getAttribute('data-act');
                var id = target.getAttribute('data-memo-id');

                switch (act) {
                    case 'new-memo':
                        if (typeof global.openMemoForm === 'function') global.openMemoForm();
                        break;
                    case 'select-category':
                        state.category = target.getAttribute('data-category') || '';
                        load();
                        break;
                    case 'open':
                        openDetailDrawer(id);
                        break;
                    case 'pin':
                        togglePin(id);
                        break;
                    case 'edit':
                        editMemo(id);
                        break;
                    case 'delete':
                        deleteMemo(id);
                        break;
                    case 'close-drawer':
                        closeDrawer();
                        break;
                    case 'edit-current':
                        if (state.currentId) editMemo(state.currentId);
                        break;
                    case 'pin-from-drawer':
                        if (state.currentId) togglePin(state.currentId);
                        break;
                }
            }));

            // 快速添加：Enter 提交
            var quickInput = root.querySelector('#quick-add-input');
            if (quickInput) {
                ctx.onCleanup(dom.on(quickInput, 'keypress', function (e) {
                    if (e.key === 'Enter') quickAdd();
                }));
            }

            // 搜索：防抖 300ms
            var searchInput = root.querySelector('#search-input');
            if (searchInput) {
                var onSearch = dom.debounce(function () {
                    state.keyword = searchInput.value.trim();
                    load();
                }, 300);
                ctx.onCleanup(dom.on(searchInput, 'input', onSearch));
                ctx.onCleanup(function () { onSearch.cancel(); });
            }

            // 排序
            var sortSelect = root.querySelector('#sort-select');
            if (sortSelect) {
                ctx.onCleanup(dom.on(sortSelect, 'change', function () {
                    state.sort = sortSelect.value;
                    load();
                }));
            }

            // ESC 关闭抽屉（挂在 document 上，必须登记清理，否则每进一次页面就多一个监听）
            ctx.onCleanup(dom.on(document, 'keydown', function (e) {
                if (e.key === 'Escape') closeDrawer();
            }));

            // 表单提交事件（memo-form.js 派发）。旧代码用 window._memoEscBound 手动防重复，
            // 现在依赖清理机制保证每次进入只绑一次。
            function onSubmit(e) {
                submitForm(e.detail || {});
            }
            global.addEventListener('memo-form:submit', onSubmit);
            ctx.onCleanup(function () {
                global.removeEventListener('memo-form:submit', onSubmit);
            });

            // 离开页面时确保抽屉关闭、滚动解锁
            ctx.onCleanup(function () {
                closeDrawer();
                if (typeof global.closeMemoForm === 'function') global.closeMemoForm();
            });

            // ---------- 首屏 ----------
            await load();
        }
    });

})(typeof window !== 'undefined' ? window : this);
