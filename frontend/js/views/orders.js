/**
 * 我的订单 视图
 *
 * 自动迁移自 frontend/pages/business/orders.html
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

    App.view('orders', {
        path: '/orders',
        nav: 'orders.html',
        title: '我的订单',
        template: 'views/orders.html',
        styles: 'css/views/orders.css',

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

                        // ========== 我的订单页面：后端 API 对接 ==========
                        (function () {
                            'use strict';

                            // ========== 实例标识（防止 SPA 多次切换后旧监听器累积） ==========
                            var instanceId = 'orders_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
                            window.__ordersActiveInstance = instanceId;

                            // ========== 常量与映射 ==========

                            var STATUS_LABEL_MAP = {
                                pending: '待确认需求',
                                processing: '开发/设计中',
                                acceptance: '待验收',
                                completed: '已完成',
                                closed: '已关闭'
                            };

                            var STATUS_CLASS_MAP = {
                                pending: 'status-closed',
                                processing: 'status-processing',
                                acceptance: 'status-acceptance',
                                completed: 'status-completed',
                                closed: 'status-closed'
                            };

                            var PROJECT_TYPES = ['网站开发', '小程序开发', 'UI/设计', '视频剪辑', '平面设计', '文案优化', '其他'];
                            var CUSTOMER_SOURCES = ['闲鱼', '小红书', '抖音', '微信', '淘宝', '朋友推荐', '其他'];
                            var CUSTOMER_TAGS = ['爽快型', '纠结比价型', '急单', '大厂员工', '复购客户', '高价值', '新客户'];

                            var TAG_COLOR_MAP = {
                                '急单': 'text-red-600 bg-red-50',
                                '复购客户': 'text-purple-600 bg-purple-50',
                                '高价值': 'text-blue-600 bg-blue-50',
                                '新客户': 'text-blue-600 bg-blue-50',
                                '爽快型': 'text-green-600 bg-green-50',
                                '纠结比价型': 'text-orange-600 bg-orange-50',
                                '大厂员工': 'text-indigo-600 bg-indigo-50'
                            };

                            var SOURCE_COLOR_MAP = {
                                '闲鱼': 'bg-yellow-50 text-yellow-600',
                                '小红书': 'bg-red-50 text-red-600',
                                '抖音': 'bg-gray-100 text-gray-600',
                                '微信': 'bg-green-50 text-green-600',
                                '淘宝': 'bg-orange-50 text-orange-600',
                                '朋友推荐': 'bg-blue-50 text-blue-600',
                                '其他': 'bg-gray-50 text-gray-500'
                            };

                            // ========== 页面状态 ==========

                            var state = {
                                page: 1,
                                pageSize: 10,
                                total: 0,
                                orders: [],
                                activeTab: 'all',
                                filters: {
                                    status: '',
                                    projectType: '全部类型',
                                    paymentStatus: '全部付款状态',
                                    customerSource: '全部来源',
                                    customerTag: '全部标签',
                                    keyword: ''
                                }
                            };

                            // ========== 工具函数 ==========

                            function api(url, options) {
                                if (!global.api || !global.api.call) {
                                    return Promise.reject(new Error('公共 api 未加载'));
                                }
                                options = options || {};
                                options.signal = ctx.signal;
                                return global.api.call(url, options);
                            }

                            function moneyNumber(value) {
                                if (typeof value === 'number') return value;
                                var num = parseFloat(String(value || '').replace(/[^\d.-]/g, ''));
                                return isNaN(num) ? 0 : num;
                            }

                            function formatMoney(value) {
                                var num = moneyNumber(value);
                                return num > 0 ? '¥ ' + num.toLocaleString('zh-CN') : '—';
                            }

                            function formatDateText(value) {
                                return value || '—';
                            }

                            function calcProfit(amount, cost) {
                                return moneyNumber(amount) - moneyNumber(cost);
                            }

                            function normalizeCycle(value, orderDate, finalDate) {
                                var text = String(value || '').trim();
                                if (text) return text.indexOf('天') === -1 ? text + ' 天' : text;
                                if (!orderDate || !finalDate) return '—';
                                var s = new Date(orderDate);
                                var e = new Date(finalDate);
                                if (isNaN(s) || isNaN(e)) return '—';
                                var diff = Math.round((e - s) / 86400000);
                                return diff >= 0 ? diff + ' 天' : '—';
                            }

                            function isOverdue(order) {
                                if (!order.finalDate) return false;
                                if (order.orderStatus === 'completed' || order.orderStatus === 'closed') return false;
                                var today = new Date();
                                today.setHours(0, 0, 0, 0);
                                var final = new Date(order.finalDate);
                                if (isNaN(final)) return false;
                                final.setHours(0, 0, 0, 0);
                                return final < today;
                            }

                            function escapeHtml(value) {
                                return String(value || '')
                                    .replace(/&/g, '&amp;')
                                    .replace(/</g, '&lt;')
                                    .replace(/>/g, '&gt;')
                                    .replace(/"/g, '&quot;')
                                    .replace(/'/g, '&#39;');
                            }

                            function getOrderTime(order) {
                                if (order.createdAt) {
                                    var d = new Date(order.createdAt);
                                    if (!isNaN(d)) {
                                        var hh = String(d.getHours()).padStart(2, '0');
                                        var mm = String(d.getMinutes()).padStart(2, '0');
                                        return hh + ':' + mm;
                                    }
                                }
                                return '';
                            }

                            function tagsToNames(tags) {
                                return (tags || []).map(function (tag) {
                                    return Array.isArray(tag) ? tag[0] : tag;
                                }).filter(Boolean);
                            }

                            function getFileIcon(file) {
                                var type = (file && (file.type || file.mimetype)) || '';
                                var name = (file && (file.name || file.originalName || file.filename)) || '';
                                if (type.startsWith('image/')) return 'ph-image text-blue-500';
                                if (type.indexOf('pdf') !== -1 || name.match(/\.pdf$/i)) return 'ph-file-pdf text-red-500';
                                if (type.indexOf('word') !== -1 || name.match(/\.(doc|docx)$/i)) return 'ph-file-doc text-blue-600';
                                if (type.indexOf('video') !== -1) return 'ph-video-camera text-purple-500';
                                return 'ph-file text-gray-500';
                            }

                            function fileNameOf(file) {
                                return (file && (file.name || file.originalName || file.filename)) || '未命名文件';
                            }

                            function fileUrlOf(file) {
                                var url = (file && file.url) || '';
                                if (!url) return '';
                                if (/^(https?:|data:|blob:|\/)/i.test(url)) return url;
                                return '/' + String(url).replace(/^\/+/, '');
                            }

                            function fileTypeOf(file) {
                                return (file && (file.type || file.mimetype)) || '';
                            }

                            function isImageFile(file) {
                                return fileTypeOf(file).indexOf('image/') === 0 || /\.(png|jpe?g|gif|webp)$/i.test(fileNameOf(file));
                            }

                            function isPdfFile(file) {
                                return fileTypeOf(file).indexOf('pdf') !== -1 || /\.pdf$/i.test(fileNameOf(file));
                            }

                            function isOfficeFile(file) {
                                return fileTypeOf(file).indexOf('word') !== -1 || /\.(doc|docx)$/i.test(fileNameOf(file));
                            }

                            function canPreviewFile(file) {
                                return !!(fileUrlOf(file) && (isImageFile(file) || isPdfFile(file) || isOfficeFile(file)));
                            }

                            function fileSizeText(size) {
                                var num = parseInt(size, 10) || 0;
                                if (!num) return '';
                                if (num >= 1024 * 1024) return (num / 1024 / 1024).toFixed(1) + ' MB';
                                return Math.max(1, Math.round(num / 1024)) + ' KB';
                            }

                function fileLabel(key) {
                            var labels = { screenshot: '需求沟通截图', showcase: '成品展示图', quote: '报价单', taskBook: '项目任务书', paymentRecord: '打款记录' };
                            return labels[key] || '附件';
                        }

                            function normalizePaymentRecords(value) {
                                if (!Array.isArray(value)) return [];
                                return value.map(function (item) {
                                    item = item || {};
                                    return {
                                        date: String(item.date || item.payDate || item.time || '').trim(),
                                        amount: Math.max(0, moneyNumber(item.amount)),
                                        note: String(item.note || item.remark || '').trim()
                                    };
                                }).filter(function (item) {
                                    return item.date || item.amount > 0 || item.note;
                                });
                            }

                            function paymentRecordsTotal(records) {
                                return normalizePaymentRecords(records).reduce(function (sum, item) {
                                    return sum + moneyNumber(item.amount);
                                }, 0);
                            }

                            function paymentInfo(order) {
                                order = order || {};
                                var amount = moneyNumber(order.amount);
                                var records = normalizePaymentRecords(order.paymentRecords);
                                var paidTotal = paymentRecordsTotal(records);
                                var ratio = parseInt(order.paymentRatio, 10) || 0;

                                if (paidTotal > 0 && amount > 0) {
                                    paidTotal = Math.min(paidTotal, amount);
                                    ratio = Math.min(Math.round(paidTotal / amount * 100), 100);
                                } else if (order.paymentStatus === '已结清') {
                                    ratio = 100;
                                    paidTotal = amount;
                                } else if (order.paymentStatus === '未付款') {
                                    ratio = 0;
                                    paidTotal = 0;
                                } else if (ratio > 0) {
                                    paidTotal = amount * ratio / 100;
                                }

                                return {
                                    records: records,
                                    paidTotal: paidTotal,
                                    ratio: Math.min(Math.max(ratio, 0), 100)
                                };
                            }

                            function renderPaymentRecordsDetail(order) {
                                var box = document.getElementById('detail-payment-records');
                                if (!box) return;
                                var records = normalizePaymentRecords(order && order.paymentRecords);
                                if (!records.length) {
                                    box.innerHTML = '<div class="rounded-lg border border-dashed border-gray-200 bg-gray-50/60 py-3 text-center text-xs text-gray-300">暂无分次付款记录</div>';
                                    return;
                                }
                                box.innerHTML = [
                                    '<p class="text-xs text-gray-400">分次付款记录</p>',
                                    records.map(function (item) {
                                        return '<div class="rounded-lg border border-gray-100 bg-gray-50/70 px-3 py-2 flex items-start justify-between gap-3">' +
                                            '<div class="min-w-0">' +
                                            '<p class="text-sm font-medium text-gray-700">' + formatMoney(item.amount) + '</p>' +
                                            (item.note ? '<p class="text-xs text-gray-400 truncate">' + escapeHtml(item.note) + '</p>' : '') +
                                            '</div>' +
                                            '<span class="text-xs text-gray-400 flex-shrink-0">' + escapeHtml(item.date || '未填日期') + '</span>' +
                                            '</div>';
                                    }).join('')
                                ].join('');
                            }

                            // ========== Toast ==========

                            var toastTimer = null;
                            function showToast(msg) {
                                var existing = document.getElementById('order-action-toast');
                                if (existing) existing.remove();
                                if (toastTimer) clearTimeout(toastTimer);

                                var toast = document.createElement('div');
                                toast.id = 'order-action-toast';
                                toast.className = 'fixed bottom-10 left-1/2 -translate-x-1/2 bg-gray-800 text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-2 transform translate-y-10 opacity-0 transition-all duration-300 pointer-events-none z-[90]';
                                toast.innerHTML = '<i class="ph-fill ph-check-circle text-green-400"></i><span>' + escapeHtml(msg) + '</span>';
                                document.body.appendChild(toast);

                                requestAnimationFrame(function () {
                                    toast.classList.remove('translate-y-10', 'opacity-0');
                                });

                                toastTimer = setTimeout(function () {
                                    toast.classList.add('translate-y-10', 'opacity-0');
                                    setTimeout(function () { toast.remove(); }, 300);
                                }, 2500);
                            }

                            function copyText(text, successMsg) {
                                if (!text) { showToast('暂无可复制内容'); return; }
                                if (navigator.clipboard && navigator.clipboard.writeText) {
                                    navigator.clipboard.writeText(text).then(function () { showToast(successMsg); }).catch(function () { fallbackCopy(text, successMsg); });
                                    return;
                                }
                                fallbackCopy(text, successMsg);
                            }

                            function fallbackCopy(text, successMsg) {
                                var input = document.createElement('textarea');
                                input.value = text;
                                input.className = 'fixed -left-[9999px] top-0';
                                document.body.appendChild(input);
                                input.focus();
                                input.select();
                                try { document.execCommand('copy'); showToast(successMsg); } catch (err) { showToast('复制失败，请手动复制'); }
                                input.remove();
                            }

                            // ========== 填充筛选器下拉选项 ==========

                            function populateFilterOptions() {
                                var ptSel = document.getElementById('filter-projectType');
                                if (ptSel) {
                                    // 清除旧选项（保留第一个占位选项），防止 SPA 重复进入时追加重复项
                                    while (ptSel.options.length > 1) ptSel.remove(1);
                                    PROJECT_TYPES.forEach(function (t) {
                                        var opt = document.createElement('option');
                                        opt.value = t; opt.textContent = t;
                                        ptSel.appendChild(opt);
                                    });
                                }
                                var csSel = document.getElementById('filter-customerSource');
                                if (csSel) {
                                    while (csSel.options.length > 1) csSel.remove(1);
                                    CUSTOMER_SOURCES.forEach(function (s) {
                                        var opt = document.createElement('option');
                                        opt.value = s; opt.textContent = s;
                                        csSel.appendChild(opt);
                                    });
                                }
                                var ctSel = document.getElementById('filter-customerTag');
                                if (ctSel) {
                                    while (ctSel.options.length > 1) ctSel.remove(1);
                                    CUSTOMER_TAGS.forEach(function (t) {
                                        var opt = document.createElement('option');
                                        opt.value = t; opt.textContent = t;
                                        ctSel.appendChild(opt);
                                    });
                                }
                            }

                            // ========== 加载统计数据 ==========

                            function loadStats() {
                                api('/api/orders/stats/summary').then(function (res) {
                                    if (!res.success) return;
                                    var d = res.data;
                                    setText('stat-total', d.total);
                                    setText('stat-total-sub', '营收 ¥' + moneyNumber(d.totalRevenue).toLocaleString('zh-CN'));
                                    setText('stat-processing', d.processing);
                                    setText('stat-processing-sub', '占比 ' + d.processingRate + '%');
                                    setText('stat-acceptance', d.acceptance);
                                    setText('stat-acceptance-sub', '占比 ' + d.acceptanceRate + '%');
                                    setText('stat-completed', d.completed);
                                    setText('stat-completed-sub', '占比 ' + d.completedRate + '%');
                                }).catch(function (err) {
                                    console.error('[Orders] 统计加载失败', err);
                                });
                            }

                            function setText(id, text) {
                                var el = document.getElementById(id);
                                if (el) el.textContent = text;
                            }

                            // ========== 加载订单列表 ==========

                            function loadOrders() {
                                var params = new URLSearchParams();
                                params.set('page', state.page);
                                params.set('pageSize', state.pageSize);

                                // Tab 筛选
                                if (state.activeTab === 'processing') {
                                    params.set('status', 'processing');
                                    params.set('excludeOverdue', '1');
                                } else if (state.activeTab === 'dueToday') {
                                    params.set('dueToday', '1');
                                } else if (state.activeTab === 'overdue') {
                                    params.set('overdue', '1');
                                }

                                // 筛选器
                                if (state.filters.status) params.set('status', state.filters.status);
                                if (state.filters.projectType && state.filters.projectType !== '全部类型') params.set('projectType', state.filters.projectType);
                                if (state.filters.paymentStatus && state.filters.paymentStatus !== '全部付款状态') params.set('paymentStatus', state.filters.paymentStatus);
                                if (state.filters.customerSource && state.filters.customerSource !== '全部来源') params.set('customerSource', state.filters.customerSource);
                                if (state.filters.customerTag && state.filters.customerTag !== '全部标签') params.set('customerTag', state.filters.customerTag);
                                if (state.filters.keyword) params.set('keyword', state.filters.keyword);

                                var tbody = document.getElementById('orders-tbody');
                                if (tbody) tbody.innerHTML = '<tr><td colspan="9" class="py-10 text-center text-gray-400">加载中...</td></tr>';

                                api('/api/orders?' + params.toString()).then(function (res) {
                                    if (!res.success) {
                                        if (tbody) tbody.innerHTML = '<tr><td colspan="9" class="py-10 text-center text-red-400">加载失败：' + escapeHtml(res.error || '') + '</td></tr>';
                                        renderEmptyDetailPanel('订单加载失败，请检查后端服务状态。');
                                        return;
                                    }
                                state.orders = res.data.list || [];
                                state.total = res.data.total || 0;
                                renderTable(state.orders);
                                renderPagination();

                                    // 默认选中第一条数据并显示详情
                                    if (state.orders.length > 0) {
                                        var firstOrder = state.orders[0];
                                        updateDetailPanel(firstOrder);
                                        // 高亮第一行
                                        setTimeout(function() {
                                            var firstRow = tbody.querySelector('tr[data-order-id]');
                                            if (firstRow) {
                                                firstRow.classList.add('bg-brand-50');
                                                firstRow.classList.remove('bg-brand-50/30');
                                            }
                                        }, 0);
                                    } else {
                                        renderEmptyDetailPanel();
                                    }
                                }).catch(function (err) {
                                    console.error('[Orders] 列表加载失败', err);
                                    if (tbody) tbody.innerHTML = '<tr><td colspan="9" class="py-10 text-center text-red-400">加载失败，请检查后端服务是否启动</td></tr>';
                                    renderEmptyDetailPanel('订单加载失败，请检查后端服务是否启动。');
                                });
                            }

                            // ========== 渲染表格 ==========

                            function renderTable(list) {
                                var tbody = document.getElementById('orders-tbody');
                                if (!tbody) return;

                                if (!list || !list.length) {
                                    tbody.innerHTML = '<tr><td colspan="9" class="py-10 text-center text-gray-400"><i class="ph ph-package text-3xl block mb-2 text-gray-300"></i>暂无订单数据</td></tr>';
                                    return;
                                }

                                tbody.innerHTML = list.map(function (order, idx) {
                                    var overdue = isOverdue(order);
                                    var statusText = overdue ? '已逾期' : (STATUS_LABEL_MAP[order.orderStatus] || '—');
                                    var statusClass = overdue ? 'status-overdue' : (STATUS_CLASS_MAP[order.orderStatus] || 'status-processing');
                                    var rowClass = 'table-row-item';
                                    if (idx === 0 && state.page === 1) rowClass += ' bg-brand-50/30';
                                    if (overdue) rowClass += ' bg-red-50/10';
                                    if (order.orderStatus === 'closed') rowClass += ' text-gray-500';

                                    var amountVal = moneyNumber(order.amount);
                                    var profitVal = calcProfit(order.amount, order.cost);
                                    var tags = tagsToNames(order.customerTags);
                                    var firstTag = tags[0];
                                    var tagHtml = firstTag ? '<span class="tag bg-blue-50 text-blue-600 border border-blue-100 mt-1">' + escapeHtml(firstTag) + '</span>' : '';
                                    var cycle = normalizeCycle('', order.orderDate, order.finalDate);
                                    var orderTime = getOrderTime(order);
                                    var opacityClass = order.orderStatus === 'closed' ? ' opacity-70' : '';

                                    return [
                                        '<tr class="' + rowClass + '" data-order-id="' + escapeHtml(order.id) + '">',
                                        '  <td class="py-4 px-4"><input type="checkbox" class="rounded border-gray-300 text-brand-600 focus:ring-brand-500"></td>',
                                        '  <td class="py-4 px-2' + opacityClass + '">',
                                        '    <p class="text-xs text-gray-400 mb-0.5">' + escapeHtml(order.orderNo || '') + '</p>',
                                        '    <div class="flex items-center gap-2"><span class="font-medium">' + escapeHtml(order.projectName || '') + '</span></div>',
                                        tagHtml,
                                        '  </td>',
                                        '  <td class="py-4 px-2' + opacityClass + '">',
                                        '    <p class="font-medium">' + escapeHtml(order.customerNick || '') + '</p>',
                                        '    <p class="text-xs text-gray-500 flex items-center gap-1 mt-0.5">' + escapeHtml(order.customerPhone || '') + (order.customerPhone ? ' <i class="ph-fill ph-wechat-logo text-green-500 text-sm"></i>' : '') + '</p>',
                                        '  </td>',
                                        '  <td class="py-4 px-2' + opacityClass + '"><span class="px-2.5 py-1 bg-gray-100 rounded text-xs text-gray-600">' + escapeHtml(order.projectType || '') + '</span></td>',
                                        '  <td class="py-4 px-2' + opacityClass + '">',
                                        '    <p class="font-medium text-gray-900">' + formatMoney(amountVal) + '</p>',
                                        '    <p class="text-xs text-gray-500 mt-0.5">利润 ' + formatMoney(profitVal) + '</p>',
                                        '  </td>',
                                        '  <td class="py-4 px-2"><span class="status-badge ' + statusClass + '">' + escapeHtml(statusText) + '</span></td>',
                                        '  <td class="py-4 px-2 text-gray-600">' + escapeHtml(cycle) + '</td>',
                                        '  <td class="py-4 px-2' + (overdue ? ' text-red-500' : '') + '">',
                                        '    <p>' + escapeHtml(order.orderDate || '—') + '</p>',
                                        '  </td>',
                                        '  <td class="py-4 px-4">',
                                        '    <div class="flex items-center justify-center gap-2">',
                                        '      <button class="order-view-btn w-7 h-7 rounded border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-100 hover:text-gray-800 transition"><i class="ph ph-eye"></i></button>',
                                        '      <button class="order-more-btn w-7 h-7 rounded border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-100 hover:text-gray-800 transition relative"><i class="ph ph-dots-three"></i></button>',
                                        '    </div>',
                                        '  </td>',
                                        '</tr>'
                                    ].join('');
                                }).join('');

                                bindTableActions();
                            }

                            // ========== 渲染分页 ==========

                            function renderPagination() {
                                var container = document.getElementById('orders-pagination');
                                if (!container) return;
                                var info = document.getElementById('pagination-info');
                                if (info) info.textContent = '共 ' + state.total + ' 条';

                                var pagesHtml = App.ui.paginationButtonsHtml({
                                    page: state.page,
                                    pageSize: state.pageSize,
                                    total: state.total,
                                    sizeSelectId: 'page-size-select'
                                });
                                container.innerHTML = '<div>共 ' + state.total + ' 条</div><div class="flex items-center gap-2">' + pagesHtml + '</div>';
                                App.ui.bindPagination(container, {
                                    page: state.page,
                                    pageSize: state.pageSize,
                                    total: state.total,
                                    sizeSelectId: 'page-size-select',
                                    onChange: function (page, pageSize) {
                                        state.page = page;
                                        state.pageSize = pageSize;
                                        loadOrders();
                                    }
                                });
                            }

                            // ========== 绑定筛选器 ==========

                            function bindFilters() {
                                var applyBtn = document.getElementById('filter-apply');
                                if (applyBtn) applyBtn.addEventListener('click', function () {
                                    collectFilters();
                                    state.page = 1;
                                    loadOrders();
                                });

                                var resetBtn = document.getElementById('filter-reset');
                                if (resetBtn) resetBtn.addEventListener('click', function () {
                                    document.getElementById('filter-projectType').value = '全部类型';
                                    document.getElementById('filter-status').value = '';
                                    document.getElementById('filter-paymentStatus').value = '全部付款状态';
                                    document.getElementById('filter-customerSource').value = '全部来源';
                                    document.getElementById('filter-customerTag').value = '全部标签';
                                    var kw = document.getElementById('filter-keyword');
                                    if (kw) kw.value = '';
                                    state.filters = { status: '', projectType: '全部类型', paymentStatus: '全部付款状态', customerSource: '全部来源', customerTag: '全部标签', keyword: '' };
                                    state.page = 1;
                                    loadOrders();
                                });

                                var kw = document.getElementById('filter-keyword');
                                if (kw) kw.addEventListener('keydown', function (e) {
                                    if (e.key === 'Enter') { collectFilters(); state.page = 1; loadOrders(); }
                                });
                            }

                            function collectFilters() {
                                state.filters.status = (document.getElementById('filter-status') || {}).value || '';
                                state.filters.projectType = (document.getElementById('filter-projectType') || {}).value || '全部类型';
                                state.filters.paymentStatus = (document.getElementById('filter-paymentStatus') || {}).value || '全部付款状态';
                                state.filters.customerSource = (document.getElementById('filter-customerSource') || {}).value || '全部来源';
                                state.filters.customerTag = (document.getElementById('filter-customerTag') || {}).value || '全部标签';
                                state.filters.keyword = ((document.getElementById('filter-keyword') || {}).value || '').trim();
                            }

                            // ========== 绑定标签页 ==========

                            function bindTabs() {
                                document.querySelectorAll('.order-tab').forEach(function (btn) {
                                    btn.addEventListener('click', function () {
                                        document.querySelectorAll('.order-tab').forEach(function (b) {
                                            b.classList.remove('border-brand-600', 'text-brand-600');
                                            b.classList.add('border-transparent', 'text-gray-500');
                                        });
                                        btn.classList.add('border-brand-600', 'text-brand-600');
                                        btn.classList.remove('border-transparent', 'text-gray-500');
                                        state.activeTab = btn.getAttribute('data-tab');
                                        state.page = 1;
                                        loadOrders();
                                    });
                                });
                            }

                            // ========== 表格行操作（事件委托） ==========

                            function bindTableActions() {
                                // 查看按钮
                                document.querySelectorAll('.order-view-btn').forEach(function (btn) {
                                    btn.addEventListener('click', function (e) {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        var row = btn.closest('tr');
                                        if (!row) return;
                                        var orderId = row.getAttribute('data-order-id');
                                        var order = state.orders.find(function (o) { return o.id === orderId; });
                                        if (order) updateDetailPanel(order);
                                    });
                                });

                                // 更多按钮
                                document.querySelectorAll('.order-more-btn').forEach(function (btn) {
                                    btn.addEventListener('click', function (e) {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        if (currentDropdown) { closeMenu(); return; }
                                        showMenu(btn);
                                    });
                                });
                            }

                            // ========== 更多按钮下拉菜单 ==========

                            var currentDropdown = null;

                            function createDropdown() {
                                var menu = document.createElement('div');
                                menu.className = 'order-action-menu fixed z-[55] bg-white rounded-lg shadow-lg border border-gray-100 py-1 w-36 opacity-0 scale-95 origin-top-right transition-all duration-150 pointer-events-none';
                                menu.innerHTML = [
                                    '<button class="order-action-item w-full px-3 py-2 text-left text-sm text-gray-600 hover:bg-gray-50 flex items-center gap-2 transition-colors"><i class="ph ph-pencil-simple text-base text-gray-400"></i> 编辑订单</button>',
                                    '<button class="order-action-item w-full px-3 py-2 text-left text-sm text-gray-600 hover:bg-gray-50 flex items-center gap-2 transition-colors"><i class="ph ph-copy text-base text-gray-400"></i> 复制订单</button>',
                                    '<div class="my-1 border-t border-gray-50"></div>',
                                    '<button class="order-action-item order-action-delete w-full px-3 py-2 text-left text-sm text-red-500 hover:bg-red-50 flex items-center gap-2 transition-colors"><i class="ph ph-trash text-base"></i> 删除订单</button>'
                                ].join('');
                                return menu;
                            }

                            function showMenu(btn) {
                                closeMenu();
                                var row = btn.closest('tr');
                                var orderId = row ? row.getAttribute('data-order-id') : '';
                                var order = state.orders.find(function (o) { return o.id === orderId; }) || {};

                                var menu = createDropdown();
                                document.body.appendChild(menu);
                                var rect = btn.getBoundingClientRect();
                                menu.style.left = (rect.right - 144) + 'px';
                                menu.style.top = (rect.bottom + 6) + 'px';
                                currentDropdown = menu;

                                requestAnimationFrame(function () {
                                    menu.classList.remove('opacity-0', 'scale-95', 'pointer-events-none');
                                });

                                // 删除
                                var deleteBtn = menu.querySelector('.order-action-delete');
                                if (deleteBtn) deleteBtn.addEventListener('click', function () {
                                    closeMenu();
                                    showDeleteConfirm(orderId, order);
                                });

                                // 编辑
                                var items = menu.querySelectorAll('.order-action-item:not(.order-action-delete)');
                                if (items[0]) items[0].addEventListener('click', function () {
                                    closeMenu();
                                    updateDetailPanel(order);
                                    if (typeof window.openOrderForm === 'function') window.openOrderForm(order);
                                });
                                // 复制
                                if (items[1]) items[1].addEventListener('click', function () {
                                    closeMenu();
                                    var text = [order.orderNo, order.projectName, order.customerNick, formatMoney(order.amount), order.paymentStatus, order.gitUrl].filter(Boolean).join(' | ');
                                    copyText(text, '订单信息已复制');
                                });
                            }

                            function closeMenu() {
                                if (currentDropdown) { currentDropdown.remove(); currentDropdown = null; }
                            }

                            document.addEventListener('click', function (e) {
                                if (currentDropdown && !e.target.closest('.order-action-menu') && !e.target.closest('.order-more-btn')) closeMenu();
                            });
                            document.addEventListener('scroll', closeMenu, true);

                            // ========== 删除确认 ==========

                            function showDeleteConfirm(orderId, order) {
                                var modal = document.createElement('div');
                                modal.id = 'order-delete-modal';
                                modal.className = 'fixed inset-0 z-[80] flex items-center justify-center p-4';
                                modal.innerHTML = [
                                    '<div class="absolute inset-0 bg-black/40"></div>',
                                    '<div class="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 z-10">',
                                    '  <div class="flex items-start gap-3 mb-5">',
                                    '    <div class="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center flex-shrink-0"><i class="ph-fill ph-warning text-red-500 text-xl"></i></div>',
                                    '    <div>',
                                    '      <h3 class="font-bold text-gray-800 text-base mb-1">确认删除该订单？</h3>',
                                    '      <p class="text-sm text-gray-500 leading-relaxed">订单 <span class="font-medium text-gray-700">' + escapeHtml(order.projectName || '') + '</span>（' + escapeHtml(order.orderNo || '') + '）删除后不可恢复，确定要继续吗？</p>',
                                    '    </div>',
                                    '  </div>',
                                    '  <div class="flex gap-3 justify-end">',
                                    '    <button id="order-delete-cancel" class="px-5 py-2 border border-gray-200 text-gray-600 bg-white rounded-lg hover:bg-gray-50 transition text-sm font-medium">取消</button>',
                                    '    <button id="order-delete-confirm" class="px-5 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition text-sm font-medium shadow-sm shadow-red-500/30 flex items-center gap-1.5"><i class="ph ph-trash"></i>确认删除</button>',
                                    '  </div>',
                                    '</div>'
                                ].join('');
                                document.body.appendChild(modal);
                                document.body.style.overflow = 'hidden';

                                function closeModal() { modal.remove(); document.body.style.overflow = ''; }

                                modal.querySelector('#order-delete-cancel').addEventListener('click', closeModal);
                                modal.querySelector('.absolute').addEventListener('click', closeModal);

                                modal.querySelector('#order-delete-confirm').addEventListener('click', function () {
                                    modal.querySelector('#order-delete-confirm').innerHTML = '<i class="ph ph-spinner animate-spin"></i> 删除中...';
                                    modal.querySelector('#order-delete-confirm').disabled = true;

                                    api('/api/orders/' + encodeURIComponent(orderId), { method: 'DELETE' }).then(function (res) {
                                        if (res.success) {
                                            closeModal();
                                            showToast('订单已删除');
                                            loadOrders();
                                            loadStats();
                                        } else {
                                            modal.querySelector('#order-delete-confirm').innerHTML = '<i class="ph ph-trash"></i>确认删除';
                                            modal.querySelector('#order-delete-confirm').disabled = false;
                                            showToast('删除失败：' + (res.error || ''));
                                        }
                                    }).catch(function (err) {
                                        modal.querySelector('#order-delete-confirm').innerHTML = '<i class="ph ph-trash"></i>确认删除';
                                        modal.querySelector('#order-delete-confirm').disabled = false;
                                        showToast('删除失败：' + err.message);
                                    });
                                });

                                document.addEventListener('keydown', function esc(e) {
                                    if (e.key === 'Escape' && document.getElementById('order-delete-modal')) {
                                        document.removeEventListener('keydown', esc);
                                        closeModal();
                                    }
                                });
                            }

                            // ========== 详情面板 ==========

                function normalizeAttachmentList(value) {
                            if (!value) return [];
                            return Array.isArray(value) ? value.filter(Boolean) : [value];
                        }

                            function renderAttachments(files) {
                                var box = document.getElementById('detail-attachments');
                                if (!box) return;
                                files = files || {};
                                var keys = ['taskBook', 'quote', 'screenshot', 'showcase', 'paymentRecord'];
                                var html = keys.map(function (key) {
                                    var items = normalizeAttachmentList(files[key]);
                                    return items.map(function (file, index) {
                                        var url = fileUrlOf(file);
                                        var canDownload = !!url;
                                        var previewHtml = canPreviewFile(file)
                                            ? '<button type="button" class="detail-file-preview text-xs text-gray-600 hover:text-brand-600 font-medium flex items-center gap-1" data-file-key="' + key + '" data-file-index="' + index + '"><i class="ph ph-eye"></i>预览</button>'
                                            : '';
                                        var downloadHtml = canDownload
                                            ? '<button type="button" class="detail-file-download text-xs text-brand-600 hover:text-brand-700 font-medium flex items-center gap-1" data-file-key="' + key + '" data-file-index="' + index + '"><i class="ph ph-download-simple"></i>下载</button>'
                                            : '<span class="text-xs text-gray-300">未保存文件</span>';
                                        var iconHtml = isImageFile(file) && url
                                            ? '<img src="' + escapeHtml(url) + '" class="w-10 h-10 rounded-lg object-cover border border-gray-100 flex-shrink-0" alt="">'
                                            : '<i class="ph ' + getFileIcon(file) + ' text-lg flex-shrink-0"></i>';
                                        return [
                                            '<div class="flex items-center gap-3 rounded-lg border border-gray-100 bg-gray-50/70 px-3 py-2">',
                                            '  ' + iconHtml,
                                            '  <div class="min-w-0 flex-1">',
                                            '    <p class="text-xs text-gray-400">' + fileLabel(key) + (items.length > 1 ? ' #' + (index + 1) : '') + '</p>',
                                            '    <p class="text-sm text-gray-700 truncate">' + escapeHtml(fileNameOf(file)) + '</p>',
                                            fileSizeText(file.size) ? '    <p class="text-[10px] text-gray-400">' + fileSizeText(file.size) + '</p>' : '',
                                            '  </div>',
                                            '  <div class="flex items-center gap-2 flex-shrink-0">',
                                            previewHtml,
                                            downloadHtml,
                                            '  </div>',
                                            '</div>'
                                        ].join('');
                                    }).join('');
                                }).join('');
                                box.innerHTML = html || '<div class="rounded-lg border border-dashed border-gray-200 py-4 text-center text-xs text-gray-300">暂无附件</div>';
                            }

                            function fileFromAttachmentButton(btn) {
                                var key = btn.getAttribute('data-file-key');
                                var index = parseInt(btn.getAttribute('data-file-index'), 10) || 0;
                                var data = window.__currentOrderData || {};
                                var items = normalizeAttachmentList(data.uploadedFiles && data.uploadedFiles[key]);
                                return items[index] || null;
                            }

                            function openImagePreview(file) {
                                var existing = document.getElementById('order-file-preview-modal');
                                if (existing) existing.remove();
                                var modal = document.createElement('div');
                                modal.id = 'order-file-preview-modal';
                                modal.className = 'fixed inset-0 z-[70] flex items-center justify-center p-4';
                                modal.innerHTML = [
                                    '<div class="absolute inset-0 bg-black/60" data-preview-close="1"></div>',
                                    '<div class="relative max-w-5xl w-full max-h-[90vh] bg-white rounded-xl shadow-2xl overflow-hidden">',
                                    '  <div class="h-12 px-4 border-b border-gray-100 flex items-center justify-between gap-3">',
                                    '    <p class="text-sm font-medium text-gray-700 truncate">' + escapeHtml(fileNameOf(file)) + '</p>',
                                    '    <button type="button" class="w-8 h-8 rounded-lg hover:bg-gray-100 text-gray-500 flex items-center justify-center" data-preview-close="1"><i class="ph ph-x"></i></button>',
                                    '  </div>',
                                    '  <div class="bg-gray-950/95 flex items-center justify-center max-h-[calc(90vh-3rem)] overflow-auto">',
                                    '    <img src="' + escapeHtml(fileUrlOf(file)) + '" class="max-w-full max-h-[calc(90vh-3rem)] object-contain" alt="">',
                                    '  </div>',
                                    '</div>'
                                ].join('');
                                document.body.appendChild(modal);
                                modal.addEventListener('click', function (e) {
                                    if (e.target.closest('[data-preview-close]')) modal.remove();
                                });
                            }

                            function previewFile(file) {
                                var url = fileUrlOf(file);
                                if (!file || !url) {
                                    showToast('当前文件没有可预览地址');
                                    return;
                                }
                                if (isImageFile(file)) {
                                    openImagePreview(file);
                                    return;
                                }
                                window.open(url, '_blank', 'noopener');
                            }

                            function setDetailActionsEnabled(enabled) {
                                ['order-detail-edit-btn', 'order-detail-quote-btn', 'detail-copy-git-btn'].forEach(function (id) {
                                    var btn = document.getElementById(id);
                                    if (!btn) return;
                                    btn.disabled = !enabled;
                                    btn.classList.toggle('opacity-50', !enabled);
                                    btn.classList.toggle('cursor-not-allowed', !enabled);
                                });
                            }

                            function renderEmptyDetailPanel(message) {
                                window.__currentOrderData = null;
                                setText('detail-order-no', '暂无订单');
                                setText('detail-order-name', '暂无订单数据');
                                setText('detail-customer-name', '未选择客户');
                                setText('detail-customer-phone-text', '暂无号码');
                                setText('detail-real-name', '—');
                                setText('detail-project-type', '—');
                                setText('detail-project-name', '—');
                                setText('detail-project-desc', message || '暂无订单数据，创建订单后这里会显示完整详情。');
                                setText('detail-amount', '—');
                                setText('detail-cost', '—');
                                setText('detail-profit', '—');
                                setText('detail-hours', '—');
                                setText('detail-margin', '—');
                                setText('detail-rate', '—');
                                setText('detail-order-date', '—');
                                setText('detail-confirm-date', '—');
                                setText('detail-draft-date', '—');
                                setText('detail-cycle', '—');
                                setText('detail-delivery-date', '—');
                                setText('detail-payment-status', '—');
                                setText('detail-payment-ratio', '—');
                                setText('detail-payment-amount', '—');
                                setText('detail-pay-date', '—');
                                setText('detail-git-url', '未填写');
                                setText('detail-quote-ref', '—');

                                var badge = document.getElementById('detail-status-badge');
                                if (badge) {
                                    badge.textContent = '未选择';
                                    badge.className = 'status-badge text-[10px] py-0.5 bg-gray-100 text-gray-500';
                                }

                                var bar = document.getElementById('detail-payment-bar');
                                if (bar) bar.style.width = '0%';

                                var sourceEl = document.getElementById('detail-source');
                                if (sourceEl) {
                                    sourceEl.textContent = '—';
                                    sourceEl.className = 'px-2 py-0.5 bg-gray-50 text-gray-500 rounded text-xs font-medium';
                                }

                                var tagsEl = document.getElementById('detail-tags');
                                if (tagsEl) tagsEl.innerHTML = '<span class="text-xs text-gray-300">暂无标签</span>';

                                renderAttachments({});
                                renderPaymentRecordsDetail(null);
                                setDetailActionsEnabled(false);
                            }

                            function updateDetailPanel(order) {
                                if (!order) {
                                    renderEmptyDetailPanel();
                                    return;
                                }
                                window.__currentOrderData = order;
                                setDetailActionsEnabled(true);

                                var amountVal = moneyNumber(order.amount);
                                var costVal = moneyNumber(order.cost);
                                var profitVal = calcProfit(amountVal, costVal);
                                var margin = amountVal > 0 ? (profitVal / amountVal * 100).toFixed(1) + '%' : '—';
                                var rate = order.hours > 0 ? '¥ ' + (profitVal / order.hours).toFixed(1) + '/h' : '—';
                                var overdue = isOverdue(order);
                                var statusText = overdue ? '已逾期' : (STATUS_LABEL_MAP[order.orderStatus] || '—');
                                var statusClass = overdue ? 'status-overdue' : (STATUS_CLASS_MAP[order.orderStatus] || 'status-processing');

                                setText('detail-order-no', order.orderNo);
                                setText('detail-order-name', order.projectName);
                                setText('detail-customer-name', order.customerNick);
                                setText('detail-customer-phone-text', order.customerPhone || '暂无号码');
                                setText('detail-real-name', order.customerName || '—');
                                setText('detail-project-type', order.projectType);
                                setText('detail-project-name', order.projectName);
                                setText('detail-project-desc', order.projectDesc);
                                setText('detail-amount', formatMoney(amountVal));
                                setText('detail-cost', costVal > 0 ? formatMoney(costVal) : '—');
                                setText('detail-profit', formatMoney(profitVal));
                                setText('detail-hours', order.hours ? order.hours + ' 小时' : '—');
                                setText('detail-margin', margin);
                                setText('detail-rate', rate);
                                setText('detail-order-date', order.orderDate || '—');
                                setText('detail-confirm-date', formatDateText(order.confirmDate));
                                setText('detail-draft-date', formatDateText(order.draftDate));
                                setText('detail-cycle', normalizeCycle('', order.orderDate, order.finalDate));
                                setText('detail-delivery-date', formatDateText(order.finalDate));
                                setText('detail-source', order.customerSource);
                                var payInfo = paymentInfo(order);
                                var payRatioText = order.paymentStatus === '已结清' && !payInfo.records.length
                                    ? '已结清'
                                    : (payInfo.ratio > 0 ? '已付 ' + payInfo.ratio + '%' : '未付款');
                                setText('detail-payment-status', order.paymentStatus || '—');
                                setText('detail-payment-ratio', payRatioText);
                                setText('detail-payment-amount', payInfo.paidTotal > 0 ? formatMoney(payInfo.paidTotal) : '—');
                                setText('detail-pay-date', formatDateText(order.payDate));
                                setText('detail-git-url', order.gitUrl || '未填写');
                                setText('detail-quote-ref', order.quoteRef || '—');

                                var badge = document.getElementById('detail-status-badge');
                                if (badge) { badge.textContent = statusText; badge.className = 'status-badge text-[10px] py-0.5 ' + statusClass; }

                                var bar = document.getElementById('detail-payment-bar');
                                if (bar) bar.style.width = payInfo.ratio + '%';

                                var sourceEl = document.getElementById('detail-source');
                                if (sourceEl) {
                                    var sc = SOURCE_COLOR_MAP[order.customerSource] || 'bg-gray-50 text-gray-500';
                                    sourceEl.className = 'px-2 py-0.5 rounded text-xs font-medium inline-flex items-center gap-1 ' + sc;

                                    // 平台图标映射
                                    var PLATFORM_ICONS = {
                                        '闲鱼': '闲鱼.svg',
                                        '小红书': '小红书.svg',
                                        '抖音': '抖音.svg'
                                    };

                                    var iconFile = PLATFORM_ICONS[order.customerSource];
                                    if (iconFile) {
                                        var base = window.PAGE_BASE || '../../';
                                        sourceEl.innerHTML = '<img src="' + base + 'assets/svg/' + iconFile + '" class="w-3.5 h-3.5" alt="">' + escapeHtml(order.customerSource);
                                    } else {
                                        sourceEl.textContent = order.customerSource;
                                    }
                                }

                                var tagsEl = document.getElementById('detail-tags');
                                if (tagsEl) {
                                    tagsEl.innerHTML = tagsToNames(order.customerTags).map(function (tag) {
                                        var color = TAG_COLOR_MAP[tag] || 'text-blue-600 bg-blue-50';
                                        return '<span class="text-[10px] ' + color + ' px-1.5 py-0.5 rounded">' + escapeHtml(tag) + '</span>';
                                    }).join('') || '<span class="text-xs text-gray-300">—</span>';
                                }

                                renderAttachments(order.uploadedFiles || {});
                                renderPaymentRecordsDetail(order);
                            }

                            // ========== 详情面板交互 ==========

                            function bindDetailInteractions() {
                                var copyGitBtn = document.getElementById('detail-copy-git-btn');
                                if (copyGitBtn && !copyGitBtn.dataset.bound) {
                                    copyGitBtn.dataset.bound = 'true';
                                    copyGitBtn.addEventListener('click', function () {
                                        var data = window.__currentOrderData || {};
                                        if (!data.gitUrl) {
                                            showToast('暂无仓库链接');
                                            return;
                                        }
                                        copyText(data.gitUrl || '', '仓库链接已复制');
                                    });
                                }

                                var attachments = document.getElementById('detail-attachments');
                                if (attachments && !attachments.dataset.bound) {
                                    attachments.dataset.bound = 'true';
                                    attachments.addEventListener('click', function (e) {
                                        var previewBtn = e.target.closest('.detail-file-preview');
                                        if (previewBtn) {
                                            previewFile(fileFromAttachmentButton(previewBtn));
                                            return;
                                        }
                                        var btn = e.target.closest('.detail-file-download');
                                        if (!btn) return;
                                        var file = fileFromAttachmentButton(btn);
                                        var fileUrl = fileUrlOf(file);
                                        if (file && fileUrl) {
                                            var link = document.createElement('a');
                                            link.href = fileUrl; link.download = fileNameOf(file) || 'download';
                                            document.body.appendChild(link); link.click(); link.remove();
                                        } else {
                                            showToast('当前文件没有可下载地址');
                                        }
                                    });
                                }

                                // 客户号码点击复制
                                var phoneEl = document.getElementById('detail-customer-phone');
                                if (phoneEl && !phoneEl.dataset.bound) {
                                    phoneEl.dataset.bound = 'true';
                                    phoneEl.addEventListener('click', function () {
                                        var data = window.__currentOrderData || {};
                                        var phone = data.customerPhone || '';
                                        if (phone) {
                                            copyText(phone, '客户号码已复制');
                                        } else {
                                            showToast('暂无客户号码');
                                        }
                                    });
                                }

                                // 详情面板编辑按钮
                                var editBtn = document.getElementById('order-detail-edit-btn');
                                if (editBtn && !editBtn.dataset.bound) {
                                    editBtn.dataset.bound = 'true';
                                    editBtn.addEventListener('click', function () {
                                        if (typeof window.openOrderForm !== 'function') {
                                            showToast('表单组件加载中，请稍后重试');
                                            return;
                                        }
                                        if (!window.__currentOrderData) {
                                            showToast('请先选择订单');
                                            return;
                                        }
                                        window.openOrderForm(window.__currentOrderData);
                                    });
                                }

                                // 详情面板报价单按钮
                                var quoteBtn = document.getElementById('order-detail-quote-btn');
                                if (quoteBtn && !quoteBtn.dataset.bound) {
                                    quoteBtn.dataset.bound = 'true';
                                    quoteBtn.addEventListener('click', function () {
                                        if (!window.__currentOrderData) {
                                            showToast('请先选择订单');
                                            return;
                                        }
                                        showQuotePreview();
                                    });
                                }

                                // 详情内 tabs
                                document.querySelectorAll('.detail-tab-btn').forEach(function (btn) {
                                    if (btn.dataset.tabBound) return;
                                    btn.dataset.tabBound = 'true';
                                    btn.addEventListener('click', function () {
                                        var tab = btn.getAttribute('data-detail-tab');
                                        document.querySelectorAll('.detail-tab-btn').forEach(function (b) {
                                            b.classList.toggle('border-brand-600', b === btn);
                                            b.classList.toggle('text-brand-600', b === btn);
                                            b.classList.toggle('font-medium', b === btn);
                                            b.classList.toggle('border-transparent', b !== btn);
                                            b.classList.toggle('text-gray-500', b !== btn);
                                        });
                                        document.querySelectorAll('.detail-tab-panel').forEach(function (p) {
                                            p.classList.toggle('hidden', p.getAttribute('data-detail-panel') !== tab);
                                        });
                                    });
                                });
                            }

                            // ========== 报价单预览 ==========

                            function showQuotePreview() {
                                var order = window.__currentOrderData || {};
                                var existing = document.getElementById('quote-preview-modal');
                                if (existing) existing.remove();

                                var quoteData = {
                                    projectName: order.projectName || '未命名项目',
                                    customerName: order.customerNick || '—',
                                    quoteDate: order.orderDate || '—',
                                    cycle: normalizeCycle('', order.orderDate, order.finalDate).replace(' 天', ''),
                                    discount: '0',
                                    paymentMethod: order.paymentStatus === '已结清' ? '已全额收款' : '按约定比例分期付款',
                                    notes: '1. 本报价有效期为 7 天。\n2. 免费提供首年服务器日常维护及程序Bug修复。\n3. 超出上述需求范围的新增功能，需另行评估报价。',
                                    items: [{ name: order.projectType || '开发服务', qty: 1, price: moneyNumber(order.amount), desc: order.projectDesc || '' }]
                                };

                                function fmtMoney(n) { return parseFloat(n || 0).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
                                var subtotal = quoteData.items.reduce(function (s, i) { return s + i.qty * i.price; }, 0);
                                var total = subtotal - parseFloat(quoteData.discount || 0);

                                var itemsHtml = quoteData.items.map(function (item, i) {
                                    var amt = item.qty * item.price;
                                    return '<div class="grid grid-cols-12 gap-2 items-start">' +
                                        '<div class="col-span-7"><p class="font-semibold text-gray-800">' + (i + 1) + '. ' + escapeHtml(item.name) + '</p>' +
                                        (item.desc ? '<p class="text-xs text-gray-500 mt-1 leading-relaxed">' + escapeHtml(item.desc) + '</p>' : '') + '</div>' +
                                        '<div class="col-span-2 text-center text-gray-600 mt-0.5">' + item.qty + '</div>' +
                                        '<div class="col-span-3 text-right font-medium text-gray-800 mt-0.5">' + fmtMoney(amt) + '</div></div>';
                                }).join('');

                                var notesHtml = '<p><strong>付款方式：</strong> ' + escapeHtml(quoteData.paymentMethod) + '</p>';
                                quoteData.notes.split('\n').forEach(function (line) { if (line.trim()) notesHtml += '<p>' + escapeHtml(line.trim()) + '</p>'; });

                                var modalHtml = [
                                    '<div id="quote-preview-modal" class="fixed inset-0 z-[60] flex items-center justify-center p-4">',
                                    '  <div id="quote-modal-overlay" class="absolute inset-0 bg-black/40"></div>',
                                    '  <div class="relative bg-[#f9fafb] rounded-2xl shadow-2xl w-full max-w-[600px] max-h-[92vh] flex flex-col z-10">',
                                    '    <div class="flex items-center justify-between px-5 py-4 border-b border-gray-100 bg-white rounded-t-2xl flex-shrink-0">',
                                    '      <div class="flex items-center gap-2"><i class="ph-fill ph-file-text text-brand-500 text-lg"></i><h3 class="font-bold text-gray-800 text-base">报价单预览</h3></div>',
                                    '      <button id="quote-modal-close" class="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition"><i class="ph ph-x text-lg"></i></button>',
                                    '    </div>',
                                    '    <div class="flex items-center gap-2 px-5 py-3 border-b border-gray-100 bg-white flex-shrink-0">',
                                    '      <button id="quote-copy-btn" class="flex-1 bg-gray-900 hover:bg-gray-800 text-white py-2 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 transition-colors"><i class="ph ph-copy"></i> 复制文本</button>',
                                    '      <button id="quote-pdf-btn" class="flex-1 bg-brand-600 hover:bg-brand-700 text-white py-2 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 transition-colors"><i class="ph ph-file-pdf"></i> 导出 PDF</button>',
                                    '      <button id="quote-png-btn" class="flex-1 bg-green-600 hover:bg-green-700 text-white py-2 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 transition-colors"><i class="ph ph-file-image"></i> 导出 PNG</button>',
                                    '    </div>',
                                    '    <div class="flex-1 overflow-y-auto p-6">',
                                    '      <div class="paper-preview overflow-hidden" id="quote-modal-paper">',
                                    '        <div class="absolute top-0 right-0 w-32 h-32 bg-brand-50 rounded-bl-full -z-10 opacity-50"></div>',
                                    '        <div class="flex justify-between items-end mb-6">',
                                    '          <div><h2 class="text-2xl font-bold text-gray-900 tracking-wide mb-1">开发报价单</h2></div>',
                                    '          <div class="text-right"><div class="w-8 h-8 bg-brand-600 rounded flex items-center justify-center text-white ml-auto mb-1"><i class="ph-fill ph-bag text-sm"></i></div><p class="text-xs font-semibold text-gray-800">JERN工作室</p></div>',
                                    '        </div>',
                                    '        <div class="bg-gray-50/80 rounded-md p-4 mb-6 grid grid-cols-2 gap-y-2 text-sm border border-gray-100/50">',
                                    '          <div class="flex"><span class="text-gray-500 w-16">项目名称：</span><span class="text-gray-800 font-medium truncate">' + escapeHtml(quoteData.projectName) + '</span></div>',
                                    '          <div class="flex"><span class="text-gray-500 w-16">报价日期：</span><span class="text-gray-800">' + escapeHtml(quoteData.quoteDate) + '</span></div>',
                                    '          <div class="flex"><span class="text-gray-500 w-16">客户名称：</span><span class="text-gray-800">' + escapeHtml(quoteData.customerName) + '</span></div>',
                                    '          <div class="flex"><span class="text-gray-500 w-16">预计周期：</span><span class="text-gray-800">' + escapeHtml(quoteData.cycle) + ' 工作日</span></div>',
                                    '        </div>',
                                    '        <div class="grid grid-cols-12 gap-2 text-xs font-medium text-gray-500 mb-2 px-2"><div class="col-span-7">服务明细 (内容描述)</div><div class="col-span-2 text-center">数量</div><div class="col-span-3 text-right">金额 (¥)</div></div>',
                                    '        <div class="h-px bg-gray-800 mb-3"></div>',
                                    '        <div class="space-y-4 text-sm px-2 min-h-[200px]">' + itemsHtml + '</div>',
                                    '        <div class="paper-dash-line"></div>',
                                    '        <div class="w-full flex justify-end mb-8"><div class="w-1/2 space-y-2">',
                                    '          <div class="flex justify-between text-sm text-gray-600"><span>小计：</span><span>¥ ' + fmtMoney(subtotal) + '</span></div>',
                                    '          <div class="flex justify-between text-sm text-red-500"><span>优惠折扣：</span><span>- ¥ ' + fmtMoney(parseFloat(quoteData.discount || 0)) + '</span></div>',
                                    '          <div class="h-px bg-gray-200 my-1"></div>',
                                    '          <div class="flex justify-between items-end"><span class="font-medium text-gray-800">总计金额：</span><span class="text-xl font-bold text-gray-900 font-mono">¥ ' + fmtMoney(total) + '</span></div>',
                                    '        </div></div>',
                                    '        <div class="bg-blue-50/50 rounded p-4 border border-blue-100/50"><h4 class="text-xs font-semibold text-gray-800 mb-2 flex items-center gap-1"><i class="ph-fill ph-warning-circle text-blue-500"></i> 补充说明及付款方式</h4><div class="text-[11px] text-gray-600 leading-relaxed space-y-1">' + notesHtml + '</div></div>',
                                    '        <div class="text-center mt-8 text-[10px] text-gray-400">生成自 文的项目工作台 - 科技赋能自由开发</div>',
                                    '      </div>',
                                    '    </div>',
                                    '  </div>',
                                    '</div>',
                                    '<div id="quote-modal-toast" class="fixed bottom-10 left-1/2 -translate-x-1/2 bg-gray-800 text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-2 transform translate-y-10 opacity-0 transition-all duration-300 pointer-events-none z-[70]"><i class="ph-fill ph-check-circle text-green-400"></i><span>报价文本已复制到剪贴板！</span></div>'
                                ].join('');

                                document.body.insertAdjacentHTML('beforeend', modalHtml);
                                document.body.style.overflow = 'hidden';

                                var modal = document.getElementById('quote-preview-modal');
                                function closeModal() { modal.remove(); var t = document.getElementById('quote-modal-toast'); if (t) t.remove(); document.body.style.overflow = ''; }
                                document.getElementById('quote-modal-close').addEventListener('click', closeModal);
                                document.getElementById('quote-modal-overlay').addEventListener('click', closeModal);
                                document.addEventListener('keydown', function esc(e) { if (e.key === 'Escape' && document.getElementById('quote-preview-modal')) { document.removeEventListener('keydown', esc); closeModal(); } });

                                // 复制
                                document.getElementById('quote-copy-btn').addEventListener('click', function () {
                                    var lines = ['【项目报价单：' + quoteData.projectName + '】', '客户：' + quoteData.customerName + ' | 周期：' + quoteData.cycle + '天 | 日期：' + quoteData.quoteDate, '----------------------------------------'];
                                    quoteData.items.forEach(function (item, i) { lines.push((i + 1) + '. ' + item.name); if (item.desc) lines.push('   (' + item.desc + ')'); lines.push('   ¥' + fmtMoney(item.qty * item.price)); });
                                    lines.push('----------------------------------------', '小计：¥' + fmtMoney(subtotal), '优惠折扣：-¥' + fmtMoney(parseFloat(quoteData.discount || 0)), '【总计金额：¥' + fmtMoney(total) + '】', '', '付款方式：' + quoteData.paymentMethod);
                                    if (quoteData.notes) lines.push('补充说明：' + quoteData.notes.replace(/\n/g, '；'));
                                    navigator.clipboard.writeText(lines.join('\n')).then(function () {
                                        var toast = document.getElementById('quote-modal-toast');
                                        if (toast) { toast.classList.remove('translate-y-10', 'opacity-0'); setTimeout(function () { toast.classList.add('translate-y-10', 'opacity-0'); }, 3000); }
                                    }).catch(function () { showToast('复制失败'); });
                                });

                                // 导出 PDF
                                document.getElementById('quote-pdf-btn').addEventListener('click', function () { window.print(); });

                                // 导出 PNG
                                document.getElementById('quote-png-btn').addEventListener('click', function () {
                                    var target = document.getElementById('quote-modal-paper');
                                    if (!target || typeof html2canvas === 'undefined') { showToast('图片导出组件尚未加载'); return; }
                                    html2canvas(target, { scale: 2, backgroundColor: '#ffffff' }).then(function (canvas) {
                                        var link = document.createElement('a');
                                        link.download = '报价单-' + (quoteData.projectName || '未命名') + '.png';
                                        link.href = canvas.toDataURL('image/png');
                                        link.click();
                                    });
                                });
                            }

                            // ========== 表单保存后刷新 ==========
                            // 仅当前实例响应，防止 SPA 多次切换后旧监听器累积导致重复刷新/重复 Toast

                            window.addEventListener('order-form:saved', function () {
                                if (window.__ordersActiveInstance !== instanceId) return;
                                loadOrders();
                                loadStats();
                                showToast('订单保存成功');
                            });

                            // 兼容旧版 order-form:submit（如果 order-form.js 未更新）
                            window.addEventListener('order-form:submit', function (e) {
                                if (window.__ordersActiveInstance !== instanceId) return;
                                var data = e.detail || {};
                                if (data.id) {
                                    api('/api/orders/' + encodeURIComponent(data.id), { method: 'PUT', body: data }).then(function (res) {
                                        if (res.success) {
                                            window.dispatchEvent(new CustomEvent('order-form:saved'));
                                        } else {
                                            showToast('保存失败：' + (res.error || ''));
                                        }
                                    }).catch(function (err) { showToast('保存失败：' + err.message); });
                                } else {
                                    api('/api/orders', { method: 'POST', body: data }).then(function (res) {
                                        if (res.success) {
                                            window.dispatchEvent(new CustomEvent('order-form:saved'));
                                        } else {
                                            showToast('保存失败：' + (res.error || ''));
                                        }
                                    }).catch(function (err) { showToast('保存失败：' + err.message); });
                                }
                            });

                            // ========== 初始化 ==========

                            function init() {
                                populateFilterOptions();
                                bindFilters();
                                bindTabs();
                                bindDetailInteractions();
                                loadStats();
                                loadOrders();
                            }

                            // 页面加载时初始化
                            if (document.getElementById('orders-tbody')) {
                                init();
                            }

                            // SPA 切换后重新初始化（仅当前实例响应，防止旧监听器累积重复执行）
                            window.addEventListener('spa:ready', function (e) {
                                if (window.__ordersActiveInstance !== instanceId) return;
                                var page = (e.detail && e.detail.page) || '';
                                if (page && page.indexOf('orders') === -1) return;
                                if (!document.getElementById('orders-tbody')) return;
                                // init() 已在内联脚本执行时调用过，此处仅作为兜底
                                // 正常情况下不会走到这里（script 执行早于 spa:ready）
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
