/**
 * 移动端纯逻辑单测（不依赖浏览器）
 *
 * 跑法：node tools/test-mobile-lib.mjs
 *
 * 覆盖 mobile-pwa/src/lib/format.js、lib/pagination.js、lib/urls.js、api/client.js(ApiError)
 * 这几块都是纯函数，出错的后果却很难看：
 *  - 日期算错 → 移动端把「今天到期」显示成「逾期 1 天」
 *  - 分页归一化错 → 列表永远显示「已经到底了」
 *  - 金额格式化错 → 少一位小数点，客户看到报价差 10 倍
 */
import assert from 'node:assert/strict';

import {
    escapeHtml, formatMoney, formatMoneyInt, formatMoneyCompact, formatPercent, formatGrowth,
    parseLocalDate, toDateKey, formatDate, diffDays, describeDeadline,
    orderStatusLabel, orderStatusTone, paymentStatusTone, maskPhone, maskSecret, phoneTelHref, truncate,
    formatGrowthPoints,
    platformLabel, postStatusLabel,
    reminderBucket
} from '../mobile-pwa/src/lib/format.js';

import { normalizeList, mergeUnique, toQuery } from '../mobile-pwa/src/lib/pagination.js';
import { resolveAssetUrl, isImagePath, assetSrc, safeHttpUrl } from '../mobile-pwa/src/lib/urls.js';
import { ApiError, buildErrorMessage } from '../mobile-pwa/src/api/client.js';
import { normalizePath, pathSegments, safeDecode } from '../mobile-pwa/src/lib/path.js';
import { matchRoute, railPathOf, ROUTES, SUBPAGE_ROUTES } from '../mobile-pwa/src/config/routes.js';
import { MOBILE_NAV } from '../mobile-pwa/src/config/nav.js';

var passed = 0;
var failed = [];

function test(name, fn) {
    try {
        fn();
        passed += 1;
    } catch (e) {
        failed.push({ name, error: e });
    }
}

/* ============================================================
 * 金额
 * ========================================================== */

test('formatMoney 千分位 + 两位小数', function () {
    assert.equal(formatMoney(12345.6), '12,345.60');
    assert.equal(formatMoney(0), '0.00');
    assert.equal(formatMoney('abc'), '0.00');
    assert.equal(formatMoney(null), '0.00');
    assert.equal(formatMoney(-1234.5), '-1,234.50');
});

test('formatMoney 隐藏金额', function () {
    assert.equal(formatMoney(9999, true), '****');
});

test('formatMoneyInt 取整', function () {
    assert.equal(formatMoneyInt(1234567.89), '1,234,568');
});

test('formatMoneyCompact 万/亿', function () {
    assert.equal(formatMoneyCompact(980), '980');
    assert.equal(formatMoneyCompact(12800), '1.28万');
    assert.equal(formatMoneyCompact(10000), '1万');
    assert.equal(formatMoneyCompact(230000000), '2.3亿');
    assert.equal(formatMoneyCompact(-12800), '-1.28万');
});

test('formatPercent / formatGrowth', function () {
    assert.equal(formatPercent(0.237), '23.7%');
    assert.equal(formatPercent(0.5, 0), '50%');
    assert.equal(formatGrowth(0.125), '+12.5%');
    assert.equal(formatGrowth(-0.03), '-3.0%');
    assert.equal(formatGrowthPoints(12), '+12%');
    assert.equal(formatGrowthPoints(-3), '-3%');
    assert.equal(formatGrowthPoints(0), '持平');
    assert.equal(formatGrowthPoints(null), '');
});

/* ============================================================
 * 日期 —— 最容易踩 UTC 偏移的地方
 * ========================================================== */

test('parseLocalDate 不被 UTC 拉偏一天', function () {
    var d = parseLocalDate('2026-10-22');
    assert.equal(d.getFullYear(), 2026);
    assert.equal(d.getMonth(), 9);   // 0-based
    assert.equal(d.getDate(), 22);
    assert.equal(toDateKey(d), '2026-10-22');
});

