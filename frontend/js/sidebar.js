function initSidebar() {
    // 防重复插入保护：SPA 切换时不会二次执行
    if (document.querySelector('#sidebar-nav')) return;

    var PB = window.PAGE_BASE || '';

    // 页面路由表：短文件名 → 相对于 frontend 根目录的完整路径
    var ROUTES = {
        'index.html': 'index.html',
        'orders.html': 'pages/business/orders.html',
        'quote.html': 'pages/business/quote.html',
        'customer.html': 'pages/business/customer.html',
        'platform.html': 'pages/platform/platform.html',
        'xianyu.html': 'pages/platform/xianyu.html',
        'xiaohongshu.html': 'pages/platform/xiaohongshu.html',
        'douyin.html': 'pages/platform/douyin.html',
        'posters.html': 'pages/content/posters.html',
        'canvas.html': 'pages/content/canvas.html',
        'stats.html': 'pages/content/stats.html',
        'project.html': 'pages/content/project.html',
        'accounts.html': 'pages/personal/accounts.html',
        'bookmarks.html': 'pages/personal/bookmarks.html',
        'resume.html': 'pages/personal/resume.html',
        'memo.html': 'pages/personal/memo.html',
        'reminder.html': 'pages/personal/reminder.html',
        'settings.html': 'pages/personal/settings.html'
    };

    const sidebarHTML = `
    <aside class="w-56 bg-white border-r border-gray-100 flex flex-col h-full flex-shrink-0 relative z-40">
        <div class="overflow-y-auto flex-1 pb-4">
            <!-- Logo area -->
            <div class="p-6 flex items-center gap-3">
                <div class="w-10 h-10 rounded-xl overflow-hidden flex-shrink-0">
                    <img src="${PB}assets/gif/logo.gif" alt="Logo" class="w-full h-full object-cover">
                </div>
                <div>
                    <h1 class="font-bold text-gray-800 text-base">文的项目工作台</h1>
                    <p class="text-xs text-gray-400">大吉大利 · 今晚接单</p>
                </div>
            </div>

            <!-- Navigation -->
            <!--
                data-menu-key：菜单项唯一标识，供「设置中心 → 菜单选项」的显示/隐藏开关使用
                  （不能拿 data-page 当 key ——「平台管理」和它的子项「总览看板」都是 platform.html）
                data-menu-parent：子项归属的主项 key，设置页据此做缩进与联动禁用
            -->
            <nav class="space-y-1 mt-2" id="sidebar-nav">
                <a href="${PB}${ROUTES['index.html']}" class="nav-link flex items-center px-4 py-2.5 mx-2 rounded-lg text-gray-700 hover:bg-gray-100 transition-colors cursor-pointer text-sm font-medium" data-page="index.html" data-menu-key="home">
                    <i class="ph ph-house text-lg mr-3 icon-base text-gray-500"></i>首页
                </a>
                <a href="${PB}${ROUTES['orders.html']}" class="nav-link flex items-center px-4 py-2.5 mx-2 rounded-lg text-gray-700 hover:bg-gray-100 transition-colors cursor-pointer text-sm font-medium" data-page="orders.html" data-menu-key="orders">
                    <i class="ph ph-receipt text-lg mr-3 icon-base text-gray-500"></i>我的订单
                </a>
                <a href="${PB}${ROUTES['quote.html']}" class="nav-link flex items-center px-4 py-2.5 mx-2 rounded-lg text-gray-700 hover:bg-gray-100 transition-colors cursor-pointer text-sm font-medium" data-page="quote.html" data-menu-key="quote">
                    <i class="ph ph-currency-cny text-lg mr-3 icon-base text-gray-500"></i>报价管理
                </a>
                <a href="${PB}${ROUTES['posters.html']}" class="nav-link flex items-center px-4 py-2.5 mx-2 rounded-lg text-gray-700 hover:bg-gray-100 transition-colors cursor-pointer text-sm font-medium" data-page="posters.html" data-menu-key="posters">
                    <i class="ph ph-image text-lg mr-3 icon-base text-gray-500"></i>宣传海报
                </a>
                <a href="${PB}${ROUTES['canvas.html']}" class="nav-link flex items-center px-4 py-2.5 mx-2 rounded-lg text-gray-700 hover:bg-gray-100 transition-colors cursor-pointer text-sm font-medium" data-page="canvas.html" data-menu-key="canvas">
                    <i class="ph ph-infinity text-lg mr-3 icon-base text-gray-500"></i>无限画布
                </a>
                
                <!-- Expanded Menu: Platform Management（整块隐藏，含子菜单） -->
                <div class="mt-2" data-menu-key="platform">
                    <div class="flex items-center mx-2 rounded-lg hover:bg-gray-100 transition-colors">
                        <a href="${PB}${ROUTES['platform.html']}" class="nav-link flex items-center flex-1 px-4 py-2.5 rounded-lg text-gray-700 hover:bg-gray-100 transition-colors cursor-pointer text-sm font-medium" data-page="platform.html">
                            <i class="ph ph-squares-four text-lg mr-3 icon-base text-gray-500"></i>平台管理
                        </a>
                        <button id="platform-toggle" class="px-3 py-2.5 text-gray-400 hover:text-gray-600 transition-colors cursor-pointer">
                            <i class="ph ph-caret-right caret-icon"></i>
                        </button>
                    </div>
                    <!-- Sub-menu items -->
                    <div class="space-y-1 mt-1 hidden" id="platform-submenu">
                        <a href="${PB}${ROUTES['platform.html']}" class="nav-link flex items-center pl-11 pr-4 py-2 mx-2 rounded-lg bg-brand-50 text-brand-600 font-medium transition-colors cursor-pointer text-sm" data-page="platform.html" data-menu-key="platform-overview" data-menu-parent="platform">总览看板</a>
                        <a href="${PB}${ROUTES['xianyu.html']}" class="nav-link flex items-center pl-11 pr-4 py-2 mx-2 rounded-lg text-gray-500 hover:text-gray-900 transition-colors cursor-pointer text-sm" data-page="xianyu.html" data-menu-key="xianyu" data-menu-parent="platform">闲鱼</a>
                        <a href="${PB}${ROUTES['xiaohongshu.html']}" class="nav-link flex items-center pl-11 pr-4 py-2 mx-2 rounded-lg text-gray-500 hover:text-gray-900 transition-colors cursor-pointer text-sm" data-page="xiaohongshu.html" data-menu-key="xiaohongshu" data-menu-parent="platform">小红书</a>
                        <a href="${PB}${ROUTES['douyin.html']}" class="nav-link flex items-center pl-11 pr-4 py-2 mx-2 rounded-lg text-gray-500 hover:text-gray-900 transition-colors cursor-pointer text-sm" data-page="douyin.html" data-menu-key="douyin" data-menu-parent="platform">抖音</a>
                    </div>
                </div>

                <a href="${PB}${ROUTES['customer.html']}" class="nav-link flex items-center px-4 py-2.5 mx-2 rounded-lg text-gray-700 hover:bg-gray-100 transition-colors cursor-pointer text-sm font-medium mt-2" data-page="customer.html" data-menu-key="customer">
                    <i class="ph ph-users text-lg mr-3 icon-base text-gray-500"></i>客户管理
                </a>
                <a href="${PB}${ROUTES['stats.html']}" class="nav-link flex items-center px-4 py-2.5 mx-2 rounded-lg text-gray-700 hover:bg-gray-100 transition-colors cursor-pointer text-sm font-medium" data-page="stats.html" data-menu-key="stats">
                    <i class="ph ph-chart-bar text-lg mr-3 icon-base text-gray-500"></i>数据统计
                </a>
                <a href="${PB}${ROUTES['project.html']}" class="nav-link flex items-center px-4 py-2.5 mx-2 rounded-lg text-gray-700 hover:bg-gray-100 transition-colors cursor-pointer text-sm font-medium" data-page="project.html" data-menu-key="project">
                    <i class="ph ph-kanban text-lg mr-3 icon-base text-gray-500"></i>项目管理
                </a>
                <a href="${PB}${ROUTES['accounts.html']}" class="nav-link flex items-center px-4 py-2.5 mx-2 rounded-lg text-gray-700 hover:bg-gray-100 transition-colors cursor-pointer text-sm font-medium" data-page="accounts.html" data-menu-key="accounts">
                    <i class="ph ph-key text-lg mr-3 icon-base text-gray-500"></i>账号管理
                </a>
                <a href="${PB}${ROUTES['bookmarks.html']}" class="nav-link flex items-center px-4 py-2.5 mx-2 rounded-lg text-gray-700 hover:bg-gray-100 transition-colors cursor-pointer text-sm font-medium" data-page="bookmarks.html" data-menu-key="bookmarks">
                    <i class="ph ph-bookmark-simple text-lg mr-3 icon-base text-gray-500"></i>网址收藏
                </a>
                <a href="${PB}${ROUTES['resume.html']}" class="nav-link flex items-center px-4 py-2.5 mx-2 rounded-lg text-gray-700 hover:bg-gray-100 transition-colors cursor-pointer text-sm font-medium" data-page="resume.html" data-menu-key="resume">
                    <i class="ph ph-file-text text-lg mr-3 icon-base text-gray-500"></i>简历管理
                </a>
                <a href="${PB}${ROUTES['memo.html']}" class="nav-link flex items-center px-4 py-2.5 mx-2 rounded-lg text-gray-700 hover:bg-gray-100 transition-colors cursor-pointer text-sm font-medium" data-page="memo.html" data-menu-key="memo">
                    <i class="ph ph-notepad text-lg mr-3 icon-base text-gray-500"></i>信息备忘录
                </a>
                <a href="${PB}${ROUTES['reminder.html']}" class="nav-link flex items-center px-4 py-2.5 mx-2 rounded-lg text-gray-700 hover:bg-gray-100 transition-colors cursor-pointer text-sm font-medium" data-page="reminder.html" data-menu-key="reminder">
                    <i class="ph ph-bell-ringing text-lg mr-3 icon-base text-gray-500"></i>日期提醒
                </a>
                <a href="${PB}${ROUTES['settings.html']}" class="nav-link flex items-center px-4 py-2.5 mx-2 rounded-lg text-gray-700 hover:bg-gray-100 transition-colors cursor-pointer text-sm font-medium" data-page="settings.html" data-menu-key="settings">
                    <i class="ph ph-gear text-lg mr-3 icon-base text-gray-500"></i>设置中心
                </a>
            </nav>
        </div>

        <!-- 柴犬桌宠区域 -->
        <div class="flex-shrink-0 border-t border-gray-50 pt-2 pb-3 px-2 relative">
            <div class="relative cursor-pointer" id="shiba-pet-area">
                <div id="shiba-chat-panel" class="shiba-chat-panel" aria-hidden="true" hidden>
                    <div class="shiba-chat-header">
                        <span class="shiba-chat-title">小柴 · 对话</span>
                        <button type="button" id="shiba-chat-close" class="shiba-chat-close" aria-label="关闭对话">×</button>
                    </div>
                    <div id="shiba-chat-log" class="shiba-chat-log" role="log" aria-live="polite"></div>
                    <form id="shiba-chat-form" class="shiba-chat-form">
                        <textarea id="shiba-chat-input" class="shiba-chat-input" rows="3" maxlength="500" placeholder="跟小柴说点什么…" autocomplete="off"></textarea>
                        <button type="submit" id="shiba-chat-send" class="shiba-chat-send">发送</button>
                    </form>
                </div>
                <div id="shiba-bubble" class="shiba-dialogue-bubble opacity-0 pointer-events-none absolute z-30 bg-white border border-stone-800 text-stone-700 text-[10px] font-medium py-1.5 px-2.5 rounded-lg shadow-sm max-w-[11rem] text-left leading-snug" style="font-family: 'ZCOOL KuaiLe', Inter, system-ui, sans-serif; left: 50%; transform: translateX(-50%); bottom: 68px; transition: opacity 0.3s ease, transform 0.3s ease;">
                    <p id="shiba-bubble-tag" class="hidden text-[9px] font-bold text-amber-600 mb-0.5">小柴</p>
                    <span id="shiba-bubble-text" class="block whitespace-pre-wrap">你好呀！</span>
                    <div class="absolute bottom-[-4px] left-1/2 transform -translate-x-1/2 w-1.5 h-1.5 bg-white border-r border-b border-stone-800 rotate-45"></div>
                </div>
                <div class="relative w-full h-16">
                    <canvas id="shiba-canvas" width="200" height="64" class="w-full h-16 block"></canvas>
                    <div id="shiba-dog-mount" class="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true"></div>
                </div>
            </div>
        </div>

    </aside>
    `;

    // 将侧边栏插入到 body 最前面
    document.body.insertAdjacentHTML('afterbegin', sidebarHTML);

    // 应用「设置中心 → 菜单选项」里用户关掉的菜单项。
    // 只在首次插入时执行一次；之后用户在设置页改开关时，
    // 由 SidebarMenuPrefs.setVisible() 内部直接调用 apply() 实时生效。
    if (window.SidebarMenuPrefs && typeof window.SidebarMenuPrefs.apply === 'function') {
        window.SidebarMenuPrefs.apply();
    }

    // 平台管理：点击文字导航并自动展开子菜单
    const platformLink = document.querySelector('.nav-link[data-page="platform.html"]');
    if (platformLink) {
        platformLink.addEventListener('click', function () {
            const submenu = document.getElementById('platform-submenu');
            const caret = document.querySelector('#platform-toggle .caret-icon');
            if (submenu) {
                submenu.classList.remove('hidden');
            }
            if (caret) {
                caret.classList.remove('ph-caret-right', 'text-gray-400');
                caret.classList.add('ph-caret-up', 'text-brand-600');
            }
        });
    }

    // 平台管理：箭头按钮自由展开/收起子菜单
    const platformToggle = document.getElementById('platform-toggle');
    if (platformToggle) {
        platformToggle.addEventListener('click', function (e) {
            e.preventDefault();
            e.stopPropagation();
            const submenu = document.getElementById('platform-submenu');
            const caret = platformToggle.querySelector('.caret-icon');
            if (submenu) {
                submenu.classList.toggle('hidden');
            }
            if (caret) {
                const expanded = submenu && !submenu.classList.contains('hidden');
                caret.classList.toggle('ph-caret-right', !expanded);
                caret.classList.toggle('text-gray-400', !expanded);
                caret.classList.toggle('ph-caret-up', expanded);
                caret.classList.toggle('text-brand-600', expanded);
            }
        });
    }

    // 获取当前页面文件名
    let currentPage = window.location.pathname.split('/').pop();
    if (!currentPage || currentPage === '') {
        currentPage = 'index.html';
    }

    // 设置初始激活状态
    updateSidebarActive(currentPage);

    // ========== 柴犬桌宠 ==========
    if (window.ShibaDialogue && typeof window.ShibaDialogue.init === 'function') {
        window.ShibaDialogue.init();
    }
    initShibaPet();
}

// 页面加载时初始化（支持普通页面加载和 SPA 切换）
document.addEventListener('DOMContentLoaded', initSidebar);
window.addEventListener('spa:ready', initSidebar);

function updateSidebarActive(targetPage) {
    const navLinks = document.querySelectorAll('.nav-link');

    // 第一步：清除所有激活状态，恢复默认样式
    navLinks.forEach(link => {
        link.classList.remove('bg-brand-50', 'text-brand-600');
        link.classList.add('text-gray-700', 'hover:bg-gray-100');

        const icon = link.querySelector('.icon-base');
        if (icon) {
            icon.classList.remove('text-brand-600');
            icon.classList.add('text-gray-500');
        }

    });

    // 第二步：激活目标页面对应的导航项
    navLinks.forEach(link => {
        if (link.dataset.page === targetPage) {
            link.classList.remove('text-gray-700', 'hover:bg-gray-100');
            link.classList.add('bg-brand-50', 'text-brand-600');

            const icon = link.querySelector('.icon-base');
            if (icon) {
                icon.classList.remove('text-gray-500');
                icon.classList.add('text-brand-600');
            }
        }
    });
}

// 暴露为全局函数，供 spa-router.js 调用
window.updateSidebarActive = updateSidebarActive;
