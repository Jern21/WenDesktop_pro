/**
 * 订单列表的返回现场
 *
 * 列表和详情是两个面板，切过去时列表会被卸掉。
 * 筛选、滚动位置、已加载的那几页如果只放在面板实例里，返回就全丢了。
 * 这里是模块级记忆：同一次打开应用内有效，刷新页面会清空，这是预期的。
 */

export var orderListSession = {
    filters: {
        keyword: '',
        status: '',
        paymentStatus: '',
        overdue: false
    },
    scrollTop: 0,
    snapshot: null,
    patch: null
};

export function rememberOrderPatch(order) {
    if (!order || !order.id) return;
    orderListSession.patch = {
        id: order.id,
        orderStatus: order.orderStatus,
        paymentStatus: order.paymentStatus,
        paymentRatio: order.paymentRatio,
        payDate: order.payDate
    };
}

export function takeOrderPatch() {
    var patch = orderListSession.patch;
    orderListSession.patch = null;
    return patch;
}

export function applyPatchToItems(items, patch) {
    if (!patch || !items) return items || [];
    return items.map(function (item) {
        if (item && item.id === patch.id) return Object.assign({}, item, patch);
        return item;
    });
}