test('parseLocalDate 带时间戳也只取日期部分', function () {
    var d = parseLocalDate('2026-10-22T23:30:00.000Z');
    assert.equal(toDateKey(d), '2026-10-22');
});

test('parseLocalDate 非法输入返回 null', function () {
    assert.equal(parseLocalDate(''), null);
    assert.equal(parseLocalDate('不是日期'), null);
    assert.equal(parseLocalDate(null), null);
});

test('diffDays 按本地 0 点算，不受小时影响', function () {
    assert.equal(diffDays('2026-10-23', '2026-10-22'), 1);
    assert.equal(diffDays('2026-10-22', '2026-10-22'), 0);
    assert.equal(diffDays('2026-10-20', '2026-10-22'), -2);
});

test('formatDate 相对日期', function () {
    var now = new Date();
    var today = toDateKey(now);
    var tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    var yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
    assert.equal(formatDate(today), '今天');
    assert.equal(formatDate(toDateKey(tomorrow)), '明天');
    assert.equal(formatDate(toDateKey(yesterday)), '昨天');
    assert.equal(formatDate(''), '');
});

test('formatDate full / month-day 样式', function () {
    assert.equal(formatDate('2026-03-05', 'full'), '2026-03-05');
    assert.equal(formatDate('2026-03-05', 'month-day'), '3月5日');
});

test('describeDeadline 逾期给 overdue', function () {
    var now = new Date();
    var overdueDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 3);
    var r = describeDeadline(toDateKey(overdueDay));
    assert.equal(r.tone, 'overdue');
    assert.match(r.text, /逾期 3 天/);

    var today = describeDeadline(toDateKey(now));
    assert.equal(today.tone, 'today');
    assert.equal(today.text, '今天到期');

    var soon = describeDeadline(toDateKey(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 2)));
    assert.equal(soon.tone, 'soon');

    assert.deepEqual(describeDeadline(''), { text: '', tone: 'none' });
});

/* ============================================================
 * 业务枚举
 * ========================================================== */

test('订单状态中文与语义色', function () {
    assert.equal(orderStatusLabel('processing'), '开发/设计中');
    assert.equal(orderStatusLabel('unknown_xx'), 'unknown_xx');
    assert.equal(orderStatusLabel(''), '未设置');
    assert.equal(orderStatusTone('completed'), 'ok');
    assert.equal(orderStatusTone('pending'), 'warn');
    assert.equal(orderStatusTone(undefined), 'muted');
    assert.equal(paymentStatusTone('未付款'), 'danger');
    assert.equal(paymentStatusTone('已结清'), 'ok');
});

test('maskPhone / truncate / escapeHtml', function () {
    assert.equal(maskPhone('13812345678'), '138****5678');
    assert.equal(maskPhone('138-1234-5678'), '138****5678');
    assert.equal(maskPhone('123'), '123');
    assert.equal(maskSecret(''), '');
    assert.equal(maskSecret('abc'), '****');
    assert.equal(maskSecret('ProbeSecret1234'), 'Prob****1234');
    assert.equal(maskSecret('ProbeSecret1234').indexOf('ProbeSecret'), -1);
    assert.equal(phoneTelHref('138-0013-8000'), 'tel:13800138000');
    assert.equal(phoneTelHref(''), '');
    assert.equal(truncate('一二三四五六七八九十一二三四五六七八九十多', 5), '一二三四五…');
    assert.equal(escapeHtml('<script>"&\''), '&lt;script&gt;&quot;&amp;&#39;');
});

/* ============================================================
 * 分页归一化 —— 决定「能不能继续加载」
 * ========================================================== */

test('normalizeList 分页对象', function () {
    var r = normalizeList({ success: true, data: { list: [{ id: 1 }, { id: 2 }], total: 30, page: 1, pageSize: 2 } });
    assert.equal(r.mode, 'paged');
    assert.equal(r.total, 30);
    assert.equal(r.hasMore, true);
});

