/**
 * 文的项目工作台 视图
 *
 * 自动迁移自 frontend/index.html
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

    App.view('dashboard', {
        path: '/',
        nav: 'index.html',
        title: '文的项目工作台',
        template: 'views/dashboard.html',
        styles: 'css/views/dashboard.css',

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

                        function navigatePlatformPage(pageName) {
                            if (typeof window.spaNavigate === 'function') {
                                window.spaNavigate(pageName);
                                return;
                            }

                            var routes = {
                                'xianyu.html': 'pages/platform/xianyu.html',
                                'xiaohongshu.html': 'pages/platform/xiaohongshu.html',
                                'douyin.html': 'pages/platform/douyin.html'
                            };
                            window.location.href = routes[pageName] || 'pages/platform/platform.html';
                        }

                        function isHomePage(page) {
                            if (!page) return true;
                            return page.indexOf('index') !== -1 || page.indexOf('home') !== -1;
                        }

                        function escapeHtml(str) {
                            return String(str == null ? '' : str)
                                .replace(/&/g, '&amp;')
                                .replace(/</g, '&lt;')
                                .replace(/>/g, '&gt;')
                                .replace(/"/g, '&quot;');
                        }

                        /** 渲染增长率：正红负绿持平灰 */
                        function setGrowth(wrapId, valueId, growth, prefix) {
                            var wrap = document.getElementById(wrapId);
                            var valueEl = document.getElementById(valueId);
                            if (!valueEl) return;
                            var g = parseInt(growth, 10) || 0;
                            var abs = Math.abs(g);
                            valueEl.textContent = abs + '%';
                            if (!wrap) return;
                            var icon = wrap.querySelector('i');
                            wrap.classList.remove('text-red-500', 'text-emerald-500', 'text-gray-400');
                            if (g > 0) {
                                wrap.classList.add('text-red-500');
                                if (icon) icon.className = 'ph ph-arrow-up-right mr-0.5';
                            } else if (g < 0) {
                                wrap.classList.add('text-emerald-500');
                                if (icon) icon.className = 'ph ph-arrow-down-right mr-0.5';
                            } else {
                                wrap.classList.add('text-gray-400');
                                if (icon) icon.className = 'ph ph-minus mr-0.5';
                            }
                            // 保留 wrap 内已有文案前缀（较昨日/较上月），只更新数字
                            if (prefix) { /* reserved */ }
                        }

                        // Initialize ECharts for Trend Chart（接入后端数据）
                        var trendChartInstance = null;
                        var trendDays = 7;

                        function initTrendChart() {
                            var chartDom = document.getElementById('trendChart');
                            if (!chartDom || typeof echarts === 'undefined') {
                                return;
                            }

                            if (trendChartInstance) {
                                trendChartInstance.dispose();
                            }

                            trendChartInstance = echarts.init(chartDom);

                            var selectEl = document.getElementById('trend-range-select');
                            if (selectEl) {
                                trendDays = parseInt(selectEl.value, 10) || 7;
                            }

                            api.get('/api/stats/revenue/daily?days=' + trendDays)
                                .then(function(res) {
                                    if (!res.success || !res.data) return;

                                    var dates = res.data.map(function(item) { return item.date; });
                                    var counts = res.data.map(function(item) { return item.count; });
                                    var maxCount = Math.max.apply(null, counts.concat([5]));
                                    var yMax = Math.ceil(maxCount / 5) * 5;

                                    var option = {
                                        tooltip: {
                                            trigger: 'axis',
                                            backgroundColor: '#1e293b',
                                            textStyle: { color: '#fff', fontSize: 12 },
                                            padding: [8, 12],
                                            borderRadius: 8,
                                            borderWidth: 0,
                                            formatter: function(params) {
                                                return params[0].name + '<br/>订单数: <b>' + params[0].value + '</b>';
                                            },
                                            axisPointer: {
                                                type: 'line',
                                                lineStyle: { color: '#cbd5e1', type: 'dashed' }
                                            }
                                        },
                                        grid: {
                                            left: '3%',
                                            right: '4%',
                                            bottom: '5%',
                                            top: '15%',
                                            containLabel: true
                                        },
                                        xAxis: {
                                            type: 'category',
                                            boundaryGap: false,
                                            data: dates,
                                            axisLine: { show: false },
                                            axisTick: { show: false },
                                            axisLabel: {
                                                color: '#94a3b8',
                                                fontSize: 11,
                                                margin: 12,
                                                interval: trendDays === 30 ? 4 : 0
                                            }
                                        },
                                        yAxis: {
                                            type: 'value',
                                            min: 0,
                                            max: yMax,
                                            interval: Math.ceil(yMax / 4),
                                            splitLine: {
                                                lineStyle: { type: 'dashed', color: '#f1f5f9' }
                                            },
                                            axisLabel: { color: '#94a3b8', fontSize: 11 }
                                        },
                                        series: [{
                                            name: '订单数',
                                            type: 'line',
                                            smooth: true,
                                            symbol: 'circle',
                                            symbolSize: trendDays === 30 ? 4 : 6,
                                            showSymbol: true,
                                            itemStyle: {
                                                color: '#3b82f6',
                                                borderWidth: 2,
                                                borderColor: '#fff'
                                            },
                                            lineStyle: {
                                                width: 3,
                                                color: '#3b82f6',
                                                shadowColor: 'rgba(59, 130, 246, 0.3)',
                                                shadowBlur: 10,
                                                shadowOffsetY: 5
                                            },
                                            areaStyle: {
                                                color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                                                    { offset: 0, color: 'rgba(59, 130, 246, 0.2)' },
                                                    { offset: 1, color: 'rgba(59, 130, 246, 0)' }
                                                ])
                                            },
                                            data: counts
                                        }]
                                    };

                                    trendChartInstance.setOption(option);
                                })
                                .catch(function(err) {
                                    console.error('加载图表数据失败:', err);
                                });

                            if (!window.__trendChartResizeBound) {
                                window.__trendChartResizeBound = true;
                                window.addEventListener('resize', function() {
                                    if (trendChartInstance) trendChartInstance.resize();
                                });
                            }
                        }

                        function bindTrendRangeSelect() {
                            var selectEl = document.getElementById('trend-range-select');
                            if (!selectEl || selectEl.dataset.bound === '1') return;
                            selectEl.dataset.bound = '1';
                            selectEl.addEventListener('change', function() {
                                trendDays = parseInt(selectEl.value, 10) || 7;
                                initTrendChart();
                            });
                        }

                        if (window.__trendChartSpaReady) {
                            window.removeEventListener('spa:ready', window.__trendChartSpaReady);
                        }
                        window.__trendChartSpaReady = function(e) {
                            var page = (e.detail && e.detail.page) || '';
                            if (!isHomePage(page)) return;
                            bindTrendRangeSelect();
                            initTrendChart();
                        };
                        window.addEventListener('spa:ready', window.__trendChartSpaReady);
                        if (document.readyState === 'loading') {
                            document.addEventListener('DOMContentLoaded', function() {
                                bindTrendRangeSelect();
                                initTrendChart();
                            });
                        } else {
                            bindTrendRangeSelect();
                            initTrendChart();
                        }
                        window.addEventListener('echarts-ready', initTrendChart);

                        /* ========== 顶部数值卡片：后端 home-metrics ========== */
                        (function() {
                            function formatMoney(value) {
                                var num = parseFloat(value) || 0;
                                return '¥' + num.toLocaleString('zh-CN');
                            }

                            function loadTopMetrics() {
                                if (!document.getElementById('metric-today-orders')) return;

                                ui.showLoading('加载数据中...');
                                api.get('/api/stats/home-metrics')
                                    .then(function(res) {
                                        ui.hideLoading();
                                        if (!res.success || !res.data) return;
                                        var d = res.data;

                                        var el = document.getElementById('metric-today-orders');
                                        if (el) el.textContent = d.todayOrders || 0;
                                        setGrowth('metric-today-orders-rate-wrap', 'metric-today-orders-rate', d.todayOrdersGrowth);

                                        el = document.getElementById('metric-active-orders');
                                        if (el) el.textContent = d.activeOrders || 0;

                                        el = document.getElementById('metric-today-revenue');
                                        if (el) el.textContent = formatMoney(d.todayRevenue);
                                        setGrowth('metric-today-revenue-rate-wrap', 'metric-today-revenue-rate', d.todayRevenueGrowth);

                                        el = document.getElementById('metric-month-revenue');
                                        if (el) el.textContent = formatMoney(d.monthRevenue);
                                        setGrowth('metric-month-revenue-rate-wrap', 'metric-month-revenue-rate', d.monthRevenueGrowth);

                                        el = document.getElementById('metric-year-revenue');
                                        if (el) el.textContent = formatMoney(d.yearRevenue);
                                        setGrowth('metric-year-revenue-rate-wrap', 'metric-year-revenue-rate', d.yearRevenueGrowth);
                                    })
                                    .catch(function(err) {
                                        ui.hideLoading();
                                        ui.toast.error('加载数据失败，请重试');
                                        console.error('加载顶部数值失败:', err);
                                    });
                            }

                            if (window.__indexPageSpaReady) {
                                window.removeEventListener('spa:ready', window.__indexPageSpaReady);
                            }
                            window.__indexPageSpaReady = function(e) {
                                var page = (e.detail && e.detail.page) || '';
                                if (!isHomePage(page)) return;
                                loadTopMetrics();
                            };
                            window.addEventListener('spa:ready', window.__indexPageSpaReady);

                            if (document.readyState === 'loading') {
                                document.addEventListener('DOMContentLoaded', loadTopMetrics);
                            } else {
                                loadTopMetrics();
                            }
                        })();

                        /* ========== 平台发布状态：加载后端数据 ========== */
                        (function() {
                            function formatStatNum(n) {
                                var num = parseInt(n, 10) || 0;
                                if (num >= 10000) {
                                    var wan = num / 10000;
                                    return (wan % 1 === 0 ? wan.toFixed(0) : wan.toFixed(1)) + '万';
                                }
                                return num.toLocaleString('zh-CN');
                            }

                            function loadPlatformStatus() {
                                var checkEl = document.getElementById('platform-xianyu-published');
                                if (!checkEl) return;

                                api.get('/api/platform-posts/stats/overview')
                                    .then(function(res) {
                                        if (!res.success || !res.data) return;

                                        ['xianyu', 'xiaohongshu', 'douyin'].forEach(function(pf) {
                                            var pfData = res.data[pf] || {};

                                            var publishedEl = document.getElementById('platform-' + pf + '-published');
                                            if (publishedEl) publishedEl.textContent = pfData.published || 0;

                                            var likesEl = document.getElementById('platform-' + pf + '-likes');
                                            if (likesEl) likesEl.textContent = formatStatNum(pfData.totalLikes);

                                            var viewsEl = document.getElementById('platform-' + pf + '-views');
                                            if (viewsEl) viewsEl.textContent = formatStatNum(pfData.totalViews);
                                        });
                                    })
                                    .catch(function(err) {
                                        ui.toast.error('加载平台状态失败');
                                        console.error('加载平台状态失败:', err);
                                    });
                            }

                            if (window.__platformStatusSpaReady) {
                                window.removeEventListener('spa:ready', window.__platformStatusSpaReady);
                            }
                            window.__platformStatusSpaReady = function(e) {
                                var page = (e.detail && e.detail.page) || '';
                                if (!isHomePage(page)) return;
                                loadPlatformStatus();
                            };
                            window.addEventListener('spa:ready', window.__platformStatusSpaReady);

                            if (document.readyState === 'loading') {
                                document.addEventListener('DOMContentLoaded', loadPlatformStatus);
                            } else {
                                loadPlatformStatus();
                            }
                        })();

                        /* ========== 数据概览 (本月)：加载后端数据 ========== */
                        (function() {
                            function animateValue(element, start, end, duration, prefix, suffix) {
                                prefix = prefix || '';
                                suffix = suffix || '';
                                var startTime = null;
                                function step(timestamp) {
                                    if (!startTime) startTime = timestamp;
                                    var progress = Math.min((timestamp - startTime) / duration, 1);
                                    var value = Math.floor(progress * (end - start) + start);
                                    element.textContent = prefix + value.toLocaleString('zh-CN') + suffix;
                                    if (progress < 1) {
                                        window.requestAnimationFrame(step);
                                    }
                                }
                                window.requestAnimationFrame(step);
                            }

                            function loadMonthlyOverview() {
                                var checkEl = document.getElementById('overview-order-count');
                                if (!checkEl) return;

                                api.get('/api/stats/monthly-overview')
                                    .then(function(res) {
                                        if (!res.success || !res.data) return;

                                        var data = res.data;

                                        var orderCountEl = document.getElementById('overview-order-count');
                                        if (orderCountEl) animateValue(orderCountEl, 0, data.orderCount || 0, 1400, '', '');
                                        setGrowth('overview-order-growth-wrap', 'overview-order-growth', data.orderCountGrowth != null ? data.orderCountGrowth : data.revenueGrowth);

                                        var revenueEl = document.getElementById('overview-revenue');
                                        if (revenueEl) animateValue(revenueEl, 0, data.revenue || 0, 1600, '¥', '');
                                        setGrowth('overview-revenue-growth-wrap', 'overview-revenue-growth', data.revenueGrowth);

                                        var yearRevenueEl = document.getElementById('overview-year-revenue');
                                        if (yearRevenueEl) animateValue(yearRevenueEl, 0, data.yearRevenue || 0, 1800, '¥', '');
                                        setGrowth('overview-year-growth-wrap', 'overview-year-growth', data.yearGrowth);

                                        var customersEl = document.getElementById('overview-customers');
                                        if (customersEl) animateValue(customersEl, 0, data.totalCustomers || 0, 1400, '', '');
                                        setGrowth('overview-customer-growth-wrap', 'overview-customer-growth', data.customerGrowth);

                                        var goodRateEl = document.getElementById('overview-good-rate');
                                        if (goodRateEl) animateValue(goodRateEl, 0, data.goodRate || 0, 1400, '', '%');
                                        setGrowth('overview-good-rate-growth-wrap', 'overview-good-rate-growth', data.goodRateGrowth);

                                        var repeatRateEl = document.getElementById('overview-repeat-rate');
                                        if (repeatRateEl) animateValue(repeatRateEl, 0, data.repeatRate || 0, 1400, '', '%');
                                        setGrowth('overview-repeat-rate-growth-wrap', 'overview-repeat-rate-growth', data.repeatRateGrowth);
                                    })
                                    .catch(function(err) {
                                        console.error('加载数据概览失败:', err);
                                    });
                            }

                            if (window.__monthlyOverviewSpaReady) {
                                window.removeEventListener('spa:ready', window.__monthlyOverviewSpaReady);
                            }
                            window.__monthlyOverviewSpaReady = function(e) {
                                var page = (e.detail && e.detail.page) || '';
                                if (!isHomePage(page)) return;
                                loadMonthlyOverview();
                            };
                            window.addEventListener('spa:ready', window.__monthlyOverviewSpaReady);

                            if (document.readyState === 'loading') {
                                document.addEventListener('DOMContentLoaded', loadMonthlyOverview);
                            } else {
                                loadMonthlyOverview();
                            }
                        })();

                        /* ========== 最新订单：垂直轮播列表 ========== */
                        (function () {
                            var VISIBLE_MAX = 6;          // 最多直接展示 6 条
                            var CAROUSEL_INTERVAL = 3500;  // 轮播间隔(ms)
                            var ANIM_DURATION = 400;       // 单行动画时长(ms)

                            // 状态 → SVG + class 映射
                            var statusMap = {
                                processing: { cls: 'status-processing', tip: '进行中', svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>' },
                                quoted: { cls: 'status-quoted', tip: '已报价', svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M9 13h6"/><path d="M9 17h4"/></svg>' },
                                completed: { cls: 'status-completed', tip: '已完成', svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/></svg>' },
                                cancelled: { cls: 'status-cancelled', tip: '已取消', svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="m4.93 4.93 14.14 14.14"/></svg>' },
                                pending: { cls: 'status-quoted', tip: '待确认', svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>' },
                                acceptance: { cls: 'status-processing', tip: '待验收', svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="m9 15 2 2 4-4"/></svg>' }
                            };

                            var allOrders = [];       // 当前全部订单数据
                            var nextIndex = 0;        // 下一条要轮播追加的数据索引
                            var carouselTimer = null; // 轮播定时器
                            var isAnimating = false;  // 防止动画叠加

                            // 格式化金额
                            function formatAmount(amount) {
                                var num = parseFloat(amount) || 0;
                                return '¥ ' + num.toLocaleString('zh-CN');
                            }

                            // 格式化日期
                            function formatDate(dateStr) {
                                if (!dateStr) return '--';
                                var date = new Date(dateStr);
                                if (isNaN(date)) return dateStr;
                                return (date.getMonth() + 1) + '-' + date.getDate();
                            }

                            // 生成单行 HTML
                            function buildRowHTML(order) {
                                var s = statusMap[order.orderStatus] || statusMap.processing;
                                return '<tr class="table-row" style="height:42px">'
                                    + '<td class="py-3 text-gray-500 text-xs truncate">' + (order.projectName || order.title || '--') + '</td>'
                                    + '<td class="py-3 truncate">' + (order.customerNick || order.customer || '--') + '</td>'
                                    + '<td class="py-3 text-gray-500 truncate">' + (order.projectType || order.service || '--') + '</td>'
                                    + '<td class="py-3 font-medium">' + formatAmount(order.amount) + '</td>'
                                    + '<td class="py-3"><span class="status-icon ' + s.cls + '" data-tip="' + s.tip + '">' + s.svg + '</span></td>'
                                    + '<td class="py-3 text-gray-500 text-xs">' + formatDate(order.orderDate || order.time) + '</td>'
                                    + '</tr>';
                            }

                            // 从后端加载订单数据
                            function loadRecentOrders() {
                                api.get('/api/orders?pageSize=9&sort=-createdAt')
                                    .then(function(res) {
                                        if (res.success && res.data && res.data.list) {
                                            allOrders = res.data.list;
                                            initRecentOrders();
                                        } else if (Array.isArray(res.data)) {
                                            allOrders = res.data;
                                            initRecentOrders();
                                        }
                                    })
                                    .catch(function(err) {
                                        ui.toast.error('加载最新订单失败');
                                        console.error('加载最新订单失败:', err);
                                    });
                            }

                            // 初始化渲染
                            function initRecentOrders() {
                                var tbody = document.getElementById('recentOrdersBody');
                                if (!tbody) return;
                                tbody.innerHTML = '';
                                var showCount = Math.min(VISIBLE_MAX, allOrders.length);
                                for (var i = 0; i < showCount; i++) {
                                    tbody.insertAdjacentHTML('beforeend', buildRowHTML(allOrders[i]));
                                }
                                nextIndex = showCount;
                                updateLiveDot();
                                // 超过 6 条，启动轮播
                                if (allOrders.length > VISIBLE_MAX) {
                                    startCarousel();
                                }
                            }

                            // 启动轮播
                            function startCarousel() {
                                stopCarousel();
                                carouselTimer = setInterval(rotateOne, CAROUSEL_INTERVAL);
                                updateLiveDot();
                            }

                            // 停止轮播
                            function stopCarousel() {
                                if (carouselTimer) {
                                    clearInterval(carouselTimer);
                                    carouselTimer = null;
                                }
                                updateLiveDot();
                            }

                            // 更新「轮播中」指示器
                            function updateLiveDot() {
                                var dot = document.getElementById('orderLiveDot');
                                if (!dot) return;
                                if (carouselTimer && allOrders.length > VISIBLE_MAX) {
                                    dot.classList.remove('hidden');
                                    dot.classList.add('flex');
                                } else {
                                    dot.classList.add('hidden');
                                    dot.classList.remove('flex');
                                }
                            }

                            // 轮播一帧：顶部淡出移除 → 底部追加新行淡入
                            function rotateOne() {
                                if (isAnimating) return;
                                var tbody = document.getElementById('recentOrdersBody');
                                if (!tbody) return;
                                var firstRow = tbody.querySelector('tr');
                                if (!firstRow) return;

                                isAnimating = true;

                                // 顶部行淡出上移
                                firstRow.style.transition = 'opacity ' + ANIM_DURATION + 'ms ease, transform ' + ANIM_DURATION + 'ms ease';
                                firstRow.style.opacity = '0';
                                firstRow.style.transform = 'translateY(-12px)';

                                setTimeout(function () {
                                    firstRow.remove();

                                    // 从数据队列中取下一条（循环）
                                    var order = allOrders[nextIndex % allOrders.length];
                                    tbody.insertAdjacentHTML('beforeend', buildRowHTML(order));
                                    var newRow = tbody.lastElementChild;

                                    // 新行从底部淡入
                                    newRow.style.opacity = '0';
                                    newRow.style.transform = 'translateY(12px)';
                                    // 强制回流后启动过渡
                                    void newRow.offsetHeight;
                                    newRow.style.transition = 'opacity ' + ANIM_DURATION + 'ms ease, transform ' + ANIM_DURATION + 'ms ease';
                                    newRow.style.opacity = '1';
                                    newRow.style.transform = 'translateY(0)';

                                    nextIndex++;
                                    isAnimating = false;
                                }, ANIM_DURATION);
                            }

                            // 鼠标悬停暂停轮播
                            function bindHoverPause() {
                                var container = document.querySelector('.card .overflow-hidden.flex-1');
                                if (!container) return;
                                container.addEventListener('mouseenter', function () {
                                    if (carouselTimer) stopCarousel();
                                });
                                container.addEventListener('mouseleave', function () {
                                    if (allOrders.length > VISIBLE_MAX && !carouselTimer) startCarousel();
                                });
                            }

                            // 初始化入口
                            function init() {
                                // 检查是否在首页
                                var tbody = document.getElementById('recentOrdersBody');
                                if (!tbody) return;
                                loadRecentOrders();
                                bindHoverPause();
                            }

                            // SPA 防重复注册
                            if (window.__recentOrdersSpaReady) {
                                window.removeEventListener('spa:ready', window.__recentOrdersSpaReady);
                            }
                            window.__recentOrdersSpaReady = function(e) {
                                var page = (e.detail && e.detail.page) || '';
                                if (!isHomePage(page)) return;
                                init();
                            };
                            window.addEventListener('spa:ready', window.__recentOrdersSpaReady);

                            // DOM 就绪后初始化
                            if (document.readyState === 'loading') {
                                document.addEventListener('DOMContentLoaded', init);
                            } else {
                                init();
                            }
                        })();

                        /* ========== 待办事项：加载后端数据 ========== */
                        (function() {
                            function loadTodoStats() {
                                var checkEl = document.getElementById('todo-list');
                                if (!checkEl) return;

                                api.get('/api/stats/todos')
                                    .then(function(res) {
                                        if (!res.success || !res.data) return;

                                        var data = res.data;
                                        var map = {
                                            'todo-pending-reply': data.pendingReply,
                                            'todo-pending-quote': data.pendingQuote,
                                            'todo-platform-reviewing': data.platformReviewing,
                                            'todo-expiring-soon': data.expiringSoon,
                                            'todo-pending-acceptance': data.pendingAcceptance,
                                            'todo-overdue-orders': data.overdueOrders,
                                            'todo-today-reminders': data.todayReminders,
                                            'todo-active-projects': data.activeProjects
                                        };
                                        Object.keys(map).forEach(function(id) {
                                            var el = document.getElementById(id);
                                            if (el) el.textContent = map[id] || 0;
                                        });
                                    })
                                    .catch(function(err) {
                                        console.error('加载待办事项失败:', err);
                                    });
                            }

                            if (window.__todoStatsSpaReady) {
                                window.removeEventListener('spa:ready', window.__todoStatsSpaReady);
                            }
                            window.__todoStatsSpaReady = function(e) {
                                var page = (e.detail && e.detail.page) || '';
                                if (!isHomePage(page)) return;
                                loadTodoStats();
                            };
                            window.addEventListener('spa:ready', window.__todoStatsSpaReady);

                            if (document.readyState === 'loading') {
                                document.addEventListener('DOMContentLoaded', loadTodoStats);
                            } else {
                                loadTodoStats();
                            }
                        })();

                        /* ========== 宣传海报：加载后端数据 ========== */
                        (function() {
                            var PLACEHOLDER_COLORS = [
                                ['#1e3a8a', '#1e40af', '#fde047'],
                                ['#4c1d95', '#111827', '#c4b5fd'],
                                ['#ffedd5', '#fed7aa', '#ea580c'],
                                ['#14532d', '#166534', '#86efac'],
                                ['#134e4a', '#0f766e', '#5eead4'],
                                ['#881337', '#9f1239', '#fda4af']
                            ];

                            function buildPosterCard(poster, index) {
                                var title = escapeHtml(poster.title || '未命名海报');
                                var dateText = escapeHtml(poster.onlineDate || (poster.updatedAt ? String(poster.updatedAt).slice(0, 10) : '--'));
                                var shortTitle = (poster.title || '海报').slice(0, 8);
                                var colors = PLACEHOLDER_COLORS[index % PLACEHOLDER_COLORS.length];
                                var visual;

                                if (poster.image) {
                                    visual =
                                        '<div class="rounded-lg h-28 mb-2 relative overflow-hidden group cursor-pointer bg-gray-100">' +
                                        '<img src="' + escapeHtml(poster.image) + '" alt="' + title + '" class="absolute inset-0 w-full h-full object-cover">' +
                                        '<div class="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">' +
                                        '<span class="bg-white text-gray-800 rounded-full p-2"><i class="ph-fill ph-eye"></i></span>' +
                                        '</div></div>';
                                } else if (poster.imageHtml) {
                                    visual =
                                        '<div class="rounded-lg h-28 mb-2 relative overflow-hidden group cursor-pointer">' +
                                        poster.imageHtml +
                                        '</div>';
                                } else {
                                    visual =
                                        '<div class="rounded-lg h-28 mb-2 relative overflow-hidden group cursor-pointer" style="background:' + colors[0] + '">' +
                                        '<div class="absolute inset-0 flex flex-col items-center justify-center p-2 text-center" style="background:linear-gradient(to bottom,' + colors[1] + ',' + colors[0] + ')">' +
                                        '<span class="font-bold text-sm leading-tight mb-1" style="color:' + colors[2] + '">' + escapeHtml(shortTitle) + '</span>' +
                                        '<i class="ph-fill ph-image text-xl mt-1 opacity-70" style="color:' + colors[2] + '"></i>' +
                                        '</div></div>';
                                }

                                return (
                                    '<a href="#" data-page="posters.html" class="flex flex-col min-w-0">' +
                                    visual +
                                    '<h4 class="font-medium text-gray-800 text-xs truncate">' + title + '</h4>' +
                                    '<p class="text-gray-400 text-[10px] mt-0.5">' + dateText + '</p>' +
                                    '</a>'
                                );
                            }

                            function loadHomePosters() {
                                var grid = document.getElementById('home-posters-grid');
                                if (!grid) return;

                                api.get('/api/posters')
                                    .then(function(res) {
                                        if (!res.success) return;
                                        var list = Array.isArray(res.data) ? res.data : [];
                                        list = list.slice(0, 6);
                                        if (!list.length) {
                                            grid.innerHTML = '<div class="col-span-3 py-10 text-center text-gray-400 text-sm">暂无海报</div>';
                                            return;
                                        }
                                        grid.innerHTML = list.map(buildPosterCard).join('');
                                    })
                                    .catch(function(err) {
                                        grid.innerHTML = '<div class="col-span-3 py-10 text-center text-gray-400 text-sm">加载失败</div>';
                                        console.error('加载海报失败:', err);
                                    });
                            }

                            if (window.__homePostersSpaReady) {
                                window.removeEventListener('spa:ready', window.__homePostersSpaReady);
                            }
                            window.__homePostersSpaReady = function(e) {
                                var page = (e.detail && e.detail.page) || '';
                                if (!isHomePage(page)) return;
                                loadHomePosters();
                            };
                            window.addEventListener('spa:ready', window.__homePostersSpaReady);

                            if (document.readyState === 'loading') {
                                document.addEventListener('DOMContentLoaded', loadHomePosters);
                            } else {
                                loadHomePosters();
                            }
                        })();

                        /* ========== 日程提醒：加载后端日历数据 ========== */
                        (function() {
                            var viewYear = null;
                            var viewMonth = null; // 1-12
                            var selectedDate = null;
                            var monthDays = {};
                            var bound = false;

                            function pad2(n) { return String(n).padStart(2, '0'); }

                            function todayStr() {
                                var d = new Date();
                                return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
                            }

                            function priorityColor(priority) {
                                if (priority === 'high') return 'bg-red-500';
                                if (priority === 'low') return 'bg-emerald-500';
                                return 'bg-brand-500';
                            }

                            function renderTimeline(dateStr) {
                                var box = document.getElementById('home-reminder-timeline');
                                if (!box) return;
                                var dayKey = dateStr ? dateStr.substring(8, 10) : '';
                                var list = (monthDays[dayKey] || []).slice().sort(function(a, b) {
                                    return String(a.time || '').localeCompare(String(b.time || ''));
                                });

                                if (!list.length) {
                                    box.innerHTML = '<p class="text-sm text-gray-400 pl-6 py-2">当日暂无日程</p>';
                                    return;
                                }

                                box.innerHTML = list.map(function(r) {
                                    var doneCls = r.done ? ' opacity-50 line-through' : '';
                                    return (
                                        '<div class="flex items-start gap-4">' +
                                        '<div class="w-3 h-3 rounded-full border-2 border-white ' + priorityColor(r.priority) + ' mt-1 shadow-sm"></div>' +
                                        '<div class="min-w-0 flex-1">' +
                                        '<p class="text-xs text-gray-500 mb-0.5">' + escapeHtml(r.time || '--:--') + '</p>' +
                                        '<p class="text-sm text-gray-700 bg-gray-50 px-3 py-1.5 rounded-lg border border-gray-100 truncate' + doneCls + '">' +
                                        escapeHtml(r.title || '未命名') +
                                        '</p></div></div>'
                                    );
                                }).join('');
                            }

                            function renderCalendarGrid() {
                                var grid = document.getElementById('home-cal-grid');
                                var title = document.getElementById('home-cal-title');
                                if (!grid || !title) return;

                                title.textContent = viewYear + '年' + viewMonth + '月';
                                var first = new Date(viewYear, viewMonth - 1, 1);
                                var startWeekday = first.getDay();
                                var daysInMonth = new Date(viewYear, viewMonth, 0).getDate();
                                var prevDays = new Date(viewYear, viewMonth - 1, 0).getDate();
                                var today = todayStr();
                                var html = '';

                                for (var i = 0; i < startWeekday; i++) {
                                    var pd = prevDays - startWeekday + i + 1;
                                    html += '<div class="text-gray-300 py-1">' + pd + '</div>';
                                }

                                for (var day = 1; day <= daysInMonth; day++) {
                                    var dateStr = viewYear + '-' + pad2(viewMonth) + '-' + pad2(day);
                                    var dayKey = pad2(day);
                                    var hasReminder = !!(monthDays[dayKey] && monthDays[dayKey].length);
                                    var isToday = dateStr === today;
                                    var isSelected = dateStr === selectedDate;
                                    var cls = 'py-1 rounded cursor-pointer relative hover:bg-gray-100';
                                    if (isSelected) cls = 'py-1 bg-brand-500 text-white rounded-full mx-1 shadow-sm shadow-brand-200 cursor-pointer relative';
                                    else if (isToday) cls = 'py-1 rounded cursor-pointer relative ring-1 ring-brand-300 hover:bg-gray-100';

                                    var dot = '';
                                    if (hasReminder && !isSelected) {
                                        var hasHigh = monthDays[dayKey].some(function(r) { return r.priority === 'high' && !r.done; });
                                        var dotColor = hasHigh ? 'bg-red-400' : 'bg-brand-400';
                                        dot = '<span class="absolute bottom-0 left-1/2 -translate-x-1/2 w-1 h-1 ' + dotColor + ' rounded-full"></span>';
                                    }

                                    html += '<div class="' + cls + '" data-date="' + dateStr + '">' + day + dot + '</div>';
                                }

                                var totalCells = startWeekday + daysInMonth;
                                var remain = (7 - (totalCells % 7)) % 7;
                                for (var n = 1; n <= remain; n++) {
                                    html += '<div class="text-gray-300 py-1">' + n + '</div>';
                                }

                                grid.innerHTML = html;
                                Array.prototype.forEach.call(grid.querySelectorAll('[data-date]'), function(el) {
                                    el.addEventListener('click', function() {
                                        selectedDate = el.getAttribute('data-date');
                                        renderCalendarGrid();
                                        renderTimeline(selectedDate);
                                    });
                                });
                            }

                            function loadMonth() {
                                if (!document.getElementById('home-cal-grid')) return;
                                api.get('/api/reminders/calendar/' + viewYear + '/' + viewMonth)
                                    .then(function(res) {
                                        monthDays = (res.success && res.data && res.data.days) ? res.data.days : {};
                                        renderCalendarGrid();
                                        renderTimeline(selectedDate);
                                    })
                                    .catch(function(err) {
                                        console.error('加载日程失败:', err);
                                        monthDays = {};
                                        renderCalendarGrid();
                                        var box = document.getElementById('home-reminder-timeline');
                                        if (box) box.innerHTML = '<p class="text-sm text-gray-400 pl-6 py-2">加载失败</p>';
                                    });
                            }

                            function bindNav() {
                                if (bound) return;
                                bound = true;
                                var prev = document.getElementById('home-cal-prev');
                                var next = document.getElementById('home-cal-next');
                                if (prev) {
                                    prev.addEventListener('click', function() {
                                        viewMonth -= 1;
                                        if (viewMonth < 1) { viewMonth = 12; viewYear -= 1; }
                                        selectedDate = viewYear + '-' + pad2(viewMonth) + '-01';
                                        loadMonth();
                                    });
                                }
                                if (next) {
                                    next.addEventListener('click', function() {
                                        viewMonth += 1;
                                        if (viewMonth > 12) { viewMonth = 1; viewYear += 1; }
                                        selectedDate = viewYear + '-' + pad2(viewMonth) + '-01';
                                        loadMonth();
                                    });
                                }
                            }

                            function initHomeCalendar() {
                                if (!document.getElementById('home-cal-grid')) return;
                                var now = new Date();
                                viewYear = now.getFullYear();
                                viewMonth = now.getMonth() + 1;
                                selectedDate = todayStr();
                                bindNav();
                                loadMonth();
                            }

                            if (window.__homeCalendarSpaReady) {
                                window.removeEventListener('spa:ready', window.__homeCalendarSpaReady);
                            }
                            window.__homeCalendarSpaReady = function(e) {
                                var page = (e.detail && e.detail.page) || '';
                                if (!isHomePage(page)) return;
                                bound = false;
                                initHomeCalendar();
                            };
                            window.addEventListener('spa:ready', window.__homeCalendarSpaReady);

                            if (document.readyState === 'loading') {
                                document.addEventListener('DOMContentLoaded', initHomeCalendar);
                            } else {
                                initHomeCalendar();
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
