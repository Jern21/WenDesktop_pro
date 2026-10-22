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
var secretBox = require('../utils/secret-box');

var DEFAULT_SETTINGS = {
    profile: {
        nickname: '',
        realName: '',
        phone: '',
        email: '',
        role: '',
        city: '',
        bio: '',
        avatar: ''
    },
    theme: 'pure-white',
    notifications: {
        orderReminders: true,
        customerMessages: true,
        platformUpdates: false,
        weeklyReport: true
    },
    backup: {
        autoBackup: false,
        lastBackup: null
    },
    exportFormat: 'json',
    cleanupDays: 30,
    devLedger: {
        goalAmount: 20000
    }
};

// ========== 读取设置 ==========
router.get('/', resp.asyncHandler(function (req, res) {
    return resp.success(res, maskSecrets(readSettings()));
}));

// ========== 更新设置 ==========
router.put('/', resp.asyncHandler(function (req, res) {
    try {
        var current = readSettings();
        var updated = deepMerge(current, stripMaskedSecrets(req.body || {}));
        saveSettings(updated);
        return resp.success(res, maskSecrets(updated));
    } catch (e) {
        return resp.error(res, '保存设置失败: ' + e.message, 500);
    }
}));

// ========== 重置为默认 ==========
router.post('/reset', resp.asyncHandler(function (req, res) {
    saveSettings(DEFAULT_SETTINGS);
    return resp.success(res, maskSecrets(DEFAULT_SETTINGS));
}));

// ========== 本地备份历史 ==========
router.get('/backups', resp.asyncHandler(function (req, res) {
    return resp.success(res, dataBackups.getBackupSummary());
}));

// ========== 创建本地备份快照 ==========
router.post('/backups', resp.asyncHandler(function (req, res) {
    var settings = readSettings();
    settings.backup = settings.backup || {};
    settings.backup.lastBackup = new Date().toISOString();
    saveSettings(settings, { backup: false });

    var created = dataBackups.createAllBackups();
    return resp.success(res, {
        created: created,
        count: created.length,
        summary: dataBackups.getBackupSummary()
    });
}));

// ========== 下载单个备份文件 ==========
router.get('/backups/:fileName/:backupName', resp.asyncHandler(function (req, res) {
    try {
        var backupPath = dataBackups.getBackupPath(req.params.fileName, req.params.backupName);
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
        var restored = dataBackups.restoreBackup(req.params.fileName, req.params.backupName);
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
    var files = dataBackups.listDataFiles();

    files.forEach(function (fileName) {
        try {
            backup[fileName] = dataBackups.readJsonFile(fileName, []);
        } catch (e) {
            backup[fileName] = [];
        }
    });

    backup._meta = {
        exportedAt: new Date().toISOString(),
        version: '1.0.0'
    };

    // 更新备份时间
    try {
        var settings = readSettings();
        settings.backup = settings.backup || {};
        settings.backup.lastBackup = new Date().toISOString();
        saveSettings(settings, { backup: false });
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
    Object.keys(backup).forEach(function (key) {
        if (key === '_meta') return;
        try {
            dataBackups.writeJsonFile(key, backup[key]);
            restored.push(key);
        } catch (e) {
            console.error('[Restore] 恢复失败:', key, e.message);
        }
    });

    return resp.success(res, { restored: restored, count: restored.length });
}));

// ========== 深度合并工具 ==========
function readSettings() {
    var merged = deepMerge(DEFAULT_SETTINGS, dataBackups.readJsonFile('settings', DEFAULT_SETTINGS) || {});
    // apiKey 在磁盘上是密文，内存里统一还原成明文；
    // 返回给前端时再脱敏（见下面的 maskSecrets），避免明文出网。
    if (merged.imageGen && typeof merged.imageGen.apiKey === 'string') {
        merged.imageGen.apiKey = secretBox.decryptField(merged.imageGen.apiKey);
    }
    return merged;
}

function saveSettings(settings, options) {
    var toWrite = settings;
    if (settings && settings.imageGen && typeof settings.imageGen.apiKey === 'string') {
        toWrite = Object.assign({}, settings, {
            imageGen: Object.assign({}, settings.imageGen, {
                apiKey: secretBox.encrypt(settings.imageGen.apiKey)
            })
        });
    }
    dataBackups.writeJsonFile('settings', toWrite, options);
    return settings;
}

/**
 * 出网前脱敏：接口只暴露「有没有配」「首尾各四位」，不返回明文。
 * 与 image-gen 的 apiKeyMasked 保持一致风格。
 */
function maskSecrets(settings) {
    var copy = JSON.parse(JSON.stringify(settings || {}));
    if (copy.imageGen) {
        var key = String(copy.imageGen.apiKey || '');
        copy.imageGen.apiKeyConfigured = !!key;
        copy.imageGen.apiKey = key
            ? (key.slice(0, 4) + '****' + key.slice(-4))
            : '';
    }
    return copy;
}

/**
 * 前端拿到的 apiKey 是脱敏的，如果它把整份设置原样 PUT 回来，
 * 不能拿 'sk-a****1234' 把真实密钥覆盖掉 —— 带 **** 的字段直接丢弃。
 */
function stripMaskedSecrets(body) {
    if (!body || !body.imageGen) return body;
    var incoming = body.imageGen.apiKey;
    if (typeof incoming !== 'string' || incoming.indexOf('****') === -1) return body;

    var imageGen = Object.assign({}, body.imageGen);
    delete imageGen.apiKey;
    return Object.assign({}, body, { imageGen: imageGen });
}

function deepMerge(target, source) {
    var result = Object.assign({}, target);
    Object.keys(source).forEach(function (key) {
        if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
            result[key] = deepMerge(target[key] || {}, source[key]);
        } else {
            result[key] = source[key];
        }
    });
    return result;
}

module.exports = router;
