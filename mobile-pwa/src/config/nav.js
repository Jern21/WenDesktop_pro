/**
 * 右侧导航栏页面配置（只管「显示哪几项」，不管路径怎么匹配）
 *
 * 这里每一项都会自动成为一条路由，但**路由匹配不在这里做** ——
 * 详情页（/orders/:id）之类不进导航栏的路径，全部在 config/routes.js 里声明。
 * 想查一条路径对应哪个页面，用 routes.js 的 matchRoute()，别在这里线性搜索。
 *
 * 字段：
 *   path      {String} 路径，也会被 routes.js 注册成静态路由
 *   label     {String} 导航按钮 aria-label + 顶栏标题
 *   subtitle  {String} 顶栏副标题
 *   panel     {String} registry.js 的 key；'placeholder' = 这页还没做
 *   icon      {String} icons.js 里 NAV_ICONS 的 key
 *   group     {String} 分组名，**同组相邻项之间不画分隔线**，换组处画一条。
 *             12 个纯图标并排，没有分隔线就分不清「订单」和「数据看板」的边界。
 *
 * 顺序 = 导航栏从上到下的顺序。
 *
 * 容量：纵向 rail 用 40px 按钮 + 4px 间距 + 分隔线，13 项共约 590px，
 * 在 667px 视口（iPhone SE2/7/8）及以上完整放得下；更矮的屏幕（568px）靠 rail 滚动兜底。
 * **再加就真的放不下了** —— 到那时要么继续压按钮高度（低于 40px 触摸目标就不好按了），
 * 要么重新引入一层收纳。别默默加到 15 项，底部会滚出屏幕外。
 */
export var MOBILE_NAV = [
    /* ---- 业务：每天都要看的 ---- */
    {
        path: '/',
        label: '工作台',
        subtitle: '开发小账',
        panel: 'workbench',
        icon: 'grid',
        group: '业务'
    },
    {
        path: '/grok',
        label: 'GrokBot',
        subtitle: '远程助理',
        panel: 'grok',
        icon: 'grok',
        group: '业务'
    },
    {
        path: '/orders',
        label: '订单',
        subtitle: '订单管理',
        panel: 'orders',
        icon: 'receipt',
        group: '业务'
    },
    {
        path: '/reminder',
        label: '待办',
        subtitle: '提醒与待办',
        panel: 'reminder',
        icon: 'bell',
        group: '业务'
    },
    {
        path: '/customers',
        label: '客户',
        subtitle: '客户与跟进',
        panel: 'customers',
        icon: 'users',
        group: '业务'
    },

    /* ---- 数据与内容：偶尔查的 ---- */
    {
        path: '/stats',
        label: '数据看板',
        subtitle: '收入与结构',
        panel: 'stats',
        icon: 'chart',
        group: '数据与内容'
    },
    {
        path: '/posters',
        label: '素材库',
        subtitle: '海报与图片',
        panel: 'posters',
        icon: 'image',
        group: '数据与内容'
    },
    {
        path: '/projects',
        label: '项目',
        subtitle: '项目进度',
        panel: 'projects',
        icon: 'folder',
        group: '数据与内容'
    },
    {
        path: '/quotes',
        label: '报价单',
        subtitle: '报价记录',
        panel: 'quotes',
        icon: 'quote',
        group: '数据与内容'
    },
    {
        path: '/platform-posts',
        label: '发帖记录',
        subtitle: '各平台发布',
        panel: 'platform-posts',
        icon: 'send',
        group: '数据与内容'
    },

    /* ---- 账号与资料 ---- */
    {
        path: '/bookmarks',
        label: '链接收藏',
        subtitle: '常用链接',
        panel: 'bookmarks',
        icon: 'bookmark',
        group: '账号与资料'
    },
    {
        path: '/accounts',
        label: '账号密码',
        subtitle: '登录凭据',
        panel: 'accounts',
        icon: 'key',
        group: '账号与资料'
    },
    {
        path: '/settings',
        label: '设置',
        subtitle: '账号与系统',
        panel: 'settings',
        icon: 'gear',
        group: '账号与资料'
    }
];
