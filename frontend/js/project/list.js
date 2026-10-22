/**
 * 项目列表。行上的 data-project-id 交给看板侧的菜单。
 */
(function (P) {
    'use strict';
    P.list = P.list || {};
    var TYPE_TAG_STYLES = {
        '网站开发': 'bg-blue-50 text-blue-600 border-blue-100',
        '小程序': 'bg-cyan-50 text-cyan-600 border-cyan-100',
        'UI/设计': 'bg-purple-50 text-purple-600 border-purple-100',
        '平面设计': 'bg-orange-50 text-orange-600 border-orange-100',
        '视频剪辑': 'bg-gray-100 text-gray-600 border-gray-200',
        '内容创作': 'bg-green-50 text-green-600 border-green-100',
        '其他': 'bg-gray-100 text-gray-600 border-gray-200'
    };
    var STATUS_BADGE_STYLES = {
        '待确认需求': 'text-gray-600 bg-gray-50 border-gray-200',
        '开发/设计中': 'text-green-600 bg-green-50 border-green-100',
        '待验收': 'text-orange-600 bg-orange-50 border-orange-100',
        '已完成': 'text-purple-600 bg-purple-50 border-purple-100',
        '已关闭': 'text-gray-500 bg-gray-100 border-gray-200'
    };
    var STATUS_DOT_STYLES = {
        '待确认需求': 'bg-gray-400',
        '开发/设计中': 'bg-green-500',
        '待验收': 'bg-orange-500',
        '已完成': 'bg-purple-500',
        '已关闭': 'bg-gray-400'
    };
    var PROGRESS_BAR_STYLES = {
        '待确认需求': 'bg-gray-300',
        '开发/设计中': 'bg-brand-500',
        '待验收': 'bg-green-500',
        '已完成': 'bg-green-500',
        '已关闭': 'bg-gray-300'
    };
        P.list.render = function(scope) {
            var tbodyId = scope === 'personal' ? 'per-list-tbody' : 'ent-list-tbody';
            var tbody = document.getElementById(tbodyId);
            if (!tbody) return;

            var items = P.state.cache.filter(function (p) { return p.scope === scope; });
            if (items.length === 0) {
                tbody.innerHTML = '<tr><td colspan="9" class="py-8 text-center text-gray-400 text-sm">暂无项目数据</td></tr>';
                return;
            }

            tbody.innerHTML = items.map(function (p) { return buildListRow(p, scope); }).join('');
        }

        function buildListRow(p, scope) {
            var dotClass = STATUS_DOT_STYLES[p.status] || 'bg-gray-400';
            var statusBadge = STATUS_BADGE_STYLES[p.status] || STATUS_BADGE_STYLES['待确认需求'];
            var typeStyle = TYPE_TAG_STYLES[p.type] || TYPE_TAG_STYLES['其他'];
            var progBarClass = PROGRESS_BAR_STYLES[p.status] || 'bg-gray-300';

            // 优先级
            var priHtml = '';
            if (p.priority === '高') priHtml = '<span class="text-[10px] text-red-600 bg-red-50 border border-red-100 px-1.5 py-0.5 rounded font-medium">高</span>';
            else if (p.priority === '中') priHtml = '<span class="text-[10px] text-yellow-600 bg-yellow-50 border border-yellow-100 px-1.5 py-0.5 rounded font-medium">中</span>';
            else if (p.priority === '低') priHtml = '<span class="text-[10px] text-gray-500 bg-gray-50 border border-gray-200 px-1.5 py-0.5 rounded font-medium">低</span>';
            else priHtml = '<span class="text-[10px] text-gray-400">—</span>';

            var scopeLabel = scope === 'personal' ? '个人' : P.escape(p.customer || '—');

            return '<tr class="border-b border-gray-50 hover:bg-gray-50/80 transition-colors cursor-pointer" data-project-id="' + P.escape(p.id || '') + '">' +
                '<td class="py-3 px-4"><div class="flex items-center gap-2"><span class="w-2 h-2 rounded-full ' + dotClass + ' flex-shrink-0"></span>' +
                '<span class="font-medium text-gray-800 truncate">' + P.escape(p.name) + '</span></div>' +
                (p.code ? '<p class="text-xs text-gray-400 mt-0.5 truncate">' + P.escape(p.code) + '</p>' : '') +
                '</td>' +
                '<td class="py-3 px-2"><span class="text-xs ' + statusBadge + ' border px-1.5 py-0.5 rounded">' + p.status + '</span></td>' +
                '<td class="py-3 px-2">' + priHtml + '</td>' +
                '<td class="py-3 px-2"><span class="tag ' + typeStyle + '">' + P.escape(p.type) + '</span></td>' +
                '<td class="py-3 px-2"><span class="text-xs text-gray-500">' + scopeLabel + '</span></td>' +
                '<td class="py-3 px-2 text-xs text-gray-500">' + (p.amount ? P.money(p.amount) : '—') + '</td>' +
                '<td class="py-3 px-2"><div class="flex items-center gap-2"><div class="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden max-w-[80px]"><div class="' + progBarClass + ' h-full rounded-full" style="width:' + (p.progress || 0) + '%"></div></div><span class="text-[10px] text-gray-400">' + (p.progress || 0) + '%</span></div></td>' +
                '<td class="py-3 px-2 text-xs text-gray-500">' + P.date(p.deadline) + '</td>' +
                '<td class="py-3 px-2 text-center"><button class="w-7 h-7 rounded border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-100 hover:text-gray-800 transition mx-auto"><i class="ph ph-dots-three"></i></button></td>' +
                '</tr>';
        }
})(window.ProjectPage);
