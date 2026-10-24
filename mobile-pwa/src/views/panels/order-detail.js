/**
 * 订单详情
 *
 * 手机上能改：订单状态、付款状态（部分付款必须填 1–99 的比例）、
 * 以及底部「编辑」——字段表单在 components/order-form.js，列表左滑用的是同一份。
 * 新建、传附件留给桌面端。
 */
import '../../styles/orders.css';
import { orders } from '../../api/resources.js';
import {
    escapeHtml,
    formatMoney,
    formatDate,
    formatPercent,
    describeDeadline,
    orderStatusLabel,
    orderStatusTone,
    paymentStatusTone,
    phoneTelHref,
    ORDER_STATUS_ORDER,
    ORDER_STATUS_LABELS
} from '../../lib/format.js';
import { resolveAssetUrl, isImagePath, wireImageFallback } from '../../lib/urls.js';
import { toast, confirmSheet } from '../../lib/toast.js';
import { goBack, navigate } from '../../router.js';
import { rememberOrderPatch, rememberOrderRemoval } from '../order-session.js';
import { openOrderForm } from '../../components/order-form.js';

var PAY_OPTIONS = ['未付款', '部分付款', '已结清'];

var FILE_GROUPS = [
    ['screenshot', '截图'],
    ['showcase', '展示图'],
    ['quote', '报价单'],
    ['taskBook', '任务书'],
    ['paymentRecord', '打款凭证']
];

var TIME_FIELDS = [
    ['orderDate', '接单'],
    ['confirmDate', '需求确认'],
    ['draftDate', '初稿'],
    ['finalDate', '终稿']
];

function moneyText(n) {
    var v = parseFloat(n);
    if (isNaN(v)) return '—';
    return '¥' + formatMoney(v);
}

function asFiles(value) {
    if (!value) return [];
    return (Array.isArray(value) ? value : [value]).filter(function (file) {
        return file && (file.url || file.name || file.originalName);
    });
}

function row(label, valueHtml, extraClass) {
    return '<div class="ord-row' + (extraClass ? ' ' + extraClass : '') + '">' +
        '<span>' + escapeHtml(label) + '</span><span>' + valueHtml + '</span></div>';
}

function plain(value) {
    var text = value === null || value === undefined || value === '' ? '—' : String(value);
    return escapeHtml(text);
}

