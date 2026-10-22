/**
 * 大模型 / 小柴犬探针专用服务实例
 *
 * 为什么单独起一个，而不是用 3457（_start-lanfree-server.js）：
 *   3457 的数据目录指向真实 backend/data。探针里会点「保存配置」，
 *   那会把文总真实的小柴配置（或者空配置）覆盖掉。
 *   这里用临时数据目录 + 独立的 APP_USERNAME，随便写。
 *
 *   node backend/test/_start-llm-probe-server.js [port]
 *
 * 默认 3461（避开开发用的 3456 和浏览器测试用的 3457）。
 */
'use strict';

var fs = require('fs');
var os = require('os');
var path = require('path');

var port = process.argv[2] || '3461';
var dataDir = process.argv[3] || path.join(os.tmpdir(), 'wt-llm-probe-' + port);

fs.mkdirSync(path.join(dataDir, 'users', 'probe'), { recursive: true });

process.env.PORT = port;
process.env.APP_DATA_DIR = dataDir;
process.env.AUTH_DATA_DIR = path.join(dataDir, 'auth');
process.env.APP_USERNAME = 'probe';
process.env.AUTH_TRUST_LOCALHOST = '1';   // 无头浏览器没有登录态
// 不设 APP_SECRET：走 data/.secret 自动生成的真实路径
// 不设 llm 配置：探针默认要验证「未接入大模型」那条路径
// 不设 USER_SCOPE_MIGRATE：那是手动的一次性操作

console.log('[llm-probe-server] 端口 ' + port + '，临时数据目录 ' + dataDir);
require('../server.js');
