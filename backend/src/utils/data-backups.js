'use strict';

var fs = require('fs');
var path = require('path');
var dataPaths = require('./data-paths');
var userContext = require('./user-context');

var DATA_DIR = dataPaths.DATA_DIR;
var BACKUP_DIR = dataPaths.BACKUP_DIR;
var MAX_BACKUPS_PER_FILE = 50;

function ensureDir(dir) {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
}

function isSafeFileName(fileName) {
    return typeof fileName === 'string' && /^[a-zA-Z0-9_-]+$/.test(fileName);
}

function assertSafeFileName(fileName) {
    if (!isSafeFileName(fileName)) {
        throw new Error('非法数据文件名: ' + fileName);
    }
}

/**
 * 冻结「这一次操作」的用户。username 为 null 表示根目录。
 * 调用方应把同一个 scope 传给读、写、备份，避免中途再问全局身份。
 */
function captureScope() {
    return { username: userContext.get() || null };
}

function resolveScope(scope) {
    if (scope && typeof scope === 'object' && Object.prototype.hasOwnProperty.call(scope, 'username')) {
        var name = scope.username ? String(scope.username).trim().toLowerCase() : null;
        return { username: name || null };
    }
    return captureScope();
}

function dataDirOf(scope) {
    var resolved = resolveScope(scope);
    if (resolved.username) return dataPaths.ensureUserDataDir(resolved.username);
    return DATA_DIR;
}

function getActiveDataDir() {
    return dataDirOf(captureScope());
}

function getDataFilePath(fileName, scope) {
    assertSafeFileName(fileName);
    return path.join(dataDirOf(scope), fileName + '.json');
}

function getBackupDir(fileName, scope) {
    assertSafeFileName(fileName);
    return path.join(dataDirOf(scope), 'backups', fileName);
}

function uniqueTimestamp() {
    var stamp = new Date().toISOString().replace(/[:.]/g, '-');
    var suffix = Math.random().toString(36).slice(2, 8);
    return stamp + '-' + process.pid + '-' + suffix;
}

function getItemCount(data) {
    if (Array.isArray(data)) return data.length;
    if (data && typeof data === 'object') return Object.keys(data).length;
    return 0;
}

function readJsonFile(fileName, fallback, scope) {
    var filePath = getDataFilePath(fileName, scope);
    if (!fs.existsSync(filePath)) return fallback;

    var raw;
    try {
        raw = fs.readFileSync(filePath, 'utf-8');
    } catch (e) {
        var err = new Error('数据文件读取失败：' + fileName + '.json（' + e.message + '）');
        err.cause = e;
        err.status = 500;
        throw err;
    }
    if (raw.trim() === '') return fallback;

    try {
        return JSON.parse(raw);
    } catch (e) {
        var parseErr = new Error('数据文件读取失败：' + fileName + '.json（' + e.message + '）');
        parseErr.cause = e;
        parseErr.status = 500;
        throw parseErr;
    }
}

function readJsonFileByPath(filePath, fallback) {
    try {
        return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    } catch (e) {
        return fallback;
    }
}

function writeJsonFile(fileName, data, options) {
    options = options || {};
    var scope = resolveScope(options.scope);
    var filePath = getDataFilePath(fileName, scope);
    var tmpPath = filePath + '.' + process.pid + '.' + Date.now() + '.' + Math.random().toString(36).slice(2, 8) + '.tmp';

    try {
        ensureDir(dataDirOf(scope));
        if (options.backup !== false) {
            createBackup(fileName, scope);
        }
        fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2), 'utf-8');
        fs.renameSync(tmpPath, filePath);
    } catch (e) {
        try {
            if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);
        } catch (cleanupErr) {
            console.error('[DataBackup] 清理临时文件失败:', tmpPath, cleanupErr.message);
        }
        throw e;
    }
}

function pruneBackups(fileName, scope) {
    var dir = getBackupDir(fileName, scope);
    if (!fs.existsSync(dir)) return;

    var files = fs.readdirSync(dir)
        .filter(function (name) { return name.endsWith('.json'); })
        .map(function (name) {
            var fullPath = path.join(dir, name);
            var stat = fs.statSync(fullPath);
            return { name: name, path: fullPath, mtimeMs: stat.mtimeMs };
        })
        .sort(function (a, b) { return b.mtimeMs - a.mtimeMs; });

    files.slice(MAX_BACKUPS_PER_FILE).forEach(function (file) {
        try {
            fs.unlinkSync(file.path);
        } catch (e) {
            console.error('[DataBackup] 清理旧备份失败:', file.path, e.message);
        }
    });
}

function describeJsonFile(fileName, scope) {
    var filePath = getDataFilePath(fileName, scope);
    if (!fs.existsSync(filePath)) {
        return {
            fileName: fileName,
            size: 0,
            updatedAt: null,
            itemCount: 0
        };
    }

    var stat = fs.statSync(filePath);
    var data = readJsonFileByPath(filePath, null);
    return {
        fileName: fileName,
        size: stat.size,
        updatedAt: stat.mtime.toISOString(),
        itemCount: getItemCount(data)
    };
}

