/**
 * 设置中心 视图
 *
 * 自动迁移自 frontend/pages/personal/settings.html
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

    App.view('settings', {
        path: '/settings',
        nav: 'settings.html',
        title: '设置中心',
        template: 'views/settings.html',
        styles: 'css/views/settings.css',

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

                        // 设置导航点击高亮 + 滚动高亮
                        function initSettingsNav() {
                            var navItems = document.querySelectorAll('.settings-nav-item');
                            // 防重复绑定
                            if (!navItems.length || navItems[0].dataset.navBound) return;
                            navItems.forEach(function(item) {
                                item.addEventListener('click', function(e) {
                                    e.preventDefault();
                                    navItems.forEach(function(n) { n.classList.remove('active'); });
                                    item.classList.add('active');
                                    // 滚动到对应区块
                                    var sectionId = item.dataset.section;
                                    var target = document.getElementById(sectionId);
                                    if (target) {
                                        var scrollContainer = target.closest('.overflow-y-auto');
                                        if (scrollContainer) {
                                            var rect = target.getBoundingClientRect();
                                            var containerRect = scrollContainer.getBoundingClientRect();
                                            scrollContainer.scrollTo({
                                                top: scrollContainer.scrollTop + rect.top - containerRect.top - 16,
                                                behavior: 'smooth'
                                            });
                                        } else {
                                            target.scrollIntoView({ behavior: 'smooth', block: 'start' });
                                        }
                                    }
                                });
                                item.dataset.navBound = '1'; // 标记放在绑定之后
                            });

                            // 滚动时自动高亮对应区块
                            var sections = document.querySelectorAll('div[id]');
                            var observer = new IntersectionObserver(function(entries) {
                                entries.forEach(function(entry) {
                                    if (entry.isIntersecting) {
                                        var id = entry.target.id;
                                        navItems.forEach(function(n) {
                                            if (n.dataset.section === id) {
                                                navItems.forEach(function(nn) { nn.classList.remove('active'); });
                                                n.classList.add('active');
                                            }
                                        });
                                    }
                                });
                            }, { rootMargin: '-20% 0px -70% 0px' });

                            document.querySelectorAll('#account, #appearance, #security, #notification, #ai-image, #export, #backup, #bug-reports, #cleanup, #recycle, #about').forEach(function(sec) {
                                observer.observe(sec);
                            });
                        }

                        // ========== 账号信息 ==========
                        function initAccountProfile() {
                            var root = document.getElementById('account');
                            if (!root || root.dataset.profileBound) return;

                            var API_BASE = (window.ROOT_URL || window.PAGE_BASE || '') + 'api/settings';
                            var avatarImg = document.getElementById('profile-avatar-img');
                            var avatarInput = document.getElementById('profile-avatar-input');
                            var avatarBtn = document.getElementById('profile-avatar-btn');
                            var changeAvatarBtn = document.getElementById('profile-change-avatar-btn');
                            var displayName = document.getElementById('profile-display-name');
                            var displayRole = document.getElementById('profile-display-role');
                            var nicknameInput = document.getElementById('profile-nickname');
                            var realNameInput = document.getElementById('profile-real-name');
                            var phoneInput = document.getElementById('profile-phone');
                            var emailInput = document.getElementById('profile-email');
                            var roleInput = document.getElementById('profile-role');
                            var cityInput = document.getElementById('profile-city');
                            var bioInput = document.getElementById('profile-bio');
                            var saveBtn = document.getElementById('profile-save-btn');
                            var cancelBtn = document.getElementById('profile-cancel-btn');
                            var statusBar = document.getElementById('profile-status-bar');

                            if (!avatarImg || !nicknameInput || !saveBtn || !cancelBtn || !statusBar) return;

                            var currentProfile = null;
                            var pendingAvatar = '';

                            function escapeXml(value) {
                                return String(value || '')
                                    .replace(/&/g, '&amp;')
                                    .replace(/</g, '&lt;')
                                    .replace(/>/g, '&gt;')
                                    .replace(/"/g, '&quot;')
                                    .replace(/'/g, '&apos;');
                            }

                            function fallbackAvatar(name) {
                                var label = String(name || '用').trim().charAt(0) || '用';
                                var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128">' +
                                    '<rect width="128" height="128" rx="64" fill="#2563eb"/>' +
                                    '<text x="50%" y="50%" dy=".08em" text-anchor="middle" dominant-baseline="middle" ' +
                                    'font-family="Inter, system-ui, sans-serif" font-size="48" font-weight="700" fill="#fff">' +
                                    escapeXml(label) + '</text></svg>';
                                return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
                            }

                            function defaultProfile() {
                                return {
                                    nickname: '',
                                    realName: '',
                                    phone: '',
                                    email: '',
                                    role: '',
                                    city: '',
                                    bio: '',
                                    avatar: ''
                                };
                            }

                            function normalizeProfile(profile) {
                                return Object.assign(defaultProfile(), profile || {});
                            }

                            function showStatus(type, message) {
                                var styles = {
                                    success: 'flex bg-green-50 text-green-600 border-green-100',
                                    error: 'flex bg-red-50 text-red-600 border-red-100',
                                    info: 'flex bg-blue-50 text-blue-600 border-blue-100'
                                };
                                var icons = { success: 'ph-check-circle', error: 'ph-warning-circle', info: 'ph-info' };
                                statusBar.className = 'items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium mb-4 border ' + (styles[type] || styles.info);
                                statusBar.innerHTML = '<i class="ph ' + (icons[type] || icons.info) + '"></i><span></span>';
                                var span = statusBar.querySelector('span');
                                if (span) span.textContent = message || '';
                            }

                            function setButtonLoading(btn, loading, text) {
                                if (!btn) return;
                                if (!btn.dataset.defaultHtml) btn.dataset.defaultHtml = btn.innerHTML;
                                btn.disabled = loading;
                                btn.classList.toggle('opacity-70', loading);
                                btn.classList.toggle('cursor-not-allowed', loading);
                                btn.innerHTML = loading ? '<i class="ph ph-spinner-gap animate-spin"></i> ' + text : btn.dataset.defaultHtml;
                            }

                            function updatePreview(profile) {
                                var nickname = (profile.nickname || '').trim() || '未设置昵称';
                                var role = (profile.role || '').trim() || '未设置职业方向';
                                displayName.textContent = nickname;
                                displayRole.textContent = role;
                                avatarImg.src = profile.avatar || fallbackAvatar(nickname);
                            }

                            function fillForm(profile) {
                                profile = normalizeProfile(profile);
                                pendingAvatar = profile.avatar || '';
                                nicknameInput.value = profile.nickname || '';
                                realNameInput.value = profile.realName || '';
                                phoneInput.value = profile.phone || '';
                                emailInput.value = profile.email || '';
                                roleInput.value = profile.role || '';
                                cityInput.value = profile.city || '';
                                bioInput.value = profile.bio || '';
                                updatePreview(profile);
                            }

                            function collectProfile() {
                                var profile = normalizeProfile(currentProfile);
                                profile.nickname = nicknameInput.value.trim();
                                profile.realName = realNameInput.value.trim();
                                profile.phone = phoneInput.value.trim();
                                profile.email = emailInput.value.trim();
                                profile.role = roleInput.value.trim();
                                profile.city = cityInput.value.trim();
                                profile.bio = bioInput.value.trim();
                                profile.avatar = pendingAvatar || '';
                                return profile;
                            }

                            function publishProfile(profile) {
                                window.__userProfile = profile;
                                if (typeof window.applyUserProfileToHeader === 'function') {
                                    window.applyUserProfileToHeader(profile);
                                }
                                window.dispatchEvent(new CustomEvent('settings:profile-updated', {
                                    detail: { profile: profile }
                                }));
                            }

                            function loadProfile() {
                                showStatus('info', '正在读取账号信息...');
                                return fetch(API_BASE)
                                    .then(function (res) { return res.json(); })
                                    .then(function (result) {
                                        if (!result.success) throw new Error(result.error || '读取账号信息失败');
                                        currentProfile = normalizeProfile(result.data && result.data.profile);
                                        fillForm(currentProfile);
                                        publishProfile(currentProfile);
                                        showStatus('success', '账号信息已从后端读取');
                                    })
                                    .catch(function (err) {
                                        currentProfile = defaultProfile();
                                        fillForm(currentProfile);
                                        showStatus('error', err.message || '无法连接后端服务');
                                    });
                            }

                            function saveProfile() {
                                var profile = collectProfile();
                                if (!profile.nickname) {
                                    showStatus('error', '请填写昵称');
                                    nicknameInput.focus();
                                    return;
                                }

                                setButtonLoading(saveBtn, true, '保存中...');
                                fetch(API_BASE, {
                                    method: 'PUT',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ profile: profile })
                                })
                                    .then(function (res) { return res.json(); })
                                    .then(function (result) {
                                        if (!result.success) throw new Error(result.error || '保存失败');
                                        currentProfile = normalizeProfile(result.data && result.data.profile);
                                        fillForm(currentProfile);
                                        publishProfile(currentProfile);
                                        showStatus('success', '账号信息已保存');
                                    })
                                    .catch(function (err) {
                                        showStatus('error', err.message || '保存失败，请检查后端服务');
                                    })
                                    .finally(function () {
                                        setButtonLoading(saveBtn, false);
                                    });
                            }

                            function resizeAvatar(file) {
                                return new Promise(function (resolve, reject) {
                                    if (!file || !file.type || file.type.indexOf('image/') !== 0) {
                                        reject(new Error('请选择图片文件'));
                                        return;
                                    }
                                    var reader = new FileReader();
                                    reader.onload = function () {
                                        var img = new Image();
                                        img.onload = function () {
                                            var size = 256;
                                            var canvas = document.createElement('canvas');
                                            canvas.width = size;
                                            canvas.height = size;
                                            var ctx = canvas.getContext('2d');
                                            var side = Math.min(img.width, img.height);
                                            var sx = Math.max(0, (img.width - side) / 2);
                                            var sy = Math.max(0, (img.height - side) / 2);
                                            ctx.drawImage(img, sx, sy, side, side, 0, 0, size, size);
                                            resolve(canvas.toDataURL('image/jpeg', 0.88));
                                        };
                                        img.onerror = function () { reject(new Error('头像图片读取失败')); };
                                        img.src = reader.result;
                                    };
                                    reader.onerror = function () { reject(new Error('头像图片读取失败')); };
                                    reader.readAsDataURL(file);
                                });
                            }

                            function chooseAvatar() {
                                if (avatarInput) avatarInput.click();
                            }

                            avatarBtn.addEventListener('click', chooseAvatar);
                            changeAvatarBtn.addEventListener('click', chooseAvatar);
                            avatarInput.addEventListener('change', function () {
                                var file = avatarInput.files && avatarInput.files[0];
                                if (!file) return;
                                resizeAvatar(file)
                                    .then(function (dataUrl) {
                                        pendingAvatar = dataUrl;
                                        updatePreview(Object.assign({}, collectProfile(), { avatar: pendingAvatar }));
                                        showStatus('info', '头像已选择，点击保存后生效');
                                    })
                                    .catch(function (err) {
                                        showStatus('error', err.message || '头像处理失败');
                                    })
                                    .finally(function () {
                                        avatarInput.value = '';
                                    });
                            });

                            [nicknameInput, roleInput].forEach(function (input) {
                                input.addEventListener('input', function () {
                                    updatePreview(collectProfile());
                                });
                            });
                            saveBtn.addEventListener('click', saveProfile);
                            cancelBtn.addEventListener('click', function () {
                                fillForm(currentProfile || defaultProfile());
                                showStatus('info', '已恢复为上次保存的账号信息');
                            });

                            root.dataset.profileBound = '1';
                            loadProfile();
                        }

                        // 主题切换逻辑
                        function initThemeSwitcher() {
                            var themeCards = document.querySelectorAll('.theme-card');
                            if (!themeCards.length || themeCards[0].dataset.themeBound) return;

                            function updateUI(theme) {
                                themeCards.forEach(function(card) {
                                    var val = card.dataset.themeValue;
                                    var check = card.querySelector('.theme-check');
                                    if (val === theme) {
                                        card.style.borderColor = '#3b82f6';
                                        card.style.boxShadow = '0 0 0 3px rgba(59,130,246,0.1)';
                                        if (check) {
                                            check.style.borderColor = '#3b82f6';
                                            check.style.backgroundColor = '#3b82f6';
                                            var icon = check.querySelector('i');
                                            if (icon) { icon.style.color = '#fff'; }
                                        }
                                    } else {
                                        card.style.borderColor = '#e5e7eb';
                                        card.style.boxShadow = 'none';
                                        if (check) {
                                            check.style.borderColor = '#d1d5db';
                                            check.style.backgroundColor = 'transparent';
                                            var icon = check.querySelector('i');
                                            if (icon) { icon.style.color = 'transparent'; }
                                        }
                                    }
                                });
                            }

                            // 初始化当前选中状态
                            var currentTheme = (window.AppTheme && window.AppTheme.get()) || 'pure-white';
                            updateUI(currentTheme);

                            // 绑定点击切换
                            themeCards.forEach(function(card) {
                                card.addEventListener('click', function() {
                                    var theme = card.dataset.themeValue;
                                    if (window.AppTheme) {
                                        window.AppTheme.set(theme);
                                        updateUI(theme);
                                    }
                                });
                            });

                            // 监听主题变化（其他页面也可能触发）
                            window.addEventListener('themechange', function(e) {
                                updateUI(e.detail.theme);
                            });

                            // 所有逻辑完成后才标记为已绑定（放在末尾确保异常时允许重试）
                            themeCards[0].dataset.themeBound = '1';
                        }

                        // ========== AI生图配置 ==========
                        function initAiImageConfig() {
                            var apiUrlInput = document.getElementById('ai-image-api-url');
                            if (!apiUrlInput || apiUrlInput.dataset.bound) return;

                            // 先获取所有关键 DOM 元素，任何一个缺失则不初始化（允许下次重试）
                            var apiKeyInput = document.getElementById('ai-image-api-key');
                            var modelInput = document.getElementById('ai-image-model');
                            var timeoutInput = document.getElementById('ai-image-timeout');
                            var saveBtn = document.getElementById('ai-image-save-btn');
                            var testBtn = document.getElementById('ai-image-test-btn');
                            var toggleKeyBtn = document.getElementById('ai-image-toggle-key');
                            var testResult = document.getElementById('ai-image-test-result');
                            var statusBar = document.getElementById('ai-image-status-bar');
                            var statusText = document.getElementById('ai-image-status-text');

                            if (!saveBtn || !testBtn || !apiKeyInput || !statusBar || !statusText) {
                                console.warn('[AI Image Config] 关键 DOM 元素缺失，跳过初始化');
                                return; // 不设置 dataset.bound，允许 spa:ready 重试
                            }

                            // 构造 API 基础路径（兼容 SPA 和直接访问）
                            var API_BASE = (window.ROOT_URL || '') + 'api/image-gen';
                            if (!window.ROOT_URL) {
                                // 回退：基于当前页面推导
                                var base = window.PAGE_BASE || '';
                                var url = window.location.href.split('#')[0].split('?')[0];
                                url = url.substring(0, url.lastIndexOf('/'));
                                if (base) {
                                    var ups = (base.match(/\.\.\//g) || []).length;
                                    for (var i = 0; i < ups; i++) url = url.substring(0, url.lastIndexOf('/'));
                                }
                                API_BASE = url + '/api/image-gen';
                            }

                            function showStatusBar(type, msg) {
                                statusBar.classList.remove('hidden');
                                statusBar.classList.add('flex');
                                var styles = {
                                    success: 'bg-green-50 text-green-600 border-green-100',
                                    error: 'bg-red-50 text-red-600 border-red-100',
                                    info: 'bg-blue-50 text-blue-600 border-blue-100'
                                };
                                statusBar.className = 'flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium mb-4 border ' + (styles[type] || styles.info);
                                statusText.textContent = msg;
                            }

                            function showTestResult(type, msg) {
                                testResult.classList.remove('hidden');
                                testResult.classList.add('flex');
                                var styles = {
                                    success: 'bg-green-50 text-green-600 border-green-100',
                                    error: 'bg-red-50 text-red-600 border-red-100',
                                    testing: 'bg-amber-50 text-amber-600 border-amber-100'
                                };
                                var icons = { success: 'ph-check-circle', error: 'ph-x-circle', testing: 'ph-spinner-gap animate-spin' };
                                testResult.className = 'flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border ' + (styles[type] || styles.testing);
                                testResult.innerHTML = '<i class="ph ' + (icons[type] || icons.testing) + '"></i><span>' + msg + '</span>';
                            }

                            // 加载已有配置
                            function loadConfig() {
                                fetch(API_BASE + '/config')
                                    .then(function(r) { return r.json(); })
                                    .then(function(result) {
                                        if (result.success && result.data) {
                                            var cfg = result.data;
                                            apiUrlInput.value = cfg.apiUrl || '';
                                            modelInput.value = cfg.model || 'dall-e-3';
                                            timeoutInput.value = cfg.timeout || 90;
                                            if (cfg.apiKeyConfigured) {
                                                apiKeyInput.value = cfg.apiKeyMasked || '';
                                                apiKeyInput.dataset.hasKey = '1';
                                                showStatusBar('info', '已配置密钥: ' + cfg.apiKeyMasked + '，重新输入可覆盖');
                                            } else {
                                                showStatusBar('error', '尚未配置密钥，无限画布生图功能将不可用');
                                            }
                                        }
                                    })
                                    .catch(function() {
                                        showStatusBar('error', '无法连接后端服务，请确认服务器已启动');
                                    });
                            }

                            // 保存配置
                            saveBtn.addEventListener('click', function() {
                                var payload = {
                                    apiUrl: apiUrlInput.value.trim(),
                                    model: modelInput.value.trim(),
                                    timeout: parseInt(timeoutInput.value, 10) || 90
                                };
                                // 仅当用户输入了新密钥（非脱敏值）时才提交
                                var keyVal = apiKeyInput.value.trim();
                                if (keyVal && keyVal.indexOf('****') === -1) {
                                    payload.apiKey = keyVal;
                                }

                                saveBtn.disabled = true;
                                saveBtn.innerHTML = '<i class="ph ph-spinner-gap animate-spin"></i> 保存中...';

                                fetch(API_BASE + '/config', {
                                    method: 'PUT',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify(payload)
                                })
                                    .then(function(r) { return r.json(); })
                                    .then(function(result) {
                                        saveBtn.disabled = false;
                                        saveBtn.innerHTML = '<i class="ph ph-floppy-disk"></i> 保存配置';
                                        if (result.success) {
                                            showStatusBar('success', '配置已保存成功');
                                            loadConfig(); // 刷新状态
                                        } else {
                                            showStatusBar('error', result.error || '保存失败');
                                        }
                                    })
                                    .catch(function() {
                                        saveBtn.disabled = false;
                                        saveBtn.innerHTML = '<i class="ph ph-floppy-disk"></i> 保存配置';
                                        showStatusBar('error', '网络错误，保存失败');
                                    });
                            });

                            // 测试连接
                            testBtn.addEventListener('click', function() {
                                // 先保存当前配置再测试
                                var payload = {
                                    apiUrl: apiUrlInput.value.trim(),
                                    model: modelInput.value.trim(),
                                    timeout: parseInt(timeoutInput.value, 10) || 90
                                };
                                var keyVal = apiKeyInput.value.trim();
                                if (keyVal && keyVal.indexOf('****') === -1) {
                                    payload.apiKey = keyVal;
                                }

                                testBtn.disabled = true;
                                testBtn.innerHTML = '<i class="ph ph-spinner-gap animate-spin"></i> 测试中...';
                                showTestResult('testing', '正在连接...');

                                // 先保存
                                fetch(API_BASE + '/config', {
                                    method: 'PUT',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify(payload)
                                })
                                    .then(function() { return fetch(API_BASE + '/test', { method: 'POST' }); })
                                    .then(function(r) { return r.json(); })
                                    .then(function(result) {
                                        testBtn.disabled = false;
                                        testBtn.innerHTML = '<i class="ph ph-plug"></i> 测试连接';
                                        if (result.success) {
                                            showTestResult('success', result.data.message || '连接成功');
                                        } else {
                                            showTestResult('error', result.error || '连接失败');
                                        }
                                    })
                                    .catch(function() {
                                        testBtn.disabled = false;
                                        testBtn.innerHTML = '<i class="ph ph-plug"></i> 测试连接';
                                        showTestResult('error', '网络错误，无法连接后端服务');
                                    });
                            });

                            // 显示/隐藏密钥
                            toggleKeyBtn.addEventListener('click', function() {
                                if (apiKeyInput.type === 'password') {
                                    apiKeyInput.type = 'text';
                                    toggleKeyBtn.innerHTML = '<i class="ph ph-eye-slash text-sm"></i>';
                                } else {
                                    apiKeyInput.type = 'password';
                                    toggleKeyBtn.innerHTML = '<i class="ph ph-eye text-sm"></i>';
                                }
                            });

                            // 当用户修改密钥输入框时清除脱敏标记
                            apiKeyInput.addEventListener('input', function() {
                                if (apiKeyInput.dataset.hasKey && apiKeyInput.value.indexOf('****') === -1) {
                                    delete apiKeyInput.dataset.hasKey;
                                }
                            });

                            // 所有事件绑定成功后，标记为已绑定（放在末尾确保异常时允许重试）
                            apiUrlInput.dataset.bound = '1';

                            loadConfig();
                        }

                        // ========== Bug记录 ==========
                        function initBugReports() {
                            var root = document.getElementById('bug-reports');
                            if (!root || root.dataset.bugBound) return;

                            var API_ROOT = window.ROOT_URL || window.PAGE_BASE || '';
                            var titleInput = document.getElementById('bug-title');
                            var pageInput = document.getElementById('bug-page');
                            var severityInput = document.getElementById('bug-severity');
                            var descInput = document.getElementById('bug-description');
                            var filesInput = document.getElementById('bug-files-input');
                            var filesBtn = document.getElementById('bug-files-btn');
                            var selectedFilesBox = document.getElementById('bug-selected-files');
                            var submitBtn = document.getElementById('bug-submit-btn');
                            var resetBtn = document.getElementById('bug-reset-btn');
                            var refreshBtn = document.getElementById('bug-refresh-btn');
                            var copyBtn = document.getElementById('bug-copy-btn');
                            var exportBtn = document.getElementById('bug-export-btn');
                            var listBox = document.getElementById('bug-report-list');
                            var countEl = document.getElementById('bug-count');
                            var statusAlert = document.getElementById('bug-status-alert');

                            if (!titleInput || !filesInput || !submitBtn || !listBox || !statusAlert) return;

                            var selectedFiles = [];
                            var bugReportsCache = [];

                            function escapeHtml(text) {
                                return String(text == null ? '' : text)
                                    .replace(/&/g, '&amp;')
                                    .replace(/</g, '&lt;')
                                    .replace(/>/g, '&gt;')
                                    .replace(/"/g, '&quot;')
                                    .replace(/'/g, '&#39;');
                            }

                            function formatBytes(bytes) {
                                bytes = Number(bytes) || 0;
                                if (bytes < 1024) return bytes + ' B';
                                if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
                                return (bytes / 1024 / 1024).toFixed(1) + ' MB';
                            }

                            function formatTime(value) {
                                if (!value) return '--';
                                var d = new Date(value);
                                if (isNaN(d.getTime())) return '--';
                                return d.toLocaleString('zh-CN', { hour12: false }).replace(/\//g, '-');
                            }

                            function showBugStatus(type, message) {
                                var styles = {
                                    success: 'flex bg-green-50 text-green-600 border-green-100',
                                    error: 'flex bg-red-50 text-red-600 border-red-100',
                                    info: 'flex bg-blue-50 text-blue-600 border-blue-100'
                                };
                                var icons = { success: 'ph-check-circle', error: 'ph-warning-circle', info: 'ph-info' };
                                statusAlert.className = 'items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium mb-4 border ' + (styles[type] || styles.info);
                                statusAlert.innerHTML = '<i class="ph ' + (icons[type] || icons.info) + '"></i><span></span>';
                                var span = statusAlert.querySelector('span');
                                if (span) span.textContent = message || '';
                            }

                            function setButtonLoading(btn, loading, text) {
                                if (!btn) return;
                                if (!btn.dataset.defaultHtml) btn.dataset.defaultHtml = btn.innerHTML;
                                btn.disabled = loading;
                                btn.classList.toggle('opacity-70', loading);
                                btn.classList.toggle('cursor-not-allowed', loading);
                                btn.innerHTML = loading ? '<i class="ph ph-spinner-gap animate-spin"></i> ' + text : btn.dataset.defaultHtml;
                            }

                            function severityClass(value) {
                                var map = {
                                    '低': 'bg-gray-50 text-gray-500 border-gray-200',
                                    '中': 'bg-yellow-50 text-yellow-600 border-yellow-100',
                                    '高': 'bg-red-50 text-red-600 border-red-100',
                                    '阻塞': 'bg-purple-50 text-purple-600 border-purple-100'
                                };
                                return map[value] || map['中'];
                            }

                            function attachmentUrl(file) {
                                if (!file || !file.url) return '#';
                                if (/^https?:\/\//i.test(file.url) || file.url.indexOf('data:') === 0) return file.url;
                                return API_ROOT + file.url.replace(/^\//, '');
                            }

                            function isImage(file) {
                                return file && (file.mimetype || '').indexOf('image/') === 0;
                            }

                            function renderSelectedFiles() {
                                if (!selectedFiles.length) {
                                    selectedFilesBox.innerHTML = '<div class="text-xs text-gray-400 text-center py-2 border border-dashed border-gray-200 rounded-lg bg-white">暂无已选择附件</div>';
                                    return;
                                }
                                selectedFilesBox.innerHTML = selectedFiles.map(function (file, index) {
                                    return '<div class="flex items-center justify-between gap-3 rounded-lg border border-gray-100 bg-white px-3 py-2">' +
                                        '<div class="min-w-0 flex items-center gap-2">' +
                                        '<i class="ph ph-paperclip text-gray-400"></i>' +
                                        '<div class="min-w-0"><p class="text-xs text-gray-700 truncate">' + escapeHtml(file.name) + '</p>' +
                                        '<p class="text-[10px] text-gray-400">' + formatBytes(file.size) + '</p></div></div>' +
                                        '<button type="button" class="bug-remove-selected text-xs text-red-500 hover:underline flex-shrink-0" data-index="' + index + '">移除</button>' +
                                        '</div>';
                                }).join('');
                            }

                            function resetForm() {
                                titleInput.value = '';
                                pageInput.value = '';
                                severityInput.value = '中';
                                descInput.value = '';
                                selectedFiles = [];
                                filesInput.value = '';
                                renderSelectedFiles();
                            }

                            function uploadSelectedFiles() {
                                if (!selectedFiles.length) return Promise.resolve([]);
                                var formData = new FormData();
                                selectedFiles.forEach(function (file) {
                                    formData.append('files', file);
                                });
                                return fetch(API_ROOT + 'api/upload/multiple', {
                                    method: 'POST',
                                    body: formData
                                })
                                    .then(function (res) { return res.json(); })
                                    .then(function (result) {
                                        if (!result.success) throw new Error(result.error || '附件上传失败');
                                        return result.data || [];
                                    });
                            }

                            function loadBugReports() {
                                if (refreshBtn) refreshBtn.querySelector('i').classList.add('animate-spin');
                                return fetch(API_ROOT + 'api/bug-reports')
                                    .then(function (res) { return res.json(); })
                                    .then(function (result) {
                                        if (!result.success) throw new Error(result.error || '加载失败');
                                        bugReportsCache = result.data || [];
                                        renderBugReports(bugReportsCache);
                                    })
                                    .catch(function (err) {
                                        showBugStatus('error', err.message || '加载Bug记录失败');
                                        listBox.innerHTML = '<div class="py-10 text-center text-red-400 text-sm">加载Bug记录失败</div>';
                                    })
                                    .finally(function () {
                                        if (refreshBtn) refreshBtn.querySelector('i').classList.remove('animate-spin');
                                    });
                            }

                            function renderBugReports(list) {
                                if (countEl) countEl.textContent = (list.length || 0) + ' 条';
                                if (!list.length) {
                                    listBox.innerHTML = '<div class="py-10 text-center text-gray-400 text-sm border border-dashed border-gray-200 rounded-lg bg-gray-50/50"><i class="ph ph-bug text-2xl block mb-2 text-gray-300"></i>暂无Bug记录</div>';
                                    return;
                                }

                                listBox.innerHTML = list.map(function (item, index) {
                                    var attachments = item.attachments || [];
                                    var attachmentHtml = attachments.length ? '<div class="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">' + attachments.map(function (file) {
                                        var url = attachmentUrl(file);
                                        var preview = isImage(file)
                                            ? '<img src="' + escapeHtml(url) + '" class="w-10 h-10 rounded object-cover border border-gray-100 flex-shrink-0" alt="">'
                                            : '<div class="w-10 h-10 rounded bg-gray-50 border border-gray-100 flex items-center justify-center text-gray-400 flex-shrink-0"><i class="ph ph-file"></i></div>';
                                        return '<a href="' + escapeHtml(url) + '" target="_blank" class="flex items-center gap-2 rounded-lg border border-gray-100 bg-white px-2 py-2 hover:border-brand-100 hover:bg-brand-50/30 transition-colors min-w-0">' +
                                            preview +
                                            '<div class="min-w-0"><p class="text-xs text-gray-700 truncate">' + escapeHtml(file.originalName || file.filename || '附件') + '</p>' +
                                            '<p class="text-[10px] text-gray-400">' + formatBytes(file.size) + '</p></div></a>';
                                    }).join('') + '</div>' : '';

                                    var bg = index % 2 === 0 ? 'bg-gray-50/70' : 'bg-white';
                                    return '<div class="bug-report-item rounded-xl border border-gray-100 ' + bg + ' p-4" data-bug-id="' + escapeHtml(item.id) + '">' +
                                        '<div class="flex items-start justify-between gap-3">' +
                                        '<div class="min-w-0">' +
                                        '<div class="flex items-center gap-2 mb-1">' +
                                        '<h5 class="text-sm font-semibold text-gray-800 truncate">' + escapeHtml(item.title || '未命名Bug') + '</h5>' +
                                        '<span class="text-[10px] px-1.5 py-0.5 rounded border flex-shrink-0 ' + severityClass(item.severity) + '">' + escapeHtml(item.severity || '中') + '</span>' +
                                        '</div>' +
                                        '<p class="text-xs text-gray-400">' + escapeHtml(item.page || '未填写页面') + ' · ' + formatTime(item.createdAt) + '</p>' +
                                        '</div>' +
                                        '<button type="button" class="bug-delete-btn w-8 h-8 rounded-lg border border-gray-200 text-gray-400 hover:text-red-500 hover:bg-red-50 hover:border-red-100 transition-colors flex items-center justify-center flex-shrink-0" title="删除" data-bug-id="' + escapeHtml(item.id) + '"><i class="ph ph-trash"></i></button>' +
                                        '</div>' +
                                        (item.description ? '<p class="text-sm text-gray-600 leading-relaxed mt-3 whitespace-pre-wrap">' + escapeHtml(item.description) + '</p>' : '') +
                                        attachmentHtml +
                                        '</div>';
                                }).join('');
                            }

                            function formatBugReportsForCopy(list) {
                                if (!list || !list.length) return '';
                                return ['# Bug记录', ''].concat(list.map(function (item, index) {
                                    var lines = [
                                        '## ' + (index + 1) + '. ' + (item.title || '未命名Bug'),
                                        '',
                                        '- 严重程度：' + (item.severity || '中'),
                                        '- 所在页面：' + (item.page || '未填写'),
                                        '- 记录时间：' + formatTime(item.createdAt),
                                        '- 状态：' + (item.status || '待处理'),
                                        '',
                                        '描述：',
                                        item.description || '无'
                                    ];
                                    var attachments = item.attachments || [];
                                    if (attachments.length) {
                                        lines.push('', '附件：');
                                        attachments.forEach(function (file) {
                                            lines.push('- ' + (file.originalName || file.filename || '附件') + '：' + attachmentUrl(file));
                                        });
                                    }
                                    return lines.join('\n');
                                })).join('\n\n');
                            }

                            function copyBugReports() {
                                var text = formatBugReportsForCopy(bugReportsCache);
                                if (!text) {
                                    showBugStatus('info', '暂无可复制的Bug记录');
                                    return;
                                }
                                function done() { showBugStatus('success', 'Bug记录已复制，可直接粘贴用于后续修复'); }
                                if (navigator.clipboard && navigator.clipboard.writeText) {
                                    navigator.clipboard.writeText(text).then(done).catch(function () {
                                        fallbackCopyBugReports(text, done);
                                    });
                                } else {
                                    fallbackCopyBugReports(text, done);
                                }
                            }

                            function fallbackCopyBugReports(text, done) {
                                var input = document.createElement('textarea');
                                input.value = text;
                                input.className = 'fixed -left-[9999px] top-0';
                                document.body.appendChild(input);
                                input.focus();
                                input.select();
                                try {
                                    document.execCommand('copy');
                                    done();
                                } catch (err) {
                                    showBugStatus('error', '复制失败，请手动选择导出内容');
                                }
                                input.remove();
                            }

                            function exportBugReports() {
                                if (!bugReportsCache.length) {
                                    showBugStatus('info', '暂无可导出的Bug记录');
                                    return;
                                }
                                var blob = new Blob([JSON.stringify(bugReportsCache, null, 2)], { type: 'application/json;charset=utf-8' });
                                var url = URL.createObjectURL(blob);
                                var link = document.createElement('a');
                                link.href = url;
                                link.download = 'bug-reports-' + new Date().toISOString().slice(0, 10) + '.json';
                                document.body.appendChild(link);
                                link.click();
                                link.remove();
                                setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
                                showBugStatus('success', 'Bug记录已导出');
                            }

                            function submitBugReport() {
                                var title = titleInput.value.trim();
                                if (!title) {
                                    showBugStatus('error', '请填写 Bug 标题');
                                    titleInput.focus();
                                    return;
                                }
                                setButtonLoading(submitBtn, true, '保存中...');
                                uploadSelectedFiles()
                                    .then(function (attachments) {
                                        return fetch(API_ROOT + 'api/bug-reports', {
                                            method: 'POST',
                                            headers: { 'Content-Type': 'application/json' },
                                            body: JSON.stringify({
                                                title: title,
                                                page: pageInput.value.trim(),
                                                severity: severityInput.value,
                                                description: descInput.value.trim(),
                                                attachments: attachments
                                            })
                                        });
                                    })
                                    .then(function (res) { return res.json(); })
                                    .then(function (result) {
                                        if (!result.success) throw new Error(result.error || '保存失败');
                                        resetForm();
                                        showBugStatus('success', 'Bug记录已保存');
                                        return loadBugReports();
                                    })
                                    .catch(function (err) {
                                        showBugStatus('error', err.message || '保存失败');
                                    })
                                    .finally(function () {
                                        setButtonLoading(submitBtn, false);
                                    });
                            }

                            function deleteBugReport(id) {
                                if (!id) return;
                                if (!window.confirm('确定删除这条Bug记录吗？关联附件也会一并删除。')) return;
                                fetch(API_ROOT + 'api/bug-reports/' + encodeURIComponent(id), { method: 'DELETE' })
                                    .then(function (res) { return res.json(); })
                                    .then(function (result) {
                                        if (!result.success) throw new Error(result.error || '删除失败');
                                        showBugStatus('success', 'Bug记录已删除');
                                        return loadBugReports();
                                    })
                                    .catch(function (err) {
                                        showBugStatus('error', err.message || '删除失败');
                                    });
                            }

                            filesBtn.addEventListener('click', function () { filesInput.click(); });
                            filesInput.addEventListener('change', function () {
                                var files = Array.prototype.slice.call(filesInput.files || []);
                                selectedFiles = selectedFiles.concat(files).slice(0, 6);
                                renderSelectedFiles();
                                filesInput.value = '';
                            });
                            selectedFilesBox.addEventListener('click', function (e) {
                                var btn = e.target.closest('.bug-remove-selected');
                                if (!btn) return;
                                selectedFiles.splice(parseInt(btn.dataset.index, 10), 1);
                                renderSelectedFiles();
                            });
                            submitBtn.addEventListener('click', submitBugReport);
                            resetBtn.addEventListener('click', resetForm);
                            refreshBtn.addEventListener('click', loadBugReports);
                            if (copyBtn) copyBtn.addEventListener('click', copyBugReports);
                            if (exportBtn) exportBtn.addEventListener('click', exportBugReports);
                            listBox.addEventListener('click', function (e) {
                                var btn = e.target.closest('.bug-delete-btn');
                                if (!btn) return;
                                deleteBugReport(btn.dataset.bugId);
                            });

                            root.dataset.bugBound = '1';
                            renderSelectedFiles();
                            loadBugReports();
                        }

                        // ========== 本地数据备份 ==========
                        function initBackupManager() {
                            var root = document.getElementById('backup');
                            if (!root || root.dataset.backupBound) return;

                            var API_BASE = (window.ROOT_URL || window.PAGE_BASE || '') + 'api/settings';
                            var lastTimeEl = document.getElementById('backup-last-time');
                            var fileCountEl = document.getElementById('backup-file-count');
                            var totalSizeEl = document.getElementById('backup-total-size');
                            var historyList = document.getElementById('backup-history-list');
                            var statusAlert = document.getElementById('backup-status-alert');
                            var refreshBtn = document.getElementById('backup-refresh-btn');
                            var backupNowBtn = document.getElementById('backup-now-btn');
                            var exportBtn = document.getElementById('backup-export-btn');
                            var importBtn = document.getElementById('backup-import-btn');
                            var importInput = document.getElementById('backup-import-input');

                            if (!historyList || !backupNowBtn || !exportBtn || !importBtn || !importInput) return;

                            var FILE_LABELS = {
                                accounts: '账号管理',
                                bookmarks: '网址收藏',
                                customers: '客户管理',
                                memos: '备忘记录',
                                orders: '我的订单',
                                'platform-posts': '平台发布',
                                posters: '宣传海报',
                                projects: '项目管理',
                                quotes: '报价管理',
                                'bug-reports': 'Bug记录',
                                reminders: '日程提醒',
                                resume: '简历管理',
                                settings: '系统设置'
                            };

                            function escapeHtml(text) {
                                return String(text == null ? '' : text)
                                    .replace(/&/g, '&amp;')
                                    .replace(/</g, '&lt;')
                                    .replace(/>/g, '&gt;')
                                    .replace(/"/g, '&quot;')
                                    .replace(/'/g, '&#39;');
                            }

                            function fileLabel(fileName) {
                                return FILE_LABELS[fileName] || fileName;
                            }

                            function formatTime(value) {
                                if (!value) return '--';
                                var d = new Date(value);
                                if (isNaN(d.getTime())) return '--';
                                return d.toLocaleString('zh-CN', { hour12: false }).replace(/\//g, '-');
                            }

                            function formatBytes(bytes) {
                                bytes = Number(bytes) || 0;
                                if (bytes < 1024) return bytes + ' B';
                                if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
                                return (bytes / 1024 / 1024).toFixed(1) + ' MB';
                            }

                            function showBackupStatus(type, message) {
                                var styles = {
                                    success: 'flex bg-green-50 text-green-600 border-green-100',
                                    error: 'flex bg-red-50 text-red-600 border-red-100',
                                    info: 'flex bg-blue-50 text-blue-600 border-blue-100'
                                };
                                var icons = { success: 'ph-check-circle', error: 'ph-warning-circle', info: 'ph-info' };
                                statusAlert.className = 'items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium mb-4 border ' + (styles[type] || styles.info);
                                statusAlert.innerHTML = '<i class="ph ' + (icons[type] || icons.info) + '"></i><span>' + escapeHtml(message) + '</span>';
                            }

                            function requestJson(path, options) {
                                options = options || {};
                                var fetchOptions = Object.assign({ method: 'GET' }, options);
                                fetchOptions.headers = Object.assign({ 'Accept': 'application/json' }, fetchOptions.headers || {});
                                if (fetchOptions.body && typeof fetchOptions.body !== 'string') {
                                    fetchOptions.body = JSON.stringify(fetchOptions.body);
                                    fetchOptions.headers['Content-Type'] = 'application/json';
                                }
                                return fetch(API_BASE + path, fetchOptions)
                                    .then(function (res) { return res.json(); })
                                    .then(function (result) {
                                        if (!result.success) throw new Error(result.error || '请求失败');
                                        return result.data;
                                    });
                            }

                            function setButtonLoading(btn, loading, text) {
                                if (!btn) return;
                                if (!btn.dataset.defaultHtml) btn.dataset.defaultHtml = btn.innerHTML;
                                btn.disabled = loading;
                                btn.classList.toggle('opacity-70', loading);
                                btn.classList.toggle('cursor-not-allowed', loading);
                                if (loading) {
                                    btn.innerHTML = '<i class="ph ph-spinner-gap animate-spin"></i> ' + text;
                                } else {
                                    btn.innerHTML = btn.dataset.defaultHtml;
                                }
                            }

                            function flattenBackups(summary) {
                                var rows = [];
                                (summary.files || []).forEach(function (file) {
                                    (file.backups || []).forEach(function (backup) {
                                        rows.push(Object.assign({}, backup, {
                                            fileLabel: fileLabel(file.fileName)
                                        }));
                                    });
                                });
                                return rows.sort(function (a, b) {
                                    return String(b.createdAt).localeCompare(String(a.createdAt));
                                });
                            }

                            function renderBackupSummary(summary) {
                                lastTimeEl.textContent = formatTime(summary.latestBackupAt);
                                fileCountEl.textContent = summary.totalFiles || 0;
                                totalSizeEl.textContent = formatBytes(summary.totalSize);

                                var backups = flattenBackups(summary);
                                if (!backups.length) {
                                    historyList.innerHTML = [
                                        '<div class="py-10 text-center text-gray-400 text-sm border border-dashed border-gray-200 rounded-lg bg-gray-50/50">',
                                        '<i class="ph ph-database text-2xl block mb-2 text-gray-300"></i>',
                                        '暂无备份，点击“立即备份”创建第一份快照',
                                        '</div>'
                                    ].join('');
                                    return;
                                }

                                historyList.innerHTML = backups.map(function (backup, index) {
                                    var bg = index % 2 === 0 ? 'bg-gray-50/70' : 'bg-white';
                                    var downloadUrl = API_BASE + '/backups/' + encodeURIComponent(backup.fileName) + '/' + encodeURIComponent(backup.name);
                                    return [
                                        '<div class="flex flex-col md:flex-row md:items-center justify-between gap-3 p-3 rounded-lg border border-gray-100 hover:border-brand-100 transition-colors ' + bg + '">',
                                        '<div class="flex items-center gap-3 min-w-0">',
                                        '<div class="w-8 h-8 rounded-lg bg-green-50 text-green-500 flex items-center justify-center flex-shrink-0">',
                                        '<i class="ph-fill ph-check-circle text-lg"></i>',
                                        '</div>',
                                        '<div class="min-w-0">',
                                        '<p class="text-sm text-gray-800 truncate">' + escapeHtml(backup.fileLabel) + '</p>',
                                        '<p class="text-xs text-gray-400 truncate">' + escapeHtml(backup.name) + ' · ' + formatBytes(backup.size) + ' · ' + (backup.itemCount || 0) + ' 条</p>',
                                        '</div>',
                                        '</div>',
                                        '<div class="flex items-center gap-3 flex-wrap md:flex-nowrap md:justify-end">',
                                        '<span class="text-xs text-gray-400">' + formatTime(backup.createdAt) + '</span>',
                                        '<a class="text-xs text-brand-600 hover:underline" href="' + downloadUrl + '" download="' + escapeHtml(backup.name) + '">下载</a>',
                                        '<button class="text-xs text-red-500 hover:underline" data-restore-backup="' + escapeHtml(backup.name) + '" data-file-name="' + escapeHtml(backup.fileName) + '" data-file-label="' + escapeHtml(backup.fileLabel) + '">恢复</button>',
                                        '</div>',
                                        '</div>'
                                    ].join('');
                                }).join('');
                            }

                            function loadBackups() {
                                if (refreshBtn) refreshBtn.querySelector('i').classList.add('animate-spin');
                                return requestJson('/backups')
                                    .then(function (summary) {
                                        renderBackupSummary(summary);
                                    })
                                    .catch(function (err) {
                                        showBackupStatus('error', err.message || '加载备份状态失败');
                                        historyList.innerHTML = '<div class="py-8 text-center text-red-400 text-sm">加载备份历史失败</div>';
                                    })
                                    .finally(function () {
                                        if (refreshBtn) refreshBtn.querySelector('i').classList.remove('animate-spin');
                                    });
                            }

                            function downloadJson(data, fileName) {
                                var blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json;charset=utf-8' });
                                var url = URL.createObjectURL(blob);
                                var link = document.createElement('a');
                                link.href = url;
                                link.download = fileName;
                                document.body.appendChild(link);
                                link.click();
                                document.body.removeChild(link);
                                URL.revokeObjectURL(url);
                            }

                            backupNowBtn.addEventListener('click', function () {
                                setButtonLoading(backupNowBtn, true, '备份中...');
                                requestJson('/backups', { method: 'POST' })
                                    .then(function (data) {
                                        renderBackupSummary(data.summary);
                                        showBackupStatus('success', '已创建 ' + data.count + ' 份本地数据快照');
                                    })
                                    .catch(function (err) {
                                        showBackupStatus('error', err.message || '备份失败');
                                    })
                                    .finally(function () {
                                        setButtonLoading(backupNowBtn, false);
                                    });
                            });

                            exportBtn.addEventListener('click', function () {
                                setButtonLoading(exportBtn, true, '生成中...');
                                requestJson('/backup', { method: 'POST' })
                                    .then(function (data) {
                                        var stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
                                        downloadJson(data, 'workspace-backup-' + stamp + '.json');
                                        showBackupStatus('success', '当前数据已打包下载');
                                        return loadBackups();
                                    })
                                    .catch(function (err) {
                                        showBackupStatus('error', err.message || '下载当前数据失败');
                                    })
                                    .finally(function () {
                                        setButtonLoading(exportBtn, false);
                                    });
                            });

                            importBtn.addEventListener('click', function () {
                                importInput.click();
                            });

                            importInput.addEventListener('change', function () {
                                var file = importInput.files && importInput.files[0];
                                if (!file) return;
                                var reader = new FileReader();
                                reader.onload = function () {
                                    try {
                                        var data = JSON.parse(reader.result);
                                        if (!data || !data._meta) throw new Error('备份文件格式不正确');
                                        if (!window.confirm('确定导入这个整包备份吗？当前同名数据文件会先自动留下恢复前快照。')) {
                                            importInput.value = '';
                                            return;
                                        }
                                        setButtonLoading(importBtn, true, '导入中...');
                                        requestJson('/restore', { method: 'POST', body: data })
                                            .then(function (result) {
                                                showBackupStatus('success', '已恢复 ' + result.count + ' 个数据文件');
                                                return loadBackups();
                                            })
                                            .catch(function (err) {
                                                showBackupStatus('error', err.message || '导入失败');
                                            })
                                            .finally(function () {
                                                setButtonLoading(importBtn, false);
                                                importInput.value = '';
                                            });
                                    } catch (err) {
                                        showBackupStatus('error', err.message || '无法读取备份文件');
                                        importInput.value = '';
                                    }
                                };
                                reader.readAsText(file, 'utf-8');
                            });

                            historyList.addEventListener('click', function (e) {
                                var btn = e.target.closest('[data-restore-backup]');
                                if (!btn) return;
                                var fileName = btn.dataset.fileName;
                                var backupName = btn.dataset.restoreBackup;
                                var label = btn.dataset.fileLabel || fileName;
                                if (!window.confirm('确定将“' + label + '”恢复到这份备份吗？当前数据会先自动留下恢复前快照。')) return;

                                btn.disabled = true;
                                btn.textContent = '恢复中...';
                                requestJson('/backups/' + encodeURIComponent(fileName) + '/' + encodeURIComponent(backupName) + '/restore', { method: 'POST' })
                                    .then(function (data) {
                                        renderBackupSummary(data.summary);
                                        showBackupStatus('success', label + ' 已恢复');
                                    })
                                    .catch(function (err) {
                                        showBackupStatus('error', err.message || '恢复失败');
                                        btn.disabled = false;
                                        btn.textContent = '恢复';
                                    });
                            });

                            if (refreshBtn) {
                                refreshBtn.addEventListener('click', loadBackups);
                            }

                            root.dataset.backupBound = '1';
                            loadBackups();
                        }

                        // ========== 统一初始化入口 ==========
                        // 用 try-catch 包裹每个 init 函数，防止一个崩溃影响其他
                        function initSettingsPage() {
                            try { initSettingsNav(); } catch(e) { console.error('[Settings] initSettingsNav failed:', e); }
                            try { initAccountProfile(); } catch(e) { console.error('[Settings] initAccountProfile failed:', e); }
                            try { initThemeSwitcher(); } catch(e) { console.error('[Settings] initThemeSwitcher failed:', e); }
                            try { initAiImageConfig(); } catch(e) { console.error('[Settings] initAiImageConfig failed:', e); }
                            try { initBugReports(); } catch(e) { console.error('[Settings] initBugReports failed:', e); }
                            try { initBackupManager(); } catch(e) { console.error('[Settings] initBackupManager failed:', e); }
                        }

                        // 防止 spa:ready 监听器重复注册（每次 SPA 导航到设置页都会执行这段脚本）
                        // 旧的监听器引用旧 DOM 元素，不仅无用还会导致 N 次进入设置页触发 N 次
                        if (window.__settingsSpaReadyHandler) {
                            window.removeEventListener('spa:ready', window.__settingsSpaReadyHandler);
                        }
                        window.__settingsSpaReadyHandler = function(e) {
                            var page = (e.detail && e.detail.page) || '';
                            if (page && page.indexOf('settings') === -1) return;
                            initSettingsPage();
                        };
                        window.addEventListener('spa:ready', window.__settingsSpaReadyHandler);

                        // 兼容直接访问（非 SPA）和 SPA 导航
                        // SPA 模式下 document.readyState 已是 'complete'，直接调用
                        // 直接访问时 readyState 为 'loading'，等待 DOMContentLoaded
                        if (document.readyState === 'loading') {
                            document.addEventListener('DOMContentLoaded', initSettingsPage);
                        } else {
                            initSettingsPage();
                        }
                    
                /* ==================== 原始脚本结束 ==================== */
            } finally {
                document.addEventListener = _docAdd;
                window.addEventListener = _winAdd;
            }
        }
    });

})(typeof window !== 'undefined' ? window : this);