test('normalizeList 分页对象最后一页', function () {
    var r = normalizeList({ success: true, data: { list: [{ id: 1 }], total: 11, page: 3, pageSize: 5 } });
    assert.equal(r.hasMore, false);
});

test('normalizeList 裸数组 → 没有更多页', function () {
    var r = normalizeList({ success: true, data: [{ id: 1 }, { id: 2 }, { id: 3 }] });
    assert.equal(r.mode, 'array');
    assert.equal(r.total, 3);
    assert.equal(r.hasMore, false);
});

test('normalizeList 空数组 / null / 异常形态都不炸', function () {
    assert.equal(normalizeList({ success: true, data: [] }).mode, 'empty');
    assert.equal(normalizeList({ success: true, data: null }).list.length, 0);
    assert.equal(normalizeList(null).list.length, 0);
    assert.equal(normalizeList({ data: { foo: 1 } }).list.length, 0);
});

test('normalizeList 缺 total 时用 list 长度兜底', function () {
    var r = normalizeList({ data: { list: [{ id: 1 }], page: 1, pageSize: 10 } });
    assert.equal(r.total, 1);
    assert.equal(r.hasMore, false);
});

test('mergeUnique 按 id 去重且保持顺序', function () {
    var a = [{ id: '1' }, { id: '2' }];
    var b = [{ id: '2' }, { id: '3' }];
    var out = mergeUnique(a, b);
    assert.deepEqual(out.map(function (x) { return x.id; }), ['1', '2', '3']);
});

test('mergeUnique 无 id 时用内容兜底', function () {
    var out = mergeUnique([{ month: '2026-10' }], [{ month: '2026-10' }, { month: '2026-09' }]);
    assert.equal(out.length, 2);
});

test('toQuery 跳过空值', function () {
    assert.equal(toQuery({ a: 1, b: '', c: null, d: undefined, e: 'x' }), '?a=1&e=x');
    assert.equal(toQuery({}), '');
    assert.equal(toQuery(null), '');
    assert.equal(toQuery({ tag: ['a', 'b'] }), '?tag=a%2Cb');
});

/* ============================================================
 * 资源地址
 * ========================================================== */

test('resolveAssetUrl 代理模式保持根路径', function () {
    assert.equal(resolveAssetUrl('/uploads/a.jpg'), '/uploads/a.jpg');
    assert.equal(resolveAssetUrl('uploads/a.jpg'), '/uploads/a.jpg');
    assert.equal(resolveAssetUrl('./uploads/a.jpg'), '/uploads/a.jpg');
});

test('resolveAssetUrl 空值与绝对地址原样', function () {
    assert.equal(resolveAssetUrl(''), '');
    assert.equal(resolveAssetUrl(null), '');
    assert.equal(resolveAssetUrl('https://cdn.x.com/a.png'), 'https://cdn.x.com/a.png');
    assert.equal(resolveAssetUrl('data:image/png;base64,AAA'), 'data:image/png;base64,AAA');
});

test('isImagePath 识别扩展名', function () {
    assert.equal(isImagePath('/uploads/a.JPG'), true);
    assert.equal(isImagePath('/uploads/a.png?v=2'), true);
    assert.equal(isImagePath('/uploads/a.pdf'), false);
    assert.equal(isImagePath(''), false);
});

test('素材地址和外部链接', function () {
    assert.equal(assetSrc('/uploads/a.jpg'), '/uploads/a.jpg');
    assert.equal(assetSrc({ url: 'uploads/b.png' }), '/uploads/b.png');
    assert.equal(assetSrc(null), '');
    assert.equal(safeHttpUrl('https://example.com/a?q=1'), 'https://example.com/a?q=1');
    assert.equal(safeHttpUrl('http://example.com'), 'http://example.com/');
    assert.equal(safeHttpUrl('javascript:alert(1)'), '');
    assert.equal(safeHttpUrl('/uploads/a.jpg'), '');
    assert.equal(safeHttpUrl('data:text/html,hi'), '');
    assert.equal(platformLabel('xianyu'), '闲鱼');
    assert.equal(postStatusLabel('published'), '已发布');
});

