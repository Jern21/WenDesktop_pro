import '../../styles/workbench.css';
import { escapeHtml, formatMoney, formatMoneyInt, formatDate } from '../../lib/format.js';
import { toast } from '../../lib/toast.js';
import { ledger, stats, settings, llm, uploads } from '../../api/resources.js';
import { navigate } from '../../router.js';
import { NAV_ICONS, WB_ICONS } from '../../icons.js';
import { orderListSession } from '../order-session.js';

var HIDE_KEY = 'wb_hide_amounts';

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
        var h = Math.max(4, Math.round((m.income / max) * 48));
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
            '<div class="wb-tx-meta">' + escapeHtml(formatDate(tx.date, 'month-day') + ' · ' + (tx.category || '')) + '</div>' +
            '</div>' +
            '<div class="wb-tx-amount ' + cls + '">' + sign + formatMoney(tx.amount, hidden) + '</div>' +
            '</div>'
        );
    }).join('');
}

function renderMilestones(items) {
    var icons = { first: WB_ICONS.star, '10k': WB_ICONS.trophy, goal: WB_ICONS.car };
    return (items || []).map(function (m) {
        var icon = icons[m.id] || WB_ICONS.star;
        return (
            '<div class="wb-milestone' + (m.achieved ? ' is-done' : '') + '">' +
            '<div class="wb-milestone-icon">' + icon + '</div>' +
            '<div class="wb-milestone-copy">' +
            '<p class="wb-milestone-title">' + escapeHtml(m.title) + '</p>' +
            '<p class="wb-milestone-sub">' + escapeHtml(m.subtitle) + '</p>' +
            '</div></div>'
        );
    }).join('');
}

function countText(n) {
    return typeof n === 'number' ? String(n) : '—';
}

var BIZ_CELLS = [
    { jump: 'customers', icon: NAV_ICONS.users, tone: 'blue', label: '累计客户' },
    { jump: 'deals', icon: WB_ICONS.briefcase, tone: 'green', label: '累计成交（单）' },
    { jump: 'unpaid', icon: WB_ICONS.coin, tone: 'orange', label: '待回款' },
    { jump: 'processing', icon: NAV_ICONS.receipt, tone: 'purple', label: '进行中订单' }
];

function bizStatValue(jump, dash, home, hidden) {
    if (jump === 'customers') return countText(dash && dash.totalCustomers);
    if (jump === 'deals') return countText(dash && dash.paidOrders);
    if (jump === 'unpaid') {
        return dash && typeof dash.pendingPayment === 'number'
            ? '¥' + formatMoneyInt(dash.pendingPayment, hidden) : '—';
    }
    return countText(home && home.activeOrders);
}

function renderBizStats(overview, hidden) {
    var dash = overview && overview.dash;
    var home = overview && overview.home;
    return (
        '<section class="wb-card">' +
        '<div class="wb-card-head"><h2 class="wb-card-title">经营总览</h2>' +
        '<button type="button" class="wb-card-link" data-jump="stats">查看详情 ›</button></div>' +
        '<div class="wb-stats">' +
        BIZ_CELLS.map(function (cell) {
            return '<button type="button" class="wb-stat" data-jump="' + cell.jump + '">' +
                '<span class="wb-stat-ic is-' + cell.tone + '">' + cell.icon + '</span>' +
                '<span class="wb-stat-txt"><strong>' + bizStatValue(cell.jump, dash, home, hidden) + '</strong>' +
                '<span>' + cell.label + '</span></span></button>';
        }).join('') +
        '</div></section>'
    );
}

