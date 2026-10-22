'use strict';

var dataBackups = require('./data-backups');
var secretBox = require('./secret-box');
var JsonFileStore = require('./json-file-store');

var store = new JsonFileStore('accounts', { shape: 'array' });

function read(scope) {
    scope = scope || dataBackups.captureScope();
    return store.read(scope).map(function (account) {
        if (!account || typeof account !== 'object') return account;
        var copy = Object.assign({}, account);
        if (typeof copy.password === 'string') {
            copy.password = secretBox.decryptField(copy.password);
        }
        return copy;
    });
}

function save(accounts, scope) {
    scope = scope || dataBackups.captureScope();
    var toWrite = (accounts || []).map(function (account) {
        if (!account || typeof account !== 'object') return account;
        var copy = Object.assign({}, account);
        if (typeof copy.password === 'string') {
            copy.password = secretBox.encrypt(copy.password);
        }
        return copy;
    });
    store.write(toWrite, scope);
    return accounts;
}

module.exports = {
    read: read,
    save: save
};
