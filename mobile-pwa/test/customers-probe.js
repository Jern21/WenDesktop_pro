/**
 * 客户列表 + 详情探针
 *
 * 覆盖：搜索、跟进状态筛选、不存在的客户、从客户进订单再回到客户、
 * 空跟进被拦住、跟进保存后出现在详情里、返回后关键词还在。
 *
 * 跑法：http://127.0.0.1:3460/test/customers-probe.html （后端需在 3456）
 */
import { loginWithCredentials } from '../src/api/auth.js';
import { api } from '../src/api/client.js';
import { startRouter, subscribe, navigate, getPath } from '../src/router.js';
import { mountMobileShell, updateMobileShell } from '../src/mobile-shell.js';
import { customerListSession } from '../src/views/customer-session.js';

var results = [];
var createdCustomer = '';
var createdOrder = '';

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

function cardByText(text) {
    var cards = appEl().querySelectorAll('.cust-card');
    for (var i = 0; i < cards.length; i++) {
        if (cards[i].textContent.indexOf(text) !== -1) return cards[i];
    }
    return null;
}

function toastText() {
    return Array.prototype.map.call(document.querySelectorAll('.toast'), function (node) {
        return node.textContent || '';
    }).join('\n');
}

async function run() {
    customerListSession.filters.keyword = '';
    customerListSession.filters.followStatus = '';
    customerListSession.scrollTop = 0;
    customerListSession.snapshot = null;

    var login = await loginWithCredentials('trial', '', false);
    if (!login.ok) throw new Error('trial 登录失败：' + (login.error || ''));

    startRouter();
    subscribe(function (path) { updateMobileShell(path); });
    mountMobileShell(appEl(), '/customers');
    navigate('/customers');
    await waitFor(function () { return appEl().querySelector('.cust-page'); }, 8000, '客户列表');
    navigate('/customers/not-a-real-customer');

    await waitFor(function () {
        var title = appEl().querySelector('.cust-state p');
        return title && title.textContent.indexOf('不存在') !== -1;
    }, 8000, '不存在的客户');
    record('不存在的客户有提示', true, appEl().querySelector('.cust-state p').textContent);

    appEl().querySelector('[data-act="back"]').click();
    await waitFor(function () { return getPath() === '/customers' && appEl().querySelector('.cust-page'); }, 8000, '回到列表');

    var stamp = '探针客户' + Date.now();
    var followText = '探针跟进' + Date.now();
    var customerRes = await api.post('/api/customers', {
        name: stamp,
        phone: '13800138000',
        source: '闲鱼',
        type: '潜在客户',
        followStatus: '待跟进'
    });
    createdCustomer = customerRes && customerRes.data && customerRes.data.id;
    record('探针客户已创建', !!createdCustomer, createdCustomer || '');
    if (!createdCustomer) return results;

    var orderRes = await api.post('/api/orders', {
        customerId: createdCustomer,
        customerNick: stamp,
        customerPhone: '13800138000',
        projectType: '其他',
        projectName: stamp + '项目',
        amount: 300,
        orderDate: '2026-10-22',
        finalDate: '2026-10-28',
        orderStatus: 'pending',
        paymentStatus: '未付款'
    });
    createdOrder = orderRes && orderRes.data && orderRes.data.id;
    record('探针订单已挂到这位客户', !!createdOrder, createdOrder || '');

    navigate('/customers');
    await waitFor(function () { return appEl().querySelector('.cust-search'); }, 8000, '客户列表');
    var search = appEl().querySelector('.cust-search');
    search.value = stamp;
    search.dispatchEvent(new Event('input', { bubbles: true }));
    var card = await waitFor(function () { return cardByText(stamp); }, 8000, '搜索命中');
    record('关键词能搜到刚建的客户', !!card, stamp);

    appEl().querySelector('[data-follow="已流失"]').click();
    await waitFor(function () {
        return appEl().querySelector('[data-follow="已流失"]').classList.contains('is-active') &&
            !cardByText(stamp) && appEl().querySelector('.lv-empty, .cust-count');
    }, 8000, '已流失筛掉');
    record('跟进状态能筛掉待跟进的客户', !cardByText(stamp), '');

    appEl().querySelector('[data-follow=""]').click();
    card = await waitFor(function () { return cardByText(stamp); }, 8000, '取消筛选');
    card.click();

    await waitFor(function () {
        return appEl().querySelector('.cust-name') &&
            appEl().querySelector('.cust-name').textContent.indexOf(stamp) !== -1 &&
            appEl().querySelector('.cust-order');
    }, 8000, '客户详情');
    record('详情能看到关联订单', appEl().querySelector('.cust-order').textContent.indexOf(stamp + '项目') !== -1, '');
    record('电话是拨号链接', (appEl().querySelector('.cust-phone').getAttribute('href') || '').indexOf('tel:13800138000') === 0, '');

    appEl().querySelector('.cust-order').click();
    await waitFor(function () {
        return getPath().indexOf('/orders/') === 0 &&
            (appEl().textContent || '').indexOf(stamp + '项目') !== -1;
    }, 8000, '订单详情');
    record('从客户进入订单详情', true, getPath());

    var toCustomer = await waitFor(function () {
        return appEl().querySelector('[data-act="customer"]');
    }, 8000, '查看客户');
    toCustomer.click();
    await waitFor(function () {
        return getPath().indexOf('/customers/') === 0 &&
            appEl().querySelector('.cust-name') &&
            appEl().querySelector('.cust-name').textContent.indexOf(stamp) !== -1;
    }, 8000, '回到客户');
    record('订单详情能回到这位客户', true, getPath());

    appEl().querySelector('[data-act="follow"]').click();
    await waitFor(function () { return document.querySelector('.cust-follow-input'); }, 4000, '跟进弹层');
    document.querySelector('[data-act="save"]').click();
    await waitFor(function () { return toastText().indexOf('不能为空') !== -1; }, 4000, '空跟进提示');
    record('空跟进不会提交', !!document.querySelector('.cust-follow-input'), '');

    var input = document.querySelector('.cust-follow-input');
    input.value = followText;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    document.querySelector('.sheet-backdrop [data-act="save"]').click();
    await waitFor(function () {
        var nodes = appEl().querySelectorAll('.cust-follow');
        for (var i = 0; i < nodes.length; i++) {
            if (nodes[i].textContent.indexOf(followText) !== -1) return nodes[i];
        }
        return null;
    }, 8000, '跟进出现');
    record('跟进保存后出现在详情里', true, followText);

    appEl().querySelector('#mobile-topbar-back').click();
    await waitFor(function () { return getPath().indexOf('/orders/') === 0; }, 8000, '从客户返回订单');
    record('从客户返回仍停在刚才的订单', true, getPath());
    appEl().querySelector('#mobile-topbar-back').click();
    await waitFor(function () {
        return getPath().indexOf('/customers/') === 0 && appEl().querySelector('.cust-follow');
    }, 8000, '再回到客户');
    appEl().querySelector('#mobile-topbar-back').click();
    await waitFor(function () {
        return getPath() === '/customers' && appEl().querySelector('.cust-search');
    }, 8000, '返回列表');
    record('返回后搜索词还在', appEl().querySelector('.cust-search').value === stamp,
        appEl().querySelector('.cust-search').value);
    await waitFor(function () { return cardByText(stamp); }, 8000, '返回后的卡片');
    record('返回后还能看到这位客户', !!cardByText(stamp), '');

    return results;
}

function cleanup() {
    var orderId = createdOrder;
    var customerId = createdCustomer;
    createdOrder = '';
    createdCustomer = '';
    var jobs = [];
    if (orderId) jobs.push(api.del('/api/orders/' + encodeURIComponent(orderId)).catch(function () { return null; }));
    if (customerId) jobs.push(api.del('/api/customers/' + encodeURIComponent(customerId)).catch(function () { return null; }));
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