/* ============================================================
 * 错误对象 —— 后端中文文案能不能透到界面全靠这里
 * ========================================================== */

test('buildErrorMessage 优先取后端 error 字段', function () {
    var res = { status: 400 };
    assert.equal(
        buildErrorMessage(res, { success: false, error: '订单状态取值非法：xxx' }, ''),
        '订单状态取值非法：xxx'
    );
    assert.equal(buildErrorMessage(res, { message: '文件太大' }, ''), '文件太大');
});

test('buildErrorMessage 纯文本 / HTML / 兜底状态码', function () {
    assert.equal(buildErrorMessage({ status: 500 }, null, '  boom  '), 'boom');
    assert.match(buildErrorMessage({ status: 502 }, null, '<html>bad gateway</html>'), /非预期的页面/);
    assert.equal(buildErrorMessage({ status: 401 }, null, ''), '登录已过期，请重新登录');
    assert.equal(buildErrorMessage({ status: 403 }, null, ''), '没有权限执行此操作');
    assert.equal(buildErrorMessage({ status: 404 }, null, ''), '请求的数据不存在');
    assert.equal(buildErrorMessage({ status: 429 }, null, ''), '操作太频繁，请稍后再试');
    assert.match(buildErrorMessage({ status: 500 }, null, ''), /服务器出错了/);
    assert.match(buildErrorMessage({ status: 418 }, null, ''), /请求失败（418）/);
});

test('buildErrorMessage 超长文本截断', function () {
    var long = 'x'.repeat(300);
    var out = buildErrorMessage({ status: 500 }, null, long);
    assert.equal(out.length, 201);
    assert.ok(out.endsWith('…'));
});

test('ApiError 字段与 isNetworkError', function () {
    var e = new ApiError('网络连接失败', { status: 0, code: 'NETWORK' });
    assert.equal(e.name, 'ApiError');
    assert.equal(e.status, 0);
    assert.equal(e.code, 'NETWORK');
    assert.equal(e.isNetworkError, true);

    var aborted = new ApiError('请求已取消', { status: 0, aborted: true });
    assert.equal(aborted.isNetworkError, false);

    var http = new ApiError('出错', { status: 400, isHttpError: true });
    assert.equal(http.isNetworkError, false);
    assert.equal(http.isHttpError, true);
});

/* ============================================================
 * 路由匹配（config/routes.js + lib/path.js）
 *
 * 这块出错的后果特别隐蔽：路径匹配不上不会抛异常，只会「落到占位页」，
 * 表现是「分享出去的 /orders/123 链接点开是『页面开发中』」，
 * 而后台看日志一点问题都没有。所以边界要一条条钉死。
 * ========================================================== */

test('normalizePath 去尾斜杠 / 去 hash / 空值兜底', function () {
    assert.equal(normalizePath(''), '/');
    assert.equal(normalizePath(null), '/');
    assert.equal(normalizePath('/orders/'), '/orders');
    assert.equal(normalizePath('/orders/#x'), '/orders');
    assert.equal(normalizePath('/'), '/');
});

test('pathSegments 切非空片段', function () {
    assert.deepEqual(pathSegments('/'), []);
    assert.deepEqual(pathSegments('/orders'), ['orders']);
    assert.deepEqual(pathSegments('/orders/123/'), ['orders', '123']);
});

test('safeDecode 遇到坏编码不抛', function () {
    assert.equal(safeDecode('%E4%B8%AD'), '中');
    assert.equal(safeDecode('%E4'), '%E4');   // 残缺编码原样返回
});

