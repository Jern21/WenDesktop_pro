/**
 * 订单载荷构建器（创建 / 更新共用同一份白名单 + 归一化 + 校验）
 *
 * 为什么需要这一层
 * ----------------
 * 之前 POST 有一整套校验，PUT 只有一句 `Object.assign({}, body)` 直接当 patch 用：
 *
 *   1) 请求体里带什么就写什么，包括 id / createdAt / orderNo 这些服务端字段。
 *      Storage.update() 内部是 `Object.assign({}, old, patch)`，
 *      所以一条 `{"id": "别的id"}` 就能把记录改成另一个 id：
 *        - 原 id 从此查不到（前端表现为"订单凭空消失"）；
 *        - 新 id 若已存在，文件里就出现两条同 id 记录（后续 findById 只认第一条）。
 *   2) PUT 完全没有业务校验，可以把成交金额改成 0、把客户昵称清空、把状态改成
 *      一个前端字典里不存在的值（统计页的 statusCounts 会直接漏掉它）。
 *
 * 于是把两条路收敛到同一个函数里：创建与更新用同一份字段白名单、同一份类型归一化、
 * 同一份必填校验，两者的差异只剩下「更新是部分更新」这一点。
 *
 * 约定
 * ----
 *   - 只有 EDITABLE_FIELDS 中的字段会被写进数据文件，其余（含 PROTECTED_FIELDS）
 *     一律丢弃，并通过 `ignored` 回报给调用方，方便打日志排查前端发错字段。
 *   - 更新时必填校验只针对**本次请求真正提供了的字段**：
 *       不能把必填项改成空/0（这是要修的问题），
 *       但历史脏数据里的空值不阻塞其他字段的正常编辑（否则订单会彻底不可编辑）。
 */

'use strict';

var orderRules = require('./order-rules');

/** 允许客户端写入的字段白名单 */
var EDITABLE_FIELDS = [
    // 客户信息
    'customerId', 'customerNick', 'customerName', 'customerPhone', 'customerSource', 'customerTags',
    // 项目信息
    'projectType', 'projectName', 'projectDesc',
    // 商务信息
    'amount', 'cost', 'hours',
    // 时间节点
    'orderDate', 'confirmDate', 'draftDate', 'finalDate',
    // 状态与付款
    'orderStatus', 'paymentStatus', 'paymentRatio', 'payDate', 'paymentRecords',
    // 附件与关联
    'gitUrl', 'quoteRef', 'uploadedFiles'
];

/**
 * 永远不接受客户端传入的字段：由服务端维护。
 * 放进请求体里会被静默丢弃（并在 ignored 里回报），不进 patch。
 */
var PROTECTED_FIELDS = ['id', 'createdAt', 'updatedAt', 'orderNo'];

/** 与前端 order-form.js 的 ORDER_STATUSES 保持一致 */
var ORDER_STATUSES = ['pending', 'processing', 'acceptance', 'completed', 'closed'];

/** 与前端 order-form.js 的 PAYMENT_STATUSES 保持一致 */
var PAYMENT_STATUSES = ['未付款', '部分付款', '已结清'];

var FIELD_DEFAULTS = {
    customerId: '',
    customerNick: '',
    customerName: '',
    customerPhone: '',
    customerSource: '其他',
    customerTags: [],
    projectType: '',
    projectName: '',
    projectDesc: '',
    amount: 0,
    cost: 0,
    hours: 0,
    orderDate: '',
    confirmDate: '',
    draftDate: '',
    finalDate: '',
    orderStatus: 'pending',
    paymentStatus: '未付款',
    paymentRatio: 0,
    payDate: '',
    paymentRecords: [],
    gitUrl: '',
    quoteRef: '',
    uploadedFiles: {}
};

/**
 * 载荷校验失败（应转成 400，而不是 500）
 */
class OrderPayloadError extends Error {
    constructor(message, field) {
        super(message);
        this.name = 'OrderPayloadError';
        this.field = field || null;
        this.status = 400;
    }
}

// ========== 基础归一化 ==========

function toText(value) {
    if (value === undefined || value === null) return '';
    return String(value).trim();
}

function toNumber(value) {
    var num = parseFloat(value);
    return isNaN(num) ? 0 : num;
}

