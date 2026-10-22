(function (global) {
    'use strict';
    global.SettingsPage.section(function (ctx) {
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
        return global.SettingsPage.call(API_ROOT + 'api/upload/multiple', {
            method: 'POST',
            body: formData,
            signal: ctx && ctx.signal
        }).then(function (result) {
            return (result && result.data) || [];
        });
    }

    function loadBugReports() {
        if (refreshBtn) refreshBtn.querySelector('i').classList.add('animate-spin');
        return global.SettingsPage.call(API_ROOT + 'api/bug-reports', { signal: ctx && ctx.signal })
            .then(function (result) {
                bugReportsCache = (result && result.data) || [];
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
                return global.SettingsPage.call(API_ROOT + 'api/bug-reports', {
                    method: 'POST',
                    body: {
                        title: title,
                        page: pageInput.value.trim(),
                        severity: severityInput.value,
                        description: descInput.value.trim(),
                        attachments: attachments
                    },
                    signal: ctx && ctx.signal
                });
            })
            .then(function () {
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
        global.SettingsPage.call(API_ROOT + 'api/bug-reports/' + encodeURIComponent(id), {
            method: 'DELETE',
            signal: ctx && ctx.signal
        })
            .then(function () {
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
        initBugReports();
    });
})(typeof window !== 'undefined' ? window : this);
