/**
 * 前端结构约束测试（SPA 架构）
 *
 * 说明：这个文件原先断言的是「MPA 时代」的结构 ——
 *   `frontend/pages/content/project.html` 里用 <script src> 引入 project-page.js。
 * 那个整页在 SPA 改造中已经删除，测试于是变成 ENOENT 红灯（一直挂着没人修），
 * 而且它断言的契约本身也已经不是现在的架构。
 *
 * 现在守住 SPA 下真正会出问题的三件事：
 *   1. **单一入口**：只有 app.html 一个整页，pages/content 下不再有整页 HTML；
 *   2. **视图 CSS / 脚本契约**：project-page.js 必须暴露 __projectPage，
 *      且 window.openEditForm 的赋值必须在 exposeGlobals() 里 ——
 *      顶层赋值会在视图卸载时被 restoreGlobals() 回收，第二次进入就失效
 *      （这个 bug 实际发生过：点"编辑项目"报 openEditForm is not defined）；
 *   3. **视图侧**：views/project.js 每次 mount 都要重新暴露，并把契约对象
 *      抓进自己的闭包（不能只依赖 window 上的那个引用）。
 */
'use strict';

var fs = require('fs');
var path = require('path');
var test = require('node:test');
var assert = require('node:assert/strict');

var ROOT = path.join(__dirname, '..', '..');
var FRONTEND = path.join(ROOT, 'frontend');

function read(rel) {
    return fs.readFileSync(path.join(FRONTEND, rel), 'utf-8');
}

function exists(rel) {
    return fs.existsSync(path.join(FRONTEND, rel));
}

test('单一入口：app.html 是唯一整页，且引入了 SPA 核心与各视图', function () {
    assert.ok(exists('app.html'), 'frontend/app.html 必须存在');

    var html = read('app.html');
    [
        'js/core/view.js',
        'js/core/router.js',
        'js/views/project.js'
    ].forEach(function (src) {
        assert.match(html, new RegExp('src="' + src.replace(/[.\/]/g, '\\$&') + '"'), 'app.html 应引入 ' + src);
    });

    // project-page.js 不在 app.html 里静态引入：它由 views/project.js 按需加载
    assert.doesNotMatch(html, /src="js\/project-page\.js"/,
        'project-page.js 应由视图动态加载，不要塞进入口页');
});

test('旧 MPA 整页已清理：pages/content 下不应再有整页 HTML', function () {
    // SPA 改造后仍允许存在的是「片段模板」（如 project-form.html 由 JS 动态 fetch），
    // 不允许的是曾经作为独立导航目标的整页。这里用名单锁死已删的那些。
    var removedPages = [
        'pages/content/project.html',
        'pages/content/orders.html',
        'pages/content/customer.html',
        'pages/content/dashboard.html',
        'pages/content/stats.html',
        'pages/content/accounts.html'
    ];
    removedPages.forEach(function (rel) {
        assert.equal(exists(rel), false, rel + ' 已被 SPA 取代，不应回退成整页');
    });
});

