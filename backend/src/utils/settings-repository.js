'use strict';

var dataBackups = require('./data-backups');
var secretBox = require('./secret-box');
var JsonFileStore = require('./json-file-store');

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
    },
    /**
     * 大模型配置。密钥每次读盘都是明文（decrypt 已解开），落盘是 enc:v1: 密文。
     * 这里只声明结构，默认留空 —— 空就意味着"没接大模型"，由 routes/llm.js 判 configured。
     */
    llm: {
        apiUrl: '',
        apiKey: '',
        model: '',
        timeout: 60
    }
};

/**
 * 需要加密/脱敏的字段，一处声明，四处生效（decrypt / encryptCopy / maskSecrets / stripMaskedSecrets）。
 *
 * 以前是「硬编码 settings.imageGen.apiKey」，加第二个密钥时四个函数都要改一遍，
 * 漏一个的后果分别是：明文落盘（encryptCopy 漏）、密钥回传前端（maskSecrets 漏）、
 * 脱敏值把真密钥覆盖成星号（stripMaskedSecrets 漏）。所以改成声明式。
 *
 * maskKey：脱敏时额外写一个布尔位（供前端判断"已配置但我不给你看"）。
 */
var SECRET_PATHS = [
    { path: ['imageGen', 'apiKey'], maskFlag: 'apiKeyConfigured' },
    { path: ['llm', 'apiKey'], maskFlag: 'apiKeyConfigured' }
];

var store = new JsonFileStore('settings', { shape: 'object' });

function cloneValue(value) {
    if (Array.isArray(value)) return value.map(cloneValue);
    if (value && typeof value === 'object') {
        var copy = {};
        Object.keys(value).forEach(function (key) {
            copy[key] = cloneValue(value[key]);
        });
        return copy;
    }
    return value;
}

function deepMerge(target, source) {
    var result = cloneValue(target);
    Object.keys(source || {}).forEach(function (key) {
        if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
            result[key] = deepMerge(result[key] || {}, source[key]);
        } else {
            result[key] = cloneValue(source[key]);
        }
    });
    return result;
}

// ========== 按路径读写（SECRET_PATHS 的支撑） ==========

function readPath(root, path) {
    var node = root;
    for (var i = 0; i < path.length; i++) {
        if (!node || typeof node !== 'object') return undefined;
        node = node[path[i]];
    }
    return node;
}

function writePath(root, path, value) {
    var node = root;
    for (var i = 0; i < path.length - 1; i++) {
        var key = path[i];
        if (!node[key] || typeof node[key] !== 'object') node[key] = {};
        node = node[key];
    }
    node[path[path.length - 1]] = value;
}

/** 对每个「父节点存在且值为字符串」的密钥字段执行 mutate(parent, key) */
function forEachSecret(root, mutate) {
    if (!root || typeof root !== 'object') return;
    SECRET_PATHS.forEach(function (entry) {
        var parentPath = entry.path.slice(0, -1);
        var key = entry.path[entry.path.length - 1];
        var parent = readPath(root, parentPath);
        if (!parent || typeof parent !== 'object') return;
        if (typeof parent[key] !== 'string') return;
        mutate(parent, key);
    });
}

function maskKey(key) {
    var text = String(key || '');
    if (!text) return '';
    if (text.length <= 8) return '****';
    return text.slice(0, 4) + '****' + text.slice(-4);
}

// ========== 加解密 / 脱敏 ==========

function decrypt(settings) {
    forEachSecret(settings, function (parent, key) {
        parent[key] = secretBox.decryptField(parent[key]);
    });
    return settings;
}

function encryptCopy(settings) {
    if (!settings || typeof settings !== 'object') return settings;
    var copy = cloneValue(settings);
    forEachSecret(copy, function (parent, key) {
        parent[key] = secretBox.encrypt(parent[key]);
    });
    return copy;
}

function maskSecrets(settings) {
    var copy = cloneValue(settings || {});
    forEachSecret(copy, function (parent, key) {
        var plain = String(parent[key] || '');
        parent[key] = maskKey(plain);
    });
    // 布尔位单独走一遍：即使密钥为空也要告诉前端「有没有配」
    SECRET_PATHS.forEach(function (entry) {
        if (!entry.maskFlag) return;
        var parentPath = entry.path.slice(0, -1);
        var key = entry.path[entry.path.length - 1];
        var parent = readPath(copy, parentPath);
        if (!parent || typeof parent !== 'object') return;
        parent[entry.maskFlag] = !!String(parent[key] || '');
    });
    return copy;
}

function stripMaskedSecrets(body) {
    if (!body || typeof body !== 'object') return body;
    var result = body;
    SECRET_PATHS.forEach(function (entry) {
        var parentPath = entry.path.slice(0, -1);
        var key = entry.path[entry.path.length - 1];
        var parent = readPath(result, parentPath);
        if (!parent || typeof parent !== 'object') return;
        var incoming = parent[key];
        if (typeof incoming !== 'string' || incoming.indexOf('****') === -1) return;
        if (result === body) result = cloneValue(body);
        var target = readPath(result, parentPath);
        delete target[key];
    });
    return result;
}

// ========== 读写入口 ==========

function read(scope) {
    scope = scope || dataBackups.captureScope();
    var disk = store.read(scope);
    return decrypt(deepMerge(DEFAULT_SETTINGS, disk));
}

function save(settings, options) {
    options = options || {};
    var scope = options.scope || dataBackups.captureScope();
    store.write(encryptCopy(settings), scope, { backup: options.backup });
    return settings;
}

module.exports = {
    DEFAULT_SETTINGS: DEFAULT_SETTINGS,
    SECRET_PATHS: SECRET_PATHS,
    deepMerge: deepMerge,
    read: read,
    save: save,
    maskSecrets: maskSecrets,
    stripMaskedSecrets: stripMaskedSecrets
};
