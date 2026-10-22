/**
 * 存量数据加密迁移
 *
 * 把 data/accounts.json 的 password、data/settings.json 的 imageGen.apiKey / llm.apiKey
 * 从明文转成密文（AES-256-GCM，见 secret-box.js）。
 *
 * 设计要求：
 *   1. **幂等**：已经是密文的跳过，跑多少次结果都一样（服务每次启动都会调它）
 *   2. **不留明文备份**：迁移完成后原文件里不能残留明文，所以不做 .bak 拷贝
 *      —— 真要备份，请在迁移前自己拷走并妥善保管
 *   3. **先验后写**：写盘前先确认「密文能解回原值」，验不过就抛错、原文件一个字都不动
 *   4. **原子写**：临时文件 + rename，避免写一半断电把数据写坏
 */
'use strict';

var fs = require('fs');
var path = require('path');
var secretBox = require('./secret-box');
var settingsRepository = require('./settings-repository');
var dataPaths = require('./data-paths');

var DATA_DIR = dataPaths.DATA_DIR;

function readJson(filePath) {
    if (!fs.existsSync(filePath)) return null;
    try {
        return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    } catch (e) {
        console.error('[secret-migration] 解析失败，跳过:', path.basename(filePath), e.message);
        return null;
    }
}

function atomicWriteJson(filePath, data) {
    var tmp = filePath + '.' + process.pid + '.migrate.tmp';
    fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf-8');
    fs.renameSync(tmp, filePath);
}

/**
 * 账号密码：逐条把明文 password 换成密文
 */
function listUserDataDirs() {
    var dirs = [];
    if (fs.existsSync(dataPaths.USERS_DIR)) {
        fs.readdirSync(dataPaths.USERS_DIR).forEach(function (name) {
            var full = path.join(dataPaths.USERS_DIR, name);
            if (fs.statSync(full).isDirectory()) dirs.push(full);
        });
    }
    dirs.push(DATA_DIR);
    return dirs;
}

function migrateAccountsInDir(dataDir) {
    var filePath = path.join(dataDir, 'accounts.json');
    var list = readJson(filePath);
    if (!Array.isArray(list)) return { file: 'accounts.json', skipped: true };

    var changed = 0;
    var total = 0;

    var next = list.map(function (account) {
        if (!account || typeof account !== 'object') return account;
        var copy = Object.assign({}, account);

        if (typeof copy.password === 'string' && copy.password !== '') {
            total++;
            if (!secretBox.isEncrypted(copy.password)) {
                var plain = copy.password;
                copy.password = secretBox.encrypt(plain);
                if (secretBox.decrypt(copy.password) !== plain) {
                    throw new Error('加密回环校验失败，已中止（accounts.json 未改动）');
                }
                changed++;
            }
        }
        return copy;
    });

    if (changed > 0) atomicWriteJson(filePath, next);
    return { file: path.relative(DATA_DIR, filePath) || 'accounts.json', changed: changed, total: total };
}

/**
 * settings.json 里的所有密钥字段（imageGen.apiKey、llm.apiKey …）
 *
 * 字段清单不在本文件维护，直接复用 settings-repository 的 SECRET_PATHS ——
 * 两份清单一定会漂移，而漂移的后果是「某个密钥永久明文落盘」且没有任何报错。
 * 这里只借用常量，读写仍走本文件的原子写，不经过 user-context。
 */
function migrateSettingsInDir(dataDir) {
    var filePath = path.join(dataDir, 'settings.json');
    var settings = readJson(filePath);
    if (!settings || typeof settings !== 'object') return { file: 'settings.json', skipped: true };

    var changed = 0;
    var total = 0;

    settingsRepository.SECRET_PATHS.forEach(function (entry) {
        var parent = settings;
        for (var i = 0; i < entry.path.length - 1; i++) {
            parent = (parent && typeof parent === 'object') ? parent[entry.path[i]] : null;
        }
        if (!parent || typeof parent !== 'object') return;

        var key = entry.path[entry.path.length - 1];
        if (typeof parent[key] !== 'string' || parent[key] === '') return;

        total++;
        // 「前缀对」还不够：用户填的密钥本身可能就以 enc:v1: 开头，得真能解开才算密文
        if (secretBox.isEncrypted(parent[key]) && secretBox.decrypt(parent[key]) !== null) return;

        var plain = parent[key];
        var encrypted = secretBox.encrypt(plain);
        if (secretBox.decrypt(encrypted) !== plain) {
            throw new Error('加密回环校验失败，已中止（settings.json 未改动）');
        }
        parent[key] = encrypted;
        changed++;
    });

    if (changed > 0) atomicWriteJson(filePath, settings);
    return { file: path.relative(DATA_DIR, filePath) || 'settings.json', changed: changed, total: total };
}

function migrateAccounts() {
    var results = [];
    listUserDataDirs().forEach(function (dir) {
        results.push(migrateAccountsInDir(dir));
    });
    return results.reduce(function (acc, r) {
        if (!acc) return r;
        acc.changed = (acc.changed || 0) + (r.changed || 0);
        acc.total = (acc.total || 0) + (r.total || 0);
        return acc;
    }, { file: 'accounts.json', changed: 0, total: 0 });
}

function migrateSettings() {
    var results = [];
    listUserDataDirs().forEach(function (dir) {
        results.push(migrateSettingsInDir(dir));
    });
    return results.reduce(function (acc, r) {
        if (!acc) return r;
        acc.changed = (acc.changed || 0) + (r.changed || 0);
        acc.total = (acc.total || 0) + (r.total || 0);
        return acc;
    }, { file: 'settings.json', changed: 0, total: 0 });
}

/**
 * 执行全部迁移。任何一步失败只记录、不阻断服务启动
 * （否则密钥文件出问题时整个服务都起不来，比明文风险更大）。
 * @returns {Array<{file:string, changed?:number, total?:number, skipped?:boolean, error?:string}>}
 */
function runAll() {
    var results = [];

    [migrateAccounts, migrateSettings].forEach(function (fn) {
        try {
            results.push(fn());
        } catch (e) {
            results.push({ file: fn.name, error: e.message });
            console.error('[secret-migration] 迁移失败:', e.message);
        }
    });

    results.forEach(function (r) {
        if (r.changed > 0) {
            console.log('[secret-migration] ' + r.file + '：已加密 ' + r.changed + '/' + r.total + ' 个字段');
        }
        if (r.error) {
            console.error('[secret-migration] ' + r.file + '：' + r.error);
        }
    });

    return results;
}

module.exports = {
    runAll: runAll,
    migrateAccounts: migrateAccounts,
    migrateSettings: migrateSettings
};
