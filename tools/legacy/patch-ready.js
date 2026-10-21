/**
 * 把视图里的 `document.addEventListener('DOMContentLoaded', fn)` 改造成
 * 「未就绪则监听，已就绪则立即执行」。
 *
 * 原因：SPA 切页时 DOMContentLoaded 早已触发过，纯监听等于永不执行。
 */
const fs = require('fs');
const path = require('path');

const DIR = path.join(__dirname, '..', 'frontend', 'js', 'views');

// 单行形式：document.addEventListener('DOMContentLoaded', fn);
const SINGLE = /document\.addEventListener\('DOMContentLoaded',\s*([A-Za-z_$][\w$]*)\);/g;

let touched = [];

fs.readdirSync(DIR).filter(f => f.endsWith('.js')).forEach(function (file) {
    const full = path.join(DIR, file);
    let src = fs.readFileSync(full, 'utf8');
    const before = src;

    src = src.replace(SINGLE, function (whole, fn, offset) {
        // 已经处在 `if (document.readyState === 'loading')` 分支里的不用管（天然正确）
        const prev = src.slice(Math.max(0, offset - 220), offset);
        if (/if\s*\(\s*document\.readyState\s*===\s*['"]loading['"]\s*\)\s*\{\s*$/.test(prev)) {
            return whole;
        }
        return "if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', " +
            fn + '); } else { ' + fn + '(); }';
    });

    if (src !== before) {
        fs.writeFileSync(full, src, 'utf8');
        touched.push(file);
    }
});

console.log('已改造：', touched.join(', ') || '(无)');
