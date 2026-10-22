import '../../styles/workbench.css';
import { api } from '../../api/client.js';

var HIDE_KEY = 'wb_hide_amounts';

function escapeHtml(value) {
    return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function formatMoney(n, hidden) {
    if (hidden) return '****';
    var v = Math.round((parseFloat(n) || 0) * 100) / 100;
    var parts = v.toFixed(2).split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return parts.join('.');
}

function formatDateLabel(dateStr) {
    if (!dateStr) return '';
    var m = String(dateStr).match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!m) return dateStr;
    return parseInt(m[2], 10) + '月' + parseInt(m[3], 10) + '日';
}

function isAmountHidden() {
    try {
        return localStorage.getItem(HIDE_KEY) === '1';
    } catch (e) {
        return false;
    }
}

function setAmountHidden(hidden) {
    try {
        localStorage.setItem(HIDE_KEY, hidden ? '1' : '0');
    } catch (e) { /* ignore */ }
}

function txIcon(tx) {
    if (tx.type === 'expense') return '支';
    if (tx.category && tx.category.indexOf('工具') !== -1) return '工';
    return '</>';
}

function maxBarHeight(months) {
    var max = 0;
    (months || []).forEach(function (m) {
        if (m.income > max) max = m.income;
    });
    return max || 1;
}

function renderBars(months, hidden) {
    var max = maxBarHeight(months);
    if (!months || !months.length) {
        return '<p class="wb-empty">暂无趋势数据</p>';
    }
    return months.map(function (m) {
        var h = Math.max(4, Math.round((m.income / max) * 88));
        var isMax = m.income >= max;
        return (
            '<div class="wb-bar-col">' +
            '<span class="wb-bar-value">' + (hidden ? '**' : Math.round(m.income)) + '</span>' +
            '<div class="wb-bar' + (isMax ? ' is-max' : '') + '" style="height:' + h + 'px"></div>' +
            '<span class="wb-bar-label">' + escapeHtml(m.label) + '</span>' +
            '</div>'
        );
    }).join('');
}

function renderTransactions(list, hidden) {
    if (!list || !list.length) {
        return '<p class="wb-empty">还没有记录，点下方记一笔吧</p>';
    }
    return list.map(function (tx) {
        var sign = tx.type === 'income' ? '+' : '-';
        var cls = tx.type === 'income' ? 'income' : 'expense';
        return (
            '<div class="wb-tx">' +
            '<div class="wb-tx-icon">' + escapeHtml(txIcon(tx)) + '</div>' +
            '<div class="wb-tx-body">' +
            '<div class="wb-tx-title">' + escapeHtml(tx.title) + '</div>' +
            '<div class="wb-tx-meta">' + escapeHtml(formatDateLabel(tx.date) + ' · ' + (tx.category || '')) + '</div>' +
            '</div>' +
            '<div class="wb-tx-amount ' + cls + '">' + sign + formatMoney(tx.amount, hidden) + '</div>' +
            '</div>'
        );
    }).join('');
}

function renderMilestones(items) {
    return (items || []).map(function (m) {
        var icon = m.id === '10k' ? '🏆' : '⭐';
        return (
            '<div class="wb-milestone' + (m.achieved ? ' is-done' : '') + '">' +
            '<div class="wb-milestone-icon">' + icon + '</div>' +
            '<p class="wb-milestone-title">' + escapeHtml(m.title) + '</p>' +
            '<p class="wb-milestone-sub">' + escapeHtml(m.subtitle) + '</p>' +
            '</div>'
        );
    }).join('');
}

