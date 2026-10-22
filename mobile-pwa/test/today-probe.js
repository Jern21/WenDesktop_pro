/**
 * 工作台入口 + 待办勾选 / 月历探针
 *
 * 跑法：http://127.0.0.1:3460/test/today-probe.html （后端需在 3456）
 */
import { loginWithCredentials } from '../src/api/auth.js';
import { api } from '../src/api/client.js';
import { startRouter, subscribe, navigate } from '../src/router.js';
import { mountMobileShell, updateMobileShell } from '../src/mobile-shell.js';

var results = [];
var created = [];

function record(name, ok, detail) {
    results.push({ name: name, ok: !!ok, detail: detail || '' });
}

function sleep(ms) {
    return new Promise(function (r) { setTimeout(r, ms); });
}

async function waitFor(fn, timeout, label) {
    var deadline = Date.now() + (timeout || 10000);
    while (Date.now() < deadline) {
        var v = fn();
        if (v) return v;
        await sleep(60);
    }
    throw new Error('等待超时：' + (label || ''));
}

function appEl() { return document.getElementById('app'); }

function dateKey(offset) {
    var d = new Date();
    d.setDate(d.getDate() + (offset || 0));
    var m = String(d.getMonth() + 1).padStart(2, '0');
    var day = String(d.getDate()).padStart(2, '0');
    return d.getFullYear() + '-' + m + '-' + day;
}

function jumpCount(name) {
    var btn = appEl().querySelector('[data-jump="' + name + '"] strong');
    if (!btn) return NaN;
    return parseInt(btn.textContent, 10);
}

function itemByTitle(title) {
    var nodes = appEl().querySelectorAll('.rem-item');
    for (var i = 0; i < nodes.length; i++) {
        if (nodes[i].textContent.indexOf(title) !== -1) return nodes[i];
    }
    return null;
}

async function run() {
    var login = await loginWithCredentials('trial', '', false);
    if (!login.ok) throw new Error('trial 登录失败：' + (login.error || ''));

    startRouter();
    subscribe(function (path) { updateMobileShell(path); });
    mountMobileShell(appEl(), '/');
    navigate('/');

    await waitFor(function () { return appEl().querySelector('[data-jump="acceptance"]'); }, 12000, '工作台入口');
    record('工作台有今日提醒、逾期提醒、待验收',
        !!appEl().querySelector('[data-jump="today"]') &&
        !!appEl().querySelector('[data-jump="overdue"]') &&
        !!appEl().querySelector('[data-jump="acceptance"]'), '');
    record('今日收入来自统计接口',
        /¥[\d,]+\.\d{2}|¥\*{4}|—/.test(appEl().querySelector('.wb-today-money').textContent),
        appEl().querySelector('.wb-today-money').textContent.replace(/\s+/g, ' ').slice(0, 80));

    appEl().querySelector('[data-jump="acceptance"]').click();
    await waitFor(function () {
        var chip = appEl().querySelector('[data-status="acceptance"]');
        return chip && chip.classList.contains('is-active') && appEl().querySelector('.ord-page');
    }, 8000, '待验收列表');
    record('待验收数字进到订单的待验收筛选', true, '');

    var stamp = '探针待办' + Date.now();
    var todayTitle = stamp + '今天';
    var lateTitle = stamp + '逾期';
    var todayRes = await api.post('/api/reminders', { title: todayTitle, date: dateKey(0), time: '09:00' });
    var lateRes = await api.post('/api/reminders', { title: lateTitle, date: dateKey(-1), time: '09:00' });
    if (todayRes.data) created.push(todayRes.data.id);
    if (lateRes.data) created.push(lateRes.data.id);
    record('探针提醒已创建', created.length === 2, created.join(','));

    navigate('/');
    await waitFor(function () { return appEl().querySelector('[data-jump="today"]'); }, 12000, '回到工作台');
    var before = jumpCount('today');
    record('今日提醒是数字', !isNaN(before), String(before));

    appEl().querySelector('[data-jump="overdue"]').click();
    var lateItem = await waitFor(function () {
        var box = appEl().querySelector('[data-bucket="overdue"]');
        return box && box.textContent.indexOf(lateTitle) !== -1 ? box : null;
    }, 8000, '逾期分组');
    record('逾期提醒进到逾期分组', !!lateItem, '');

    appEl().querySelector('[data-view="calendar"]').click();
    await waitFor(function () { return appEl().querySelector('.rem-day.is-today'); }, 8000, '月历');
    appEl().querySelector('.rem-day.is-today').click();
    await waitFor(function () { return itemByTitle(todayTitle); }, 8000, '当天提醒');
    record('月历点今天能看到这条提醒', true, '');

    appEl().querySelector('[data-view="list"]').click();
    var row = await waitFor(function () { return itemByTitle(todayTitle); }, 8000, '列表里的今天');
    row.click();
    await waitFor(function () { return document.querySelector('.toast-undo'); }, 4000, '撤销');
    record('勾选后出现撤销', document.querySelector('.toast-text').textContent.indexOf('已完成') !== -1, '');
    document.querySelector('.toast-undo').click();
    row = await waitFor(function () {
        var again = itemByTitle(todayTitle);
        return again && again.getAttribute('aria-checked') === 'false' ? again : null;
    }, 8000, '撤销后未完成');
    record('撤销后恢复未完成', true, '');

    row.click();
    await waitFor(function () {
        var still = itemByTitle(todayTitle);
        var folded = appEl().querySelector('[data-act="done"]');
        return !still && folded && folded.textContent.indexOf('已完成') !== -1;
    }, 8000, '再次完成后收进已完成');
    appEl().querySelector('[data-act="done"]').click();
    await waitFor(function () {
        var done = itemByTitle(todayTitle);
        return done && done.getAttribute('aria-checked') === 'true';
    }, 4000, '已完成里能看到');
    record('再次勾选后进入已完成', true, '');

    navigate('/');
    await waitFor(function () {
        return appEl().querySelector('[data-jump="today"]') && jumpCount('today') === before - 1;
    }, 12000, '完成后的今日数字');
    record('完成后首页今日提醒少 1', jumpCount('today') === before - 1,
        before + ' → ' + jumpCount('today'));

    return results;
}

function cleanup() {
    var ids = created.slice();
    created = [];
    return Promise.all(ids.map(function (id) {
        return api.del('/api/reminders/' + encodeURIComponent(id)).catch(function () { return null; });
    }));
}

run().then(function (list) {
    return cleanup().then(function () { return list; });
}).then(function (list) {
    var failed = list.filter(function (r) { return !r.ok; });
    var text = list.map(function (r) {
        return (r.ok ? '✓ ' : '✗ ') + r.name + (r.detail ? '  [' + r.detail + ']' : '');
    });
    text.push('');
    text.push(failed.length ? ('失败 ' + failed.length + ' / 共 ' + list.length) : ('全部通过：' + list.length + ' 项'));
    var pre = document.getElementById('result');
    pre.textContent = text.join('\n');
    pre.className = failed.length ? 'bad' : 'ok';
    document.body.setAttribute('data-probe-result', failed.length ? 'FAIL' : 'OK');
}).catch(function (e) {
    cleanup().then(function () {
        var pre = document.getElementById('result');
        var done = results.map(function (r) {
            return (r.ok ? '✓ ' : '✗ ') + r.name + (r.detail ? '  [' + r.detail + ']' : '');
        });
        done.push('');
        done.push('探针异常：' + (e && e.message ? e.message : e));
        pre.textContent = done.join('\n');
        pre.className = 'bad';
        document.body.setAttribute('data-probe-result', 'ERROR');
    });
});