test('提醒分组：逾期 / 今天 / 本周到周日 / 以后 / 已完成', function () {
    var thursday = new Date(2026, 9, 22);
    assert.equal(reminderBucket({ date: '2026-10-21', done: false }, thursday), 'overdue');
    assert.equal(reminderBucket({ date: '2026-10-22', done: false }, thursday), 'today');
    assert.equal(reminderBucket({ date: '2026-10-25', done: false }, thursday), 'week');
    assert.equal(reminderBucket({ date: '2026-10-26', done: false }, thursday), 'later');
    assert.equal(reminderBucket({ date: '2026-10-21', done: true }, thursday), 'done');
    assert.equal(reminderBucket({ date: '', done: false }, thursday), 'later');
    var sunday = new Date(2026, 9, 25);
    assert.equal(reminderBucket({ date: '2026-10-26', done: false }, sunday), 'later');
    assert.equal(reminderBucket(null, thursday), 'later');
});

test('静态路由命中导航项', function () {
    var r = matchRoute('/');
    assert.equal(r.matched, true);
    assert.equal(r.panel, 'workbench');
    assert.equal(r.label, '工作台');
    assert.equal(r.isSubpage, false);
    assert.equal(r.parent, null);
    assert.deepEqual(r.params, {});
});

test('/home 折叠成 /', function () {
    var r = matchRoute('/home');
    assert.equal(r.path, '/');
    assert.equal(r.panel, 'workbench');
});

test('尾部斜杠与 query 不影响匹配', function () {
    assert.equal(matchRoute('/orders/').panel, 'orders');
    assert.equal(matchRoute('/orders?status=pending').path, '/orders');
    assert.equal(matchRoute('/orders?status=pending').pattern, '/orders');
});

test('参数化路由提取 params', function () {
    var r = matchRoute('/orders/abc123');
    assert.equal(r.matched, true);
    assert.equal(r.pattern, '/orders/:id');
    assert.equal(r.params.id, 'abc123');
    assert.equal(r.isSubpage, true);
    assert.equal(r.parent, '/orders');
});

test('静态路由优先于参数路由', function () {
    // /orders 必须命中导航项，不能被 /orders/:id 抢走
    var r = matchRoute('/orders');
    assert.equal(r.pattern, '/orders');
    assert.equal(r.params.id, undefined);
    assert.equal(r.label, '订单');
});

test('段数不匹配视为未命中', function () {
    var r = matchRoute('/orders/abc/extra');
    assert.equal(r.matched, false);
    assert.equal(r.panel, 'placeholder');
});

test('路径参数会被 URL 解码', function () {
    var r = matchRoute('/orders/%E4%B8%AD%E6%96%87');
    assert.equal(r.params.id, '中文');
});

test('未登记路径给占位路由，不抛也不白屏', function () {
    var r = matchRoute('/nope/deep/path');
    assert.equal(r.matched, false);
    assert.equal(r.panel, 'placeholder');
    assert.equal(r.label, '页面开发中');
    assert.equal(r.isSubpage, false);
});

test('railPathOf：子页面高亮父级，一级页高亮自己', function () {
    assert.equal(railPathOf(matchRoute('/orders/123')), '/orders');
    assert.equal(railPathOf(matchRoute('/orders')), '/orders');
    assert.equal(railPathOf(matchRoute('/settings')), '/settings');
    assert.equal(railPathOf(matchRoute('/stats')), '/stats');
    assert.equal(railPathOf(null), '/');
});

test('路由表没有重复 pattern', function () {
    var seen = {};
    ROUTES.forEach(function (r) {
        assert.ok(!seen[r.pattern], '重复路由：' + r.pattern);
        seen[r.pattern] = true;
    });
});

test('每个子页面的 parent 都是已登记路径', function () {
    var patterns = {};
    ROUTES.forEach(function (r) { patterns[r.pattern] = true; });
    SUBPAGE_ROUTES.forEach(function (s) {
        if (!s.parent) return;
        assert.ok(patterns[s.parent], s.path + ' 的 parent「' + s.parent + '」不存在');
    });
});

