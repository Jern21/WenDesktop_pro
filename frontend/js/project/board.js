/**
 * 项目看板：摘要、卡片、右键菜单和改状态。
 * 菜单同时服务列表行，不单独再拆一层。
 */
(function (P) {
    'use strict';
    P.board = P.board || {};

    var KANBAN_COLUMNS = [
        { key: '待确认需求', dotClass: 'bg-gray-400', colClass: 'bg-gray-50', headerBorder: 'border-gray-100' },
        { key: '开发/设计中', dotClass: 'bg-green-500', colClass: 'bg-green-50/30', headerBorder: 'border-green-100/50' },
        { key: '待验收', dotClass: 'bg-orange-500', colClass: 'bg-orange-50/30', headerBorder: 'border-orange-100/50' },
        { key: '已完成', dotClass: 'bg-purple-500', colClass: 'bg-purple-50/30', headerBorder: 'border-purple-100/50' },
        { key: '已关闭', dotClass: 'bg-gray-400', colClass: 'bg-gray-50', headerBorder: 'border-gray-100' }
    ];
    var TYPE_TAG_STYLES = {
        '网站开发': 'bg-blue-50 text-blue-600 border-blue-100',
        '小程序': 'bg-cyan-50 text-cyan-600 border-cyan-100',
        'UI/设计': 'bg-purple-50 text-purple-600 border-purple-100',
        '平面设计': 'bg-orange-50 text-orange-600 border-orange-100',
        '视频剪辑': 'bg-gray-100 text-gray-600 border-gray-200',
        '内容创作': 'bg-green-50 text-green-600 border-green-100',
        '其他': 'bg-gray-100 text-gray-600 border-gray-200'
    };
    var PRIORITY_STYLES = {
        '高': { badge: 'text-red-600 bg-red-50 border-red-100', label: '高优先级' },
        '中': { badge: 'text-yellow-600 bg-yellow-50 border-yellow-100', label: '中优先级' },
        '低': { badge: 'text-gray-500 bg-gray-50 border-gray-200', label: '低优先级' }
    };
    var ctxMenu = null;
    var ALL_STATUSES = ['待确认需求', '开发/设计中', '待验收', '已完成', '已关闭'];
    var STATUS_COLORS = {
        '待确认需求': 'gray',
        '开发/设计中': 'green',
        '待验收': 'orange',
        '已完成': 'purple',
        '已关闭': 'gray'
    };

        P.board.loading = function(scope) {
            var kanban = document.getElementById(scope === 'personal' ? 'p-kanban-view' : 'kanban-view');
            if (!kanban) return;
            kanban.innerHTML = KANBAN_COLUMNS.map(function (col) {
                return '<div class="flex-shrink-0 w-72 ' + col.colClass + ' rounded-xl border border-gray-100 flex flex-col max-h-[calc(100vh-260px)]">' +
                    '<div class="p-4 border-b ' + col.headerBorder + ' flex items-center justify-between">' +
                    '<div class="flex items-center gap-2">' +
                    '<span class="w-2 h-2 rounded-full ' + col.dotClass + '"></span>' +
                    '<h3 class="font-semibold text-gray-700 text-sm">' + col.key + '</h3>' +
                    '</div>' +
                    '<span class="text-xs text-gray-400 bg-white px-2 py-0.5 rounded-full border border-gray-200">0</span>' +
                    '</div>' +
                    '<div class="flex-1 p-3">' +
                    '<div class="rounded-lg border border-dashed border-gray-200 bg-white/70 py-8 text-center text-xs text-gray-400">' +
                    '<i class="ph ph-spinner-gap animate-spin text-lg block mb-2"></i>加载项目中...' +
                    '</div>' +
                    '</div></div>';
            }).join('');
            kanban.style.visibility = 'visible';
            kanban.removeAttribute('data-project-static-demo');
        }

        P.board.clearDemo = function() {
            ['enterprise', 'personal'].forEach(function (scope) {
                var kanban = document.getElementById(scope === 'personal' ? 'p-kanban-view' : 'kanban-view');
                if (kanban && kanban.getAttribute('data-project-static-demo') === 'true') {
                    P.board.loading(scope);
                } else if (kanban) {
                    kanban.style.visibility = 'visible';
                }
            });

            [
                { id: 'ent-list-tbody', colspan: 9 },
                { id: 'per-list-tbody', colspan: 9 }
            ].forEach(function (cfg) {
                var tbody = document.getElementById(cfg.id);
                if (tbody && tbody.getAttribute('data-project-static-demo') === 'true') {
                    tbody.innerHTML = '<tr><td colspan="' + cfg.colspan + '" class="py-8 text-center text-gray-400 text-sm"><i class="ph ph-spinner-gap animate-spin mr-1"></i>加载项目中...</td></tr>';
                    tbody.removeAttribute('data-project-static-demo');
                }
            });

            ['list-view', 'p-list-view'].forEach(function (id) {
                var el = document.getElementById(id);
                if (el && el.getAttribute('data-project-static-demo') === 'true') {
                    el.style.visibility = 'visible';
                    el.removeAttribute('data-project-static-demo');
                } else if (el) {
                    el.style.visibility = 'visible';
                }
            });
        }

        P.board.summary = function(scope) {
            var containerId = scope === 'personal' ? 'per-summary' : 'ent-summary';
            var container = document.getElementById(containerId);
            if (!container) return;

            var items = P.state.cache.filter(function (p) { return p.scope === scope; });
            var today = new Date().toISOString().slice(0, 10);
            var total = items.length;
            var inProgress = items.filter(function (p) { return p.status === '开发/设计中'; }).length;
            var review = items.filter(function (p) { return p.status === '待验收'; }).length;
            var completed = items.filter(function (p) { return p.status === '已完成'; }).length;
            var overdue = items.filter(function (p) {
                return p.deadline && p.deadline < today && p.status !== '已完成' && p.status !== '已关闭';
            }).length;

            var cards = [
                { label: '全部项目', value: total, sub: '', icon: 'ph-fill ph-kanban', iconBg: 'bg-blue-50 text-blue-500' },
                { label: '进行中', value: inProgress, sub: total ? '占比 ' + Math.round(inProgress / total * 100) + '%' : '', icon: 'ph-fill ph-arrows-clockwise', iconBg: 'bg-green-50 text-green-500' },
                { label: '待验收', value: review, sub: total ? '占比 ' + Math.round(review / total * 100) + '%' : '', icon: 'ph-fill ph-hourglass-high', iconBg: 'bg-orange-50 text-orange-500' },
                { label: '已完成', value: completed, sub: total ? '占比 ' + Math.round(completed / total * 100) + '%' : '', icon: 'ph-fill ph-check-circle', iconBg: 'bg-purple-50 text-purple-500' }
            ];

            var html = cards.map(function (c) {
                return '<div class="rounded-xl border border-gray-100 bg-white p-4 shadow-soft relative overflow-hidden">' +
                    '<p class="text-gray-500 text-xs">' + c.label + '</p>' +
                    '<h3 class="text-2xl font-bold text-gray-800 mt-1 mb-0.5">' + c.value + '</h3>' +
                    '<p class="text-[10px] text-gray-400">' + c.sub + '</p>' +
                    '<div class="absolute right-3 top-3 w-9 h-9 rounded-lg ' + c.iconBg + ' flex items-center justify-center">' +
                    '<i class="' + c.icon + ' text-lg"></i></div></div>';
            }).join('');

            // 逾期卡片
            html += '<div class="rounded-xl border border-red-100 bg-red-50/30 p-4 shadow-soft relative overflow-hidden">' +
                '<p class="text-red-500 text-xs">已逾期</p>' +
                '<h3 class="text-2xl font-bold text-red-600 mt-1 mb-0.5">' + overdue + '</h3>' +
                '<p class="text-[10px] text-red-400">需及时处理</p>' +
                '<div class="absolute right-3 top-3 w-9 h-9 rounded-lg bg-red-100 text-red-500 flex items-center justify-center">' +
                '<i class="ph-fill ph-warning text-lg"></i></div></div>';

            container.innerHTML = html;
        }

        // ========== 渲染：看板视图 ==========
        P.board.kanban = function(scope) {
            var kanbanId = scope === 'personal' ? 'p-kanban-view' : 'kanban-view';
            var kanban = document.getElementById(kanbanId);
            if (!kanban) return;

            var items = P.state.cache.filter(function (p) { return p.scope === scope; });

            var html = KANBAN_COLUMNS.map(function (col) {
                var colItems = items.filter(function (p) { return p.status === col.key; });
                var cardsHtml = colItems.map(function (p) { return buildKanbanCard(p); }).join('');
                return '<div class="flex-shrink-0 w-72 ' + col.colClass + ' rounded-xl border border-gray-100 flex flex-col max-h-[calc(100vh-260px)]">' +
                    '<div class="p-4 border-b ' + col.headerBorder + ' flex items-center justify-between">' +
                    '<div class="flex items-center gap-2">' +
                    '<span class="w-2 h-2 rounded-full ' + col.dotClass + '"></span>' +
                    '<h3 class="font-semibold ' + (col.key === '已关闭' ? 'text-gray-500' : 'text-gray-700') + ' text-sm">' + col.key + '</h3>' +
                    '</div>' +
                    '<span class="text-xs text-gray-400 bg-white px-2 py-0.5 rounded-full border border-gray-200">' + colItems.length + '</span>' +
                    '</div>' +
                    '<div class="flex-1 overflow-y-auto p-3 space-y-3">' +
                    cardsHtml +
                    '<button class="w-full py-2.5 border border-dashed border-gray-300 text-gray-400 rounded-lg hover:text-brand-600 hover:border-brand-400 transition-colors text-xs flex items-center justify-center gap-1" onclick="window.openEditForm(null)">' +
                    '<i class="ph ph-plus"></i> 添加项目</button>' +
                    '</div></div>';
            }).join('');

            kanban.innerHTML = html;
        }

        function buildKanbanCard(p) {
            var priStyle = PRIORITY_STYLES[p.priority];
            var typeStyle = TYPE_TAG_STYLES[p.type] || TYPE_TAG_STYLES['其他'];
            var isCompleted = p.status === '已完成';
            var isClosed = p.status === '已关闭';
            var opacityClass = isCompleted ? ' opacity-90' : (isClosed ? ' opacity-70' : '');
            var titleColor = isClosed ? 'text-gray-600' : 'text-gray-800';

            // 优先级徽章
            var badgeHtml = '';
            if (isCompleted) {
                badgeHtml = '<span class="text-[10px] text-green-600 bg-green-50 border border-green-100 px-1.5 py-0.5 rounded font-medium flex items-center gap-0.5"><i class="ph ph-check"></i> 已交付</span>';
            } else if (isClosed) {
                badgeHtml = '<span class="text-[10px] text-gray-500 bg-gray-100 border border-gray-200 px-1.5 py-0.5 rounded font-medium">已关闭</span>';
            } else if (priStyle) {
                badgeHtml = '<span class="text-[10px] ' + priStyle.badge + ' border px-1.5 py-0.5 rounded font-medium">' + priStyle.label + '</span>';
            }

            // 副标题行
            var subtitle = '';
            if (p.status === '开发/设计中' || p.status === '待验收') {
                var parts = [];
                if (p.code) parts.push(p.code);
                if (p.amount) parts.push(P.money(p.amount));
                subtitle = parts.join(' · ');
            } else {
                subtitle = p.description || '';
            }

            // 进度条（仅开发中/待验收显示）
            var progressHtml = '';
            if ((p.status === '开发/设计中' || p.status === '待验收') && p.progress > 0) {
                var progColor = p.status === '待验收' ? 'bg-green-500' : 'bg-brand-500';
                progressHtml = '<div class="mb-3">' +
                    '<div class="flex justify-between text-[10px] text-gray-400 mb-1"><span>进度</span><span>' + p.progress + '%</span></div>' +
                    '<div class="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden"><div class="' + progColor + ' h-full rounded-full" style="width:' + p.progress + '%"></div></div>' +
                    '</div>';
            }

            // 日期/剩余天数
            var dateHtml = '';
            if (p.deadline && !isCompleted && !isClosed) {
                var days = P.days(p.deadline);
                if (days !== null) {
                    if (days < 0) {
                        dateHtml = '<span class="text-xs text-red-500 flex items-center gap-1"><i class="ph ph-warning"></i> 逾期' + Math.abs(days) + '天</span>';
                    } else if (days === 0) {
                        dateHtml = '<span class="text-xs text-orange-500 flex items-center gap-1"><i class="ph ph-clock"></i> 今天截止</span>';
                    } else {
                        dateHtml = '<span class="text-xs text-gray-400 flex items-center gap-1"><i class="ph ph-clock"></i> 剩余' + days + '天</span>';
                    }
                }
            } else if (isCompleted || isClosed) {
                dateHtml = '<span class="text-xs text-gray-400">' + P.date(p.deadline || '') + '</span>';
            } else {
                dateHtml = '<span class="text-xs text-gray-400 flex items-center gap-1"><i class="ph ph-calendar"></i> ' + P.date(p.deadline) + '</span>';
            }

            // 标签
            var tagsHtml = '<span class="tag ' + typeStyle + '">' + P.escape(p.type) + '</span>';
            if (p.tags) {
                var tags = p.tags.split(/[,，]/).filter(function (t) { return t.trim(); });
                for (var i = 0; i < tags.length; i++) {
                    tagsHtml += '<span class="tag bg-yellow-50 text-yellow-600 border border-yellow-100">' + P.escape(tags[i].trim()) + '</span>';
                }
            }

            var avatarClass = isClosed ? 'grayscale' : '';

            return '<div class="bg-white rounded-lg border border-gray-100 p-4 shadow-sm cursor-pointer hover:shadow-md transition-shadow group' + opacityClass + '" data-project-id="' + P.escape(p.id || '') + '">' +
                '<div class="flex items-start justify-between mb-2">' + badgeHtml +
                '<button class="text-gray-300 hover:text-gray-600 opacity-0 group-hover:opacity-100 transition-opacity"><i class="ph ph-dots-three-vertical"></i></button>' +
                '</div>' +
                '<h4 class="font-medium ' + titleColor + ' text-sm mb-1">' + P.escape(p.name) + '</h4>' +
                (subtitle ? '<p class="text-xs text-gray-500 mb-2 ' + (p.status === '开发/设计中' || p.status === '待验收' ? '' : 'line-clamp-2') + '">' + P.escape(subtitle) + '</p>' : '') +
                progressHtml +
                '<div class="flex items-center gap-2 mb-3">' + tagsHtml + '</div>' +
                '<div class="flex items-center justify-between">' +
                '<div class="flex items-center gap-1.5">' +
                '<img src="' + P.avatar(p.customer) + '" class="w-6 h-6 rounded-full ' + avatarClass + '">' +
                '<span class="text-xs ' + (isClosed ? 'text-gray-400' : 'text-gray-600') + '">' + P.escape(p.customer) + '</span>' +
                '</div>' + dateHtml + '</div></div>';
        }

        var ctxMenu = null;

        function hideContextMenu() {
            if (ctxMenu) {
                ctxMenu.remove();
                ctxMenu = null;
            }
        }

        // 所有状态列表（顺序即看板列顺序）
        var ALL_STATUSES = ['待确认需求', '开发/设计中', '待验收', '已完成', '已关闭'];
        var STATUS_COLORS = {
            '待确认需求': 'gray',
            '开发/设计中': 'green',
            '待验收': 'orange',
            '已完成': 'purple',
            '已关闭': 'gray'
        };

        function showContextMenu(x, y, projectId) {
            hideContextMenu();
            var data = P.get(projectId);
            var hasLocal = !!data.localPath;
            var hasCloud = data.cloudEnabled && !!data.cloudPath;
            var currentStatus = data.status || '待确认需求';

            // 构建「移动至」子项（排除当前状态）
            var moveItems = [];
            for (var i = 0; i < ALL_STATUSES.length; i++) {
                var st = ALL_STATUSES[i];
                if (st === currentStatus) continue;
                moveItems.push('<div class="proj-ctx-item" data-action="move" data-status="' + st + '"><span class="w-1.5 h-1.5 rounded-full bg-' + STATUS_COLORS[st] + '-400"></span> 移动至 ' + st + '</div>');
            }

            ctxMenu = document.createElement('div');
            ctxMenu.className = 'proj-ctx-menu';
            ctxMenu.innerHTML = [
'<div class="proj-ctx-header"><i class="ph ph-folder-simple-user"></i> ' + P.escape(data.name || '') + '</div>',
'<div class="proj-ctx-item" data-action="view-detail"><i class="ph ph-eye text-brand-600"></i> 查看详情</div>',
'<div class="proj-ctx-item" data-action="edit"><i class="ph ph-pencil-simple text-gray-500"></i> 编辑项目</div>',
                '<div class="proj-ctx-sep"></div>',
                '<div class="proj-ctx-item' + (hasLocal ? '' : ' disabled') + '" data-action="copy-local"><i class="ph ph-hard-drive text-gray-500"></i> 复制本地地址</div>',
                '<div class="proj-ctx-item' + (hasCloud ? '' : ' disabled') + '" data-action="copy-cloud"><i class="ph ph-cloud text-sky-500"></i> 复制云端地址</div>',
                '<div class="proj-ctx-item' + ((hasLocal || hasCloud) ? '' : ' disabled') + '" data-action="copy-all"><i class="ph ph-copy text-gray-500"></i> 复制项目地址</div>',
                '<div class="proj-ctx-sep"></div>',
                '<div class="proj-ctx-item' + (hasLocal ? '' : ' disabled') + '" data-action="open-folder"><i class="ph ph-folder-open text-gray-500"></i> 在文件夹中打开</div>',
                '<div class="proj-ctx-item' + (hasCloud ? '' : ' disabled') + '" data-action="open-cloud"><i class="ph ph-arrow-square-out text-gray-500"></i> 打开云端链接</div>',
                '<div class="proj-ctx-sep"></div>',
                '<div class="proj-ctx-item proj-ctx-sub-wrap"><i class="ph ph-arrows-left-right text-gray-500"></i> 更多操作 <i class="ph ph-caret-right proj-ctx-sub-arrow"></i>',
                '  <div class="proj-ctx-submenu">',
                '    <div class="proj-ctx-label"><i class="ph ph-swap text-gray-400"></i> 移动状态</div>',
                moveItems.join(''),
                '  </div>',
                '</div>'
            ].join('');
            document.body.appendChild(ctxMenu);

            // 先测量尺寸并定位，再触发显示动画（避免位置变化被过渡）
            // 注意：不能用 inline opacity:0，否则会覆盖 .show 类的 opacity:1
            ctxMenu.style.left = '0px';
            ctxMenu.style.top = '0px';
            ctxMenu.style.visibility = 'hidden';
            var rect = ctxMenu.getBoundingClientRect();
            var finalX = Math.min(x, window.innerWidth - rect.width - 8);
            var finalY = Math.min(y, window.innerHeight - rect.height - 8);
            ctxMenu.style.left = finalX + 'px';
            ctxMenu.style.top = finalY + 'px';
            ctxMenu.style.visibility = '';

            // 检测右侧空间是否足够放二级菜单（约 190px），不够则翻转到左侧
            if (finalX + rect.width + 190 > window.innerWidth) {
                ctxMenu.classList.add('flip-left');
            }

            // 检测底部空间：二级菜单从「更多操作」项位置开始向下展开，
            // 如果会超出视口底部，则让二级菜单向上展开（bottom 对齐父项）
            var moreItem = ctxMenu.querySelector('.proj-ctx-sub-wrap');
            var submenu = ctxMenu.querySelector('.proj-ctx-submenu');
            if (moreItem && submenu) {
                var moreRect = moreItem.getBoundingClientRect();
                var subHeight = 230; // 二级菜单预估高度
                if (moreRect.top + subHeight > window.innerHeight - 8) {
                    submenu.classList.add('flip-up');
                    submenu.style.top = 'auto';
                    submenu.style.bottom = '-0.3rem';
                }
            }

            requestAnimationFrame(function () {
                ctxMenu.classList.add('show');
            });

            // 绑定菜单项点击（排除二级菜单的父项，避免点击父项就关闭）
            var items = ctxMenu.querySelectorAll('.proj-ctx-item');
            for (var i = 0; i < items.length; i++) {
                (function (item) {
                    // 跳过「更多操作」父项本身（它是二级菜单的触发器，不应关闭主菜单）
                    if (item.classList.contains('proj-ctx-sub-wrap')) return;
                    item.addEventListener('click', function (e) {
                        e.stopPropagation();
                        if (item.classList.contains('disabled')) return;
                        var action = item.dataset.action;
                        handleCtxAction(action, projectId, data, item);
                        hideContextMenu();
                    });
                })(items[i]);
            }
        }

        function handleCtxAction(action, projectId, data, item) {
            switch (action) {
case 'view-detail':
P.detail.show(projectId);
break;
case 'edit':
P.form.open(projectId);
break;
                case 'copy-local':
                    if (data.localPath) {
                        P.copy(data.localPath);
                        P.toast('本地地址已复制到剪贴板', 'ph-fill ph-check-circle', '#4ade80');
                    }
                    break;
                case 'copy-cloud':
                    if (data.cloudPath) {
                        P.copy(data.cloudPath);
                        P.toast('云端地址已复制到剪贴板', 'ph-fill ph-check-circle', '#4ade80');
                    }
                    break;
                case 'copy-all':
                    var addr = '';
                    if (data.localPath) addr += '本地：' + data.localPath;
                    if (data.cloudEnabled && data.cloudPath) {
                        if (addr) addr += '\n';
                        addr += '云端：' + data.cloudPath;
                    }
                    if (addr) {
                        P.copy(addr);
                        P.toast('项目地址已复制到剪贴板', 'ph-fill ph-check-circle', '#4ade80');
                    }
                    break;
                case 'open-folder':
                    P.toast('正在打开文件夹：' + data.localPath, 'ph ph-folder-open', '#60a5fa');
                    break;
                case 'open-cloud':
                    if (data.cloudPath) {
                        window.open(data.cloudPath, '_blank');
                    }
                    break;
                case 'move':
                    var newStatus = item ? item.dataset.status : '';
                    if (newStatus) {
                        P.board.moveStatus(projectId, newStatus);
                    }
                    break;
            }
        }

        P.board.moveStatus = function(projectId, newStatus) {
            if (!projectId || !newStatus) return;
            var data = P.get(projectId);
            var oldStatus = data.status || '待确认需求';
            if (oldStatus === newStatus) return;

            data.status = newStatus;
            if (P.state.byId[projectId]) P.state.byId[projectId].status = newStatus;

            // 2. 重新渲染看板和列表
            P.renderAll();

            // 3. 同步到后端 API
            if (data.id) {
                P.api.moveStatus(data.id, newStatus).then(function (res) {
                    if (!res.success) {
                        console.error('[Project] 移动状态失败:', res.error);
                        P.toast('移动状态失败，正在恢复...', 'ph ph-warning', '#fbbf24');
                        data.status = oldStatus;
                        if (P.state.byId[projectId]) P.state.byId[projectId].status = oldStatus;
                        P.renderAll();
                    }
                }).catch(function (err) {
                    console.error('[Project] 移动状态失败:', err);
                });
            }

            P.toast('已移动至「' + newStatus + '」', 'ph-fill ph-arrows-left-right', '#60a5fa');
        }

    function getProjectIdFromCard(card) {
    return (card && card.getAttribute('data-project-id')) || '';
}
function getProjectIdFromRow(row) {
    return (row && row.getAttribute('data-project-id')) || '';
}
P.board.bindMenu = function () {
            // 看板卡片左键
            var kanbanContainers = document.querySelectorAll('#kanban-view, #p-kanban-view');
            for (var i = 0; i < kanbanContainers.length; i++) {
                (function (container) {
                    if (container.dataset.ctxBound) return;
                    container.dataset.ctxBound = 'true';
                    // 捕获阶段拦截，阻止全局 click 立刻关闭菜单
                    container.addEventListener('click', function (e) {
                        var card = e.target.closest('div.group');
                        if (!card) return;
                        if (card.tagName === 'BUTTON') return;
                        // 如果点到的是卡片内的按钮（如三点按钮），不弹菜单
                        if (e.target.closest('button')) return;
                        e.preventDefault();
                        e.stopImmediatePropagation();
                        var name = getProjectIdFromCard(card);
                        if (!name) return;
                        showContextMenu(e.clientX, e.clientY, name);
                    }, true);
                })(kanbanContainers[i]);
            }

            // 列表行左键
            var listTables = document.querySelectorAll('#list-view table tbody, #p-list-view table tbody');
            for (var j = 0; j < listTables.length; j++) {
                (function (tbody) {
                    if (tbody.dataset.ctxBound) return;
                    tbody.dataset.ctxBound = 'true';
                    tbody.addEventListener('click', function (e) {
                        var row = e.target.closest('tr');
                        if (!row) return;
                        // 如果点到的是行内按钮（如三点按钮），不弹菜单
                        if (e.target.closest('button')) return;
                        e.preventDefault();
                        e.stopImmediatePropagation();
                        var name = getProjectIdFromRow(row);
                        if (!name) return;
                        showContextMenu(e.clientX, e.clientY, name);
                    }, true);
                })(listTables[j]);
            }

            // 全局点击关闭菜单（捕获阶段，确保在卡片 click 之前执行判断）
            if (!document._projCtxBound) {
                document._projCtxBound = true;
                document.addEventListener('click', function () { hideContextMenu(); });
            }
    };
})(window.ProjectPage);
