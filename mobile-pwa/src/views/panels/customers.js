/**
 * 客户列表。关键词走后端，跟进状态在拿到全量后筛。
 * 筛选和滚动记在 customer-session.js，从详情返回时装回来。
 */
import '../../styles/customers.css';
import { customers } from '../../api/resources.js';
import { createListView } from '../../components/list-view.js';
import { escapeHtml } from '../../lib/format.js';
import { navigate } from '../../router.js';
import { customerListSession } from '../customer-session.js';
import { swipeRowHtml, attachSwipeCrud } from '../../components/swipe-crud.js';

var FOLLOW_CHIPS = [
    { value: '', label: '全部' },
    { value: '待跟进', label: '待跟进' },
    { value: '跟进中', label: '跟进中' },
    { value: '已成交', label: '已成交' },
    { value: '已流失', label: '已流失' }
];

var CUSTOMER_SOURCES = ['闲鱼', '小红书', '抖音', '微信', '淘宝', '朋友推荐', '其他'];

/** 编辑表单字段（swipe-crud → form-sheet 共用引擎） */
var CUSTOMER_FIELDS = [
    { key: 'name', label: '姓名', full: true, placeholder: '客户称呼' },
    { key: 'phone', label: '电话', type: 'tel' },
    { key: 'type', label: '类型', placeholder: '例如：个人/企业' },
    { key: 'level', label: '等级', placeholder: '例如：高价值' },
    { key: 'source', label: '来源', type: 'select', options: CUSTOMER_SOURCES },
    { key: 'followStatus', label: '跟进状态', type: 'select',
      options: ['待跟进', '跟进中', '已成交', '已流失'] }
];

export function renderCustomerCard(customer) {
    var meta = [customer.source, customer.level].filter(Boolean).join(' · ');
    var amount = customer.totalAmount && customer.totalAmount !== '-' ? customer.totalAmount : '';
    var tail = [];
    if (customer.orderCount) tail.push(customer.orderCount + ' 单');
    if (amount) tail.push(amount);
    if (customer.followTime) tail.push(customer.followTime);
    return '<article class="cust-card">' +
        '<div class="cust-card-name">' + escapeHtml(customer.name || '未命名客户') + '</div>' +
        '<div class="cust-card-line">' +
        (customer.phone ? '<span class="cust-card-phone">' + escapeHtml(customer.phone) + '</span>' : '') +
        (customer.followStatus ? '<span class="cust-badge">' + escapeHtml(customer.followStatus) + '</span>' : '') +
        (customer.type ? '<span class="cust-badge">' + escapeHtml(customer.type) + '</span>' : '') +
        '</div>' +
        '<div class="cust-card-meta">' + escapeHtml([meta].concat(tail).filter(Boolean).join(' · ')) + '</div>' +
        '</article>';
}

export function mountCustomersPanel(container) {
    var filters = customerListSession.filters;
    var snapshot = customerListSession.snapshot;

    container.innerHTML =
        '<div class="cust-page">' +
        '  <div class="cust-tools">' +
        '    <input class="cust-search" type="search" enterkeyhint="search" placeholder="搜姓名、电话、备注" aria-label="搜索客户" />' +
        '    <div class="cust-chips"></div>' +
        '    <p class="cust-count"></p>' +
        '  </div>' +
        '  <div class="cust-list"></div>' +
        '</div>';

    var scroller = container.closest('.mobile-content') || container;
    var search = container.querySelector('.cust-search');
    var chips = container.querySelector('.cust-chips');
    var countEl = container.querySelector('.cust-count');
    var listHost = container.querySelector('.cust-list');
    search.value = filters.keyword || '';
    chips.innerHTML = FOLLOW_CHIPS.map(function (chip) {
        var on = chip.value === filters.followStatus ? ' is-active' : '';
        return '<button type="button" class="cust-chip' + on + '" data-follow="' +
            escapeHtml(chip.value) + '">' + escapeHtml(chip.label) + '</button>';
    }).join('');

    var keywordTimer = null;
    var restoreY = customerListSession.scrollTop || 0;

    function paintCount() {
        if (!lv) return;
        var st = lv.getState();
        countEl.textContent = st.loading ? '' : ('共 ' + st.total + ' 位');
    }

    function markChips() {
        chips.querySelectorAll('[data-follow]').forEach(function (btn) {
            btn.classList.toggle('is-active', btn.getAttribute('data-follow') === filters.followStatus);
        });
    }

    var lv = createListView({
        container: listHost,
        pageSize: 30,
        autoLoad: !(snapshot && snapshot.ready && snapshot.items && snapshot.items.length),
        seed: snapshot && snapshot.ready ? snapshot : null,
        emptyText: '没有符合条件的客户',
        emptyHint: '换个关键词，或下拉刷新',
        fetchPage: function (ctx) {
            var params = {};
            if (filters.keyword) params.keyword = filters.keyword;
            return customers.list(params, { signal: ctx.signal }).then(function (res) {
                if (!filters.followStatus || !res || !Array.isArray(res.data)) return res;
                return Object.assign({}, res, {
                    data: res.data.filter(function (item) {
                        return item && item.followStatus === filters.followStatus;
                    })
                });
            });
        },
        renderItem: function (item) { return swipeRowHtml(renderCustomerCard(item)); },
        onItemClick: function (item) {
            if (!item || !item.id) return;
            customerListSession.scrollTop = scroller.scrollTop;
            navigate('/customers/' + encodeURIComponent(item.id));
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

    var alive = true;
    var swipe = attachSwipeCrud(listHost, {
        itemOf: function (row) {
            var idx = parseInt(row.parentNode.getAttribute('data-index'), 10);
            return isNaN(idx) ? null : lv.getItems()[idx];
        },
        title: '编辑客户',
        labelOf: function (c) { return c.name || '这位客户'; },
        fields: CUSTOMER_FIELDS,
        update: function (id, patch) { return customers.update(id, patch); },
        remove: function (id) { return customers.remove(id); },
        updated: function (saved) { lv.updateItem(saved); },
        removed: function (id) { lv.removeItemById(id); },
        alive: function () { return alive; }
    });

    paintCount();

    function reloadFromFilters() {
        customerListSession.snapshot = null;
        customerListSession.scrollTop = 0;
        restoreY = 0;
        scroller.scrollTop = 0;
        markChips();
        lv.reload().then(paintCount);
    }

    function onChipsClick(e) {
        var btn = e.target.closest && e.target.closest('[data-follow]');
        if (!btn || !chips.contains(btn)) return;
        filters.followStatus = btn.getAttribute('data-follow') || '';
        reloadFromFilters();
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
    chips.addEventListener('click', onChipsClick);

    return {
        destroy: function () {
            alive = false;
            swipe.destroy();
            clearTimeout(keywordTimer);
            chips.removeEventListener('click', onChipsClick);
            if (lv) {
                var snap = lv.getSnapshot();
                if (snap.ready) customerListSession.snapshot = snap;
                customerListSession.scrollTop = scroller.scrollTop;
                lv.destroy();
            }
        }
    };
}
