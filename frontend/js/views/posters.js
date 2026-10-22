/**
 * 宣传海报 视图
 *
 * 自动迁移自 frontend/pages/content/posters.html
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

    App.view('posters', {
        path: '/posters',
        nav: 'posters.html',
        title: '宣传海报',
        template: 'views/posters.html',

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

                (function () {
                    'use strict';

                    // SPA 实例 ID，防止多次导航后事件监听器累积
                    var instanceId = 'posters_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
                    window.__postersActiveInstance = instanceId;

                    // 页面状态
                    var state = {
                        platform: '',   // 当前平台筛选
                        label: '',      // 当前标签筛选
                        posters: [],    // 当前页所有海报数据（可能已筛选）
                        labels: [],     // 标签分类数据
                        total: 0        // 海报总数（不受 label 筛选影响）
                    };

                    // ===================== 工具函数 =====================

                    var escapeHtml = App.dom.escapeHtml;

                    function rgbToHex(color) {
                        if (!color) return '#10b981';
                        if (color.charAt(0) === '#') return color;
                        var match = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
                        if (!match) return '#10b981';
                        return '#' + [match[1], match[2], match[3]].map(function (value) {
                            return Math.max(0, Math.min(255, parseInt(value, 10)))
                                .toString(16)
                                .padStart(2, '0');
                        }).join('');
                    }

                    function hexToRgba(hex, alpha) {
                        if (!/^#[0-9a-fA-F]{6}$/.test(hex || '')) hex = '#10b981';
                        var r = parseInt(hex.slice(1, 3), 16);
                        var g = parseInt(hex.slice(3, 5), 16);
                        var b = parseInt(hex.slice(5, 7), 16);
                        return 'rgba(' + r + ',' + g + ',' + b + ',' + alpha + ')';
                    }

                    // 获取 SVG 图标绝对路径
                    // 获取 SVG 图标绝对路径
                    function svgIconUrl(platform) {
                        var base = window.ROOT_URL || window.PAGE_BASE || '';
                        var files = {
                            xianyu: '闲鱼.svg',
                            xiaohongshu: '小红书.svg',
                            douyin: '抖音.svg',
                            wechat: '微信.svg'
                        };
                        return base + 'assets/svg/' + files[platform];
                    }

                    function platformBadgeHtml(platform) {
                        // 闲鱼、小红书、抖音、微信使用本地 SVG 图标
                        if (platform === 'xianyu' || platform === 'xiaohongshu' || platform === 'douyin' || platform === 'wechat') {
                            var scale = (platform === 'xiaohongshu' || platform === 'wechat') ? 'transform: scale(1.2);' : '';
                            return '<div class="w-5 h-5 rounded overflow-hidden flex-shrink-0" data-platform="' + platform + '">' +
                                '<img src="' + escapeHtml(svgIconUrl(platform)) + '" alt="' + platform + '" class="block w-full h-full" style="object-fit: cover;' + scale + '" loading="lazy"></div>';
                        }
                        var badges = {
                            other: '<div class="w-5 h-5 rounded bg-blue-50 text-blue-500 flex flex-shrink-0 items-center justify-center text-[10px] font-bold" data-platform="other">其</div>'
                        };
                        return badges[platform] || badges.other;
                    }

                    // ===================== 视觉区 HTML 构建 =====================

                    function placeholderVisualHtml() {
                        return [
                            '<div class="relative aspect-[3/4] bg-gray-100 overflow-hidden">',
                            '  <div class="absolute inset-0 bg-gray-900/60 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-center items-center gap-3 z-10 backdrop-blur-[2px]">',
                            '    <button class="poster-view-btn bg-white text-gray-800 hover:bg-brand-50 hover:text-brand-600 px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors transform translate-y-4 group-hover:translate-y-0 duration-300"><i class="ph ph-arrows-out-simple"></i> 查看大图</button>',
                            '    <button class="poster-edit-btn bg-white text-gray-800 hover:bg-brand-50 hover:text-brand-600 px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors transform translate-y-4 group-hover:translate-y-0 duration-300 delay-75"><i class="ph ph-pencil-simple"></i> 继续编辑</button>',
                            '  </div>',
                            '  <div class="absolute inset-0 border-2 border-dashed border-gray-300 m-4 rounded-xl flex flex-col items-center justify-center text-gray-400">',
                            '    <i class="ph ph-image text-4xl mb-2 text-gray-300"></i>',
                            '    <span class="text-xs font-medium">排版设计中...</span>',
                            '    <div class="mt-4 w-3/4 h-2 bg-gray-200 rounded"></div>',
                            '    <div class="mt-2 w-1/2 h-2 bg-gray-200 rounded"></div>',
                            '  </div>',
                            '</div>'
                        ].join('');
                    }

                    function imageVisualHtml(src) {
                        return [
                            '<div class="relative aspect-[3/4] bg-gray-100 overflow-hidden">',
                            '  <div class="absolute inset-0 bg-gray-900/60 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-center items-center gap-3 z-10 backdrop-blur-[2px]">',
                            '    <button class="poster-view-btn bg-white text-gray-800 hover:bg-brand-50 hover:text-brand-600 px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors transform translate-y-4 group-hover:translate-y-0 duration-300"><i class="ph ph-arrows-out-simple"></i> 查看大图</button>',
                            '    <button class="poster-download-btn bg-white text-gray-800 hover:bg-brand-50 hover:text-brand-600 px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors transform translate-y-4 group-hover:translate-y-0 duration-300 delay-75"><i class="ph ph-download-simple"></i> 下载原图</button>',
                            '    <button class="poster-edit-btn bg-transparent border border-white/50 text-white hover:bg-white/10 hover:border-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors transform translate-y-4 group-hover:translate-y-0 duration-300 delay-100"><i class="ph ph-pencil-simple"></i> 编辑信息</button>',
                            '  </div>',
                            '  <img src="' + escapeHtml(src) + '" alt="海报预览" class="absolute inset-0 w-full h-full object-cover">',
                            '</div>'
                        ].join('');
                    }

                    function visualHtmlFromData(data) {
                        if (data && data.image) return imageVisualHtml(data.image);
                        if (data && data.imageHtml) return data.imageHtml;
                        return placeholderVisualHtml();
                    }

                    function buildPosterCardHtml(data) {
                        var labelColor = rgbToHex(data.labelColor || '#10b981');
                        var dateText = data.onlineDate || (data.updatedAt ? data.updatedAt.slice(0, 10) : '刚刚');
                        var title = escapeHtml(data.title || '未命名海报');
                        var labelText = escapeHtml(data.labelText || '自定义标签');
                        var isPlaceholder = !data.image && !data.imageHtml;
                        var cardClass = 'bg-white rounded-xl border border-gray-100 overflow-hidden transition-all duration-300 hover:shadow-hover hover:-translate-y-1 flex flex-col group relative';
                        if (isPlaceholder) cardClass += ' opacity-80 hover:opacity-100';
                        return [
                            '<div class="' + cardClass + '" data-poster-id="' + escapeHtml(data.id || '') + '">',
                            '  <div class="absolute top-3 left-3 z-20">',
                            '    <input type="checkbox" class="w-4 h-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500 bg-white cursor-pointer shadow-sm opacity-0 group-hover:opacity-100 transition-opacity">',
                            '  </div>',
                            visualHtmlFromData(data),
                            '  <div class="p-4 border-t border-gray-50 flex flex-col justify-between flex-1 bg-white relative z-20">',
                            '    <div>',
                            '      <div class="flex justify-between items-start mb-1">',
                            '        <h4 class="font-semibold text-gray-800 text-sm truncate pr-2">' + title + '</h4>',
                            platformBadgeHtml(data.platform),
                            '      </div>',
                            '      <p class="text-xs text-gray-400 mb-2">更新于 ' + escapeHtml(dateText) + '</p>',
                            '    </div>',
                            '    <div class="flex items-center justify-between mt-2">',
                            '      <span class="poster-custom-label px-2 py-0.5 rounded text-[10px] font-medium border inline-block" style="color:' + labelColor + ';background-color:' + hexToRgba(labelColor, 0.1) + ';border-color:' + hexToRgba(labelColor, 0.28) + '">' + labelText + '</span>',
                            '      <div class="poster-card-actions flex items-center gap-1.5">',
                            '        <button type="button" class="poster-pin-btn w-7 h-7 rounded-md border border-gray-200 text-gray-400 hover:text-brand-600 hover:border-brand-200 hover:bg-brand-50 transition flex items-center justify-center" title="置顶">',
                            '          <i class="ph ph-push-pin-simple text-sm"></i>',
                            '        </button>',
                            '        <button type="button" class="poster-delete-btn w-7 h-7 rounded-md border border-gray-200 text-gray-400 hover:text-red-500 hover:border-red-200 hover:bg-red-50 transition flex items-center justify-center" title="删除">',
                            '          <i class="ph ph-trash text-sm"></i>',
                            '        </button>',
                            '      </div>',
                            '    </div>',
                            '  </div>',
                            '</div>'
                        ].join('');
                    }

                    // ===================== 大图预览 =====================

                    function buildPosterPreviewHtml(card) {
                        var visual = card ? card.querySelector('.aspect-\\[3\\/4\\]') : null;
                        if (!visual) return '';
                        var clone = visual.cloneNode(true);
                        clone.querySelectorAll('.opacity-0').forEach(function (el) { el.remove(); });
                        clone.classList.remove('overflow-hidden');
                        clone.classList.add('w-full', 'h-full', 'rounded-xl', 'shadow-2xl');
                        return clone.outerHTML;
                    }

                    function closePosterPreview() {
                        var modal = document.getElementById('poster-preview-modal');
                        if (!modal) return;
                        if (modal._cleanup) modal._cleanup();
                        modal.remove();
                        document.body.style.overflow = '';
                    }

                    function openPosterPreview(poster, card) {
                        var data = poster || {};
                        if (!data.image && !data.imageHtml) {
                            var fallbackHtml = buildPosterPreviewHtml(card);
                            if (!fallbackHtml) return;
                        }
                        closePosterPreview();

                        var title = data.title || (card && card.querySelector('h4.font-semibold') ? card.querySelector('h4.font-semibold').textContent.trim() : '海报预览');

                        // 构建内容元素
                        var contentHtml = '';
                        if (data.image) {
                            contentHtml = '<img id="poster-preview-img" src="' + escapeHtml(data.image) + '" alt="' + escapeHtml(title) + '" class="block max-w-none select-none pointer-events-none" draggable="false">';
                        } else if (data.imageHtml) {
                            contentHtml = '<div id="poster-preview-content" class="select-none pointer-events-none">' + data.imageHtml + '</div>';
                        } else {
                            contentHtml = '<div id="poster-preview-content" class="select-none pointer-events-none">' + fallbackHtml + '</div>';
                        }

                        // 根据海报比例确定容器尺寸
                        var ratio = data.ratio || '3/4';
                        var ratioClass = ratio === '1/1' ? 'aspect-square' : 'aspect-[3/4]';

                        var modal = document.createElement('div');
                        modal.id = 'poster-preview-modal';
                        modal.className = 'fixed inset-0 z-[10000] bg-black/30 flex items-center justify-center p-8';
                        modal.innerHTML = [
                            '<div id="pp-viewport" class="relative h-[80vh] ' + ratioClass + ' max-w-full cursor-grab active:cursor-grabbing">',
                            '  <div id="pp-transform-wrap" class="absolute top-1/2 left-1/2 origin-center" style="will-change: transform;">',
                            '    ' + contentHtml,
                            '  </div>',
                            '</div>',
                            '<span id="pp-zoom-label" class="fixed bottom-6 left-1/2 -translate-x-1/2 text-gray-700 text-xs font-medium bg-white/80 px-3 py-1 rounded-full pointer-events-none z-10">100%</span>'
                        ].join('');

                        document.body.appendChild(modal);
                        document.body.style.overflow = 'hidden';

                        // ====== 缩放与拖拽逻辑 ======
                        var scale = 1;
                        var minScale = 0.2;
                        var maxScale = 3;
                        var tx = 0;
                        var ty = 0;
                        var isDragging = false;
                        var dragStartX = 0;
                        var dragStartY = 0;
                        var startTx = 0;
                        var startTy = 0;

                        var viewport = modal.querySelector('#pp-viewport');
                        var wrap = modal.querySelector('#pp-transform-wrap');
                        var zoomLabel = modal.querySelector('#pp-zoom-label');

                        function applyTransform(animate) {
                            wrap.style.transition = animate ? 'transform 0.2s ease-out' : 'none';
                            wrap.style.transform = 'translate(-50%, -50%) translate(' + tx + 'px, ' + ty + 'px) scale(' + scale + ')';
                            zoomLabel.textContent = Math.round(scale * 100) + '%';
                        }

                        // 初始：根据图片实际尺寸自适应到适合视口大小
                        function fitToViewport() {
                            var img = modal.querySelector('#poster-preview-img');
                            var content = modal.querySelector('#poster-preview-content');
                            var naturalW = 0, naturalH = 0;

                            if (img) {
                                naturalW = img.naturalWidth || img.offsetWidth;
                                naturalH = img.naturalHeight || img.offsetHeight;
                            } else if (content) {
                                naturalW = content.offsetWidth;
                                naturalH = content.offsetHeight;
                            }

                            if (!naturalW || !naturalH) return;

                            var vw = viewport.clientWidth;
                            var vh = viewport.clientHeight;
                            var fit = Math.min(vw / naturalW, vh / naturalH, 1);
                            scale = fit < minScale ? minScale : fit;
                            if (img) {
                                img.style.width = naturalW + 'px';
                                img.style.height = naturalH + 'px';
                            }
                            applyTransform(false);
                        }

                        var imgEl = modal.querySelector('#poster-preview-img');
                        if (imgEl) {
                            if (imgEl.complete && imgEl.naturalWidth) {
                                fitToViewport();
                            } else {
                                imgEl.addEventListener('load', fitToViewport);
                                imgEl.addEventListener('error', function () { applyTransform(false); });
                            }
                        } else {
                            requestAnimationFrame(fitToViewport);
                        }

                        // 滚轮缩放（以鼠标位置为缩放中心）
                        viewport.addEventListener('wheel', function (e) {
                            e.preventDefault();
                            var delta = e.deltaY < 0 ? 1.12 : 1 / 1.12;
                            var newScale = Math.max(minScale, Math.min(maxScale, scale * delta));
                            if (newScale === scale) return;

                            var rect = viewport.getBoundingClientRect();
                            var mx = e.clientX - rect.left - rect.width / 2;
                            var my = e.clientY - rect.top - rect.height / 2;
                            tx = mx - (mx - tx) * (newScale / scale);
                            ty = my - (my - ty) * (newScale / scale);
                            scale = newScale;
                            applyTransform(false);
                        }, { passive: false });

                        // 拖拽平移
                        viewport.addEventListener('mousedown', function (e) {
                            if (e.button !== 0) return;
                            isDragging = true;
                            dragStartX = e.clientX;
                            dragStartY = e.clientY;
                            startTx = tx;
                            startTy = ty;
                            viewport.style.cursor = 'grabbing';
                            e.preventDefault();
                        });

                        document.addEventListener('mousemove', onDragMove);
                        function onDragMove(e) {
                            if (!isDragging) return;
                            tx = startTx + (e.clientX - dragStartX);
                            ty = startTy + (e.clientY - dragStartY);
                            applyTransform(false);
                        }

                        document.addEventListener('mouseup', onDragEnd);
                        function onDragEnd() {
                            if (!isDragging) return;
                            isDragging = false;
                            viewport.style.cursor = 'grab';
                        }

                        // 触摸支持
                        var touchStartX = 0, touchStartY = 0, touchStartTx = 0, touchStartStartTy = 0;
                        var lastTouchDist = 0;
                        viewport.addEventListener('touchstart', function (e) {
                            if (e.touches.length === 1) {
                                touchStartX = e.touches[0].clientX;
                                touchStartY = e.touches[0].clientY;
                                touchStartTx = tx;
                                touchStartStartTy = ty;
                            } else if (e.touches.length === 2) {
                                lastTouchDist = Math.hypot(
                                    e.touches[0].clientX - e.touches[1].clientX,
                                    e.touches[0].clientY - e.touches[1].clientY
                                );
                            }
                        }, { passive: true });

                        viewport.addEventListener('touchmove', function (e) {
                            if (e.touches.length === 1) {
                                tx = touchStartTx + (e.touches[0].clientX - touchStartX);
                                ty = touchStartStartTy + (e.touches[0].clientY - touchStartY);
                                applyTransform(false);
                                e.preventDefault();
                            } else if (e.touches.length === 2) {
                                var dist = Math.hypot(
                                    e.touches[0].clientX - e.touches[1].clientX,
                                    e.touches[0].clientY - e.touches[1].clientY
                                );
                                if (lastTouchDist > 0) {
                                    var newScale = Math.max(minScale, Math.min(maxScale, scale * (dist / lastTouchDist)));
                                    scale = newScale;
                                    applyTransform(false);
                                }
                                lastTouchDist = dist;
                                e.preventDefault();
                            }
                        }, { passive: false });

                        // 点击图片外区域关闭
                        modal.addEventListener('click', function (e) {
                            if (e.target === modal) closePosterPreview();
                        });

                        // 清理
                        modal._cleanup = function () {
                            document.removeEventListener('mousemove', onDragMove);
                            document.removeEventListener('mouseup', onDragEnd);
                        };
                    }

                    // ===================== API 调用 =====================

                    function api(url, options) {
                        options = options || {};
                        options.signal = ctx.signal;
                        return global.api.call(url, options);
                    }

                    // ===================== Toast 提示 =====================

                    function showToast(msg, type) {
                        App.ui.toast(msg, type || 'success');
                    }

                    // ===================== 从后端加载海报列表 =====================

                    function loadPosters(initTabs) {
                        var grid = document.getElementById('posters-grid');
                        if (!grid) return;

                        grid.innerHTML = '<div class="col-span-full py-20 text-center text-gray-400"><i class="ph ph-spinner animate-spin text-2xl block mb-2"></i>加载中...</div>';

                        var params = new URLSearchParams();
                        if (state.platform) params.set('platform', state.platform);
                        if (state.label) params.set('label', state.label);

                        api('/api/posters?' + params.toString()).then(function (res) {
                            if (window.__postersActiveInstance !== instanceId) return;
                            if (!res.success) {
                                grid.innerHTML = '<div class="col-span-full py-20 text-center text-red-400"><i class="ph ph-warning-circle text-2xl block mb-2"></i>加载失败</div>';
                                return;
                            }
                            state.posters = res.data || [];
                            renderPosters(state.posters);
                            // 首次加载或需要刷新 tabs 时，从海报数据生成标签分类
                            if (initTabs) {
                                renderTabsFromPosters();
                            }
                        }).catch(function (err) {
                            console.error('[Posters] 加载失败:', err);
                            if (window.__postersActiveInstance !== instanceId) return;
                            grid.innerHTML = '<div class="col-span-full py-20 text-center text-red-400"><i class="ph ph-warning-circle text-2xl block mb-2"></i>加载失败，请检查后端服务是否启动</div>';
                        });
                    }

                    // ===================== 渲染海报列表 =====================

                    function renderPosters(list) {
                        var grid = document.getElementById('posters-grid');
                        if (!grid) return;
                        if (!list.length) {
                            grid.innerHTML = '<div class="col-span-full py-20 text-center text-gray-400"><i class="ph ph-image text-4xl block mb-3 text-gray-300"></i>暂无海报数据</div>';
                            return;
                        }
                        grid.innerHTML = list.map(function (p) {
                            return buildPosterCardHtml(p);
                        }).join('');
                        bindCardActions();
                    }

                    // ===================== 标签分类 Tabs =====================

                    function loadLabels() {
                        var params = new URLSearchParams();
                        if (state.platform) params.set('platform', state.platform);

                        api('/api/posters/labels?' + params.toString()).then(function (res) {
                            if (window.__postersActiveInstance !== instanceId) return;
                            if (!res.success) return;
                            state.labels = res.data || [];
                            // 计算总数（所有标签计数之和）
                            state.total = state.labels.reduce(function (sum, l) { return sum + l.count; }, 0);
                            renderTabs();
                        }).catch(function (err) {
                            console.error('[Posters] 标签加载失败:', err);
                            // 后端不支持时，从海报数据兑底生成
                            if (state.posters.length) {
                                renderTabsFromPosters();
                            }
                        });
                    }

                    // 兑底：从海报数据中生成标签统计
                    function renderTabsFromPosters() {
                        var labelMap = {};
                        state.posters.forEach(function (p) {
                            var label = p.labelText || '自定义标签';
                            if (!labelMap[label]) {
                                labelMap[label] = { label: label, count: 0, color: p.labelColor || '#10b981' };
                            }
                            labelMap[label].count++;
                        });
                        state.labels = Object.values(labelMap)
                            .sort(function (a, b) { return b.count - a.count; })
                            .slice(0, 7);
                        state.total = state.posters.length;
                        renderTabs();
                    }

                    function renderTabs() {
                        var container = document.getElementById('poster-tabs');
                        if (!container) return;

                        // 如果当前选中的标签不在列表中了，重置为空（全部）
                        if (state.label && !state.labels.some(function (l) { return l.label === state.label; })) {
                            state.label = '';
                        }

                        var html = '<button data-tab-label="" class="poster-tab px-4 py-1.5 ' + (state.label === '' ? 'bg-white shadow-sm text-gray-800' : 'text-gray-500 hover:text-gray-800') + ' rounded-md text-sm font-medium transition-colors">全部海报 (' + state.total + ')</button>';

                        state.labels.forEach(function (item) {
                            var active = state.label === item.label;
                            html += '<button data-tab-label="' + escapeHtml(item.label) + '" class="poster-tab px-4 py-1.5 ' + (active ? 'bg-white shadow-sm text-gray-800' : 'text-gray-500 hover:text-gray-800') + ' rounded-md text-sm font-medium transition-colors">' + escapeHtml(item.label) + ' (' + item.count + ')</button>';
                        });

                        container.innerHTML = html;
                        bindTabClicks();
                    }

                    function bindTabClicks() {
                        var container = document.getElementById('poster-tabs');
                        if (!container) return;
                        container.querySelectorAll('.poster-tab').forEach(function (btn) {
                            if (btn.dataset.bound) return;
                            btn.dataset.bound = '1';
                            btn.addEventListener('click', function (e) {
                                e.preventDefault();
                                state.label = btn.getAttribute('data-tab-label') || '';
                                renderTabs();
                                loadPosters();
                            });
                        });
                    }

                    // ===================== 卡片事件绑定（事件委托） =====================

                    function findPosterById(id) {
                        return state.posters.find(function (p) { return p.id === id; }) || null;
                    }

                    function bindCardActions() {
                        var cards = document.querySelectorAll('#posters-grid > div[data-poster-id]');
                        cards.forEach(function (card) {
                            var id = card.getAttribute('data-poster-id');
                            var poster = findPosterById(id) || {};

                            // 查看大图
                            var viewBtn = card.querySelector('.poster-view-btn');
                            if (viewBtn && !viewBtn.dataset.bound) {
                                viewBtn.dataset.bound = '1';
                                viewBtn.addEventListener('click', function (e) {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    openPosterPreview(poster, card);
                                });
                            }

                            // 编辑信息
                            card.querySelectorAll('.poster-edit-btn').forEach(function (btn) {
                                if (btn.dataset.bound) return;
                                btn.dataset.bound = '1';
                                btn.addEventListener('click', function (e) {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    if (window.openPosterForm) window.openPosterForm(poster);
                                });
                            });

                            // 下载原图
                            card.querySelectorAll('.poster-download-btn').forEach(function (btn) {
                                if (btn.dataset.bound) return;
                                btn.dataset.bound = '1';
                                btn.addEventListener('click', function (e) {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    if (poster.image) {
                                        var link = document.createElement('a');
                                        link.href = poster.image;
                                        link.download = poster.title || 'poster';
                                        document.body.appendChild(link);
                                        link.click();
                                        link.remove();
                                    } else {
                                        showToast('该海报暂无图片文件');
                                    }
                                });
                            });

                            // 置顶
                            var pinBtn = card.querySelector('.poster-pin-btn');
                            if (pinBtn && !pinBtn.dataset.bound) {
                                pinBtn.dataset.bound = '1';
                                pinBtn.addEventListener('click', function (e) {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    pinPoster(id);
                                });
                            }

                            // 删除
                            var deleteBtn = card.querySelector('.poster-delete-btn');
                            if (deleteBtn && !deleteBtn.dataset.bound) {
                                deleteBtn.dataset.bound = '1';
                                deleteBtn.addEventListener('click', function (e) {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    showDeleteConfirm(id, poster.title || '此海报');
                                });
                            }
                        });
                    }

                    // ===================== 置顶海报 =====================

                    function pinPoster(id) {
                        var maxSort = state.posters.reduce(function (max, p) {
                            return Math.max(max, p.sortOrder || 0);
                        }, 0);
                        api('/api/posters/' + encodeURIComponent(id), {
                            method: 'PUT',
                            body: { sortOrder: maxSort + 1 }
                        }).then(function (res) {
                            if (window.__postersActiveInstance !== instanceId) return;
                            if (res.success) {
                                showToast('已置顶');
                                loadPosters();
                            } else {
                                showToast('操作失败');
                            }
                        }).catch(function () {
                            if (window.__postersActiveInstance !== instanceId) return;
                            showToast('操作失败');
                        });
                    }

                    // ===================== 删除确认弹窗 =====================

                    function showDeleteConfirm(id, title) {
                        // 移除已有弹窗
                        var existing = document.getElementById('poster-delete-modal');
                        if (existing) existing.remove();

                        var modal = document.createElement('div');
                        modal.id = 'poster-delete-modal';
                        modal.className = 'fixed inset-0 z-[10001] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4';
                        modal.innerHTML = [
                            '<div class="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 transform transition-all">',
                            '  <div class="flex flex-col items-center text-center">',
                            '    <div class="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center mb-4">',
                            '      <i class="ph ph-warning text-2xl text-red-500"></i>',
                            '    </div>',
                            '    <h3 class="font-semibold text-gray-800 mb-1">确认删除</h3>',
                            '    <p class="text-sm text-gray-500 mb-6">确定要删除「' + escapeHtml(title) + '」吗？此操作不可撤销。</p>',
                            '    <div class="flex gap-3 w-full">',
                            '      <button type="button" id="poster-delete-cancel" class="flex-1 px-4 py-2.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition font-medium text-sm">取消</button>',
                            '      <button type="button" id="poster-delete-confirm-btn" class="flex-1 px-4 py-2.5 rounded-lg bg-red-500 hover:bg-red-600 text-white transition font-medium text-sm">删除</button>',
                            '    </div>',
                            '  </div>',
                            '</div>'
                        ].join('');

                        document.body.appendChild(modal);

                        var cancelBtn = modal.querySelector('#poster-delete-cancel');
                        var confirmBtn = modal.querySelector('#poster-delete-confirm-btn');

                        cancelBtn.addEventListener('click', function () { modal.remove(); });
                        modal.addEventListener('click', function (e) {
                            if (e.target === modal) modal.remove();
                        });

                        confirmBtn.addEventListener('click', function () {
                            confirmBtn.innerHTML = '<i class="ph ph-spinner animate-spin"></i> 删除中...';
                            confirmBtn.disabled = true;
                            cancelBtn.disabled = true;

                            api('/api/posters/' + encodeURIComponent(id), { method: 'DELETE' }).then(function (res) {
                                if (window.__postersActiveInstance !== instanceId) return;
                                modal.remove();
                                if (res.success) {
                                    showToast('海报已删除');
                                    state.label = '';
                                    loadPosters(true);
                                } else {
                                    showToast('删除失败');
                                }
                            }).catch(function () {
                                if (window.__postersActiveInstance !== instanceId) return;
                                modal.remove();
                                showToast('删除失败');
                            });
                        });
                    }

                    // ===================== 平台筛选器 =====================

                    function bindPlatformFilters() {
                        var container = document.getElementById('platform-filters');
                        if (!container) return;
                        container.querySelectorAll('.pf-btn').forEach(function (btn) {
                            if (btn.dataset.bound) return;
                            btn.dataset.bound = '1';
                            btn.addEventListener('click', function (e) {
                                e.preventDefault();
                                var platform = btn.getAttribute('data-filter-platform') || '';
                                state.platform = platform;

                                // 更新按钮样式
                                container.querySelectorAll('.pf-btn').forEach(function (b) {
                                    b.className = b.className
                                        .replace(/border-brand-500/g, 'border-gray-200')
                                        .replace(/bg-brand-50/g, 'bg-white')
                                        .replace(/text-brand-500/g, 'text-gray-400');
                                });
                                btn.classList.remove('border-gray-200', 'bg-white', 'text-gray-400');
                                btn.classList.add('border-brand-500', 'bg-brand-50', 'text-brand-500');

                                // 切换平台时重置标签筛选，重新加载海报并生成 tabs
                                state.label = '';
                                loadPosters(true);
                            });
                        });
                    }

                    // ===================== 上传按钮 =====================

                    function bindUploadButton() {
                        var btn = document.getElementById('btn-upload-poster');
                        if (btn && !btn.dataset.bound) {
                            btn.dataset.bound = '1';
                            btn.addEventListener('click', function (e) {
                                e.preventDefault();
                                if (window.openPosterForm) window.openPosterForm();
                            });
                        }
                    }

                    // ===================== 预览键盘 =====================

                    function bindPreviewKeyboard() {
                        if (bindPreviewKeyboard.done) return;
                        bindPreviewKeyboard.done = true;
                        ctx.listen(document, 'keydown', function (e) {
                            if (e.key === 'Escape') closePosterPreview();
                        });
                        ctx.listen(window, 'spa:cleanup-forms', closePosterPreview);
                    }

                    // ===================== 表单保存回调 =====================

                    function bindFormSaved() {
                        if (window.__posterFormSavedBound) return;
                        window.__posterFormSavedBound = true;

                        window.addEventListener('poster-form:saved', function () {
                            if (window.__postersActiveInstance !== instanceId) return;
                            // 保存后重置标签筛选，重新加载全量数据并生成 tabs
                            state.label = '';
                            loadPosters(true);
                            showToast('海报保存成功');
                        });
                    }

                    // ===================== 初始化筛选按钮图标 =====================

                    function initFilterIcons() {
                        document.querySelectorAll('img[data-platform-icon]').forEach(function (img) {
                            var platform = img.getAttribute('data-platform-icon');
                            if (img.src) return; // 已设置则跳过
                            img.src = svgIconUrl(platform);
                        });
                    }

                    // ===================== 初始化 =====================

                    function init() {
                        if (window.__postersActiveInstance !== instanceId) return;
                        if (!document.getElementById('posters-grid')) return;

                        initFilterIcons();
                        bindUploadButton();
                        bindPlatformFilters();
                        bindPreviewKeyboard();
                        bindFormSaved();
                        // 先加载海报，成功后从海报数据生成 tabs
                        loadPosters(true);
                    }

                    if (document.readyState === 'loading') {
                        document.addEventListener('DOMContentLoaded', init);
                    } else {
                        init();
                    }

                    window.addEventListener('spa:ready', function (e) {
                        if (window.__postersActiveInstance !== instanceId) return;
                        var page = (e.detail && e.detail.page) || '';
                        if (page && page.indexOf('posters') === -1) return;
                        if (!document.getElementById('posters-grid')) return;
                        init();
                    });
                })();

                /* ==================== 原始脚本结束 ==================== */
            } finally {
                document.addEventListener = _docAdd;
                window.addEventListener = _winAdd;
            }
        }
    });

})(typeof window !== 'undefined' ? window : this);