export function mountOrderDetailPanel(container, route) {
    var id = route && route.params ? route.params.id : '';
    var alive = true;
    var saving = false;
    var current = null;
    var sheet = null;
    var lightbox = null;

    container.innerHTML = '<div class="ord-detail"></div><div class="ord-actions" hidden></div>';
    var root = container.querySelector('.ord-detail');
    var bar = container.querySelector('.ord-actions');
    wireImageFallback(root);

    function closeSheet() {
        if (sheet && sheet.parentNode) sheet.parentNode.removeChild(sheet);
        sheet = null;
    }

    function closeLightbox() {
        if (lightbox && lightbox.parentNode) lightbox.parentNode.removeChild(lightbox);
        lightbox = null;
    }

    function showState(message, act, actLabel) {
        bar.setAttribute('hidden', '');
        bar.innerHTML = '';
        root.innerHTML =
            '<div class="ord-state"><p class="ord-state-title"></p>' +
            '<button type="button" class="ord-retry" data-act="' + act + '"></button></div>';
        root.querySelector('.ord-state-title').textContent = message;
        root.querySelector('.ord-retry').textContent = actLabel;
    }

    function renderFiles(uploaded) {
        var html = '';
        var any = false;
        FILE_GROUPS.forEach(function (pair) {
            var files = asFiles(uploaded && uploaded[pair[0]]);
            if (!files.length) return;
            any = true;
            html += '<h3 class="ord-block-title">' + escapeHtml(pair[1]) + '</h3><div class="ord-files">';
            files.forEach(function (file) {
                var url = resolveAssetUrl(file.url || '');
                var name = file.originalName || file.name || '附件';
                if (url && isImagePath(file.url || url)) {
                    html += '<button type="button" class="ord-file" data-act="preview" data-src="' +
                        escapeHtml(url) + '"><img data-asset alt="" src="' + escapeHtml(url) + '" />' +
                        '<span class="ord-file-name">' + escapeHtml(name) + '</span></button>';
                } else if (url) {
                    html += '<a class="ord-file-link" href="' + escapeHtml(url) + '" target="_blank" rel="noopener">' +
                        escapeHtml(name) + '</a>';
                } else {
                    html += '<span class="ord-file-name">' + escapeHtml(name) + '</span>';
                }
            });
            html += '</div>';
        });
        if (!any) html = '<p class="ord-due">没有附件</p>';
        return html;
    }

    function render(order) {
        current = order;
        var amount = parseFloat(order.amount) || 0;
        var cost = parseFloat(order.cost) || 0;
        var hours = parseFloat(order.hours) || 0;
        var profit = amount - cost;
        var margin = amount > 0 ? formatPercent(profit / amount, 1) : '—';
        var rate = hours > 0 ? '¥' + formatMoney(profit / hours) : '—';
        var pay = order.paymentStatus || '未付款';
        var payText = pay + (pay === '部分付款' ? ' · ' + (order.paymentRatio || 0) + '%' : '');
        var phoneHref = phoneTelHref(order.customerPhone);
        var phoneHtml = phoneHref
            ? '<a href="' + escapeHtml(phoneHref) + '">' + escapeHtml(order.customerPhone) + '</a>'
            : plain(order.customerPhone);
        var tags = Array.isArray(order.customerTags) ? order.customerTags.filter(Boolean).join('、') : '';
        var closed = order.orderStatus === 'completed' || order.orderStatus === 'closed';
        var finalDue = describeDeadline(order.finalDate);

        var timeHtml = TIME_FIELDS.map(function (pair) {
            var text = formatDate(order[pair[0]], 'full') || '—';
            var late = pair[0] === 'finalDate' && !closed && finalDue.tone === 'overdue';
            var shown = late ? escapeHtml(text + ' · ' + finalDue.text) : escapeHtml(text);
            return row(pair[1], shown, late ? 'is-overdue' : '');
        }).join('');

        root.innerHTML =
            '<section class="ord-block">' +
            '<h2 class="ord-hero-name">' + escapeHtml(order.projectName || '未命名项目') + '</h2>' +
            '<p class="ord-hero-amount">' + moneyText(order.amount) + '</p>' +
            '<div class="ord-hero-badges">' +
            '<span class="ord-badge is-' + orderStatusTone(order.orderStatus) + '">' +
            escapeHtml(orderStatusLabel(order.orderStatus)) + '</span>' +
            '<span class="ord-badge is-' + paymentStatusTone(pay) + '">' + escapeHtml(payText) + '</span>' +
            '</div>' +
            row('单号', plain(order.orderNo)) +
            row('类型', plain(order.projectType)) +
            '</section>' +
            '<section class="ord-block"><h3 class="ord-block-title">客户</h3>' +
            row('昵称', plain(order.customerNick)) +
            row('姓名', plain(order.customerName)) +
            '<div class="ord-row"><span>电话</span><span>' + phoneHtml + '</span></div>' +
            row('来源', plain(order.customerSource)) +
            row('标签', plain(tags)) +
            ((order.linkedCustomerId || order.customerId)
                ? '<button type="button" class="ord-link" data-act="customer">查看客户</button>'
                : '') +
            '</section>' +
            '<section class="ord-block"><h3 class="ord-block-title">时间节点</h3>' + timeHtml + '</section>' +
            '<section class="ord-block"><h3 class="ord-block-title">商务</h3>' +
            row('成交额', moneyText(order.amount)) +
            row('成本', moneyText(order.cost)) +
            row('耗时', escapeHtml(hours ? String(hours) + ' 小时' : '—')) +
            row('预计利润', moneyText(profit)) +
            row('净利率', escapeHtml(margin)) +
            row('时薪', escapeHtml(rate)) +
            '</section>' +
            '<section class="ord-block"><h3 class="ord-block-title">附件</h3>' +
            renderFiles(order.uploadedFiles) +
            '</section>';

        bar.removeAttribute('hidden');
        bar.innerHTML =
            '<button type="button" data-act="status">订单状态</button>' +
            '<button type="button" data-act="payment">付款状态</button>' +
            '<button type="button" data-act="edit">编辑</button>' +
            '<button type="button" data-act="del" class="is-danger">删除</button>';
        if (saving) setBusy(true);
    }

    function load() {
        if (!id) {
            showState('缺少订单编号', 'back', '返回订单列表');
            return;
        }
        root.innerHTML = '<div class="ord-state"><p class="ord-state-title">加载中…</p></div>';
        bar.setAttribute('hidden', '');
        orders.detail(id).then(function (res) {
            if (!alive) return;
            var order = res && res.data;
            if (!order) {
                showState('订单不存在', 'back', '返回订单列表');
                return;
            }
            render(order);
        }).catch(function (err) {
            if (!alive) return;
            var missing = err && err.status === 404;
            showState(
                (err && err.message) || (missing ? '订单不存在' : '加载失败'),
                missing ? 'back' : 'retry',
                missing ? '返回订单列表' : '重试'
            );
        });
    }

    function setBusy(on) {
        saving = on;
        bar.querySelectorAll('button').forEach(function (btn) { btn.disabled = on; });
        if (sheet) {
            sheet.querySelectorAll('button').forEach(function (btn) { btn.disabled = on; });
        }
    }

    function afterSave(res, note) {
        var order = res && res.data;
        if (!order) throw new Error('保存后没有返回订单');
        rememberOrderPatch(order);
        render(order);
        toast.success(note || '已更新');
        return order;
    }

    function openSheet(opts) {
        if (saving || sheet) return;
        closeSheet();
        var selected = opts.current;
        sheet = document.createElement('div');
        sheet.className = 'sheet-backdrop';
        sheet.innerHTML =
            '<div class="sheet-panel ord-sheet" role="dialog" aria-modal="true">' +
            '<h3 class="sheet-title"></h3>' +
            '<div class="ord-choices"></div>' +
            (opts.ratio
                ? '<label class="ord-ratio" hidden>已付比例（1–99）<input type="number" inputmode="numeric" min="1" max="99" placeholder="例如 40" /></label>'
                : '') +
            '<div class="sheet-actions">' +
            '<button type="button" class="sheet-btn" data-act="cancel">取消</button>' +
            '<button type="button" class="sheet-btn sheet-btn--primary" data-act="save">保存</button>' +
            '</div></div>';
        sheet.querySelector('.sheet-title').textContent = opts.title;

        var choices = sheet.querySelector('.ord-choices');
        opts.choices.forEach(function (choice) {
            var btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'ord-choice' + (choice.value === selected ? ' is-active' : '');
            btn.setAttribute('data-value', choice.value);
            btn.textContent = choice.label;
            choices.appendChild(btn);
        });

        var ratioWrap = sheet.querySelector('.ord-ratio');
        var ratioInput = ratioWrap ? ratioWrap.querySelector('input') : null;
        if (ratioInput && opts.ratioValue) ratioInput.value = String(opts.ratioValue);

        function syncRatio() {
            if (!ratioWrap) return;
            if (selected === '部分付款') ratioWrap.removeAttribute('hidden');
            else ratioWrap.setAttribute('hidden', '');
        }
        syncRatio();

        function pick(value) {
            selected = value;
            choices.querySelectorAll('.ord-choice').forEach(function (btn) {
                btn.classList.toggle('is-active', btn.getAttribute('data-value') === value);
            });
            syncRatio();
        }

        sheet.addEventListener('click', function (e) {
            if (saving) return;
            if (e.target === sheet) { closeSheet(); return; }
            var choice = e.target.closest && e.target.closest('.ord-choice');
            if (choice) { pick(choice.getAttribute('data-value')); return; }
            var act = e.target.getAttribute && e.target.getAttribute('data-act');
            if (act === 'cancel') closeSheet();
            if (act === 'save') submit();
        });

        function submit() {
            if (saving) return;
            var ratio = null;
            if (opts.ratio && selected === '部分付款') {
                var raw = ratioInput ? String(ratioInput.value || '').trim() : '';
                if (!/^\d+$/.test(raw) || parseInt(raw, 10) < 1 || parseInt(raw, 10) > 99) {
                    toast.warn('部分付款要填写 1 到 99 的整数比例');
                    if (ratioInput) ratioInput.focus();
                    return;
                }
                ratio = parseInt(raw, 10);
            }
            setBusy(true);
            Promise.resolve().then(function () {
                return opts.onSave(selected, ratio);
            }).then(function () {
                if (!alive) return;
                setBusy(false);
                closeSheet();
            }).catch(function (err) {
                if (!alive) return;
                setBusy(false);
                toast.error((err && err.message) || '保存失败');
            });
        }

        document.body.appendChild(sheet);
        requestAnimationFrame(function () { if (sheet) sheet.classList.add('is-in'); });
    }

    root.addEventListener('click', function (e) {
        var retry = e.target.closest && e.target.closest('[data-act="retry"]');
        if (retry) { load(); return; }
        var back = e.target.closest && e.target.closest('[data-act="back"]');
        if (back) { goBack('/orders'); return; }
        var customer = e.target.closest && e.target.closest('[data-act="customer"]');
        var linkedId = current && (current.linkedCustomerId || current.customerId);
        if (customer && linkedId) {
            navigate('/customers/' + encodeURIComponent(linkedId));
            return;
        }
        var preview = e.target.closest && e.target.closest('[data-act="preview"]');
        if (preview) {
            closeLightbox();
            lightbox = document.createElement('div');
            lightbox.className = 'ord-lightbox';
            var img = document.createElement('img');
            img.alt = '';
            img.src = preview.getAttribute('data-src') || '';
            lightbox.appendChild(img);
            lightbox.addEventListener('click', closeLightbox);
            document.body.appendChild(lightbox);
        }
    });

    bar.addEventListener('click', function (e) {
        if (saving || !current) return;
        var act = e.target.getAttribute && e.target.getAttribute('data-act');
        if (act === 'status') {
            openSheet({
                title: '订单状态',
                current: current.orderStatus,
                choices: ORDER_STATUS_ORDER.map(function (value) {
                    return { value: value, label: ORDER_STATUS_LABELS[value] };
                }),
                onSave: function (value) {
                    if (value === current.orderStatus) return null;
                    return orders.setStatus(id, value).then(function (res) {
                        return afterSave(res, '订单状态已更新');
                    });
                }
            });
        }
        if (act === 'payment') {
            openSheet({
                title: '付款状态',
                current: current.paymentStatus || '未付款',
                ratio: true,
                ratioValue: current.paymentRatio || '',
                choices: PAY_OPTIONS.map(function (value) { return { value: value, label: value }; }),
                onSave: function (value, ratio) {
                    if (value === (current.paymentStatus || '未付款') &&
                        (value !== '部分付款' || ratio === current.paymentRatio)) return null;
                    return orders.setPaymentStatus(id, value, ratio).then(function (res) {
                        var saved = res && res.data;
                        var note = '付款状态已更新';
                        if (value === '部分付款' && saved && saved.paymentRatio !== ratio) {
                            note = '已保存。这笔订单有打款记录，比例按记录金额计为 ' + saved.paymentRatio + '%';
                        }
                        return afterSave(res, note);
                    });
                }
            });
        }
        if (act === 'edit') {
            // 与列表左滑共用 components/order-form.js —— 字段和校验只有一份
            openOrderForm(current, {
                onSave: function (patch) {
                    return orders.update(id, patch).then(function (res) {
                        return afterSave(res, '订单已更新');
                    });
                }
            });
        }
        if (act === 'del') {
            confirmSheet({
                title: '删除订单？',
                message: '「' + (current.projectName || '这笔订单') + '」删除后不可恢复。',
                confirmText: '删除',
                danger: true
            }).then(function (ok) {
                if (!ok || !alive) return;
                orders.remove(id).then(function () {
                    if (!alive) return;
                    rememberOrderRemoval(id);
                    toast.success('已删除');
                    goBack('/orders');
                }).catch(function (err) {
                    toast.error((err && err.message) || '删除失败');
                });
            });
        }
    });

    load();

    return {
        destroy: function () {
            alive = false;
            closeSheet();
            closeLightbox();
            container.innerHTML = '';
        }
    };
}
