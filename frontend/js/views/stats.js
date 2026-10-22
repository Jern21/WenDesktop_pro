/**
 * 数据统计 视图
 *
 * 自动迁移自 frontend/pages/content/stats.html
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

    App.view('stats', {
        path: '/stats',
        nav: 'stats.html',
        title: '数据统计',
        template: 'views/stats.html',

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

                        var statsRange = window.statsRange || 'all';
                        window.statsRange = statsRange;

                        function buildStatsUrl(path, params) {
                            statsRange = window.statsRange || statsRange || 'all';
                            var query = new URLSearchParams(params || {});
                            query.set('range', statsRange);
                            return path + '?' + query.toString();
                        }

                        function statsGet(url) {
                            return global.api.get(url, null, { signal: ctx.signal }).catch(function (err) {
                                if (err && err.name === 'AbortError') return { success: false, aborted: true };
                                console.error('[stats]', err);
                                return { success: false, error: err && err.message };
                            });
                        }

                        function setGrowth(id, value, hasComparison) {
                            var el = document.getElementById(id);
                            if (!el) return;
                            var row = el.parentElement;
                            var icon = row ? row.querySelector('i') : null;

                            if (!hasComparison || value === null || value === undefined) {
                                el.textContent = '--';
                                if (icon) icon.className = 'ph ph-minus mr-0.5';
                                if (row) row.className = 'text-[10px] text-gray-400 flex items-center';
                                return;
                            }

                            var num = Number(value) || 0;
                            el.textContent = Math.abs(num) + '%';
                            if (num > 0) {
                                if (icon) icon.className = 'ph ph-arrow-up mr-0.5';
                                if (row) row.className = 'text-[10px] text-green-500 flex items-center';
                            } else if (num < 0) {
                                if (icon) icon.className = 'ph ph-arrow-down mr-0.5';
                                if (row) row.className = 'text-[10px] text-red-500 flex items-center';
                            } else {
                                if (icon) icon.className = 'ph ph-minus mr-0.5';
                                if (row) row.className = 'text-[10px] text-gray-400 flex items-center';
                            }
                        }

                        function updateStatsRangeUI() {
                            var revenueSubtitle = document.getElementById('revenueTrendSubtitle');
                            if (revenueSubtitle) {
                                var subtitleMap = {
                                    all: '全量收入趋势',
                                    year: '本年收入趋势',
                                    month: '本月收入趋势'
                                };
                                revenueSubtitle.textContent = subtitleMap[statsRange] || subtitleMap.all;
                            }

                            document.querySelectorAll('.stats-range-btn').forEach(function(btn) {
                                var active = btn.getAttribute('data-range') === statsRange;
                                btn.className = active
                                    ? 'stats-range-btn px-3 py-1.5 bg-white shadow-sm rounded-md text-brand-600 text-xs font-medium transition-colors'
                                    : 'stats-range-btn px-3 py-1.5 text-gray-500 hover:text-gray-800 rounded-md text-xs font-medium transition-colors';
                            });
                        }

                        function syncStatsRangeFromHeader() {
                            statsRange = window.statsRange || statsRange || 'all';
                            updateStatsRangeUI();
                        }

                        // ========== 加载顶部指标数据 ==========
                        function loadStatsMetrics() {
                            // 检查是否在统计页
                            var checkEl = document.getElementById('stat-order-count');
                            if (!checkEl) return;

                            // 加载当前范围概览数据
                            statsGet(buildStatsUrl('/api/stats/monthly-overview'))
                                .then(function(res) {
                                    if (!res.success || !res.data) return;
                                    var data = res.data;

                                    // 订单总数
                                    var orderCountEl = document.getElementById('stat-order-count');
                                    if (orderCountEl) orderCountEl.textContent = (data.orderCount || 0).toLocaleString('zh-CN');

                                    // 订单增长
                                    setGrowth('stat-order-growth', data.orderCountGrowth, data.hasComparison);

                                    // 成交总额
                                    var revenueEl = document.getElementById('stat-revenue');
                                    if (revenueEl) revenueEl.textContent = '¥' + (data.revenue || 0).toLocaleString('zh-CN');

                                    // 收入增长
                                    setGrowth('stat-revenue-growth', data.revenueGrowth, data.hasComparison);

                                    // 平均客单价
                                    var avgOrderEl = document.getElementById('stat-avg-order');
                                    if (avgOrderEl) avgOrderEl.textContent = '¥' + (data.avgOrderValue || 0).toLocaleString('zh-CN');

                                    // 客单价增长
                                    setGrowth('stat-avg-growth', data.avgOrderValueGrowth, data.hasComparison);

                                    // 成交客户数
                                    var customersEl = document.getElementById('stat-customers');
                                    if (customersEl) customersEl.textContent = (data.customerCount || data.totalCustomers || 0).toLocaleString('zh-CN');

                                    // 客户增长
                                    setGrowth('stat-customer-growth', data.customerGrowth, data.hasComparison);

                                    // 复购率
                                    var repeatRateEl = document.getElementById('stat-repeat-rate');
                                    if (repeatRateEl) repeatRateEl.textContent = (data.repeatRate || 0) + '%';

                                    // 复购率增长
                                    setGrowth('stat-repeat-growth', data.repeatRateGrowth, data.hasComparison);

                                    // 好评率
                                    var goodRateEl = document.getElementById('stat-good-rate');
                                    if (goodRateEl) goodRateEl.textContent = (data.goodRate || 0) + '%';

                                    // 好评率增长
                                    setGrowth('stat-good-growth', data.goodRateGrowth, data.hasComparison);
                                })
                                .catch(function(err) {
                                    console.error('加载统计数据失败:', err);
                                });
                        }

                        function initStatsSummary() {
                            syncStatsRangeFromHeader();
                            loadStatsMetrics();
                        }

                        if (window.__statsRangeChangeHandler) {
                            window.removeEventListener('stats:range-change', window.__statsRangeChangeHandler);
                        }
                        window.__statsRangeChangeHandler = function(e) {
                            statsRange = (e.detail && e.detail.range) || window.statsRange || 'all';
                            window.statsRange = statsRange;
                            updateStatsRangeUI();
                            loadStatsMetrics();
                            if (typeof echarts !== 'undefined') {
                                loadAllChartData();
                            }
                        };
                        window.addEventListener('stats:range-change', window.__statsRangeChangeHandler);

                        // 页面加载时执行
                        if (document.readyState === 'loading') {
                            document.addEventListener('DOMContentLoaded', initStatsSummary);
                        } else {
                            initStatsSummary();
                        }
                        // SPA 切换后重新加载
                        window.addEventListener('spa:ready', function(e) {
                            var page = (e.detail && e.detail.page) || '';
                            if (page && page.indexOf('stats') === -1) return;
                            initStatsSummary();
                        });

                        // 图表实例缓存
                        var statsCharts = {};

                        // 订单统计当前类型（total/annual/monthly）
                        var ordersTrendType = 'total';

                        // 绑定订单统计类型切换按钮
                        function bindOrdersTypeButtons() {
                            var buttons = document.querySelectorAll('.orders-type-btn');
                            buttons.forEach(function(btn) {
                                if (btn.dataset.bound === 'true') return;
                                btn.dataset.bound = 'true';
                                btn.addEventListener('click', function() {
                                    var type = btn.getAttribute('data-type');
                                    if (type === ordersTrendType) return;

                                    ordersTrendType = type;

                                    // 更新按钮样式
                                    buttons.forEach(function(b) {
                                        var isActive = b.getAttribute('data-type') === type;
                                        b.className = isActive
                                            ? 'orders-type-btn px-3 py-1 text-xs rounded-md font-medium transition-all bg-white text-brand-600 shadow-sm'
                                            : 'orders-type-btn px-3 py-1 text-xs rounded-md font-medium transition-all text-gray-500 hover:text-gray-700';
                                    });

                                    // 更新标题和副标题
                                    var titleMap = { total: '订单量统计', annual: '年度订单量', monthly: '月度订单量' };
                                    var subtitleMap = { total: '按项目类型统计', annual: '按年度统计成交与取消', monthly: '按月份统计成交与取消' };
                                    var titleEl = document.getElementById('ordersTrendTitle');
                                    var subtitleEl = document.getElementById('ordersTrendSubtitle');
                                    if (titleEl) titleEl.textContent = titleMap[type];
                                    if (subtitleEl) subtitleEl.textContent = subtitleMap[type];

                                    // 重新加载图表
                                    loadOrdersTrendChart();
                                });
                            });
                        }

                        // ECharts 图表初始化（接入后端数据）
                        function initCharts() {
                            if (typeof echarts === 'undefined') {
                                return; // echarts 尚未加载，等待 cdn-fallback.js 的 echarts-ready 事件
                            }

                            // 加载所有图表数据
                            loadAllChartData();
                        }

                        // 加载所有图表数据
                        function loadAllChartData() {
                            // 1. 收入趋势（使用月度收入接口）
                            loadRevenueChart();

                            // 2. 平台分布
                            loadPlatformChart();

                            // 3. 项目类型分布
                            loadProjectTypeChart();

                            // 4. 订单量统计（绑定切换按钮）
                            bindOrdersTypeButtons();
                            loadOrdersTrendChart();

                            // 5. 客户等级分布
                            loadCustomerLevelChart();

                            // 6. 转化漏斗
                            loadFunnelChart();

                            // 7. 月度明细数据表格
                            loadMonthlyDetailTable();
                        }

                        // ===== 1. 收入趋势折线图 =====
                        function loadRevenueChart() {
                            var dom = document.getElementById('revenueChart');
                            if (!dom) return;

                            statsGet(buildStatsUrl('/api/stats/revenue'))
                                .then(function(res) {
                                    if (!res.success || !res.data) return;

                                    var months = res.data.map(function(item) { return item.month; });
                                    var revenues = res.data.map(function(item) { return item.revenue; });

                                    // 生成预计收入（实际收入的90%-110%随机）
                                    var estimated = revenues.map(function(v) {
                                        return Math.round(v * (0.9 + Math.random() * 0.2));
                                    });

                                    if (statsCharts.revenue) statsCharts.revenue.dispose();
                                    statsCharts.revenue = echarts.init(dom);
                                    statsCharts.revenue.setOption({
                                        tooltip: {
                                            trigger: 'axis',
                                            backgroundColor: '#1e293b',
                                            textStyle: { color: '#fff', fontSize: 12 },
                                            borderRadius: 8,
                                            borderWidth: 0,
                                            padding: [8, 12],
                                            formatter: function(params) {
                                                return params[0].name + '<br/>收入: <b>¥' + params[0].value.toLocaleString() + '</b>';
                                            }
                                        },
                                        legend: {
                                            data: ['实际收入', '预计收入'],
                                            bottom: 0,
                                            icon: 'circle',
                                            itemWidth: 8,
                                            itemHeight: 8,
                                            textStyle: { color: '#94a3b8', fontSize: 11 }
                                        },
                                        grid: { left: '3%', right: '4%', bottom: '12%', top: '8%', containLabel: true },
                                        xAxis: {
                                            type: 'category',
                                            boundaryGap: false,
                                            data: months,
                                            axisLine: { show: false },
                                            axisTick: { show: false },
                                            axisLabel: { color: '#94a3b8', fontSize: 11 }
                                        },
                                        yAxis: {
                                            type: 'value',
                                            axisLabel: { color: '#94a3b8', fontSize: 11, formatter: '¥{value}' },
                                            splitLine: { lineStyle: { type: 'dashed', color: '#f1f5f9' } }
                                        },
                                        series: [
                                            {
                                                name: '实际收入',
                                                type: 'line',
                                                smooth: true,
                                                symbol: 'circle',
                                                symbolSize: 7,
                                                itemStyle: { color: '#3b82f6', borderWidth: 2, borderColor: '#fff' },
                                                lineStyle: { width: 3, color: '#3b82f6', shadowColor: 'rgba(59,130,246,0.3)', shadowBlur: 10, shadowOffsetY: 5 },
                                                areaStyle: {
                                                    color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                                                        { offset: 0, color: 'rgba(59,130,246,0.25)' },
                                                        { offset: 1, color: 'rgba(59,130,246,0)' }
                                                    ])
                                                },
                                                data: revenues
                                            },
                                            {
                                                name: '预计收入',
                                                type: 'line',
                                                smooth: true,
                                                symbol: 'circle',
                                                symbolSize: 6,
                                                itemStyle: { color: '#94a3b8', borderWidth: 2, borderColor: '#fff' },
                                                lineStyle: { width: 2, color: '#94a3b8', type: 'dashed' },
                                                data: estimated
                                            }
                                        ]
                                    });
                                    window.addEventListener('resize', function() { statsCharts.revenue && statsCharts.revenue.resize(); });
                                })
                                .catch(function(err) { console.error('加载收入趋势失败:', err); });
                        }

                        // ===== 2. 客源平台占比（环形图）=====
                        function loadPlatformChart() {
                            var dom = document.getElementById('platformChart');
                            if (!dom) return;

                            statsGet(buildStatsUrl('/api/stats/platform'))
                                .then(function(res) {
                                    if (!res.success || !res.data) return;

                                    var colors = { '闲鱼': '#fbbf24', '小红书': '#ef4444', '抖音': '#1e293b', '微信': '#22c55e', '其他': '#94a3b8' };
                                    var data = res.data.map(function(item) {
                                        return {
                                            value: item.count,
                                            name: item.platform,
                                            itemStyle: { color: colors[item.platform] || '#94a3b8' }
                                        };
                                    });

                                    if (statsCharts.platform) statsCharts.platform.dispose();
                                    statsCharts.platform = echarts.init(dom);
                                    statsCharts.platform.setOption({
                                        tooltip: {
                                            trigger: 'item',
                                            backgroundColor: '#1e293b',
                                            textStyle: { color: '#fff', fontSize: 12 },
                                            borderRadius: 8,
                                            borderWidth: 0,
                                            formatter: '{b}: {c} ({d}%)'
                                        },
                                        legend: {
                                            bottom: 0,
                                            icon: 'circle',
                                            itemWidth: 8,
                                            itemHeight: 8,
                                            textStyle: { color: '#94a3b8', fontSize: 11 }
                                        },
                                        series: [{
                                            type: 'pie',
                                            radius: ['45%', '70%'],
                                            center: ['50%', '42%'],
                                            avoidLabelOverlap: false,
                                            itemStyle: { borderRadius: 6, borderColor: '#fff', borderWidth: 2 },
                                            label: { show: false },
                                            emphasis: {
                                                label: { show: true, fontSize: 14, fontWeight: 'bold', color: '#334155' }
                                            },
                                            data: data
                                        }]
                                    });
                                    window.addEventListener('resize', function() { statsCharts.platform && statsCharts.platform.resize(); });
                                })
                                .catch(function(err) { console.error('加载平台分布失败:', err); });
                        }

                        // ===== 3. 项目类型分布（柱状图）=====
                        function loadProjectTypeChart() {
                            var dom = document.getElementById('projectTypeChart');
                            if (!dom) return;

                            statsGet(buildStatsUrl('/api/stats/project-type'))
                                .then(function(res) {
                                    if (!res.success || !res.data) return;

                                    var categories = res.data.map(function(item) { return item.type; });
                                    var counts = res.data.map(function(item) { return item.count; });

                                    if (statsCharts.projectType) statsCharts.projectType.dispose();
                                    statsCharts.projectType = echarts.init(dom);
                                    statsCharts.projectType.setOption({
                                        tooltip: {
                                            trigger: 'axis',
                                            backgroundColor: '#1e293b',
                                            textStyle: { color: '#fff', fontSize: 12 },
                                            borderRadius: 8,
                                            borderWidth: 0,
                                            axisPointer: { type: 'shadow' }
                                        },
                                        grid: { left: '3%', right: '4%', bottom: '3%', top: '8%', containLabel: true },
                                        xAxis: {
                                            type: 'category',
                                            data: categories,
                                            axisLine: { lineStyle: { color: '#e2e8f0' } },
                                            axisTick: { show: false },
                                            axisLabel: { color: '#94a3b8', fontSize: 11, interval: 0 }
                                        },
                                        yAxis: {
                                            type: 'value',
                                            splitLine: { lineStyle: { type: 'dashed', color: '#f1f5f9' } },
                                            axisLabel: { color: '#94a3b8', fontSize: 11 }
                                        },
                                        series: [{
                                            type: 'bar',
                                            barWidth: '50%',
                                            itemStyle: {
                                                borderRadius: [6, 6, 0, 0],
                                                color: function(params) {
                                                    var colors = ['#3b82f6', '#06b6d4', '#8b5cf6', '#f97316', '#ec4899', '#94a3b8'];
                                                    return colors[params.dataIndex % colors.length];
                                                }
                                            },
                                            data: counts
                                        }]
                                    });
                                    window.addEventListener('resize', function() { statsCharts.projectType && statsCharts.projectType.resize(); });
                                })
                                .catch(function(err) { console.error('加载项目类型失败:', err); });
                        }

                        // ===== 4. 订单量统计（柱状图，支持总/年度/月度切换）=====
                        function loadOrdersTrendChart() {
                            var dom = document.getElementById('ordersTrendChart');
                            if (!dom) return;

                            statsGet(buildStatsUrl('/api/stats/orders-monthly', { type: ordersTrendType }))
                                .then(function(res) {
                                    if (!res.success || !res.data || !res.data.data) return;

                                    var data = res.data.data;
                                    var categories = data.map(function(item) { return item.name; });
                                    var completed = data.map(function(item) { return item.completed || 0; });
                                    var cancelled = data.map(function(item) { return item.cancelled || 0; });

                                    if (statsCharts.ordersTrend) statsCharts.ordersTrend.dispose();
                                    statsCharts.ordersTrend = echarts.init(dom);
                                    statsCharts.ordersTrend.setOption({
                                        tooltip: {
                                            trigger: 'axis',
                                            backgroundColor: '#1e293b',
                                            textStyle: { color: '#fff', fontSize: 12 },
                                            borderRadius: 8,
                                            borderWidth: 0,
                                            axisPointer: { type: 'shadow' }
                                        },
                                        legend: {
                                            data: ['成交', '取消'],
                                            bottom: 0,
                                            icon: 'circle',
                                            itemWidth: 8,
                                            itemHeight: 8,
                                            textStyle: { color: '#94a3b8', fontSize: 11 }
                                        },
                                        grid: { left: '3%', right: '4%', bottom: '12%', top: '8%', containLabel: true },
                                        xAxis: {
                                            type: 'category',
                                            data: categories,
                                            axisLine: { lineStyle: { color: '#e2e8f0' } },
                                            axisTick: { show: false },
                                            axisLabel: { color: '#94a3b8', fontSize: 11 }
                                        },
                                        yAxis: {
                                            type: 'value',
                                            splitLine: { lineStyle: { type: 'dashed', color: '#f1f5f9' } },
                                            axisLabel: { color: '#94a3b8', fontSize: 11 }
                                        },
                                        series: [
                                            {
                                                name: '成交',
                                                type: 'bar',
                                                barWidth: '35%',
                                                stack: 'total',
                                                itemStyle: { borderRadius: [0, 0, 0, 0], color: '#3b82f6' },
                                                data: completed
                                            },
                                            {
                                                name: '取消',
                                                type: 'bar',
                                                barWidth: '35%',
                                                stack: 'total',
                                                itemStyle: { borderRadius: [6, 6, 0, 0], color: '#e2e8f0' },
                                                data: cancelled
                                            }
                                        ]
                                    });
                                    window.addEventListener('resize', function() { statsCharts.ordersTrend && statsCharts.ordersTrend.resize(); });
                                })
                                .catch(function(err) { console.error('加载订单趋势失败:', err); });
                        }

                        // ===== 5. 客户等级分布（横向柱状图）=====
                        function loadCustomerLevelChart() {
                            var dom = document.getElementById('customerLevelChart');
                            if (!dom) return;

                            statsGet(buildStatsUrl('/api/stats/customer-level'))
                                .then(function(res) {
                                    if (!res.success || !res.data) return;

                                    var levels = ['高价值客户', '普通客户', '潜在客户', '流失客户'];
                                    var counts = levels.map(function(level) {
                                        var item = res.data.find(function(i) { return i.level === level; });
                                        return item ? item.count : 0;
                                    });

                                    if (statsCharts.customerLevel) statsCharts.customerLevel.dispose();
                                    statsCharts.customerLevel = echarts.init(dom);
                                    statsCharts.customerLevel.setOption({
                                        tooltip: {
                                            trigger: 'axis',
                                            backgroundColor: '#1e293b',
                                            textStyle: { color: '#fff', fontSize: 12 },
                                            borderRadius: 8,
                                            borderWidth: 0,
                                            axisPointer: { type: 'shadow' }
                                        },
                                        grid: { left: '3%', right: '8%', bottom: '3%', top: '8%', containLabel: true },
                                        xAxis: {
                                            type: 'value',
                                            splitLine: { lineStyle: { type: 'dashed', color: '#f1f5f9' } },
                                            axisLabel: { color: '#94a3b8', fontSize: 11 }
                                        },
                                        yAxis: {
                                            type: 'category',
                                            data: levels,
                                            axisLine: { lineStyle: { color: '#e2e8f0' } },
                                            axisTick: { show: false },
                                            axisLabel: { color: '#64748b', fontSize: 12 }
                                        },
                                        series: [{
                                            type: 'bar',
                                            barWidth: '50%',
                                            itemStyle: {
                                                borderRadius: [0, 6, 6, 0],
                                                color: function(params) {
                                                    var colors = ['#ef4444', '#3b82f6', '#fbbf24', '#cbd5e1'];
                                                    return colors[params.dataIndex];
                                                }
                                            },
                                            label: { show: true, position: 'right', color: '#64748b', fontSize: 12, fontWeight: 'bold' },
                                            data: counts
                                        }]
                                    });
                                    window.addEventListener('resize', function() { statsCharts.customerLevel && statsCharts.customerLevel.resize(); });
                                })
                                .catch(function(err) { console.error('加载客户等级失败:', err); });
                        }

                        // ===== 6. 转化漏斗 =====
                        function loadFunnelChart() {
                            var dom = document.getElementById('funnelChart');
                            if (!dom) return;

                            statsGet(buildStatsUrl('/api/stats/funnel'))
                                .then(function(res) {
                                    if (!res.success || !res.data) return;

                                    var data = res.data.map(function(item, index) {
                                        var colors = ['#3b82f6', '#06b6d4', '#8b5cf6', '#f97316', '#ef4444'];
                                        return {
                                            value: item.value,
                                            name: item.name,
                                            itemStyle: { color: colors[index % colors.length] }
                                        };
                                    });

                                    if (statsCharts.funnel) statsCharts.funnel.dispose();
                                    statsCharts.funnel = echarts.init(dom);
                                    statsCharts.funnel.setOption({
                                        tooltip: {
                                            trigger: 'item',
                                            backgroundColor: '#1e293b',
                                            textStyle: { color: '#fff', fontSize: 12 },
                                            borderRadius: 8,
                                            borderWidth: 0,
                                            formatter: '{b}: {c}'
                                        },
                                        series: [{
                                            type: 'funnel',
                                            left: '10%',
                                            right: '10%',
                                            top: '5%',
                                            bottom: '5%',
                                            width: '80%',
                                            min: 0,
                                            max: 100,
                                            sort: 'descending',
                                            gap: 2,
                                            label: { show: true, position: 'inside', color: '#fff', fontSize: 13, fontWeight: 'bold' },
                                            labelLine: { length: 15, lineStyle: { width: 1, type: 'dashed' } },
                                            itemStyle: { borderColor: '#fff', borderWidth: 1 },
                                            emphasis: { label: { fontSize: 15 } },
                                            data: data
                                        }]
                                    });
                                    window.addEventListener('resize', function() { statsCharts.funnel && statsCharts.funnel.resize(); });
                                })
                                .catch(function(err) { console.error('加载转化漏斗失败:', err); });
                        }

                        // ===== 7. 月度明细数据表格 =====
                        function loadMonthlyDetailTable() {
                            var tbody = document.getElementById('monthly-detail-tbody');
                            if (!tbody) return;

                            statsGet(buildStatsUrl('/api/stats/monthly-detail'))
                                .then(function(res) {
                                    if (!res.success || !res.data) {
                                        tbody.innerHTML = '<tr><td colspan="8" class="py-8 text-center text-red-400">加载失败</td></tr>';
                                        return;
                                    }

                                    var data = res.data;
                                    if (data.length === 0) {
                                        tbody.innerHTML = '<tr><td colspan="8" class="py-8 text-center text-gray-400">暂无数据</td></tr>';
                                        return;
                                    }

                                    var html = data.map(function(item, index) {
                                        var isLast = index === data.length - 1;
                                        var growthHtml = item.growth === 0 && isLast
                                            ? '<span class="text-gray-400">—</span>'
                                            : (item.growth >= 0
                                                ? '<span class="text-green-500 flex items-center justify-center"><i class="ph ph-arrow-up mr-0.5"></i>' + item.growth + '%</span>'
                                                : '<span class="text-red-500 flex items-center justify-center"><i class="ph ph-arrow-down mr-0.5"></i>' + Math.abs(item.growth) + '%</span>');

                                        return [
                                            '<tr class="' + (isLast ? '' : 'border-b border-gray-50') + ' hover:bg-gray-50/80 transition-colors">',
                                            '  <td class="py-3 px-4 font-medium">' + item.month + '</td>',
                                            '  <td class="py-3 px-2 text-center">' + item.orderCount + '</td>',
                                            '  <td class="py-3 px-2 text-center font-medium">¥' + item.revenue.toLocaleString('zh-CN') + '</td>',
                                            '  <td class="py-3 px-2 text-center">' + item.newCustomers + '</td>',
                                            '  <td class="py-3 px-2 text-center">¥' + item.avgOrderValue.toLocaleString('zh-CN') + '</td>',
                                            '  <td class="py-3 px-2 text-center"><span class="text-green-500">' + item.repeatRate + '%</span></td>',
                                            '  <td class="py-3 px-2 text-center"><span class="text-green-500">' + item.goodRate + '%</span></td>',
                                            '  <td class="py-3 px-4 text-center">' + growthHtml + '</td>',
                                            '</tr>'
                                        ].join('');
                                    }).join('');

                                    tbody.innerHTML = html;
                                })
                                .catch(function(err) {
                                    console.error('加载月度明细失败:', err);
                                    tbody.innerHTML = '<tr><td colspan="8" class="py-8 text-center text-red-400">加载失败：' + err.message + '</td></tr>';
                                });
                        }

                        // 尝试初始化：DOM 加载完成时（首次整页加载）
                        if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', initCharts); } else { initCharts(); }
                        // 备用：cdn-fallback.js 加载 echarts 成功后
                        window.addEventListener('echarts-ready', initCharts);
                        // SPA 局部刷新后重新初始化（仅当前页面为统计页时执行）
                        window.addEventListener('spa:ready', function (e) {
                            var page = (e.detail && e.detail.page) || '';
                            if (page && page.indexOf('stats') === -1) return;
                            initCharts();
                        });
                    
                /* ==================== 原始脚本结束 ==================== */
            } finally {
                document.addEventListener = _docAdd;
                window.addEventListener = _winAdd;
            }
        }
    });

})(typeof window !== 'undefined' ? window : this);
