/**
 * 架构守卫（全项目）
 *
 * 跑法：
 *   node tools/verify-arch.js                    快速检查，只报「新增」违规
 *   node tools/verify-arch.js --all              连历史债务一起列出来看
 *   node tools/verify-arch.js --update-baseline  把当前问题记为基线（清完债后收缩用）
 *
 * 设计上最重要的一条：**基线机制**。
 *
 * 这个仓库有 6 个超过 800 行的历史文件，如果检查器一上来就要求全清，
 * 结果一定是没人跑它。所以：
 *   - 当前已知问题记在 tools/arch-baseline.json
 *   - 平时只报「本次新引入的」
 *   - 真正清完一批，用 --update-baseline 把基线收缩掉
 *
 * 这样「不许新增债」是可以立刻执行的要求，而「还旧债」变成有余力时的独立任务。
 *
 * 和 verify-mobile.js 的分工：
 *   本文件管「跨模块的架构规则」（分层、重复、规模、绕过封装）
 *   verify-mobile.js 管「移动端接线」（nav↔registry、import、CSS 变量、panel 契约）
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const BASELINE_FILE = path.join(__dirname, 'arch-baseline.json');

const args = process.argv.slice(2);
const SHOW_ALL = args.indexOf('--all') !== -1;
const UPDATE_BASELINE = args.indexOf('--update-baseline') !== -1;

/* ============================================================
 * 文件收集
 * ========================================================== */

const SKIP_DIRS = new Set(['node_modules', 'dist', '.git', '.workbuddy', 'test', 'tests']);

function walk(dir, exts, acc) {
    if (!fs.existsSync(dir)) return acc;
    fs.readdirSync(dir, { withFileTypes: true }).forEach((ent) => {
        const full = path.join(dir, ent.name);
        if (ent.isDirectory()) {
            if (SKIP_DIRS.has(ent.name)) return;
            walk(full, exts, acc);
        } else if (exts.indexOf(path.extname(ent.name)) !== -1) {
            acc.push(full);
        }
    });
    return acc;
}

function rel(p) {
    return path.relative(ROOT, p).replace(/\\/g, '/');
}

function readLines(file) {
    return fs.readFileSync(file, 'utf8').split(/\r?\n/);
}

const MOBILE_SRC = path.join(ROOT, 'mobile-pwa', 'src');
const FRONTEND_JS = path.join(ROOT, 'frontend', 'js');
const BACKEND_SRC = path.join(ROOT, 'backend', 'src');

const mobileFiles = walk(MOBILE_SRC, ['.js'], []);
const frontendFiles = walk(FRONTEND_JS, ['.js'], []);
const backendFiles = walk(BACKEND_SRC, ['.js'], []);

/* ============================================================
 * 违规收集
 * ========================================================== */

const findings = [];

/**
 * @param {string} rule    规则编号，baseline 用它分类
 * @param {string} file    绝对路径
 * @param {number} line    行号（仅用于展示，不进指纹 —— 行号会漂移）
 * @param {'error'|'warn'} severity
 * @param {string} message 人看的说明
 * @param {string} key     指纹补充信息（必须稳定：函数名 / 路径片段 / 空）
 */
function add(rule, file, line, severity, message, key) {
    findings.push({
        rule,
        file: rel(file),
        absFile: file,
        line,
        severity,
        message,
        fingerprint: rule + '|' + rel(file) + '|' + (key || '')
    });
}

function isUnder(file, dir) {
    return rel(file).indexOf(rel(dir)) === 0;
}

/* ============================================================
 * A1 视图/组件层不得直接拼接口路径
 * ========================================================== */

