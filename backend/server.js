/**
 * 文的项目工作台 - 后端服务器入口
 *
 * 功能：
 *   1. 提供 RESTful API（/api/*）
 *   2. 托管前端静态文件（/）
 *   3. 支持 CORS 跨域
 *   4. 统一 JSON body 解析
 *
 * 启动：
 *   cd backend && npm install && npm start
 *   默认端口：3456
 *   访问：http://localhost:3456
 */
'use strict';

var express = require('express');
var cors = require('cors');
var path = require('path');
var fs = require('fs');
var auth = require('./src/utils/auth');

var app = express();
var PORT = process.env.PORT || 3456;

// ========== 认证初始化（必须在挂载路由前完成） ==========
var authInit = auth.init();

// ========== 存量敏感字段加密迁移 ==========
// 把账号密码、AI 生图 API Key 从明文转成密文。幂等，每次启动跑一遍没有副作用。
// 放在路由挂载之前，保证任何一次请求读到的都已经是加密后的数据。
require('./src/utils/secret-migration').runAll();

// ========== 中间件 ==========

// CORS 跨域
// 默认放开（桌面本机开发）。移动端 PWA 在独立端口 / 真机调试时，可设置：
//   CORS_ORIGINS=http://localhost:3460,http://127.0.0.1:3460,http://192.168.x.x:3460
// 白名单模式会启用 credentials，便于 Cookie + Bearer 并存。
(function () {
    var raw = process.env.CORS_ORIGINS;
    if (!raw || !String(raw).trim()) {
        app.use(cors());
        return;
    }
    var allowed = String(raw).split(',').map(function (s) { return s.trim(); }).filter(Boolean);
    app.use(cors({
        origin: function (origin, callback) {
            // 非浏览器客户端（无 Origin）或白名单内
            if (!origin || allowed.indexOf(origin) !== -1) {
                return callback(null, true);
            }
            return callback(new Error('CORS: Origin not allowed: ' + origin));
        },
        credentials: true
    }));
    console.log('[CORS] 已启用白名单: ' + allowed.join(', '));
})();

// JSON body 解析（文件上传走 multipart/form-data，JSON 仅存 URL 引用）
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));

// 请求日志
app.use(function (req, res, next) {
    var ts = new Date().toISOString();
    console.log('[' + ts + '] ' + req.method + ' ' + req.url);
    next();
});

// ========== 认证路由（必须挂在 apiGuard 之前，否则登录接口自己会被拦） ==========

app.use('/api/auth', require('./src/routes/auth'));

// 其余所有 /api/* 请求必须已登录
app.use('/api', auth.apiGuard());

// ========== API 路由 ==========

app.use('/api/orders', require('./src/routes/orders'));
app.use('/api/customers', require('./src/routes/customers'));
app.use('/api/quotes', require('./src/routes/quotes'));
app.use('/api/posters', require('./src/routes/posters'));
app.use('/api/projects', require('./src/routes/projects'));
app.use('/api/platform-posts', require('./src/routes/platform-posts'));
app.use('/api/memos', require('./src/routes/memos'));
app.use('/api/reminders', require('./src/routes/reminders'));
app.use('/api/resume', require('./src/routes/resume'));
app.use('/api/upload', require('./src/routes/upload'));
app.use('/api/settings', require('./src/routes/settings'));
app.use('/api/stats', require('./src/routes/stats'));
app.use('/api/image-gen', require('./src/routes/image-gen'));
app.use('/api/accounts', require('./src/routes/accounts'));
app.use('/api/bookmarks', require('./src/routes/bookmarks'));
app.use('/api/bug-reports', require('./src/routes/bug-reports'));

// API 健康检查
app.get('/api/health', function (req, res) {
    res.json({
        success: true,
        data: {
            status: 'ok',
            service: 'wen-workbench-backend',
            version: '1.0.0',
            uptime: process.uptime(),
            timestamp: new Date().toISOString()
        }
    });
});

// ========== 静态文件托管 ==========

var frontendDir = path.join(__dirname, '..', 'frontend');

// 页面访问守卫：未登录时导航请求跳登录页，程序化请求返回 401
// 静态资源（/assets /css /js）在守卫内部放行，否则登录页无法加载样式
app.use(auth.pageGuard());

// ========== 首页入口 ==========
// 旧多页文档（frontend/index.html + pages/**.html）已全部删除，现在只认 app.html。
// `/index.html` 继续分流的唯一原因是老书签别 404。
var spaEntryPath = path.join(frontendDir, 'app.html');

