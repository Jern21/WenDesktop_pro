/**
 * 后端能力封装（领域层）
 *
 * 页面只调用 `orders.list(...)` 这种语义方法，不直接拼 URL。
 * 好处：接口路径/参数改名时只改这一个文件；也让页面代码看得出「在做什么」而不是「在请求什么」。
 *
 * 写入范围约定（2026-10-22 与文总确认）：
 *   ✅ 只读查询 —— 全部开放
 *   ✅ 状态切换 —— 订单状态/付款状态、待办勾选、备忘置顶
 *   ❌ 新建/编辑完整单据 —— 留给桌面端（移动端表单成本高、误操作代价大）
 *
 * 状态切换之所以安全，是因为后端语义支持：
 *   `PUT /api/orders/:id` 是**白名单 merge**（只传 orderStatus 不会清空其它字段）；
 *   `PUT /api/reminders/:id/toggle`、`PUT /api/memos/:id/pin` 是**服务端自己翻转**，
 *   客户端连当前值都不用传，天然避免了「两端各持一个旧状态互相覆盖」。
 */
import { api } from './client.js';
import { toQuery } from '../lib/pagination.js';

/* ============================================================
 * 鉴权不在这里
 *
 * 登录 / 登出 / 状态查询 / 改密码 全部走 `api/auth.js`（会话层）。
 * 这里刻意不提供同名能力：一个动作只有一个入口，避免「两个地方都能登录」的分叉。
 * ========================================================== */

/* ============================================================
 * 订单（移动端最高频）
 * ========================================================== */

export var orders = {
    /**
     * @param {Object} [params]
     * @param {string} [params.status] pending|processing|acceptance|completed|closed
     * @param {string} [params.paymentStatus] 未付款|部分付款|已结清
     * @param {string} [params.projectType]
     * @param {string} [params.customerSource]
     * @param {string} [params.customerTag]
     * @param {string} [params.keyword]
     * @param {boolean|string} [params.overdue] '1' 只看逾期
     * @param {boolean|string} [params.dueToday]
     * @param {string} [params.dateFrom] YYYY-MM-DD
     * @param {string} [params.dateTo]
     * @param {string} [params.sort] orderDate_desc|orderDate_asc|amount_desc|amount_asc
     * @param {number} [params.page]
     * @param {number} [params.pageSize] 默认后端 50
     * @param {AbortSignal} [options.signal]
     */
    list: function (params, options) {
        return api.get('/api/orders' + toQuery(params), options);
    },

    detail: function (id, options) {
        return api.get('/api/orders/' + encodeURIComponent(id), options);
    },

    /** 统计摘要：总额/成本/利润/时薪/各状态计数/逾期数 */
    summary: function (params, options) {
        return api.get('/api/orders/stats/summary' + toQuery(params), options);
    },

    /**
     * 只改订单状态（白名单 merge，不动其它字段）
     * @param {string} id
     * @param {'pending'|'processing'|'acceptance'|'completed'|'closed'} status
     */
    setStatus: function (id, status) {
        return api.put('/api/orders/' + encodeURIComponent(id), { orderStatus: status });
    },

    /**
     * 只改付款状态
     * @param {string} id
     * @param {'未付款'|'部分付款'|'已结清'} paymentStatus
     * @param {number} [paymentRatio] 部分付款时的比例
     */
    setPaymentStatus: function (id, paymentStatus, paymentRatio) {
        var patch = { paymentStatus: paymentStatus };
        if (paymentStatus === '部分付款' && typeof paymentRatio === 'number') {
            patch.paymentRatio = paymentRatio;
        }
        return api.put('/api/orders/' + encodeURIComponent(id), patch);
    }
};

/* ============================================================
 * 客户
 * ========================================================== */

export var customers = {
    list: function (params, options) {
        return api.get('/api/customers' + toQuery(params), options);
    },

    /** 客户详情（含历史订单、跟进记录） */
    detail: function (id, options) {
        return api.get('/api/customers/' + encodeURIComponent(id) + '/detail', options);
    },

    /** 加一条跟进记录（移动端在客户页做得最自然的一件事） */
    addFollow: function (id, body) {
        return api.post('/api/customers/' + encodeURIComponent(id) + '/follows', body);
    }
};

/* ============================================================
 * 待办提醒
 * ========================================================== */

export var reminders = {
    list: function (params, options) {
        return api.get('/api/reminders' + toQuery(params), options);
    },

    /**
     * 月历数据
     *
     * 返回结构（实测，别猜）：
     *   { year, month, total, days: { '05': [提醒...], '18': [...] } }
     *
     * ⚠️ `days` 是**按日分组的对象**，键是两位日期字符串（'01'~'31'），
     *    不是 31 格数组、也不是「有数据的日子」数组。
     *    渲染月历要自己按当月天数循环，用 `days[dd]` 去取。
     *
     * @param {number} year
     * @param {number} month 1-12（不是 0-11，别传错）
     */
    calendar: function (year, month, options) {
        return api.get('/api/reminders/calendar/' + year + '/' + month, options);
    },

    /** 勾选/取消 —— 服务端翻转，不用传目标值 */
    toggle: function (id) {
        return api.put('/api/reminders/' + encodeURIComponent(id) + '/toggle', {});
    }
};

/* ============================================================
 * 备忘录
 * ========================================================== */

export var memos = {
    list: function (params, options) {
        return api.get('/api/memos' + toQuery(params), options);
    },

    detail: function (id, options) {
        return api.get('/api/memos/' + encodeURIComponent(id), options);
    },

    /** 置顶/取消 —— 服务端翻转 */
    togglePin: function (id) {
        return api.put('/api/memos/' + encodeURIComponent(id) + '/pin', {});
    }
};

