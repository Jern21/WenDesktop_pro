/**
 * 项目编辑表单。参数是项目 id，空值表示新建。
 * 模板仍从 pages/content/project-form.html 读取，失败时用内联兜底。
 */
(function (P) {
    'use strict';
    P.form = P.form || {};
        function computeRootUrl() {
            var base = window.PAGE_BASE || '';
            var url = window.location.href.split('#')[0].split('?')[0];
            url = url.substring(0, url.lastIndexOf('/'));
            if (base) {
                var ups = (base.match(/\.\.\//g) || []).length;
                for (var i = 0; i < ups; i++) {
                    url = url.substring(0, url.lastIndexOf('/'));
                }
            }
            return url + '/';
        }

        P.form.open = function(projectId) {
            // 移除已有模态框
            var existing = document.getElementById('pf-modal');
            if (existing) existing.remove();

            var isNew = !projectId; // projectId 为空表示新建
            var data = P.get(projectId);
            var rootUrl = computeRootUrl();
            var formUrl = rootUrl + 'pages/content/project-form.html';

            fetch(formUrl)
                .then(function (resp) { return resp.text(); })
                .then(function (html) {
                    var parser = new DOMParser();
                    var doc = parser.parseFromString(html, 'text/html');
                    var panel = doc.getElementById('project-form-panel');
                    if (!panel) { buildFormFallback(projectId, data); return; }

                    var panelHTML = panel.outerHTML;

                    var modal = document.createElement('div');
                    modal.id = 'pf-modal';
                    modal.className = 'pf-modal-overlay';
                    modal.innerHTML = '<div class="absolute inset-0"></div>' + panelHTML;

                    var panelEl = modal.querySelector('#project-form-panel');
                    if (panelEl) {
                        panelEl.classList.add('z-10', 'pf-modal-panel');
                    }

                    document.body.appendChild(modal);
                    document.body.style.overflow = 'hidden';

                    // 触发淡入 + 滑入动画
                    requestAnimationFrame(function () {
                        modal.classList.add('show');
                    });

                    // 填充表单数据
                    fillFormData(modal, projectId, data);

                    // 绑定事件
                    bindFormEvents(modal, projectId);
                })
                .catch(function () {
                    buildFormFallback(projectId, data);
                });
        }

        // ========== Nginx 配置动态增删辅助函数 ==========
        function addNginxEntryToModal(modal, name, config) {
            var nginxList = modal.querySelector('#pf-nginx-list');
            if (!nginxList) return;
            var wrapper = document.createElement('div');
            wrapper.className = 'pf-nginx-item rounded-lg border border-gray-200 overflow-hidden';
            var header = document.createElement('div');
            header.className = 'flex items-center gap-2 px-3 py-2 bg-gray-50 border-b border-gray-100';
            var nameInput = document.createElement('input');
            nameInput.type = 'text';
            nameInput.className = 'pf-nginx-name pf-form-input text-xs py-1 flex-1';
            nameInput.placeholder = '配置名称（如：前端服务）';
            nameInput.value = name || '';
            var delBtn = document.createElement('button');
            delBtn.type = 'button';
            delBtn.className = 'pf-nginx-del w-7 h-7 rounded text-gray-400 hover:text-red-500 hover:bg-red-50 transition flex items-center justify-center shrink-0';
            delBtn.title = '删除';
            delBtn.innerHTML = '<i class="ph ph-trash text-sm"></i>';
            header.appendChild(nameInput);
            header.appendChild(delBtn);
            var configArea = document.createElement('textarea');
            configArea.className = 'pf-nginx-config pf-form-input rounded-none border-0';
            configArea.rows = 4;
            configArea.placeholder = '粘贴 Nginx 配置内容...';
            configArea.style.cssText = 'resize:vertical;font-family:monospace;font-size:0.8rem;';
            configArea.value = config || '';
            wrapper.appendChild(header);
            wrapper.appendChild(configArea);
            bindNginxDelete(wrapper);
            nginxList.appendChild(wrapper);
        }

        function bindNginxDelete(item) {
            var delBtn = item.querySelector('.pf-nginx-del');
            if (delBtn) {
                delBtn.addEventListener('click', function () {
                    item.remove();
                });
            }
        }

        function collectNginxConfigs(modal) {
            var items = modal.querySelectorAll('.pf-nginx-item');
            var result = [];
            for (var i = 0; i < items.length; i++) {
                var nameEl = items[i].querySelector('.pf-nginx-name');
                var configEl = items[i].querySelector('.pf-nginx-config');
                var name = nameEl ? nameEl.value.trim() : '';
                var config = configEl ? configEl.value : '';
                // 跳过完全空的项
                if (!name && !config.trim()) continue;
                result.push({ name: name, config: config });
            }
            return result;
        }

        function fillFormData(modal, projectId, data) {
            function setVal(id, val) { var el = modal.querySelector('#' + id); if (el) el.value = val; }
            function setSelect(id, val) {
                var sel = modal.querySelector('#' + id);
                if (!sel) return;
                for (var i = 0; i < sel.options.length; i++) {
                    if (sel.options[i].value === val) { sel.selectedIndex = i; return; }
                }
            }

            // 标题
            var title = modal.querySelector('#pf-title');
            var subtitle = modal.querySelector('#pf-subtitle');
            var isNew = !projectId;
            if (title) title.textContent = isNew ? '新建项目' : '编辑项目';
            if (subtitle) subtitle.textContent = isNew ? '填写项目信息与存放地址' : (data.name || '');

            setVal('pf-name', isNew ? '' : (data.name || ''));
            setVal('pf-code', data.code);
            setSelect('pf-status', data.status);
            setSelect('pf-priority', data.priority || '中');
            setSelect('pf-type', data.type);
            setSelect('pf-scope', data.scope);
            setVal('pf-deadline', data.deadline);
            setVal('pf-amount', data.amount);
            setVal('pf-progress', data.progress);
            setVal('pf-desc', data.desc);
            setVal('pf-local-path', data.localPath);
            setVal('pf-cloud-path', data.cloudPath);
            setSelect('pf-cloud-type', data.cloudType);
            setVal('pf-customer', data.customer);
            setVal('pf-tags', data.tags);
            setVal('pf-notes', data.notes);

            // 进度显示
            var progVal = modal.querySelector('#pf-progress-val');
            if (progVal) progVal.textContent = data.progress + '%';

            // 云端开关
            var cloudToggle = modal.querySelector('#pf-cloud-enabled');
            var cloudSection = modal.querySelector('#pf-cloud-section');
            if (cloudToggle) cloudToggle.checked = data.cloudEnabled;
            if (cloudSection) {
                if (data.cloudEnabled) cloudSection.classList.remove('hidden');
                else cloudSection.classList.add('hidden');
            }

            // 服务器配置
            var serverToggle = modal.querySelector('#pf-server-enabled');
            var serverSection = modal.querySelector('#pf-server-section');
            if (serverToggle) serverToggle.checked = !!data.serverEnabled;
            if (serverSection) {
                if (data.serverEnabled) serverSection.classList.remove('hidden');
                else serverSection.classList.add('hidden');
            }
            setVal('pf-server-addr', data.serverAddr || '');
            setVal('pf-server-spec', data.serverSpec || '');

            // Nginx 配置列表
            var nginxList = modal.querySelector('#pf-nginx-list');
            if (nginxList) {
                nginxList.innerHTML = '';
                var configs = data.nginxConfigs || [];
                if (configs.length === 0) configs = [{ name: '', config: '' }];
                for (var i = 0; i < configs.length; i++) {
                    addNginxEntryToModal(modal, configs[i].name || '', configs[i].config || '');
                }
            }
        }

        function bindFormEvents(modal, projectId) {
            function closeModal() {
                modal.classList.remove('show');
                setTimeout(function () {
                    modal.remove();
                    document.body.style.overflow = '';
                }, 300);
            }

            // 关闭/取消
            var closeBtn = modal.querySelector('#pf-close');
            var cancelBtn = modal.querySelector('#pf-cancel');
            if (closeBtn) closeBtn.addEventListener('click', closeModal);
            if (cancelBtn) cancelBtn.addEventListener('click', closeModal);

            // 点击遮罩关闭
            modal.addEventListener('click', function (e) {
                if (!e.target.closest('#project-form-panel')) closeModal();
            });

            // ESC 关闭
            document.addEventListener('keydown', function esc(e) {
                if (e.key === 'Escape' && document.getElementById('pf-modal')) {
                    document.removeEventListener('keydown', esc);
                    closeModal();
                }
            });

            // 进度滑块
            var progInput = modal.querySelector('#pf-progress');
            var progVal = modal.querySelector('#pf-progress-val');
            if (progInput && progVal) {
                progInput.addEventListener('input', function () {
                    progVal.textContent = this.value + '%';
                });
            }

            // 云端开关联动
            var cloudToggle = modal.querySelector('#pf-cloud-enabled');
            var cloudSection = modal.querySelector('#pf-cloud-section');
            if (cloudToggle && cloudSection) {
                cloudToggle.addEventListener('change', function () {
                    if (this.checked) cloudSection.classList.remove('hidden');
                    else cloudSection.classList.add('hidden');
                });
            }

            // 服务器开关联动
            var serverToggle = modal.querySelector('#pf-server-enabled');
            var serverSection = modal.querySelector('#pf-server-section');
            if (serverToggle && serverSection) {
                serverToggle.addEventListener('change', function () {
                    if (this.checked) serverSection.classList.remove('hidden');
                    else serverSection.classList.add('hidden');
                });
            }

            // Nginx 配置动态增删
            var nginxList = modal.querySelector('#pf-nginx-list');
            var nginxAddBtn = modal.querySelector('#pf-nginx-add');
            if (nginxAddBtn) {
                nginxAddBtn.addEventListener('click', function () {
                    addNginxEntryToModal(modal, '', '');
                });
            }
            // 绑定已有项的删除按钮
            var nginxItems = modal.querySelectorAll('.pf-nginx-item');
            for (var ni = 0; ni < nginxItems.length; ni++) {
                bindNginxDelete(nginxItems[ni]);
            }

            // 浏览文件夹
            var browseBtn = modal.querySelector('#pf-browse');
            var localPathInput = modal.querySelector('#pf-local-path');
            var localPathHint = modal.querySelector('#pf-local-path-hint');
            if (browseBtn && localPathInput) {
                browseBtn.addEventListener('click', function () {
                    if (localPathHint) localPathHint.classList.remove('hidden');
                    if (!localPathInput.value) {
                        localPathInput.value = 'D:\\Projects\\' + (data.name || '新项目');
                    }
                    P.toast('请输入或粘贴本地文件夹路径', 'ph ph-info', '#60a5fa');
                });
            }

            // 复制云端地址
            var cloudCopyBtn = modal.querySelector('#pf-cloud-copy');
            var cloudPathInput = modal.querySelector('#pf-cloud-path');
            if (cloudCopyBtn && cloudPathInput) {
                cloudCopyBtn.addEventListener('click', function () {
                    var val = cloudPathInput.value.trim();
                    if (val) {
                        P.copy(val);
                        P.toast('云端地址已复制', 'ph-fill ph-check-circle', '#4ade80');
                    } else {
                        P.toast('请先填写云端地址', 'ph ph-warning', '#fbbf24');
                    }
                });
            }

            // 保存
            var saveBtn = modal.querySelector('#pf-save');
            if (saveBtn) {
                saveBtn.addEventListener('click', function () {
                    var nameEl = modal.querySelector('#pf-name');
                    var name = nameEl ? nameEl.value.trim() : '';
                    if (!name) { P.toast('请输入项目名称', 'ph ph-warning', '#fbbf24'); return; }

                    // 收集表单数据
                    var updated = {
                        name: name,
                        code: (modal.querySelector('#pf-code') || {}).value || '',
                        status: (modal.querySelector('#pf-status') || {}).value || '',
                        priority: (modal.querySelector('#pf-priority') || {}).value || '',
                        type: (modal.querySelector('#pf-type') || {}).value || '',
                        scope: (modal.querySelector('#pf-scope') || {}).value || '',
                        deadline: (modal.querySelector('#pf-deadline') || {}).value || '',
                        amount: (modal.querySelector('#pf-amount') || {}).value || '',
                        progress: parseInt((modal.querySelector('#pf-progress') || {}).value) || 0,
                        desc: (modal.querySelector('#pf-desc') || {}).value || '',
                        customer: (modal.querySelector('#pf-customer') || {}).value || '',
                        tags: (modal.querySelector('#pf-tags') || {}).value || '',
                        notes: (modal.querySelector('#pf-notes') || {}).value || '',
                        localPath: (modal.querySelector('#pf-local-path') || {}).value || '',
                        cloudEnabled: (modal.querySelector('#pf-cloud-enabled') || {}).checked || false,
                        cloudPath: (modal.querySelector('#pf-cloud-path') || {}).value || '',
                        cloudType: (modal.querySelector('#pf-cloud-type') || {}).value || 'baidu',
                        serverEnabled: (modal.querySelector('#pf-server-enabled') || {}).checked || false,
                        serverAddr: (modal.querySelector('#pf-server-addr') || {}).value || '',
                        serverSpec: (modal.querySelector('#pf-server-spec') || {}).value || '',
                        nginxConfigs: collectNginxConfigs(modal)
                    };

                    var isEdit = !!projectId && !!data.id;
                    var editId = data.id;

                    P.toast('正在保存...', 'ph ph-spinner', '#60a5fa');
                    saveBtn.disabled = true;

                    P.api.save(updated, isEdit, editId).then(function (res) {
                        saveBtn.disabled = false;
                        if (!res.success) {
                            P.toast('保存失败：' + (res.error || ''), 'ph ph-warning', '#fbbf24');
                            return;
                        }
                        P.toast('项目信息已保存', 'ph-fill ph-check-circle', '#4ade80');
                        closeModal();

                        // 重新从 API 加载数据并渲染
                        P.load().then(function () {
                            // 如果详情面板打开，刷新内容
                            if (P.state.detailId) {
                                P.detail.show(P.state.detailId);
                            }
                        });
                    }).catch(function (err) {
                        saveBtn.disabled = false;
                        console.error('[Project] 保存失败:', err);
                        P.toast('保存失败，请检查网络', 'ph ph-warning', '#fbbf24');
                    });
                });
            }
        }

        // fetch 失败时的内联表单（降级方案）
        function buildFormFallback(projectId, data) {
            var isNew = !projectId;
            var titleText = isNew ? '新建项目' : '编辑项目';
            var subtitleText = isNew ? '填写项目信息与存放地址' : (data.name || '');
            var modal = document.createElement('div');
            modal.id = 'pf-modal';
            modal.className = 'pf-modal-overlay';
            modal.innerHTML = [
                '<div class="absolute inset-0 bg-black/20"></div>',
                '<div class="relative pf-modal-panel z-10">',
                '  <div class="flex justify-between items-center px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white shrink-0">',
                '    <div class="flex items-center gap-3">',
                '      <div class="w-10 h-10 rounded-lg bg-brand-50 text-brand-600 flex items-center justify-center"><i class="ph-fill ph-folder-open text-xl"></i></div>',
                '      <div><h3 class="font-semibold text-gray-800 text-base">' + titleText + '</h3><p class="text-xs text-gray-400 mt-0.5">' + subtitleText + '</p></div>',
                '    </div>',
                '    <button id="pf-close" class="w-8 h-8 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition flex items-center justify-center"><i class="ph ph-x text-lg"></i></button>',
                '  </div>',
                '  <div class="px-6 py-5 space-y-5 flex-1 overflow-y-auto">',
                '    <div><label class="pf-form-label">本地存放地址</label><input type="text" id="pf-local-path" class="pf-form-input" value="' + (data.localPath || '') + '" placeholder="如：D:\\Projects\\项目名"></div>',
                '    <div class="flex items-center gap-3 p-3 rounded-lg border border-gray-100 bg-gray-50/50">',
                '      <span class="text-sm font-medium text-gray-700">云端备份存放</span>',
                '      <label class="pf-toggle-switch"><input type="checkbox" id="pf-cloud-enabled"' + (data.cloudEnabled ? ' checked' : '') + '><span class="pf-toggle-slider"></span></label>',
                '    </div>',
                '    <div id="pf-cloud-section"' + (data.cloudEnabled ? '' : ' class="hidden"') + '>',
                '      <label class="pf-form-label">云端存放地址</label>',
                '      <input type="text" id="pf-cloud-path" class="pf-form-input" value="' + (data.cloudPath || '') + '" placeholder="云端链接地址">',
                '    </div>',
                '    <div class="flex items-center gap-3 p-3 rounded-lg border border-gray-100 bg-gray-50/50">',
                '      <span class="text-sm font-medium text-gray-700">已购买服务器</span>',
                '      <label class="pf-toggle-switch"><input type="checkbox" id="pf-server-enabled"' + (data.serverEnabled ? ' checked' : '') + '><span class="pf-toggle-slider"></span></label>',
                '    </div>',
                '    <div id="pf-server-section"' + (data.serverEnabled ? '' : ' class="hidden"') + '>',
                '      <div class="mb-3"><label class="pf-form-label">服务器地址</label><input type="text" id="pf-server-addr" class="pf-form-input" value="' + (data.serverAddr || '') + '" placeholder="如：192.168.1.100"></div>',
                '      <div class="mb-3"><label class="pf-form-label">服务器配置（账号密码等）</label><textarea id="pf-server-spec" rows="3" class="pf-form-input" placeholder="记录服务器账号、密码等..." style="resize:vertical;">' + (data.serverSpec || '') + '</textarea></div>',
                '      <div><label class="pf-form-label">Nginx 配置</label><div id="pf-nginx-list" class="space-y-3"></div><button type="button" id="pf-nginx-add" class="mt-2 text-xs text-brand-600 hover:text-brand-700 flex items-center gap-1 transition"><i class="ph ph-plus"></i> 添加配置</button></div>',
                '    </div>',
                '  </div>',
                '  <div class="flex justify-end gap-3 px-6 py-4 border-t border-gray-100 bg-gray-50/50 shrink-0">',
                '    <button id="pf-cancel" class="px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition">取消</button>',
                '    <button id="pf-save" class="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-sm font-medium transition">保存</button>',
                '  </div>',
                '</div>'
            ].join('');
            document.body.appendChild(modal);
            document.body.style.overflow = 'hidden';

            requestAnimationFrame(function () { modal.classList.add('show'); });

            function closeModal() { modal.classList.remove('show'); setTimeout(function () { modal.remove(); document.body.style.overflow = ''; }, 300); }
            modal.querySelector('#pf-close').addEventListener('click', closeModal);
            modal.querySelector('#pf-cancel').addEventListener('click', closeModal);
            modal.addEventListener('click', function (e) { if (!e.target.closest('.pf-modal-panel')) closeModal(); });
            var cloudToggle = modal.querySelector('#pf-cloud-enabled');
            var cloudSection = modal.querySelector('#pf-cloud-section');
            if (cloudToggle && cloudSection) {
                cloudToggle.addEventListener('change', function () {
                    if (this.checked) cloudSection.classList.remove('hidden');
                    else cloudSection.classList.add('hidden');
                });
            }
            var serverToggle = modal.querySelector('#pf-server-enabled');
            var serverSection = modal.querySelector('#pf-server-section');
            if (serverToggle && serverSection) {
                serverToggle.addEventListener('change', function () {
                    if (this.checked) serverSection.classList.remove('hidden');
                    else serverSection.classList.add('hidden');
                });
            }
            // Nginx 动态增删（降级表单）
            var nginxAddBtn = modal.querySelector('#pf-nginx-add');
            if (nginxAddBtn) {
                nginxAddBtn.addEventListener('click', function () {
                    addNginxEntryToModal(modal, '', '');
                });
            }
            var initConfigs = data.nginxConfigs || [];
            if (initConfigs.length === 0) initConfigs = [{ name: '', config: '' }];
            for (var ci = 0; ci < initConfigs.length; ci++) {
                addNginxEntryToModal(modal, initConfigs[ci].name || '', initConfigs[ci].config || '');
            }
            modal.querySelector('#pf-save').addEventListener('click', function () {
                var localPath = modal.querySelector('#pf-local-path').value;
                var cloudEnabled = modal.querySelector('#pf-cloud-enabled').checked;
                var cloudPath = modal.querySelector('#pf-cloud-path').value;
                var serverEnabled = modal.querySelector('#pf-server-enabled').checked;
                var serverAddr = modal.querySelector('#pf-server-addr').value;
                var serverSpec = modal.querySelector('#pf-server-spec').value;
                var nginxConfigs = collectNginxConfigs(modal);

                var updated = Object.assign({}, data, {
                    localPath: localPath,
                    cloudEnabled: cloudEnabled,
                    cloudPath: cloudPath,
                    serverEnabled: serverEnabled,
                    serverAddr: serverAddr,
                    serverSpec: serverSpec,
                    nginxConfigs: nginxConfigs
                });

                var isEdit = !!projectId && !!data.id;
                var editId = data.id;

                P.toast('正在保存...', 'ph ph-spinner', '#60a5fa');
                P.api.save(updated, isEdit, editId).then(function (res) {
                    if (!res.success) {
                        P.toast('保存失败：' + (res.error || ''), 'ph ph-warning', '#fbbf24');
                        return;
                    }
                    P.toast('项目信息已保存', 'ph-fill ph-check-circle', '#4ade80');
                    closeModal();
                    P.load();
                }).catch(function (err) {
                    console.error('[Project] 保存失败:', err);
                    P.toast('保存失败，请检查网络', 'ph ph-warning', '#fbbf24');
                });
            });
        }
})(window.ProjectPage);
