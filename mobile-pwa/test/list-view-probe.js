/**
 * list-view 回归探针（浏览器内跑）
 *
 * 覆盖的是「node 测不到」的部分：真实 fetch、真实 DOM、真实触摸事件。
 * 重点是两个手势：
 *   - 下拉未达阈值 → **不能**刷新（否则轻轻碰一下列表就重载）
 *   - 下拉超过阈值 → 必须刷新，且请求的是第 1 页
 * 以及上拉分页、空态、错误态。
 *
 * 结果写进 window.__PROBE_RESULT__ / body[data-probe-result] / <pre id="result">。
 */
import { loginWithCredentials } from '../src/api/auth.js';
import { orders } from '../src/api/resources.js';
import { createListView } from '../src/components/list-view.js';

var results = [];

function record(name, ok, detail) {
    results.push({ name: name, ok: ok, detail: detail || '' });
}

function sleep(ms) {
    return new Promise(function (r) { setTimeout(r, ms); });
}

async function waitFor(fn, timeout, label) {
    var deadline = Date.now() + (timeout || 8000);
    while (Date.now() < deadline) {
        if (fn()) return true;
        await sleep(60);
    }
    throw new Error('等待超时：' + (label || ''));
}

function renderItem(order) {
    return '<div class="fake-card">' +
        '<strong>' + String(order.projectName || '未命名') + '</strong>' +
        '<div>' + String(order.orderStatus || '') + '</div></div>';
}

/** 派发一个合成触摸事件（Chrome 支持 new Touch） */
function fireTouch(el, type, x, y) {
    var t = new Touch({ identifier: 1, target: el, clientX: x, clientY: y, pageX: x, pageY: y });
    var isEnd = type === 'touchend' || type === 'touchcancel';
    var ev = new TouchEvent(type, {
        touches: isEnd ? [] : [t],
        targetTouches: isEnd ? [] : [t],
        changedTouches: [t],
        bubbles: true,
        cancelable: true
    });
    el.dispatchEvent(ev);
}

