/**
 * 数据看板 / 账号脱敏 / 设置探针
 *
 * 跑法：http://127.0.0.1:3460/test/hub-probe.html （后端需在 3456）
 */
import { loginWithCredentials } from '../src/api/auth.js';
import { api } from '../src/api/client.js';
import { startRouter, subscribe, navigate } from '../src/router.js';
import { mountMobileShell, updateMobileShell } from '../src/mobile-shell.js';
import { formatMoney } from '../src/lib/format.js';

var SECRET = 'ProbeSecret1234';
var results = [];
var created = '';

function record(name, ok, detail) {
    results.push({ name: name, ok: !!ok, detail: detail || '' });
}

function sleep(ms) {
    return new Promise(function (r) { setTimeout(r, ms); });
}

async function waitFor(fn, timeout, label) {
    var deadline = Date.now() + (timeout || 8000);
    while (Date.now() < deadline) {
        var v = fn();
        if (v) return v;
        await sleep(60);
    }
    throw new Error('等待超时：' + (label || ''));
}

function appEl() { return document.getElementById('app'); }

function metricValue(label) {
    var nodes = appEl().querySelectorAll('.st-metric');
    for (var i = 0; i < nodes.length; i++) {
        var name = nodes[i].querySelector('span');
        var value = nodes[i].querySelector('b');
        if (name && value && name.textContent === label) return value.textContent;
    }
    return '';
}

async function expectOverview(range) {
    var res = await api.get('/api/stats/monthly-overview?range=' + range);
    var data = res.data || {};
    await waitFor(function () {
        return metricValue('订单') === String(data.orderCount || 0) &&
            metricValue('成交额') === ('¥' + formatMoney(data.revenue));
    }, 8000, range + ' 口径');
    record(range + ' 的订单数和成交额与接口一致', true,
        (data.orderCount || 0) + ' / ¥' + formatMoney(data.revenue));
}

async function run() {
    var themeBefore = document.documentElement.getAttribute('data-theme');
    var storedTheme = null;
    try { storedTheme = localStorage.getItem('wt_theme'); } catch (e) { storedTheme = null; }

    var login = await loginWithCredentials('trial', '', false);
    if (!login.ok) throw new Error('trial 登录失败：' + (login.error || ''));

    startRouter();
    subscribe(function (path) { updateMobileShell(path); });
    mountMobileShell(appEl(), '/stats');
    navigate('/stats');

    await waitFor(function () { return appEl().querySelector('.st-metric b'); }, 12000, '看板');
    await expectOverview('all');
    appEl().querySelector('[data-range="month"]').click();
    await expectOverview('month');
    record('页面上没有自己再乘一次增长率', appEl().textContent.indexOf('1200%') === -1, '');

    var stamp = '探针账号' + Date.now();
    var createdRes = await api.post('/api/accounts', {
        platform: 'github',
        accountName: stamp,
        email: 'probe@example.com',
        password: SECRET
    });
    created = createdRes && createdRes.data && createdRes.data.id;
    record('探针账号已创建', !!created, created || '');

    navigate('/accounts');
    await waitFor(function () { return appEl().querySelector('.br-search'); }, 8000, '账号页');
    var search = appEl().querySelector('.br-search');
    search.value = stamp;
    search.dispatchEvent(new Event('input', { bubbles: true }));
    var card = await waitFor(function () {
        var nodes = appEl().querySelectorAll('.st-block');
        for (var i = 0; i < nodes.length; i++) {
            if (nodes[i].textContent.indexOf(stamp) !== -1) return nodes[i];
        }
        return null;
    }, 8000, '搜到账号');
    record('密码已打码', card.textContent.indexOf('Prob****1234') !== -1, '');
    record('明文密码不在页面上', appEl().innerHTML.indexOf(SECRET) === -1, '');

    navigate('/settings');
    await waitFor(function () {
        var box = appEl().querySelector('[data-profile]');
        return box && box.textContent.indexOf('加载中') === -1 ? box : null;
    }, 8000, '设置资料');
    record('离开账号页后页面里仍没有明文密码', appEl().innerHTML.indexOf(SECRET) === -1, '');
    record('设置页不渲染密钥字段', appEl().innerHTML.indexOf('apiKey') === -1, '');

    var themeBtn = appEl().querySelector('#panel-theme-toggle');
    themeBtn.click();
    var flipped = document.documentElement.getAttribute('data-theme');
    record('深色模式能切换', flipped === 'dark' || flipped === 'light', flipped || '');
    if (themeBefore) document.documentElement.setAttribute('data-theme', themeBefore);
    else document.documentElement.removeAttribute('data-theme');
    try {
        if (storedTheme === null) localStorage.removeItem('wt_theme');
        else localStorage.setItem('wt_theme', storedTheme);
    } catch (e) { /* ignore */ }
    var switchEl = themeBtn.querySelector('.m-switch');
    if (switchEl) switchEl.classList.toggle('m-switch-on', document.documentElement.getAttribute('data-theme') === 'dark');

    return results;
}

function cleanup() {
    if (!created) return Promise.resolve();
    var id = created;
    created = '';
    return api.del('/api/accounts/' + encodeURIComponent(id)).catch(function () { return null; });
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
