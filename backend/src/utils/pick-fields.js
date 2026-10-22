/**
 * 从请求体里挑白名单字段。
 * 白名单外的键（含 id / createdAt）进 ignored，不进 patch。
 */
'use strict';

function pickFields(body, allowed) {
    body = (body && typeof body === 'object' && !Array.isArray(body)) ? body : {};
    allowed = allowed || [];
    var fields = {};
    var ignored = [];

    Object.keys(body).forEach(function (key) {
        if (allowed.indexOf(key) === -1) {
            ignored.push(key);
            return;
        }
        fields[key] = body[key];
    });

    return { fields: fields, ignored: ignored };
}

function warnIgnored(scope, ignored) {
    if (!ignored || !ignored.length) return;
    console.warn('[' + scope + '] 忽略非法字段:', ignored.join(', '));
}

module.exports = {
    pickFields: pickFields,
    warnIgnored: warnIgnored
};
