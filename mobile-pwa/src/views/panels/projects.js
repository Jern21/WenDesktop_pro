/**
 * 项目进度。数据用看板接口的五列，手机上改成上下分组，不横滑看板。
 * 左滑卡片可编辑常用字段 / 删除（swipe-crud 共享接线）。
 */
import '../../styles/browse.css';
import { projects } from '../../api/resources.js';
import { escapeHtml, formatMoney, describeDeadline } from '../../lib/format.js';
import { navigate } from '../../router.js';
import { projectListSession } from '../browse-session.js';
import { swipeRowHtml, attachSwipeCrud } from '../../components/swipe-crud.js';

var COLUMNS = ['待确认需求', '开发/设计中', '待验收', '已完成', '已关闭'];

/** 编辑表单字段：服务器/nginx/云盘这类基础设施字段留给桌面端 */
var PROJECT_FIELDS = [
    { key: 'name', label: '项目名称', full: true },
    { key: 'customer', label: '客户' },
    { key: 'type', label: '类型' },
    { key: 'status', label: '状态', type: 'select', options: COLUMNS },
    { key: 'priority', label: '优先级' },
    { key: 'progress', label: '进度（%）', type: 'number', inputmode: 'numeric', min: '0', max: '100', numeric: true },
    { key: 'amount', label: '金额（¥）', type: 'number', inputmode: 'decimal', min: '0', numeric: true },
    { key: 'deadline', label: '截止日期', type: 'date' },
    { key: 'gitUrl', label: '仓库地址', full: true }
];

var SCOPE_CHIPS = [
    { value: '', label: '全部' },
    { value: 'enterprise', label: '企业' },
    { value: 'personal', label: '个人' }
];

function moneyText(value) {
    if (value === undefined || value === null || value === '') return '';
    var n = parseFloat(value);
    if (isNaN(n)) return String(value);
    return '¥' + formatMoney(n);
}

function progressWidth(value) {
    var n = parseFloat(value);
    if (isNaN(n) || n < 0) n = 0;
    if (n > 100) n = 100;
    return n;
}

export function renderProjectCard(project) {
    var due = describeDeadline(project.deadline);
    var pct = progressWidth(project.progress);
    var meta = [project.customer, project.type].filter(Boolean).join(' · ');
    return swipeRowHtml('<button type="button" class="br-card" data-id="' + escapeHtml(project.id) + '">' +
        '<strong>' + escapeHtml(project.name || '未命名项目') + '</strong>' +
        '<div class="br-card-line">' +
        (moneyText(project.amount) ? '<span class="br-amount">' + escapeHtml(moneyText(project.amount)) + '</span>' : '<span class="br-amount"></span>') +
        (project.priority ? '<span class="br-badge">' + escapeHtml(project.priority) + '</span>' : '') +
        '</div>' +
        (meta ? '<p class="br-meta">' + escapeHtml(meta) + '</p>' : '') +
        (due.text ? '<p class="br-meta">' + escapeHtml(due.text) + '</p>' : '') +
        (pct ? '<div class="br-bar" aria-label="进度"><span style="width:' + pct + '%"></span></div><p class="br-meta">' + pct + '%</p>' : '') +
        '</button>');
}