test('导航栏是 12 项、都有图标、路径符合预期', function () {
    assert.equal(MOBILE_NAV.length, 12);
    MOBILE_NAV.forEach(function (item) {
        assert.ok(item.icon, item.path + ' 缺 icon');
        assert.ok(item.label, item.path + ' 缺 label');
        assert.ok(item.group, item.path + ' 缺 group（rail 分隔线靠它分组）');
    });
    assert.deepEqual(MOBILE_NAV.map(function (i) { return i.path; }),
        ['/', '/orders', '/reminder', '/customers',
            '/stats', '/posters', '/projects', '/quotes', '/platform-posts',
            '/bookmarks', '/accounts', '/settings']);
});

test('导航分组是连续的（不能 A/B/A 交错）', function () {
    // 交错的话 shell 会在换组处画分隔线，视觉上变成「两组分开了三次」，
    // 而且这一项被孤立在中间，用户会以为是另一类功能。
    var seen = [];
    MOBILE_NAV.forEach(function (item) {
        if (seen[seen.length - 1] !== item.group) {
            assert.ok(seen.indexOf(item.group) === -1,
                '分组「' + item.group + '」被拆成了不连续的多段');
            seen.push(item.group);
        }
    });
    assert.deepEqual(seen, ['业务', '数据与内容', '账号与资料']);
});

test('子页面只剩详情页（能凭空点进去的都该是一级页）', function () {
    assert.deepEqual(SUBPAGE_ROUTES.map(function (s) { return s.path; }),
        ['/orders/:id', '/customers/:id', '/projects/:id', '/quotes/:id', '/platform-posts/:id']);
});

test('导航路径与子页面路径不重叠', function () {
    var navPaths = {};
    MOBILE_NAV.forEach(function (i) { navPaths[i.path] = true; });
    SUBPAGE_ROUTES.forEach(function (s) {
        assert.ok(!navPaths[s.path], s.path + ' 同时是导航项和子页面');
    });
});

test('导航与路由一致：入口唯一、设置是一级页、详情只挂在列表上', function () {
    var seen = {};
    MOBILE_NAV.forEach(function (item) {
        assert.ok(!seen[item.path], '导航入口重复：' + item.path);
        seen[item.path] = true;
        var route = matchRoute(item.path);
        assert.equal(route.matched, true, item.path);
        assert.equal(route.panel, item.panel, item.path + ' 的 panel 和路由不一致');
        assert.equal(route.isSubpage, false, item.path + ' 不该是子页面');
        assert.equal(route.parent, null, item.path + ' 不该有 parent');
    });

    var settings = matchRoute('/settings');
    assert.equal(settings.isNav, true);
    assert.equal(settings.panel, 'settings');

    assert.equal(matchRoute('/orders/abc').panel, 'order-detail');
    assert.equal(matchRoute('/orders/abc').parent, '/orders');
    assert.equal(matchRoute('/customers/abc').parent, '/customers');
    assert.equal(matchRoute('/projects/abc').panel, 'project-detail');
    assert.equal(matchRoute('/projects/abc').parent, '/projects');
    assert.equal(matchRoute('/quotes/abc').panel, 'quote-detail');
    assert.equal(matchRoute('/quotes/abc').parent, '/quotes');
    assert.equal(matchRoute('/platform-posts/abc').panel, 'platform-post-detail');
    assert.equal(matchRoute('/platform-posts/abc').parent, '/platform-posts');

    SUBPAGE_ROUTES.forEach(function (s) {
        assert.notEqual(s.parent, '/more', s.path + ' 仍把父级指到已撤掉的 /more');
        assert.equal(matchRoute(s.parent).isNav, true, s.path + ' 的 parent 不是一级入口');
    });
});

/* ============================================================
 * 结果
 * ========================================================== */

console.log('');
if (failed.length) {
    failed.forEach(function (f) {
        console.error('✗ ' + f.name);
        console.error('  ' + (f.error && f.error.message ? f.error.message : f.error));
    });
    console.error('');
    console.error('失败 ' + failed.length + ' 项，通过 ' + passed + ' 项');
    process.exit(1);
} else {
    console.log('✓ 全部通过：' + passed + ' 项');
}
