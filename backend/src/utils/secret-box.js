/**
 * 字段级加密（AES-256-GCM）
 *
 * 解决的问题：data/*.json 里有几类「必须能还原」的敏感字段——
 *   账号管理的平台密码、AI 生图的第三方 API Key。
 * 它们不能像登录密码那样做哈希（哈希不可逆），因为要展示/复制给用户、
 * 要拿去做 Bearer 鉴权。所以只能加密，不能单向摘要。
 *
 * 密钥来源（按优先级）：
 *   1. 环境变量 APP_SECRET —— 部署到服务器时用这个，密钥与数据分离存放
 *   2. data/.secret 文件 —— 首次运行自动生成 32 字节随机密钥，权限 0600
 * 两条都没有就会自动创建第 2 种。data/ 已被 .gitignore 排除，密钥不会进版本库。
 *
 * 密文格式：
 *   enc:v1:<base64( iv(12字节) || tag(16字节) || ciphertext )>
 *   · 带版本号是为了以后换算法时能识别旧数据
 *   · 不带 enc: 前缀的值一律按「明文」原样返回 —— 老数据不做迁移也能正常读
 *
 * ⚠️ 密钥丢了就解不回来（GCM 没有后门）。换机器/重装系统时记得一并备份
 *    data/.secret 或 APP_SECRET，否则账号密码会全部变成不可读。
 */
'use strict';

var crypto = require('crypto');
var fs = require('fs');
var path = require('path');
var dataPaths = require('./data-paths');

var DATA_DIR = dataPaths.DATA_DIR;
var KEY_FILE = path.join(DATA_DIR, '.secret');

var PREFIX = 'enc:v1:';
var ALGO = 'aes-256-gcm';
var IV_LEN = 12;
var TAG_LEN = 16;

var cachedKey = null;
var warnedLostKey = false;

function ensureDir() {
    if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
    }
}

/**
 * 从 APP_SECRET 派生 32 字节密钥。
 * 用 scrypt 而不是直接截断：用户可能填 "123456" 这种短串，直接当密钥太弱。
 */
function deriveFromSecret(secret) {
    return crypto.scryptSync(String(secret), 'wt-secret-box-v1', 32);
}

function readOrCreateKeyFile() {
    try {
        if (fs.existsSync(KEY_FILE)) {
            var raw = fs.readFileSync(KEY_FILE, 'utf-8').trim();
            var buf = Buffer.from(raw, 'base64');
            if (buf.length === 32) return buf;
            console.error('[secret-box] data/.secret 内容长度不对（期望 32 字节），将重新生成' +
                ' —— 旧密文会解不开，请从备份恢复该文件');
        }
    } catch (e) {
        console.error('[secret-box] 读取 data/.secret 失败:', e.message);
    }

    ensureDir();
    var key = crypto.randomBytes(32);
    fs.writeFileSync(KEY_FILE, key.toString('base64'), 'utf-8');
    try {
        // Windows 上 chmod 基本无效，Posix 上能挡住同机其他用户
        fs.chmodSync(KEY_FILE, 0o600);
    } catch (e) { /* 忽略：某些文件系统不支持 */ }
    console.log('[secret-box] 已生成新的本地密钥 data/.secret（请勿提交到版本库，换机器请一并备份）');
    return key;
}

function getKey() {
    if (cachedKey) return cachedKey;
    if (process.env.APP_SECRET) {
        cachedKey = deriveFromSecret(process.env.APP_SECRET);
    } else {
        cachedKey = readOrCreateKeyFile();
    }
    return cachedKey;
}

function isEncrypted(value) {
    return typeof value === 'string' && value.indexOf(PREFIX) === 0;
}

/**
 * 加密。空值原样返回（'' / null / undefined 不加密，避免存一堆无意义的密文）。
 *
 * 幂等判断不能只看前缀：用户填的密码有可能**本身就是** `enc:v1:` 开头的字符串，
 * 只看前缀会把它当成密文跳过加密，之后读出来变成 null（数据丢失）。
 * 所以要求「前缀对 + 真能解开」两个条件同时成立，才认定已经是密文。
 */
function encrypt(plain) {
    if (plain === undefined || plain === null || plain === '') return plain;
    var text = String(plain);
    if (isEncrypted(text) && decrypt(text) !== null) return text;

    var iv = crypto.randomBytes(IV_LEN);
    var cipher = crypto.createCipheriv(ALGO, getKey(), iv);
    var ct = Buffer.concat([cipher.update(text, 'utf-8'), cipher.final()]);
    var tag = cipher.getAuthTag();
    return PREFIX + Buffer.concat([iv, tag, ct]).toString('base64');
}

/**
 * 解密。明文（无前缀）原样返回，兼容老数据。
 * 解不开（密钥换了/数据被改过）返回 null 并打印一次警告，由调用方决定怎么兜底。
 */
function decrypt(value) {
    if (value === undefined || value === null || value === '') return value;
    var text = String(value);
    if (!isEncrypted(text)) return text;   // 老数据：明文，直接放行

    try {
        var buf = Buffer.from(text.slice(PREFIX.length), 'base64');
        if (buf.length <= IV_LEN + TAG_LEN) throw new Error('密文长度异常');
        var iv = buf.subarray(0, IV_LEN);
        var tag = buf.subarray(IV_LEN, IV_LEN + TAG_LEN);
        var ct = buf.subarray(IV_LEN + TAG_LEN);
        var decipher = crypto.createDecipheriv(ALGO, getKey(), iv);
        decipher.setAuthTag(tag);
        return Buffer.concat([decipher.update(ct), decipher.final()]).toString('utf-8');
    } catch (e) {
        if (!warnedLostKey) {
            warnedLostKey = true;
            console.error('[secret-box] 解密失败（' + e.message + '）：' +
                '通常是 APP_SECRET 或 data/.secret 变了。相关字段会被当作空值处理，' +
                '如需找回请恢复原来的密钥文件。');
        }
        return null;
    }
}

/**
 * 给「读 JSON → 解密字段」用的小工具：拿到值就解密，解不开就当空串。
 */
function decryptField(value) {
    var out = decrypt(value);
    return out === null ? '' : out;
}

module.exports = {
    encrypt: encrypt,
    decrypt: decrypt,
    decryptField: decryptField,
    isEncrypted: isEncrypted,
    KEY_FILE: KEY_FILE,
    get usingEnvSecret() { return !!process.env.APP_SECRET; }
};