function renderWorkbench(data, range, hidden) {
    var s = data.summary || {};
    var g = data.goal || {};
    var t = data.trend || {};
    return (
        '<div class="wb-root" data-range="' + escapeHtml(range) + '">' +
        '<header class="wb-hero">' +
        '<div class="wb-hero-head">' +
        '<div><h1 class="wb-hero-title">' + escapeHtml(data.title || '开发小账') + '</h1>' +
        '<p class="wb-hero-sub">' + escapeHtml(data.subtitle || '') + '</p></div>' +
        '<button type="button" class="wb-hero-share" id="wb-share" aria-label="分享">' +
        '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">' +
        '<path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>' +
        '</button></div>' +
        '<div class="wb-hero-main">' +
        '<div class="wb-hero-label-row">' +
        '<span>累计开发收入 (元)</span>' +
        '<button type="button" class="wb-eye-btn" id="wb-toggle-amount" aria-label="隐藏金额">' +
        (hidden
            ? '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>'
            : '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>') +
        '</button></div>' +
        '<p class="wb-hero-amount' + (hidden ? ' wb-hidden-amount' : '') + '" id="wb-total-income">' + formatMoney(s.totalIncome, hidden) + '</p>' +
        '<div class="wb-hero-stats">' +
        '<div class="wb-hero-stat"><div class="wb-hero-stat-label">累计支出</div><div class="wb-hero-stat-value" data-wb="expense">' + formatMoney(s.totalExpense, hidden) + '</div></div>' +
        '<div class="wb-hero-stat"><div class="wb-hero-stat-label">累计净收入</div><div class="wb-hero-stat-value" data-wb="net">' + formatMoney(s.netIncome, hidden) + '</div></div>' +
        '</div></div></header>' +
        '<div class="wb-stack">' +
        '<section class="wb-card">' +
        '<div class="wb-card-head"><h2 class="wb-card-title">下一个小目标</h2><span class="wb-goal-target">¥' + formatMoney(g.amount, hidden) + '</span></div>' +
        '<div class="wb-progress-track"><div class="wb-progress-bar" style="width:' + (g.progress || 0) + '%"></div></div>' +
        '<p class="wb-goal-hint">' + escapeHtml(g.hint || '') + '</p>' +
        '</section>' +
        '<section class="wb-card">' +
        '<div class="wb-card-head">' +
        '<h2 class="wb-card-title">收入趋势</h2>' +
        '<div class="wb-seg" id="wb-range-seg">' +
        '<button type="button" data-range="year"' + (range === 'year' ? ' class="is-active"' : '') + '>今年</button>' +
        '<button type="button" data-range="all"' + (range === 'all' ? ' class="is-active"' : '') + '>全部</button>' +
        '</div></div>' +
        '<p class="wb-trend-caption">' + escapeHtml(t.rangeLabel || '今年') + '累计收入 ¥' + formatMoney(t.rangeIncome, hidden) + '</p>' +
        '<div class="wb-bars" id="wb-bars">' + renderBars(t.months, hidden) + '</div>' +
        '</section>' +
        '<section class="wb-card">' +
        '<h2 class="wb-card-title">成长里程碑</h2>' +
        '<div class="wb-milestones" style="margin-top:12px">' + renderMilestones(data.milestones) + '</div>' +
        '</section>' +
        '<section class="wb-card">' +
        '<div class="wb-list-head"><h2 class="wb-card-title">最近记录</h2><button type="button" class="wb-list-link" id="wb-more">全部 ›</button></div>' +
        '<div id="wb-tx-list">' + renderTransactions(data.recent, hidden) + '</div>' +
        '</section></div>' +
        '<div class="wb-fab-wrap"><button type="button" class="wb-fab" id="wb-add">+ 记一笔</button></div>' +
        '</div>'
    );
}