export function mountProjectsPanel(container) {
    var filters = projectListSession.filters;
    var alive = true;
    var keywordTimer = null;
    var board = null;

    container.innerHTML =
        '<div class="br-page">' +
        '  <div class="br-tools">' +
        '    <input class="br-search" type="search" enterkeyhint="search" placeholder="搜项目、客户、编号" aria-label="搜索项目" />' +
        '    <div class="br-tools-row"><div class="br-chips">' +
        '      <span class="br-chipgroup br-scopes"></span>' +
        '      <span class="br-chipgroup br-statuses"></span>' +
        '    </div><button type="button" class="br-refresh" data-act="refresh">刷新</button></div>' +
        '    <p class="br-count"></p>' +
        '  </div>' +
        '  <div class="br-body"></div>' +
        '</div>';

    var scroller = container.closest('.mobile-content') || container;
    var search = container.querySelector('.br-search');
    var scopes = container.querySelector('.br-scopes');
    var statuses = container.querySelector('.br-statuses');
    var countEl = container.querySelector('.br-count');
    var body = container.querySelector('.br-body');
    search.value = filters.keyword || '';

    function chips(host, list, current, attr) {
        host.innerHTML = list.map(function (chip) {
            var on = chip.value === current ? ' is-active' : '';
            return '<button type="button" class="br-chip' + on + '" data-' + attr + '="' +
                escapeHtml(chip.value) + '">' + escapeHtml(chip.label) + '</button>';
        }).join('');
    }

    function paintChips() {
        chips(scopes, SCOPE_CHIPS, filters.scope, 'scope');
        chips(statuses, [{ value: '', label: '全部状态' }].concat(COLUMNS.map(function (name) {
            return { value: name, label: name };
        })), filters.status, 'status');
    }

    function render() {
        var kw = (filters.keyword || '').toLowerCase();
        var total = 0;
        var html = '';
        COLUMNS.forEach(function (key) {
            if (filters.status && filters.status !== key) return;
            var col = board && board[key];
            var items = (col && col.items) || [];
            if (kw) {
                items = items.filter(function (item) {
                    var blob = ((item && item.name) || '') + ' ' + ((item && item.customer) || '') + ' ' + ((item && item.code) || '');
                    return blob.toLowerCase().indexOf(kw) !== -1;
                });
            }
            if (!items.length) return;
            total += items.length;
            html += '<section class="br-group"><h2>' + escapeHtml((col && col.label) || key) +
                ' ' + items.length + '</h2>' +
                items.map(renderProjectCard).join('') + '</section>';
        });
        countEl.textContent = '共 ' + total + ' 个';
        body.innerHTML = html || '<div class="br-state"><p>没有符合条件的项目</p></div>';
    }

    function load() {
        body.innerHTML = '<div class="br-state"><p>加载中…</p></div>';
        var params = {};
        if (filters.scope) params.scope = filters.scope;
        projects.board(params).then(function (res) {
            if (!alive) return;
            board = res && res.data;
            render();
            if (projectListSession.scrollTop) {
                var y = projectListSession.scrollTop;
                projectListSession.scrollTop = 0;
                requestAnimationFrame(function () { scroller.scrollTop = y; });
            }
        }).catch(function (err) {
            if (!alive) return;
            countEl.textContent = '';
            body.innerHTML = '<div class="br-state"><p></p><button type="button" data-act="refresh">重试</button></div>';
            body.querySelector('p').textContent = (err && err.message) || '加载失败';
        });
    }

    function onClick(e) {
        var scopeBtn = e.target.closest && e.target.closest('[data-scope]');
        if (scopeBtn && scopes.contains(scopeBtn)) {
            filters.scope = scopeBtn.getAttribute('data-scope') || '';
            paintChips();
            load();
            return;
        }
        var statusBtn = e.target.closest && e.target.closest('[data-status]');
        if (statusBtn && statuses.contains(statusBtn)) {
            filters.status = statusBtn.getAttribute('data-status') || '';
            paintChips();
            if (board) render();
            return;
        }
        var refresh = e.target.closest && e.target.closest('[data-act="refresh"]');
        if (refresh && container.contains(refresh)) {
            load();
            return;
        }
        var card = e.target.closest && e.target.closest('[data-id]');
        if (card && body.contains(card)) {
            projectListSession.scrollTop = scroller.scrollTop;
            navigate('/projects/' + encodeURIComponent(card.getAttribute('data-id')));
        }
    }

    function findProject(id) {
        var found = null;
        COLUMNS.forEach(function (key) {
            var col = board && board[key];
            ((col && col.items) || []).forEach(function (item) {
                if (item && item.id === id) found = item;
            });
        });
        return found;
    }

    var swipe = attachSwipeCrud(body, {
        itemOf: function (row) {
            var card = row.querySelector('[data-id]');
            return card ? findProject(card.getAttribute('data-id')) : null;
        },
        title: '编辑项目',
        labelOf: function (p) { return p.name || '这个项目'; },
        fields: PROJECT_FIELDS,
        update: function (id, patch) { return projects.update(id, patch); },
        remove: function (id) { return projects.remove(id); },
        updated: function () { load(); },   // 状态可能跨列，直接整刷看板
        removed: function () { load(); },
        alive: function () { return alive; }
    });

    search.addEventListener('input', function () {
        filters.keyword = search.value.trim();
        clearTimeout(keywordTimer);
        keywordTimer = setTimeout(function () { if (board) render(); }, 300);
    });
    container.addEventListener('click', onClick);
    paintChips();
    load();

    return {
        destroy: function () {
            alive = false;
            swipe.destroy();
            clearTimeout(keywordTimer);
            container.removeEventListener('click', onClick);
            projectListSession.scrollTop = scroller.scrollTop;
        }
    };
}