function renderGoalCard(g, s, hidden) {
    var name = g.name || '下一个小目标';
    var cheer = g.progress >= 100
        ? '目标已达成，继续保持！'
        : '加油！离它又近一步！';
    return (
        '<section class="wb-goal" id="wb-goal">' +
        '<img class="wb-goal-bg" src="' + escapeHtml(g.image || '/img/goal-dream.png') + '" alt="" />' +
        '<div class="wb-goal-body">' +
        '<p class="wb-goal-title">下一站 · ' + escapeHtml(name) + '<span class="wb-goal-arrow"> ›</span></p>' +
        '<p class="wb-goal-sub">每一份努力，都在离它更近一点。</p>' +
        '<div class="wb-goal-nums">' +
        '<div><span class="wb-goal-k">目标金额</span><b>¥' + formatMoneyInt(g.amount, hidden) + '</b></div>' +
        '<div><span class="wb-goal-k">已积累</span><b>¥' + formatMoneyInt(s.totalIncome, hidden) + '</b></div>' +
        '</div>' +
        '<div class="wb-goal-trackrow"><div class="wb-goal-track">' +
        '<div class="wb-goal-fill" style="width:' + (g.progress || 0) + '%"></div></div>' +
        '<span class="wb-goal-pct">' + (g.progress || 0) + '%</span></div>' +
        '<div class="wb-goal-tail"><span>还差 ¥' + formatMoneyInt(g.remaining, hidden) + '</span>' +
        '<span class="wb-goal-cheer"><i class="wb-goal-flag">' + WB_ICONS.flag + '</i>' + cheer + '</span></div>' +
        '</div></section>'
    );
}

function renderGrokCard(grok) {
    var ready = !!(grok && grok.configured);
    var model = grok && grok.model ? String(grok.model) : '';
    return (
        '<section class="wb-grok" id="wb-grok" data-jump="grok">' +
        '<div class="wb-grok-head"><span class="wb-grok-mark">' + WB_ICONS.grok + '</span>' +
        '<span class="wb-grok-pulse' + (ready ? ' is-on' : '') + '"></span></div>' +
        '<p class="wb-grok-title">GrokBot</p>' +
        '<p class="wb-grok-sub">' + (ready ? escapeHtml(model || '已接入') : '远程助理 · 待配置') + '</p>' +
        '<p class="wb-grok-note">近期暂无对话记录</p>' +
        '<span class="wb-grok-go">开始对话 ›</span>' +
        '</section>'
    );
}

function renderWorkbench(data, range, hidden, state) {
    var s = data.summary || {};
    var g = data.goal || {};
    var t = data.trend || {};
    return (
        '<div class="wb-root" data-range="' + escapeHtml(range) + '">' +
        '<header class="wb-hero">' +
        '<svg class="wb-hero-deco" viewBox="0 0 116 80" aria-hidden="true" fill="currentColor">' +
        '<rect x="4" y="48" width="16" height="32" rx="4"/>' +
        '<rect x="28" y="38" width="16" height="42" rx="4"/>' +
        '<rect x="52" y="26" width="16" height="54" rx="4"/>' +
        '<rect x="76" y="34" width="16" height="46" rx="4"/>' +
        '<rect x="100" y="14" width="16" height="66" rx="4"/>' +
        '</svg>' +
        '<button type="button" class="wb-hero-share" id="wb-share" aria-label="分享">' +
        '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4">' +
        '<path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>' +
        '<span>分享</span></button>' +
        '<div>' +
        '<div class="wb-hero-label-row">' +
        '<span class="wb-hero-coin">' + WB_ICONS.coin + '</span><span>累计开发收入 (元)</span>' +
        '<button type="button" class="wb-eye-btn" id="wb-toggle-amount" aria-label="隐藏金额">' +
        (hidden
            ? '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>'
            : '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>') +
        '</button></div>' +
        '<p class="wb-hero-amount' + (hidden ? ' wb-hidden-amount' : '') + '" id="wb-total-income">' + formatMoney(s.totalIncome, hidden) + '</p>' +
        '<div class="wb-hero-stats">' +
        '<div class="wb-hero-stat"><div class="wb-hero-stat-label">' +
        '<span class="wb-hero-stat-ic"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><line x1="5" y1="12" x2="19" y2="12"/></svg></span>累计支出</div>' +
        '<div class="wb-hero-stat-value" data-wb="expense">' + formatMoney(s.totalExpense, hidden) + '</div></div>' +
        '<div class="wb-hero-stat"><div class="wb-hero-stat-label">' +
        '<span class="wb-hero-stat-ic"><svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><rect x="4" y="14" width="4" height="7" rx="1"/><rect x="10" y="9" width="4" height="12" rx="1"/><rect x="16" y="4" width="4" height="17" rx="1"/></svg></span>累计净收入</div>' +
        '<div class="wb-hero-stat-value" data-wb="net">' + formatMoney(s.netIncome, hidden) + '</div></div>' +
        '</div></div></header>' +
        '<div class="wb-stack">' +
        renderGoalCard(g, s, hidden) +
        renderBizStats(state.overview, hidden) +
        '<div class="wb-duo">' +
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
        renderGrokCard(state.overview && state.overview.grok) +
        '</div>' +
        '<section class="wb-card">' +
        '<h2 class="wb-card-title">成长里程碑</h2>' +
        '<div class="wb-milestones">' + renderMilestones(data.milestones) + '</div>' +
        '</section>' +
        '<section class="wb-card">' +
        '<div class="wb-list-head"><h2 class="wb-card-title">最近记录</h2><button type="button" class="wb-list-link" id="wb-more">全部 ›</button></div>' +
        '<div id="wb-tx-list">' + renderTransactions(data.recent, hidden) + '</div>' +
        '</section></div>' +
        '<div class="wb-fab-wrap"><button type="button" class="wb-fab" id="wb-add">+ 记一笔</button></div>' +
        '</div>'
    );
}

