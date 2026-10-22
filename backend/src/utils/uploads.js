/**
 * 上传文件路径（单一来源）
 *
 * 新文件落在用户目录：DATA_DIR/users/<user>/uploads/<file>
 * 对外 URL：/uploads/<user>/<file>
 *
 * 旧数据可能仍是 /uploads/<file>，文件在 DATA_DIR/uploads/。
 * 解析时两种都认，避免换数据目录或改用户隔离后附件集体 404。
 *
 * 读路径绝不能 mkdir：否则访问 /uploads/不存在的用户/x 会在磁盘上造出空用户目录。
 */
'use strict';

var fs = require('fs');
var path = require('path');
var dataPaths = require('./data-paths');
var userContext = require('./user-context');

function usernameFromRequest(req) {
    // 会话是这次请求的身份。全局上下文里如果串进了别人的名字，不能盖过它。
    if (req && req.wtSession && req.wtSession.username) {
        return dataPaths.normalizeUsername(req.wtSession.username);
    }
    var user = userContext.get();
    return dataPaths.normalizeUsername(user || 'admin');
}

function looksLikeUsername(value) {
    return /^[a-z0-9][a-z0-9_-]{0,63}$/i.test(String(value || ''));
}

function safeBasename(value) {
    var base = path.basename(String(value == null ? '' : value));
    if (!base || base === '.' || base === '..') return null;
    if (base.indexOf('..') !== -1) return null;
    if (base.indexOf('/') !== -1 || base.indexOf('\\') !== -1) return null;
    return base;
}

function isExistingFile(filePath) {
    try {
        return !!(filePath && fs.existsSync(filePath) && fs.statSync(filePath).isFile());
    } catch (e) {
        return false;
    }
}

function userUploadsPath(username) {
    return path.join(dataPaths.userDataDir(username), 'uploads');
}

function dirForRequest(req) {
    var dir = dataPaths.userUploadsDir(usernameFromRequest(req));
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    return dir;
}

function publicUrl(filename, req) {
    var name = safeBasename(filename);
    if (!name) throw new Error('无效的文件名');
    return '/uploads/' + usernameFromRequest(req) + '/' + name;
}

function parseUploadsUrl(url) {
    if (!url) return null;
    var raw = String(url).split('?')[0];
    var idx = raw.indexOf('/uploads/');
    if (idx === -1) return null;
    var rest = raw.slice(idx + '/uploads/'.length);
    var parts = rest.split('/').filter(Boolean);
    if (!parts.length) return null;

    if (parts.length === 2 && looksLikeUsername(parts[0])) {
        var userFile = safeBasename(parts[1]);
        if (!userFile) return null;
        return { username: dataPaths.normalizeUsername(parts[0]), filename: userFile };
    }
    if (parts.length === 1) {
        var legacyFile = safeBasename(parts[0]);
        if (!legacyFile) return null;
        return { username: null, filename: legacyFile };
    }
    return null;
}

/**
 * 把 /uploads/... URL 解析成绝对路径。
 * 找不到文件时返回「按规则应该在的位置」，由调用方自己判断存在与否。
 */
function resolveFromUrl(url) {
    var parsed = parseUploadsUrl(url);
    if (!parsed) return null;

    if (parsed.username) {
        var scoped = path.join(userUploadsPath(parsed.username), parsed.filename);
        if (isExistingFile(scoped)) return scoped;
        var legacyPrefixed = path.join(dataPaths.UPLOADS_DIR, parsed.filename);
        if (isExistingFile(legacyPrefixed)) return legacyPrefixed;
        return scoped;
    }

    var legacy = path.join(dataPaths.UPLOADS_DIR, parsed.filename);
    if (isExistingFile(legacy)) return legacy;

    var ctxUser = userContext.get();
    if (ctxUser) {
        var inUserDir = path.join(userUploadsPath(ctxUser), parsed.filename);
        if (isExistingFile(inUserDir)) return inUserDir;
    }

    return legacy;
}

function resolveExistingFile(filename, req) {
    var name = safeBasename(filename);
    if (!name) return null;
    var me = usernameFromRequest(req);
    var mine = path.join(userUploadsPath(me), name);
    if (isExistingFile(mine)) return mine;
    // 旧共享目录只属于主账号。trial 不能靠「自己目录没有」删到别人的历史文件。
    if (me !== legacyOwnerUsername()) return null;
    var legacy = path.join(dataPaths.UPLOADS_DIR, name);
    return isExistingFile(legacy) ? legacy : null;
}

/**
 * 当前用户可以删除的那个文件。不属于他时返回 null，调用方不得 unlink。
 * 规则与静态读取一致：用户段必须是自己；老扁平目录只有主账号能碰。
 */
function resolveDeletable(url, req) {
    var parsed = parseUploadsUrl(url);
    if (!parsed) return null;
    var me = usernameFromRequest(req);

    if (parsed.username) {
        if (parsed.username !== me) {
            console.warn('[uploads] 拒绝跨用户删除: ' + me + ' -> ' +
                parsed.username + '/' + parsed.filename);
            return null;
        }
        var mine = path.join(userUploadsPath(me), parsed.filename);
        if (isExistingFile(mine)) return mine;
        if (me !== legacyOwnerUsername()) return null;
        var legacyMine = path.join(dataPaths.UPLOADS_DIR, parsed.filename);
        return isExistingFile(legacyMine) ? legacyMine : null;
    }

    return resolveExistingFile(parsed.filename, req);
}