/* ============================================================
 * 项目
 * ========================================================== */

export var projects = {
    list: function (params, options) {
        return api.get('/api/projects' + toQuery(params), options);
    },

    /** 看板：5 个状态列的对象。params.scope 可选 enterprise / personal */
    board: function (params, options) {
        return api.get('/api/projects/board' + toQuery(params), options);
    },

    detail: function (id, options) {
        return api.get('/api/projects/' + encodeURIComponent(id), options);
    },

    stats: function (options) {
        return api.get('/api/projects/stats', options);
    }
};

/* ============================================================
 * 报价单
 * ========================================================== */

export var quotes = {
    list: function (params, options) {
        return api.get('/api/quotes' + toQuery(params), options);
    },

    detail: function (id, options) {
        return api.get('/api/quotes/' + encodeURIComponent(id), options);
    }
};

/* ============================================================
 * 素材库 / 发布台账
 * ========================================================== */

export var posters = {
    list: function (params, options) {
        return api.get('/api/posters' + toQuery(params), options);
    },

    labels: function (params, options) {
        return api.get('/api/posters/labels' + toQuery(params), options);
    }
};

export var platformPosts = {
    list: function (params, options) {
        return api.get('/api/platform-posts' + toQuery(params), options);
    },

    overview: function (options) {
        return api.get('/api/platform-posts/stats/overview', options);
    },

    detail: function (id, options) {
        return api.get('/api/platform-posts/' + encodeURIComponent(id), options);
    }
};

/* ============================================================
 * 快捷链接
 * ========================================================== */

export var bookmarks = {
    list: function (params, options) {
        return api.get('/api/bookmarks' + toQuery(params), options);
    },

    categories: function (options) {
        return api.get('/api/bookmarks/categories', options);
    },

    /** 记录一次点击（用于排序/统计），失败不影响跳转 */
    click: function (id) {
        return api.post('/api/bookmarks/' + encodeURIComponent(id) + '/click', {});
    }
};

/* ============================================================
 * 收支账本
 * ========================================================== */

export var ledger = {
    /** 工作台聚合视图（已接入，见 views/panels/workbench.js） */
    workbench: function (params, options) {
        return api.get('/api/ledger/workbench' + toQuery(params), options);
    },

    list: function (params, options) {
        return api.get('/api/ledger' + toQuery(params), options);
    },

    /**
     * 记一笔收支。
     *
     * 这是移动端唯一保留的「新建」类写操作 —— 记账本来就该在路上随手做，
     * 且它是纯追加、不需要表单校验、不改动已有数据，误操作成本最低。
     * 其它新建/编辑仍留给桌面端。
     *
     * @param {{type:'income'|'expense',title:string,amount:number|string,date:string,category?:string}} body
     */
    create: function (body) {
        return api.post('/api/ledger', body);
    },

    remove: function (id) {
        return api.del('/api/ledger/' + encodeURIComponent(id));
    }
};

/* ============================================================
 * 统计（全部只读，返回的数组可直接喂图表）
 * ========================================================== */

export var stats = {
    /** 首页顶部指标（含同比/环比） */
    homeMetrics: function (options) {
        return api.get('/api/stats/home-metrics', options);
    },

    dashboard: function (options) {
        return api.get('/api/stats/dashboard', options);
    },

    /** 待办聚合计数：pendingReply/pendingQuote/expiringSoon/overdueOrders/todayReminders... */
    todos: function (options) {
        return api.get('/api/stats/todos', options);
    },

    /** 未读通知 + 明细卡片 */
    notifications: function (options) {
        return api.get('/api/stats/notifications', options);
    },

    /** @param {{range?:'all'|'month'|'year'}} [params] */
    monthlyOverview: function (params, options) {
        return api.get('/api/stats/monthly-overview' + toQuery(params), options);
    },

    /** 月度收入趋势（图表用） */
    revenue: function (params, options) {
        return api.get('/api/stats/revenue' + toQuery(params), options);
    },

    revenueDaily: function (params, options) {
        return api.get('/api/stats/revenue/daily' + toQuery(params), options);
    },

    platform: function (params, options) {
        return api.get('/api/stats/platform' + toQuery(params), options);
    },

    projectType: function (params, options) {
        return api.get('/api/stats/project-type' + toQuery(params), options);
    },

    ordersMonthly: function (params, options) {
        return api.get('/api/stats/orders-monthly' + toQuery(params), options);
    },

    customerLevel: function (params, options) {
        return api.get('/api/stats/customer-level' + toQuery(params), options);
    },

    /** 转化漏斗：浏览量 → 私信 → 成交 → 客户 */
    funnel: function (params, options) {
        return api.get('/api/stats/funnel' + toQuery(params), options);
    },

    monthlyDetail: function (params, options) {
        return api.get('/api/stats/monthly-detail' + toQuery(params), options);
    }
};

/* ============================================================
 * 设置 / 账号 / 简历（只读为主）
 * ========================================================== */

export var settings = {
    get: function (options) {
        return api.get('/api/settings', options);
    },

    update: function (patch) {
        return api.put('/api/settings', patch);
    },

    backups: function (options) {
        return api.get('/api/settings/backups', options);
    }
};

export var accounts = {
    /**
     * ⚠️ 返回的是**解密后的真实凭据**，移动端只做脱敏只读展示。
     * 千万不要回写（password 带回会覆盖真实值），也不要整条渲染到页面上。
     */
    list: function (params, options) {
        return api.get('/api/accounts' + toQuery(params), options);
    },

    platforms: function (options) {
        return api.get('/api/accounts/platforms', options);
    }
};

export var resume = {
    list: function (options) {
        return api.get('/api/resume', options);
    }
};
