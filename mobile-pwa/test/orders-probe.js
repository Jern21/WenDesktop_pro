/**
 * 订单列表 + 详情探针
 *
 * 覆盖：搜索筛选、返回后保留筛选和滚动、改状态后卡片更新、
 * 部分付款不填比例会被拦住、提交中不能点第二次、不存在的订单有提示、加载失败可重试。
 *
 * 跑法：http://127.0.0.1:3460/test/orders-probe.html （后端需在 3456）
 */
import { loginWithCredentials } from '../src/api/auth.js';
import { api } from '../src/api/client.js';
import { startRouter, subscribe, navigate, getPath } from '../src/router.js';
import { mountMobileShell, updateMobileShell } from '../src/mobile-shell.js';
import { orderListSession } from '../src/views/order-session.js';

var results = [];
var createdId = '';

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

function appEl() {
    return document.getElementById('app');
}

function contentEl() {
    return appEl().querySelector('.mobile-content');
}

function cardByText(text) {
    var cards = appEl().querySelectorAll('.ord-card');
    for (var i = 0; i < cards.length; i++) {
        if (cards[i].textContent.indexOf(text) !== -1) return cards[i];
    }
    return null;
}

async function run() {
    orderListSession.filters.keyword = '';
    orderListSession.filters.status = '';
    orderListSession.filters.paymentStatus = '';
    orderListSession.filters.overdue = false;
    orderListSession.scrollTop = 0;
    orderListSession.snapshot = null;
    orderListSession.patch = null;

    var login = await loginWithCredentials('trial', '', false);
    if (!login.ok) throw new Error('trial 登录失败：' + (login.error || ''));

    startRouter();
    subscribe(function (path) { updateMobileShell(path); });
    mountMobileShell(appEl(), '/orders');
    navigate('/orders');

    await waitFor(function () {
        return appEl().querySelector('.ord-page') &&
            (appEl().querySelector('.lv-footer-text') || appEl().querySelector('.lv-empty') || appEl().querySelector('.lv-error'));
    }, 12000, '订单列表');
    record('订单列表挂上了', !appEl().querySelector('.lv-error'),
        appEl().querySelector('.lv-error') ? appEl().querySelector('.lv-empty-title').textContent : '');
    if (appEl().querySelector('.lv-error')) return results;

    var content = contentEl();
    content.scrollTop = 420;
    await sleep(30);
    record('列表能滚离顶部', content.scrollTop > 300, 'scrollTop=' + content.scrollTop);

    navigate('/orders/missing-probe-id');
    await waitFor(function () {
        var t = appEl().querySelector('.ord-state-title');
        return t && t.textContent.indexOf('不存在') !== -1;
    }, 8000, '不存在提示');
    record('记录不存在有提示', true, appEl().querySelector('.ord-state-title').textContent);

    appEl().querySelector('#mobile-topbar-back').click();
    await waitFor(function () {
        return getPath() === '/orders' && contentEl().scrollTop > 300;
    }, 8000, '返回后的滚动位置');
    record('返回后滚动位置还在', contentEl().scrollTop > 300, 'scrollTop=' + contentEl().scrollTop);

    var stamp = '探针单' + Date.now();
    var created = await api.post('/api/orders', {
        customerNick: '探针客户',
        customerPhone: '13800138000',
        projectType: '其他',
        projectName: stamp,
        amount: 200,
        cost: 50,
        hours: 2,
        orderDate: '2026-10-22',
        finalDate: '2026-10-25',
        orderStatus: 'pending',
        paymentStatus: '未付款'
    });
    createdId = created && created.data && created.data.id;
    record('探针订单已创建', !!createdId, createdId || '');
    if (!createdId) return results;

    var search = appEl().querySelector('.ord-search');
    search.value = stamp;
    search.dispatchEvent(new Event('input', { bubbles: true }));
    var card = await waitFor(function () { return cardByText(stamp); }, 8000, '搜索命中');
    record('关键词能搜到刚建的订单', !!card, stamp);
    record('筛选关键词留在输入框里', search.value === stamp, search.value);

    appEl().querySelector('[data-status="pending"]').click();
    card = await waitFor(function () { return cardByText(stamp); }, 8000, '状态筛选后的卡片');
    record('订单状态筛选保持选中',
        appEl().querySelector('[data-status="pending"]').classList.contains('is-active'), '');

    var origFetch = window.fetch;
    var failOnce = true;
    window.fetch = function (url, init) {
        var method = ((init && init.method) || 'GET').toUpperCase();
        if (failOnce && method === 'GET' && String(url).indexOf('/api/orders/' + createdId) !== -1) {
            failOnce = false;
            return Promise.resolve(new Response(JSON.stringify({ success: false, error: '探针模拟失败' }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' }
            }));
        }
        return origFetch.apply(this, arguments);
    };

    card.click();
    await waitFor(function () {
        var t = appEl().querySelector('.ord-state-title');
        return t && t.textContent.indexOf('探针模拟失败') !== -1;
    }, 8000, '加载失败');
    record('加载失败有提示', true, appEl().querySelector('.ord-state-title').textContent);
    appEl().querySelector('[data-act="retry"]').click();
    await waitFor(function () {
        var name = appEl().querySelector('.ord-hero-name');
        return name && name.textContent.indexOf(stamp) !== -1;
    }, 8000, '重试成功');
    record('点重试后详情出现', true, '');
    window.fetch = origFetch;

    appEl().querySelector('#mobile-topbar-back').click();
    await waitFor(function () { return getPath() === '/orders' && cardByText(stamp); }, 8000, '筛选还在时返回');
    record('返回后关键词还在', appEl().querySelector('.ord-search').value === stamp, '');
    record('返回后状态筛选还在',
        appEl().querySelector('[data-status="pending"]').classList.contains('is-active'), '');
    appEl().querySelector('[data-status=""]').click();
    card = await waitFor(function () { return cardByText(stamp); }, 8000, '清掉状态筛选');
    card.click();
    await waitFor(function () {
        var name = appEl().querySelector('.ord-hero-name');
        return name && name.textContent.indexOf(stamp) !== -1;
    }, 8000, '再次进入详情');

    appEl().querySelector('[data-act="status"]').click();
    await waitFor(function () { return document.querySelector('.ord-choice'); }, 4000, '状态弹层');
    var statusChoices = document.querySelectorAll('.ord-choice');
    for (var i = 0; i < statusChoices.length; i++) {
        if (statusChoices[i].textContent === '开发/设计中') statusChoices[i].click();
    }

    var puts = 0;
    window.fetch = function (url, init) {
        var method = ((init && init.method) || 'GET').toUpperCase();
        if (method === 'PUT' && String(url).indexOf('/api/orders/') !== -1) {
            puts++;
            return new Promise(function (resolve, reject) {
                setTimeout(function () {
                    origFetch.call(window, url, init).then(resolve, reject);
                }, 450);
            });
        }
        return origFetch.apply(this, arguments);
    };
    var saveBtn = document.querySelector('[data-act="save"]');
    saveBtn.click();
    saveBtn.click();
    await waitFor(function () {
        var badge = appEl().querySelector('.ord-hero-badges');
        return badge && badge.textContent.indexOf('开发/设计中') !== -1;
    }, 8000, '状态已更新');
    record('订单状态能改', true, '');
    record('提交中重复点击只发一次', puts === 1, 'PUT ' + puts + ' 次');
    window.fetch = origFetch;

    appEl().querySelector('[data-act="payment"]').click();
    await waitFor(function () { return document.querySelector('.ord-choice'); }, 4000, '付款弹层');
    var payChoices = document.querySelectorAll('.ord-choice');
    for (var j = 0; j < payChoices.length; j++) {
        if (payChoices[j].textContent === '部分付款') payChoices[j].click();
    }
    document.querySelector('[data-act="save"]').click();
    function toastText() {
        var nodes = document.querySelectorAll('.toast');
        var text = '';
        for (var n = 0; n < nodes.length; n++) text += nodes[n].textContent;
        return text;
    }
    await waitFor(function () { return toastText().indexOf('比例') !== -1; }, 4000, '比例提示');
    record('部分付款不填比例会被拦住',
        toastText().indexOf('比例') !== -1 && !!document.querySelector('.sheet-backdrop'),
        toastText());

    var ratioInput = document.querySelector('.ord-ratio input');
    ratioInput.value = '40';
    ratioInput.dispatchEvent(new Event('input', { bubbles: true }));
    document.querySelector('[data-act="save"]').click();
    await waitFor(function () {
        var badge = appEl().querySelector('.ord-hero-badges');
        return badge && badge.textContent.indexOf('40%') !== -1;
    }, 8000, '付款比例');
    record('部分付款写入 40%', true, appEl().querySelector('.ord-hero-badges').textContent);
    record('商务信息算了利润和时薪',
        !!appEl().querySelector('.ord-block') && appEl().textContent.indexOf('净利率') !== -1, '');

    appEl().querySelector('#mobile-topbar-back').click();
    await waitFor(function () { return getPath() === '/orders' && cardByText(stamp); }, 8000, '回到卡片');
    var backCard = cardByText(stamp);
    record('改完再返回，关键词还在',
        appEl().querySelector('.ord-search').value === stamp, '');
    record('返回后卡片是新状态',
        backCard.textContent.indexOf('开发/设计中') !== -1 && backCard.textContent.indexOf('40%') !== -1,
        backCard.textContent.replace(/\s+/g, ' ').slice(0, 80));

    /* ---------- 左滑编辑 / 删除 ---------- */
    var row = backCard.closest('.swipe-row');
    record('卡片包了左滑容器', !!row, '');
    var editBtn = row && row.querySelector('[data-swipe="edit"]');
    var delBtn = row && row.querySelector('[data-swipe="del"]');
    record('滑开区有编辑和删除按钮', !!(editBtn && delBtn), '');

    // 编辑：改项目名 → 保存 → 列表卡片就地更新
    editBtn.click();
    await waitFor(function () {
        return document.querySelector('.of-panel input[data-key="projectName"]');
    }, 4000, '编辑表单弹层');
    record('编辑按钮打开共享表单', true, '');
    var nameInput = document.querySelector('.of-panel input[data-key="projectName"]');
    nameInput.value = stamp + '-改';
    nameInput.dispatchEvent(new Event('input', { bubbles: true }));
    document.querySelector('.of-panel [data-act="save"]').click();
    await waitFor(function () {
        var c = cardByText(stamp);
        return c && c.textContent.indexOf(stamp + '-改') !== -1;
    }, 8000, '卡片就地更新');
    record('编辑保存后卡片就地更新', true, '');
    // close() 有 200ms 退场动画才摘节点，等它走完
    await waitFor(function () { return !document.querySelector('.of-panel'); }, 3000, '表单关闭');
    record('表单弹层已关', true, '');

    // 删除：点删除钮 → 危险确认层 → 确认 → 卡片消失
    var row2 = cardByText(stamp).closest('.swipe-row');
    row2.querySelector('[data-swipe="del"]').click();
    await waitFor(function () {
        var s = document.querySelector('.sheet-backdrop .sheet-title');
        return s && s.textContent.indexOf('删除') !== -1;
    }, 4000, '删除确认层');
    record('删除按钮弹危险确认', true, '');
    document.querySelector('.sheet-backdrop [data-act="confirm"]').click();
    await waitFor(function () { return !cardByText(stamp); }, 8000, '卡片消失');
    record('确认删除后卡片消失', true, '');
    createdId = '';   // 已经在 UI 里删掉，cleanup 不用再来一次

    return results;
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

function cleanup() {
    if (!createdId) return Promise.resolve();
    var id = createdId;
    createdId = '';
    return api.del('/api/orders/' + encodeURIComponent(id)).catch(function () { return null; });
}