function unlinkFile(filePath) {
    if (!isExistingFile(filePath)) return false;
    try {
        fs.unlinkSync(filePath);
        return true;
    } catch (e) {
        console.warn('[uploads] 删除失败:', filePath, e.message);
        return false;
    }
}

function deleteByUrl(url, req) {
    return unlinkFile(resolveDeletable(url, req));
}

function deleteByFilename(filename, req) {
    return unlinkFile(resolveExistingFile(filename, req));
}

function attachmentOwnedBy(file, req) {
    if (!file) return false;
    if (file.url) return !!resolveDeletable(file.url, req);
    if (file.filename) return !!resolveExistingFile(file.filename, req);
    return false;
}

/**
 * 老扁平布局（/uploads/<file>，URL 里没有用户名段）是迁移前的共享目录，
 * 归主账号所有。
 *
 * 为什么不能对所有人开放：trial 是后来加的**免密**账号，任何人点一下就进去了。
 * 老目录里躺的是主账号历史积累的合同、简历、海报源文件 —— 一旦放行，
 * 等于把这些东西对所有访客公开，只要猜得到文件名。
 *
 * 用延迟 require：auth 目前不依赖 uploads，但这一层不该成为将来的隐性死锁点。
 */
function legacyOwnerUsername() {
    try {
        var auth = require('./auth');
        var name = auth && typeof auth.getUsername === 'function' ? auth.getUsername() : 'admin';
        return dataPaths.normalizeUsername(name);
    } catch (e) {
        return dataPaths.normalizeUsername('admin');
    }
}

/**
 * 静态读取的权限判定 —— 返回可读的绝对路径，不可读一律返回 null。
 *
 * 这些规则是踩过坑写下来的，不是假设：
 *   1. URL 带用户段 /uploads/<user>/<file>：owner 必须等于当前登录用户。
 *      不一致返回 null（外层当「文件不存在」处理）。
 *      刻意用 404 而不是 403：403 等于告诉探测者「这个文件存在，只是不给你」，
 *      等于帮他确认文件名猜得对不对。
 *   2. 老扁平布局 /uploads/<file>：只有主账号能读。
 *   3. 自己的目录里找不到时，老共享目录的兜底同样只对主账号开放。
 *      （原来 resolveFromUrl 是无条件兜底的，等于留了个绕过口：
 *        trial 请求 /uploads/trial/x 而 x 只在老目录里，照样读得到。）
 */
function resolveReadableUpload(req) {
    var rel = String(req.path || '/').split('?')[0];
    if (rel.charAt(0) !== '/') rel = '/' + rel;

    var parsed = parseUploadsUrl('/uploads' + rel);
    if (!parsed) return null;   // 多层目录 / 非法文件名：直接当不存在

    var me = usernameFromRequest(req);
    var isPrimary = me === legacyOwnerUsername();

    if (parsed.username) {
        if (dataPaths.normalizeUsername(parsed.username) !== me) {
            console.warn('[uploads] 拒绝跨用户读取: ' + me + ' -> ' +
                parsed.username + '/' + parsed.filename);
            return null;
        }
        var mine = path.join(userUploadsPath(parsed.username), parsed.filename);
        if (isExistingFile(mine)) return mine;

        if (!isPrimary) return null;
        var legacyMine = path.join(dataPaths.UPLOADS_DIR, parsed.filename);
        return isExistingFile(legacyMine) ? legacyMine : null;
    }

    // 老扁平 URL /uploads/<file>
    //
    // 这里的归属**不能按目录硬编**，得按文件本身判：
    // 迁移后同一个文件常常是「用户目录一份 + 老共享目录一份」的冗余关系
    // （真实数据就是这样：文件既在 users/trial/uploads/ 也在 data/uploads/，
    //  而数据里存的 URL 还是老格式）。曾经把老目录一刀切成「主账号专属」，
    //  结果 trial 自己的 4 个附件全 404 —— 修越权把用户自己关在了门外。
    //
    // 所以：自己目录里有同名文件 = 这就是我的，放行（优先给用户目录那份）；
    //       没有、又不是主账号 = 拒；主账号再兜底读老目录里的孤本。
    var inMyDir = path.join(userUploadsPath(me), parsed.filename);
    if (isExistingFile(inMyDir)) return inMyDir;

    if (!isPrimary) {
        console.warn('[uploads] 拒绝读取他人/无主的共享文件: ' + me + ' -> ' + parsed.filename);
        return null;
    }
    var legacy = path.join(dataPaths.UPLOADS_DIR, parsed.filename);
    return isExistingFile(legacy) ? legacy : null;
}

function staticHandler() {
    return function (req, res, next) {
        if (req.method !== 'GET' && req.method !== 'HEAD') return next();
        var filePath = resolveReadableUpload(req);
        if (!isExistingFile(filePath)) {
            return res.status(404).type('text/plain; charset=utf-8').send('文件不存在或无权访问');
        }
        return res.sendFile(path.resolve(filePath));
    };
}

module.exports = {
    usernameFromRequest: usernameFromRequest,
    safeBasename: safeBasename,
    dirForRequest: dirForRequest,
    publicUrl: publicUrl,
    parseUploadsUrl: parseUploadsUrl,
    resolveFromUrl: resolveFromUrl,
    resolveReadableUpload: resolveReadableUpload,
    resolveExistingFile: resolveExistingFile,
    resolveDeletable: resolveDeletable,
    deleteByUrl: deleteByUrl,
    deleteByFilename: deleteByFilename,
    attachmentOwnedBy: attachmentOwnedBy,
    staticHandler: staticHandler
};
