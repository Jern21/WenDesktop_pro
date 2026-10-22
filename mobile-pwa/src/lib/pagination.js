/**
 * 列表响应归一化
 *
 * 后端有两种形态，移动端必须一层吃掉差异：
 *
 *   ① 分页对象：`{ success:true, data:{ list:[], total, page, pageSize } }`
 *      只有 /api/orders 和 /api/platform-posts 是这样。
 *
 *   ② 裸数组：`{ success:true, data:[...] }`
 *      其余全部（customers / projects / quotes / posters / memos / reminders /
 *      bookmarks / resume / accounts / 以及所有 stats/* 图表接口）。
 *
 * 另外 `resp.success(res, list)` 有时会把数组直接放在 data，
 * 也有旧接口把数组放在顶层 `data.list`，这里都兜住。
 *
 * 纯函数，不碰 DOM —— 可用 `node tools/test-mobile-lib.mjs` 直接单测。
 */

/**
 * @param {*} payload api 返回的完整 JSON
 * @param {number} [fallbackPageSize] 请求时用的 pageSize，用于推算 hasMore
 * @returns {{ list: Array, total: number, page: number, pageSize: number, hasMore: boolean, mode: 'paged'|'array'|'empty' }}
 */
export function normalizeList(payload, fallbackPageSize) {
    var size = parseInt(fallbackPageSize, 10) || 0;
    var data = payload && payload.data !== undefined ? payload.data : payload;

    // 形态 ①：分页对象
    if (data && !Array.isArray(data) && typeof data === 'object' && Array.isArray(data.list)) {
        var total = parseInt(data.total, 10);
        if (isNaN(total)) total = data.list.length;
        var page = parseInt(data.page, 10) || 1;
        var pageSize = parseInt(data.pageSize, 10) || size || data.list.length || 1;
        return {
            list: data.list,
            total: total,
            page: page,
            pageSize: pageSize,
            // 用「已加载数量 vs 总数」判断更可靠：后端 pageSize 可能被它自己改过
            hasMore: page * pageSize < total,
            mode: 'paged'
        };
    }

    // 形态 ②：裸数组（一次拿全，没有更多页）
    if (Array.isArray(data)) {
        return {
            list: data,
            total: data.length,
            page: 1,
            pageSize: data.length || size || 1,
            hasMore: false,
            mode: data.length ? 'array' : 'empty'
        };
    }

    // 兜底：null / 对象里没有 list
    return { list: [], total: 0, page: 1, pageSize: size || 1, hasMore: false, mode: 'empty' };
}

/**
 * 合并新一页到已有列表，按 id 去重。
 * 去重是必须的：分页期间如果有人新增了记录，第二页会把第一页的尾部记录又带回来，
 * 直接 concat 会出现重复卡片，而 key 重复会让列表重绘错乱。
 * @param {Array} prev
 * @param {Array} next
 * @param {(item:*) => string} [keyOf] 默认取 item.id
 */
export function mergeUnique(prev, next, keyOf) {
    var getKey = typeof keyOf === 'function'
        ? keyOf
        : function (item) {
            if (item && item.id !== undefined && item.id !== null) return String(item.id);
            // 没有 id 的（比如 stats 的 {month,revenue}）用内容哈希兜底
            try { return JSON.stringify(item); } catch (e) { return String(item); }
        };

    var seen = Object.create(null);
    var out = [];
    (prev || []).forEach(function (item) {
        var k = getKey(item);
        if (seen[k]) return;
        seen[k] = true;
        out.push(item);
    });
    (next || []).forEach(function (item) {
        var k = getKey(item);
        if (seen[k]) return;
        seen[k] = true;
        out.push(item);
    });
    return out;
}

/** 拼查询串：自动跳过 undefined / null / 空字符串 */
export function toQuery(params) {
    var parts = [];
    Object.keys(params || {}).forEach(function (key) {
        var v = params[key];
        if (v === undefined || v === null || v === '') return;
        if (Array.isArray(v)) {
            if (!v.length) return;
            parts.push(encodeURIComponent(key) + '=' + encodeURIComponent(v.join(',')));
            return;
        }
        parts.push(encodeURIComponent(key) + '=' + encodeURIComponent(v));
    });
    return parts.length ? '?' + parts.join('&') : '';
}
