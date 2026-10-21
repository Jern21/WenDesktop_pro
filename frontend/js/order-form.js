/**
 * 我的订单表单组件 —— 独立可复用的右侧抽屉表单
 *
 * 功能：
 *   - 新建 / 编辑我的订单
 *   - 客户信息、项目信息、商务信息、时间节点、状态管理、附件链接
 *   - 净利率 / 时薪 / 交付周期自动计算
 *   - 客户标签多选
 *   - 表单校验
 *
 * 用法：
 *   window.openOrderForm()          // 新建
 *   window.openOrderForm(data)      // 编辑（传入已有数据）
 *   window.closeOrderForm()         // 关闭
 */
(function () {
    'use strict';

    // ========== 常量 ==========

    var PROJECT_TYPES = ['网站开发', '小程序开发', 'UI/设计', '视频剪辑', '平面设计', '文案优化', '其他'];
    var CUSTOMER_SOURCES = ['闲鱼', '小红书', '抖音', '微信', '淘宝', '朋友推荐', '其他'];
    var ORDER_STATUSES = [
        { value: 'pending', label: '待确认需求', color: 'gray' },
        { value: 'processing', label: '开发/设计中', color: 'blue' },
        { value: 'acceptance', label: '待验收', color: 'orange' },
        { value: 'completed', label: '已完成', color: 'green' },
        { value: 'closed', label: '已关闭', color: 'gray' }
    ];
    var PAYMENT_STATUSES = ['未付款', '部分付款', '已结清'];
    var CUSTOMER_TAGS = ['爽快型', '纠结比价型', '急单', '大厂员工', '复购客户', '高价值', '新客户'];

    // ========== 状态 ==========

    var drawer = null;
    var overlay = null;
    var closeTimer = null; // 关闭动画的销毁定时器，切页清理时要能取消它
    var selectedTags = [];
    var isOpen = false;
    var editMode = false;
    var editId = null; // 编辑模式下的订单 ID
    var selectedCustomerId = '';
    var uploadedFiles = {}; // { screenshot: {...}, showcase: {...}, quote: {...}, taskBook: {...}, paymentRecord: [{...}] }
    var paymentRecordsState = [];

    // ========== 工具函数 ==========

    function formatDate(d) {
        if (!d) return '';
        if (typeof d === 'string') return d;
        var y = d.getFullYear();
        var m = String(d.getMonth() + 1).padStart(2, '0');
        var day = String(d.getDate()).padStart(2, '0');
        return y + '-' + m + '-' + day;
    }

    function calcDays(start, end) {
        if (!start || !end) return '';
        var s = new Date(start);
        var e = new Date(end);
        if (isNaN(s) || isNaN(e)) return '';
        var diff = Math.round((e - s) / 86400000);
        return diff >= 0 ? diff : '';
    }

    function escapeHtml(text) {
        if (!text) return '';
        return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    function showToast(msg) {
        var existing = document.getElementById('order-form-toast');
        if (existing) existing.remove();

        var toast = document.createElement('div');
        toast.id = 'order-form-toast';
        toast.className = 'fixed bottom-10 left-1/2 -translate-x-1/2 bg-gray-800 text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-2 transform translate-y-10 opacity-0 transition-all duration-300 pointer-events-none z-[90]';
        toast.innerHTML = '<i class="ph-fill ph-check-circle text-green-400"></i><span>' + escapeHtml(msg) + '</span>';
        document.body.appendChild(toast);

        requestAnimationFrame(function () {
            toast.classList.remove('translate-y-10', 'opacity-0');
        });

        setTimeout(function () {
            toast.classList.add('translate-y-10', 'opacity-0');
            setTimeout(function () { toast.remove(); }, 300);
        }, 2000);
    }

    // ========== 构建 HTML ==========

    function buildField(label, innerHtml, opts) {
        opts = opts || {};
        var required = opts.required ? '<span class="text-red-400">*</span>' : '';
        var widthClass = opts.half ? 'col-span-1' : 'col-span-2';
        return [
            '<div class="' + widthClass + '">',
            '  <label class="block text-xs text-gray-500 mb-1.5">' + label + required + '</label>',
            innerHtml,
            '</div>'
        ].join('');
    }

    function inputHtml(name, placeholder, type) {
        type = type || 'text';
        return '<input type="' + type + '" name="' + name + '" placeholder="' + placeholder + '" ' +
            'class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/15 transition-all bg-white">';
    }

    function selectHtml(name, options) {
        var opts = options.map(function (o) {
            var val = typeof o === 'object' ? o.value : o;
            var text = typeof o === 'object' ? o.label : o;
            return '<option value="' + val + '">' + text + '</option>';
        }).join('');
        return '<select name="' + name + '" class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/15 transition-all bg-white">' + opts + '</select>';
    }

    function textareaHtml(name, placeholder, rows) {
        rows = rows || 3;
        return '<textarea name="' + name + '" placeholder="' + placeholder + '" rows="' + rows + '" ' +
            'class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/15 transition-all bg-white resize-none"></textarea>';
    }

    function buildTagHtml() {
        return CUSTOMER_TAGS.map(function (tag) {
            return '<button type="button" data-tag="' + tag + '" ' +
                'class="order-tag px-2.5 py-1 rounded-md text-xs border transition-all ' +
                'border-gray-200 text-gray-500 hover:border-brand-300 hover:text-brand-600">' + tag + '</button>';
        }).join('');
    }

    function buildStatusOptions() {
        return ORDER_STATUSES.map(function (s) {
            return '<option value="' + s.value + '">' + s.label + '</option>';
        }).join('');
    }

    function uploadZoneHtml(type, icon, label, hint, accept, multiple) {
        accept = accept || '';
        var multipleAttr = multiple ? ' multiple' : '';
        return [
            '<div class="order-upload-zone border-2 border-dashed border-gray-200 rounded-lg p-4 text-center hover:border-brand-300 transition cursor-pointer relative" data-upload-type="' + type + '">',
            '  <div class="upload-placeholder">',
            '    <i class="ph ' + icon + ' text-2xl text-gray-300"></i>',
            '    <p class="text-xs text-gray-400 mt-1">' + label + '</p>',
            '    <p class="text-[10px] text-gray-300 mt-0.5">' + hint + '</p>',
            '  </div>',
            '  <div class="upload-preview hidden">',
            '    <div class="flex items-center gap-2 px-1">',
            '      <i class="ph ph-file-pdf text-lg text-red-500 file-icon"></i>',
            '      <span class="text-xs text-gray-600 flex-1 truncate text-left file-name"></span>',
            '      <button type="button" class="upload-remove w-5 h-5 flex items-center justify-center text-gray-400 hover:text-red-500 transition flex-shrink-0"><i class="ph ph-x text-xs"></i></button>',
            '    </div>',
            '  </div>',
            '  <input type="file" class="upload-input hidden" accept="' + accept + '"' + multipleAttr + '>',
            '</div>'
        ].join('');
    }

    function buildDrawerHTML() {
        return [
            // Overlay
            '<div id="order-form-overlay" class="fixed inset-0 bg-black/20 z-40 opacity-0 transition-opacity duration-200"></div>',
            // Drawer
            '<div id="order-form-drawer" class="fixed right-0 top-0 bottom-0 w-[560px] bg-white z-50 flex flex-col shadow-2xl translate-x-full transition-transform duration-300">',
            // Header
            '  <div class="flex items-center justify-between px-6 py-4 border-b border-gray-100 flex-shrink-0">',
            '    <div>',
            '      <h3 class="font-bold text-gray-800 text-base" id="order-form-title">新建我的订单</h3>',
            '      <p class="text-xs text-gray-400 mt-0.5">填写订单信息，标记星号的字段为必填</p>',
            '    </div>',
            '    <button id="order-form-close" class="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition">',
            '      <i class="ph ph-x text-lg"></i>',
            '    </button>',
            '  </div>',
            // Body (scrollable)
            '  <div class="flex-1 overflow-y-auto px-6 py-5">',
            '    <form id="order-form" class="space-y-6">',
            // === Section 1: 客户信息 ===
            '      <div>',
            '        <div class="flex items-center justify-between mb-3">',
            '          <div class="flex items-center gap-2">',
            '            <div class="w-6 h-6 rounded-md bg-blue-50 flex items-center justify-center"><i class="ph ph-user text-blue-500 text-sm"></i></div>',
            '            <h4 class="text-sm font-semibold text-gray-800">客户信息</h4>',
            '          </div>',
            '          <button type="button" id="order-form-select-customer" class="text-xs text-brand-600 hover:text-brand-700 font-medium flex items-center gap-1 px-2 py-1 rounded hover:bg-brand-50 transition">',
            '            <i class="ph ph-magnifying-glass"></i> 选择已有客户',
            '          </button>',
            '        </div>',
            '        <div class="grid grid-cols-2 gap-x-4 gap-y-3">',
            buildField('客户昵称', inputHtml('customerNick', '如：张先生'), { required: true }),
            buildField('真实姓名', inputHtml('customerName', '选填，如：张三')),
            buildField('联系方式', inputHtml('customerPhone', '手机号 / 微信号'), { half: true }),
            buildField('客户来源', selectHtml('customerSource', CUSTOMER_SOURCES), { half: true }),
            '        </div>',
            // Tags
            '        <div class="mt-3">',
            '          <label class="block text-xs text-gray-500 mb-2">客户标签 <span class="text-gray-400">（可多选）</span></label>',
            '          <div class="flex flex-wrap gap-2">' + buildTagHtml() + '</div>',
            '        </div>',
            '      </div>',
            // === Section 2: 项目信息 ===
            '      <div class="border-t border-gray-50 pt-5">',
            '        <div class="flex items-center gap-2 mb-3">',
            '          <div class="w-6 h-6 rounded-md bg-purple-50 flex items-center justify-center"><i class="ph ph-folder-open text-purple-500 text-sm"></i></div>',
            '          <h4 class="text-sm font-semibold text-gray-800">项目信息</h4>',
            '        </div>',
            '        <div class="grid grid-cols-2 gap-x-4 gap-y-3">',
            buildField('项目类型', selectHtml('projectType', PROJECT_TYPES), { required: true, half: true }),
            buildField('项目名称', inputHtml('projectName', '如：企业官网定制开发'), { required: true, half: true }),
            '        </div>',
            '        <div class="mt-3">',
            buildField('需求简述', textareaHtml('projectDesc', '简要描述客户需求和交付要求...', 3)),
            '        </div>',
            '      </div>',
            // === Section 3: 商务信息 ===
            '      <div class="border-t border-gray-50 pt-5">',
            '        <div class="flex items-center gap-2 mb-3">',
            '          <div class="w-6 h-6 rounded-md bg-green-50 flex items-center justify-center"><i class="ph ph-currency-cny text-green-500 text-sm"></i></div>',
            '          <h4 class="text-sm font-semibold text-gray-800">商务信息</h4>',
            '        </div>',
            '        <div class="grid grid-cols-2 gap-x-4 gap-y-3">',
            buildField('成交金额（¥）', inputHtml('amount', '0.00', 'number'), { required: true, half: true }),
            buildField('实际成本（¥）', inputHtml('cost', '0.00', 'number'), { half: true }),
            buildField('实际耗时（小时）', inputHtml('hours', '0', 'number'), { half: true }),
            buildField('预计利润（¥）', '<div id="profit-display" class="px-3 py-2 text-sm font-medium text-gray-700 bg-gray-50 rounded-lg border border-gray-100">—</div>', { half: true }),
            buildField('净利率', '<div id="margin-display" class="px-3 py-2 text-sm font-medium text-gray-700 bg-gray-50 rounded-lg border border-gray-100">—</div>', { half: true }),
            buildField('时薪（¥/h）', '<div id="rate-display" class="px-3 py-2 text-sm font-medium text-gray-700 bg-gray-50 rounded-lg border border-gray-100">—</div>', { half: true }),
            '        </div>',
            '      </div>',
            // === Section 4: 时间节点 ===
            '      <div class="border-t border-gray-50 pt-5">',
            '        <div class="flex items-center gap-2 mb-3">',
            '          <div class="w-6 h-6 rounded-md bg-orange-50 flex items-center justify-center"><i class="ph ph-calendar text-orange-500 text-sm"></i></div>',
            '          <h4 class="text-sm font-semibold text-gray-800">时间节点</h4>',
            '        </div>',
            '        <div class="grid grid-cols-2 gap-x-4 gap-y-3">',
            buildField('接单日期', inputHtml('orderDate', '', 'date'), { required: true, half: true }),
            buildField('需求确认日', inputHtml('confirmDate', '', 'date'), { half: true }),
            buildField('初稿交付日', inputHtml('draftDate', '', 'date'), { half: true }),
            buildField('终稿交付日', inputHtml('finalDate', '', 'date'), { half: true }),
            buildField('交付周期（天）', '<div id="cycle-display" class="px-3 py-2 text-sm font-medium text-gray-700 bg-gray-50 rounded-lg border border-gray-100">—</div>', { half: true }),
            '        </div>',
            '      </div>',
            // === Section 5: 状态管理 ===
            '      <div class="border-t border-gray-50 pt-5">',
            '        <div class="flex items-center gap-2 mb-3">',
            '          <div class="w-6 h-6 rounded-md bg-red-50 flex items-center justify-center"><i class="ph ph-traffic-signal text-red-500 text-sm"></i></div>',
            '          <h4 class="text-sm font-semibold text-gray-800">状态管理</h4>',
            '        </div>',
            '        <div class="grid grid-cols-2 gap-x-4 gap-y-3">',
            buildField('订单状态', '<select name="orderStatus" class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/15 transition-all bg-white">' + buildStatusOptions() + '</select>', { required: true, half: true }),
            buildField('付款状态', selectHtml('paymentStatus', PAYMENT_STATUSES), { half: true }),
            buildField('付款比例（%）', '<div id="payment-ratio-wrap" class="hidden"><input type="number" name="paymentRatio" placeholder="如：50" min="0" max="100" class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/15 transition-all bg-white"></div>', { half: true }),
            buildField('预计回款日', inputHtml('payDate', '', 'date'), { half: true }),
            '        </div>',
            '        <div id="payment-records-wrap" class="hidden mt-4 rounded-xl border border-gray-100 bg-gray-50/60 p-3">',
            '          <div class="flex items-center justify-between gap-3">',
            '            <div>',
            '              <p class="text-xs font-semibold text-gray-700">分次付款记录</p>',
            '              <p id="payment-record-summary" class="text-[10px] text-gray-400 mt-0.5">暂无实际付款记录</p>',
            '            </div>',
            '            <button type="button" id="payment-record-add" class="h-8 px-3 rounded-lg border border-gray-200 bg-white text-xs text-gray-600 hover:text-brand-600 hover:border-brand-200 hover:bg-brand-50 transition flex items-center gap-1">',
            '              <i class="ph ph-plus"></i>添加',
            '            </button>',
            '          </div>',
            '          <div id="payment-record-list" class="space-y-2 mt-3"></div>',
            '        </div>',
            '      </div>',
            // === Section 6: 附件与关联 ===
            '      <div class="border-t border-gray-50 pt-5">',
            '        <div class="flex items-center gap-2 mb-3">',
            '          <div class="w-6 h-6 rounded-md bg-cyan-50 flex items-center justify-center"><i class="ph ph-paperclip text-cyan-500 text-sm"></i></div>',
            '          <h4 class="text-sm font-semibold text-gray-800">附件与关联</h4>',
            '        </div>',
            '        <div class="space-y-3">',
            buildField('Git 仓库链接', inputHtml('gitUrl', 'https://github.com/...')),
            buildField('关联报价单', inputHtml('quoteRef', '输入报价单编号或名称')),
            '        </div>',
            // File uploads
            '        <div class="mt-3 grid grid-cols-2 gap-3">',
            uploadZoneHtml('screenshot', 'ph-chat-circle-dots', '需求沟通截图', '点击或拖拽上传', 'image/*'),
            uploadZoneHtml('showcase', 'ph-images', '成品展示图', '点击或拖拽上传', 'image/*'),
            '        </div>',
            '        <div class="mt-3">',
            uploadZoneHtml('quote', 'ph-file-pdf', '报价单', '支持 PDF / Word / 图片，点击或拖拽上传', '.pdf,.doc,.docx,.jpg,.jpeg,.png,.gif,.webp'),
            '        </div>',
        '<div class="mt-3">',
            uploadZoneHtml('taskBook', 'ph-file-text', '项目任务书（可选）', '支持 PDF / Word / 图片，点击或拖拽上传', '.pdf,.doc,.docx,.jpg,.jpeg,.png,.gif,.webp,.txt,.md'),
        '</div>',
        '<div class="mt-3">',
            uploadZoneHtml('paymentRecord', 'ph-currency-cny', '打款记录', '支持多张客户付款截图或转账记录', 'image/*,.pdf', true),
        '</div>',
      '</div>',
            '    </form>',
            '  </div>',
            // Footer
            '  <div class="px-6 py-4 border-t border-gray-100 bg-gray-50/50 flex items-center justify-between flex-shrink-0">',
            '    <div class="text-xs text-gray-400" id="order-form-hint">数据将保存到后端服务器</div>',
            '    <div class="flex gap-3">',
            '      <button id="order-form-cancel" class="px-5 py-2 border border-gray-200 text-gray-600 bg-white rounded-lg hover:bg-gray-50 transition text-sm font-medium">取消</button>',
            '      <button id="order-form-submit" class="px-5 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition text-sm font-medium shadow-sm shadow-brand-500/30 flex items-center gap-1.5"><i class="ph ph-check"></i>保存</button>',
            '    </div>',
            '  </div>',
            '</div>'
        ].join('');
    }

    // ========== 计算逻辑 ==========

    function updateCalc() {
        var form = document.getElementById('order-form');
        if (!form) return;

        var amount = parseFloat(form.amount.value) || 0;
        var cost = parseFloat(form.cost.value) || 0;
        var hours = parseFloat(form.hours.value) || 0;

        var profit = amount - cost;
        var margin = amount > 0 ? (profit / amount * 100).toFixed(1) + '%' : '—';
        var rate = hours > 0 ? (profit / hours).toFixed(1) : '—';

        var profitEl = document.getElementById('profit-display');
        var marginEl = document.getElementById('margin-display');
        var rateEl = document.getElementById('rate-display');

        if (profitEl) {
            profitEl.textContent = '¥ ' + profit.toLocaleString();
            profitEl.className = 'px-3 py-2 text-sm font-medium rounded-lg border ' +
                (profit > 0 ? 'text-green-600 bg-green-50 border-green-100' : 'text-gray-500 bg-gray-50 border-gray-100');
        }
        if (marginEl) marginEl.textContent = margin;
        if (rateEl) {
            rateEl.textContent = rate === '—' ? '—' : '¥ ' + rate;
        }

        // 交付周期
        var cycle = calcDays(form.orderDate.value, form.finalDate.value);
        var cycleEl = document.getElementById('cycle-display');
        if (cycleEl) cycleEl.textContent = cycle === '' ? '—' : cycle + ' 天';
    }

    // ========== 标签交互 ==========

    function toggleTag(btn) {
        var tag = btn.getAttribute('data-tag');
        var idx = selectedTags.indexOf(tag);
        if (idx === -1) {
            selectedTags.push(tag);
            btn.className = btn.className.replace('border-gray-200 text-gray-500 hover:border-brand-300 hover:text-brand-600', 'border-brand-500 bg-brand-50 text-brand-600');
        } else {
            selectedTags.splice(idx, 1);
            btn.className = btn.className.replace('border-brand-500 bg-brand-50 text-brand-600', 'border-gray-200 text-gray-500 hover:border-brand-300 hover:text-brand-600');
        }
    }

    // ========== 付款状态联动 ==========

    function normalizePaymentRecords(value) {
        if (!Array.isArray(value)) return [];
        return value.map(function (item) {
            item = item || {};
            return {
                date: String(item.date || item.payDate || item.time || '').trim(),
                amount: parseFloat(item.amount) || 0,
                note: String(item.note || item.remark || '').trim()
            };
        }).filter(function (item) {
            return item.date || item.amount > 0 || item.note;
        });
    }

    function paymentRecordTotal(records) {
        return normalizePaymentRecords(records).reduce(function (sum, item) {
            return sum + (parseFloat(item.amount) || 0);
        }, 0);
    }

    function currencyText(value) {
        var num = Math.round(parseFloat(value) || 0);
        return '¥ ' + num.toLocaleString('zh-CN');
    }

    function updatePaymentRecordSummary() {
        var form = document.getElementById('order-form');
        var summary = document.getElementById('payment-record-summary');
        var records = normalizePaymentRecords(paymentRecordsState);
        var total = paymentRecordTotal(records);
        var amount = form ? (parseFloat(form.amount.value) || 0) : 0;
        var ratio = amount > 0 && total > 0 ? Math.min(Math.round(total / amount * 100), 100) : 0;

        if (summary) {
            summary.textContent = records.length
                ? ('已记录 ' + records.length + ' 笔，合计 ' + currencyText(total) + (ratio ? '，约 ' + ratio + '%' : ''))
                : '暂无实际付款记录';
        }

        if (form && form.paymentRatio && total > 0) {
            form.paymentRatio.value = ratio;
        }
    }

    function paymentRecordRowHtml(record, index) {
        record = record || {};
        return [
            '<div class="payment-record-row rounded-lg border border-gray-100 bg-white p-2.5" data-index="' + index + '">',
            '  <div class="grid grid-cols-[1fr_1fr_auto] gap-2 items-start">',
            '    <input type="date" data-field="date" value="' + escapeHtml(record.date || '') + '" class="payment-record-input border border-gray-200 rounded-lg px-2.5 py-2 text-xs outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/15 bg-white">',
            '    <input type="number" data-field="amount" min="0" step="0.01" placeholder="金额" value="' + (record.amount > 0 ? escapeHtml(String(record.amount)) : '') + '" class="payment-record-input border border-gray-200 rounded-lg px-2.5 py-2 text-xs outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/15 bg-white">',
            '    <button type="button" class="payment-record-remove w-9 h-9 rounded-lg border border-gray-200 text-gray-400 hover:text-red-500 hover:bg-red-50 hover:border-red-100 transition flex items-center justify-center" title="删除"><i class="ph ph-trash"></i></button>',
            '  </div>',
            '  <input type="text" data-field="note" placeholder="备注，如首款、尾款、补款" value="' + escapeHtml(record.note || '') + '" class="payment-record-input mt-2 w-full border border-gray-200 rounded-lg px-2.5 py-2 text-xs outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/15 bg-white">',
            '</div>'
        ].join('');
    }

    function renderPaymentRecords() {
        var list = document.getElementById('payment-record-list');
        if (!list) return;
        if (!paymentRecordsState.length) {
            list.innerHTML = '<div class="rounded-lg border border-dashed border-gray-200 bg-white py-3 text-center text-xs text-gray-300">暂无分次付款记录</div>';
        } else {
            list.innerHTML = paymentRecordsState.map(paymentRecordRowHtml).join('');
        }
        updatePaymentRecordSummary();
    }

    function togglePaymentRatio() {
        var form = document.getElementById('order-form');
        if (!form) return;
        var wrap = document.getElementById('payment-ratio-wrap');
        var recordsWrap = document.getElementById('payment-records-wrap');
        if (form.paymentStatus.value === '部分付款') {
            wrap.classList.remove('hidden');
        } else {
            wrap.classList.add('hidden');
        }
        if (recordsWrap) {
            recordsWrap.classList.toggle('hidden', form.paymentStatus.value === '未付款');
        }
        updatePaymentRecordSummary();
    }

    // ========== 文件上传 ==========

    function revokeFileUrl(file) {
        if (Array.isArray(file)) {
            file.forEach(revokeFileUrl);
            return;
        }
        if (file && file.url && file.url.indexOf('blob:') === 0 && window.URL && window.URL.revokeObjectURL) {
            window.URL.revokeObjectURL(file.url);
        }
    }

    function createFileRecord(file) {
        var url = '';
        if (window.URL && window.URL.createObjectURL) {
            url = window.URL.createObjectURL(file);
        }
        return {
            name: file.name,
            size: file.size,
            type: file.type,
            url: url,
            _needsUpload: true // 标记需要上传到服务器
        };
    }

    /**
     * 上传单个文件到服务器
     */
    function uploadFileToServer(file) {
        if (!file || !file._needsUpload) return Promise.resolve(file);
        if (!file.url || file.url.indexOf('blob:') !== 0) return Promise.resolve(file);

        // 从 blob URL 获取原始 File 对象
        return fetch(file.url).then(function (r) { return r.blob(); }).then(function (blob) {
            var formData = new FormData();
            formData.append('file', blob, file.name);
            return fetch('/api/upload', { method: 'POST', body: formData }).then(function (r) { return r.json(); });
        }).then(function (res) {
            if (res.success && res.data) {
                return {
                    name: res.data.originalName || file.name,
                    size: res.data.size || file.size,
                    type: res.data.mimetype || file.type,
                    url: res.data.url
                };
            }
            return file; // 上传失败则保留原信息
        }).catch(function (err) {
            console.error('[OrderForm] 文件上传失败:', err);
            return file;
        });
    }

    /**
     * 上传所有需要上传的文件
     */
    function uploadAllFiles() {
    var keys = ['screenshot', 'showcase', 'quote', 'taskBook', 'paymentRecord'];
    var promises = keys.map(function (key) {
            if (key === 'paymentRecord' && Array.isArray(uploadedFiles[key])) {
                return Promise.all(uploadedFiles[key].map(function (file) {
                    return uploadFileToServer(file);
                })).then(function (results) {
                    uploadedFiles[key] = results.filter(Boolean);
                });
            }
            if (uploadedFiles[key] && uploadedFiles[key]._needsUpload) {
                return uploadFileToServer(uploadedFiles[key]).then(function (result) {
                    uploadedFiles[key] = result;
                });
            }
            return Promise.resolve();
        });
        return Promise.all(promises);
    }

    function getFileIconClass(file) {
        var type = (file && (file.type || file.mimetype)) || '';
        var name = (file && (file.name || file.originalName || file.filename)) || '';
        var iconClass = 'ph file-icon text-lg ';
        if (type.startsWith('image/')) {
            iconClass += 'ph-image text-blue-500';
        } else if (type.indexOf('pdf') !== -1 || name.match(/\.pdf$/i)) {
            iconClass += 'ph-file-pdf text-red-500';
        } else if (type.indexOf('word') !== -1 || name.match(/\.(doc|docx)$/i)) {
            iconClass += 'ph-file-doc text-blue-600';
        } else {
            iconClass += 'ph-file text-gray-500';
        }
        return iconClass;
    }

    function handleFileUpload(type, file, zone) {
        var placeholder = zone.querySelector('.upload-placeholder');
        var preview = zone.querySelector('.upload-preview');
        var fileNameEl = zone.querySelector('.file-name');
        var fileIcon = zone.querySelector('.file-icon');

        if (type === 'paymentRecord') {
            if (!Array.isArray(uploadedFiles[type])) uploadedFiles[type] = [];
            uploadedFiles[type].push(createFileRecord(file));
            uploadedFiles[type] = uploadedFiles[type].slice(0, 10);
        } else {
            revokeFileUrl(uploadedFiles[type]);
            uploadedFiles[type] = createFileRecord(file);
        }

        placeholder.classList.add('hidden');
        preview.classList.remove('hidden');
        if (fileNameEl) {
            fileNameEl.textContent = type === 'paymentRecord'
                ? ('已选择 ' + (uploadedFiles[type] || []).length + ' 个打款附件')
                : file.name;
        }

        if (fileIcon) {
            var iconSource = type === 'paymentRecord' ? (uploadedFiles[type] && uploadedFiles[type][0]) : uploadedFiles[type];
            fileIcon.className = getFileIconClass(iconSource);
        }
    }

    function bindUploadEvents() {
        document.querySelectorAll('.order-upload-zone').forEach(function (zone) {
            var type = zone.getAttribute('data-upload-type');
            var fileInput = zone.querySelector('.upload-input');
            var placeholder = zone.querySelector('.upload-placeholder');
            var removeBtn = zone.querySelector('.upload-remove');

            // 点击上传
            zone.addEventListener('click', function (e) {
                if (e.target.closest('.upload-remove')) return;
                fileInput.click();
            });

            // 文件选择
            fileInput.addEventListener('change', function () {
                var files = Array.prototype.slice.call(this.files || []);
                if (files.length) {
                    if (type !== 'paymentRecord') files = files.slice(0, 1);
                    files.forEach(function (file) {
                        handleFileUpload(type, file, zone);
                    });
                }
                fileInput.value = '';
            });

            // 拖拽
            zone.addEventListener('dragover', function (e) {
                e.preventDefault();
                zone.classList.add('border-brand-400', 'bg-brand-50/30');
            });
            zone.addEventListener('dragleave', function () {
                zone.classList.remove('border-brand-400', 'bg-brand-50/30');
            });
            zone.addEventListener('drop', function (e) {
                e.preventDefault();
                zone.classList.remove('border-brand-400', 'bg-brand-50/30');
                var files = Array.prototype.slice.call(e.dataTransfer.files || []);
                if (files.length) {
                    if (type !== 'paymentRecord') files = files.slice(0, 1);
                    files.forEach(function (file) {
                        handleFileUpload(type, file, zone);
                    });
                }
            });

            // 移除文件
            if (removeBtn) {
                removeBtn.addEventListener('click', function (e) {
                    e.stopPropagation();
                    revokeFileUrl(uploadedFiles[type]);
                    uploadedFiles[type] = type === 'paymentRecord' ? [] : null;
                    placeholder.classList.remove('hidden');
                    zone.querySelector('.upload-preview').classList.add('hidden');
                    fileInput.value = '';
                });
            }
        });
    }

    // ========== 校验 ==========

    function validate() {
        var form = document.getElementById('order-form');
        if (!form) return false;
        var errors = [];

        if (!form.customerNick.value.trim()) errors.push('客户昵称');
        if (!form.projectType.value) errors.push('项目类型');
        if (!form.projectName.value.trim()) errors.push('项目名称');
        if (!form.amount.value || parseFloat(form.amount.value) <= 0) errors.push('成交金额');
        if (!form.orderDate.value) errors.push('接单日期');

        if (errors.length > 0) {
            // 高亮错误字段
            errors.forEach(function (field) {
                console.warn('[OrderForm] 缺少必填字段: ' + field);
            });
            return false;
        }
        return true;
    }

    function cleanUploadedFile(file) {
        if (!file) return null;
        return {
            name: file.name || file.originalName || file.filename || '',
            originalName: file.originalName || file.name || file.filename || '',
            filename: file.filename || '',
            size: file.size || 0,
            type: file.type || file.mimetype || '',
            mimetype: file.mimetype || file.type || '',
            url: file.url || ''
        };
    }

    function cleanUploadedFileValue(value) {
        if (Array.isArray(value)) {
            return value.map(cleanUploadedFile).filter(Boolean);
        }
        return cleanUploadedFile(value);
    }

    // ========== 收集数据 ==========

    function collectData() {
        var form = document.getElementById('order-form');
        var paymentRecords = form.paymentStatus.value === '未付款' ? [] : normalizePaymentRecords(paymentRecordsState);
        var paidTotal = paymentRecordTotal(paymentRecords);
        var amount = parseFloat(form.amount.value) || 0;
        var paymentRatio = form.paymentRatio ? parseInt(form.paymentRatio.value, 10) || 0 : 0;
        if (form.paymentStatus.value === '未付款') {
            paymentRatio = 0;
        } else if (paidTotal > 0 && amount > 0) {
            paymentRatio = Math.min(Math.round(paidTotal / amount * 100), 100);
        } else if (form.paymentStatus.value === '已结清') {
            paymentRatio = 100;
        }
        return {
            customerId: selectedCustomerId || '',
            customerNick: form.customerNick.value.trim(),
            customerName: form.customerName.value.trim(),
            customerPhone: form.customerPhone.value.trim(),
            customerSource: form.customerSource.value,
            customerTags: selectedTags.slice(),
            projectType: form.projectType.value,
            projectName: form.projectName.value.trim(),
            projectDesc: form.projectDesc.value.trim(),
            amount: parseFloat(form.amount.value) || 0,
            cost: parseFloat(form.cost.value) || 0,
            hours: parseFloat(form.hours.value) || 0,
            orderDate: form.orderDate.value,
            confirmDate: form.confirmDate.value,
            draftDate: form.draftDate.value,
            finalDate: form.finalDate.value,
            orderStatus: form.orderStatus.value,
            paymentStatus: form.paymentStatus.value,
            paymentRatio: paymentRatio,
            payDate: form.payDate.value,
            paymentRecords: paymentRecords,
            gitUrl: form.gitUrl.value.trim(),
            quoteRef: form.quoteRef.value.trim(),
            uploadedFiles: {
                screenshot: uploadedFiles.screenshot || null,
                showcase: uploadedFiles.showcase || null,
                quote: uploadedFiles.quote || null,
                taskBook: uploadedFiles.taskBook || null,
                paymentRecord: uploadedFiles.paymentRecord || null
            }
        };
    }

    // ========== 填充数据（编辑模式） ==========

    function fillData(data, opts) {
        var form = document.getElementById('order-form');
        if (!form || !data) return;
        opts = opts || {};
        var preserveDefaults = !!opts.preserveDefaults;
        selectedCustomerId = data.customerId || '';

        function setValue(name, value, fallback) {
            if (!form[name]) return;
            if (value !== undefined && value !== null) {
                form[name].value = value;
            } else if (!preserveDefaults) {
                form[name].value = fallback || '';
            }
        }

        setValue('customerNick', data.customerNick, '');
        setValue('customerName', data.customerName, '');
        setValue('customerPhone', data.customerPhone, '');
        setValue('customerSource', data.customerSource, '闲鱼');
        setValue('projectType', data.projectType, '网站开发');
        setValue('projectName', data.projectName, '');
        setValue('projectDesc', data.projectDesc, '');
        setValue('amount', data.amount, '');
        setValue('cost', data.cost, '');
        setValue('hours', data.hours, '');
        setValue('orderDate', data.orderDate, '');
        setValue('confirmDate', data.confirmDate, '');
        setValue('draftDate', data.draftDate, '');
        setValue('finalDate', data.finalDate, '');
        setValue('orderStatus', data.orderStatus, 'pending');
        setValue('paymentStatus', data.paymentStatus, '未付款');
        setValue('payDate', data.payDate, '');
        setValue('gitUrl', data.gitUrl, '');
        setValue('quoteRef', data.quoteRef, '');

        // 付款比例与分次付款
        if (form.paymentRatio) form.paymentRatio.value = data.paymentRatio || '';
        paymentRecordsState = normalizePaymentRecords(data.paymentRecords || []);
        renderPaymentRecords();

        // 上传文件恢复
        var files = data.uploadedFiles || {};
        uploadedFiles = {};
        ['screenshot', 'showcase', 'quote', 'taskBook', 'paymentRecord'].forEach(function (key) {
            var value = files[key];
            if (key === 'paymentRecord') {
                value = Array.isArray(value) ? value : (value ? [value] : []);
            }
            if ((Array.isArray(value) && value.length) || (!Array.isArray(value) && value)) {
                uploadedFiles[key] = value;
                var zone = document.querySelector('.order-upload-zone[data-upload-type="' + key + '"]');
                if (zone) {
                    var ph = zone.querySelector('.upload-placeholder');
                    var pv = zone.querySelector('.upload-preview');
                    var fnEl = zone.querySelector('.file-name');
                    var iconEl = zone.querySelector('.file-icon');
                    var previewFile = Array.isArray(value) ? value[0] : value;
                    if (ph) ph.classList.add('hidden');
                    if (pv) pv.classList.remove('hidden');
                    if (fnEl) {
                        fnEl.textContent = key === 'paymentRecord'
                            ? ('已保存 ' + value.length + ' 个打款附件')
                            : (previewFile.name || previewFile.originalName || previewFile.filename || '已保存附件');
                    }
                    if (iconEl) iconEl.className = getFileIconClass(previewFile);
                }
            }
        });

        // 标签
        selectedTags = (data.customerTags || []).slice();
        document.querySelectorAll('.order-tag').forEach(function (btn) {
            var tag = btn.getAttribute('data-tag');
            if (selectedTags.indexOf(tag) !== -1) {
                btn.className = 'order-tag px-2.5 py-1 rounded-md text-xs border transition-all border-brand-500 bg-brand-50 text-brand-600';
            }
        });

        togglePaymentRatio();
        updateCalc();
    }

    function bindPaymentRecordEvents() {
        var addBtn = document.getElementById('payment-record-add');
        var list = document.getElementById('payment-record-list');
        if (addBtn) {
            addBtn.addEventListener('click', function () {
                paymentRecordsState.push({ date: formatDate(new Date()), amount: 0, note: '' });
                renderPaymentRecords();
            });
        }
        if (list) {
            list.addEventListener('input', function (e) {
                var input = e.target.closest('.payment-record-input');
                if (!input) return;
                var row = input.closest('.payment-record-row');
                if (!row) return;
                var index = parseInt(row.dataset.index, 10);
                var field = input.dataset.field;
                if (!paymentRecordsState[index] || !field) return;
                paymentRecordsState[index][field] = field === 'amount' ? (parseFloat(input.value) || 0) : input.value;
                updatePaymentRecordSummary();
            });
            list.addEventListener('click', function (e) {
                var btn = e.target.closest('.payment-record-remove');
                if (!btn) return;
                var row = btn.closest('.payment-record-row');
                var index = row ? parseInt(row.dataset.index, 10) : -1;
                if (index >= 0) {
                    paymentRecordsState.splice(index, 1);
                    renderPaymentRecords();
                }
            });
        }
    }

    // ========== 事件绑定 ==========

    function bindEvents() {
        var form = document.getElementById('order-form');

        // 关闭
        document.getElementById('order-form-close').addEventListener('click', closeOrderForm);
        document.getElementById('order-form-cancel').addEventListener('click', closeOrderForm);
        overlay.addEventListener('click', closeOrderForm);

        // 提交
        document.getElementById('order-form-submit').addEventListener('click', function () {
            if (!validate()) {
                var hint = document.getElementById('order-form-hint');
                hint.textContent = '请填写所有必填字段（标 * 号的）';
                hint.className = 'text-xs text-red-500';
                setTimeout(function () {
                    hint.textContent = '数据将保存到后端服务器';
                    hint.className = 'text-xs text-gray-400';
                }, 3000);
                return;
            }

            var submitBtn = document.getElementById('order-form-submit');
            var originalText = submitBtn.innerHTML;
            submitBtn.innerHTML = '<i class="ph ph-spinner animate-spin"></i> 保存中...';
            submitBtn.disabled = true;

            var data = collectData();
            if (editId) data.id = editId;

            // 先上传文件，再提交表单
            uploadAllFiles().then(function () {
                // 更新 data 中的 uploadedFiles（去除 _needsUpload 标记）
                var cleanFiles = {};
                ['screenshot', 'showcase', 'quote', 'taskBook', 'paymentRecord'].forEach(function (key) {
                    if (uploadedFiles[key]) {
                        cleanFiles[key] = cleanUploadedFileValue(uploadedFiles[key]);
                    }
                });
                data.uploadedFiles = cleanFiles;

                var url = editId ? '/api/orders/' + encodeURIComponent(editId) : '/api/orders';
                var method = editId ? 'PUT' : 'POST';

                return fetch(url, {
                    method: method,
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data)
                }).then(function (r) { return r.json(); });
            }).then(function (res) {
                if (res.success) {
                    window.dispatchEvent(new CustomEvent('order-form:saved', { detail: res.data }));
                    closeOrderForm();
                } else {
                    var hint = document.getElementById('order-form-hint');
                    hint.textContent = '保存失败：' + (res.error || '未知错误');
                    hint.className = 'text-xs text-red-500';
                    submitBtn.innerHTML = originalText;
                    submitBtn.disabled = false;
                }
            }).catch(function (err) {
                console.error('[OrderForm] 保存失败:', err);
                var hint2 = document.getElementById('order-form-hint');
                hint2.textContent = '保存失败：' + err.message;
                hint2.className = 'text-xs text-red-500';
                submitBtn.innerHTML = originalText;
                submitBtn.disabled = false;
            });
        });

        // 实时计算
        ['amount', 'cost', 'hours'].forEach(function (name) {
            form[name].addEventListener('input', function () {
                updateCalc();
                if (name === 'amount') updatePaymentRecordSummary();
            });
        });
        ['orderDate', 'finalDate'].forEach(function (name) {
            form[name].addEventListener('change', updateCalc);
        });

        // 付款状态联动
        form.paymentStatus.addEventListener('change', togglePaymentRatio);
        bindPaymentRecordEvents();

        // 标签点击
        document.querySelectorAll('.order-tag').forEach(function (btn) {
            btn.addEventListener('click', function () { toggleTag(btn); });
        });

        // 文件上传
        bindUploadEvents();

        // 选择客户按钮
        var selectCustomerBtn = document.getElementById('order-form-select-customer');
        if (selectCustomerBtn) {
            selectCustomerBtn.addEventListener('click', openCustomerSelector);
        }

        // ESC 关闭改由模块级的单次监听处理（见文件末尾）。
        // 原来写在这里，每开一次抽屉就往 document 上挂一个 keydown，
        // 开五次就是五个，属于纯泄漏。
    }

    // ========== 打开 / 关闭 ==========

    function openOrderForm(data, options) {
        if (isOpen) {
            // 关闭动画进行中（closeTimer 还挂着）时别当成「已打开」跳过，
            // 直接把旧抽屉销毁、继续打开新的 —— 否则用户关掉后立刻再点，
            // 会什么都不发生，看起来就是「打不开」。
            if (!closeTimer) {
                console.log('[OrderForm] 表单已打开，跳过');
                return;
            }
            destroyDrawer();
        }
        // 上一次关闭的销毁定时器如果还挂着，会把这次新建的节点一起干掉
        if (closeTimer) { clearTimeout(closeTimer); closeTimer = null; }
        options = options || {};
        var createMode = options.mode === 'create' || options.create === true || (data && data.__mode === 'create');

        // 构建 DOM
        document.body.insertAdjacentHTML('beforeend', buildDrawerHTML());
        drawer = document.getElementById('order-form-drawer');
        overlay = document.getElementById('order-form-overlay');
        selectedTags = [];
        selectedCustomerId = '';
        uploadedFiles = {};
        paymentRecordsState = [];
        editMode = !!(data && data.id && !createMode);
        editId = editMode && data && data.id ? data.id : null;

        // 标题
        document.getElementById('order-form-title').textContent = editMode ? '编辑我的订单' : '新建我的订单';

        // 默认接单日期 = 今天
        var form = document.getElementById('order-form');
        if (form.orderDate) form.orderDate.value = formatDate(new Date());

        bindEvents();
        renderPaymentRecords();
        togglePaymentRatio();

        // 编辑模式填充数据
        if (data) fillData(data, { preserveDefaults: !editMode });

        // 动画打开。rAF 回调是异步的，等它真正执行时抽屉可能已经被
        // spa:cleanup-forms（切页）或关闭动画销毁掉了 —— 所以这里必须用局部引用
        // 加 isConnected 判断，不能直接去吃模块级的 overlay / drawer。
        var openingOverlay = overlay;
        var openingDrawer = drawer;
        requestAnimationFrame(function () {
            if (!isOpen) return;
            if (openingOverlay && openingOverlay.isConnected) openingOverlay.classList.remove('opacity-0');
            if (openingDrawer && openingDrawer.isConnected) openingDrawer.classList.remove('translate-x-full');
        });

        // 锁定 body 滚动
        document.body.style.overflow = 'hidden';
        isOpen = true;
    }

    // 统一的销毁入口：关闭动画结束、SPA 切页清理，两条路径都只走这里。
    // 以前两处各写一遍「置 null + 复位 isOpen」，先跑的那条把引用置空、
    // 后跑的那条就可能拿着 null 去点 classList，抛出
    // "Cannot read properties of null (reading 'classList')"。
    function destroyDrawer() {
        if (closeTimer) { clearTimeout(closeTimer); closeTimer = null; }
        // 只有自己确实开着锁的时候才去复位 body.overflow，
        // 否则会把别的模块（如 memo 表单）锁住的滚动一起解锁掉
        var wasOpen = isOpen || overlay || drawer;
        if (overlay) { overlay.remove(); overlay = null; }
        if (drawer) { drawer.remove(); drawer = null; }
        if (wasOpen) document.body.style.overflow = '';
        isOpen = false;
    }

    function closeOrderForm() {
        if (!isOpen) return;

        if (overlay) overlay.classList.add('opacity-0');
        if (drawer) drawer.classList.add('translate-x-full');

        if (closeTimer) clearTimeout(closeTimer);
        closeTimer = setTimeout(destroyDrawer, 300);
    }

    // ========== 客户选择器 ==========

    var customerSelectorModal = null;
    var customerListCache = null;

    function buildCustomerSelectorHTML() {
        return [
            '<div id="customer-selector-modal" class="fixed inset-0 z-[70] flex items-center justify-center p-4">',
            '  <div class="absolute inset-0 bg-black/40" id="customer-selector-overlay"></div>',
            '  <div class="relative bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[80vh] flex flex-col">',
            '    <!-- Header -->',
            '    <div class="flex items-center justify-between p-4 border-b border-gray-100">',
            '      <h3 class="font-semibold text-gray-800">选择客户</h3>',
            '      <button type="button" id="customer-selector-close" class="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-400 hover:text-gray-600 transition">',
            '        <i class="ph ph-x text-lg"></i>',
            '      </button>',
            '    </div>',
            '    <!-- Search -->',
            '    <div class="p-4 border-b border-gray-100">',
            '      <div class="relative">',
            '        <i class="ph ph-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"></i>',
            '        <input type="text" id="customer-selector-search" placeholder="搜索客户姓名、手机号..." class="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/15 transition-all">',
            '      </div>',
            '    </div>',
            '    <!-- List -->',
            '    <div id="customer-selector-list" class="flex-1 overflow-y-auto p-2">',
            '      <div class="text-center py-8 text-gray-400 text-sm">加载中...</div>',
            '    </div>',
            '    <!-- Footer -->',
            '    <div class="p-4 border-t border-gray-100 bg-gray-50/50 rounded-b-xl">',
            '      <div class="flex items-center justify-between">',
            '        <span class="text-xs text-gray-400" id="customer-selector-count">共 0 位客户</span>',
            '        <button type="button" id="customer-selector-refresh" class="text-xs text-brand-600 hover:text-brand-700 font-medium flex items-center gap-1">',
            '          <i class="ph ph-arrows-clockwise"></i> 刷新',
            '        </button>',
            '      </div>',
            '    </div>',
            '  </div>',
            '</div>'
        ].join('');
    }

    function renderCustomerList(customers, keyword) {
        var container = document.getElementById('customer-selector-list');
        var countEl = document.getElementById('customer-selector-count');
        if (!container) return;

        // 过滤
        var list = customers || [];
        if (keyword) {
            var kw = keyword.toLowerCase();
            list = list.filter(function (c) {
                return (c.name && c.name.toLowerCase().indexOf(kw) !== -1) ||
                       (c.phone && c.phone.indexOf(kw) !== -1);
            });
        }

        // 更新计数
        if (countEl) countEl.textContent = '共 ' + list.length + ' 位客户';

        if (list.length === 0) {
            container.innerHTML = '<div class="text-center py-8 text-gray-400 text-sm">' + (keyword ? '未找到匹配的客户' : '暂无客户数据') + '</div>';
            return;
        }

        var html = list.map(function (c) {
            var avatar = c.avatar || '';
            var avatarHtml = avatar ?
                '<img src="' + avatar + '" class="w-10 h-10 rounded-full object-cover">' :
                '<div class="w-10 h-10 rounded-full bg-brand-100 flex items-center justify-center text-brand-600 font-medium">' + (c.name ? c.name.charAt(0) : '?') + '</div>';
            var tags = (c.tags || []).slice(0, 2).map(function (t) {
                return '<span class="text-[10px] px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded">' + t + '</span>';
            }).join('');

            return [
                '<div class="customer-item flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 cursor-pointer transition group" data-customer-id="' + c.id + '">',
                '  ' + avatarHtml,
                '  <div class="flex-1 min-w-0">',
                '    <div class="flex items-center gap-2">',
                '      <span class="font-medium text-gray-800 truncate">' + (c.name || '未命名') + '</span>',
                '      <span class="text-xs text-gray-400">' + (c.source || '') + '</span>',
                '    </div>',
                '    <div class="flex items-center gap-2 mt-0.5">',
                '      <span class="text-xs text-gray-500">' + (c.phone || '无联系方式') + '</span>',
                '      ' + tags,
                '    </div>',
                '  </div>',
                '  <i class="ph ph-caret-right text-gray-300 group-hover:text-brand-500 transition"></i>',
                '</div>'
            ].join('');
        }).join('');

        container.innerHTML = html;

        // 绑定点击事件
        container.querySelectorAll('.customer-item').forEach(function (item) {
            item.addEventListener('click', function () {
                var customerId = item.getAttribute('data-customer-id');
                var customer = customerListCache.find(function (c) { return c.id === customerId; });
                if (customer) {
                    selectCustomer(customer);
                }
            });
        });
    }

    function loadCustomers() {
        fetch('/api/customers').then(function (r) { return r.json(); }).then(function (res) {
            if (res.success) {
                customerListCache = res.data || [];
                renderCustomerList(customerListCache);
            } else {
                var container = document.getElementById('customer-selector-list');
                if (container) container.innerHTML = '<div class="text-center py-8 text-red-400 text-sm">加载失败：' + (res.error || '未知错误') + '</div>';
            }
        }).catch(function (err) {
            var container = document.getElementById('customer-selector-list');
            if (container) container.innerHTML = '<div class="text-center py-8 text-red-400 text-sm">加载失败：' + err.message + '</div>';
        });
    }

    function selectCustomer(customer) {
        // 填充表单
        var form = document.getElementById('order-form');
        selectedCustomerId = customer.id || '';
        if (form) {
            form.customerNick.value = customer.name || '';
            form.customerName.value = customer.name || '';
            form.customerPhone.value = customer.phone || '';
            form.customerSource.value = customer.source || '闲鱼';
        }

        // 填充标签
        if (customer.tags && customer.tags.length > 0) {
            selectedTags = customer.tags.slice();
            document.querySelectorAll('.order-tag').forEach(function (btn) {
                var tag = btn.getAttribute('data-tag');
                if (selectedTags.indexOf(tag) !== -1) {
                    btn.className = 'order-tag px-2.5 py-1 rounded-md text-xs border transition-all border-brand-500 bg-brand-50 text-brand-600';
                } else {
                    btn.className = 'order-tag px-2.5 py-1 rounded-md text-xs border transition-all border-gray-200 text-gray-600 hover:border-gray-300';
                }
            });
        }

        closeCustomerSelector();

        // 显示提示
        showToast('已选择客户：' + (customer.name || '未命名'));
    }

    function openCustomerSelector() {
        if (customerSelectorModal) return;

        document.body.insertAdjacentHTML('beforeend', buildCustomerSelectorHTML());
        customerSelectorModal = document.getElementById('customer-selector-modal');

        // 绑定事件
        document.getElementById('customer-selector-close').addEventListener('click', closeCustomerSelector);
        document.getElementById('customer-selector-overlay').addEventListener('click', closeCustomerSelector);
        document.getElementById('customer-selector-refresh').addEventListener('click', function () {
            loadCustomers();
        });

        // 搜索
        var searchInput = document.getElementById('customer-selector-search');
        if (searchInput) {
            searchInput.addEventListener('input', function () {
                renderCustomerList(customerListCache, searchInput.value.trim());
            });
        }

        // 加载数据
        loadCustomers();
    }

    function closeCustomerSelector() {
        if (!customerSelectorModal) return;
        customerSelectorModal.remove();
        customerSelectorModal = null;
    }

    // ========== 全局事件监听 ==========

    // 监听包含「新建接单」或「新建订单」的按钮点击
    document.addEventListener('click', function (e) {
        var btn = e.target.closest('button');
        if (!btn) return;
        var text = btn.textContent.trim();
        if (text === '新建接单' || text === '新建订单') {
            e.preventDefault();
            openOrderForm();
        }
    });

    // 统一销毁入口：切页时不管抽屉开没开、动画跑到哪一步，都直接清干净
    window.addEventListener('spa:cleanup-forms', destroyDrawer);

    // ESC 关闭（模块级只挂一次，避免每次开抽屉都往 document 上叠一个监听）
    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && isOpen) closeOrderForm();
    });

    // 暴露全局 API
    window.openOrderForm = openOrderForm;
    window.closeOrderForm = closeOrderForm;
})();
