'use strict';

/**
 * 将各处旧业务数据 **全部合并** 到 trial（不是择优只保留一份）。
 * 数组类 JSON：按 id 去重合并；settings：深度合并。
 *
 * 运行：node backend/src/utils/assign-data-to-trial.js
 */
var fs = require('fs');
var path = require('path');
var dataPaths = require('./data-paths');
var auth = require('./auth');

var USER_JSON_FILES = [
    'orders', 'customers', 'quotes', 'posters', 'projects', 'platform-posts',
    'memos', 'reminders', 'resume', 'bookmarks', 'accounts', 'bug-reports', 'settings', 'ledger'
];

var RESERVED_ROOT = new Set([
    'auth.json', '.secret', '.user-scope-migrated', '.data-assigned-to-trial'
]);

function emptySettings() {
    return {
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
        backup: { autoBackup: false, lastBackup: null },
        exportFormat: 'json',
        cleanupDays: 30
    };
}

function emptyJsonContent(fileName) {
    if (fileName === 'settings') {
        return JSON.stringify(emptySettings(), null, 2);
    }
    return '[]';
}

function readJsonSafe(filePath) {
    if (!fs.existsSync(filePath)) return null;
    try {
        var raw = fs.readFileSync(filePath, 'utf-8').trim();
        if (!raw) return null;
        return JSON.parse(raw);
    } catch (e) {
        console.warn('[assign-data-to-trial] 跳过无法解析的文件:', filePath, e.message);
        return null;
    }
}

function isPlainObject(v) {
    return v !== null && typeof v === 'object' && !Array.isArray(v);
}

function deepMerge(target, source) {
    if (!isPlainObject(source)) return target;
    var out = Object.assign({}, target);
    Object.keys(source).forEach(function (key) {
        var sv = source[key];
        var tv = out[key];
        if (isPlainObject(sv) && isPlainObject(tv)) {
            out[key] = deepMerge(tv, sv);
        } else if (sv !== undefined && sv !== null && sv !== '') {
            out[key] = sv;
        }
    });
    return out;
}

function recordTime(item) {
    if (!item || typeof item !== 'object') return '';
    return String(item.updatedAt || item.createdAt || '');
}

function mergeArrayRecords(sources) {
    var byId = new Map();
    var withoutId = [];

    sources.forEach(function (filePath) {
        var data = readJsonSafe(filePath);
        if (!Array.isArray(data)) return;
        data.forEach(function (item) {
            if (!item || typeof item !== 'object') return;
            if (item.id) {
                var prev = byId.get(item.id);
                if (!prev || recordTime(item) >= recordTime(prev)) {
                    byId.set(item.id, item);
                }
            } else {
                withoutId.push(item);
            }
        });
    });

    return Array.from(byId.values()).concat(withoutId);
}

function mergeSettingsRecords(sources) {
    var merged = emptySettings();
    sources.forEach(function (filePath) {
        var data = readJsonSafe(filePath);
        if (isPlainObject(data)) {
            merged = deepMerge(merged, data);
        }
    });
    return merged;
}

function listSourcePaths(dataDir, legacyDir, adminDir, trialDir, name) {
    var paths = [
        path.join(dataDir, name + '.json'),
        path.join(legacyDir, name + '.json'),
        path.join(adminDir, name + '.json'),
        path.join(trialDir, name + '.json')
    ];
    var usersRoot = path.join(dataDir, 'users');
    if (fs.existsSync(usersRoot)) {
        fs.readdirSync(usersRoot).forEach(function (userDir) {
            var full = path.join(usersRoot, userDir, name + '.json');
            if (fs.existsSync(full) && paths.indexOf(full) === -1) {
                paths.push(full);
            }
        });
    }
    return paths.filter(function (p) { return fs.existsSync(p); });
}

function copyDirContents(srcDir, destDir) {
    if (!fs.existsSync(srcDir)) return 0;
    fs.mkdirSync(destDir, { recursive: true });
    var n = 0;
    fs.readdirSync(srcDir).forEach(function (name) {
        var from = path.join(srcDir, name);
        var to = path.join(destDir, name);
        var st = fs.statSync(from);
        if (st.isDirectory()) {
            n += copyDirContents(from, to);
            return;
        }
        fs.copyFileSync(from, to);
        n++;
    });
    return n;
}

