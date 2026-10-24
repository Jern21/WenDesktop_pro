'use strict';

/**
 * GrokBot 对话消息仓储 —— /api/grok-messages 的落盘层
 *
 * 每个用户一份 JSON 数组文件（scope 自动跟随 userContext）。
 * role：'bot'（Grok 推入）/ 'user'（对话窗口里发出）。
 * 容量封顶，超了裁最老的 —— 这是对话流，不是账本。
 */

var crypto = require('crypto');
var JsonFileStore = require('./json-file-store');

var MAX_MESSAGES = 300;

var store = new JsonFileStore('grok-messages', { shape: 'array' });

function list() {
    return store.read();
}

/**
 * @param {string} role 'bot' | 'user'
 * @param {string} text 消息正文
 * @returns {{id:string, role:string, text:string, at:string}}
 */
function append(role, text) {
    var msgs = store.read();
    var msg = {
        id: 'm' + Date.now().toString(36) + crypto.randomBytes(3).toString('hex'),
        role: role,
        text: text,
        at: new Date().toISOString()
    };
    msgs.push(msg);
    if (msgs.length > MAX_MESSAGES) {
        msgs = msgs.slice(-MAX_MESSAGES);
    }
    store.write(msgs);
    return msg;
}

function clear() {
    store.write([]);
}

module.exports = {
    list: list,
    append: append,
    clear: clear,
    MAX_MESSAGES: MAX_MESSAGES
};
