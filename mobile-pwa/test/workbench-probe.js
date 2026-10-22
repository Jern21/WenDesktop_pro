/**
 * 工作台面板回归探针
 *
 * 为什么要专门为它写一个：
 * 工作台是这次重构里**唯一被改动的旧页面** ——
 * 删掉了自建的 escapeHtml/formatMoney/formatDateLabel、改走 ledger.* 接口、
 * window.alert 换成 toast。这些都可能在渲染期炸而 build 不报错。
 *
 * 查的是「渲染出来的东西对不对」，不是「代码调用对不对」：
 * 金额有没有千分位、日期是不是「10月22日」、柱状图和流水条目有没有出来。
 */
import { loginWithCredentials } from '../src/api/auth.js';
import { mountWorkbenchPanel } from '../src/views/panels/workbench.js';

var results = [];

function record(name, ok, detail) {
    results.push({ name: name, ok: ok, detail: detail || '' });
}

function sleep(ms) {
    return new Promise(function (r) { setTimeout(r, ms); });
}

async function waitFor(fn, timeout, label) {
    var deadline = Date.now() + (timeout || 10000);
    while (Date.now() < deadline) {
        var v = fn();
        if (v) return v;
        await sleep(80);
    }
    throw new Error('等待超时：' + (label || ''));
}

async function run() {
    var host = document.getElementById('probe-host');

    var login = await loginWithCredentials('trial', '', false);
    if (!login.ok) throw new Error('trial 登录失败：' + (login.error || ''));

    var panel = mountWorkbenchPanel(host);

    /* ---- 1. 主体渲染 ---- */
    await waitFor(function () { return host.querySelector('.wb-root'); }, 12000, '工作台根节点');
    record('工作台渲染出根节点', true, '');

    var title = host.querySelector('.wb-hero-title');
    record('标题有内容', !!(title && title.textContent.trim()), title ? title.textContent : '(空)');

    /* ---- 2. 金额格式（验证 formatMoney 迁移正确） ---- */
    var amountEl = host.querySelector('#wb-total-income');
    var amountText = amountEl ? amountEl.textContent.trim() : '';
    // 允许「****」（用户开了隐藏金额），否则必须是千分位两位小数
    var amountOk = amountText === '****' || /^-?\d{1,3}(,\d{3})*\.\d{2}$/.test(amountText);
    record('累计收入是千分位两位小数', amountOk, '「' + amountText + '」');

    var expenseText = host.querySelector('[data-wb="expense"]');
    var expenseOk = !expenseText || expenseText.textContent.trim() === '****'
        || /^-?\d{1,3}(,\d{3})*\.\d{2}$/.test(expenseText.textContent.trim());
    record('累计支出格式一致', expenseOk, expenseText ? expenseText.textContent.trim() : '(无)');

    /* ---- 3. 趋势柱状图 ---- */
    var bars = host.querySelectorAll('.wb-bar');
    record('趋势柱状图有柱子', bars.length > 0, bars.length + ' 根');

    /* ---- 4. 流水条目 + 日期格式（验证 formatDate 迁移正确） ---- */
    var txs = host.querySelectorAll('.wb-tx');
    record('最近记录有条目', txs.length > 0, txs.length + ' 条');

    if (txs.length) {
        var meta = txs[0].querySelector('.wb-tx-meta');
        var metaText = meta ? meta.textContent.trim() : '';
        // 旧实现是 parseInt 去前导零 → "10月22日"；新实现必须保持一致，不能变成 "10月22日"→"2026年10月22日"
        var dateOk = /^\d{1,2}月\d{1,2}日 ·/.test(metaText);
        record('流水日期是「M月D日 · 分类」', dateOk, '「' + metaText + '」');

        var amtEl = txs[0].querySelector('.wb-tx-amount');
        var cls = amtEl ? amtEl.className : '';
        record('收支金额带正负语义色', /income|expense/.test(cls), cls);
    }

    /* ---- 5. 目标进度 ---- */
    var bar = host.querySelector('.wb-progress-bar');
    var width = bar ? bar.style.width : '';
    record('目标进度条有宽度值', /%$/.test(width), 'width=' + width);

    /* ---- 6. 交互：切换「全部」范围后重新渲染 ---- */
    var segAll = host.querySelector('#wb-range-seg button[data-range="all"]');
    if (segAll) {
        segAll.click();
        await waitFor(function () { return host.querySelector('.wb-root[data-range="all"]'); }, 8000, '全部范围');
        record('切换时间范围后重新渲染', true, 'data-range=all');
    } else {
        record('切换时间范围（未找到分段控件）', false, '');
    }

    /* ---- 7. 记账弹层能打开（不提交，避免污染数据） ---- */
    var addBtn = host.querySelector('#wb-add');
    if (addBtn) {
        addBtn.click();
        await sleep(120);
        var sheet = document.querySelector('.wb-sheet');
        record('「记一笔」弹层能打开', !!sheet, sheet ? '已打开' : '未出现');
        var cancel = document.querySelector('#wb-f-cancel');
        if (cancel) cancel.click();
        await sleep(80);
        record('取消后弹层关闭', !document.querySelector('.wb-sheet'), '');
    } else {
        record('「记一笔」按钮存在', false, '');
    }

    /* ---- 8. destroy 不报错且清理干净 ---- */
    if (panel && typeof panel.destroy === 'function') {
        panel.destroy();
    }
    // workbench 的 destroy 只是标记 disposed，不主动清 DOM（由 shell 负责），
    // 这里只验证调用不抛异常
    record('destroy() 可安全调用', true, '');

    return results;
}

run().then(function (list) {
    var failed = list.filter(function (r) { return !r.ok; });
    var allOk = failed.length === 0;

    var text = list.map(function (r) {
        return (r.ok ? '✓ ' : '✗ ') + r.name + (r.detail ? '  [' + r.detail + ']' : '');
    });
    text.push('');
    text.push(allOk ? ('全部通过：' + list.length + ' 项') : ('失败 ' + failed.length + ' / 共 ' + list.length + ' 项'));

    var pre = document.getElementById('result');
    pre.textContent = text.join('\n');
    pre.className = allOk ? 'ok' : 'bad';
    document.body.setAttribute('data-probe-result', allOk ? 'OK' : 'FAIL');
}).catch(function (e) {
    var pre = document.getElementById('result');
    pre.textContent = '探针异常：' + (e && e.message ? e.message : e);
    pre.className = 'bad';
    document.body.setAttribute('data-probe-result', 'ERROR');
});