function describeBackup(fileName, backupName, scope) {
    var fullPath = getBackupPath(fileName, backupName, scope);
    var stat = fs.statSync(fullPath);
    var data = readJsonFileByPath(fullPath, null);
    return {
        fileName: fileName,
        name: backupName,
        size: stat.size,
        createdAt: stat.mtime.toISOString(),
        itemCount: getItemCount(data)
    };
}

function createBackup(fileName, scope) {
    scope = resolveScope(scope);
    var filePath = getDataFilePath(fileName, scope);
    if (!fs.existsSync(filePath)) return null;

    var stat = fs.statSync(filePath);
    if (!stat.isFile() || stat.size === 0) return null;

    var dir = getBackupDir(fileName, scope);
    ensureDir(dir);

    var backupName = fileName + '-' + uniqueTimestamp() + '.json';
    var backupPath = path.join(dir, backupName);
    fs.copyFileSync(filePath, backupPath);
    pruneBackups(fileName, scope);

    return describeBackup(fileName, backupName, scope);
}

function listBackups(fileName, scope) {
    scope = resolveScope(scope);
    var dir = getBackupDir(fileName, scope);
    if (!fs.existsSync(dir)) return [];

    return fs.readdirSync(dir)
        .filter(function (name) { return name.endsWith('.json'); })
        .map(function (name) {
            try {
                return describeBackup(fileName, name, scope);
            } catch (e) {
                return null;
            }
        })
        .filter(Boolean)
        .sort(function (a, b) {
            return String(b.createdAt).localeCompare(String(a.createdAt));
        });
}

function listDataFiles(scope) {
    scope = resolveScope(scope);
    var dir = dataDirOf(scope);
    ensureDir(dir);
    return fs.readdirSync(dir)
        .filter(function (name) {
            var fullPath = path.join(dir, name);
            return name.endsWith('.json') && fs.statSync(fullPath).isFile();
        })
        .map(function (name) { return name.replace(/\.json$/, ''); })
        .sort();
}

function getBackupPath(fileName, backupName, scope) {
    assertSafeFileName(fileName);
    if (!backupName || path.basename(backupName) !== backupName || !backupName.endsWith('.json')) {
        throw new Error('非法备份文件名: ' + backupName);
    }
    if (backupName.indexOf(fileName + '-') !== 0) {
        throw new Error('备份文件与数据文件不匹配');
    }
    return path.join(getBackupDir(fileName, scope), backupName);
}

function restoreBackup(fileName, backupName, scope) {
    scope = resolveScope(scope);
    var backupPath = getBackupPath(fileName, backupName, scope);
    if (!fs.existsSync(backupPath)) {
        throw new Error('备份文件不存在');
    }

    var data = JSON.parse(fs.readFileSync(backupPath, 'utf-8'));
    writeJsonFile(fileName, data, { scope: scope });

    return {
        fileName: fileName,
        name: backupName,
        restoredAt: new Date().toISOString()
    };
}

function createAllBackups(scope) {
    scope = resolveScope(scope);
    return listDataFiles(scope)
        .map(function (fileName) {
            try {
                return createBackup(fileName, scope);
            } catch (e) {
                console.error('[DataBackup] 创建备份失败:', fileName, e.message);
                return null;
            }
        })
        .filter(Boolean);
}

function getBackupSummary(scope) {
    scope = resolveScope(scope);
    var activeDir = dataDirOf(scope);
    var files = listDataFiles(scope).map(function (fileName) {
        var current = describeJsonFile(fileName, scope);
        var backups = listBackups(fileName, scope);
        return Object.assign({}, current, {
            backupCount: backups.length,
            latestBackupAt: backups[0] ? backups[0].createdAt : null,
            backups: backups
        });
    });

    var totalSize = files.reduce(function (sum, file) { return sum + file.size; }, 0);
    var latestBackupAt = files.reduce(function (latest, file) {
        if (!file.latestBackupAt) return latest;
        if (!latest || file.latestBackupAt > latest) return file.latestBackupAt;
        return latest;
    }, null);

    return {
        dataDir: activeDir,
        backupDir: path.join(activeDir, 'backups'),
        maxBackupsPerFile: MAX_BACKUPS_PER_FILE,
        totalFiles: files.length,
        totalSize: totalSize,
        latestBackupAt: latestBackupAt,
        files: files
    };
}

module.exports = {
    DATA_DIR: DATA_DIR,
    BACKUP_DIR: BACKUP_DIR,
    MAX_BACKUPS_PER_FILE: MAX_BACKUPS_PER_FILE,
    ensureDir: ensureDir,
    captureScope: captureScope,
    resolveScope: resolveScope,
    getDataFilePath: getDataFilePath,
    readJsonFile: readJsonFile,
    writeJsonFile: writeJsonFile,
    createBackup: createBackup,
    createAllBackups: createAllBackups,
    listBackups: listBackups,
    listDataFiles: listDataFiles,
    getBackupPath: getBackupPath,
    restoreBackup: restoreBackup,
    getBackupSummary: getBackupSummary,
    getItemCount: getItemCount
};
