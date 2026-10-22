/**
 * 客户详情：资料、相关订单、跟进记录。
 * 手机上只加跟进，不改资料、不删除。订单点进去，返回仍回到这位客户。
 */
import '../../styles/customers.css';
import { customers } from '../../api/resources.js';
import { escapeHtml, formatMoney, formatDate, phoneTelHref, orderStatusLabel } from '../../lib/format.js';
import { toast } from '../../lib/toast.js';
import { goBack, navigate } from '../../router.js';
import { invalidateCustomerList } from '../customer-session.js';

export function mountCustomerDetailPanel(container, route) {
    var id = route && route.params ? route.params.id : '';
    var alive = true;
    var saving = false;
    var current = null;
    var sheet = null;

    container.innerHTML = '<div class="cust-detail"></div><div class="cust-actions" hidden></div>';
    var root = container.querySelector('.cust-detail');
    var actions = container.querySelector('.cust-actions');

    function showState(message, act, label) {
        actions.setAttribute('hidden', '');
        root.innerHTML = '<div class="cust-state"><p></p>' +
            (act ? '<button type="button" data-act="' + act + '">' + escapeHtml(label) + '</button>' : '') +
            '</div>';
        root.querySelector('p').textContent = message;
    }

    function row(label, value) {
        if (!value) return '';
        return '<div class="cust-row"><span>' + escapeHtml(label) + '</span><b>' + value + '</b></div>';
    }

    function render(data) {
        var customer = data.customer || {};
        var orders = data.orders || [];
        var logs = data.followLogs || [];
        var stats = data.stats || {};
        var phone = phoneTelHref(customer.phone);
        var tags = Array.isArray(customer.tags) ? customer.tags.filter(Boolean).join('、') : '';

        root.innerHTML =
            '<section class="cust-block">' +
            '<h1 class="cust-name">' + escapeHtml(customer.name || '未命名客户') + '</h1>' +
            (phone
                ? '<a class="cust-phone" href="' + escapeHtml(phone) + '">' + escapeHtml(customer.phone) + '</a>'
                : '') +
            row('状态', escapeHtml(customer.followStatus || '')) +
            row('类型', escapeHtml(customer.type || '')) +
            row('来源', escapeHtml(customer.source || '')) +
            row('等级', escapeHtml(customer.level || '')) +
            row('标签', escapeHtml(tags)) +
            (customer.desc ? '<p class="cust-card-meta">' + escapeHtml(customer.desc) + '</p>' : '') +
            '</section>' +
            '<section class="cust-block"><div class="cust-stats">' +
            '<div class="cust-stat"><b>' + (stats.orderCount || 0) + '</b><span>订单</span></div>' +
            '<div class="cust-stat"><b>¥' + formatMoney(stats.totalAmount) + '</b><span>订单额</span></div>' +
            '<div class="cust-stat"><b>¥' + formatMoney(stats.totalPaid) + '</b><span>已收</span></div>' +
            '</div></section>' +
            '<section class="cust-block"><h2>相关订单</h2>' +
            (orders.length ? orders.map(function (order) {
                return '<button type="button" class="cust-order" data-order="' + escapeHtml(order.id) + '">' +
                    '<strong>' + escapeHtml(order.projectName || '未命名项目') + '</strong>' +
                    '<span>¥' + formatMoney(order.amount) + ' · ' +
                    escapeHtml(orderStatusLabel(order.orderStatus)) + '</span></button>';
            }).join('') : '<p class="cust-empty">还没有关联订单</p>') +
            '</section>' +
            '<section class="cust-block"><h2>跟进</h2>' +
            (logs.length ? logs.map(function (log) {
                return '<div class="cust-follow"><strong>' + escapeHtml(log.content || '') + '</strong>' +
                    '<span>' + escapeHtml(formatDate(log.createdAt, 'datetime') || '') +
                    (log.author ? ' · ' + escapeHtml(log.author) : '') + '</span></div>';
            }).join('') : '<p class="cust-empty">还没有跟进</p>') +
            '</section>';

        actions.innerHTML = '<button type="button" data-act="follow">记一条跟进</button>';
        actions.removeAttribute('hidden');
    }

    function load() {
        if (!id) {
            showState('客户不存在', 'back', '返回客户列表');
            return;
        }
        root.innerHTML = '<div class="cust-state"><p>加载中…</p></div>';
        customers.detail(id).then(function (res) {
            if (!alive) return;
            current = res && res.data;
            if (!current || !current.customer) {
                showState('客户不存在', 'back', '返回客户列表');
                return;
            }
            render(current);
        }).catch(function (err) {
            if (!alive) return;
            var missing = err && err.status === 404;
            showState(
                (err && err.message) || (missing ? '客户不存在' : '加载失败'),
                missing ? 'back' : 'retry',
                missing ? '返回客户列表' : '重试'
            );
        });
    }

    function closeSheet() {
        if (!sheet) return;
        var node = sheet;
        sheet = null;
        node.remove();
    }

    function openFollow() {
        if (sheet || saving) return;
        sheet = document.createElement('div');
        sheet.className = 'sheet-backdrop';
        sheet.innerHTML =
            '<div class="sheet-panel" role="dialog" aria-modal="true">' +
            '<h3 class="sheet-title">记一条跟进</h3>' +
            '<textarea class="cust-follow-input" placeholder="今天联系了什么"></textarea>' +
            '<div class="sheet-actions">' +
            '<button type="button" class="sheet-btn" data-act="cancel">取消</button>' +
            '<button type="button" class="sheet-btn sheet-btn--primary" data-act="save">保存</button>' +
            '</div></div>';
        var input = sheet.querySelector('textarea');
        var saveBtn = sheet.querySelector('[data-act="save"]');

        function submit() {
            if (saving) return;
            var content = input.value.trim();
            if (!content) {
                toast.warn('跟进内容不能为空');
                input.focus();
                return;
            }
            saving = true;
            saveBtn.disabled = true;
            customers.addFollow(id, { content: content }).then(function () {
                if (!alive) return;
                saving = false;
                invalidateCustomerList();
                closeSheet();
                toast.success('跟进已记下');
                load();
            }).catch(function (err) {
                saving = false;
                if (saveBtn) saveBtn.disabled = false;
                toast.error((err && err.message) || '保存失败');
            });
        }

        sheet.addEventListener('click', function (e) {
            if (e.target === sheet) { if (!saving) closeSheet(); return; }
            var act = e.target.getAttribute && e.target.getAttribute('data-act');
            if (act === 'cancel' && !saving) closeSheet();
            if (act === 'save') submit();
        });
        document.body.appendChild(sheet);
        requestAnimationFrame(function () { if (sheet) sheet.classList.add('is-in'); });
        input.focus();
    }

    function onClick(e) {
        var act = e.target.closest && e.target.closest('[data-act]');
        if (act && container.contains(act)) {
            var name = act.getAttribute('data-act');
            if (name === 'back') goBack('/customers');
            if (name === 'retry') load();
            if (name === 'follow') openFollow();
            return;
        }
        var orderBtn = e.target.closest && e.target.closest('[data-order]');
        if (orderBtn && root.contains(orderBtn)) {
            navigate('/orders/' + encodeURIComponent(orderBtn.getAttribute('data-order')));
        }
    }

    container.addEventListener('click', onClick);
    load();

    return {
        destroy: function () {
            alive = false;
            closeSheet();
            container.removeEventListener('click', onClick);
            container.innerHTML = '';
        }
    };
}
