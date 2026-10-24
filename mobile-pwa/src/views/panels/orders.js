/**
 * 订单列表
 *
 * 筛选和滚动记在 order-session.js：进详情再返回时，列表实例已经销毁，
 * 靠那份记忆把芯片、关键词和滚动位置装回来，并把刚改过的那张卡片补上新状态。
 */
import '../../styles/orders.css';
import { orders } from '../../api/resources.js';
import { createListView } from '../../components/list-view.js';
import {
    escapeHtml,
    formatMoney,
    describeDeadline,
    orderStatusLabel,
    orderStatusTone,
    paymentStatusTone,
    ORDER_STATUS_ORDER,
    ORDER_STATUS_LABELS
} from '../../lib/format.js';
import { navigate } from '../../router.js';
import {
    orderListSession,
    takeOrderPatch,
    applyPatchToItems
} from '../order-session.js';

var STATUS_CHIPS = [{ value: '', label: '全部状态' }].concat(
    ORDER_STATUS_ORDER.map(function (value) {
        return { value: value, label: ORDER_STATUS_LABELS[value] };
    })
);

var PAY_CHIPS = [
    { value: '', label: '全部付款' },
    { value: '未付款', label: '未付款' },
    { value: '部分付款', label: '部分付款' },
    { value: '已结清', label: '已结清' }
];

export function renderOrderCard(order) {
    var nick = escapeHtml(order.customerNick || order.customerName || '未填客户');
    var name = escapeHtml(order.projectName || '未命名项目');
    var pay = order.paymentStatus || '未付款';
    var payText = pay;
    if (pay === '部分付款' && order.paymentRatio) payText += ' ' + order.paymentRatio + '%';
    var due = describeDeadline(order.finalDate);
    var dueHtml = due.text
        ? '<span class="ord-due is-' + due.tone + '">' + escapeHtml(due.text) + '</span>'
        : '<span class="ord-due">未设终稿日</span>';

    return '<article class="ord-card">' +
        '<div class="ord-card-line">' +
        '<span class="ord-card-who">' + nick + '</span>' +
        '<span class="ord-card-name">' + name + '</span></div>' +
        '<div class="ord-card-line">' +
        '<span class="ord-card-amount">¥' + formatMoney(order.amount) + '</span>' +
        '<span class="ord-badge is-' + orderStatusTone(order.orderStatus) + '">' +
        escapeHtml(orderStatusLabel(order.orderStatus)) + '</span>' +
        '<span class="ord-badge is-' + paymentStatusTone(pay) + '">' + escapeHtml(payText) + '</span>' +
        '</div>' +
        '<div class="ord-card-line">' + dueHtml +
        (order.orderNo ? '<span class="ord-no">' + escapeHtml(order.orderNo) + '</span>' : '') +
        '</div></article>';
}

function chipRow(className, chips, current, attr) {
    return '<div class="ord-chips ' + className + '">' + chips.map(function (chip) {
        var on = chip.value === current ? ' is-active' : '';
        return '<button type="button" class="ord-chip' + on + '" data-' + attr + '="' +
            escapeHtml(chip.value) + '">' + escapeHtml(chip.label) + '</button>';
    }).join('') + '</div>';
}

