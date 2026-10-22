/**
 * 统一检查入口 —— 提交代码前只跑这一条
 *
 * 跑法：
 *   node tools/check-all.js          静态检查 + 快速单测（不需要任何服务，约 2 秒）
 *   node tools/check-all.js --full   额外跑需要后端在跑/需要浏览器的测试
 *
 * 为什么要有这个入口：
 * 项目里已经有 6 个检查脚本，各自跑记不住、也容易只跑其中一两个。
 * 一条命令跑全，比在文档里列 6 条命令有效得多。
 *
 * 分两档是刻意的：
 *   默认档必须「随时能跑」—— 不需要起服务、不需要装浏览器，否则没人跑；
 *   --full 档用来做交付前的完整验证。
 */
'use strict';

const { spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const ROOT = path.join(__dirname, '..');
const FULL = process.argv.indexOf('--full') !== -1;

/* ============================================================
 * 检查清单
 * ========================================================== */

const STATIC_CHECKS = [
    {
        name: '桌面端一致性',
        cmd: 'node tools/verify-consistency.js',
        hint: '路由/视图/模板/样式是否齐备'
    },
    {
        name: '桌面端依赖接线',
        cmd: 'node tools/verify-deps.js',
        hint: '视图引用的 window.X 到底加载没有'
    },
    {
        name: '架构守卫',
        cmd: 'node tools/verify-arch.js',
        hint: '分层/重复实现/文件规模/绕过封装（只拦新增）'
    },
    {
        name: '移动端接线',
        cmd: 'node tools/verify-mobile.js',
        hint: 'nav↔registry/import/panel契约/CSS变量'
    },
    {
        name: '移动端纯逻辑',
        cmd: 'node tools/test-mobile-lib.mjs',
        hint: 'format/pagination/urls/ApiError 共 29 项'
    }
];

const FULL_CHECKS = [
    {
        name: '移动端接口层',
        cmd: 'node tools/test-mobile-api.mjs 3456',
        hint: '打真实后端，需 backend 在跑'
    },
    {
        name: '桌面端核心冒烟',
        cmd: 'node frontend/test/core.smoke.js',
        hint: '桌面端 core 模块'
    },
    {
        name: '后端测试',
        cmd: 'node --test backend/test/',
        hint: '全部后端单测'
    }
];

/* ============================================================
 * 执行
 * ========================================================== */

function runOne(item) {
    const started = Date.now();
    const parts = item.cmd.split(' ');
    const res = spawnSync(parts[0], parts.slice(1), {
        cwd: ROOT,
        encoding: 'utf8',
        shell: process.platform === 'win32',
        timeout: 300000
    });
    const ms = Date.now() - started;
    const out = ((res.stdout || '') + (res.stderr || '')).trim();

    return {
        name: item.name,
        hint: item.hint,
        ok: res.status === 0,
        ms: ms,
        output: out,
        // 失败时给出最后几行，够定位就行；太长会淹没其他结果
        tail: out.split(/\r?\n/).filter(Boolean).slice(-6).join('\n')
    };
}

const checks = FULL ? STATIC_CHECKS.concat(FULL_CHECKS) : STATIC_CHECKS;

console.log('');
console.log('项目检查' + (FULL ? '（完整档：含需要服务的测试）' : '（快速档：静态 + 纯逻辑）'));
console.log('─'.repeat(70));
if (!FULL) {
    console.log('提示：加 --full 会额外跑接口层 / 桌面端冒烟 / 后端测试（需要 backend 在跑）');
    console.log('');
}

const results = [];
checks.forEach((item) => {
    process.stdout.write('  ' + item.name + ' … ');
    const r = runOne(item);
    results.push(r);
    console.log((r.ok ? '✓' : '✗') + '  ' + r.ms + 'ms');
});

/* ============================================================
 * 汇总
 * ========================================================== */

const failed = results.filter((r) => !r.ok);

console.log('');
console.log('─'.repeat(70));

if (failed.length) {
    failed.forEach((r) => {
        console.log('');
        console.log('✗ ' + r.name + '  （' + r.hint + '）');
        r.tail.split('\n').forEach((line) => console.log('    ' + line));
    });
    console.log('');
    console.log('提示：若某个失败项涉及的目录你本次没有改动，很可能是并行会话正在重构的中间状态。');
    console.log('      先确认再动手，不要顺手改（见 ARCHITECTURE.md 第八节）。');
    console.log('');
    console.log('结果：' + (results.length - failed.length) + ' 通过 / ' + failed.length + ' 失败');
    console.log('');
    process.exit(1);
}

console.log('结果：' + results.length + ' 项全部通过');
console.log('');
if (!FULL) {
    console.log('（要跑完整档：node tools/check-all.js --full）');
    console.log('');
}