function resetOrderListSession() {
    var f = orderListSession.filters;
    f.keyword = '';
    f.status = '';
    f.paymentStatus = '';
    f.overdue = false;
    orderListSession.snapshot = null;
    orderListSession.scrollTop = 0;
    orderListSession.patch = null;
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
        ledger.create(body)
            .then(function () {
                close();
                toast.success('已记一笔');
                if (onSaved) onSaved();
            })
            .catch(function (e) {
                toast.error(e.message || '保存失败');
            });
    });

    document.body.appendChild(backdrop);
}

function openGoalSheet(container, goal, onSaved) {
    var backdrop = document.createElement('div');
    backdrop.className = 'wb-sheet-backdrop';
    backdrop.innerHTML =
        '<div class="wb-sheet" role="dialog">' +
        '<h3>设置小目标</h3>' +
        '<div class="wb-field"><label>目标名称</label>' +
        '<input id="wb-g-name" type="text" placeholder="如：我的爱车" value="' + escapeHtml(goal.name || '') + '" /></div>' +
        '<div class="wb-field"><label>目标金额 (元)</label>' +
        '<input id="wb-g-amount" type="number" inputmode="decimal" step="0.01" min="0" value="' + (goal.amount || '') + '" /></div>' +
        '<div class="wb-field"><label>目标图片（可选）</label>' +
        '<div class="wb-goal-preview" id="wb-g-preview">' +
        (goal.image
            ? '<img src="' + escapeHtml(goal.image) + '" alt="" />'
            : '<span>暂无图片，选一个想攒钱买的东西吧</span>') +
        '</div>' +
        '<input id="wb-g-file" type="file" accept="image/*" hidden />' +
        '<button type="button" class="wb-sheet-cancel wb-goal-pick" id="wb-g-pick">选择图片</button>' +
        '</div>' +
        '<div class="wb-sheet-actions">' +
        '<button type="button" class="wb-sheet-cancel" id="wb-g-cancel">取消</button>' +
        '<button type="button" class="wb-sheet-submit" id="wb-g-save">保存</button>' +
        '</div></div>';

    function close() {
        backdrop.remove();
    }

    backdrop.addEventListener('click', function (e) {
        if (e.target === backdrop) close();
    });
    backdrop.querySelector('#wb-g-cancel').addEventListener('click', close);

    var pendingFile = null;
    var fileInput = backdrop.querySelector('#wb-g-file');
    backdrop.querySelector('#wb-g-pick').addEventListener('click', function () {
        fileInput.click();
    });
    fileInput.addEventListener('change', function () {
        pendingFile = fileInput.files && fileInput.files[0];
        if (!pendingFile) return;
        backdrop.querySelector('#wb-g-preview').innerHTML =
            '<img src="' + URL.createObjectURL(pendingFile) + '" alt="" />';
    });

    backdrop.querySelector('#wb-g-save').addEventListener('click', function () {
        var saveBtn = this;
        var name = backdrop.querySelector('#wb-g-name').value.trim();
        var amount = parseFloat(backdrop.querySelector('#wb-g-amount').value) || 0;
        if (amount <= 0) {
            toast.error('目标金额需大于 0');
            return;
        }
        saveBtn.disabled = true;

        function persist(imageUrl) {
            settings.update({
                devLedger: {
                    goalName: name,
                    goalAmount: amount,
                    goalImage: imageUrl
                }
            }).then(function () {
                close();
                toast.success('小目标已更新');
                if (onSaved) onSaved();
            }).catch(function (e) {
                toast.error(e.message || '保存失败');
                saveBtn.disabled = false;
            });
        }

        if (!pendingFile) {
            persist(goal.image || '');
            return;
        }
        uploads.file(pendingFile)
            .then(function (res) {
                persist((res && res.data && res.data.url) || '');
            })
            .catch(function (e) {
                toast.error(e.message || '图片上传失败');
                saveBtn.disabled = false;
            });
    });

    document.body.appendChild(backdrop);
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

    container.querySelectorAll('[data-jump]').forEach(function (btn) {
        btn.addEventListener('click', function () {
            var jump = btn.getAttribute('data-jump');
            if (jump === 'customers' || jump === 'reply') {
                navigate('/customers');
                return;
            }
            if (jump === 'projects') {
                navigate('/projects');
                return;
            }
            if (jump === 'stats') {
                navigate('/stats');
                return;
            }
            // 其余跳转都落在订单列表：先清掉旧筛选，再按需设置
            resetOrderListSession();
            if (jump === 'processing') {
                orderListSession.filters.status = 'processing';
            }
            navigate('/orders');
        });
    });

    var goalCard = container.querySelector('#wb-goal');
    if (goalCard) {
        goalCard.addEventListener('click', function () {
            var goal = (state.lastData && state.lastData.goal) || {};
            openGoalSheet(container, goal, function () {
                loadWorkbench(container, state);
            });
        });
    }

    var grokCard = container.querySelector('#wb-grok');
    if (grokCard) {
        grokCard.addEventListener('click', function () {
            navigate('/grok');
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

            // 依次降级：系统分享 → 剪贴板 → toast 展示。
            // 不用 window.alert：它会阻塞 JS、打断手势，且 iOS 上会被当成页面切换。
            if (navigator.share) {
                navigator.share({ title: '开发小账', text: text }).catch(function () { /* 用户取消，忽略 */ });
                return;
            }
            if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(text)
                    .then(function () { toast.success('已复制到剪贴板'); })
                    .catch(function () { toast.info(text); });
                return;
            }
            toast.info(text);
        });
    }
}

