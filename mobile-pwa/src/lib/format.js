/**
 * 格式化工具（纯函数，无 DOM 依赖 → 可以直接用 node 跑单测）
 *
 * 有一条坑必须记住：后端存的日期是 `'2026-10-22'` 这种**无时区**字符串。
 * 用 `new Date('2026-10-22')` 会按 **UTC** 解析，在东八区变成 10-22 08:00，
 * 但如果反过来用 `toISOString()` 输出就会退回前一天。
 * 所以这里一律走 parseLocalDate() 自己拆，不做任何 UTC 转换。
 */

/* ============================================================
 * HTML / 基础
 * ========================================================== */

export function escapeHtml(value) {
    return String(value === null || value === undefined ? '' : value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

/** 只保留路径末尾，用于极长的项目名做省略（模板里再配 CSS ellipsis） */
export function truncate(str, max) {
    var s = String(str || '');
    var n = max || 20;
    return s.length > n ? s.slice(0, n) + '…' : s;
}

/* ============================================================
 * 数字 / 金额
 * ========================================================== */

function toNumber(n) {
    var v = parseFloat(n);
    return isNaN(v) ? 0 : v;
}

/** 千分位，两位小数：12345.6 → "12,345.60" */
export function formatMoney(n, hidden) {
    if (hidden) return '****';
    var v = Math.round(toNumber(n) * 100) / 100;
    var parts = v.toFixed(2).split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return parts.join('.');
}

/** 不需要小数时用这个：整数金额 */
export function formatMoneyInt(n, hidden) {
    if (hidden) return '****';
    var v = Math.round(toNumber(n));
    return String(v).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/** 去掉 "2.30" 这种尾部零 → "2.3"；整万整亿时去掉小数点 → "1万" */
function trimTrailingZero(s) {
    return s.replace(/\.?0+$/, '');
}

/** 手机窄屏的紧凑写法：12800 → "1.28万"，980 → "980" */
export function formatMoneyCompact(n, hidden) {
    if (hidden) return '****';
    var v = toNumber(n);
    var abs = Math.abs(v);
    if (abs >= 100000000) return trimTrailingZero((v / 100000000).toFixed(2)) + '亿';
    if (abs >= 10000) return trimTrailingZero((v / 10000).toFixed(2)) + '万';
    return formatMoneyInt(v);
}

/** 百分比：0.237 → "23.7%"，入参是 0~1 的比率 */
export function formatPercent(ratio, digits) {
    var d = digits === undefined ? 1 : digits;
    return (toNumber(ratio) * 100).toFixed(d) + '%';
}

/** 增长率带符号：0.125 → "+12.5%"；入参是 0~1 的比率 */
export function formatGrowth(ratio) {
    var v = toNumber(ratio);
    var sign = v > 0 ? '+' : '';
    return sign + (v * 100).toFixed(1) + '%';
}

/**
 * 后端 calcGrowth 已经是整数百分点（12 表示 12%）。
 * 不要再乘 100，否则看板会把 12% 显示成 1200%。
 */
export function formatGrowthPoints(n) {
    if (typeof n !== 'number' || isNaN(n)) return '';
    if (n > 0) return '+' + n + '%';
    if (n < 0) return n + '%';
    return '持平';
}

/* ============================================================
 * 日期
 * ========================================================== */

/**
 * 把 '2026-10-22' / '2026-10-22T08:00:00.000Z' / Date 统一成本地 Date。
 * 只取前 10 位再拆，避开 UTC 偏移。
 */
export function parseLocalDate(value) {
    if (!value) return null;
    if (value instanceof Date) return isNaN(value.getTime()) ? null : value;
    var m = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!m) return null;
    var d = new Date(parseInt(m[1], 10), parseInt(m[2], 10) - 1, parseInt(m[3], 10));
    return isNaN(d.getTime()) ? null : d;
}

/** 'YYYY-MM-DD'（本地时区，不受 UTC 影响） */
export function toDateKey(value) {
    var d = parseLocalDate(value);
    if (!d) return '';
    var m = String(d.getMonth() + 1).padStart(2, '0');
    var day = String(d.getDate()).padStart(2, '0');
    return d.getFullYear() + '-' + m + '-' + day;
}

/** 今天 0 点的 'YYYY-MM-DD' */
export function todayKey() {
    return toDateKey(new Date());
}

/**
 * 展示用日期
 * @param {*} value
 * @param {'short'|'month-day'|'full'|'datetime'} [style]
 *   short     → 今天 / 明天 / 昨天 / 10月22日 / 2025年10月22日
 *   month-day → 10月22日
 *   full      → 2026-10-22
 *   datetime  → 10-22 14:30
 */
export function formatDate(value, style) {
    var d = parseLocalDate(value);
    if (!d) return '';
    var now = new Date();
    var thisYear = d.getFullYear() === now.getFullYear();
    var mm = String(d.getMonth() + 1);
    var dd = String(d.getDate());

    if (style === 'full') return toDateKey(d);
    if (style === 'month-day') return mm + '月' + dd + '日';

    if (style === 'datetime') {
        var m = String(value).match(/[T ](\d{2}):(\d{2})/);
        var hm = m ? ' ' + m[1] + ':' + m[2] : '';
        return mm + '-' + String(d.getDate()).padStart(2, '0') + hm;
    }

    var diff = diffDays(d, now);
    if (diff === 0) return '今天';
    if (diff === 1) return '明天';
    if (diff === -1) return '昨天';
    return thisYear ? mm + '月' + dd + '日' : d.getFullYear() + '年' + mm + '月' + dd + '日';
}

/** a - b 的天数差（都按本地 0 点算，避免小时误差） */
export function diffDays(a, b) {
    var da = parseLocalDate(a);
    var db = parseLocalDate(b);
    if (!da || !db) return 0;
    var ta = new Date(da.getFullYear(), da.getMonth(), da.getDate()).getTime();
    var tb = new Date(db.getFullYear(), db.getMonth(), db.getDate()).getTime();
    return Math.round((ta - tb) / 86400000);
}

/**
 * 一条提醒该进哪个分组。
 * 本周算到本周日为止（今天单独进「今天」，已完成单独一组，和日期无关）。
 * @returns {'overdue'|'today'|'week'|'later'|'done'}
 */
export function reminderBucket(item, today) {
    if (!item) return 'later';
    if (item.done) return 'done';
    var raw = String(item.date || '');
    if (!/^\d{4}-\d{2}-\d{2}/.test(raw)) return 'later';
    var base = today || new Date();
    var diff = diffDays(raw, base);
    if (diff < 0) return 'overdue';
    if (diff === 0) return 'today';
    var untilSunday = base.getDay() === 0 ? 0 : 7 - base.getDay();
    if (diff <= untilSunday) return 'week';
    return 'later';
}

/**
 * 截止日期的口语化描述（订单/待办卡片上最有用）
 * @returns {{ text: string, tone: 'overdue'|'today'|'soon'|'normal'|'none' }}
 */
export function describeDeadline(value) {
    var d = parseLocalDate(value);
    if (!d) return { text: '', tone: 'none' };
    var diff = diffDays(d, new Date());

    if (diff < 0) return { text: '逾期 ' + Math.abs(diff) + ' 天', tone: 'overdue' };
    if (diff === 0) return { text: '今天到期', tone: 'today' };
    if (diff === 1) return { text: '明天到期', tone: 'soon' };
    if (diff <= 3) return { text: diff + ' 天后到期', tone: 'soon' };
    if (diff <= 7) return { text: diff + ' 天后', tone: 'normal' };
    return { text: formatDate(d, 'month-day'), tone: 'normal' };
}

/* ============================================================
 * 业务枚举 → 中文（与后端 order-payload.js 保持一致）
 * ========================================================== */

/** 订单状态：值是后端唯一合法取值，改这里必须同步 backend/src/utils/order-payload.js */
export var ORDER_STATUS_LABELS = {
    pending: '待确认需求',
    processing: '开发/设计中',
    acceptance: '待验收',
    completed: '已完成',
    closed: '已关闭'
};

export var ORDER_STATUS_ORDER = ['pending', 'processing', 'acceptance', 'completed', 'closed'];

/** 付款状态 */
export var PAYMENT_STATUS_LABELS = {
    '未付款': '未付款',
    '部分付款': '部分付款',
    '已结清': '已结清'
};

export function orderStatusLabel(status) {
    return ORDER_STATUS_LABELS[status] || status || '未设置';
}

/** 状态 → 语义色名（配合 CSS 的 .is-xxx 类名，不直接写颜色） */
export function orderStatusTone(status) {
    if (status === 'pending') return 'warn';
    if (status === 'processing') return 'info';
    if (status === 'acceptance') return 'accent';
    if (status === 'completed') return 'ok';
    if (status === 'closed') return 'muted';
    return 'muted';
}

var PLATFORM_LABELS = {
    xianyu: '闲鱼',
    xiaohongshu: '小红书',
    douyin: '抖音',
    wechat: '微信'
};

var POST_STATUS_LABELS = {
    draft: '草稿',
    pending: '待发布',
    published: '已发布',
    offline: '已下线'
};

export function platformLabel(key) {
    return PLATFORM_LABELS[key] || key || '未标平台';
}

export function postStatusLabel(status) {
    return POST_STATUS_LABELS[status] || status || '未标状态';
}

export function paymentStatusTone(status) {
    if (status === '已结清') return 'ok';
    if (status === '部分付款') return 'warn';
    if (status === '未付款') return 'danger';
    return 'muted';
}

/* ============================================================
 * 联系方式脱敏（移动端截图外发时最需要）
 * ========================================================== */

export function maskPhone(phone) {
    var s = String(phone || '').replace(/\s|-/g, '');
    if (s.length < 7) return s || '';
    return s.slice(0, 3) + '****' + s.slice(-4);
}

/**
 * 密码、密钥。短于 8 位整段打码，更长的保留头 4 位和尾 4 位。
 * 调用方只能把返回值写进页面，原始字符串不要进 DOM。
 */
export function maskSecret(value) {
    var s = String(value || '');
    if (!s) return '';
    if (s.length < 8) return '****';
    return s.slice(0, 4) + '****' + s.slice(-4);
}

/** 拨号链接。空号码返回空串，调用方不要渲染成 href=""。 */
export function phoneTelHref(phone) {
    var s = String(phone || '').replace(/[^\d+]/g, '');
    return s ? 'tel:' + s : '';
}
