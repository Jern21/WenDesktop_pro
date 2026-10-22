/**
 * 数据看板。数字全部来自 /api/stats，和桌面端同一口径。
 * 条形只按这些数字的相对长短来画，手机上不重算金额。
 */
import '../../styles/browse.css';
import '../../styles/stats.css';
import { stats } from '../../api/resources.js';
import { escapeHtml, formatGrowthPoints, formatMoney } from '../../lib/format.js';

var RANGES = [
    { value: 'all', label: '全部' },
    { value: 'year', label: '本年' },
    { value: 'month', label: '本月' }
];

var range = 'all';

function growthText(value, hasComparison) {
    if (!hasComparison) return '—';
    return formatGrowthPoints(value) || '—';
}

function metric(label, value, growth) {
    return '<p class="st-metric"><span>' + escapeHtml(label) + '</span><b>' +
        escapeHtml(value) + '</b><em>' + escapeHtml(growth) + '</em></p>';
}

function barRows(rows) {
    var max = 0;
    rows.forEach(function (row) { if (row.value > max) max = row.value; });
    if (!rows.length) return '<p class="st-row-meta">暂无</p>';
    return rows.map(function (row) {
        var width = max > 0 ? Math.max(0, Math.min(100, Math.round(row.value / max * 100))) : 0;
        return '<div class="st-row"><span class="st-row-name">' + escapeHtml(row.name) + '</span>' +
            '<span class="st-track"><i style="width:' + width + '%"></i></span>' +
            '<span class="st-row-value">' + escapeHtml(row.text) + '</span></div>';
    }).join('');
}

function block(title, body) {
    return '<section class="st-block"><h2>' + escapeHtml(title) + '</h2>' + body + '</section>';
}

export function mountStatsPanel(container) {
    var alive = true;
    var gen = 0;

    container.innerHTML =
        '<div class="st-page br-page">' +
        '  <div class="br-tools"><div class="br-chips"></div></div>' +
        '  <div class="st-body"></div>' +
        '</div>';

    var chips = container.querySelector('.br-chips');
    var body = container.querySelector('.st-body');

    function paintChips() {
        chips.innerHTML = RANGES.map(function (chip) {
            var on = chip.value === range ? ' is-active' : '';
            return '<button type="button" class="br-chip' + on + '" data-range="' +
                chip.value + '">' + escapeHtml(chip.label) + '</button>';
        }).join('');
    }

    function render(pack) {
        var overview = pack.overview || {};
        var compare = !!overview.hasComparison;
        var money = function (n) { return '¥' + formatMoney(overview[n]); };
        var revenue = Array.isArray(pack.revenue) ? pack.revenue : [];
        var types = Array.isArray(pack.types) ? pack.types : [];
        var platforms = Array.isArray(pack.platforms) ? pack.platforms : [];
        var levels = Array.isArray(pack.levels) ? pack.levels : [];
        var funnel = Array.isArray(pack.funnel) ? pack.funnel : [];

        body.innerHTML =
            '<div class="st-metrics">' +
            metric('订单', String(overview.orderCount || 0), growthText(overview.orderCountGrowth, compare)) +
            metric('成交额', money('revenue'), growthText(overview.revenueGrowth, compare)) +
            metric('利润', '¥' + formatMoney(overview.profit), '—') +
            metric('客单价', '¥' + formatMoney(overview.avgOrderValue), growthText(overview.avgOrderValueGrowth, compare)) +
            metric('成交客户', String(overview.customerCount || 0), growthText(overview.customerGrowth, compare)) +
            metric('复购率', (overview.repeatRate || 0) + '%', growthText(overview.repeatRateGrowth, compare)) +
            metric('好评率', (overview.goodRate || 0) + '%', growthText(overview.goodRateGrowth, compare)) +
            '</div>' +
            block('收入趋势', barRows(revenue.map(function (item) {
                return { name: item.month || '', value: Number(item.revenue) || 0, text: '¥' + formatMoney(item.revenue) };
            }))) +
            block('项目类型', barRows(types.map(function (item) {
                return { name: item.type || '其他', value: Number(item.revenue) || 0, text: (item.count || 0) + ' 单' };
            }))) +
            block('客户来源', barRows(platforms.map(function (item) {
                return { name: item.platform || '其他', value: Number(item.count) || 0, text: String(item.count || 0) };
            }))) +
            block('客户等级', barRows(levels.map(function (item) {
                return { name: item.level || '', value: Number(item.count) || 0, text: String(item.count || 0) };
            }))) +
            block('转化', barRows(funnel.map(function (item) {
                return { name: item.name || '', value: Number(item.value) || 0, text: String(item.value || 0) };
            })));
    }

    function fail(message) {
        body.innerHTML = '<div class="st-state"><p></p><button type="button" data-act="retry">重试</button></div>';
        body.querySelector('p').textContent = message || '加载失败';
    }

    function load() {
        gen += 1;
        var token = gen;
        body.innerHTML = '<div class="st-state"><p>加载中…</p></div>';
        var params = { range: range };
        Promise.all([
            stats.monthlyOverview(params),
            stats.revenue(params),
            stats.projectType(params),
            stats.platform(params),
            stats.customerLevel(params),
            stats.funnel(params)
        ]).then(function (parts) {
            if (!alive || token !== gen) return;
            render({
                overview: parts[0] && parts[0].data,
                revenue: parts[1] && parts[1].data,
                types: parts[2] && parts[2].data,
                platforms: parts[3] && parts[3].data,
                levels: parts[4] && parts[4].data,
                funnel: parts[5] && parts[5].data
            });
        }).catch(function (err) {
            if (!alive || token !== gen) return;
            fail((err && err.message) || '加载失败');
        });
    }

    function onClick(e) {
        var chip = e.target.closest && e.target.closest('[data-range]');
        if (chip && chips.contains(chip)) {
            range = chip.getAttribute('data-range') || 'all';
            paintChips();
            load();
            return;
        }
        var retry = e.target.closest && e.target.closest('[data-act="retry"]');
        if (retry && body.contains(retry)) load();
    }

    paintChips();
    container.addEventListener('click', onClick);
    load();

    return {
        destroy: function () {
            alive = false;
            gen += 1;
            container.removeEventListener('click', onClick);
        }
    };
}
