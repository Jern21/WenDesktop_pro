/**
 * 项目进度 + 报价明细探针
 *
 * 跑法：http://127.0.0.1:3460/test/browse-probe.html （后端需在 3456）
 */
import { loginWithCredentials } from '../src/api/auth.js';
import { api } from '../src/api/client.js';
import { startRouter, subscribe, navigate, getPath } from '../src/router.js';
import { mountMobileShell, updateMobileShell } from '../src/mobile-shell.js';
import { projectListSession, quoteListSession } from '../src/views/browse-session.js';

var results = [];
var createdProject = '';
var createdQuote = '';

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

function textHas(selector, text) {
    var nodes = appEl().querySelectorAll(selector);
    for (var i = 0; i < nodes.length; i++) {
        if (nodes[i].textContent.indexOf(text) !== -1) return nodes[i];
    }
    return null;
}

async function run() {
    projectListSession.filters.keyword = '';
    projectListSession.filters.status = '';
    projectListSession.filters.scope = '';
    projectListSession.scrollTop = 0;
    quoteListSession.filters.keyword = '';
    quoteListSession.filters.status = '';
    quoteListSession.scrollTop = 0;
    quoteListSession.snapshot = null;

    var login = await loginWithCredentials('trial', '', false);
    if (!login.ok) throw new Error('trial 登录失败：' + (login.error || ''));

    startRouter();
    subscribe(function (path) { updateMobileShell(path); });
    mountMobileShell(appEl(), '/projects');
    navigate('/projects');
    await waitFor(function () { return appEl().querySelector('.br-search'); }, 8000, '项目列表');
    navigate('/projects/not-a-real-project');
    await waitFor(function () {
        var title = appEl().querySelector('.br-state p');
        return title && title.textContent.indexOf('不存在') !== -1;
    }, 8000, '不存在的项目');
    record('不存在的项目有提示', true, '');
    appEl().querySelector('[data-act="back"]').click();
    await waitFor(function () { return getPath() === '/projects' && appEl().querySelector('.br-search'); }, 8000, '回到项目');

    var stamp = '探针项目' + Date.now();
    var projectRes = await api.post('/api/projects', {
        name: stamp,
        customer: '探针客户',
        status: '开发/设计中',
        scope: 'enterprise',
        progress: 40,
        amount: 1500,
        deadline: '2026-10-28',
        localPath: 'D:/probe/' + stamp
    });
    createdProject = projectRes && projectRes.data && projectRes.data.id;
    record('探针项目已创建', !!createdProject, createdProject || '');
    if (!createdProject) return results;

    var quoteRes = await api.post('/api/quotes', {
        projectName: stamp,
        customerName: '探针客户',
        quoteDate: '2026-10-22',
        status: 'draft',
        items: [{ name: '探针条目', desc: '说明', qty: 2, price: 100 }],
        discount: 20,
        paymentMethod: '验收后付款'
    });
    createdQuote = quoteRes && quoteRes.data && quoteRes.data.id;
    record('探针报价已创建', !!createdQuote, createdQuote || (quoteRes && quoteRes.message) || '');
    if (!createdQuote) return results;

    navigate('/projects');
    await waitFor(function () { return appEl().querySelector('.br-search'); }, 8000, '项目列表再次');
    var search = appEl().querySelector('.br-search');
    search.value = stamp;
    search.dispatchEvent(new Event('input', { bubbles: true }));
    var card = await waitFor(function () { return textHas('.br-card', stamp); }, 8000, '搜到项目');
    record('关键词能搜到项目', !!card, '');
    record('卡片上有进度', card.textContent.indexOf('40%') !== -1, card.textContent.replace(/\s+/g, ' ').slice(0, 80));

    appEl().querySelector('[data-status="已完成"]').click();
    await waitFor(function () {
        return appEl().querySelector('[data-status="已完成"]').classList.contains('is-active') && !textHas('.br-card', stamp);
    }, 4000, '已完成筛掉');
    record('状态筛选能藏起进行中的项目', !textHas('.br-card', stamp), '');
    appEl().querySelector('[data-status=""]').click();
    card = await waitFor(function () { return textHas('.br-card', stamp); }, 4000, '取消项目筛选');
    card.click();

    await waitFor(function () {
        return appEl().querySelector('.br-name') && appEl().textContent.indexOf('D:/probe/' + stamp) !== -1;
    }, 8000, '项目详情');
    record('详情能看到进度和交付地址', appEl().textContent.indexOf('40%') !== -1, '');

    navigate('/quotes');
    await waitFor(function () { return appEl().querySelector('.br-search'); }, 8000, '报价列表');
    search = appEl().querySelector('.br-search');
    search.value = stamp;
    search.dispatchEvent(new Event('input', { bubbles: true }));
    card = await waitFor(function () { return textHas('.br-card', stamp); }, 8000, '搜到报价');
    record('关键词能搜到报价', card.textContent.indexOf('180') !== -1 || card.textContent.indexOf('200') !== -1, card.textContent.replace(/\s+/g, ' '));

    appEl().querySelector('[data-status="accepted"]').click();
    await waitFor(function () {
        return appEl().querySelector('[data-status="accepted"]').classList.contains('is-active') && !textHas('.br-card', stamp);
    }, 8000, '已接受筛掉草稿');
    record('报价状态能筛掉草稿', !textHas('.br-card', stamp), '');
    appEl().querySelector('[data-status=""]').click();
    card = await waitFor(function () { return textHas('.br-card', stamp); }, 8000, '取消报价筛选');
    card.click();

    await waitFor(function () {
        return appEl().querySelector('.br-item') && appEl().textContent.indexOf('探针条目') !== -1;
    }, 8000, '报价明细');
    record('明细里有条目、数量和条款',
        appEl().textContent.indexOf('2 ×') !== -1 && appEl().textContent.indexOf('验收后付款') !== -1, '');
    record('页面上没有保存按钮', !appEl().querySelector('[data-act="save"]'), '');

    appEl().querySelector('#mobile-topbar-back').click();
    await waitFor(function () {
        return getPath() === '/quotes' && appEl().querySelector('.br-search') &&
            appEl().querySelector('.br-search').value === stamp;
    }, 8000, '返回报价列表');
    record('返回后报价搜索词还在', true, '');

    return results;
}

function cleanup() {
    var projectId = createdProject;
    var quoteId = createdQuote;
    createdProject = '';
    createdQuote = '';
    var jobs = [];
    if (projectId) jobs.push(api.del('/api/projects/' + encodeURIComponent(projectId)).catch(function () { return null; }));
    if (quoteId) jobs.push(api.del('/api/quotes/' + encodeURIComponent(quoteId)).catch(function () { return null; }));
    return Promise.all(jobs);
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
