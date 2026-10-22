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
    }
};

var store = new JsonFileStore('settings', { shape: 'object' });

function deepMerge(target, source) {
    var result = Object.assign({}, target);
    Object.keys(source || {}).forEach(function (key) {
        if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
            result[key] = deepMerge(target[key] || {}, source[key]);
        } else {
            result[key] = source[key];
        }
    });
    return result;
}

function decrypt(settings) {
    if (settings && settings.imageGen && typeof settings.imageGen.apiKey === 'string') {
        settings.imageGen.apiKey = secretBox.decryptField(settings.imageGen.apiKey);
    }
    return settings;
}

function encryptCopy(settings) {
    if (!settings || !settings.imageGen || typeof settings.imageGen.apiKey !== 'string') {
        return settings;
    }
    return Object.assign({}, settings, {
        imageGen: Object.assign({}, settings.imageGen, {
            apiKey: secretBox.encrypt(settings.imageGen.apiKey)
        })
    });
}

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

function stripMaskedSecrets(body) {
    if (!body || !body.imageGen) return body;
    var incoming = body.imageGen.apiKey;
    if (typeof incoming !== 'string' || incoming.indexOf('****') === -1) return body;

    var imageGen = Object.assign({}, body.imageGen);
    delete imageGen.apiKey;
    return Object.assign({}, body, { imageGen: imageGen });
}

module.exports = {
    DEFAULT_SETTINGS: DEFAULT_SETTINGS,
    deepMerge: deepMerge,
    read: read,
    save: save,
    maskSecrets: maskSecrets,
    stripMaskedSecrets: stripMaskedSecrets
};
