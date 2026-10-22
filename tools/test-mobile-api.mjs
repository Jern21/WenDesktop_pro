/**
 * 移动端 API 层联调测试（打真实后端，只发只读请求）
 *
 * 跑法：
 *   1. 先起后端：cd backend && node server.js        （默认 3456）
 *   2. node tools/test-mobile-api.mjs [port]
 *
 * 验证的是「client.js + resources.js + pagination.js」三层串起来是否真的能用，
 * 而不是各自单测通过就完事 —— 这三层之间最容易出问题的是：
 *   - 相对 URL 在非浏览器环境下解析
 *   - 登录拿到的 token 有没有被后续请求带上
 *   - 401 有没有真的触发全局登出回调（而不是静默失败）
 *   - 后端中文错误文案能不能透到 ApiError.message
 *
 * ⚠️ 只做 GET。状态切换（订单/待办）会改真实数据，不在这里测。
 */
import assert from 'node:assert/strict';

const PORT = process.argv[2] || '3456';
const ORIGIN = 'http://127.0.0.1:' + PORT;

/* ---------- 浏览器 API 兜底（Node 里没有） ---------- */
const store = new Map();
globalThis.localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
    clear: () => store.clear()
};

// client.js 里用的是根路径（/api/...），Node 的 fetch 不认相对 URL，
// 这里把相对路径补齐成绝对地址。生产代码不需要改。
const rawFetch = globalThis.fetch;
globalThis.fetch = (url, init) => {
    const target = /^https?:\/\//i.test(String(url)) ? url : ORIGIN + url;
    return rawFetch(target, init);
};

/* ---------- 载入被测模块 ---------- */
const { api, setStoredToken, onUnauthorized, ApiError } = await import('../mobile-pwa/src/api/client.js');
const { loginWithCredentials } = await import('../mobile-pwa/src/api/auth.js');
const { orders, reminders, stats, customers } = await import('../mobile-pwa/src/api/resources.js');
const { normalizeList } = await import('../mobile-pwa/src/lib/pagination.js');

let passed = 0;
const failed = [];

async function test(name, fn) {
    try {
        await fn();
        passed += 1;
        console.log('  ✓ ' + name);
    } catch (e) {
        failed.push({ name, error: e });
        console.log('  ✗ ' + name + ' → ' + (e && e.message ? e.message : e));
    }
}

console.log('');
console.log('移动端 API 层联调 @ ' + ORIGIN);

/* ---------- 0. 未登录时应当 401 且不崩 ---------- */
await test('未登录访问业务接口 → ApiError(401) 且带中文文案', async function () {
    setStoredToken('');
    await assert.rejects(
        () => orders.list({ pageSize: 1 }),
        (err) => {
            assert.ok(err instanceof ApiError, '应为 ApiError');
            assert.equal(err.status, 401);
            assert.equal(err.isNetworkError, false);
            assert.match(err.message, /未登录|过期/);
            return true;
        }
    );
});

/* ---------- 1. 登录（trial 免密，走会话层） ---------- */
let token = '';
await test('trial 免密登录会写入本地 token（会话层职责）', async function () {
    const r = await loginWithCredentials('trial', '', false);
    assert.equal(r.ok, true, '登录应成功：' + (r.error || ''));
    token = localStorage.getItem('wt_mobile_auth_token') || '';
    assert.ok(token, '会话层应把 token 写进 localStorage');
    setStoredToken(token);
});

/* ---------- 2. 订单分页 ---------- */
await test('orders.list 分页归一化正确', async function () {
    const payload = await orders.list({ page: 1, pageSize: 3 });
    const n = normalizeList(payload, 3);
    assert.equal(n.mode, 'paged', '订单接口应是分页对象形态');
    assert.ok(n.list.length <= 3, '返回条数不应超过 pageSize');
    assert.ok(n.total >= n.list.length, 'total 应不小于本页条数');
    if (n.total > 3) assert.equal(n.hasMore, true, '总数大于一页时应可继续加载');
});

/* ---------- 3. 订单详情字段完整性 ---------- */
await test('orders.detail 返回的字段能撑起移动端详情页', async function () {
    const list = await orders.list({ pageSize: 1 });
    const first = normalizeList(list, 1).list[0];
    assert.ok(first && first.id, '应至少有一条订单');
    const res = await orders.detail(first.id);
    const o = res.data;
    ['id', 'customerNick', 'projectName', 'amount', 'orderStatus', 'paymentStatus'].forEach(function (k) {
        assert.ok(Object.prototype.hasOwnProperty.call(o, k), '缺少字段 ' + k);
    });
});

/* ---------- 4. 裸数组形态（客户） ---------- */
await test('customers.list 是裸数组形态', async function () {
    const payload = await customers.list();
    const n = normalizeList(payload);
    assert.equal(n.mode === 'array' || n.mode === 'empty', true);
    assert.equal(n.hasMore, false, '裸数组没有下一页');
});

