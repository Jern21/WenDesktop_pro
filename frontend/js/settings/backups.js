(function (global) {
    'use strict';
    global.SettingsPage.section(function (ctx) {
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
        return global.SettingsPage.call(API_BASE + path, {
            method: options.method,
            body: options.body,
            signal: ctx && ctx.signal
        }).then(function (result) {
            return result && result.data;
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
        initBackupManager();
    });
})(typeof window !== 'undefined' ? window : this);
