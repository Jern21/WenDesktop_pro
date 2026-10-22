/**
 * 账号管理 视图
 *
 * 自动迁移自 frontend/pages/personal/accounts.html
 *
 * 迁移方式：原脚本整段放入 mount() 作用域，
 *   - 所有 var/function 成为局部变量，不再污染 window
 *   - document/window 上的监听由框架自动登记并清理
 *
 * ⚠️ 人工复核清单：
 *   1. 若含 onclick 内联属性 → 需改造成 data-act 委托
 *   2. 若含 spa:ready / spa:cleanup-forms 监听 → 新架构下应删除
 *   3. 若 css 含 @apply → 需展开为原生 CSS
 */
(function (global) {
    'use strict';

    var App = global.App = global.App || {};

    App.view('accounts', {
        path: '/accounts',
        nav: 'accounts.html',
        title: '账号管理',
        template: 'views/accounts.html',
        styles: 'css/views/accounts.css',

        async mount(root, ctx) {
            // ---- 自动捕获本页注册的全局监听，卸载时统一移除 ----
            var _docAdd = document.addEventListener;
            var _winAdd = window.addEventListener;
            var _listeners = [];
            document.addEventListener = function (t, f, o) {
                _listeners.push(['doc', t, f, o]);
                return _docAdd.call(document, t, f, o);
            };
            window.addEventListener = function (t, f, o) {
                _listeners.push(['win', t, f, o]);
                return _winAdd.call(window, t, f, o);
            };
            ctx.onCleanup(function () {
                document.addEventListener = _docAdd;
                window.addEventListener = _winAdd;
                _listeners.forEach(function (r) {
                    try {
                        (r[0] === 'doc' ? document : window).removeEventListener(r[1], r[2], r[3]);
                    } catch (e) { /* ignore */ }
                });
            });

            try {
                /* ==================== 原始脚本开始 ==================== */

                        // ========== 数据管理 ==========
                        var accounts = [];
                        var currentEditingId = null;
                        var platformConfig = {};

                        // 平台配置映射（从后端数据转换）
                        var platformIconMap = {
                            github: { icon: 'ph-github-logo', color: 'platform-github' },
                            gitee: { icon: 'ph-git-branch', color: 'platform-gitee' },
                            coding: { icon: 'ph-code', color: 'platform-coding' },
                            leetcode: { icon: 'ph-code', color: 'platform-leetcode' },
                            juejin: { icon: 'ph-article', color: 'platform-juejin' },
                            csdn: { icon: 'ph-notebook', color: 'platform-csdn' },
                            zhihu: { icon: 'ph-chat-circle-text', color: 'platform-zhihu' },
                            other: { icon: 'ph-globe', color: 'platform-other' }
                        };

                        // 当前上传的图标
                        var currentIconData = null;
                        var useTextIcon = false;

                        // ========== API 请求 ==========
                        function request(url, options) {
                            options = options || {};
                            options.signal = ctx.signal;
                            return global.api.call(url, options);
                        }

                        async function loadAccounts() {
                            try {
                                var result = await request('/api/accounts');
                                if (result.success) {
                                    accounts = result.data;
                                    renderAccounts();
                                }
                            } catch (e) {
                                if (e && e.name === 'AbortError') return;
                                console.error('加载账号失败:', e);
                            }
                        }

                        async function loadPlatforms() {
                            try {
                                var result = await request('/api/accounts/platforms');
                                if (result.success) {
                                    // 构建平台配置
                                    result.data.forEach(function(p) {
                                        var iconConfig = platformIconMap[p.id] || platformIconMap.other;
                                        platformConfig[p.id] = {
                                            name: p.name,
                                            icon: iconConfig.icon,
                                            color: 'platform-' + p.color
                                        };
                                    });
                                    // 更新下拉框
                                    var select = document.getElementById('filter-platform');
                                    select.innerHTML = '<option value="">全部平台</option>' +
                                        result.data.map(function(p) {
                                            return '<option value="' + p.id + '">' + p.name + '</option>';
                                        }).join('');
                                }
                            } catch (e) {
                                if (e && e.name === 'AbortError') return;
                                console.error('加载平台列表失败:', e);
                            }
                        }

                        // ========== 渲染账号列表 ==========
                        function renderAccounts() {
                            var grid = document.getElementById('accounts-grid');
                            var emptyState = document.getElementById('empty-state');
                            var filterPlatform = document.getElementById('filter-platform').value;
                            var searchKeyword = document.getElementById('search-input').value.toLowerCase();

                            // 过滤数据
                            var filtered = accounts.filter(function(acc) {
                                if (filterPlatform && acc.platform !== filterPlatform) return false;
                                if (searchKeyword) {
                                    var searchText = (acc.accountName + ' ' + (platformConfig[acc.platform]?.name || '') + ' ' + acc.email).toLowerCase();
                                    return searchText.indexOf(searchKeyword) !== -1;
                                }
                                return true;
                            });

                            if (filtered.length === 0) {
                                grid.innerHTML = '';
                                emptyState.classList.remove('hidden');
                                return;
                            }

                            emptyState.classList.add('hidden');
                            grid.innerHTML = filtered.map(function(acc) {
                                var config = platformConfig[acc.platform] || platformConfig.other || { icon: 'ph-globe', color: 'platform-other', name: '其他' };
                                var platformName = acc.customPlatform || config.name || '其他';

                                // 构建图标 HTML
                                var iconHtml = '';
                                if (acc.useTextIcon) {
                                    // 使用文字图标
                                    var text = platformName.charAt(0).toUpperCase();
                                    iconHtml = '<div class="w-10 h-10 rounded-lg bg-brand-500 text-white flex items-center justify-center text-lg font-bold">' + text + '</div>';
                                } else if (acc.icon) {
                                    // 使用上传的图标
                                    iconHtml = '<div class="w-10 h-10 rounded-lg bg-gray-50 flex items-center justify-center overflow-hidden"><img src="' + acc.icon + '" class="w-full h-full object-contain"></div>';
                                } else {
                                    // 使用默认图标
                                    iconHtml = '<div class="w-10 h-10 rounded-lg ' + config.color + ' flex items-center justify-center"><i class="ph ' + config.icon + ' text-xl"></i></div>';
                                }

                                return `
                                    <div class="account-card group" onclick="viewAccount('${acc.id}')">
                                        <div class="flex items-start justify-between mb-3">
                                            <div class="flex items-center gap-3">
                                                ${iconHtml}
                                                <div>
                                                    <h4 class="font-semibold text-gray-800">${escapeHtml(platformName)}</h4>
                                                    <p class="text-xs text-gray-400">${escapeHtml(acc.accountName)}</p>
                                                </div>
                                            </div>
                                            <div class="flex items-center gap-1">
                                                <span class="platform-badge ${config.color}">${escapeHtml(platformName)}</span>
                                                <button onclick="event.stopPropagation(); editAccount('${acc.id}')" class="p-1.5 text-gray-400 hover:text-brand-500 hover:bg-brand-50 rounded transition-colors opacity-0 group-hover:opacity-100">
                                                    <i class="ph ph-pencil"></i>
                                                </button>
                                                <button onclick="event.stopPropagation(); deleteAccount('${acc.id}')" class="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors opacity-0 group-hover:opacity-100">
                                                    <i class="ph ph-trash"></i>
                                                </button>
                                            </div>
                                        </div>
                                        ${acc.email ? `<p class="text-sm text-gray-500 mb-2"><i class="ph ph-envelope mr-1"></i>${escapeHtml(acc.email)}</p>` : ''}
                                        ${acc.remark ? `<p class="text-xs text-gray-400 mt-2 line-clamp-2">${escapeHtml(acc.remark)}</p>` : ''}
                                    </div>
                                `;
                            }).join('');
                        }

                        // ========== 表单操作 ==========
                        function openAccountForm(id) {
                            currentEditingId = id || null;
                            currentIconData = null;
                            useTextIcon = false;
                            document.getElementById('drawer-title').textContent = id ? '编辑账号' : '添加账号';
                            document.getElementById('account-form').reset();
                            document.getElementById('custom-platform-wrapper').classList.add('hidden');
                            document.getElementById('text-icon-preview').classList.add('hidden');
                            document.getElementById('use-text-icon').checked = false;
                            document.getElementById('icon-preview').innerHTML = '<i class="ph ph-image text-xl text-gray-400"></i>';

                            if (id) {
                                var acc = accounts.find(function(a) { return a.id === id; });
                                if (acc) {
                                    document.getElementById('account-id').value = acc.id;
                                    document.getElementById('account-platform').value = acc.platform;
                                    document.getElementById('account-username').value = acc.accountName;
                                    document.getElementById('account-email').value = acc.email || '';
                                    document.getElementById('account-password').value = acc.password || '';
                                    document.getElementById('account-url').value = acc.url || '';
                                    document.getElementById('account-notes').value = acc.remark || '';
                                    if (acc.platform === 'other') {
                                        document.getElementById('custom-platform').value = acc.customPlatform || '';
                                        document.getElementById('custom-platform-wrapper').classList.remove('hidden');
                                    }
                                    // 加载图标
                                    if (acc.useTextIcon) {
                                        useTextIcon = true;
                                        document.getElementById('use-text-icon').checked = true;
                                        toggleTextIcon();
                                    } else if (acc.icon) {
                                        currentIconData = acc.icon;
                                        document.getElementById('icon-preview').innerHTML = '<img src="' + currentIconData + '" class="w-full h-full object-contain">';
                                    }
                                }
                            }

                            document.getElementById('account-drawer').classList.remove('hidden');
                            setTimeout(function() {
                                document.getElementById('account-drawer-panel').classList.remove('translate-x-full');
                            }, 10);
                        }

                        function showToast(msg, type) {
                            App.ui.toast(msg, type || 'success');
                        }

                        // 复制文本到剪贴板
                        function copyText(text, successMsg) {
                            if (!text) { showToast('暂无可复制内容'); return; }
                            if (navigator.clipboard && navigator.clipboard.writeText) {
                                navigator.clipboard.writeText(text).then(function () { showToast(successMsg); }).catch(function () { fallbackCopy(text, successMsg); });
                                return;
                            }
                            fallbackCopy(text, successMsg);
                        }

                        function fallbackCopy(text, successMsg) {
                            var input = document.createElement('textarea');
                            input.value = text;
                            input.className = 'fixed -left-[9999px] top-0';
                            document.body.appendChild(input);
                            input.focus();
                            input.select();
                            try {
                                document.execCommand('copy');
                                showToast(successMsg);
                            } catch (e) {
                                showToast('复制失败');
                            }
                            document.body.removeChild(input);
                        }

                        // 查看账号详情
                        function viewAccount(id) {
                            var acc = accounts.find(function(a) { return a.id === id; });
                            if (!acc) return;

                            var config = platformConfig[acc.platform] || platformConfig.other || { icon: 'ph-globe', color: 'platform-other', name: '其他' };
                            var platformName = acc.customPlatform || config.name || '其他';

                            // 构建图标 HTML
                            var iconHtml = '';
                            if (acc.useTextIcon) {
                                var text = platformName.charAt(0).toUpperCase();
                                iconHtml = '<div class="w-16 h-16 rounded-xl bg-brand-500 text-white flex items-center justify-center text-2xl font-bold">' + text + '</div>';
                            } else if (acc.icon) {
                                iconHtml = '<div class="w-16 h-16 rounded-xl bg-gray-50 flex items-center justify-center overflow-hidden"><img src="' + acc.icon + '" class="w-full h-full object-contain"></div>';
                            } else {
                                iconHtml = '<div class="w-16 h-16 rounded-xl ' + config.color + ' flex items-center justify-center"><i class="ph ' + config.icon + ' text-3xl"></i></div>';
                            }

                            // 创建详情弹窗
                            var overlay = document.createElement('div');
                            overlay.className = 'fixed inset-0 z-[9999] bg-black/50 backdrop-blur-sm flex items-center justify-center';
                            overlay.innerHTML =
                                '<div class="bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4 transform scale-95 opacity-0 transition-all duration-200">' +
                                '  <div class="p-6">' +
                                '    <div class="flex items-center gap-4 mb-6">' +
                                '      ' + iconHtml +
                                '      <div>' +
                                '        <h3 class="text-lg font-bold text-gray-800">' + escapeHtml(platformName) + '</h3>' +
                                '        <span class="platform-badge ' + config.color + '">' + escapeHtml(platformName) + '</span>' +
                                '      </div>' +
                                '    </div>' +
                                '    <div class="space-y-4">' +
                                '      <div class="flex items-center justify-between p-3 bg-gray-50 rounded-lg">' +
                                '        <div><p class="text-xs text-gray-400 mb-1">账号/用户名</p><p class="text-sm font-medium text-gray-800">' + escapeHtml(acc.accountName) + '</p></div>' +
                                '        <button onclick="copyText(\'' + escapeHtml(acc.accountName).replace(/'/g, "\\'") + '\', \'账号已复制\')" class="p-2 text-gray-400 hover:text-brand-500 hover:bg-white rounded-lg transition-colors"><i class="ph ph-copy"></i></button>' +
                                '      </div>' +
                                (acc.email ? '<div class="flex items-center justify-between p-3 bg-gray-50 rounded-lg"><div><p class="text-xs text-gray-400 mb-1">邮箱</p><p class="text-sm font-medium text-gray-800">' + escapeHtml(acc.email) + '</p></div><button onclick="copyText(\'' + escapeHtml(acc.email).replace(/'/g, "\\'") + '\', \'邮箱已复制\')" class="p-2 text-gray-400 hover:text-brand-500 hover:bg-white rounded-lg transition-colors"><i class="ph ph-copy"></i></button></div>' : '') +
                                (acc.password ? '<div class="flex items-center justify-between p-3 bg-gray-50 rounded-lg"><div><p class="text-xs text-gray-400 mb-1">密码</p><p class="text-sm font-medium text-gray-800 font-mono">' + escapeHtml(acc.password) + '</p></div><button onclick="copyText(\'' + escapeHtml(acc.password).replace(/'/g, "\\'") + '\', \'密码已复制\')" class="p-2 text-gray-400 hover:text-brand-500 hover:bg-white rounded-lg transition-colors"><i class="ph ph-copy"></i></button></div>' : '') +
                                (acc.url ? '<div class="flex items-center justify-between p-3 bg-gray-50 rounded-lg"><div><p class="text-xs text-gray-400 mb-1">网址</p><p class="text-sm font-medium text-brand-500 truncate max-w-[200px]">' + escapeHtml(acc.url) + '</p></div><button onclick="copyText(\'' + escapeHtml(acc.url).replace(/'/g, "\\'") + '\', \'网址已复制\')" class="p-2 text-gray-400 hover:text-brand-500 hover:bg-white rounded-lg transition-colors"><i class="ph ph-copy"></i></button></div>' : '') +
                                (acc.remark ? '<div class="p-3 bg-gray-50 rounded-lg"><p class="text-xs text-gray-400 mb-1">备注</p><p class="text-sm text-gray-800">' + escapeHtml(acc.remark) + '</p></div>' : '') +
                                '    </div>' +
                                '  </div>' +
                                '  <div class="flex gap-3 p-4 border-t border-gray-100">' +
                                '    <button onclick="this.closest(\'.fixed\').remove()" class="flex-1 px-4 py-2.5 border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors">关闭</button>' +
                                '    <button onclick="this.closest(\'.fixed\').remove(); editAccount(\'' + acc.id + '\')" class="flex-1 px-4 py-2.5 bg-brand-500 text-white rounded-lg hover:bg-brand-600 transition-colors flex items-center justify-center gap-2"><i class="ph ph-pencil"></i>编辑</button>' +
                                '    <button onclick="this.closest(\'.fixed\').remove(); deleteAccount(\'' + acc.id + '\')" class="px-4 py-2.5 border border-red-200 text-red-500 rounded-lg hover:bg-red-50 transition-colors"><i class="ph ph-trash"></i></button>' +
                                '  </div>' +
                                '</div>';

                            document.body.appendChild(overlay);

                            // 动画进入
                            requestAnimationFrame(function () {
                                overlay.querySelector('div').classList.remove('scale-95', 'opacity-0');
                                overlay.querySelector('div').classList.add('scale-100', 'opacity-100');
                            });

                            // 点击遮罩关闭
                            overlay.onclick = function (e) {
                                if (e.target === overlay) overlay.remove();
                            };
                        }

                        function closeAccountForm() {
                            document.getElementById('account-drawer-panel').classList.add('translate-x-full');
                            setTimeout(function() {
                                document.getElementById('account-drawer').classList.add('hidden');
                            }, 300);
                        }

                        async function saveAccount() {
                            var platform = document.getElementById('account-platform').value;
                            var username = document.getElementById('account-username').value.trim();
                            var customPlatform = document.getElementById('custom-platform').value.trim();

                            if (!platform) {
                                showToast('请选择平台', 'error');
                                return;
                            }
                            if (platform === 'other' && !customPlatform) {
                                showToast('请输入平台名称', 'error');
                                return;
                            }
                            if (!username) {
                                showToast('请输入账号/用户名', 'error');
                                return;
                            }

                            var accountData = {
                                platform: platform,
                                accountName: username,
                                email: document.getElementById('account-email').value.trim(),
                                password: document.getElementById('account-password').value,
                                remark: document.getElementById('account-notes').value.trim(),
                                icon: currentIconData,
                                useTextIcon: useTextIcon,
                                customPlatform: platform === 'other' ? document.getElementById('custom-platform').value.trim() : null
                            };

                            try {
                                var url = currentEditingId ? '/api/accounts/' + currentEditingId : '/api/accounts';
                                var method = currentEditingId ? 'PUT' : 'POST';
                                var result = await request(url, {
                                    method: method,
                                    body: accountData
                                });
                                if (result.success) {
                                    showToast('保存成功');
                                    await loadAccounts();
                                    closeAccountForm();
                                } else {
                                    showToast(result.message || '保存失败', 'error');
                                }
                            } catch (e) {
                                if (e && e.name === 'AbortError') return;
                                console.error('保存账号失败:', e);
                                showToast('保存失败，请重试', 'error');
                            }
                        }

                        function editAccount(id) {
                            openAccountForm(id);
                        }

                        function deleteAccount(id) {
                            App.ui.confirm({
                                title: '删除账号',
                                message: '确定删除这个账号吗？删除后无法恢复。',
                                confirmText: '删除'
                            }).then(async function (ok) {
                                if (!ok) return;
                                try {
                                    var result = await request('/api/accounts/' + id, { method: 'DELETE' });
                                    if (result.success) {
                                        showToast('删除成功');
                                        await loadAccounts();
                                    } else {
                                        showToast(result.message || '删除失败', 'error');
                                    }
                                } catch (e) {
                                    if (e && e.name === 'AbortError') return;
                                    console.error('删除账号失败:', e);
                                    showToast('删除失败，请重试', 'error');
                                }
                            });
                        }

                        function togglePasswordVisibility() {
                            var input = document.getElementById('account-password');
                            var eye = document.getElementById('password-eye');
                            if (input.type === 'password') {
                                input.type = 'text';
                                eye.classList.remove('ph-eye');
                                eye.classList.add('ph-eye-slash');
                            } else {
                                input.type = 'password';
                                eye.classList.remove('ph-eye-slash');
                                eye.classList.add('ph-eye');
                            }
                        }

                        // 处理图标上传
                        async function handleIconUpload(event) {
                            var file = event.target.files[0];
                            if (!file) return;

                            // 使用 FormData 上传文件
                            var formData = new FormData();
                            formData.append('file', file);

                            try {
                                var result = await request('/api/upload', {
                                    method: 'POST',
                                    body: formData
                                });

                                if (result.success) {
                                    currentIconData = result.data.url;
                                    var preview = document.getElementById('icon-preview');
                                    preview.innerHTML = '<img src="' + currentIconData + '" class="w-full h-full object-contain">';
                                    // 取消文字图标选项
                                    document.getElementById('use-text-icon').checked = false;
                                    useTextIcon = false;
                                    document.getElementById('text-icon-preview').classList.add('hidden');
                                } else {
                                    showToast('图标上传失败: ' + (result.error || '未知错误'), 'error');
                                }
                            } catch (e) {
                                if (e && e.name === 'AbortError') return;
                                console.error('上传图标失败:', e);
                                showToast('图标上传失败，请重试', 'error');
                            }
                        }

                        // 切换文字图标
                        function toggleTextIcon() {
                            useTextIcon = document.getElementById('use-text-icon').checked;
                            var textPreview = document.getElementById('text-icon-preview');
                            var iconPreview = document.getElementById('icon-preview');

                            if (useTextIcon) {
                                // 获取平台名称首字
                                var platform = document.getElementById('account-platform').value;
                                var customName = document.getElementById('custom-platform').value;
                                var text = '';

                                if (platform === 'other' && customName) {
                                    text = customName.charAt(0).toUpperCase();
                                } else if (platform) {
                                    var platformNames = {
                                        github: 'G', gitee: 'G', coding: 'C', leetcode: 'L',
                                        juejin: '掘', csdn: 'C', zhihu: '知', other: '其'
                                    };
                                    text = platformNames[platform] || '平';
                                } else {
                                    text = '平';
                                }

                                document.getElementById('text-icon-display').textContent = text;
                                textPreview.classList.remove('hidden');

                                // 清空上传的图标
                                currentIconData = null;
                                iconPreview.innerHTML = '<i class="ph ph-image text-xl text-gray-400"></i>';
                            } else {
                                textPreview.classList.add('hidden');
                            }
                        }

                        // 更新文字图标预览
                        function updateTextIconPreview() {
                            if (!useTextIcon) return;
                            var platform = document.getElementById('account-platform').value;
                            var customName = document.getElementById('custom-platform').value;
                            var text = '';

                            if (platform === 'other' && customName) {
                                text = customName.charAt(0).toUpperCase();
                            } else if (platform) {
                                var platformNames = {
                                    github: 'G', gitee: 'G', coding: 'C', leetcode: 'L',
                                    juejin: '掘', csdn: 'C', zhihu: '知', other: '其'
                                };
                                text = platformNames[platform] || '平';
                            }
                            document.getElementById('text-icon-display').textContent = text;
                        }

                        // ========== 工具函数 ==========
                        var escapeHtml = App.dom.escapeHtml;

                        // ========== 事件绑定 ==========
                        document.getElementById('account-platform').addEventListener('change', function() {
                            if (this.value === 'other') {
                                document.getElementById('custom-platform-wrapper').classList.remove('hidden');
                            } else {
                                document.getElementById('custom-platform-wrapper').classList.add('hidden');
                            }
                            updateTextIconPreview();
                        });

                        document.getElementById('custom-platform').addEventListener('input', updateTextIconPreview);

                        document.getElementById('filter-platform').addEventListener('change', renderAccounts);
                        document.getElementById('search-input').addEventListener('input', renderAccounts);

                        // ========== 初始化 ==========
                        async function init() {
                            await loadPlatforms();
                            await loadAccounts();
                        }

                        if (document.readyState === 'loading') {
                            document.addEventListener('DOMContentLoaded', init);
                        } else {
                            init();
                        }
                    
                /* <<< auto:post-process >>> */
            /* ---------------- data-act 事件委托（自动生成，勿手改） ---------------- */
            // 模板里的内联 onclick 已统一改为 data-act 属性，这里转发到本作用域的函数。
            // 本块由 tools/post-process-views.js 生成，重跑会整体替换。
            var ACTION_MAP = {
                'openAccountForm': openAccountForm,
                'closeAccountForm': closeAccountForm,
                'pick-icon': function () { var i = document.getElementById('account-icon-upload'); if (i) i.click(); },
                'togglePasswordVisibility': togglePasswordVisibility,
                'saveAccount': saveAccount,
            };
            ctx.onCleanup(App.dom.delegate(root, '[data-act]', 'click', function (e, el) {
                var act = el.getAttribute('data-act');
                var fn = ACTION_MAP[act];
                if (typeof fn !== 'function') {
                    console.warn('[accounts] 未定义的动作:', act);
                    return;
                }
                e.preventDefault();
                fn(e, el);
            }));

            /* ---------- 兼容：JS 拼接的卡片 HTML 仍用内联 onclick ---------- */
            // 内联处理器只在全局作用域找函数，且这些调用带参数，故挂到 window。
            // 离开页面时由 core/view.js 的全局键快照回收自动删除，不会跨页残留。
            window.viewAccount = viewAccount;
            window.editAccount = editAccount;
            window.deleteAccount = deleteAccount;
            window.copyText = copyText;
/* <<< /auto:post-process >>> */
/* ==================== 原始脚本结束 ==================== */
            } finally {
                document.addEventListener = _docAdd;
                window.addEventListener = _winAdd;
            }
        }
    });

})(typeof window !== 'undefined' ? window : this);
