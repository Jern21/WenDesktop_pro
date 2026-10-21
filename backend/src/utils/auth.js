/**
 * 认证模块
 *
 * 设计目标（对应文总的需求：手机/电脑都能用，后续要部署服务器）：
 *   1. 默认开启准入控制，不再让 /api/* 裸奔
 *   2. **本机访问免登录**（AUTH_TRUST_LOCALHOST，默认开）—— 桌面日常使用完全无感，
 *      只有从局域网或公网来的请求才要求密码
 *   3. 不引入 express-session 等依赖：用 HMAC 签名的无状态 token 放在 httpOnly cookie
 *   4. 密码不落地明文：scrypt + 随机 salt 存哈希
 *   5. 密码一旦修改，已签发的 token 立即全部失效（签名密钥派生自密码哈希）
 *
 * 密码来源优先级：
 *   环境变量 APP_PASSWORD  >  data/auth.json  >  首次启动自动生成并打印到控制台
 *
 * 关闭准入控制：AUTH_ENABLED=0（仅建议在完全可信的本机环境临时使用）
 */
'use strict';

var crypto = require('crypto');
var fs = require('fs');
var path = require('path');

// 支持用 AUTH_DATA_DIR 覆盖数据目录，便于测试时隔离，不污染真实配置
var DATA_DIR = process.env.AUTH_DATA_DIR || path.join(__dirname, '..', '..', 'data');
var AUTH_FILE = path.join(DATA_DIR, 'auth.json');

var COOKIE_NAME = 'wt_auth';
var DEFAULT_TTL_MS = 30 * 24 * 60 * 60 * 1000;   // 30 天

var AUTH_ENABLED = process.env.AUTH_ENABLED !== '0';
var TRUST_LOCALHOST = process.env.AUTH_TRUST_LOCALHOST !== '0';

var state = null;   // { salt, hash, createdAt, updatedAt, generated }

// ========== 存储 ==========

function ensureDir() {
    if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
    }
}

function readAuthFile() {
    try {
        if (!fs.existsSync(AUTH_FILE)) return null;
        var raw = fs.readFileSync(AUTH_FILE, 'utf-8');
        var data = JSON.parse(raw);
        if (!data || !data.salt || !data.hash) return null;
        return data;
    } catch (e) {
        console.error('[auth] 读取 auth.json 失败:', e.message);
        return null;
    }
}

function writeAuthFile(data) {
    ensureDir();
    // 原子写，避免写一半断电损坏
    var tmp = AUTH_FILE + '.' + process.pid + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf-8');
    fs.renameSync(tmp, AUTH_FILE);
}

// ========== 密码 ==========

function hashPassword(password, salt) {
    return crypto.scryptSync(String(password), salt, 64).toString('hex');
}

function timingSafeEqualStr(a, b) {
    var bufA = Buffer.from(String(a), 'utf-8');
    var bufB = Buffer.from(String(b), 'utf-8');
    if (bufA.length !== bufB.length) return false;
    return crypto.timingSafeEqual(bufA, bufB);
}

function generatePassword(length) {
    // 去掉容易混淆的 0/O/1/l/I
    var alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
    var bytes = crypto.randomBytes(length || 12);
    var out = '';
    for (var i = 0; i < bytes.length; i++) {
        out += alphabet[bytes[i] % alphabet.length];
    }
    return out;
}

/**
 * 初始化：决定密码从哪来
 * @returns {{generated: boolean, password: string|null}}
 */
function init() {
    var existing = readAuthFile();

    // 1. 环境变量优先（部署时用这个）
    if (process.env.APP_PASSWORD) {
        var envPassword = process.env.APP_PASSWORD;
        // 环境变量与文件不一致时以环境变量为准，并回写
        if (!existing || !verifyAgainst(envPassword, existing)) {
            var salt = crypto.randomBytes(16).toString('hex');
            existing = {
                salt: salt,
                hash: hashPassword(envPassword, salt),
                createdAt: existing ? existing.createdAt : new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                source: 'env'
            };
            writeAuthFile(existing);
        }
        state = existing;
        return { generated: false, password: null };
    }

    // 2. 已有配置文件
    if (existing) {
        state = existing;
        return { generated: false, password: null };
    }

    // 3. 首次启动：生成随机密码
    var newSalt = crypto.randomBytes(16).toString('hex');
    var password = generatePassword(12);
    var data = {
        salt: newSalt,
        hash: hashPassword(password, newSalt),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        source: 'generated'
    };
    writeAuthFile(data);
    state = data;
    return { generated: true, password: password };
}

function verifyAgainst(password, record) {
    if (!record) return false;
    var hash = hashPassword(password, record.salt);
    return timingSafeEqualStr(hash, record.hash);
}

function verifyPassword(password) {
    if (!state) return false;
    return verifyAgainst(password, state);
}

/**
 * 修改密码
 * @returns {boolean} 是否成功
 */
function changePassword(oldPassword, newPassword) {
    if (!verifyPassword(oldPassword)) return false;
    if (!newPassword || String(newPassword).length < 6) return false;

    var salt = crypto.randomBytes(16).toString('hex');
    state = {
        salt: salt,
        hash: hashPassword(newPassword, salt),
        createdAt: state ? state.createdAt : new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        source: 'manual'
    };
    writeAuthFile(state);
    return true;
}

// ========== Token ==========

/**
 * 签名密钥派生自密码哈希 —— 改密码后旧 token 自动失效
 */
function signingSecret() {
    if (!state) return 'no-auth-state';
    return crypto.createHash('sha256')
        .update('wt-auth|' + state.salt + '|' + state.hash)
        .digest();
}