function loadWorkbench(container, state) {
    state = state || { range: 'all', hidden: isAmountHidden(), showAll: false, generation: 0, disposed: false };
    state.generation = (state.generation || 0) + 1;
    var generation = state.generation;
    container.innerHTML = '<p class="wb-empty" style="padding:24px">加载中…</p>';

    var limit = state.showAll ? 50 : 3;
    Promise.all([
        ledger.workbench({ range: state.range, recentLimit: limit }),
        stats.homeMetrics().catch(function () { return null; }),
        stats.dashboard().catch(function () { return null; }),
        llm.config().catch(function () { return null; })
    ])
        .then(function (parts) {
            var res = parts[0];
            if (state.disposed || state.generation !== generation) return;
            if (!res.success || !res.data) {
                container.innerHTML = '<p class="wb-error">加载失败</p>';
                return;
            }
            var data = res.data;
            state.lastData = data;
            state.overview = {
                home: parts[1] && parts[1].data,
                dash: parts[2] && parts[2].data,
                grok: parts[3] && parts[3].data
            };
            container.innerHTML = renderWorkbench(data, state.range, state.hidden, state);
            bindWorkbench(container, state);
        })
        .catch(function (e) {
            if (state.disposed || state.generation !== generation) return;
            container.innerHTML = '<p class="wb-error">' + escapeHtml(e.message || '无法加载收支数据') + '</p>';
        });
}

export function mountWorkbenchPanel(container) {
    var state = { range: 'all', hidden: isAmountHidden(), showAll: false, generation: 0, disposed: false };
    loadWorkbench(container, state);
    return {
        destroy: function () {
            state.disposed = true;
            state.generation += 1;
        }
    };
}
