/**
 * 项目详情抽屉。current 存的是项目 id。
 */
(function (P) {
    'use strict';
    P.detail = P.detail || {};
    var CLOUD_TYPE_NAMES = {
        baidu: '百度网盘', aliyun: '阿里云盘', github: 'GitHub', gitee: 'Gitee', onedrive: 'OneDrive', other: '其他'
    };
    var STATUS_BADGE_CLASS = {
        '待确认需求': 'pd-status-gray', '开发/设计中': 'pd-status-green', '待验收': 'pd-status-blue', '已完成': 'pd-status-purple', '已关闭': 'pd-status-gray'
    };
        P.detail.show = function(projectId) {
            var drawer = document.getElementById('proj-detail-drawer');
            if (!drawer) return;

            var data = P.get(projectId);
            P.state.detailId = projectId;

            // 填充内容
            setText('pd-name', data.name || '');
            setText('pd-code', data.code || '无编号');
            setText('pd-desc', data.desc || '暂无描述');
            setText('pd-type', data.type || '—');
            setText('pd-scope', data.scope === 'personal' ? '个人项目' : '企业项目');
            setText('pd-deadline', data.deadline || '—');
            setText('pd-amount', data.amount ? '¥ ' + Number(data.amount).toLocaleString() : '—');
            setText('pd-customer', data.customer || '—');
            setText('pd-notes', data.notes || '—');

            // 状态标签
            var statusBadge = drawer.querySelector('#pd-status-badge');
            if (statusBadge) {
                statusBadge.textContent = data.status || '待确认需求';
                statusBadge.className = 'text-[10px] py-0.5 px-1.5 rounded font-medium ' + (STATUS_BADGE_CLASS[data.status] || 'pd-status-gray');
            }
            // 优先级标签
            var priBadge = drawer.querySelector('#pd-priority-badge');
            if (priBadge) {
                var pri = data.priority || '';
                if (pri === '高') { priBadge.textContent = '高优先级'; priBadge.className = 'text-[10px] py-0.5 px-1.5 rounded font-medium pd-priority-high'; }
                else if (pri === '中') { priBadge.textContent = '中优先级'; priBadge.className = 'text-[10px] py-0.5 px-1.5 rounded font-medium pd-priority-mid'; }
                else if (pri === '低') { priBadge.textContent = '低优先级'; priBadge.className = 'text-[10px] py-0.5 px-1.5 rounded font-medium pd-priority-low'; }
                else { priBadge.textContent = '无优先级'; priBadge.className = 'text-[10px] py-0.5 px-1.5 rounded font-medium pd-status-gray'; }
            }

            // 进度
            var progVal = drawer.querySelector('#pd-progress-val');
            var progBar = drawer.querySelector('#pd-progress-bar');
            if (progVal) progVal.textContent = data.progress || 0;
            if (progBar) progBar.style.width = (data.progress || 0) + '%';

            // 标签
            var tagsEl = drawer.querySelector('#pd-tags');
            if (tagsEl) {
                if (data.tags) {
                    var tags = data.tags.split(/[,，]/).filter(function (t) { return t.trim(); });
                    tagsEl.innerHTML = tags.map(function (t) {
                        return '<span class="text-[10px] text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">' + t.trim() + '</span>';
                    }).join('');
                } else {
                    tagsEl.innerHTML = '<span class="text-sm text-gray-400">—</span>';
                }
            }

            // 本地路径
            setText('pd-local-path', data.localPath || '未设置');

            // 云端
            var cloudEnabledEl = drawer.querySelector('#pd-cloud-enabled');
            var cloudSection = drawer.querySelector('#pd-cloud-section');
            if (data.cloudEnabled) {
                if (cloudEnabledEl) { cloudEnabledEl.textContent = '已启用'; cloudEnabledEl.className = 'text-sm text-green-600 flex items-center gap-1'; cloudEnabledEl.innerHTML = '<i class="ph-fill ph-check-circle"></i> 已启用'; }
                if (cloudSection) cloudSection.classList.remove('hidden');
                setText('pd-cloud-path', data.cloudPath || '—');
                setText('pd-cloud-type', CLOUD_TYPE_NAMES[data.cloudType] || data.cloudType || '—');
            } else {
                if (cloudEnabledEl) { cloudEnabledEl.innerHTML = '<i class="ph ph-x-circle text-gray-400"></i> 未启用'; cloudEnabledEl.className = 'text-sm text-gray-400 flex items-center gap-1'; }
                if (cloudSection) cloudSection.classList.add('hidden');
            }

            // 服务器配置
            var serverEnabledEl = drawer.querySelector('#pd-server-enabled');
            var serverSectionEl = drawer.querySelector('#pd-server-section');
            if (data.serverEnabled) {
                if (serverEnabledEl) { serverEnabledEl.innerHTML = '<i class="ph-fill ph-check-circle"></i> 已购买'; serverEnabledEl.className = 'text-sm text-green-600 flex items-center gap-1'; }
                if (serverSectionEl) serverSectionEl.classList.remove('hidden');
                setText('pd-server-addr', data.serverAddr || '—');
                var specEl = drawer.querySelector('#pd-server-spec');
                if (specEl) specEl.textContent = data.serverSpec || '—';
                // 渲染多个 Nginx 配置
                var nginxListEl = drawer.querySelector('#pd-nginx-list');
                if (nginxListEl) {
                    var configs = data.nginxConfigs || [];
                    if (configs.length === 0) {
                        nginxListEl.innerHTML = '<div class="bg-gray-50 rounded-lg p-3 border border-gray-100"><pre class="text-xs text-gray-400 whitespace-pre-wrap" style="font-family:monospace;">—</pre></div>';
                    } else {
                        nginxListEl.innerHTML = '';
                        for (var ni = 0; ni < configs.length; ni++) {
                            var item = document.createElement('div');
                            item.className = 'bg-gray-50 rounded-lg p-3 border border-gray-100';
                            var label = configs[ni].name || ('配置 ' + (ni + 1));
                            item.innerHTML =
                                '<div class="flex items-center justify-between mb-1">' +
                                    '<span class="text-[11px] font-medium text-indigo-500 flex items-center gap-1"><i class="ph ph-file-code"></i> ' + label + '</span>' +
                                    '<button class="pd-copy-nginx w-6 h-6 rounded text-gray-400 hover:text-brand-600 hover:bg-brand-50 transition flex items-center justify-center" data-config="' + ni + '" title="复制配置"><i class="ph ph-copy text-xs"></i></button>' +
                                '</div>' +
                                '<pre class="text-xs text-gray-600 whitespace-pre-wrap break-all max-h-48 overflow-y-auto" style="font-family:monospace;">' + (configs[ni].config || '—') + '</pre>';
                            nginxListEl.appendChild(item);
                        }
                        // 绑定复制按钮
                        var copyBtns = nginxListEl.querySelectorAll('.pd-copy-nginx');
                        for (var cb = 0; cb < copyBtns.length; cb++) {
                            (function (btn) {
                                btn.addEventListener('click', function () {
                                    var idx = parseInt(btn.getAttribute('data-config'));
                                    var cfg = configs[idx];
                                    if (cfg && cfg.config) {
                                        P.copy(cfg.config);
                                        P.toast('Nginx 配置已复制', 'ph-fill ph-check-circle', '#4ade80');
                                    }
                                });
                            })(copyBtns[cb]);
                        }
                    }
                }
            } else {
                if (serverEnabledEl) { serverEnabledEl.innerHTML = '<i class="ph ph-x-circle text-gray-400"></i> 未购买'; serverEnabledEl.className = 'text-sm text-gray-400 flex items-center gap-1'; }
                if (serverSectionEl) serverSectionEl.classList.add('hidden');
            }

            // 显示面板
            drawer.classList.add('show');
        }

        P.detail.hide = function() {
            var drawer = document.getElementById('proj-detail-drawer');
            if (drawer) drawer.classList.remove('show');
            P.state.detailId = null;
        }

        function setText(id, text) {
            var el = document.getElementById(id);
            if (el) el.textContent = text;
        }

        P.detail.bind = function() {
            var drawer = document.getElementById('proj-detail-drawer');
            if (!drawer || drawer.dataset.bound) return;
            drawer.dataset.bound = 'true';

            // 关闭按钮
            var closeBtn = drawer.querySelector('#pd-close');
            if (closeBtn) closeBtn.addEventListener('click', hideProjectDetail);

            function setDetailTab(target) {
                var infoTab = drawer.querySelector('#pd-tab-info');
                var filesTab = drawer.querySelector('#pd-tab-files');
                var serverTab = drawer.querySelector('#pd-tab-server');
                for (var j = 0; j < tabs.length; j++) {
                    var isActive = tabs[j].dataset.tab === target;
                    tabs[j].classList.toggle('border-brand-600', isActive);
                    tabs[j].classList.toggle('text-brand-600', isActive);
                    tabs[j].classList.toggle('font-medium', isActive);
                    tabs[j].classList.toggle('border-transparent', !isActive);
                    tabs[j].classList.toggle('text-gray-500', !isActive);
                    tabs[j].classList.toggle('hover:text-gray-800', !isActive);
                }
                if (infoTab) infoTab.classList.toggle('hidden', target !== 'info');
                if (filesTab) filesTab.classList.toggle('hidden', target !== 'files');
                if (serverTab) serverTab.classList.toggle('hidden', target !== 'server');
            }

            // Tab 切换
            var tabs = drawer.querySelectorAll('.pd-tab');
            for (var i = 0; i < tabs.length; i++) {
                (function (tab) {
                    tab.addEventListener('click', function () {
                        setDetailTab(tab.dataset.tab);
                    });
                })(tabs[i]);
            }
            setDetailTab('info');

            // 编辑项目
            var editBtn = drawer.querySelector('#pd-edit-btn');
            if (editBtn) editBtn.addEventListener('click', function () {
                if (P.state.detailId) P.form.open(P.state.detailId);
            });

            // 打开目录
            var openBtn = drawer.querySelector('#pd-open-folder');
            if (openBtn) openBtn.addEventListener('click', function () {
                var data = P.get(P.state.detailId || '');
                if (data.localPath) {
                    P.copy(data.localPath);
                    P.toast('本地路径已复制，请在文件管理器中打开', 'ph-fill ph-check-circle', '#4ade80');
                } else {
                    P.toast('该项目未设置本地路径', 'ph ph-warning', '#fbbf24');
                }
            });

            // 复制本地地址
            var copyLocalBtn = drawer.querySelector('#pd-copy-local');
            if (copyLocalBtn) copyLocalBtn.addEventListener('click', function () {
                var data = P.get(P.state.detailId || '');
                if (data.localPath) {
                    P.copy(data.localPath);
                    P.toast('本地地址已复制', 'ph-fill ph-check-circle', '#4ade80');
                } else {
                    P.toast('未设置本地地址', 'ph ph-warning', '#fbbf24');
                }
            });

            // 复制云端地址
            var copyCloudBtn = drawer.querySelector('#pd-copy-cloud');
            if (copyCloudBtn) copyCloudBtn.addEventListener('click', function () {
                var data = P.get(P.state.detailId || '');
                if (data.cloudPath) {
                    P.copy(data.cloudPath);
                    P.toast('云端地址已复制', 'ph-fill ph-check-circle', '#4ade80');
                } else {
                    P.toast('未设置云端地址', 'ph ph-warning', '#fbbf24');
                }
            });

            // 复制服务器地址
            var copyServerBtn = drawer.querySelector('#pd-copy-server-addr');
            if (copyServerBtn) copyServerBtn.addEventListener('click', function () {
                var data = P.get(P.state.detailId || '');
                if (data.serverAddr) {
                    P.copy(data.serverAddr);
                    P.toast('服务器地址已复制', 'ph-fill ph-check-circle', '#4ade80');
                } else {
                    P.toast('未设置服务器地址', 'ph ph-warning', '#fbbf24');
                }
            });
        }
})(window.ProjectPage);
