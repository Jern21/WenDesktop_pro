/**
 * 设置路由
 *
 * 字段来源：settings.html 设置中心
 *
 * API：
 *   GET    /api/settings           - 读取设置
 *   PUT    /api/settings           - 更新设置（merge 模式）
 *   POST   /api/settings/reset     - 重置为默认设置
 *   POST   /api/settings/backup    - 导出全部数据备份
 *   POST   /api/settings/restore   - 导入整包数据恢复
 *   GET    /api/settings/backups   - 查看本地备份历史
 *   POST   /api/settings/backups   - 创建本地备份快照
 *   GET    /api/settings/backups/:fileName/:backupName - 下载单个备份文件
 *   POST   /api/settings/backups/:fileName/:backupName/restore - 恢复单个数据文件
 */
'use strict';

var express = require('express');
var router = express.Router();
var fs = require('fs');
var resp = require('../utils/response');
var dataBackups = require('../utils/data-backups');
var settingsRepository = require('../utils/settings-repository');

var DEFAULT_SETTINGS = settingsRepository.DEFAULT_SETTINGS;
var readSettings = settingsRepository.read;
var saveSettings = settingsRepository.save;
var maskSecrets = settingsRepository.maskSecrets;
var stripMaskedSecrets = settingsRepository.stripMaskedSecrets;
var deepMerge = settingsRepository.deepMerge;

// ========== 读取设置 ==========
router.get('/', resp.asyncHandler(function (req, res) {
    return resp.success(res, maskSecrets(readSettings()));
}));

// ========== 更新设置 ==========
router.put('/', resp.asyncHandler(function (req, res) {
    try {
        var scope = dataBackups.captureScope();
        var current = readSettings(scope);
        var updated = deepMerge(current, stripMaskedSecrets(req.body || {}));
        saveSettings(updated, { scope: scope });
        return resp.success(res, maskSecrets(updated));
    } catch (e) {
        return resp.error(res, '保存设置失败: ' + e.message, 500);
    }
}));

// ========== 重置为默认 ==========
router.post('/reset', resp.asyncHandler(function (req, res) {
    var scope = dataBackups.captureScope();
    saveSettings(DEFAULT_SETTINGS, { scope: scope });
    return resp.success(res, maskSecrets(DEFAULT_SETTINGS));
}));

// ========== 本地备份历史 ==========
router.get('/backups', resp.asyncHandler(function (req, res) {
    return resp.success(res, dataBackups.getBackupSummary(dataBackups.captureScope()));
}));

// ========== 创建本地备份快照 ==========
router.post('/backups', resp.asyncHandler(function (req, res) {
    var scope = dataBackups.captureScope();
    var settings = readSettings(scope);
    settings.backup = settings.backup || {};
    settings.backup.lastBackup = new Date().toISOString();
    saveSettings(settings, { backup: false, scope: scope });

    var created = dataBackups.createAllBackups(scope);
    return resp.success(res, {
        created: created,
        count: created.length,
        summary: dataBackups.getBackupSummary()
    });
}));

// ========== 下载单个备份文件 ==========
router.get('/backups/:fileName/:backupName', resp.asyncHandler(function (req, res) {
    try {
        var backupPath = dataBackups.getBackupPath(req.params.fileName, req.params.backupName, dataBackups.captureScope());
        if (!fs.existsSync(backupPath)) {
            return resp.notFound(res, '备份文件不存在');
        }
        return res.download(backupPath, req.params.backupName);
    } catch (e) {
        return resp.error(res, '下载备份失败: ' + e.message, 400);
    }
}));

// ========== 恢复单个数据文件 ==========
router.post('/backups/:fileName/:backupName/restore', resp.asyncHandler(function (req, res) {
    try {
        var restored = dataBackups.restoreBackup(req.params.fileName, req.params.backupName, dataBackups.captureScope());
        return resp.success(res, {
            restored: restored,
            summary: dataBackups.getBackupSummary()
        });
    } catch (e) {
        return resp.error(res, '恢复备份失败: ' + e.message, 400);
    }
}));

// ========== 导出全部数据备份 ==========
router.post('/backup', resp.asyncHandler(function (req, res) {
    var backup = {};
    var scope = dataBackups.captureScope();
    var files = dataBackups.listDataFiles(scope);

    files.forEach(function (fileName) {
        backup[fileName] = dataBackups.readJsonFile(fileName, [], scope);
    });

    backup._meta = {
        exportedAt: new Date().toISOString(),
        version: '1.0.0'
    };

    // 更新备份时间
    try {
        var settings = readSettings(scope);
        settings.backup = settings.backup || {};
        settings.backup.lastBackup = new Date().toISOString();
        saveSettings(settings, { backup: false, scope: scope });
    } catch (e) {}

    return resp.success(res, backup);
}));

// ========== 导入数据恢复 ==========
router.post('/restore', resp.asyncHandler(function (req, res) {
    var backup = req.body || {};
    if (!backup || !backup._meta) {
        return resp.error(res, '无效的备份数据格式');
    }

    var restored = [];
    var scope = dataBackups.captureScope();
    Object.keys(backup).forEach(function (key) {
        if (key === '_meta') return;
        try {
            dataBackups.writeJsonFile(key, backup[key], { scope: scope });
            restored.push(key);
        } catch (e) {
            console.error('[Restore] 恢复失败:', key, e.message);
        }
    });

    return resp.success(res, { restored: restored, count: restored.length });
}));

module.exports = router;
