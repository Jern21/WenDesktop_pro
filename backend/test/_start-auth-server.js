/**
 * HTTP 层认证测试用的启动脚本
 *
 * 用途：在独立端口、独立 auth 数据目录下启动一个服务实例，
 *      用于验证认证中间件（不干扰正在运行的真实服务）。
 *
 * 关键点：环境变量必须在 require server.js **之前** 设置。
 *        （实测在 Bash 里 `export X=1; node script.js` 的环境变量会丢失，
 *          所以这里用脚本内赋值的方式，而不是依赖外部 export）
 *
 *   node backend/test/_start-auth-server.js 3999
 */
'use strict';

var os = require('os');
var path = require('path');

var port = process.argv[2] || '3999';
var authDir = path.join(os.tmpdir(), 'wt-auth-http-' + port);

process.env.PORT = port;
process.env.AUTH_DATA_DIR = authDir;
process.env.APP_PASSWORD = 'TestPass123';
process.env.AUTH_ENABLED = '1';
// 关闭本机免登录，这样从 127.0.0.1 发起也能验证拦截逻辑
process.env.AUTH_TRUST_LOCALHOST = '0';

console.log('[test-server] 端口 ' + port + '，auth 目录 ' + authDir);
require('../server.js');