function collectUploadDirs(dataDir, adminDir, trialDir) {
    var dirs = [path.join(dataDir, 'uploads')];
    var usersRoot = path.join(dataDir, 'users');
    if (fs.existsSync(usersRoot)) {
        fs.readdirSync(usersRoot).forEach(function (u) {
            var up = path.join(usersRoot, u, 'uploads');
            if (fs.existsSync(up)) dirs.push(up);
        });
    }
    dirs.push(path.join(adminDir, 'uploads'));
    dirs.push(path.join(trialDir, 'uploads'));
    return dirs;
}

function collectBackupDirs(dataDir, adminDir, trialDir) {
    var dirs = [path.join(dataDir, 'backups')];
    [adminDir, trialDir].forEach(function (userDir) {
        var b = path.join(userDir, 'backups');
        if (fs.existsSync(b)) dirs.push(b);
    });
    var usersRoot = path.join(dataDir, 'users');
    if (fs.existsSync(usersRoot)) {
        fs.readdirSync(usersRoot).forEach(function (u) {
            var b = path.join(usersRoot, u, 'backups');
            if (fs.existsSync(b)) dirs.push(b);
        });
    }
    return dirs;
}

function runAssignAllToTrial(options) {
    options = options || {};
    var trial = dataPaths.normalizeUsername(
        options.trialUsername || (auth.getTrialUsername && auth.getTrialUsername()) || 'trial'
    );
    var admin = dataPaths.normalizeUsername(
        options.adminUsername || (auth.getUsername && auth.getUsername()) || 'admin'
    );

    var dataDir = dataPaths.DATA_DIR;
    var trialDir = dataPaths.ensureUserDataDir(trial);
    var adminDir = dataPaths.ensureUserDataDir(admin);
    var legacyDir = path.join(dataDir, '_legacy_root_data');

    var report = { trial: trial, admin: admin, files: [], uploads: 0, backups: 0 };

    USER_JSON_FILES.forEach(function (name) {
        var sources = listSourcePaths(dataDir, legacyDir, adminDir, trialDir, name);
        var dest = path.join(trialDir, name + '.json');
        var merged;
        var count = 0;

        if (name === 'settings') {
            merged = mergeSettingsRecords(sources);
            count = sources.length;
        } else {
            merged = mergeArrayRecords(sources);
            count = merged.length;
        }

        fs.writeFileSync(dest, JSON.stringify(merged, null, 2), 'utf-8');
        report.files.push({
            name: name,
            mergedFrom: sources.map(function (p) { return path.relative(dataDir, p); }),
            sourceFiles: sources.length,
            recordCount: name === 'settings' ? 1 : count
        });

        fs.writeFileSync(path.join(adminDir, name + '.json'), emptyJsonContent(name), 'utf-8');
    });

    fs.readdirSync(dataDir).forEach(function (name) {
        if (!name.endsWith('.json')) return;
        if (RESERVED_ROOT.has(name)) return;
        var base = name.slice(0, -5);
        if (USER_JSON_FILES.indexOf(base) === -1) return;
        var src = path.join(dataDir, name);
        fs.mkdirSync(legacyDir, { recursive: true });
        var dest = path.join(legacyDir, name);
        try {
            if (fs.existsSync(dest)) fs.unlinkSync(src);
            else fs.renameSync(src, dest);
        } catch (e) {
            fs.copyFileSync(src, dest);
            fs.unlinkSync(src);
        }
    });

    var trialUploads = dataPaths.userUploadsDir(trial);
    collectUploadDirs(dataDir, adminDir, trialDir).forEach(function (dir) {
        report.uploads += copyDirContents(dir, trialUploads);
    });

    var trialBackups = path.join(trialDir, 'backups');
    collectBackupDirs(dataDir, adminDir, trialDir).forEach(function (dir) {
        report.backups += copyDirContents(dir, trialBackups);
    });

    fs.writeFileSync(path.join(dataDir, '.data-assigned-to-trial'), JSON.stringify({
        at: new Date().toISOString(),
        trial: trial,
        mode: 'merge-all-sources',
        report: report
    }, null, 2), 'utf-8');

    return report;
}

if (require.main === module) {
    auth.init();
    var result = runAssignAllToTrial();
    console.log('[assign-data-to-trial] 已将全部旧数据合并到 users/' + result.trial);
    console.log(JSON.stringify(result, null, 2));
}

module.exports = {
    runAssignAllToTrial: runAssignAllToTrial
};
