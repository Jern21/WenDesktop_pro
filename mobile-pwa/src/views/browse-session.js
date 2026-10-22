/**
 * 项目、报价列表的筛选和滚动。进详情再返回时装回来。
 * 这两页只读，没有「改完要刷新卡片」的补丁。
 */
export var projectListSession = {
    filters: { keyword: '', status: '', scope: '' },
    scrollTop: 0
};

export var posterListSession = {
    filters: { keyword: '', platform: '', label: '' },
    scrollTop: 0
};

export var postListSession = {
    filters: { keyword: '', platform: '', status: '' },
    scrollTop: 0,
    snapshot: null
};

export var bookmarkListSession = {
    filters: { keyword: '', category: '' },
    scrollTop: 0,
    snapshot: null
};

export var quoteListSession = {
    filters: { keyword: '', status: '' },
    scrollTop: 0,
    snapshot: null
};
