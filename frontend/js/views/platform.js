/**
 * 总览看板 - 平台管理 视图
 *
 * 自动迁移自 frontend/pages/platform/platform.html
 *
 * 迁移方式：原脚本整段放入 mount() 作用域，
 *   - 所有 var/function 成为局部变量，不再污染 window
 *   - document/window 上的监听由框架自动登记并清理
 *
 * ⚠️ 人工复核清单：
 *   1. 若含 onclick 内联属性 → 需改造成 data-act 委托
 *   2. 若含 spa:ready / spa:cleanup-forms 监听 → 新架构下应删除
 *   3. 若 css 含 @apply → 需展开为原生 CSS
 */
(function (global) {
    'use strict';

    var App = global.App = global.App || {};

    App.view('platform', {
        path: '/platform',
        nav: 'platform.html',
        title: '总览看板 - 平台管理',
        template: 'views/platform.html',
        styles: 'css/views/platform.css',

        async mount(root, ctx) {
            // ---- 自动捕获本页注册的全局监听，卸载时统一移除 ----
            var _docAdd = document.addEventListener;
            var _winAdd = window.addEventListener;
            var _listeners = [];
            document.addEventListener = function (t, f, o) {
                _listeners.push(['doc', t, f, o]);
                return _docAdd.call(document, t, f, o);
            };
            window.addEventListener = function (t, f, o) {
                _listeners.push(['win', t, f, o]);
                return _winAdd.call(window, t, f, o);
            };
            ctx.onCleanup(function () {
                document.addEventListener = _docAdd;
                window.addEventListener = _winAdd;
                _listeners.forEach(function (r) {
                    try {
                        (r[0] === 'doc' ? document : window).removeEventListener(r[1], r[2], r[3]);
                    } catch (e) { /* ignore */ }
                });
            });

            try {
                /* ==================== 原始脚本开始 ==================== */

                'use strict';

                (function () {
                    // ========== 状态 ==========
                    var currentPlatform = '';
                    var currentStatus = '';
                    var currentCategory = '';
                    var currentKeyword = '';
                    var currentPage = 1;
                    var pageSize = 10;
                    var totalCount = 0;
                    var overviewData = null;
                    var eventsBound = false;

                    // ========== 平台配置 ==========
                    var PLATFORMS = [
                        { value: '', label: '全部', icon: 'ph-squares-four', bg: 'bg-brand-500', text: 'text-white' },
                        { value: 'xianyu', label: '闲鱼', short: '闲', bg: 'bg-yellow-400', text: 'text-black' },
                        { value: 'xiaohongshu', label: '小红书', short: '小红书', bg: 'bg-red-500', text: 'text-white' },
                        { value: 'douyin', label: '抖音', icon: 'ph-tiktok-logo', bg: 'bg-black', text: 'text-white' }
                    ];

                    var STATUS_MAP = {
                        'draft': { label: '草稿', cls: 'bg-gray-50 text-gray-500 border-gray-200' },
                        'pending': { label: '待发布', cls: 'bg-orange-50 text-orange-500 border-orange-100' },
                        'published': { label: '已发布', cls: 'bg-green-50 text-green-600 border-green-100' },
                        'offline': { label: '已下线', cls: 'bg-red-50 text-red-500 border-red-100' }
                    };

                    // ========== 工具函数 ==========
                    function escapeHtml(s) {
                        return String(s || '').replace(/[&<>"']/g, function (c) {
                            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
                        });
                    }

                    function formatDateTime(dateStr) {
                        if (!dateStr) return '';
                        var d = new Date(dateStr);
                        if (isNaN(d.getTime())) return dateStr;
                        var mm = String(d.getMonth() + 1).padStart(2, '0');
                        var dd = String(d.getDate()).padStart(2, '0');
                        var hh = String(d.getHours()).padStart(2, '0');
                        var mi = String(d.getMinutes()).padStart(2, '0');
                        return mm + '-' + dd + ' ' + hh + ':' + mi;
                    }

                    function formatTime(dateStr) {
                        if (!dateStr) return '';
                        var d = new Date(dateStr);
                        if (isNaN(d.getTime())) return '';
                        return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
                    }

                    function formatNumber(n) {
                        n = parseInt(n) || 0;
                        if (n >= 10000) return (n / 10000).toFixed(1) + 'w';
                        if (n >= 1000) return (n / 1000).toFixed(1) + 'k';
                        return String(n);
                    }

                    function getPlatformConfig(pf) {
                        return PLATFORMS.find(function (p) { return p.value === pf; }) || PLATFORMS[0];
                    }

                    // 生成平台 SVG 图标 HTML
                    function platformIconHtml(platform, sizeClass) {
                        var base = window.ROOT_URL || window.PAGE_BASE || '';
                        var files = { xianyu: '闲鱼.svg', xiaohongshu: '小红书.svg', douyin: '抖音.svg' };
                        var names = { xianyu: '闲鱼', xiaohongshu: '小红书', douyin: '抖音' };
                        if (!files[platform]) return '';
                        var scale = platform === 'xiaohongshu' ? 'style="object-fit:cover;transform:scale(1.2)"' : '';
                        return '<img src="' + base + 'assets/svg/' + files[platform] + '" alt="' + names[platform] + '" class="block ' + (sizeClass || 'w-full h-full') + ' rounded" loading="lazy" ' + scale + '>';
                    }

                    // ========== API 调用 ==========
                    function loadPosts() {
                        var params = new URLSearchParams();
                        if (currentPlatform) params.append('platform', currentPlatform);
                        if (currentStatus) params.append('status', currentStatus);
                        if (currentCategory) params.append('category', currentCategory);
                        if (currentKeyword) params.append('keyword', currentKeyword);
                        params.append('page', currentPage);
                        params.append('pageSize', pageSize);

                        return fetch('/api/platform-posts?' + params.toString())
                            .then(function (r) { return r.json(); })
                            .then(function (res) {
                                if (res.success) {
                                    totalCount = res.data.total;
                                    renderPostList(res.data.list);
                                    renderPagination();
                                    renderTabs();
                                }
                            })
                            .catch(function (err) {
                                console.error('加载发布列表失败:', err);
                            });
                    }

                    function loadOverview() {
                        return fetch('/api/platform-posts/stats/overview')
                            .then(function (r) { return r.json(); })
                            .then(function (res) {
                                if (res.success) {
                                    overviewData = res.data;
                                    renderOverview();
                                    renderSchedule();
                                }
                            })
                            .catch(function (err) {
                                console.error('加载概览失败:', err);
                            });
                    }

                    function deletePost(id) {
                        return fetch('/api/platform-posts/' + id, { method: 'DELETE' })
                            .then(function (r) { return r.json(); });
                    }

                    // ========== 渲染 Tabs ==========
                    function renderTabs() {
                        var counts = { '': totalCount };
                        // 从 overview 获取各平台数量
                        if (overviewData) {
                            counts['xianyu'] = overviewData.xianyu ? overviewData.xianyu.total : 0;
                            counts['xiaohongshu'] = overviewData.xiaohongshu ? overviewData.xiaohongshu.total : 0;
                            counts['douyin'] = overviewData.douyin ? overviewData.douyin.total : 0;
                        }

                        var html = PLATFORMS.map(function (pf) {
                            var isActive = currentPlatform === pf.value;
                            var activeCls = isActive ? 'text-brand-600 font-medium pb-1 border-b-2 border-brand-600'
                                : 'text-gray-500 hover:text-gray-800 font-medium pb-1 border-b-2 border-transparent transition-colors';
                            var count = counts[pf.value] !== undefined ? counts[pf.value] : 0;
                            return '<button onclick="window._platformPage.selectPlatform(\'' + pf.value + '\')" class="' + activeCls + '">' + pf.label + ' (' + count + ')</button>';
                        }).join('');

                        var container = document.getElementById('platform-tabs');
                        if (container) container.innerHTML = html;
                    }

                    // ========== 渲染内容列表 ==========
                    function renderPostList(list) {
                        var container = document.getElementById('post-list');
                        if (!container) return;

                        if (!list || list.length === 0) {
                            container.innerHTML = '<div class="text-center py-16 text-gray-400"><i class="ph ph-package text-4xl mb-3 block"></i><p>暂无发布内容</p></div>';
                            return;
                        }

                        var html = list.map(function (post) {
                            var pf = getPlatformConfig(post.platform);
                            var pfIcon = platformIconHtml(post.platform, 'w-full h-full');

                            var st = STATUS_MAP[post.status] || STATUS_MAP['draft'];
                            var publishInfo = post.publishTime
                                ? '<p class="text-gray-800 text-sm">' + formatDateTime(post.publishTime) + '</p>' +
                                  '<p class="text-gray-400 text-xs mt-0.5">' + (post.publishType === 'scheduled' ? '定时发布' : '已发布') + '</p>'
                                : '<p class="text-gray-400 text-sm">未设置</p>';

                            // 图片缩略图
                            var mediaHtml = '';
                            if (post.videoUrl) {
                                mediaHtml = '<div class="flex gap-2 items-center">' +
                                    '<div class="w-16 h-10 rounded bg-gray-900 border border-gray-200 overflow-hidden relative group cursor-pointer">' +
                                    '<div class="absolute inset-0 flex items-center justify-center">' +
                                    '<div class="w-6 h-6 rounded-full bg-black/50 flex items-center justify-center backdrop-blur-sm">' +
                                    '<i class="ph-fill ph-play text-white text-[10px] ml-0.5"></i></div></div></div>' +
                                    '<span class="text-xs text-gray-400 font-mono bg-gray-100 px-1.5 py-0.5 rounded">' + escapeHtml(post.videoDuration || '') + '</span></div>';
                            } else if (post.images && post.images.length > 0) {
                                var imgHtml = post.images.slice(0, 3).map(function (url) {
                                    return '<div class="w-10 h-10 rounded bg-gray-100 border border-gray-200 overflow-hidden"><img src="' + escapeHtml(url) + '" class="w-full h-full object-cover"></div>';
                                }).join('');
                                var extra = post.images.length > 3 ? '<div class="w-10 h-10 rounded bg-gray-100 border border-gray-200 flex items-center justify-center text-gray-500 text-xs font-medium">+' + (post.images.length - 3) + '</div>' : '';
                                mediaHtml = '<div class="flex gap-1.5">' + imgHtml + extra + '</div>';
                            }

                            // 操作按钮
                            var actionBtns = post.status === 'published'
                                ? '<a href="#" onclick="window._platformPage.viewStats(\'' + post.id + '\');return false;" class="hover:underline">数据</a>' +
                                  '<a href="#" onclick="window._platformPage.editPost(\'' + post.id + '\');return false;" class="hover:underline">编辑</a>'
                                : '<a href="#" onclick="window._platformPage.editPost(\'' + post.id + '\');return false;" class="hover:underline">编辑</a>' +
                                  '<a href="#" onclick="window._platformPage.duplicatePost(\'' + post.id + '\');return false;" class="hover:underline">复制</a>';
                            var moreBtn = '<a href="#" onclick="window._platformPage.deletePost(\'' + post.id + '\');return false;" class="hover:underline text-red-500">删除</a>';

                            return '<div class="grid grid-cols-12 gap-4 px-6 py-5 border-b border-gray-50 items-start hover:bg-gray-50/50 transition-colors">' +
                                '<div class="col-span-5 flex gap-3">' +
                                '<div class="w-6 h-6 rounded overflow-hidden flex-shrink-0 mt-0.5">' + pfIcon + '</div>' +
                                '<div class="flex-1 min-w-0">' +
                                '<h4 class="font-bold text-gray-800 text-sm mb-1 truncate">' + escapeHtml(post.title) + '</h4>' +
                                (post.content ? '<p class="text-gray-500 text-xs line-clamp-1 mb-2">' + escapeHtml(post.content) + '</p>' : '') +
                                mediaHtml +
                                '</div></div>' +
                                '<div class="col-span-2 text-gray-700 text-sm mt-0.5">' + escapeHtml(post.category || '未分类') + '</div>' +
                                '<div class="col-span-2 mt-0.5">' + publishInfo + '</div>' +
                                '<div class="col-span-1 mt-0.5"><span class="px-2 py-0.5 rounded text-xs font-medium border ' + st.cls + '">' + st.label + '</span></div>' +
                                '<div class="col-span-2 flex items-start justify-center gap-3 mt-0.5 text-brand-600 text-sm">' + actionBtns + moreBtn + '</div>' +
                                '</div>';
                        }).join('');

                        container.innerHTML = html;
                    }

                    // ========== 渲染分页 ==========
                    function renderPagination() {
                        var container = document.getElementById('pagination-bar');
                        if (!container) return;

                        var totalPages = Math.ceil(totalCount / pageSize) || 1;
                        var html = '<div>共 ' + totalCount + ' 条</div><div class="flex items-center gap-2">';

                        // 上一页
                        html += '<button onclick="window._platformPage.goPage(' + (currentPage - 1) + ')" class="w-8 h-8 rounded flex items-center justify-center border ' + (currentPage <= 1 ? 'border-gray-200 text-gray-300' : 'border-gray-200 hover:bg-gray-50 text-gray-600') + '"' + (currentPage <= 1 ? ' disabled' : '') + '><i class="ph ph-caret-left"></i></button>';

                        // 页码
                        var startPage = Math.max(1, currentPage - 2);
                        var endPage = Math.min(totalPages, startPage + 4);
                        if (startPage > 1) startPage = Math.max(1, endPage - 4);

                        for (var i = startPage; i <= endPage; i++) {
                            var isActive = i === currentPage;
                            html += '<button onclick="window._platformPage.goPage(' + i + ')" class="w-8 h-8 rounded flex items-center justify-center ' + (isActive ? 'border border-brand-500 bg-brand-50 text-brand-600 font-medium' : 'hover:bg-gray-50') + '">' + i + '</button>';
                        }

                        // 下一页
                        html += '<button onclick="window._platformPage.goPage(' + (currentPage + 1) + ')" class="w-8 h-8 rounded flex items-center justify-center border ' + (currentPage >= totalPages ? 'border-gray-200 text-gray-300' : 'border-gray-200 hover:bg-gray-50 text-gray-600') + '"' + (currentPage >= totalPages ? ' disabled' : '') + '><i class="ph ph-caret-right"></i></button>';

                        html += '<select onchange="window._platformPage.setPageSize(this.value)" class="ml-2 border border-gray-200 rounded px-2 py-1 bg-white outline-none"><option value="10"' + (pageSize === 10 ? ' selected' : '') + '>10条/页</option><option value="20"' + (pageSize === 20 ? ' selected' : '') + '>20条/页</option><option value="50"' + (pageSize === 50 ? ' selected' : '') + '>50条/页</option></select>';

                        html += '</div>';
                        container.innerHTML = html;
                    }

                    // ========== 渲染概览 ==========
                    function renderOverview() {
                        var container = document.getElementById('overview-stats');
                        if (!container || !overviewData) return;

                        var platforms = [
                            { key: 'xianyu', label: '闲鱼' },
                            { key: 'xiaohongshu', label: '小红书' },
                            { key: 'douyin', label: '抖音' }
                        ];

                        var html = platforms.map(function (pf) {
                            var d = overviewData[pf.key] || { total: 0, published: 0, totalViews: 0, totalRevenue: 0 };
                            return '<div class="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">' +
                                '<div class="w-8 h-8 rounded overflow-hidden flex-shrink-0">' + platformIconHtml(pf.key, 'w-full h-full') + '</div>' +
                                '<div class="flex-1 min-w-0">' +
                                '<div class="flex items-center justify-between mb-1">' +
                                '<span class="text-sm font-medium text-gray-700">' + pf.label + '</span>' +
                                '<span class="text-xs text-gray-400">' + d.published + '/' + d.total + ' 已发布</span>' +
                                '</div>' +
                                '<div class="flex items-center gap-3 text-[10px] text-gray-400">' +
                                '<span><i class="ph ph-eye"></i> ' + formatNumber(d.totalViews) + '</span>' +
                                '<span><i class="ph ph-currency-cny"></i> ' + formatNumber(d.totalRevenue) + '</span>' +
                                '</div></div></div>';
                        }).join('');

                        // 总计
                        var allData = overviewData.all || { total: 0, published: 0 };
                        html = '<div class="flex items-center justify-between p-3 bg-brand-50 rounded-lg mb-2">' +
                            '<span class="text-sm font-medium text-brand-700">全部平台</span>' +
                            '<span class="text-xs text-brand-600">' + allData.published + '/' + allData.total + ' 已发布</span>' +
                            '</div>' + html;

                        container.innerHTML = html;
                    }

                    // ========== 渲染计划发布 ==========
                    function renderSchedule() {
                        var container = document.getElementById('schedule-list');
                        if (!container) return;

                        // 从 API 获取 pending 状态的帖子
                        fetch('/api/platform-posts?status=pending&pageSize=5')
                            .then(function (r) { return r.json(); })
                            .then(function (res) {
                                if (res.success && res.data.list.length > 0) {
                                    var html = res.data.list.map(function (post) {
                                        var pf = getPlatformConfig(post.platform);
                                        var time = formatTime(post.publishTime);
                                        return '<div class="flex items-center gap-3">' +
                                            '<span class="text-xs font-medium text-gray-800 w-9">' + time + '</span>' +
                                            '<span class="w-5 h-5 rounded overflow-hidden flex-shrink-0">' + platformIconHtml(post.platform, 'w-full h-full') + '</span>' +
                                            '<span class="text-xs text-gray-600 truncate flex-1">' + escapeHtml(post.title) + '</span>' +
                                            '<span class="text-[10px] text-orange-500 font-medium">待发布</span>' +
                                            '</div>';
                                    }).join('');
                                    container.innerHTML = html;
                                } else {
                                    container.innerHTML = '<div class="text-center py-4 text-xs text-gray-400">暂无计划发布的任务</div>';
                                }
                            })
                            .catch(function () {
                                container.innerHTML = '<div class="text-center py-4 text-xs text-gray-400">加载失败</div>';
                            });
                    }

                    // ========== 渲染分类筛选 ==========
                    function renderCategoryFilter(categories) {
                        var select = document.getElementById('filter-category');
                        if (!select) return;
                        var html = '<option value="">全部类目</option>';
                        categories.forEach(function (cat) {
                            html += '<option value="' + escapeHtml(cat) + '"' + (currentCategory === cat ? ' selected' : '') + '>' + escapeHtml(cat) + '</option>';
                        });
                        select.innerHTML = html;
                    }

                    // ========== 加载分类列表 ==========
                    function loadCategories() {
                        fetch('/api/platform-posts?pageSize=100')
                            .then(function (r) { return r.json(); })
                            .then(function (res) {
                                if (res.success) {
                                    var cats = {};
                                    res.data.list.forEach(function (p) {
                                        if (p.category) cats[p.category] = true;
                                    });
                                    renderCategoryFilter(Object.keys(cats).sort());
                                }
                            })
                            .catch(function () {});
                    }

                    // ========== 操作函数 ==========
                    function selectPlatform(value) {
                        currentPlatform = value;
                        currentPage = 1;
                        loadPosts();
                    }

                    function goPage(page) {
                        var totalPages = Math.ceil(totalCount / pageSize) || 1;
                        if (page < 1 || page > totalPages) return;
                        currentPage = page;
                        loadPosts();
                    }

                    function setPageSize(size) {
                        pageSize = parseInt(size) || 10;
                        currentPage = 1;
                        loadPosts();
                    }

                    function editPost(id) {
                        // 跳转到对应平台编辑页（后续可扩展为弹窗编辑）
                        showToast('编辑功能开发中');
                    }

                    function viewStats(id) {
                        showToast('数据详情开发中');
                    }

                    function duplicatePost(id) {
                        // 复制：获取原帖数据，创建一条新记录
                        fetch('/api/platform-posts/' + id)
                            .then(function (r) { return r.json(); })
                            .then(function (res) {
                                if (res.success) {
                                    var orig = res.data;
                                    return fetch('/api/platform-posts', {
                                        method: 'POST',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({
                                            title: orig.title + ' [副本]',
                                            platform: orig.platform,
                                            category: orig.category,
                                            content: orig.content,
                                            images: orig.images || [],
                                            videoUrl: orig.videoUrl || '',
                                            videoDuration: orig.videoDuration || '',
                                            publishType: 'manual',
                                            status: 'draft',
                                            stats: { views: 0, likes: 0, comments: 0, shares: 0, inquiries: 0, revenue: 0 },
                                            tags: orig.tags || []
                                        })
                                    });
                                }
                            })
                            .then(function (r) { return r.json(); })
                            .then(function (res) {
                                if (res && res.success) {
                                    showToast('已复制为新草稿');
                                    loadPosts();
                                    loadOverview();
                                }
                            })
                            .catch(function (err) {
                                console.error('复制失败:', err);
                                showToast('复制失败');
                            });
                    }

                    function deletePostConfirm(id) {
                        if (!confirm('确定要删除这条发布记录吗？')) return;
                        deletePost(id).then(function (res) {
                            if (res.success) {
                                showToast('已删除');
                                loadPosts();
                                loadOverview();
                            } else {
                                showToast(res.error || '删除失败');
                            }
                        }).catch(function (err) {
                            console.error('删除失败:', err);
                            showToast('删除失败');
                        });
                    }

                    // ========== Toast ==========
                    function showToast(msg) {
                        var existing = document.getElementById('platform-toast');
                        if (existing) existing.remove();
                        var toast = document.createElement('div');
                        toast.id = 'platform-toast';
                        toast.className = 'fixed bottom-6 left-1/2 -translate-x-1/2 z-[99999] px-4 py-2 bg-gray-800 text-white text-sm rounded-lg shadow-lg transition-all duration-300';
                        toast.style.opacity = '0';
                        toast.textContent = msg;
                        document.body.appendChild(toast);
                        requestAnimationFrame(function () { toast.style.opacity = '1'; });
                        setTimeout(function () {
                            toast.style.opacity = '0';
                            setTimeout(function () { toast.remove(); }, 300);
                        }, 2000);
                    }

                    // ========== 事件绑定 ==========
                    function bindEvents() {
                        if (eventsBound) return;
                        eventsBound = true;

                        var statusSelect = document.getElementById('filter-status');
                        if (statusSelect) {
                            statusSelect.addEventListener('change', function () {
                                currentStatus = statusSelect.value;
                                currentPage = 1;
                                loadPosts();
                            });
                        }

                        var catSelect = document.getElementById('filter-category');
                        if (catSelect) {
                            catSelect.addEventListener('change', function () {
                                currentCategory = catSelect.value;
                                currentPage = 1;
                                loadPosts();
                            });
                        }

                        var searchInput = document.getElementById('search-input');
                        if (searchInput) {
                            var searchTimer = null;
                            searchInput.addEventListener('input', function () {
                                if (searchTimer) clearTimeout(searchTimer);
                                searchTimer = setTimeout(function () {
                                    currentKeyword = searchInput.value.trim();
                                    currentPage = 1;
                                    loadPosts();
                                }, 300);
                            });
                        }
                    }

                    // ========== 初始化 ==========
                    function init() {
                        bindEvents();
                        loadCategories();
                        loadOverview();
                        loadPosts();
                    }

                    // 暴露给 onclick 使用
                    window._platformPage = {
                        selectPlatform: selectPlatform,
                        goPage: goPage,
                        setPageSize: setPageSize,
                        editPost: editPost,
                        viewStats: viewStats,
                        duplicatePost: duplicatePost,
                        deletePost: deletePostConfirm
                    };

                    // SPA ready
                    window.addEventListener('spa:ready', function (e) {
                        var page = (e.detail && e.detail.page) || '';
                        if (page && page.indexOf('platform') === -1) return;
                        init();
                    });

                    if (document.readyState === 'loading') {
                        document.addEventListener('DOMContentLoaded', init);
                    } else {
                        init();
                    }
                })();

                /* ==================== 原始脚本结束 ==================== */
            } finally {
                document.addEventListener = _docAdd;
                window.addEventListener = _winAdd;
            }
        }
    });

})(typeof window !== 'undefined' ? window : this);