function openAddSheet(container, onSaved) {
    var today = new Date();
    var y = today.getFullYear();
    var m = String(today.getMonth() + 1).padStart(2, '0');
    var d = String(today.getDate()).padStart(2, '0');
    var backdrop = document.createElement('div');
    backdrop.className = 'wb-sheet-backdrop';
    backdrop.innerHTML =
        '<div class="wb-sheet" role="dialog">' +
        '<h3>记一笔</h3>' +
        '<div class="wb-field"><label>类型</label><select id="wb-f-type"><option value="income">收入</option><option value="expense">支出</option></select></div>' +
        '<div class="wb-field"><label>标题</label><input id="wb-f-title" type="text" placeholder="如：Cursor 订阅" /></div>' +
        '<div class="wb-field"><label>金额 (元)</label><input id="wb-f-amount" type="number" inputmode="decimal" step="0.01" min="0" /></div>' +
        '<div class="wb-field"><label>日期</label><input id="wb-f-date" type="date" value="' + y + '-' + m + '-' + d + '" /></div>' +
        '<div class="wb-field"><label>分类</label><select id="wb-f-cat">' +
        '<option value="开发收入">开发收入</option><option value="工具支出">工具支出</option><option value="项目成本">项目成本</option><option value="其他">其他</option>' +
        '</select></div>' +
        '<div class="wb-sheet-actions">' +
        '<button type="button" class="wb-sheet-cancel" id="wb-f-cancel">取消</button>' +
        '<button type="button" class="wb-sheet-submit" id="wb-f-save">保存</button>' +
        '</div></div>';

    function close() {
        backdrop.remove();
    }

    backdrop.addEventListener('click', function (e) {
        if (e.target === backdrop) close();
    });
    backdrop.querySelector('#wb-f-cancel').addEventListener('click', close);

    var typeEl = backdrop.querySelector('#wb-f-type');
    var catEl = backdrop.querySelector('#wb-f-cat');
    typeEl.addEventListener('change', function () {
        if (typeEl.value === 'expense') catEl.value = '工具支出';
        else catEl.value = '开发收入';
    });

    backdrop.querySelector('#wb-f-save').addEventListener('click', function () {
        var body = {
            type: typeEl.value,
            title: backdrop.querySelector('#wb-f-title').value.trim(),
            amount: backdrop.querySelector('#wb-f-amount').value,
            date: backdrop.querySelector('#wb-f-date').value,
            category: catEl.value
        };
        api.post('/api/ledger', body)
            .then(function () {
                close();
                if (onSaved) onSaved();
            })
            .catch(function (e) {
                window.alert(e.message || '保存失败');
            });
    });

    container.appendChild(backdrop);
}

function bindWorkbench(container, state) {
    var root = container.querySelector('.wb-root');
    if (!root) return;

    var eye = container.querySelector('#wb-toggle-amount');
    if (eye) {
        eye.addEventListener('click', function () {
            state.hidden = !state.hidden;
            setAmountHidden(state.hidden);
            loadWorkbench(container, state);
        });
    }

    var seg = container.querySelector('#wb-range-seg');
    if (seg) {
        seg.querySelectorAll('button[data-range]').forEach(function (btn) {
            btn.addEventListener('click', function () {
                state.range = btn.getAttribute('data-range') || 'year';
                loadWorkbench(container, state);
            });
        });
    }

    var addBtn = container.querySelector('#wb-add');
    if (addBtn) {
        addBtn.addEventListener('click', function () {
            openAddSheet(container, function () {
                loadWorkbench(container, state);
            });
        });
    }

    var more = container.querySelector('#wb-more');
    if (more) {
        more.addEventListener('click', function () {
            state.showAll = true;
            loadWorkbench(container, state);
        });
    }

    var share = container.querySelector('#wb-share');
    if (share) {
        share.addEventListener('click', function () {
            var s = state.lastData && state.lastData.summary;
            if (!s) return;
            var text = '开发小账：累计收入 ¥' + formatMoney(s.totalIncome, false);
            if (navigator.share) {
                navigator.share({ title: '开发小账', text: text }).catch(function () { /* ignore */ });
            } else {
                window.alert(text);
            }
        });
    }
}

function loadWorkbench(container, state) {
    state = state || { range: 'year', hidden: isAmountHidden(), showAll: false };
    container.innerHTML = '<p class="wb-empty" style="padding:24px">加载中…</p>';

    var limit = state.showAll ? 50 : 8;
    api.get('/api/ledger/workbench?range=' + encodeURIComponent(state.range) +
        '&recentLimit=' + limit)
        .then(function (res) {
            if (!res.success || !res.data) {
                container.innerHTML = '<p class="wb-error">加载失败</p>';
                return;
            }
            var data = res.data;
            state.lastData = data;
            container.innerHTML = renderWorkbench(data, state.range, state.hidden);
            bindWorkbench(container, state);
        })
        .catch(function (e) {
            container.innerHTML = '<p class="wb-error">' + escapeHtml(e.message || '无法加载收支数据') + '</p>';
        });
}

export function mountWorkbenchPanel(container) {
    loadWorkbench(container, { range: 'year', hidden: isAmountHidden(), showAll: false });
}
