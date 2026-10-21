/**
 * 报价管理 视图
 *
 * 自动迁移自 frontend/pages/business/quote.html
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

    App.view('quote', {
        path: '/quote',
        nav: 'quote.html',
        title: '报价管理',
        template: 'views/quote.html',
        styles: 'css/views/quote.css',

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

                        // ========== 报价管理页面：完整功能实现 ==========
                        (function () {
                            'use strict';

                            // 实例标识（防止 SPA 多次切换后旧监听器累积）
                            var instanceId = 'quote_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
                            window.__quoteActiveInstance = instanceId;

                            // ========== 报价数据模型 ==========
                            var quoteData = {
                                id: null, // 编辑模式下的报价单 ID
                                projectName: '',
                                customerName: '',
                                quoteDate: '',
                                cycle: '',
                                discount: '0',
                                paymentMethod: '',
                                notes: '',
                                items: []
                            };

                            var BUILTIN_TEMPLATES = [
                                {
                                    id: 'builtin:website-custom',
                                    projectName: '企业官网定制开发 (双端自适应)',
                                    customerName: '张先生',
                                    quoteDate: new Date().toISOString().slice(0, 10),
                                    cycle: '15',
                                    discount: 300,
                                    paymentMethod: '50%预付定金启动项目，40%测试上线无误后支付，10%为尾款交付源码时支付。',
                                    notes: '1. 本报价有效期为 7 天。\n2. 免费提供首年服务器日常维护及程序Bug修复。\n3. 超出上述需求范围的新增功能，需另行评估报价。',
                                    items: [
                                        { name: '基础架构与UI/UX设计', qty: 1, price: 2000, desc: '包含首页、关于我们、产品展示等5个核心页面的设计与前端重构 (响应式)' },
                                        { name: '后端管理系统开发', qty: 1, price: 3500, desc: '总览看板(CMS)、产品管理、基础权限分配、API接口开发' },
                                        { name: '服务器部署与备案协助', qty: 1, price: 800, desc: 'Linux环境配置、SSL证书配置、域名解析及上线测试' }
                                    ]
                                }
                            ];

                            // ========== 工具函数 ==========

                            function formatMoney(n) {
                                return parseFloat(n || 0).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                            }

                            function calcSubtotal() {
                                return quoteData.items.reduce(function (sum, item) {
                                    return sum + (parseFloat(item.qty) || 0) * (parseFloat(item.price) || 0);
                                }, 0);
                            }

                            function calcTotal() {
                                return calcSubtotal() - parseFloat(quoteData.discount || 0);
                            }

                            function escapeHtml(value) {
                                return String(value || '')
                                    .replace(/&/g, '&amp;')
                                    .replace(/</g, '&lt;')
                                    .replace(/>/g, '&gt;')
                                    .replace(/"/g, '&quot;');
                            }

                            // ========== Toast 提示 ==========

                            var toastTimer = null;
                            function showToast(msg) {
                                var toast = document.getElementById('toast');
                                if (!toast) return;
                                var span = toast.querySelector('span');
                                if (span) span.textContent = msg || '操作成功';
                                toast.classList.remove('translate-y-10', 'opacity-0');
                                if (toastTimer) clearTimeout(toastTimer);
                                toastTimer = setTimeout(function () {
                                    toast.classList.add('translate-y-10', 'opacity-0');
                                }, 2500);
                            }

                            // ========== 渲染表单明细行 ==========

                            function renderFormItems() {
                                var container = document.getElementById('quote-items-container');
                                if (!container) return;
                                container.innerHTML = quoteData.items.map(function (item, index) {
                                    return [
                                        '<div class="bg-gray-50/50 p-4 rounded-lg border border-gray-100 relative group">',
                                        '  <button data-remove="' + index + '" class="absolute -right-2 -top-2 w-6 h-6 bg-white border border-gray-200 text-gray-400 hover:text-red-500 rounded-full flex items-center justify-center shadow-sm opacity-0 group-hover:opacity-100 transition-opacity"><i class="ph ph-x text-xs"></i></button>',
                                        '  <div class="grid grid-cols-12 gap-3 mb-2">',
                                        '    <div class="col-span-7">',
                                        '      <label class="form-label">模块名称</label>',
                                        '      <input type="text" value="' + escapeHtml(item.name) + '" data-item="' + index + '" data-key="name" class="form-input bg-white" placeholder="模块名称...">',
                                        '    </div>',
                                        '    <div class="col-span-2">',
                                        '      <label class="form-label">数量</label>',
                                        '      <input type="number" value="' + item.qty + '" data-item="' + index + '" data-key="qty" class="form-input bg-white text-center">',
                                        '    </div>',
                                        '    <div class="col-span-3">',
                                        '      <label class="form-label">单价 (¥)</label>',
                                        '      <input type="number" value="' + item.price + '" data-item="' + index + '" data-key="price" class="form-input bg-white text-right">',
                                        '    </div>',
                                        '  </div>',
                                        '  <div>',
                                        '    <input type="text" value="' + escapeHtml(item.desc) + '" data-item="' + index + '" data-key="desc" class="form-input bg-white text-xs text-gray-500" placeholder="模块功能简述...">',
                                        '  </div>',
                                        '</div>'
                                    ].join('');
                                }).join('');

                                // 绑定删除按钮
                                container.querySelectorAll('[data-remove]').forEach(function (btn) {
                                    btn.addEventListener('click', function () {
                                        var idx = parseInt(btn.getAttribute('data-remove'));
                                        quoteData.items.splice(idx, 1);
                                        renderAll();
                                    });
                                });
                            }

                            // ========== 渲染预览 ==========

                            function renderPreview() {
                                var pvItems = document.getElementById('pv-items');
                                if (!pvItems) return;

                                // 基础信息
                                setText('pv-projectName', quoteData.projectName || '—');
                                setText('pv-customerName', quoteData.customerName || '—');
                                setText('pv-quoteDate', quoteData.quoteDate || '—');
                                setText('pv-cycle', quoteData.cycle ? (quoteData.cycle + ' 工作日') : '—');

                                // 明细列表
                                var itemsHtml = quoteData.items.map(function (item, i) {
                                    var amount = (parseFloat(item.qty) || 0) * (parseFloat(item.price) || 0);
                                    return [
                                        '<div class="grid grid-cols-12 gap-2 items-start">',
                                        '  <div class="col-span-7">',
                                        '    <p class="font-semibold text-gray-800">' + (i + 1) + '. ' + escapeHtml(item.name || '未命名模块') + '</p>',
                                        item.desc ? '<p class="text-xs text-gray-500 mt-1 leading-relaxed">' + escapeHtml(item.desc) + '</p>' : '',
                                        '  </div>',
                                        '  <div class="col-span-2 text-center text-gray-600 mt-0.5">' + item.qty + '</div>',
                                        '  <div class="col-span-3 text-right font-medium text-gray-800 mt-0.5">' + formatMoney(amount) + '</div>',
                                        '</div>'
                                    ].join('');
                                }).join('');
                                pvItems.innerHTML = itemsHtml || '<p class="text-center text-gray-300 py-8">暂无报价明细</p>';

                                // 金额合计
                                var subtotal = calcSubtotal();
                                var discount = parseFloat(quoteData.discount || 0);
                                var total = subtotal - discount;

                                setText('pv-subtotal', '¥ ' + formatMoney(subtotal));
                                setText('pv-discount', '- ¥ ' + formatMoney(discount));
                                setText('pv-total', '¥ ' + formatMoney(total));

                                // 补充说明
                                var notesHtml = quoteData.paymentMethod
                                    ? '<p><strong>付款方式：</strong> ' + escapeHtml(quoteData.paymentMethod) + '</p>'
                                    : '<p class="text-gray-400">暂无补充说明</p>';
                                if (quoteData.notes) {
                                    quoteData.notes.split('\n').forEach(function (line) {
                                        if (line.trim()) notesHtml += '<p>' + escapeHtml(line.trim()) + '</p>';
                                    });
                                }
                                var pvNotes = document.getElementById('pv-notes');
                                if (pvNotes) pvNotes.innerHTML = notesHtml;
                            }

                            function setText(id, text) {
                                var el = document.getElementById(id);
                                if (el) el.textContent = text;
                            }

                            // ========== 全量刷新 ==========

                            function renderAll() {
                                renderFormItems();
                                renderPreview();
                                bindItemEvents();
                            }

                            // ========== 事件绑定 ==========

                            function bindFieldEvents() {
                                document.querySelectorAll('[data-field]').forEach(function (input) {
                                    var field = input.getAttribute('data-field');
                                    if (quoteData[field] !== undefined) input.value = quoteData[field];
                                    input.addEventListener('input', function () {
                                        quoteData[field] = input.value;
                                        renderPreview();
                                    });
                                });
                            }

                            function bindItemEvents() {
                                document.querySelectorAll('[data-item]').forEach(function (input) {
                                    var index = parseInt(input.getAttribute('data-item'));
                                    var key = input.getAttribute('data-key');
                                    input.addEventListener('input', function () {
                                        if (key === 'qty' || key === 'price') {
                                            quoteData.items[index][key] = parseFloat(input.value) || 0;
                                        } else {
                                            quoteData.items[index][key] = input.value;
                                        }
                                        renderPreview();
                                    });
                                });
                            }

                            // ========== 添加明细 ==========
                            function addItem() {
                                quoteData.items.push({ name: '', qty: 1, price: 0, desc: '' });
                                renderAll();
                            }

                            // ========== 功能一：复制报价文本 ==========

                            function copyQuote() {
                                var lines = [];
                                lines.push('【项目报价单：' + quoteData.projectName + '】');
                                lines.push('客户：' + quoteData.customerName + ' | 周期：' + quoteData.cycle + '天 | 日期：' + quoteData.quoteDate);
                                lines.push('----------------------------------------');
                                quoteData.items.forEach(function (item, i) {
                                    lines.push((i + 1) + '. ' + item.name);
                                    if (item.desc) lines.push('   (' + item.desc + ')');
                                    lines.push('   ¥' + formatMoney((item.qty || 0) * (item.price || 0)));
                                });
                                lines.push('----------------------------------------');
                                lines.push('小计：¥' + formatMoney(calcSubtotal()));
                                lines.push('优惠折扣：-¥' + formatMoney(parseFloat(quoteData.discount || 0)));
                                lines.push('【总计金额：¥' + formatMoney(calcTotal()) + '】');
                                lines.push('');
                                lines.push('付款方式：' + quoteData.paymentMethod);
                                if (quoteData.notes) lines.push('补充说明：' + quoteData.notes.replace(/\n/g, '；'));

                                var text = lines.join('\n');

                                // 优先使用 Clipboard API，降级到 execCommand
                                if (navigator.clipboard && navigator.clipboard.writeText) {
                                    navigator.clipboard.writeText(text).then(function () {
                                        showToast('报价文本已复制到剪贴板！');
                                    }).catch(function () {
                                        fallbackCopy(text);
                                    });
                                } else {
                                    fallbackCopy(text);
                                }
                            }

                            function fallbackCopy(text) {
                                var textarea = document.createElement('textarea');
                                textarea.value = text;
                                textarea.className = 'fixed -left-[9999px] top-0';
                                document.body.appendChild(textarea);
                                textarea.focus();
                                textarea.select();
                                try {
                                    document.execCommand('copy');
                                    showToast('报价文本已复制到剪贴板！');
                                } catch (err) {
                                    showToast('复制失败，请手动选择文本复制');
                                }
                                textarea.remove();
                            }

                            // ========== 功能二：导出 PDF ==========

                            function exportPDF() {
                                // 利用浏览器原生打印功能 + @media print CSS
                                // 打印时仅显示 #quote-preview-content 区域
                                showToast('正在准备打印预览...');

                                // 延迟一点让 Toast 先显示
                                setTimeout(function () {
                                    window.print();
                                }, 300);
                            }

                            // ========== 功能三：导出 PNG ==========

                            function exportPNG() {
                                var target = document.getElementById('quote-preview-content');
                                if (!target) { showToast('预览区域不存在'); return; }
                                if (typeof html2canvas === 'undefined') { showToast('图片导出组件尚未加载'); return; }

                                showToast('正在生成图片...');

                                html2canvas(target, {
                                    scale: 2,
                                    backgroundColor: '#ffffff',
                                    useCORS: true,
                                    logging: false
                                }).then(function (canvas) {
                                    var link = document.createElement('a');
                                    var projectName = quoteData.projectName || '未命名项目';
                                    link.download = '报价单-' + projectName + '.png';
                                    link.href = canvas.toDataURL('image/png');
                                    link.click();
                                    showToast('报价单 PNG 已导出！');
                                }).catch(function (err) {
                                    console.error('[Quote] PNG 导出失败:', err);
                                    showToast('导出失败：' + (err.message || '未知错误'));
                                });
                            }

                            // ========== 功能四：保存报价单到后端 ==========

                            function collectQuoteData(status) {
                                return {
                                    projectName: quoteData.projectName,
                                    customerName: quoteData.customerName,
                                    quoteDate: quoteData.quoteDate,
                                    cycle: quoteData.cycle,
                                    items: quoteData.items.map(function (item) {
                                        return {
                                            name: item.name || '',
                                            desc: item.desc || '',
                                            qty: parseFloat(item.qty) || 0,
                                            price: parseFloat(item.price) || 0
                                        };
                                    }),
                                    discount: parseFloat(quoteData.discount) || 0,
                                    paymentMethod: quoteData.paymentMethod || '',
                                    notes: quoteData.notes || '',
                                    status: status || 'draft'
                                };
                            }

                            function saveQuote(options) {
                                options = options || {};
                                var asTemplate = !!options.asTemplate;
                                // 校验
                                if (!quoteData.projectName || !quoteData.projectName.trim()) {
                                    showToast('请填写项目名称');
                                    return;
                                }
                                if (!quoteData.items.length) {
                                    showToast('请至少添加一条报价明细');
                                    return;
                                }

                                var btn = document.getElementById('save-quote-btn');
                                var originalHtml = btn ? btn.innerHTML : '';
                                if (btn && !asTemplate) {
                                    btn.innerHTML = '<i class="ph ph-spinner animate-spin text-lg"></i> 保存中...';
                                    btn.disabled = true;
                                }

                                var data = collectQuoteData(asTemplate ? 'template' : 'draft');
                                var url = (!asTemplate && quoteData.id) ? '/api/quotes/' + encodeURIComponent(quoteData.id) : '/api/quotes';
                                var method = (!asTemplate && quoteData.id) ? 'PUT' : 'POST';

                                fetch(url, {
                                    method: method,
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify(data)
                                }).then(function (r) { return r.json(); }).then(function (res) {
                                    if (res.success) {
                                        if (!asTemplate) quoteData.id = res.data.id;
                                        showToast(asTemplate ? '已保存为模板！' : '报价单已保存！');
                                        loadTemplateList(); // 刷新模板列表
                                    } else {
                                        showToast('保存失败：' + (res.error || '未知错误'));
                                    }
                                    if (btn && !asTemplate) {
                                        btn.innerHTML = originalHtml;
                                        btn.disabled = false;
                                    }
                                }).catch(function (err) {
                                    showToast('保存失败：' + err.message);
                                    if (btn && !asTemplate) {
                                        btn.innerHTML = originalHtml;
                                        btn.disabled = false;
                                    }
                                });
                            }

                            // ========== 功能五：从模板导入 ==========

                            function calcTemplateTotal(template) {
                                var subtotal = (template.items || []).reduce(function (sum, item) {
                                    return sum + (parseFloat(item.qty) || 0) * (parseFloat(item.price) || 0);
                                }, 0);
                                return subtotal - (parseFloat(template.discount) || 0);
                            }

                            function renderTemplateItem(q, badge) {
                                var total = q.totalAmount !== undefined ? q.totalAmount : calcTemplateTotal(q);
                                var date = q.quoteDate || q.createdAt || '';
                                return [
                                    '<div class="template-item px-4 py-2.5 hover:bg-gray-50 cursor-pointer transition-colors" data-template-id="' + escapeHtml(q.id) + '">',
                                    '  <div class="flex items-center justify-between gap-2">',
                                    '    <div class="min-w-0 flex-1">',
                                    '      <div class="flex items-center gap-2">',
                                    '        <p class="text-sm font-medium text-gray-800 truncate">' + escapeHtml(q.projectName || '未命名') + '</p>',
                                    badge ? '        <span class="text-[10px] px-1.5 py-0.5 rounded bg-brand-50 text-brand-600 flex-shrink-0">' + escapeHtml(badge) + '</span>' : '',
                                    '      </div>',
                                    '      <p class="text-xs text-gray-400 mt-0.5">' + escapeHtml(q.customerName || '—') + ' · ¥' + formatMoney(total) + (date ? ' · ' + escapeHtml(date) : '') + '</p>',
                                    '    </div>',
                                    '    <i class="ph ph-arrow-square-in text-gray-300 text-sm flex-shrink-0"></i>',
                                    '  </div>',
                                    '</div>'
                                ].join('');
                            }

                            function bindTemplateItems(container) {
                                container.querySelectorAll('.template-item').forEach(function (item) {
                                    item.addEventListener('click', function () {
                                        var templateId = item.getAttribute('data-template-id');
                                        importTemplate(templateId);
                                        closeTemplateDropdown();
                                    });
                                });
                            }

                            function syncFieldInputs() {
                                document.querySelectorAll('[data-field]').forEach(function (input) {
                                    var field = input.getAttribute('data-field');
                                    if (quoteData[field] !== undefined) input.value = quoteData[field];
                                });
                            }

                            function applyTemplateData(d) {
                                quoteData.projectName = d.projectName || '';
                                quoteData.customerName = d.customerName || '';
                                quoteData.quoteDate = d.quoteDate || new Date().toISOString().slice(0, 10);
                                quoteData.cycle = d.cycle || '';
                                quoteData.discount = String(d.discount !== undefined ? d.discount : 0);
                                quoteData.paymentMethod = d.paymentMethod || '';
                                quoteData.notes = d.notes || '';
                                quoteData.items = (d.items || []).map(function (item) {
                                    return {
                                        name: item.name || '',
                                        desc: item.desc || '',
                                        qty: parseFloat(item.qty) || 1,
                                        price: parseFloat(item.price) || 0
                                    };
                                });
                                quoteData.id = null; // 重置 ID，作为新单

                                syncFieldInputs();
                                renderAll();
                                showToast('已导入模板：' + (d.projectName || '未命名模板'));
                            }

                            function loadTemplateList() {
                                fetch('/api/quotes').then(function (r) { return r.json(); }).then(function (res) {
                                    if (!res.success) return;
                                    var list = Array.isArray(res.data) ? res.data : [];
                                    var container = document.getElementById('template-list');
                                    if (!container) return;

                                    var html = [
                                        '<div class="px-4 pt-2 pb-1 text-[11px] font-semibold text-gray-400">内置模板</div>',
                                        BUILTIN_TEMPLATES.map(function (q) { return renderTemplateItem(q, '内置'); }).join(''),
                                        '<div class="px-4 pt-3 pb-1 text-[11px] font-semibold text-gray-400 border-t border-gray-50 mt-1">我的模板</div>',
                                        list.length
                                            ? list.map(function (q) { return renderTemplateItem(q, q.status === 'template' ? '模板' : '报价单'); }).join('')
                                            : '<div class="px-4 py-3 text-sm text-gray-400 text-center">暂无已保存的模板</div>'
                                    ].join('');
                                    container.innerHTML = html;
                                    bindTemplateItems(container);
                                }).catch(function (err) {
                                    console.error('[Quote] 模板列表加载失败:', err);
                                });
                            }

                            function importTemplate(id) {
                                if (id && id.indexOf('builtin:') === 0) {
                                    var builtin = BUILTIN_TEMPLATES.find(function (item) { return item.id === id; });
                                    if (!builtin) {
                                        showToast('内置模板不存在');
                                        return;
                                    }
                                    applyTemplateData(builtin);
                                    return;
                                }

                                fetch('/api/quotes/' + encodeURIComponent(id)).then(function (r) { return r.json(); }).then(function (res) {
                                    if (!res.success) { showToast('加载失败：' + (res.error || '')); return; }
                                    var d = res.data;
                                    applyTemplateData(d);
                                }).catch(function (err) {
                                    showToast('加载失败：' + err.message);
                                });
                            }

                            function toggleTemplateDropdown() {
                                var dropdown = document.getElementById('template-dropdown');
                                if (!dropdown) return;
                                if (dropdown.classList.contains('hidden')) {
                                    loadTemplateList();
                                    dropdown.classList.remove('hidden');
                                } else {
                                    dropdown.classList.add('hidden');
                                }
                            }

                            function closeTemplateDropdown() {
                                var dropdown = document.getElementById('template-dropdown');
                                if (dropdown) dropdown.classList.add('hidden');
                            }

                            // ========== 绑定按钮事件 ==========

                            function bindActionButtons() {
                                var addBtn = document.getElementById('add-item-btn');
                                if (addBtn) addBtn.addEventListener('click', addItem);

                                var copyBtn = document.getElementById('copy-quote-btn');
                                if (copyBtn) copyBtn.addEventListener('click', copyQuote);

                                var pdfBtn = document.getElementById('export-pdf-btn');
                                if (pdfBtn) pdfBtn.addEventListener('click', exportPDF);

                                var pngBtn = document.getElementById('export-png-btn');
                                if (pngBtn) pngBtn.addEventListener('click', exportPNG);

                                var saveBtn = document.getElementById('save-quote-btn');
                                if (saveBtn) saveBtn.addEventListener('click', saveQuote);

                                var templateBtn = document.getElementById('template-btn');
                                if (templateBtn) templateBtn.addEventListener('click', function (e) {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    toggleTemplateDropdown();
                                });

                                // 点击外部关闭模板下拉
                                document.addEventListener('click', function (e) {
                                    if (window.__quoteActiveInstance !== instanceId) return;
                                    var dropdown = document.getElementById('template-dropdown');
                                    if (!dropdown || dropdown.classList.contains('hidden')) return;
                                    if (!e.target.closest('#template-btn') && !e.target.closest('#template-dropdown')) {
                                        closeTemplateDropdown();
                                    }
                                });
                            }

                            window.saveQuoteAsTemplate = function () {
                                saveQuote({ asTemplate: true });
                            };

                            // ========== 初始化 ==========

                            function init() {
                                renderAll();
                                bindFieldEvents();
                                bindActionButtons();
                            }

                            // 页面加载时初始化
                            if (document.getElementById('quote-items-container')) {
                                init();
                            }

                            // SPA 切换后重新初始化
                            window.addEventListener('spa:ready', function (e) {
                                if (window.__quoteActiveInstance !== instanceId) return;
                                var page = (e.detail && e.detail.page) || '';
                                if (page && page.indexOf('quote') === -1) return;
                                if (!document.getElementById('quote-items-container')) return;
                                // init() 已在内联脚本执行时调用过，此处仅作为兜底
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
