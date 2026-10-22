/**
 * 右侧菜单栏页面配置（path 与 History 路由一致）
 */
export var MOBILE_NAV = [
    {
        path: '/',
        label: '工作台',
        subtitle: '开发小账',
        panel: 'workbench',
        icon: 'grid'
    },
    {
        path: '/orders',
        label: '订单',
        subtitle: '订单管理',
        panel: 'placeholder',
        placeholderTitle: '订单',
        placeholderHint: '完整订单能力将在此接入，与桌面端数据同步。',
        icon: 'receipt'
    },
    {
        path: '/reminder',
        label: '待办',
        subtitle: '提醒与待办',
        panel: 'placeholder',
        placeholderTitle: '待办提醒',
        placeholderHint: '待办列表与到期提醒将在此展示。',
        icon: 'bell'
    },
    {
        path: '/settings',
        label: '设置',
        subtitle: '账号与系统',
        panel: 'settings',
        icon: 'gear'
    }
];

export function findNavByPath(path) {
    var p = path === '/home' ? '/' : path;
    for (var i = 0; i < MOBILE_NAV.length; i++) {
        if (MOBILE_NAV[i].path === p) return MOBILE_NAV[i];
    }
    if (p === '/' || !p) return MOBILE_NAV[0];
    return {
        path: p,
        label: '开发中',
        subtitle: p,
        panel: 'placeholder',
        placeholderTitle: '页面开发中',
        placeholderHint: '路径「' + p + '」尚未接入移动端，请稍后再试。',
        icon: 'grid'
    };
}
