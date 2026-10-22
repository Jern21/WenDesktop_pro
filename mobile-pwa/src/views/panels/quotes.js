/**
 * 报价单列表。只读，改明细留在桌面端。
 */
import '../../styles/browse.css';
import { quotes } from '../../api/resources.js';
import { createListView } from '../../components/list-view.js';
import { escapeHtml, formatMoney, formatDate } from '../../lib/format.js';
import { navigate } from '../../router.js';
import { quoteListSession } from '../browse-session.js';

var STATUS_LABEL = {
    draft: '草稿',
    sent: '已发送',
    accepted: '已接受',
    rejected: '已拒绝',
    template: '模板'
};

var STATUS_CHIPS = [{ value: '', label: '全部' }].concat(
    ['draft', 'sent', 'accepted', 'rejected', 'template'].map(function (value) {
        return { value: value, label: STATUS_LABEL[value] };
    })
);

export function quoteStatusLabel(status) {
    return STATUS_LABEL[status] || status || '未标状态';
}

export function renderQuoteCard(quote) {
    var when = formatDate(quote.quoteDate, 'month-day') || quote.quoteDate || '';
    return '<article class="br-card">' +
        '<strong>' + escapeHtml(quote.projectName || '未命名报价') + '</strong>' +
        '<div class="br-card-line">' +
        '<span class="br-amount">¥' + formatMoney(quote.totalAmount) + '</span>' +
        '<span class="br-badge">' + escapeHtml(quoteStatusLabel(quote.status)) + '</span>' +
        '</div>' +
        '<p class="br-meta">' + escapeHtml([quote.customerName, when].filter(Boolean).join(' · ')) + '</p>' +
        '</article>';
}

export function mountQuotesPanel(container) {
    var filters = quoteListSession.filters;
    var snapshot = quoteListSession.snapshot;

    container.innerHTML =
        '<div class="br-page">' +
        '  <div class="br-tools">' +
        '    <input class="br-search" type="search" enterkeyhint="search" placeholder="搜项目、客户" aria-label="搜索报价单" />' +
        '    <div class="br-chips"></div>' +
        '    <p class="br-count"></p>' +
        '  </div>' +
        '  <div class="br-list"></div>' +
        '</div>';

    var scroller = container.closest('.mobile-content') || container;
    var search = container.querySelector('.br-search');
    var chips = container.querySelector('.br-chips');
    var countEl = container.querySelector('.br-count');
    var listHost = container.querySelector('.br-list');
    search.value = filters.keyword || '';
    chips.innerHTML = STATUS_CHIPS.map(function (chip) {
        var on = chip.value === filters.status ? ' is-active' : '';
        return '<button type="button" class="br-chip' + on + '" data-status="' +
            escapeHtml(chip.value) + '">' + escapeHtml(chip.label) + '</button>';
    }).join('');

    var keywordTimer = null;
    var restoreY = quoteListSession.scrollTop || 0;

    function paintCount() {
        if (!lv) return;
        var st = lv.getState();
        countEl.textContent = st.loading ? '' : ('共 ' + st.total + ' 份');
    }

    var lv = createListView({
        container: listHost,
        pageSize: 20,
        autoLoad: !(snapshot && snapshot.ready && snapshot.items && snapshot.items.length),
        seed: snapshot && snapshot.ready ? snapshot : null,
        emptyText: '没有符合条件的报价单',
        emptyHint: '换个关键词，或下拉刷新',
        fetchPage: function (ctx) {
            var params = {};
            if (filters.keyword) params.keyword = filters.keyword;
            return quotes.list(params, { signal: ctx.signal }).then(function (res) {
                if (!filters.status || !res || !Array.isArray(res.data)) return res;
                return Object.assign({}, res, {
                    data: res.data.filter(function (item) {
                        return item && item.status === filters.status;
                    })
                });
            });
        },
        renderItem: function (item) { return renderQuoteCard(item); },
        onItemClick: function (item) {
            if (!item || !item.id) return;
            quoteListSession.scrollTop = scroller.scrollTop;
            navigate('/quotes/' + encodeURIComponent(item.id));
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

    function reloadFromFilters() {
        quoteListSession.snapshot = null;
        quoteListSession.scrollTop = 0;
        restoreY = 0;
        scroller.scrollTop = 0;
        chips.querySelectorAll('[data-status]').forEach(function (btn) {
            btn.classList.toggle('is-active', btn.getAttribute('data-status') === filters.status);
        });
        lv.reload().then(paintCount);
    }

    function onChipsClick(e) {
        var btn = e.target.closest && e.target.closest('[data-status]');
        if (!btn || !chips.contains(btn)) return;
        filters.status = btn.getAttribute('data-status') || '';
        reloadFromFilters();
    }

    search.addEventListener('input', function () {
        filters.keyword = search.value.trim();
        clearTimeout(keywordTimer);
        keywordTimer = setTimeout(reloadFromFilters, 300);
    });
    chips.addEventListener('click', onChipsClick);

    return {
        destroy: function () {
            clearTimeout(keywordTimer);
            chips.removeEventListener('click', onChipsClick);
            if (lv) {
                var snap = lv.getSnapshot();
                if (snap.ready) quoteListSession.snapshot = snap;
                quoteListSession.scrollTop = scroller.scrollTop;
                lv.destroy();
            }
        }
    };
}
