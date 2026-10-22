/**
 * 路由表 —— 「路径 → 页面」的唯一映射
 *
 * 为什么不把详情页塞进 nav.js：
 *   nav.js 回答的是「右侧导航栏显示哪几项」，这是**展示**问题；
 *   `/orders/:id` 这类详情页必须能按路径寻址，但**绝不能出现在导航栏里**，
 *   这是**寻址**问题。两件事混在同一个数组里，rail 迟早会把详情页也渲染成一个按钮。
 *   所以：nav.js 只管展示，routes.js 只管寻址，routes.js 单向依赖 nav.js。
 *
 * 匹配优先级（从高到低）：
 *   1. 静态路径完全相等        /orders
 *   2. 带参数的模式匹配        /orders/:id   → params.id
 *   3. 兜底                   未登记路径 → 占位页（不是 404、不是白屏）
 *
 * 静态优先是必须的：如果先跑模式匹配，`/orders/new` 会被 `/orders/:id` 抢走，
 * 于是「新建订单」页永远进不去（id === 'new'）。这个坑现在没有，但加 `/orders/new`
 * 的那一天一定会踩，所以顺序写死在实现里，不靠配置顺序。
 */
import { MOBILE_NAV } from './nav.js';
import { normalizePath as basePath, pathSegments, safeDecode } from '../lib/path.js';

var DEFAULT_SUBPAGE_HINT = '该页面尚未接入移动端，桌面端功能不受影响。';

/**
 * 子页面（不进导航栏）
 *
 * 这里只放**不该出现在 rail 上**的路径 —— 也就是详情页。
 * 其余页面（数据看板、素材库、项目…）全部升成一级导航项，住在 nav.js 里。
 * 判据很简单：**能凭空点进去的，是一级页；必须先有上一条记录才能进的，是子页面。**
 * 「数据看板」不需要先选一个订单，所以它不是子页面；`/orders/:id` 没有 id 就打不开，所以是。
 *
 * 字段：
 *   path   {String} 路径模式，可用 `:name` 占位
 *   panel  {String} registry.js 里的 key；'placeholder' 表示还没做，走占位页
 *   label  {String} 顶栏标题
 *   parent {String} 返回按钮的目标路径，同时也决定 rail 高亮哪一项
 *
 * 已经做好真实页面的，把 panel 改成正式 key 即可，路径不用动。
 */
export var SUBPAGE_ROUTES = [
    {
        path: '/orders/:id',
        panel: 'order-detail',
        label: '订单详情',
        parent: '/orders'
    },
    {
        path: '/customers/:id',
        panel: 'customer-detail',
        label: '客户详情',
        parent: '/customers'
    },
    {
        path: '/projects/:id',
        panel: 'project-detail',
        label: '项目详情',
        parent: '/projects'
    },
    {
        path: '/quotes/:id',
        panel: 'quote-detail',
        label: '报价详情',
        parent: '/quotes'
    },
    {
        path: '/platform-posts/:id',
        panel: 'platform-post-detail',
        label: '发帖详情',
        parent: '/platform-posts'
    }
];

/* ============================================================
 * 内部工具
 * ========================================================== */

function normalizePath(pathname) {
    // 先切掉 ?query：路由匹配只认路径，query 由页面自己按需读
    var p = basePath(String(pathname || '').split('?')[0]);
    // /home 是早期别名，统一折叠到 /
    return p === '/home' ? '/' : p;
}

/**
 * 用一条模式去匹配实际路径。
 * 返回 params 对象（可能是空对象），不匹配返回 null。
 * 返回空对象表示「匹配上了但没参数」，和 null（没匹配上）必须区分开。
 */
function matchPattern(pattern, path) {
    if (pattern === path) return {};
    if (pattern.indexOf(':') === -1) return null;

    var patSegs = pathSegments(pattern);
    var pathSegs = pathSegments(path);
    if (patSegs.length !== pathSegs.length) return null;

    var params = {};
    for (var i = 0; i < patSegs.length; i++) {
        var seg = patSegs[i];
        if (seg.charAt(0) === ':') {
            if (!pathSegs[i]) return null;
            params[seg.slice(1)] = safeDecode(pathSegs[i]);
        } else if (seg !== pathSegs[i]) {
            return null;
        }
    }
    return params;
}

function toRoute(def, isNav) {
    return {
        pattern: def.path,
        panel: def.panel || 'placeholder',
        label: def.label || '',
        subtitle: def.subtitle || '',
        parent: isNav ? null : (def.parent || null),
        icon: def.icon || null,
        placeholderTitle: def.placeholderTitle || def.label || '',
        placeholderHint: def.hint || def.placeholderHint || (isNav ? '' : DEFAULT_SUBPAGE_HINT),
        isNav: !!isNav
    };
}

/* ============================================================
 * 路由表
 * ========================================================== */

var NAV_ROUTES = [];
var SUBPAGE_DEFS = [];

MOBILE_NAV.forEach(function (item) {
    NAV_ROUTES.push(toRoute(item, true));
});

SUBPAGE_ROUTES.forEach(function (item) {
    SUBPAGE_DEFS.push(toRoute(item, false));
});

export var ROUTES = NAV_ROUTES.concat(SUBPAGE_DEFS);

/**
 * 按优先级拆两遍跑：先静态、再参数模式。
 * 不要合并成一个循环 —— 顺序就成了「谁写在配置前面谁优先」，那是隐形的。
 */
function findRoute(path) {
    var i;
    for (i = 0; i < ROUTES.length; i++) {
        if (ROUTES[i].pattern === path) return { route: ROUTES[i], params: {} };
    }
    for (i = 0; i < ROUTES.length; i++) {
        if (ROUTES[i].pattern.indexOf(':') === -1) continue;
        var params = matchPattern(ROUTES[i].pattern, path);
        if (params) return { route: ROUTES[i], params: params };
    }
    return null;
}

/**
 * 匹配路径，永远返回一个可用的路由对象（匹配不上给占位路由）。
 *
 * 返回字段：
 *   path      {String}  实际路径（已归一化，去尾斜杠、/home → /）
 *   pattern   {String}  命中的模式，没命中时等于 path
 *   params    {Object}  路径参数，静态路由是 {}
 *   matched   {Boolean} 是否命中已登记的路由
 *   isSubpage {Boolean} 是否子页面（决定顶栏是否显示返回按钮）
 *   panel/label/subtitle/parent/placeholderTitle/placeholderHint
 */
export function matchRoute(pathname) {
    var path = normalizePath(pathname);
    var hit = findRoute(path);

    if (!hit) {
        return {
            path: path,
            pattern: path,
            params: {},
            matched: false,
            isSubpage: false,
            isNav: false,
            panel: 'placeholder',
            label: '页面开发中',
            subtitle: '',
            parent: null,
            placeholderTitle: '页面开发中',
            placeholderHint: '路径「' + path + '」尚未接入移动端。'
        };
    }

    var route = hit.route;
    return {
        path: path,
        pattern: route.pattern,
        params: hit.params,
        matched: true,
        isSubpage: !!route.parent,
        isNav: route.isNav,
        panel: route.panel,
        label: route.label,
        subtitle: route.subtitle,
        parent: route.parent,
        icon: route.icon,
        placeholderTitle: route.placeholderTitle,
        placeholderHint: route.placeholderHint
    };
}

/**
 * 这条路由应该高亮导航栏的哪一项。
 * 详情页没有自己的按钮，高亮它的父级 —— 否则进详情后 rail 全灭，
 * 用户会以为「导航栏坏了」。
 */
export function railPathOf(route) {
    if (!route) return '/';
    return route.parent || route.path || '/';
}