test('project/page.js 暴露 __projectPage 契约（init + exposeGlobals）', function () {
    var script = read('js/project/page.js');
    var api = read('js/project/api.js');

    assert.match(api, /list:\s*function/, '列表请求在 projectsApi');
    assert.match(api, /api\.call\(url, options\)/, '项目请求走公共 api.call');
    assert.match(script, /function\s+exposeGlobals\s*\(/, '必须有可重复执行的 exposeGlobals()');
    assert.match(script, /window\.__projectPage\s*=\s*\{/, '必须暴露 __projectPage 供视图取用');
    assert.match(script, /exposeGlobals\s*:\s*exposeGlobals/, '__projectPage 上要挂 exposeGlobals');
    assert.match(script, /init\s*:\s*init/, '__projectPage 上要挂 init');
});

test('window.openEditForm 的赋值必须在 exposeGlobals() 内部，不能在顶层', function () {
    var script = read('js/project/page.js');

    var exposeIdx = script.indexOf('function exposeGlobals');
    // 只认「赋值」，不要被按钮字符串里的 onclick="window.openEditForm(null)" 干扰
    var assignIdx = script.indexOf('window.openEditForm =');

    assert.ok(exposeIdx !== -1, '找不到 exposeGlobals 定义');
    assert.ok(assignIdx !== -1, '找不到 window.openEditForm 赋值');
    assert.ok(assignIdx > exposeIdx,
        'window.openEditForm 必须写在 exposeGlobals() 之后 —— ' +
        '顶层赋值会在 restoreGlobals() 里被回收，第二次进入项目页就失效');

    // init() 里要真的调用它，否则首次挂载也拿不到
    assert.match(script, /exposeGlobals\(\);/, 'init() 内应调用 exposeGlobals()');
});

test('views/project.js 每次 mount 都重新暴露，并把契约对象抓进闭包', function () {
    var view = read('js/views/project.js');

    assert.match(view, /__projectPage/, '视图要拿到 __projectPage');
    assert.match(view, /pageApi\s*=/, '契约对象要存进闭包变量（window 上的引用会被清掉）');
    assert.match(view, /pageApi\.exposeGlobals\s*\(\)/, 'mount 时必须重新调用 exposeGlobals()');
    assert.match(view, /App\.view\s*\(/, '必须用 App.view 注册视图');
    assert.match(view, /loadPromise/, '脚本只加载一次，靠 loadPromise 缓存');
});

test('订单页走公共 api.js，不再自己 fetch', function () {
    var view = read('js/views/orders.js');
    assert.match(view, /global\.api\.call/, '订单请求应走 window.api.call');
    assert.match(view, /App\.ui\.paginationButtonsHtml/, '分页应走公共实现');
});

test('客户 / 报价 / 素材 / 平台 / 统计走公共 api 与 UI', function () {
    var customer = read('js/views/customer.js');
    var quote = read('js/views/quote.js');
    var posters = read('js/views/posters.js');
    var platform = read('js/views/platform.js');
    var stats = read('js/views/stats.js');

    assert.match(customer, /App\.dom\.escapeHtml/, '客户页转义走 App.dom');
    assert.match(customer, /App\.ui\.toast/, '客户页 Toast 走 App.ui');
    assert.match(customer, /global\.api\.call/, '客户页请求走 window.api');
    assert.doesNotMatch(customer, /\bfetch\(/, '客户页不应再直接 fetch');

    assert.match(quote, /App\.dom\.escapeHtml/);
    assert.match(quote, /App\.ui\.toast/);
    assert.match(quote, /global\.api\.call/);
    assert.doesNotMatch(quote, /\bfetch\(/);

    assert.match(posters, /App\.dom\.escapeHtml/);
    assert.match(posters, /App\.ui\.toast/);
    assert.match(posters, /global\.api\.call/);
    assert.doesNotMatch(posters, /return fetch\(url, options\)/);

    assert.match(platform, /App\.ui\.toast/);
    assert.match(platform, /App\.ui\.paginationButtonsHtml/);
    assert.match(platform, /global\.api\.call/);
    assert.doesNotMatch(platform, /\bfetch\(/);

    assert.match(stats, /global\.api\.get/);
    assert.doesNotMatch(stats, /\bfetch\(/);
});

test('提醒 / 简历 / 备忘 / 收藏 / 账号 / 画布走公共 api 与 UI', function () {
    var reminder = read('js/views/reminder.js');
    var resume = read('js/views/resume.js');
    var memo = read('js/views/memo.js');
    var bookmarks = read('js/views/bookmarks.js');
    var accounts = read('js/views/accounts.js');
    var canvas = read('js/views/canvas.js');

    assert.match(reminder, /App\.dom\.escapeHtml/);
    assert.match(reminder, /App\.ui\.toast/);
    assert.match(reminder, /global\.api\.call/);
    assert.doesNotMatch(reminder, /\bfetch\(/);

    assert.match(resume, /App\.dom\.escapeHtml/);
    assert.match(resume, /App\.ui\.toast/);
    assert.match(resume, /global\.api\.call/);
    assert.doesNotMatch(resume, /\bfetch\(/);

    assert.match(memo, /global\.api\.call/);
    assert.doesNotMatch(memo, /\bfetch\(/);

    assert.match(bookmarks, /global\.api\.call/);
    assert.doesNotMatch(bookmarks, /\bfetch\(/);

    assert.match(accounts, /App\.dom\.escapeHtml/);
    assert.match(accounts, /App\.ui\.toast/);
    assert.match(accounts, /global\.api\.call/);
    assert.doesNotMatch(accounts, /\bfetch\(/);

    assert.match(canvas, /App\.dom\.escapeHtml/);
    assert.match(canvas, /App\.ui\.toast/);
    assert.match(canvas, /global\.api\.call/);
    assert.doesNotMatch(canvas, /\bfetch\(/);
});

test('前端付款记录金额与后端一样夹负数为 0', function () {
    var form = read('js/order-form.js');
    var orders = read('js/views/orders.js');
    assert.match(form, /amount:\s*Math\.max\(0,\s*parseFloat\(item\.amount\)\s*\|\|\s*0\)/);
    assert.match(orders, /amount:\s*Math\.max\(0,\s*moneyNumber\(item\.amount\)\)/);
});

test('project-form.html 仍作为片段模板被脚本 fetch（不是整页）', function () {
    // 这个是**保留**的：项目表单抽屉是动态 fetch 的 HTML 片段
    assert.ok(exists('pages/content/project-form.html'), 'project-form.html 仍被 project-page.js fetch');
    assert.match(read('js/project/form.js'), /pages\/content\/project-form\.html/);
});
