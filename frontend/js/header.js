(function () {
    'use strict';

    // ========== 平台 SVG 图标路径映射 ==========
    var bellPositionBound = false;
    var PLATFORM_ICONS = {
        xianyu: { file: '闲鱼.svg', name: '闲鱼' },
        xiaohongshu: { file: '小红书.svg', name: '小红书' },
        douyin: { file: '抖音.svg', name: '抖音' }
    };

    function getIconUrl(file) {
        var base = window.ROOT_URL || window.PAGE_BASE || '';
        return base + 'assets/svg/' + file;
    }

    function escapeXml(value) {
        return String(value || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&apos;');
    }

    function getDefaultUserProfile() {
        return {
            nickname: '',
            role: '',
            avatar: ''
        };
    }

    function normalizeUserProfile(profile) {
        return Object.assign(getDefaultUserProfile(), profile || {});
    }

    function makeProfileAvatar(name) {
        var label = String(name || '用').trim().charAt(0) || '用';
        var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96">' +
            '<rect width="96" height="96" rx="48" fill="#2563eb"/>' +
            '<text x="50%" y="50%" dy=".08em" text-anchor="middle" dominant-baseline="middle" ' +
            'font-family="Inter, system-ui, sans-serif" font-size="36" font-weight="700" fill="#fff">' +
            escapeXml(label) + '</text></svg>';
        return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
    }

    function applyUserProfileToHeader(profile) {
        var normalized = normalizeUserProfile(profile);
        window.__userProfile = normalized;
        var name = normalized.nickname || normalized.username || '用户';
        var avatar = normalized.avatar || makeProfileAvatar(name);
        var avatarEl = document.getElementById('header-user-avatar');
        var nameEl = document.getElementById('header-user-name');
        if (avatarEl) avatarEl.src = avatar;
        if (nameEl) nameEl.textContent = name;
    }

    function loadHeaderProfile() {
        var apiRoot = (window.ROOT_URL || window.PAGE_BASE || '') + 'api';
        Promise.all([
            fetch(apiRoot + '/auth/status', { credentials: 'same-origin' }).then(function (res) { return res.json(); }),
            fetch(apiRoot + '/settings', { credentials: 'same-origin' }).then(function (res) { return res.json(); })
        ])
            .then(function (pair) {
                var statusRes = pair[0];
                var settingsRes = pair[1];
                var sessionUser = statusRes.success && statusRes.data ? statusRes.data.user : null;
                var profile = settingsRes.success && settingsRes.data ? settingsRes.data.profile : null;
                var merged = Object.assign(getDefaultUserProfile(), profile || {});
                if (sessionUser) {
                    merged.username = sessionUser.username;
                    if (!merged.nickname) merged.nickname = sessionUser.displayName || sessionUser.username;
                    if (!merged.role) merged.role = sessionUser.isTrial ? '试用账号' : '';
                }
                applyUserProfileToHeader(merged);
            })
            .catch(function () {
                applyUserProfileToHeader(window.__userProfile || getDefaultUserProfile());
            });
    }

    // ========== 统一页面配置 ==========
    // 所有页面共用同一套模板，通过可选字段控制内容显示：
    //   icon:     'platform:xianyu' → 渲染对应平台 SVG 图标（仅平台页面）
    //   search:   搜索框 placeholder（不设则不显示搜索框）
    //   controls: 时间筛选等切换按钮组
    //   secondaryAction: 次要按钮（如"从模板创建"）
    //   action:   主功能按钮（如"新建订单"），固定在铃铛左侧
    var HEADER_CONFIG = {
        'index.html': {
            title: '欢迎回来，JERN 👋',
            subtitle: function() {
                var now = new Date();
                var weekdays = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
                var year = now.getFullYear();
                var month = now.getMonth() + 1;
                var date = now.getDate();
                var weekday = weekdays[now.getDay()];
                return '今天是 ' + year + '年' + month + '月' + date + '日 ' + weekday;
            },
            search: '搜索订单、客户、海报等...',
            action: { label: '新建订单', icon: 'ph ph-plus' },
            titleClass: 'text-2xl'
        },
        'orders.html': {
            title: '我的订单',
            subtitle: '管理我的订单',
            search: '搜索订单号、客户、项目名称...',
            action: { label: '新建接单', icon: 'ph ph-plus' }
        },
        'quote.html': {
            title: '生成报价单',
            subtitle: '规范化开发报价，支持一键生成文本或导出PDF',
            action: { label: '保存为模板', icon: 'ph ph-floppy-disk', variant: 'secondary', onclick: 'saveQuoteAsTemplate()' }
        },
        'customer.html': {
            title: '客户管理',
            subtitle: '管理我的客户',
            search: '搜索客户名称、联系方式、标签...',
            action: { label: '新增客户', icon: 'ph ph-plus', onclick: 'openCustomerForm(null,null)' }
        },
        'platform.html': {
            title: '总览看板',
            subtitle: '统一管理各平台发布内容，支持编辑、发布、数据追踪与效果分析',
            search: '搜索文案、内容、话题...'
        },
        'xianyu.html': {
            icon: 'platform:xianyu',
            title: '闲鱼运营',
            subtitle: '管理闲鱼发帖记录、数据追踪与转化分析',
            search: '搜索帖子标题、标签...',
            action: { label: '记录发帖', icon: 'ph ph-plus', onclick: 'PlatformManager.openForm()' }
        },
        'xiaohongshu.html': {
            icon: 'platform:xiaohongshu',
            title: '小红书运营',
            subtitle: '管理小红书发帖记录、数据追踪与转化分析',
            search: '搜索笔记标题、标签...',
            action: { label: '记录发帖', icon: 'ph ph-plus', onclick: 'PlatformManager.openForm()' }
        },
        'douyin.html': {
            icon: 'platform:douyin',
            title: '抖音运营',
            subtitle: '管理抖音视频发布、数据追踪与转化分析',
            search: '搜索视频标题、标签...',
            action: { label: '记录发布', icon: 'ph ph-plus', onclick: 'PlatformManager.openForm()' }
        },
        'posters.html': {
            title: '宣传海报库',
            subtitle: '管理各平台引流素材，提升获客转化',
            search: '搜索海报名称、标签...',
            secondaryAction: { label: '从模板创建', icon: 'ph ph-copy', variant: 'secondary' },
            action: { label: '上传海报', icon: 'ph ph-upload-simple' }
        },
        'canvas.html': {
            title: '无限画布',
            subtitle: '创意节点、分支衍生与提示词沉淀'
        },
        'stats.html': {
            title: '数据统计',
            subtitle: '多维度数据分析，辅助业务决策',
            controls: [
                { label: '全量汇总', range: 'all' },
                { label: '本年', range: 'year' },
                { label: '本月', range: 'month' }
            ],
            action: { label: '导出报表', icon: 'ph ph-export', variant: 'secondary' }
        },
        'project.html': {
            title: '项目管理',
            subtitle: function() { return window.__projectSubtitle || '加载中...'; },
            search: '搜索项目名称、客户...',
            action: { label: '新建项目', icon: 'ph ph-plus', onclick: 'openEditForm(null)' }
        },
        'accounts.html': {
            title: '账号管理',
            subtitle: '管理各开发平台的账号信息',
            search: '搜索平台、账号...',
            action: { label: '添加账号', icon: 'ph ph-plus', onclick: 'openAccountForm()' }
        },
        'bookmarks.html': {
            title: '网址收藏',
            subtitle: '收藏整理常用的开发网站和资源',
            search: '搜索网站名称、标签...',
            action: { label: '添加收藏', icon: 'ph ph-plus', onclick: 'openBookmarkForm()' }
        },
        'resume.html': {
            title: '简历管理',
            subtitle: '管理简历版本，持续优化求职竞争力',
            search: '搜索版本、内容...',
            action: { label: '新增简历', icon: 'ph ph-plus', onclick: 'createNewJob()' }
        },
        'memo.html': {
            title: '信息备忘录',
            subtitle: '记录重要信息，快速检索与回顾',
            search: '搜索备忘录内容...',
            action: { label: '新建备忘', icon: 'ph ph-plus' }
        },
        'settings.html': {
            title: '设置中心',
            subtitle: '管理账号、数据备份与系统配置'
        }
    };

    // ========== 工具函数 ==========

    function getCurrentPageName() {
        return window.location.pathname.split('/').pop() || 'index.html';
    }

    function getHeaderConfig(pageName) {
        return HEADER_CONFIG[pageName] || HEADER_CONFIG['index.html'];
    }

    function escapeHtml(value) {
        return String(value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    // ========== 渲染：左侧标题区 ==========

    function renderIcon(config) {
        if (!config.icon) return '';
        // 格式: 'platform:xianyu'
        if (config.icon.indexOf('platform:') === 0) {
            var key = config.icon.split(':')[1];
            var info = PLATFORM_ICONS[key];
            if (!info) return '';
            var scale = key === 'xiaohongshu' ? ' style="object-fit:cover;transform:scale(1.2)"' : '';
            return '<div class="w-10 h-10 rounded-xl overflow-hidden flex-shrink-0">' +
                '<img src="' + getIconUrl(info.file) + '" alt="' + escapeHtml(info.name) +
                '" class="block w-full h-full" loading="lazy"' + scale + '></div>';
        }
        return '';
    }

    function renderLeft(config) {
        var iconHtml = renderIcon(config);
        var titleClass = config.titleClass || 'text-xl';
        // 支持函数类型的 subtitle
        var subtitleText = typeof config.subtitle === 'function' ? config.subtitle() : config.subtitle;
        return [
            '<div class="flex items-center gap-3">',
            iconHtml,
            '    <div>',
            '        <h2 class="' + titleClass + ' font-bold text-gray-800">' + escapeHtml(config.title) + '</h2>',
            subtitleText ? '        <p class="text-sm text-gray-500 mt-0.5">' + escapeHtml(subtitleText) + '</p>' : '',
            '    </div>',
            '</div>'
        ].join('');
    }

    // ========== 渲染：右侧功能区各组件 ==========

    function renderSearch(search) {
        if (!search) return '';
        return [
            '<div class="relative">',
            '    <i class="ph ph-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"></i>',
            '    <input type="text" placeholder="' + escapeHtml(search) + '" class="pl-9 pr-12 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm w-[280px] focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all">',
            '    <div class="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1 text-[10px] text-gray-400 bg-white px-1.5 py-0.5 rounded border border-gray-200">',
            '        <i class="ph ph-command"></i> K',
            '    </div>',
            '</div>'
        ].join('');
    }

    function renderControls(controls) {
        if (!controls || !controls.length) return '';
        return [
            '<div class="flex items-center gap-1 bg-gray-50 p-1 rounded-lg">',
            controls.map(function (control) {
                var isStatsRange = !!control.range;
                var active = isStatsRange
                    ? ((window.statsRange || 'all') === control.range)
                    : !!control.active;
                var className = active
                    ? 'px-3 py-1.5 bg-white shadow-sm rounded-md text-brand-600 text-xs font-medium transition-colors'
                    : 'px-3 py-1.5 text-gray-500 hover:text-gray-800 rounded-md text-xs font-medium transition-colors';
                var icon = control.icon ? '<i class="' + escapeHtml(control.icon) + '"></i> ' : '';
                var attrs = isStatsRange
                    ? ' type="button" class="stats-range-btn ' + className + (control.icon ? ' flex items-center gap-1' : '') + '" data-range="' + escapeHtml(control.range) + '"'
                    : ' type="button" class="' + className + (control.icon ? ' flex items-center gap-1' : '') + '"';
                return '<button' + attrs + '>' + icon + escapeHtml(control.label) + '</button>';
            }).join(''),
            '</div>'
        ].join('');
    }

    function syncStatsRangeButtons(root) {
        var scope = root || document;
        var range = window.statsRange || 'all';
        scope.querySelectorAll('.stats-range-btn').forEach(function (btn) {
            var active = btn.getAttribute('data-range') === range;
            btn.className = active
                ? 'stats-range-btn px-3 py-1.5 bg-white shadow-sm rounded-md text-brand-600 text-xs font-medium transition-colors'
                : 'stats-range-btn px-3 py-1.5 text-gray-500 hover:text-gray-800 rounded-md text-xs font-medium transition-colors';
        });
    }

    function bindStatsRangeButtons(root) {
        var scope = root || document;
        scope.querySelectorAll('.stats-range-btn').forEach(function (btn) {
            if (btn.dataset.bound === 'true') return;
            btn.dataset.bound = 'true';
            btn.addEventListener('click', function () {
                var range = btn.getAttribute('data-range') || 'all';
                if (range === (window.statsRange || 'all')) return;
                window.statsRange = range;
                syncStatsRangeButtons(document);
                window.dispatchEvent(new CustomEvent('stats:range-change', {
                    detail: { range: range }
                }));
            });
        });
    }

    function renderButton(action, defaultVariant) {
        if (!action) return '';
        var variant = action.variant || defaultVariant || 'primary';
        var icon = action.icon ? '<i class="' + escapeHtml(action.icon) + '"></i>' : '';
        var buttonClass = variant === 'secondary'
            ? 'px-4 py-2 border border-gray-200 text-gray-700 bg-white rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium flex items-center gap-2'
            : 'bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors shadow-sm shadow-brand-500/30';
        var onclickAttr = action.onclick ? ' onclick="' + escapeHtml(action.onclick) + '"' : '';
        return '<button class="' + buttonClass + '"' + onclickAttr + '>' + icon + escapeHtml(action.label) + '</button>';
    }

    // ========== 通知铃铛：动态渲染 ==========

    // 通知颜色 → Tailwind class 映射
    var BELL_COLOR_MAP = {
        red:     { bg: 'bg-red-50',     text: 'text-red-500'     },
        amber:   { bg: 'bg-amber-50',   text: 'text-amber-500'   },
        blue:    { bg: 'bg-blue-50',    text: 'text-blue-500'    },
        indigo:  { bg: 'bg-indigo-50',  text: 'text-indigo-500'  },
        emerald: { bg: 'bg-emerald-50', text: 'text-emerald-500' }
    };

    function renderChangelogButton() {
        return [
            '<button type="button" aria-label="更新日志" id="changelog-button" title="更新日志" class="relative w-10 h-10 flex items-center justify-center rounded-full border border-gray-200 text-gray-600 hover:bg-gray-50 hover:text-gray-800 transition-colors">',
            '    <i class="ph ph-scroll text-lg"></i>',
            '    <span id="changelog-badge" class="absolute top-1 right-1 w-2 h-2 bg-brand-500 rounded-full border border-white" style="display:none" aria-hidden="true"></span>',
            '</button>'
        ].join('');
    }

    function bindChangelogButton() {
        var btn = document.getElementById('changelog-button');
        if (!btn || btn.dataset.bound === 'true') return;
        btn.dataset.bound = 'true';
        btn.addEventListener('click', function () {
            if (window.AppChangelog && typeof window.AppChangelog.open === 'function') {
                window.AppChangelog.open();
            }
        });
        if (window.AppChangelog && typeof window.AppChangelog.syncBadge === 'function') {
            window.AppChangelog.syncBadge();
        }
    }

    function renderBell() {
        return [
            '<div class="relative" id="bell-container">',
            '    <button aria-label="通知" id="bell-button" class="relative w-10 h-10 flex items-center justify-center rounded-full border border-gray-200 text-gray-600 hover:bg-gray-50 hover:text-gray-800 transition-colors">',
            '        <i class="ph ph-bell text-lg"></i>',
            '        <span id="bell-badge" class="absolute top-0 -right-1 w-4 h-4 bg-red-500 text-white text-[10px] font-bold flex items-center justify-center rounded-full border-2 border-white" style="display:none">0</span>',
            '    </button>',
            '</div>'
        ].join('');
    }

    /** 浮窗 HTML 模板（会被移到 body 末尾，脱离 header 层叠上下文） */
    function getBellDropdownHTML() {
        return [
            '<div class="relative bg-white border border-gray-100 rounded-2xl shadow-xl shadow-gray-200/70 overflow-hidden">',
            '    <div class="absolute -top-1.5 right-6 w-3 h-3 bg-white border-l border-t border-gray-100 rotate-45"></div>',
            '    <div class="px-4 py-3 border-b border-gray-100 flex items-center justify-between">',
            '        <div>',
            '            <p class="text-sm font-bold text-gray-800">通知中心</p>',
            '            <p id="bell-subtitle" class="text-[11px] text-gray-400 mt-0.5">加载中...</p>',
            '        </div>',
            '        <span id="bell-new-tag" class="px-2 py-0.5 rounded-full bg-red-50 text-red-500 text-[10px] font-semibold" style="display:none">NEW</span>',
            '    </div>',
            '    <div id="bell-items" class="p-2 space-y-1">',
            '        <div class="flex items-center justify-center py-8 text-gray-400 text-sm"><i class="ph ph-spinner animate-spin mr-2"></i>加载中...</div>',
            '    </div>',
            '    <button id="bell-view-all" class="w-full py-2.5 border-t border-gray-100 text-xs font-medium text-brand-600 hover:bg-brand-50 transition-colors">查看全部通知</button>',
            '</div>'
        ].join('');
    }

    /** 将浮窗移到 body 末尾，脱离 header 的层叠上下文 */
    function ensureBellDropdownOnBody() {
        var dropdown = document.getElementById('bell-dropdown');
        if (dropdown && dropdown.parentElement === document.body) return dropdown;
        if (!dropdown) {
            dropdown = document.createElement('div');
            dropdown.id = 'bell-dropdown';
            dropdown.className = 'fixed w-80 opacity-0 invisible translate-y-2 scale-[0.98] transition-all duration-200 ease-out pointer-events-none z-[9999]';
            dropdown.innerHTML = getBellDropdownHTML();
        } else {
            // 已存在但在 header 内部，移出来
            dropdown.className = 'fixed w-80 opacity-0 invisible translate-y-2 scale-[0.98] transition-all duration-200 ease-out pointer-events-none z-[9999]';
        }
        document.body.appendChild(dropdown);
        return dropdown;
    }

    /** 显示浮窗 */
    function showBellDropdown() {
        var dropdown = ensureBellDropdownOnBody();
        positionBellDropdown();
        dropdown.classList.remove('opacity-0', 'invisible', 'translate-y-2', 'scale-[0.98]', 'pointer-events-none');
        dropdown.classList.add('opacity-100', 'visible', 'translate-y-0', 'scale-100', 'pointer-events-auto');
    }

    /** 隐藏浮窗 */
    function hideBellDropdown() {
        var dropdown = document.getElementById('bell-dropdown');
        if (!dropdown) return;
        dropdown.classList.add('opacity-0', 'invisible', 'translate-y-2', 'scale-[0.98]', 'pointer-events-none');
        dropdown.classList.remove('opacity-100', 'visible', 'translate-y-0', 'scale-100', 'pointer-events-auto');
    }

    /** 根据铃铛按钮位置，定位 fixed 浮窗 */
    function positionBellDropdown() {
        var btn = document.getElementById('bell-button');
        var dropdown = document.getElementById('bell-dropdown');
        if (!btn || !dropdown) return;
        var rect = btn.getBoundingClientRect();
        dropdown.style.top = (rect.bottom + 8) + 'px';
        // 右对齐：让浮窗右边距 viewport 右边的距离 = 铃铛右边距 viewport 右边的距离 - 8px 偏移
        dropdown.style.right = (window.innerWidth - rect.right + 8) + 'px';
        dropdown.style.left = 'auto';
    }

    /** 加载通知数据并更新铃铛 UI */
    function loadBellNotifications() {
        var bellBtn = document.getElementById('bell-button');
        var bellContainer = document.getElementById('bell-container');
        if (!bellBtn) return;

        // 确保浮窗在 body 末尾
        ensureBellDropdownOnBody();

        var badge = document.getElementById('bell-badge');
        var subtitle = document.getElementById('bell-subtitle');
        var itemsBox = document.getElementById('bell-items');
        var newTag = document.getElementById('bell-new-tag');
        var viewAllBtn = document.getElementById('bell-view-all');
        if (!badge || !itemsBox) return;

        // 用 JS 接管 hover 显隐（替代之前的 CSS group-hover）
        if (!bellContainer.dataset.hoverBound) {
            bellContainer.dataset.hoverBound = 'true';
            var hideTimer = null;
            var dropdown = document.getElementById('bell-dropdown');

            function enterHandler() {
                clearTimeout(hideTimer);
                showBellDropdown();
            }
            function leaveHandler() {
                hideTimer = setTimeout(hideBellDropdown, 200);
            }

            bellContainer.addEventListener('mouseenter', enterHandler);
            bellContainer.addEventListener('mouseleave', leaveHandler);
            // 浮窗本身也需要响应——鼠标移到浮窗上时保持显示
            if (dropdown) {
                dropdown.addEventListener('mouseenter', function () { clearTimeout(hideTimer); });
                dropdown.addEventListener('mouseleave', leaveHandler);
            }
        }

        // 定位浮窗 + 绑定 resize/scroll 更新
        positionBellDropdown();
        if (!bellPositionBound) {
            bellPositionBound = true;
            window.addEventListener('resize', positionBellDropdown);
            window.addEventListener('scroll', positionBellDropdown, true);
        }

        // 绑定「查看全部通知」跳转
        if (viewAllBtn && !viewAllBtn.dataset.bound) {
            viewAllBtn.dataset.bound = 'true';
            viewAllBtn.addEventListener('click', function () {
                hideBellDropdown();
                if (typeof window.spaNavigate === 'function') {
                    window.spaNavigate('reminder.html');
                } else {
                    // 旧页面已删除，兜底直接走新路由
                    window.location.href = '/reminder';
                }
            });
        }

        if (!window.api || !window.api.get) return;

        window.api.get('/api/stats/notifications')
            .then(function (res) {
                if (!res.success || !res.data) {
                    renderBellEmpty(itemsBox, badge, subtitle, newTag);
                    return;
                }
                var data = res.data;
                var count = data.unreadCount || 0;
                var items = data.items || [];

                // 更新角标
                if (count > 0) {
                    badge.textContent = count > 99 ? '99+' : String(count);
                    badge.style.display = 'flex';
                } else {
                    badge.style.display = 'none';
                }

                // 更新副标题
                subtitle.textContent = count > 0
                    ? count + ' 条未读 · 今日优先处理'
                    : '暂无未读通知';
                newTag.style.display = count > 0 ? 'inline-block' : 'none';

                // 渲染通知列表
                if (!items.length) {
                    itemsBox.innerHTML = '<div class="flex flex-col items-center justify-center py-8 text-gray-400 text-sm">' +
                        '<i class="ph ph-bell-slash text-2xl mb-2"></i>暂无通知</div>';
                    return;
                }

                itemsBox.innerHTML = items.map(function (item) {
                    var c = BELL_COLOR_MAP[item.color] || BELL_COLOR_MAP.blue;
                    return '<div class="flex gap-3 p-3 rounded-xl hover:bg-gray-50 transition-colors cursor-pointer" data-type="' + escapeHtml(item.type) + '">' +
                        '<div class="w-8 h-8 rounded-lg ' + c.bg + ' ' + c.text + ' flex items-center justify-center shrink-0"><i class="' + escapeHtml(item.icon) + ' text-base"></i></div>' +
                        '<div class="min-w-0 flex-1">' +
                        '  <div class="flex items-center justify-between gap-3">' +
                        '    <p class="text-sm font-medium text-gray-800 truncate">' + escapeHtml(item.title) + '</p>' +
                        '    <span class="text-[10px] text-gray-400 shrink-0">' + escapeHtml(item.time) + '</span>' +
                        '  </div>' +
                        '  <p class="text-xs text-gray-500 mt-0.5 line-clamp-1">' + escapeHtml(item.desc) + '</p>' +
                        '</div>' +
                        '</div>';
                }).join('');

                // 点击通知项跳转到对应页面
                itemsBox.querySelectorAll('[data-type]').forEach(function (el) {
                    el.addEventListener('click', function () {
                        hideBellDropdown();
                        var type = el.getAttribute('data-type');
                        var targetPage = 'reminder.html';
                        if (type === 'pending-quote' || type === 'acceptance') {
                            targetPage = 'orders.html';
                        }
                        if (typeof window.spaNavigate === 'function') {
                            window.spaNavigate(targetPage);
                        } else {
                            window.location.href = targetPage;
                        }
                    });
                });
            })
            .catch(function (err) {
                console.error('加载通知失败:', err);
                renderBellEmpty(itemsBox, badge, subtitle, newTag);
            });
    }

    function renderBellEmpty(itemsBox, badge, subtitle, newTag) {
        badge.style.display = 'none';
        if (subtitle) subtitle.textContent = '暂无未读通知';
        if (newTag) newTag.style.display = 'none';
        if (itemsBox) {
            itemsBox.innerHTML = '<div class="flex flex-col items-center justify-center py-8 text-gray-400 text-sm">' +
                '<i class="ph ph-bell-slash text-2xl mb-2"></i>暂无通知</div>';
        }
    }

    function renderAvatar() {
        var profile = normalizeUserProfile(window.__userProfile);
        var name = profile.nickname || profile.username || '用户';
        var avatar = profile.avatar || makeProfileAvatar(name);
        return [
            '<div class="relative group" id="header-user-menu">',
            '  <div class="flex items-center gap-2 cursor-pointer hover:bg-gray-50 py-1.5 px-2 rounded-lg transition-colors border border-transparent hover:border-gray-200" id="header-user-trigger">',
            '    <img id="header-user-avatar" src="' + escapeHtml(avatar) + '" alt="User Avatar" class="w-8 h-8 rounded-full object-cover">',
            '    <span id="header-user-name" class="text-sm font-medium text-gray-700">' + escapeHtml(name) + '</span>',
            '    <i class="ph ph-caret-down text-gray-400 text-xs"></i>',
            '  </div>',
            '  <div class="absolute right-0 top-full mt-1 z-50 min-w-[8.5rem] rounded-lg border border-gray-100 bg-white py-1 shadow-lg shadow-gray-200/80 opacity-0 invisible pointer-events-none transition-all duration-150 group-hover:opacity-100 group-hover:visible group-hover:pointer-events-auto header-user-dropdown" id="header-user-dropdown" role="menu">',
            '    <button type="button" id="header-logout-btn" class="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors" role="menuitem">',
            '      <i class="ph ph-sign-out text-base"></i>退出登录',
            '    </button>',
            '  </div>',
            '</div>'
        ].join('');
    }

    function bindHeaderUserMenu() {
        var menu = document.getElementById('header-user-menu');
        var dropdown = document.getElementById('header-user-dropdown');
        var logoutBtn = document.getElementById('header-logout-btn');
        var trigger = document.getElementById('header-user-trigger');
        if (!menu || menu.dataset.bound === 'true') return;
        menu.dataset.bound = 'true';

        function doLogout() {
            if (typeof window.wtLogout === 'function') {
                window.wtLogout();
                return;
            }
            fetch('/api/auth/logout', {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' }
            }).catch(function () { /* ignore */ }).finally(function () {
                var next = encodeURIComponent(location.pathname + location.search);
                location.href = '/login.html?next=' + next;
            });
        }

        if (logoutBtn) {
            logoutBtn.addEventListener('click', function (e) {
                e.preventDefault();
                e.stopPropagation();
                doLogout();
            });
        }
        if (trigger && dropdown) {
            trigger.addEventListener('click', function (e) {
                e.stopPropagation();
                dropdown.classList.toggle('header-user-dropdown-open');
            });
            document.addEventListener('click', function (e) {
                if (!menu.contains(e.target)) {
                    dropdown.classList.remove('header-user-dropdown-open');
                }
            });
        }
    }

    // ========== 组装标题栏 ==========
    //
    // 统一布局：
    //   ┌──────────────────────────────────────────────────────────────────┐
    //   │ [图标] 标题          [搜索] [控件] [次按钮] [主按钮] │ [日志] [铃铛] [头像] │
    //   │        副标题                                                    │
    //   └──────────────────────────────────────────────────────────────────┘
    //
    // 左侧：可选图标 + 标题 + 副标题（所有页面结构一致）
    // 右侧：功能按钮区 ─ 竖线分隔 ─ 系统区（铃铛 + 头像）
    // 没有功能按钮的页面，竖线不显示，系统区仍靠右对齐
    function buildHeaderInnerHTML(pageName) {
        var config = getHeaderConfig(pageName);

        // 右侧功能按钮区
        var hasAction = config.search || (config.controls && config.controls.length) ||
            config.secondaryAction || config.action;

        var actionArea = hasAction
            ? '<div class="flex items-center gap-3">' +
              renderSearch(config.search) +
              renderControls(config.controls) +
              renderButton(config.secondaryAction, 'secondary') +
              renderButton(config.action, 'primary') +
              '</div>'
            : '';

        var divider = hasAction
            ? '<div class="w-px h-8 bg-gray-200"></div>'
            : '';

        var systemArea = '<div class="flex items-center gap-2">' +
            renderChangelogButton() +
            renderBell() +
            renderAvatar() +
            '</div>';

        return [
            '<div class="flex items-center gap-3">',
            renderLeft(config),
            '</div>',
            '<div class="flex items-center gap-3">',
            actionArea,
            divider,
            systemArea,
            '</div>'
        ].join('');
    }

    /** 异步加载页面副标题数据（目前仅 project.html 需要） */
    function loadPageSubtitle(pageName) {
        if (pageName !== 'project.html') return;
        if (!window.api || !window.api.get) return;
        window.api.get('/api/projects/stats')
            .then(function (res) {
                if (!res.success || !res.data) return;
                var d = res.data;
                window.__projectSubtitle = '共 ' + (d.total || 0) + ' 个项目 · ' + (d.inProgress || 0) + ' 个进行中';
                // 更新已渲染的副标题
                var header = document.getElementById('app-header');
                if (header) {
                    var subtitleEl = header.querySelector('p.text-sm.text-gray-500');
                    if (subtitleEl) subtitleEl.textContent = window.__projectSubtitle;
                }
            })
            .catch(function (err) {
                console.error('加载项目统计失败:', err);
            });
    }

    function renderHeader(pageName) {
        var currentPage = pageName || getCurrentPageName();
        var header = document.getElementById('app-header');
        var headerHtml = buildHeaderInnerHTML(currentPage);

        if (header) {
            header.innerHTML = headerHtml;
            bindStatsRangeButtons(header);
            syncStatsRangeButtons(header);
            bindChangelogButton();
            bindHeaderUserMenu();
            loadBellNotifications();
            applyUserProfileToHeader(window.__userProfile || getDefaultUserProfile());
            loadHeaderProfile();
            loadPageSubtitle(currentPage);
            return header;
        }

        var main = document.querySelector('main');
        if (!main) return null;

        main.insertAdjacentHTML('afterbegin', [
            '<header id="app-header" class="h-20 bg-white border-b border-gray-100 flex items-center justify-between px-8 flex-shrink-0 relative z-10">',
            headerHtml,
            '</header>'
        ].join(''));

        header = document.getElementById('app-header');
        bindStatsRangeButtons(header);
        syncStatsRangeButtons(header);
        bindChangelogButton();
        bindHeaderUserMenu();
        loadBellNotifications();
        applyUserProfileToHeader(window.__userProfile || getDefaultUserProfile());
        loadHeaderProfile();
        loadPageSubtitle(currentPage);
        return header;
    }

    document.addEventListener('DOMContentLoaded', function () {
        renderHeader(getCurrentPageName());
    });

    window.addEventListener('spa:ready', function (event) {
        var pageName = event && event.detail && event.detail.page ? event.detail.page : getCurrentPageName();
        renderHeader(pageName);
    });

    window.addEventListener('settings:profile-updated', function (event) {
        applyUserProfileToHeader(event && event.detail && event.detail.profile);
    });

    window.renderHeader = renderHeader;
    window.applyUserProfileToHeader = applyUserProfileToHeader;
})();
