'use strict';

// 网页地址和窗口跳转共用此策略；不把 Node 能力提供给远程网页。
function parseServerUrl(value) {
    var url;
    try { url = new URL(String(value).trim()); } catch (_) {
        throw new Error('请填写完整的桌面网页地址，例如 https://work.example.com/app.html');
    }
    var local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
    if (url.protocol !== 'https:' && !(url.protocol === 'http:' && local)) {
        throw new Error('线上地址必须使用 HTTPS；仅本机调试允许 HTTP。');
    }
    if (url.username || url.password) throw new Error('地址中不能包含账号或密码。');
    if (url.pathname === '/') url.pathname = '/app.html';
    return url.href;
}

function isSameSite(target, serverUrl) {
    try { return new URL(target).origin === new URL(serverUrl).origin; } catch (_) { return false; }
}

function isExternalLink(target) {
    try {
        var url = new URL(target);
        return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password;
    } catch (_) { return false; }
}

module.exports = { parseServerUrl: parseServerUrl, isSameSite: isSameSite, isExternalLink: isExternalLink };
