/**
 * GrokBot 连接器（对话页）回归探针
 *
 * 覆盖：聊天骨架、悬浮接入条、开场问候/建议词条、
 * 未接入时的「模拟思考 → 随机回复」、destroy 清理。
 * 不真的调模型 —— 已接入时也会发真消息，探针只测未接入分支。
 *
 * 跑法：先起后端（3456）和 vite dev（3460），再打开
 *   http://127.0.0.1:3460/test/grok-probe.html
 */
import { mountGrokPanel } from '../src/views/panels/grok.js';

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

var panel = mountGrokPanel(host, { path: '/grok', params: {} });

waitFor(function () {
    return host.querySelector('.grok-root');
}, 10000).then(function (ready) {
    record('聊天骨架渲染', ready && !!host.querySelector('#grok-input')
        && !!host.querySelector('#grok-send'), '');
    if (!ready) return;

    record('悬浮接入条存在', !!host.querySelector('#grok-guide'), '');

    /* 点悬浮条应弹出接入指南弹层（下载按钮 + 四步 + 提示） */
    host.querySelector('#grok-guide').click();
    // 弹层挂 document.body（iOS 层叠上下文要求），不在 host 里
    var sheet = document.querySelector('.grok-sheet');
    record('点接入条弹出指南弹层', !!sheet, '');
    if (sheet) {
        record('弹层带下载按钮 + 四步', !!(sheet.querySelector('#grok-dl')
            && sheet.querySelectorAll('.grok-steps li').length === 4), '');
        record('弹层带 Key 管理页入口', !!sheet.querySelector('#grok-keys-go'), '');
        sheet.querySelector('.grok-sheet-close').click();
        record('关闭弹层', !document.querySelector('.grok-sheet'), '');
    }
    /* 问候是异步的：页面先拉服务端消息流，没历史才放开场白 */
    waitFor(function () { return host.querySelector('.grok-bubble'); }, 8000)
        .then(function (greeted) {
            record('开场问候已渲染', greeted, '');
            var chips = host.querySelectorAll('.grok-chip');
            record('建议词条渲染', chips.length >= 3, chips.length + ' 条');

            /* 发一条消息：未接入时应出现 typing 动画，随后随机回复一条
               （真机已接入时走真实 API —— 探针环境通常未配置，两个分支都能跑通） */
            var input = host.querySelector('#grok-input');
            input.value = '你好 GrokBot';
            host.querySelector('#grok-send').click();

            return waitFor(function () { return host.querySelector('.grok-typing'); }, 3000)
                .then(function (typingSeen) {
                    record('发送后出现「思考中」动画', typingSeen, '');

                    return waitFor(function () {
                        var bubbles = host.querySelectorAll('.grok-bubble');
                        // 问候 1 + 用户 1 + 回复 1 = 3 个气泡（typing 已移除）
                        return bubbles.length >= 3 && !host.querySelector('.grok-typing');
                    }, 15000);
                });
        })
        .then(function (replied) {
            record('收到回复气泡', replied, '');

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
});