function issueToken(ttlMs) {
    var expires = Date.now() + (ttlMs || DEFAULT_TTL_MS);
    var payload = String(expires);
    var sig = crypto.createHmac('sha256', signingSecret())
        .update(payload)
        .digest('base64url');
    return payload + '.' + sig;
}

function verifyToken(token) {
    if (!token || typeof token !== 'string') return false;
    var idx = token.indexOf('.');
    if (idx === -1) return false;

    var payload = token.slice(0, idx);
    var sig = token.slice(idx + 1);

    var expected = crypto.createHmac('sha256', signingSecret())
        .update(payload)
        .digest('base64url');

    if (!timingSafeEqualStr(sig, expected)) return false;

    var expires = Number(payload);
    return isFinite(expires) && Date.now() < expires;
}

// ========== 请求辅助 ==========

function parseCookies(req) {
    var header = req.headers && req.headers.cookie;
    var out = {};
    if (!header) return out;
    header.split(';').forEach(function (pair) {
        var i = pair.indexOf('=');
        if (i === -1) return;
        var key = pair.slice(0, i).trim();
        var val = pair.slice(i + 1).trim();
        try {
            out[key] = decodeURIComponent(val);
        } catch (e) {
            out[key] = val;
        }
    });
    return out;
}

function getTokenFromRequest(req) {
    var cookies = parseCookies(req);
    if (cookies[COOKIE_NAME]) return cookies[COOKIE_NAME];
    // 兼容 Bearer（便于命令行/脚本调用）
    var auth = req.headers && req.headers.authorization;
    if (auth && auth.indexOf('Bearer ') === 0) {
        return auth.slice(7).trim();
    }
    return null;
}

function isLoopback(req) {
    var ip = req.ip || (req.connection && req.connection.remoteAddress) || '';
    // 去掉 IPv4-mapped IPv6 前缀
    if (ip.indexOf('::ffff:') === 0) ip = ip.slice(7);
    return ip === '127.0.0.1' || ip === '::1' || ip === 'localhost';
}

function isAuthenticated(req) {
    if (!AUTH_ENABLED) return true;
    if (TRUST_LOCALHOST && isLoopback(req)) return true;
    return verifyToken(getTokenFromRequest(req));
}

function setCookie(res, req, maxAgeMs) {
    var token = issueToken(maxAgeMs);
    var parts = [
        COOKIE_NAME + '=' + encodeURIComponent(token),
        'Path=/',
        'HttpOnly',
        'SameSite=Lax',
        'Max-Age=' + Math.floor((maxAgeMs || DEFAULT_TTL_MS) / 1000)
    ];
    // 反代或直连 https 时加 Secure
    var forwardedProto = req.headers['x-forwarded-proto'];
    if (req.secure || forwardedProto === 'https') {
        parts.push('Secure');
    }
    res.setHeader('Set-Cookie', parts.join('; '));
    return token;
}

function clearCookie(res) {
    res.setHeader('Set-Cookie',
        COOKIE_NAME + '=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0');
}

// ========== 中间件 ==========

/**
 * 无需登录即可访问的路径
 *   静态资源必须放行，否则登录页自己都加载不出来。
 *   注意 /uploads/（用户上传素材）与 /pages/、/views/ 都是受保护的。
 */
var PUBLIC_PATHS = ['/favicon.ico', '/login.html', '/login'];
var PUBLIC_PREFIXES = ['/assets/', '/css/', '/js/'];

function isPublicPath(p) {
    if (PUBLIC_PATHS.indexOf(p) !== -1) return true;
    for (var i = 0; i < PUBLIC_PREFIXES.length; i++) {
        if (p.indexOf(PUBLIC_PREFIXES[i]) === 0) return true;
    }
    return false;
}

/**
 * 页面访问守卫
 *   浏览器导航（Accept 含 text/html）→ 重定向到登录页
 *   程序化请求（fetch / XHR）→ 返回 401 JSON，避免把登录页 HTML 当成数据渲染
 */
function pageGuard() {
    return function (req, res, next) {
        if (!AUTH_ENABLED) return next();
        if (TRUST_LOCALHOST && isLoopback(req)) return next();
        if (isPublicPath(req.path)) return next();
        if (verifyToken(getTokenFromRequest(req))) return next();

        var accept = req.headers.accept || '';
        if (accept.indexOf('text/html') !== -1) {
            return res.redirect('/login.html?next=' + encodeURIComponent(req.originalUrl || '/'));
        }
        return res.status(401).json({
            success: false,
            error: '未登录或登录已过期',
            code: 'UNAUTHORIZED'
        });
    };
}

/**
 * API 守卫：未登录返回 401 JSON
 */
function apiGuard() {
    return function (req, res, next) {
        if (!AUTH_ENABLED) return next();
        // 健康检查不涉及任何数据，放行便于监控/探活
        if (req.originalUrl === '/api/health') return next();
        if (TRUST_LOCALHOST && isLoopback(req)) return next();
        if (verifyToken(getTokenFromRequest(req))) return next();

        res.status(401).json({
            success: false,
            error: '未登录或登录已过期',
            code: 'UNAUTHORIZED'
        });
    };
}

// ========== 导出 ==========

module.exports = {
    init: init,
    verifyPassword: verifyPassword,
    changePassword: changePassword,
    issueToken: issueToken,
    verifyToken: verifyToken,
    isAuthenticated: isAuthenticated,
    isLoopback: isLoopback,
    setCookie: setCookie,
    clearCookie: clearCookie,
    pageGuard: pageGuard,
    apiGuard: apiGuard,
    COOKIE_NAME: COOKIE_NAME,
    DEFAULT_TTL_MS: DEFAULT_TTL_MS,
    get enabled() { return AUTH_ENABLED; },
    get trustLocalhost() { return TRUST_LOCALHOST; }
};