async function run() {
    var host = document.getElementById('probe-host');

    /* ---------- 登录（真实流程，走会话层） ---------- */
    var login = await loginWithCredentials('trial', '', false);
    if (!login.ok) {
        throw new Error('trial 登录失败，探针无法继续：' + (login.error || ''));
    }

    /* ---------- 1. 首屏加载 ---------- */
    var calls = [];
    var lv = createListView({
        container: host,
        pageSize: 5,
        fetchPage: function (ctx) {
            calls.push(ctx.page);
            return orders.list({ page: ctx.page, pageSize: ctx.pageSize }, { signal: ctx.signal });
        },
        renderItem: renderItem,
        emptyText: '没有订单',
        skeletonCount: 3
    });

    await waitFor(function () { return lv.getState().count > 0; }, 10000, '首屏数据');
    var st = lv.getState();
    record('首屏加载出数据', st.count > 0, st.count + ' 条 / 共 ' + st.total);
    record('首屏请求的是第 1 页', calls[0] === 1, 'calls=' + JSON.stringify(calls));
    record('DOM 里渲染了对应数量的条目',
        host.querySelectorAll('.lv-item').length === st.count,
        host.querySelectorAll('.lv-item').length + ' 个 .lv-item');

    /* ---------- 2. 上拉加载更多 ---------- */
    if (st.hasMore) {
        var before = lv.getState().count;
        await lv.loadMore();
        await sleep(120);
        var after = lv.getState().count;
        record('上拉后条目增多', after > before, before + ' → ' + after);
        record('上拉请求的是第 2 页', calls.indexOf(2) !== -1, 'calls=' + JSON.stringify(calls));
        record('上拉后没有重复条目',
            host.querySelectorAll('.lv-item').length === after,
            host.querySelectorAll('.lv-item').length + ' vs state ' + after);
    } else {
        record('上拉加载（数据不足一页，跳过）', true, 'hasMore=false');
    }

    /* ---------- 3. 下拉：未达阈值不应刷新 ---------- */
    host.scrollTop = 0;
    var callsBeforeSmallPull = calls.length;
    fireTouch(host, 'touchstart', 100, 100);
    fireTouch(host, 'touchmove', 100, 150);   // delta 50 → 位移约 27px，不够阈值
    await sleep(30);
    var pullHeight = host.querySelector('.lv-pull').style.height;
    fireTouch(host, 'touchend', 100, 150);
    await sleep(400);

    record('小幅度下拉没有触发刷新',
        calls.length === callsBeforeSmallPull,
        'calls ' + callsBeforeSmallPull + ' → ' + calls.length);
    record('小幅度下拉时指示器有跟手高度',
        parseInt(pullHeight, 10) > 0,
        'height=' + pullHeight);
    record('松手后指示器归零',
        parseInt(host.querySelector('.lv-pull').style.height || '0', 10) === 0,
        'height=' + host.querySelector('.lv-pull').style.height);

    /* ---------- 4. 下拉：超过阈值应刷新 ---------- */
    host.scrollTop = 0;
    var callsBeforeBigPull = calls.length;
    fireTouch(host, 'touchstart', 100, 100);
    fireTouch(host, 'touchmove', 100, 180);   // delta 80 → 44px，接近阈值
    fireTouch(host, 'touchmove', 100, 320);   // delta 220 → 封顶 88px，超过阈值
    await sleep(30);
    var readyClass = host.querySelector('.lv-pull').className;
    record('拉过阈值时提示「松开刷新」',
        readyClass.indexOf('is-ready') !== -1,
        'class=' + readyClass);

    fireTouch(host, 'touchend', 100, 320);
    await sleep(1500);

    record('拉过阈值后触发了刷新',
        calls.length > callsBeforeBigPull,
        'calls ' + callsBeforeBigPull + ' → ' + calls.length);
    record('刷新请求的是第 1 页',
        calls[calls.length - 1] === 1,
        'last page=' + calls[calls.length - 1]);
    record('刷新完成后列表仍有数据', lv.getState().count > 0, lv.getState().count + ' 条');

    lv.destroy();
    record('destroy 后容器被清空', host.innerHTML === '', 'innerHTML 长度 ' + host.innerHTML.length);

    /* ---------- 5. 空态 ---------- */
    var emptyHost = document.createElement('div');
    emptyHost.className = 'mobile-content';
    document.body.appendChild(emptyHost);
    var emptyLv = createListView({
        container: emptyHost,
        fetchPage: function () { return Promise.resolve({ success: true, data: [] }); },
        renderItem: renderItem,
        emptyText: '还没有订单'
    });
    await waitFor(function () { return !!emptyHost.querySelector('.lv-empty'); }, 4000, '空态');
    record('空数据显示空态文案',
        emptyHost.querySelector('.lv-empty-title').textContent === '还没有订单',
        emptyHost.querySelector('.lv-empty-title').textContent);
    emptyLv.destroy();
    emptyHost.remove();

    /* ---------- 6. 错误态 + 中文文案 ---------- */
    var errHost = document.createElement('div');
    errHost.className = 'mobile-content';
    document.body.appendChild(errHost);
    var errLv = createListView({
        container: errHost,
        fetchPage: function () {
            return orders.detail('__not_exist__');
        },
        renderItem: renderItem
    });
    await waitFor(function () { return !!errHost.querySelector('.lv-error'); }, 5000, '错误态');
    var errText = errHost.querySelector('.lv-error .lv-empty-title').textContent;
    record('请求失败显示错误态且文案是后端中文', /不存在/.test(errText), errText);
    record('错误态提供重试按钮', !!errHost.querySelector('[data-act="retry"]'), '');
    errLv.destroy();
    errHost.remove();

    return results;
}

/* ---------- 输出 ---------- */
run().then(function (list) {
    var failed = list.filter(function (r) { return !r.ok; });
    var allOk = failed.length === 0;

    var lines = list.map(function (r) {
        return (r.ok ? '✓ ' : '✗ ') + r.name + (r.detail ? '  [' + r.detail + ']' : '');
    });
    lines.push('');
    lines.push(allOk ? ('全部通过：' + list.length + ' 项') : ('失败 ' + failed.length + ' 项 / 共 ' + list.length + ' 项'));

    var pre = document.getElementById('result');
    pre.textContent = lines.join('\n');
    pre.className = allOk ? 'ok' : 'bad';

    window.__PROBE_RESULT__ = { ok: allOk, total: list.length, failed: failed.length, items: list };
    document.body.setAttribute('data-probe-result', allOk ? 'OK' : 'FAIL');
    document.title = allOk ? 'PROBE_OK' : 'PROBE_FAIL';
}).catch(function (e) {
    var pre = document.getElementById('result');
    pre.textContent = '探针异常：' + (e && e.message ? e.message : e);
    pre.className = 'bad';
    document.body.setAttribute('data-probe-result', 'ERROR');
    document.title = 'PROBE_ERROR';
    window.__PROBE_RESULT__ = { ok: false, error: String(e && e.message) };
});
