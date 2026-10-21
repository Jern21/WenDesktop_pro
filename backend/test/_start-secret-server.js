/**
 * 敏感字段加密测试用的服务启动脚本
 *
 * 在独立端口、独立数据目录下起一个完整服务实例，用于验证：
 *   · 账号接口写入后，磁盘上确实是密文
 *   · 读接口返回的仍是明文（前端要能显示/复制）
 *   · /api/settings 不把 apiKey 明文吐给浏览器
 *
 * 关键点：所有环境变量必须在 require server.js **之前** 设置，
 *        而 APP_DATA_DIR 还必须早于任何 require 了 data-paths 的模块。
 *
 *   node backend/test/_start-secret-server.js 3987
 */
'use strict';

var fs = require('fs');
var path = require('path');

var port = process.argv[2] || '3987';
var dataDir = process.argv[3] || path.join(require('os').tmpdir(), 'wt-secret-http-' + port);
var authDir = path.join(dataDir, 'auth');

fs.mkdirSync(dataDir, { recursive: true });

process.env.PORT = port;
process.env.APP_DATA_DIR = dataDir;
process.env.AUTH_DATA_DIR = authDir;
process.env.AUTH_ENABLED = '1';
process.env.AUTH_TRUST_LOCALHOST = '1';   // 本机请求免登录，测试不用走登录流程
// 刻意不设 APP_SECRET：走「data/.secret 自动生成」这条真实路径

// ---------- 种一份「迁移前」的数据：密码和 apiKey 都是明文 ----------
fs.writeFileSync(path.join(dataDir, 'accounts.json'), JSON.stringify([
    {
        id: 'seed-1',
        platform: 'github',
        accountName: 'seed_user',
        email: 'seed@example.com',
        password: 'PlainSeedPass123',
        remark: '集成测试种子',
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z'
    },
    {
        id: 'seed-2',
        platform: 'other',
        accountName: 'no_pass_user',
        email: '',
        password: '',
        remark: '空密码',
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z'
    }
], null, 2), 'utf-8');

fs.writeFileSync(path.join(dataDir, 'settings.json'), JSON.stringify({
    theme: 'pure-white',
    cleanupDays: 30,
    imageGen: {
        apiUrl: 'https://example.com/v1',
        model: 'gpt-image-1',
        timeout: 60,
        apiKey: 'sk-PlainSeedKey-ABCD1234'
    }
}, null, 2), 'utf-8');

console.log('[test-secret-server] 端口 ' + port + '，数据目录 ' + dataDir);
require('../server.js');