function clampPercent(value) {
    var num = parseInt(value, 10);
    if (isNaN(num)) return 0;
    return Math.min(Math.max(num, 0), 100);
}

/** 标签：去空白、去重、保持原顺序 */
function normalizeTagList(value) {
    if (!Array.isArray(value)) return [];
    var seen = {};
    var result = [];
    value.forEach(function (item) {
        var text = toText(item);
        if (!text || seen[text]) return;
        seen[text] = true;
        result.push(text);
    });
    return result;
}

// ========== 附件归一化 ==========

function normalizeFile(file) {
    if (!file || typeof file !== 'object') return null;
    var name = file.name || file.originalName || file.filename || '';
    var type = file.type || file.mimetype || '';
    var record = {
        name: name,
        originalName: file.originalName || name,
        filename: file.filename || '',
        size: Number(file.size) || 0,
        type: type,
        mimetype: file.mimetype || type,
        url: file.url || ''
    };
    return (record.url || record.name || record.filename) ? record : null;
}

function normalizeUploadedFiles(files) {
    files = files || {};
    var result = {};
    ['screenshot', 'showcase', 'quote', 'taskBook'].forEach(function (key) {
        result[key] = normalizeFile(files[key]) || null;
    });

    var paymentFiles = files.paymentRecord;
    if (Array.isArray(paymentFiles)) {
        result.paymentRecord = paymentFiles.map(normalizeFile).filter(Boolean).slice(0, 10);
    } else {
        var single = normalizeFile(paymentFiles);
        result.paymentRecord = single ? [single] : [];
    }

    return result;
}

// ========== 付款字段推导 ==========

/**
 * 付款相关字段由后端按「成交额 + 打款记录 + 付款状态」统一推导。
 * 前端传来的 paymentRatio 只在没有打款记录时作为兜底。
 */
function normalizePaymentFields(body) {
    body = body || {};
    var amount = toNumber(body.amount);
    var paymentStatus = toText(body.paymentStatus) || '未付款';
    var paymentRecords = paymentStatus === '未付款'
        ? []
        : orderRules.normalizePaymentRecords(body.paymentRecords);
    var paidByRecords = paymentRecords.reduce(function (sum, item) {
        return sum + toNumber(item.amount);
    }, 0);
    var paymentRatio = clampPercent(body.paymentRatio);

    if (paymentStatus === '未付款') {
        paymentRatio = 0;
    } else if (paidByRecords > 0 && amount > 0) {
        paymentRatio = Math.min(Math.round(paidByRecords / amount * 100), 100);
    } else if (paymentStatus === '已结清') {
        paymentRatio = 100;
    }

    return {
        paymentStatus: paymentStatus,
        paymentRatio: paymentRatio,
        payDate: toText(body.payDate),
        paymentRecords: paymentRecords
    };
}

// ========== 字段归一化 ==========

function normalizeField(field, value) {
    switch (field) {
        case 'amount':
        case 'cost':
        case 'hours':
            return toNumber(value);
        case 'paymentRatio':
            return clampPercent(value);
        case 'customerTags':
            return normalizeTagList(value);
        case 'paymentRecords':
            return orderRules.normalizePaymentRecords(value);
        case 'uploadedFiles':
            return normalizeUploadedFiles(value);
        default:
            return toText(value);
    }
}

/** 取默认值的**副本**：数组/对象必须是新实例，避免多条记录共享同一份默认值 */
function defaultValue(field) {
    var def = FIELD_DEFAULTS[field];
    if (Array.isArray(def)) return [];
    if (def && typeof def === 'object') return normalizeUploadedFiles({});
    return def;
}

/**
 * 从请求体里挑出白名单内的字段并归一化。
 *
 * @param {Object} body
 * @param {boolean} withDefaults - true：白名单内没提供的字段补默认值（创建用）；
 *                                 false：只保留请求体里真正出现的字段（更新用）
 * @returns {{fields: Object, ignored: Array<string>}}
 */