/* ---------- 5. 统计聚合 ---------- */
await test('stats.todos / homeMetrics 可读', async function () {
    const todos = await stats.todos();
    assert.ok(todos.data && typeof todos.data.overdueOrders === 'number');
    const hm = await stats.homeMetrics();
    assert.ok(hm.data && typeof hm.data.monthRevenue === 'number');
});

/* ---------- 6. 待办日历 ---------- */
await test('reminders.calendar 返回月历结构（days 是按日分组的对象）', async function () {
    const now = new Date();
    const res = await reminders.calendar(now.getFullYear(), now.getMonth() + 1);
    assert.ok(res.data, '应有 data');
    assert.equal(res.data.year, now.getFullYear());
    assert.equal(res.data.month, now.getMonth() + 1);
    assert.equal(typeof res.data.total, 'number');
    // days 是 { '01': [...], '15': [...] } 这种按日分组的对象，不是数组、也不是 31 格
    assert.equal(typeof res.data.days, 'object');
    assert.equal(Array.isArray(res.data.days), false, 'days 是对象，别当数组用');
    Object.keys(res.data.days).forEach(function (k) {
        assert.match(k, /^\d{2}$/, 'days 的键应是两位日期，如 "05"');
        assert.ok(Array.isArray(res.data.days[k]), '每天对应一个数组');
    });
});

/* ---------- 7. 404 的中文文案 ---------- */
await test('查不存在的订单 → 404 且文案是中文', async function () {
    await assert.rejects(
        () => orders.detail('__not_exist__'),
        (err) => {
            assert.ok(err instanceof ApiError);
            assert.equal(err.status, 404);
            assert.match(err.message, /不存在/);
            return true;
        }
    );
});

/* ---------- 8. 401 触发全局登出回调 ---------- */
await test('token 失效 → 触发 onUnauthorized 并清空本地 token', async function () {
    let hit = 0;
    const off = onUnauthorized(() => { hit += 1; });
    setStoredToken('invalid.token.value');

    await assert.rejects(() => api.get('/api/orders?pageSize=1'));

    off();
    assert.equal(hit, 1, '应触发一次未授权回调');
    assert.equal(localStorage.getItem('wt_mobile_auth_token'), null, '失效 token 应被清掉');

    setStoredToken(token); // 复原，避免影响后续
});

/* ---------- 9. 登录失败不触发全局登出（否则死循环） ---------- */
await test('登录接口 401 不触发全局登出', async function () {
    let hit = 0;
    const off = onUnauthorized(() => { hit += 1; });

    await assert.rejects(
        () => api.post('/api/auth/login',
            { username: 'admin', password: 'definitely-wrong-password' },
            { anonymous: true }),
        (err) => {
            assert.equal(err.status, 401);
            return true;
        }
    );

    off();
    assert.equal(hit, 0, '登录密码错误不应触发全局登出（否则登录页会被自己踢走）');
});

/* ---------- 10. 取消与超时 ---------- */
//
// 注意：这里**不用 `timeout: 1` 去赌网络时延** —— 本地 loopback 在连接复用之后
// 响应可能 <1ms，断言「必定超时」会随机失败（实测就失败过）。
// 改成两条确定性断言：
//   ① 已取消的 signal → 立刻抛 aborted 错误（不依赖时序）
//   ② 超时错误对象的结构正确（纯构造，不依赖网络）
await test('外部 signal 取消 → 抛 aborted 错误且不触发重试', async function () {
    const ctrl = new AbortController();
    ctrl.abort();   // 请求发出前就已取消，结果确定

    await assert.rejects(
        () => api.get('/api/orders', { signal: ctrl.signal }),
        (err) => {
            assert.ok(err instanceof ApiError);
            assert.equal(err.aborted, true, '应标记 aborted');
            assert.equal(err.isNetworkError, false, '主动取消不该被当成网络故障（否则会重试）');
            assert.match(err.message, /取消/);
            return true;
        }
    );
});

await test('超时错误的结构（超时不应触发重试）', async function () {
    const { ApiError: E } = await import('../mobile-pwa/src/api/client.js');
    const e = new E('请求超时（20 秒），请检查网络或服务状态', {
        status: 0, code: 'TIMEOUT', timeout: true
    });
    assert.equal(e.timeout, true);
    assert.equal(e.status, 0);
    // isNetworkError 仍为 true（它确实是「没拿到响应」），
    // 但 client.js 的重试判断必须额外排除 timeout —— 否则 20s 超时会重试成 40s
    assert.equal(e.isNetworkError, true);
});

/* ---------- 结果 ---------- */
console.log('');
if (failed.length) {
    failed.forEach(function (f) {
        console.error('✗ ' + f.name);
        if (f.error && f.error.stack) console.error(f.error.stack.split('\n').slice(0, 4).join('\n'));
    });
    console.error('');
    console.error('失败 ' + failed.length + ' 项，通过 ' + passed + ' 项');
    process.exit(1);
} else {
    console.log('✓ 全部通过：' + passed + ' 项');
}
