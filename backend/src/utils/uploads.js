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
    var user = userContext.get();
    if (!user && req && req.wtSession && req.wtSession.username) {
        user = req.wtSession.username;
    }
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
    var candidates = [
        path.join(userUploadsPath(usernameFromRequest(req)), name),
        path.join(dataPaths.UPLOADS_DIR, name)
    ];
    for (var i = 0; i < candidates.length; i++) {
        if (isExistingFile(candidates[i])) return candidates[i];
    }
    return null;
}

function deleteByUrl(url) {
    var filePath = resolveFromUrl(url);
    if (!isExistingFile(filePath)) return false;
    try {
        fs.unlinkSync(filePath);
        return true;
    } catch (e) {
        console.warn('[uploads] 删除失败:', filePath, e.message);
        return false;
    }
}

function deleteByFilename(filename, req) {
    var filePath = resolveExistingFile(filename, req);
    if (!filePath) return false;
    try {
        fs.unlinkSync(filePath);
        return true;
    } catch (e) {
        console.warn('[uploads] 删除失败:', filePath, e.message);
        return false;
    }
}

function staticHandler() {
    return function (req, res, next) {
        if (req.method !== 'GET' && req.method !== 'HEAD') return next();
        var rel = String(req.path || '/').split('?')[0];
        if (rel.charAt(0) !== '/') rel = '/' + rel;
        var filePath = resolveFromUrl('/uploads' + rel);
        if (!isExistingFile(filePath)) {
            return res.status(404).type('text/plain; charset=utf-8').send('文件不存在');
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
    resolveExistingFile: resolveExistingFile,
    deleteByUrl: deleteByUrl,
    deleteByFilename: deleteByFilename,
    staticHandler: staticHandler
};