app.get(['/', '/index.html'], function (req, res, next) {
    if (!fs.existsSync(spaEntryPath)) return next();
    res.sendFile(spaEntryPath);
});

// 版本日志（仓库根目录 CHANGELOG.json，与 GitHub Raw 同源）
app.get('/CHANGELOG.json', function (req, res) {
    var changelogPath = path.join(__dirname, '..', 'CHANGELOG.json');
    res.type('json');
    res.sendFile(changelogPath, function (err) {
        if (err) res.status(404).json({ error: 'CHANGELOG.json not found' });
    });
});

// 托管 frontend 下的静态资源
app.use(express.static(frontendDir));

// 托管上传的文件（图片、PDF 等）
var uploadsDir = path.join(__dirname, 'data', 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}
app.use('/uploads', express.static(uploadsDir));

// SPA 路由回退：所有非 /api 的 GET 请求都返回对应文件，找不到就回退到 app.html
//
// 回退目标说明（重要）：
//   以前这里回退到 index.html —— 那是个完整的旧页面。
//   新架构的 SPA 路由是 /orders /settings 这种「一层路径」，
//   它们既不是真实文件、也没有 .html，若还回退到 index.html，
//   用户刷新 /orders 会看到「旧版首页」，而不是订单页。
//   所以未命中任何文件时回退到 app.html，由前端路由自己决定渲染哪个视图
//   （包括真正不存在的路径 → 前端 404 视图）。

app.get('*', function (req, res, next) {
    // 跳过 API 请求
    if (req.url.startsWith('/api/')) {
        return next();
    }

    var spaEntry = spaEntryPath;
    var hasSpa = fs.existsSync(spaEntry);

    // 尝试匹配实际文件
    var filePath = path.join(frontendDir, req.path);

    // 如果路径以 / 结尾，尝试 index.html
    if (req.path.endsWith('/')) {
        filePath = path.join(filePath, 'index.html');
    }

    // 如果文件存在，直接发送
    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
        return res.sendFile(filePath);
    }

    // 尝试加 .html 后缀
    if (fs.existsSync(filePath + '.html')) {
        return res.sendFile(filePath + '.html');
    }

    // 回退到新 SPA 入口
    if (hasSpa) {
        return res.sendFile(spaEntry);
    }

    // 连 app.html 都没有 —— 前端产物没部署全，明确报 404 而不是 500
    return res.status(404).type('text/plain; charset=utf-8')
        .send('前端入口 app.html 不存在，请检查 frontend 目录是否完整');
});

// ========== 全局错误处理 ==========

app.use(function (err, req, res, next) {
    console.error('[Server Error]', err);
    res.status(500).json({
        success: false,
        error: err.message || '服务器内部错误'
    });
});

// ========== 启动服务器 ==========

app.listen(PORT, function () {
    console.log('');
    console.log('========================================');
    console.log('  文的项目工作台 - 后端服务已启动');
    console.log('========================================');
    console.log('  前端地址: http://localhost:' + PORT);
    console.log('  API 地址: http://localhost:' + PORT + '/api');
    console.log('  健康检查: http://localhost:' + PORT + '/api/health');
    console.log('----------------------------------------');

    if (!auth.enabled) {
        console.log('  认证: 已关闭 (AUTH_ENABLED=0) —— 不建议在公网环境使用');
    } else {
        console.log('  认证: 已开启');
        console.log('  本机免登录: ' + (auth.trustLocalhost
            ? '是（AUTH_TRUST_LOCALHOST=1）'
            : '否（本机也需用户名+密码，默认）'));

        if (authInit.generated && authInit.password) {
            console.log('');
            console.log('  ★ 首次启动，已自动生成登录账号：');
            console.log('');
            console.log('    用户名: ' + (authInit.username || 'admin'));
            console.log('    密码:   ' + authInit.password);
            console.log('');
            console.log('    已保存到 backend/data/auth.json');
            console.log('    也可用环境变量 APP_USERNAME / APP_PASSWORD 指定');
        }
        console.log('');
        console.log('  关闭认证: AUTH_ENABLED=0');
        console.log('  恢复本机免登录: AUTH_TRUST_LOCALHOST=1');
        if (auth.trialLoginEnabled && auth.trialLoginEnabled()) {
            console.log('  试用免密登录: 用户名 ' + auth.getTrialUsername() + '（关闭: TRIAL_LOGIN=0）');
        }
    }

    console.log('========================================');
    console.log('');
});
