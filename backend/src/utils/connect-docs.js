/**
 * 接入文档仓储
 *
 * 仓库根的 Markdown 接入文档是「喂给外部 Agent」的说明书，
 * 目前只有 GROK_BOT_CONNECTION.md。路由只调这里，不自己 fs 读文件
 * （路由层不许绕仓储直接读文件 —— verify-arch A10）。
 */
'use strict';

var fs = require('fs');
var path = require('path');

var DOC_DIR = path.join(__dirname, '..', '..', '..');

var DOCS = {
    grok: 'GROK_BOT_CONNECTION.md'
};

/**
 * 读一份接入文档。
 * @param {string} key DOCS 里的键（当前只有 'grok'）
 * @returns {{ name: string, content: string }}
 */
function readConnectDoc(key) {
    var name = DOCS[key];
    if (!name) {
        var err = new Error('未知的接入文档：' + key);
        err.status = 404;
        throw err;
    }
    return { name: name, content: fs.readFileSync(path.join(DOC_DIR, name), 'utf8') };
}

module.exports = { readConnectDoc: readConnectDoc };
