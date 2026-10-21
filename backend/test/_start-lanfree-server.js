/**
 * 浏览器测试专用服务实例
 *
 * 为什么需要它：
 *   正式环境的本机免登录默认已关闭（AUTH_TRUST_LOCALHOST 要显式设 1），
 *   而无头浏览器跑测试时没有登录态，所有页面都会 302 到登录页，
 *   测试就全红 —— 而且看起来像是「页面坏了」，极难判断。
 *
 * 所以测试单独起一个实例：
 *   · 独立端口（默认 3457），不干扰正在用来开发的 3456
 *   · 本机免登录打开，测试不用处理登录
 *   · 数据目录仍指向真实 backend/data（测试只读为主，与以往做法一致）
 *
 *   node backend/test/_start-lanfree-server.js [port]
 */
'use strict';

var path = require('path');

var port = process.argv[2] || '3457';

process.env.PORT = port;
process.env.AUTH_TRUST_LOCALHOST = '1';   // 无头浏览器没有登录态，本机放行

console.log('[test-server] 端口 ' + port + '，本机免登录已开启（仅测试用）');
require('../server.js');