function ruleA1() {
    const targets = mobileFiles.filter((f) =>
        isUnder(f, path.join(MOBILE_SRC, 'views')) || isUnder(f, path.join(MOBILE_SRC, 'components')));

    targets.forEach((file) => {
        readLines(file).forEach((text, i) => {
            const m = text.match(/api\.(get|post|put|patch|del|request)\s*\(\s*['"`](\/api\/[^'"`?]*)/);
            if (!m) return;
            add('A1-绕过封装层', file, i + 1, 'error',
                `直接请求了 ${m[2]}，应改走 api/resources.js`, m[2]);
        });
    });
}

/* ============================================================
 * A2 禁止原生阻塞弹窗
 * ========================================================== */

function ruleA2() {
    const scan = (files, severity) => {
        files.forEach((file) => {
            readLines(file).forEach((text, i) => {
                if (!/window\.(alert|confirm)\s*\(/.test(text)) return;
                if (text.indexOf('allow-alert') !== -1) return;
                add('A2-原生弹窗', file, i + 1, severity,
                    '改用 core/ui.js 或 lib/toast.js 的提示组件（确有理由请加 // allow-alert）',
                    text.replace(/\s+/g, '').slice(0, 40));
            });
        });
    };
    scan(mobileFiles.filter((f) => isUnder(f, path.join(MOBILE_SRC, 'views'))
        || isUnder(f, path.join(MOBILE_SRC, 'components'))), 'error');
    scan(frontendFiles, 'warn');
}

/* ============================================================
 * A3/A4/A5 依赖方向
 * ========================================================== */

function collectImports(file) {
    const out = [];
    readLines(file).forEach((text, i) => {
        const re = /(?:from\s+|import\s*\()['"](\.[^'"]+)['"]/g;
        let m;
        while ((m = re.exec(text)) !== null) {
            out.push({ spec: m[1], line: i + 1 });
        }
    });
    return out;
}

function ruleA3A4A5() {
    // A3 组件不得依赖视图
    mobileFiles.filter((f) => isUnder(f, path.join(MOBILE_SRC, 'components'))).forEach((file) => {
        collectImports(file).forEach((imp) => {
            if (imp.spec.indexOf('/views/') === -1) return;
            add('A3-组件依赖视图', file, imp.line, 'error',
                `components 不许 import 具体页面（${imp.spec}），组件必须能脱离页面复用`, '');
        });
    });

    // A4 lib 必须是纯函数层
    mobileFiles.filter((f) => isUnder(f, path.join(MOBILE_SRC, 'lib'))).forEach((file) => {
        collectImports(file).forEach((imp) => {
            if (!/\/api\/|\/views\/|\/components\//.test(imp.spec)) return;
            add('A4-pure层被污染', file, imp.line, 'error',
                `lib 是纯函数层，不许依赖 ${imp.spec}（否则无法脱离浏览器单测）`, '');
        });
    });

    // A5 core 不得反向依赖业务模块
    frontendFiles.filter((f) => isUnder(f, path.join(FRONTEND_JS, 'core'))).forEach((file) => {
        collectImports(file).forEach((imp) => {
            if (!/\/views\/|\/project\/|\/settings\//.test(imp.spec)) return;
            add('A5-core反向依赖', file, imp.line, 'error',
                `core 是基础设施层，不许依赖业务模块（${imp.spec}）`, '');
        });
    });
}

/* ============================================================
 * A6 后端 utils 不得依赖 req/res（中间件文件除外）
 * ========================================================== */

const MIDDLEWARE_UTILS = ['auth.js', 'uploads.js', 'user-context.js'];

function ruleA6() {
    backendFiles.filter((f) => isUnder(f, path.join(BACKEND_SRC, 'utils'))).forEach((file) => {
        if (MIDDLEWARE_UTILS.indexOf(path.basename(file)) !== -1) return;
        readLines(file).forEach((text, i) => {
            // 忽略注释行
            if (/^\s*\*/.test(text) || /^\s*\/\//.test(text)) return;
            if (!/\b(req|res)\s*\./.test(text)) return;
            add('A6-utils依赖请求对象', file, i + 1, 'warn',
                'utils 应只处理业务规则，请求对象请以参数传入（中间件除外）',
                text.replace(/\s+/g, '').slice(0, 40));
        });
    });
}

/* ============================================================
 * A7 同一概念重复实现（按「域」分组，跨端不算重复）
 * ========================================================== */

const UNIQUE_HELPERS = [
    'escapeHtml', 'escapeXml', 'formatMoney', 'formatMoneyInt', 'formatMoneyCompact',
    'formatCurrency', 'formatDate', 'formatDateLabel', 'showToast', 'toast',
    'confirmDialog', 'confirmSheet', 'maskPhone', 'debounce', 'throttle'
];

function ruleA7() {
    const domains = [
        { name: 'mobile', files: mobileFiles },
        { name: 'frontend', files: frontendFiles },
        { name: 'backend', files: backendFiles }
    ];

    domains.forEach((domain) => {
        const defs = {};   // fnName -> [{file, line}]

        domain.files.forEach((file) => {
            readLines(file).forEach((text, i) => {
                UNIQUE_HELPERS.forEach((fn) => {
                    // 只认「本地定义」，三种写法都要覆盖：
                    //   function fn(          ← 私有函数
                    //   export function fn(   ← ESM 导出（**最容易漏，实测漏过一次**）
                    //   const fn = / var fn = function
                    const re = new RegExp(
                        '^\\s*(?:export\\s+(?:default\\s+)?)?(?:function\\s+' + fn + '\\s*\\(|(?:var|let|const)\\s+' + fn + '\\s*=)'
                    );
                    if (!re.test(text)) return;
                    if (!defs[fn]) defs[fn] = [];
                    defs[fn].push({ file: file, line: i + 1 });
                });
            });
        });

        Object.keys(defs).forEach((fn) => {
            const list = defs[fn];
            if (list.length < 2) return;
            const where = list.map((x) => rel(x.file)).join('、');
            list.forEach((loc) => {
                // 指纹只认「函数名 + 位置」，不含重复份数：
                // 否则清掉一份实现（好事）会让剩下几份的指纹全变，被误报成「新增」。
                add('A7-重复实现', loc.file, loc.line, 'warn',
                    `${fn}() 在同一域内有 ${list.length} 份实现（${where}），应合并到唯一位置`,
                    fn);
            });
        });
    });
}

/* ============================================================
 * A8 单文件规模（拆分信号）
 * ========================================================== */

const WARN_LINES = 600;

function ruleA8() {
    const all = mobileFiles.concat(frontendFiles, backendFiles);
    all.forEach((file) => {
        const count = readLines(file).length;
        if (count <= WARN_LINES) return;
        add('A8-文件过大', file, 1, 'warn',
            `${count} 行，超过 ${WARN_LINES} 行阈值 —— 按「模块目录化」拆（详见 ARCHITECTURE.md 第三节）`,
            '');
    });
}

/* ============================================================
 * A10 后端路由不得绕过 Storage 直接读业务数据
 * ========================================================== */

function ruleA10() {
    backendFiles.filter((f) => isUnder(f, path.join(BACKEND_SRC, 'routes'))).forEach((file) => {
        readLines(file).forEach((text, i) => {
            if (/^\s*\*/.test(text) || /^\s*\/\//.test(text)) return;
            if (!/(readFileSync|readFile)\s*\(/.test(text)) return;
            add('A10-绕过仓储读文件', file, i + 1, 'error',
                '路由层不许直接读文件，一律走 utils/ 里的仓储（否则绕过用户隔离与备份）',
                text.replace(/\s+/g, '').slice(0, 40));
        });
    });
}

/* ============================================================
 * A11 桌面端视图不得直接 fetch
 * ========================================================== */

function ruleA11() {
    frontendFiles.filter((f) => isUnder(f, path.join(FRONTEND_JS, 'views'))).forEach((file) => {
        readLines(file).forEach((text, i) => {
            if (/^\s*\*/.test(text) || /^\s*\/\//.test(text)) return;
            if (!/\bfetch\s*\(/.test(text)) return;
            add('A11-视图直接fetch', file, i + 1, 'warn',
                '视图应走 frontend/js/api.js 的 window.api，不要直接 fetch（错误处理与重试策略会分叉）',
                text.replace(/\s+/g, '').slice(0, 40));
        });
    });
}

/* ============================================================
 * 执行规则
 * ========================================================== */

ruleA1();
ruleA2();
ruleA3A4A5();
ruleA6();
ruleA7();
ruleA8();
ruleA10();
ruleA11();

/* ============================================================
 * Baseline 比对
 * ========================================================== */

function loadBaseline() {
    if (!fs.existsSync(BASELINE_FILE)) return { fingerprints: [] };
    try {
        const json = JSON.parse(fs.readFileSync(BASELINE_FILE, 'utf8'));
        return { fingerprints: Array.isArray(json.fingerprints) ? json.fingerprints : [] };
    } catch (e) {
        console.error('基线文件解析失败，按空基线处理：' + e.message);
        return { fingerprints: [] };
    }
}

const baseline = loadBaseline();
const known = new Set(baseline.fingerprints);

if (UPDATE_BASELINE) {
    const unique = Array.from(new Set(findings.map((f) => f.fingerprint))).sort();
    fs.writeFileSync(BASELINE_FILE, JSON.stringify({
        _comment: '架构守卫基线：已知历史问题。清掉一批后用 node tools/verify-arch.js --update-baseline 收缩。',
        updatedAt: new Date().toISOString(),
        fingerprints: unique
    }, null, 2) + '\n');
    console.log('');
    console.log(`基线已更新：${unique.length} 条已知问题 → ${rel(BASELINE_FILE)}`);
    console.log('');
    process.exit(0);
}

const added = [];
const legacy = [];

findings.forEach((f) => {
    if (known.has(f.fingerprint)) legacy.push(f);
    else added.push(f);
});

/* ============================================================
 * 输出
 * ========================================================== */

const RULE_TITLES = {
    'A1-绕过封装层': '绕过封装层直连接口',
    'A2-原生弹窗': '使用原生阻塞弹窗',
    'A3-组件依赖视图': '组件反向依赖页面',
    'A4-pure层被污染': '纯函数层被业务依赖污染',
    'A5-core反向依赖': 'core 反向依赖业务模块',
    'A6-utils依赖请求对象': 'utils 触碰 req/res',
    'A7-重复实现': '同一概念重复实现',
    'A8-文件过大': '单文件超出拆分阈值',
    'A10-绕过仓储读文件': '路由绕过仓储读文件',
    'A11-视图直接fetch': '视图直接 fetch'
};

function printGroup(list, title) {
    if (!list.length) return;
    console.log('');
    console.log(title + '（' + list.length + '）');

    const byRule = {};
    list.forEach((f) => {
        if (!byRule[f.rule]) byRule[f.rule] = [];
        byRule[f.rule].push(f);
    });

    Object.keys(byRule).sort().forEach((rule) => {
        const items = byRule[rule].sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line);
        console.log('');
        console.log('  ▸ ' + (RULE_TITLES[rule] || rule));
        items.slice(0, SHOW_ALL ? 999 : 12).forEach((f) => {
            const mark = f.severity === 'error' ? '✗' : '·';
            console.log(`    ${mark} ${f.file}:${f.line}  ${f.message}`);
        });
        if (!SHOW_ALL && items.length > 12) {
            console.log(`    … 另有 ${items.length - 12} 条（加 --all 看全部）`);
        }
    });
}

console.log('');
console.log('架构守卫（' + (mobileFiles.length + frontendFiles.length + backendFiles.length) +
    ' 个文件：mobile ' + mobileFiles.length + ' / frontend ' + frontendFiles.length +
    ' / backend ' + backendFiles.length + '）');
console.log('─'.repeat(68));

printGroup(added, '新增违规');
if (SHOW_ALL) printGroup(legacy, '历史债务（已记入基线，不阻断）');

const addedErrors = added.filter((f) => f.severity === 'error');
const addedWarns = added.filter((f) => f.severity === 'warn');

console.log('');
console.log('─'.repeat(68));
console.log('新增：' + addedErrors.length + ' 个错误 / ' + addedWarns.length + ' 个提醒' +
    '　│　历史（基线内）：' + legacy.length + ' 条');

if (addedErrors.length) {
    console.log('');
    console.log('✗ 不通过：新代码引入了架构违规。');
    console.log('  规则说明见 ARCHITECTURE.md「二、依赖方向」与「五、禁止清单」。');
    process.exit(1);
}

console.log('✓ 通过：没有新增架构违规' + (addedWarns.length ? '（有 ' + addedWarns.length + ' 个提醒，建议处理）' : ''));
console.log('');
