/**
 * 报价明细。只读。
 */
import '../../styles/browse.css';
import { quotes } from '../../api/resources.js';
import { escapeHtml, formatMoney, formatDate } from '../../lib/format.js';
import { goBack } from '../../router.js';
import { quoteStatusLabel } from './quotes.js';

function lineAmount(item) {
    var qty = parseFloat(item && item.qty) || 0;
    var price = parseFloat(item && item.price) || 0;
    return qty * price;
}

export function mountQuoteDetailPanel(container, route) {
    var id = route && route.params ? route.params.id : '';
    var alive = true;

    container.innerHTML = '<div class="br-detail"></div>';
    var root = container.querySelector('.br-detail');

    function showState(message, act, label) {
        root.innerHTML = '<div class="br-state"><p></p>' +
            (act ? '<button type="button" data-act="' + act + '">' + escapeHtml(label) + '</button>' : '') +
            '</div>';
        root.querySelector('p').textContent = message;
    }

    function row(label, value) {
        if (!value) return '';
        return '<div class="br-row"><span>' + escapeHtml(label) + '</span><b>' + escapeHtml(String(value)) + '</b></div>';
    }

    function render(quote) {
        var items = Array.isArray(quote.items) ? quote.items : [];
        root.innerHTML =
            '<section class="br-block">' +
            '<h1 class="br-name">' + escapeHtml(quote.projectName || '未命名报价') + '</h1>' +
            row('客户', quote.customerName) +
            row('状态', quoteStatusLabel(quote.status)) +
            row('日期', formatDate(quote.quoteDate, 'full') || quote.quoteDate) +
            row('周期', quote.cycle) +
            row('优惠', quote.discount ? '¥' + formatMoney(quote.discount) : '') +
            row('合计', '¥' + formatMoney(quote.totalAmount)) +
            '</section>' +
            '<section class="br-block"><h2>明细</h2>' +
            (items.length ? items.map(function (item) {
                return '<div class="br-item"><strong>' + escapeHtml(item.name || '未命名项目') + '</strong>' +
                    (item.desc ? '<p class="br-meta">' + escapeHtml(item.desc) + '</p>' : '') +
                    '<p class="br-meta">' + escapeHtml(String(item.qty || 0)) + ' × ¥' + formatMoney(item.price) +
                    ' · ¥' + formatMoney(lineAmount(item)) + '</p></div>';
            }).join('') : '<p class="br-meta">没有明细</p>') +
            '</section>' +
            (quote.paymentMethod || quote.notes
                ? '<section class="br-block"><h2>条款</h2>' +
                  (quote.paymentMethod ? '<p class="br-meta">' + escapeHtml(quote.paymentMethod) + '</p>' : '') +
                  (quote.notes ? '<p class="br-meta">' + escapeHtml(quote.notes) + '</p>' : '') +
                  '</section>'
                : '');
    }

    function load() {
        if (!id) {
            showState('报价单不存在', 'back', '返回报价列表');
            return;
        }
        showState('加载中…');
        quotes.detail(id).then(function (res) {
            if (!alive) return;
            if (!res || !res.data) {
                showState('报价单不存在', 'back', '返回报价列表');
                return;
            }
            render(res.data);
        }).catch(function (err) {
            if (!alive) return;
            var missing = err && err.status === 404;
            showState(
                (err && err.message) || (missing ? '报价单不存在' : '加载失败'),
                missing ? 'back' : 'retry',
                missing ? '返回报价列表' : '重试'
            );
        });
    }

    function onClick(e) {
        var act = e.target.closest && e.target.closest('[data-act]');
        if (!act || !root.contains(act)) return;
        var name = act.getAttribute('data-act');
        if (name === 'back') goBack('/quotes');
        if (name === 'retry') load();
    }

    root.addEventListener('click', onClick);
    load();

    return {
        destroy: function () {
            alive = false;
            root.removeEventListener('click', onClick);
        }
    };
}
