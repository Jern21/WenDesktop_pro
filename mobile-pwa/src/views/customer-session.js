/**
 * 客户列表的筛选和滚动。进详情再返回时列表已经销毁，靠这里装回来。
 * 记下跟进后清掉快照，避免卡片上的最近跟进还是旧的。
 */
export var customerListSession = {
    filters: {
        keyword: '',
        followStatus: ''
    },
    scrollTop: 0,
    snapshot: null
};

export function invalidateCustomerList() {
    customerListSession.snapshot = null;
}
