/**
 * 一次性校验脚本：确认加密迁移没有丢/改任何字段
 *
 * 做法：迁移前记下每个敏感值的 sha256 指纹 → 跑迁移 → 解密后重新算指纹比对。
 * 指纹只用于比对，不落盘、不打印明文。
 *
 * 用法：node backend/test/verify-secret-migration.js
 */
'use strict';

var fs = require('fs');
var path = require('path');
var crypto = require('crypto');

var DATA_DIR = path.join(__dirname, '..', 'data');
var ACCOUNTS = path.join(DATA_DIR, 'accounts.json');
var SETTINGS = path.join(DATA_DIR, 'settings.json');

var box = require('../src/utils/secret-box');
var migration = require('../src/utils/secret-migration');

function sha(v) {
    return crypto.createHash('sha256').update(String(v)).digest('hex').slice(0, 16);
}

function readJson(p) {
    try { return JSON.parse(fs.readFileSync(p, 'utf-8')); } catch (e) { return null; }
}

var pass = 0, fail = 0;
function check(name, ok, extra) {
    if (ok) { pass++; console.log('PASS  ' + name + (extra ? '  [' + extra + ']' : '')); }
    else { fail++; console.log('FAIL  ' + name + (extra ? '  [' + extra + ']' : '')); }
}

// ---------- 迁移前快照 ----------
var beforeAccounts = readJson(ACCOUNTS) || [];
var beforePass = {};
beforeAccounts.forEach(function (a) { beforePass[a.id] = sha(a.password || ''); });

var beforeSettings = readJson(SETTINGS) || {};
var beforeKey = sha((beforeSettings.imageGen && beforeSettings.imageGen.apiKey) || '');

var plainCount = beforeAccounts.filter(function (a) {
    return a.password && !box.isEncrypted(a.password);
}).length;
console.log('迁移前：' + beforeAccounts.length + ' 条账号，其中明文密码 ' + plainCount + ' 条');

// ---------- 跑迁移 ----------
var results = migration.runAll();
console.log('迁移结果：' + JSON.stringify(results));

// ---------- 迁移后校验 ----------
var rawAccounts = readJson(ACCOUNTS) || [];
check('账号条数未变', rawAccounts.length === beforeAccounts.length,
    rawAccounts.length + ' vs ' + beforeAccounts.length);

var stillPlain = rawAccounts.filter(function (a) { return a.password && !box.isEncrypted(a.password); });
check('落盘不再有明文密码', stillPlain.length === 0, '残留 ' + stillPlain.length + ' 条');

var decryptOk = rawAccounts.every(function (a) {
    return sha(box.decryptField(a.password)) === beforePass[a.id];
});
check('每条密码都能解回原值（指纹一致）', decryptOk);

var rawSettings = readJson(SETTINGS) || {};
var rawKey = (rawSettings.imageGen && rawSettings.imageGen.apiKey) || '';
check('apiKey 已加密', rawKey === '' || box.isEncrypted(rawKey), rawKey.slice(0, 10));
check('apiKey 能解回原值（指纹一致）', sha(box.decryptField(rawKey)) === beforeKey);

// ---------- 幂等 ----------
var second = migration.runAll();
var changedAgain = second.reduce(function (n, r) { return n + (r.changed || 0); }, 0);
check('再跑一次不会重复加密（幂等）', changedAgain === 0, '本次改动 ' + changedAgain);

var rawAccounts2 = readJson(ACCOUNTS) || [];
check('二次迁移后内容不变',
    JSON.stringify(rawAccounts2) === JSON.stringify(rawAccounts));

console.log('');
console.log('通过 ' + pass + ' 项，失败 ' + fail + ' 项');
process.exit(fail === 0 ? 0 : 1);