function pickEditableFields(body, withDefaults) {
    body = (body && typeof body === 'object') ? body : {};
    var fields = {};
    var ignored = [];

    Object.keys(body).forEach(function (key) {
        if (EDITABLE_FIELDS.indexOf(key) === -1) ignored.push(key);
    });

    EDITABLE_FIELDS.forEach(function (field) {
        var has = Object.prototype.hasOwnProperty.call(body, field);
        if (!has && !withDefaults) return;
        fields[field] = has ? normalizeField(field, body[field]) : defaultValue(field);
    });

    return { fields: fields, ignored: ignored };
}

// ========== 校验 ==========

/** 枚举取值校验：只校验本次真正提供了的字段（默认值本身一定是合法的） */
function validateEnums(fields) {
    if (Object.prototype.hasOwnProperty.call(fields, 'orderStatus')) {
        if (ORDER_STATUSES.indexOf(fields.orderStatus) === -1) {
            throw new OrderPayloadError(
                '订单状态取值非法：' + fields.orderStatus + '（可选：' + ORDER_STATUSES.join(' / ') + '）',
                'orderStatus'
            );
        }
    }
    if (Object.prototype.hasOwnProperty.call(fields, 'paymentStatus')) {
        if (PAYMENT_STATUSES.indexOf(fields.paymentStatus) === -1) {
            throw new OrderPayloadError(
                '付款状态取值非法：' + fields.paymentStatus + '（可选：' + PAYMENT_STATUSES.join(' / ') + '）',
                'paymentStatus'
            );
        }
    }
}

/**
 * 必填校验。
 *
 * @param {Object} fields
 * @param {{onlyTouched?: boolean}} [options]
 *        onlyTouched=true 时只校验 fields 里出现的字段（更新场景）。
 */
function validateRequired(fields, options) {
    var onlyTouched = !!(options && options.onlyTouched);

    function check(field, message, ok) {
        if (onlyTouched && !Object.prototype.hasOwnProperty.call(fields, field)) return;
        if (!ok(fields[field])) throw new OrderPayloadError(message, field);
    }

    check('customerNick', '客户昵称为必填项', function (v) { return !!toText(v); });
    check('projectType', '项目类型为必填项', function (v) { return !!toText(v); });
    check('projectName', '项目名称为必填项', function (v) { return !!toText(v); });
    check('amount', '成交金额必须大于 0', function (v) { return toNumber(v) > 0; });
    check('orderDate', '接单日期为必填项', function (v) { return !!toText(v); });
}

// ========== 对外入口 ==========

/**
 * 构建新建订单的完整载荷。
 * @param {Object} body
 * @returns {{payload: Object, ignored: Array<string>}}
 * @throws {OrderPayloadError}
 */
function buildCreatePayload(body) {
    var picked = pickEditableFields(body, true);

    validateEnums(picked.fields);
    validateRequired(picked.fields);

    var payload = Object.assign({}, picked.fields);
    // 付款口径统一由后端推导，不信任客户端算好的比例
    Object.assign(payload, normalizePaymentFields(payload));

    return { payload: payload, ignored: picked.ignored };
}

/**
 * 构建更新订单的 patch（部分更新）。
 *
 * @param {Object} body      - 请求体
 * @param {Object} existing  - 库里的原记录
 * @returns {{patch: Object, ignored: Array<string>}}
 * @throws {OrderPayloadError}
 */
function buildUpdatePayload(body, existing) {
    var picked = pickEditableFields(body, false);

    validateEnums(picked.fields);
    // 只校验本次提供的字段：不能把必填项改成空，但历史脏数据不阻塞其他字段编辑
    validateRequired(picked.fields, { onlyTouched: true });

    var patch = Object.assign({}, picked.fields);
    var merged = Object.assign({}, existing || {}, patch);
    Object.assign(patch, normalizePaymentFields(merged));

    return { patch: patch, ignored: picked.ignored };
}

module.exports = {
    EDITABLE_FIELDS: EDITABLE_FIELDS,
    PROTECTED_FIELDS: PROTECTED_FIELDS,
    ORDER_STATUSES: ORDER_STATUSES,
    PAYMENT_STATUSES: PAYMENT_STATUSES,
    OrderPayloadError: OrderPayloadError,
    buildCreatePayload: buildCreatePayload,
    buildUpdatePayload: buildUpdatePayload,
    normalizePaymentFields: normalizePaymentFields,
    normalizeUploadedFiles: normalizeUploadedFiles
};