export function mountOrdersPanel(container) {
    var filters = orderListSession.filters;
    var patch = takeOrderPatch();
    var snapshot = orderListSession.snapshot;
    if (snapshot && snapshot.ready && patch) {
        snapshot = Object.assign({}, snapshot, {
            items: applyPatchToItems(snapshot.items, patch)
        });
        orderListSession.snapshot = snapshot;
    }

    container.innerHTML =
        '<div class="ord-page">' +
        '  <div class="ord-tools">' +
        '    <input class="ord-search" type="search" enterkeyhint="search" placeholder="搜客户、项目、单号" aria-label="搜索订单" />' +
        chipRow('ord-chips-status', STATUS_CHIPS, filters.status, 'status') +
        // 付款 chips + 已逾期 合一行 —— 工具栏高度省一行；data-overdue 仍单独识别
        '    <div class="ord-chips ord-chips-pay">' +
        PAY_CHIPS.map(function (chip) {
            var on = chip.value === filters.paymentStatus ? ' is-active' : '';
            return '<button type="button" class="ord-chip' + on + '" data-pay="' +
                escapeHtml(chip.value) + '">' + escapeHtml(chip.label) + '</button>';
        }).join('') +
        '      <button type="button" class="ord-chip' + (filters.overdue ? ' is-active' : '') +
        '" data-overdue="1">已逾期</button>' +
        '    </div>' +
        '    <p class="ord-count"></p>' +
        '  </div>' +
        '  <div class="ord-list"></div>' +
        '</div>';

    var scroller = container.closest('.mobile-content') || container;
    var search = container.querySelector('.ord-search');
    var countEl = container.querySelector('.ord-count');
    var listHost = container.querySelector('.ord-list');
    search.value = filters.keyword || '';

    var keywordTimer = null;
    var restoreY = orderListSession.scrollTop || 0;

    function paintCount() {
        if (!lv) return;
        var st = lv.getState();
        countEl.textContent = st.loading ? '' : ('共 ' + st.total + ' 单');
    }

    function onContainerClick(e) {
        var statusBtn = e.target.closest && e.target.closest('[data-status]');
        if (statusBtn && container.contains(statusBtn)) {
            filters.status = statusBtn.getAttribute('data-status') || '';
            reloadFromFilters();
            return;
        }
        var payBtn = e.target.closest && e.target.closest('[data-pay]');
        if (payBtn && container.contains(payBtn)) {
            filters.paymentStatus = payBtn.getAttribute('data-pay') || '';
            reloadFromFilters();
            return;
        }
        var overdueBtn = e.target.closest && e.target.closest('[data-overdue]');
        if (overdueBtn && container.contains(overdueBtn)) {
            filters.overdue = !filters.overdue;
            reloadFromFilters();
        }
    }

    function markChips() {
        container.querySelectorAll('[data-status]').forEach(function (btn) {
            btn.classList.toggle('is-active', btn.getAttribute('data-status') === filters.status);
        });
        container.querySelectorAll('[data-pay]').forEach(function (btn) {
            btn.classList.toggle('is-active', btn.getAttribute('data-pay') === filters.paymentStatus);
        });
        var overdueBtn = container.querySelector('[data-overdue]');
        if (overdueBtn) overdueBtn.classList.toggle('is-active', !!filters.overdue);
    }

    var lv = createListView({
        container: listHost,
        pageSize: 15,
        autoLoad: !(snapshot && snapshot.ready && snapshot.items && snapshot.items.length),
        seed: snapshot && snapshot.ready ? snapshot : null,
        emptyText: '没有符合条件的订单',
        emptyHint: '换个筛选，或下拉刷新',
        fetchPage: function (ctx) {
            var params = { page: ctx.page, pageSize: ctx.pageSize, sort: 'orderDate_desc' };
            if (filters.keyword) params.keyword = filters.keyword;
            if (filters.status) params.status = filters.status;
            if (filters.paymentStatus) params.paymentStatus = filters.paymentStatus;
            if (filters.overdue) params.overdue = '1';
            return orders.list(params, { signal: ctx.signal });
        },
        renderItem: function (item) { return renderOrderCard(item); },
        onItemClick: function (item) {
            if (!item || !item.id) return;
            orderListSession.scrollTop = scroller.scrollTop;
            navigate('/orders/' + encodeURIComponent(item.id));
        },
        onLoaded: function () {
            paintCount();
            if (restoreY) {
                var y = restoreY;
                restoreY = 0;
                requestAnimationFrame(function () { scroller.scrollTop = y; });
            }
        }
    });

    paintCount();
    if (restoreY && snapshot && snapshot.ready && snapshot.items.length) {
        requestAnimationFrame(function () { scroller.scrollTop = restoreY; });
    }

    function reloadFromFilters() {
        orderListSession.snapshot = null;
        orderListSession.scrollTop = 0;
        restoreY = 0;
        scroller.scrollTop = 0;
        markChips();
        lv.reload().then(paintCount);
    }

    search.addEventListener('input', function () {
        filters.keyword = search.value.trim();
        clearTimeout(keywordTimer);
        keywordTimer = setTimeout(reloadFromFilters, 300);
    });
    search.addEventListener('keydown', function (e) {
        if (e.key !== 'Enter') return;
        clearTimeout(keywordTimer);
        filters.keyword = search.value.trim();
        reloadFromFilters();
    });

    container.addEventListener('click', onContainerClick);

    return {
        destroy: function () {
            clearTimeout(keywordTimer);
            container.removeEventListener('click', onContainerClick);
            if (lv) {
                var snap = lv.getSnapshot();
                if (snap.ready) orderListSession.snapshot = snap;
                orderListSession.scrollTop = scroller.scrollTop;
                lv.destroy();
            }
        }
    };
}
