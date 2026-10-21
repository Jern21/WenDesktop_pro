/**
 * 批量提取剩余页面
 *
 *   node tools/batch-extract.js
 */
'use strict';

var execFileSync = require('child_process').execFileSync;
var path = require('path');

var ROOT = path.join(__dirname, '..');

var TARGETS = [
    ['frontend/pages/business/quote.html', 'quote'],
    ['frontend/pages/content/stats.html', 'stats'],
    ['frontend/pages/content/project.html', 'project'],
    ['frontend/pages/business/orders.html', 'orders'],
    ['frontend/pages/business/customer.html', 'customer'],
    ['frontend/pages/personal/reminder.html', 'reminder'],
    ['frontend/pages/personal/accounts.html', 'accounts'],
    ['frontend/pages/personal/settings.html', 'settings'],
    ['frontend/index.html', 'dashboard'],
    ['frontend/pages/content/posters.html', 'posters'],
    ['frontend/pages/content/canvas.html', 'canvas'],
    ['frontend/pages/personal/resume.html', 'resume']
];

var ok = 0;
var fail = 0;

TARGETS.forEach(function (pair) {
    try {
        var out = execFileSync(process.execPath, [
            path.join(__dirname, 'extract-view.js'),
            pair[0],
            pair[1]
        ], { encoding: 'utf-8', cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] });
        console.log(out);
        ok++;
    } catch (e) {
        fail++;
        console.log('=== ' + pair[0] + ' → ' + pair[1] + ' ===');
        console.log('❌ 失败: ' + (e.stdout || '') + (e.stderr || e.message));
        console.log('');
    }
});

console.log('========================================');
console.log('成功 ' + ok + ' 个，失败 ' + fail + ' 个');
console.log('========================================');
