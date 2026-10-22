/**
 * 项目详情：进度和交付地址。只读，修改留在桌面端。
 * 服务器配置和 Nginx 原文不在手机上展开。
 */
import '../../styles/browse.css';
import { projects } from '../../api/resources.js';
import { escapeHtml, formatMoney, describeDeadline } from '../../lib/format.js';
import { goBack } from '../../router.js';

var SCOPE_LABEL = { enterprise: '企业', personal: '个人' };

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

export function mountProjectDetailPanel(container, route) {
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

    function render(project) {
        var pct = progressWidth(project.progress);
        var due = describeDeadline(project.deadline);
        var scope = SCOPE_LABEL[project.scope] || project.scope || '';
        root.innerHTML =
            '<section class="br-block">' +
            '<h1 class="br-name">' + escapeHtml(project.name || '未命名项目') + '</h1>' +
            row('状态', project.status) +
            row('客户', project.customer) +
            row('类型', project.type) +
            row('范围', scope) +
            row('优先级', project.priority) +
            row('金额', moneyText(project.amount)) +
            row('截止', project.deadline ? (project.deadline + (due.text ? ' · ' + due.text : '')) : '') +
            (pct || project.progress === 0
                ? '<div class="br-bar" aria-label="进度"><span style="width:' + pct + '%"></span></div><p class="br-meta">进度 ' + pct + '%</p>'
                : '') +
            (project.description ? '<p class="br-meta">' + escapeHtml(project.description) + '</p>' : '') +
            '</section>' +
            '<section class="br-block"><h2>交付</h2>' +
            row('编号', project.code) +
            row('本地', project.localPath) +
            row('网盘', project.cloudPath) +
            row('仓库', project.gitUrl && project.gitUrl !== project.cloudPath ? project.gitUrl : '') +
            (project.serverEnabled ? '<p class="br-meta">已记录服务器配置，明细在桌面端查看</p>' : '') +
            (project.notes ? '<p class="br-meta">' + escapeHtml(project.notes) + '</p>' : '') +
            (!project.localPath && !project.cloudPath && !(project.gitUrl && project.gitUrl !== project.cloudPath)
                ? '<p class="br-meta">还没有填写交付地址</p>' : '') +
            '</section>';
    }

    function load() {
        if (!id) {
            showState('项目不存在', 'back', '返回项目列表');
            return;
        }
        showState('加载中…');
        projects.detail(id).then(function (res) {
            if (!alive) return;
            if (!res || !res.data) {
                showState('项目不存在', 'back', '返回项目列表');
                return;
            }
            render(res.data);
        }).catch(function (err) {
            if (!alive) return;
            var missing = err && err.status === 404;
            showState(
                (err && err.message) || (missing ? '项目不存在' : '加载失败'),
                missing ? 'back' : 'retry',
                missing ? '返回项目列表' : '重试'
            );
        });
    }

    function onClick(e) {
        var act = e.target.closest && e.target.closest('[data-act]');
        if (!act || !root.contains(act)) return;
        var name = act.getAttribute('data-act');
        if (name === 'back') goBack('/projects');
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
