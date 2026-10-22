/**
 * 后端 API 能力探测（移动端可接入数据对账用）
 *
 * 用 trial 免密登录拿 Bearer token，然后逐个 GET 只读接口，
 * 打印：状态码 / 顶层形态 / 条目数 / 首条字段名。
 *
 * 用法：
 *   node tools/probe-api-surface.mjs [port] [user]
 *   默认 port=3456，user=trial（免密）
 */

const port = process.argv[2] || '3456';
const user = process.argv[3] || 'trial';
const BASE = 'http://127.0.0.1:' + port;

const ENDPOINTS = [
    ['GET', '/api/auth/status'],
    ['GET', '/api/auth/me'],
    ['GET', '/api/orders/stats/summary'],
    ['GET', '/api/orders'],
    ['GET', '/api/customers'],
    ['GET', '/api/quotes'],
    ['GET', '/api/projects/stats'],
    ['GET', '/api/projects/board'],
    ['GET', '/api/projects'],
    ['GET', '/api/posters/labels'],
    ['GET', '/api/posters'],
    ['GET', '/api/platform-posts/stats/overview'],
    ['GET', '/api/platform-posts'],
    ['GET', '/api/memos'],
    ['GET', '/api/reminders'],
    ['GET', '/api/reminders/calendar/' + new Date().getFullYear() + '/' + (new Date().getMonth() + 1)],
    ['GET', '/api/resume'],
    ['GET', '/api/settings'],
    ['GET', '/api/settings/backups'],
    ['GET', '/api/stats/home-metrics'],
    ['GET', '/api/stats/dashboard'],
    ['GET', '/api/stats/monthly-overview'],
    ['GET', '/api/stats/revenue'],
    ['GET', '/api/stats/revenue/daily'],
    ['GET', '/api/stats/platform'],
    ['GET', '/api/stats/project-type'],
    ['GET', '/api/stats/orders-monthly'],
    ['GET', '/api/stats/customer-level'],
    ['GET', '/api/stats/funnel'],
    ['GET', '/api/stats/todos'],
    ['GET', '/api/stats/monthly-detail'],
    ['GET', '/api/stats/notifications'],
    ['GET', '/api/ledger/workbench'],
    ['GET', '/api/ledger'],
    ['GET', '/api/accounts'],
    ['GET', '/api/accounts/platforms'],
    ['GET', '/api/bookmarks'],
    ['GET', '/api/bookmarks/categories'],
    ['GET', '/api/bug-reports'],
    ['GET', '/api/image-gen/config']
];

function shapeOf(v) {
    if (Array.isArray(v)) return 'array[' + v.length + ']';
    if (v === null) return 'null';
    if (typeof v === 'object') return 'object{' + Object.keys(v).slice(0, 6).join(',') + '}';
    return typeof v;
}

async function login() {
    const r = await fetch(BASE + '/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: user })
    });
    const j = await r.json();
    if (!j.success) throw new Error('登录失败: ' + (j.error || r.status));
    return j.data && j.data.token;
}

const token = await login();
console.log('登录成功: ' + user + ' (port ' + port + ')');
console.log('');

const rows = [];
for (const [method, path] of ENDPOINTS) {
    let status = 0, note = '';
    try {
        const r = await fetch(BASE + path, { headers: { Authorization: 'Bearer ' + token } });
        status = r.status;
        const text = await r.text();
        let j = null;
        try { j = JSON.parse(text); } catch (e) { note = '非JSON'; }
        if (j) {
            const d = j.data !== undefined ? j.data : (Array.isArray(j) ? j : null);
            if (Array.isArray(d)) {
                const first = d[0];
                note = 'array[' + d.length + ']' + (first && typeof first === 'object'
                    ? ' 字段求:' + Object.keys(first).slice(0, 10).join(',') : '');
            } else if (d && typeof d === 'object') {
                note = 'object 键:' + Object.keys(d).slice(0, 12).join(',');
            } else {
                note = String(j.success) + ' ' + (j.error || '');
            }
        }
    } catch (e) {
        note = 'ERR ' + e.message;
    }
    rows.push({ path, status, note });
    console.log((status === 200 ? 'OK  ' : String(status).padEnd(4)) + ' ' + path.padEnd(46) + ' ' + note);
}

const ok = rows.filter(r => r.status === 200).length;
console.log('');
console.log('可用接口 ' + ok + '/' + rows.length);
