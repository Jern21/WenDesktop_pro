'use strict';

var fs = require('fs');
var path = require('path');
var dataPaths = require('./data-paths');

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

function getDataFilePath(fileName) {
    assertSafeFileName(fileName);
    return path.join(DATA_DIR, fileName + '.json');
}

function getBackupDir(fileName) {
    assertSafeFileName(fileName);
    return path.join(BACKUP_DIR, fileName);
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

function readJsonFile(fileName, fallback) {
    var filePath = getDataFilePath(fileName);
    try {
        return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    } catch (e) {
        return fallback;
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
    var filePath = getDataFilePath(fileName);
    var tmpPath = filePath + '.' + process.pid + '.' + Date.now() + '.' + Math.random().toString(36).slice(2, 8) + '.tmp';

    try {
        ensureDir(DATA_DIR);
        if (options.backup !== false) {
            createBackup(fileName);
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

function pruneBackups(fileName) {
    var dir = getBackupDir(fileName);
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

function describeJsonFile(fileName) {
    var filePath = getDataFilePath(fileName);
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

function describeBackup(fileName, backupName) {
    var fullPath = getBackupPath(fileName, backupName);
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

function createBackup(fileName) {
    var filePath = getDataFilePath(fileName);
    if (!fs.existsSync(filePath)) return null;

    var stat = fs.statSync(filePath);
    if (!stat.isFile() || stat.size === 0) return null;

    var dir = getBackupDir(fileName);
    ensureDir(dir);

    var backupName = fileName + '-' + uniqueTimestamp() + '.json';
    var backupPath = path.join(dir, backupName);
    fs.copyFileSync(filePath, backupPath);
    pruneBackups(fileName);

    return describeBackup(fileName, backupName);
}

function listBackups(fileName) {
    var dir = getBackupDir(fileName);
    if (!fs.existsSync(dir)) return [];

    return fs.readdirSync(dir)
        .filter(function (name) { return name.endsWith('.json'); })
        .map(function (name) {
            try {
                return describeBackup(fileName, name);
            } catch (e) {
                return null;
            }
        })
        .filter(Boolean)
        .sort(function (a, b) {
            return String(b.createdAt).localeCompare(String(a.createdAt));
        });
}

function listDataFiles() {
    ensureDir(DATA_DIR);
    return fs.readdirSync(DATA_DIR)
        .filter(function (name) {
            var fullPath = path.join(DATA_DIR, name);
            return name.endsWith('.json') && fs.statSync(fullPath).isFile();
        })
        .map(function (name) { return name.replace(/\.json$/, ''); })
        .sort();
}

function getBackupPath(fileName, backupName) {
    assertSafeFileName(fileName);
    if (!backupName || path.basename(backupName) !== backupName || !backupName.endsWith('.json')) {
        throw new Error('非法备份文件名: ' + backupName);
    }
    if (backupName.indexOf(fileName + '-') !== 0) {
        throw new Error('备份文件与数据文件不匹配');
    }
    return path.join(getBackupDir(fileName), backupName);
}

function restoreBackup(fileName, backupName) {
    var backupPath = getBackupPath(fileName, backupName);
    if (!fs.existsSync(backupPath)) {
        throw new Error('备份文件不存在');
    }

    var data = JSON.parse(fs.readFileSync(backupPath, 'utf-8'));
    writeJsonFile(fileName, data);

    return {
        fileName: fileName,
        name: backupName,
        restoredAt: new Date().toISOString()
    };
}

function createAllBackups() {
    return listDataFiles()
        .map(function (fileName) {
            try {
                return createBackup(fileName);
            } catch (e) {
                console.error('[DataBackup] 创建备份失败:', fileName, e.message);
                return null;
            }
        })
        .filter(Boolean);
}

function getBackupSummary() {
    var files = listDataFiles().map(function (fileName) {
        var current = describeJsonFile(fileName);
        var backups = listBackups(fileName);
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
        dataDir: DATA_DIR,
        backupDir: BACKUP_DIR,
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
