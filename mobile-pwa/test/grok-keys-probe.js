/**
 * GrokCtrl-Key 管理页（/grok/keys）回归探针
 *
 * 覆盖：页面骨架、说明区、生成按钮、列表区、destroy 清理。
 * 探针页没登录态，list 接口 401 → 断言错误态文案渲染即可；
 * 生成/吊销的真实链路另由后端实测验证。
 *
 * 跑法：先起后端（3456）和 vite dev（3460），再打开
 *   http://127.0.0.1:3460/test/grok-keys-probe.html
 */
import { mountGrokKeysPanel } from '../src/views/panels/grok-keys.js';

var host = document.getElementById('probe-host');
var result = document.getElementById('result');
var lines = [];
var failed = 0;
var pending = true;

function flush() {
    result.textContent = lines.join('\n') + '\n\n' + (pending
        ? '运行中…'
        : (failed ? '失败 ' + failed + ' / 共 ' + lines.length + ' 项'
                  : '全部通过：' + lines.length + ' 项'));
    result.dataset.probeResult = pending ? 'running' : 'done';
}

function record(name, ok, detail) {
    lines.push((ok ? '✓ ' : '✗ ') + name + (detail ? '  [' + detail + ']' : ''));
    if (!ok) failed += 1;
    flush();
}

function done() {
    pending = false;
    flush();
}

function waitFor(check, timeoutMs) {
    return new Promise(function (resolve) {
        var start = Date.now();
        (function poll() {
            if (check()) return resolve(true);
            if (Date.now() - start > timeoutMs) return resolve(false);
            setTimeout(poll, 60);
        })();
    });
}

var panel = mountGrokKeysPanel(host, { path: '/grok/keys', params: {} });

record('页面骨架渲染', !!host.querySelector('.gk-root'), '');
record('说明区 + Grok 标记 SVG', !!(host.querySelector('.gk-intro')
    && host.querySelector('.gk-intro-mark svg')), '');
record('生成新 Key 按钮存在', !!host.querySelector('#gk-create'), '');

/* 列表区渲染：等 list 接口回来（探针页无登录态 → 401 → 错误态文案） */
waitFor(function () {
    var el = host.querySelector('#gk-list .gk-empty');
    return el && el.textContent.indexOf('载入中') === -1;
}, 10000).then(function (settled) {
    record('列表区已落定（空态或错误态）', settled, '');

    var destroyOk = true;
    try {
        panel.destroy();
        panel.destroy();
    } catch (e) {
        destroyOk = false;
    }
    record('destroy() 可安全调用', destroyOk, '');
    done();
});
