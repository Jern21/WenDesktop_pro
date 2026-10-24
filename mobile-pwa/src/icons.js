/**
 * 右侧菜单用线条图标（Apple 风格）
 *
 * 约定：24×24 viewBox、fill:none、stroke:currentColor、stroke-width:1.75。
 * 统一风格不是为了好看，是因为 rail 上 12 个图标并排、没有文字，
 * 只要有一个粗细/圆角不一致，视觉上就会「跳出来」。
 *
 * 新增图标前先看这里有没有能复用的 —— 添一个近似的图标，
 * 用户就得在两个长得差不多的符号之间猜，比没有图标更糟。
 */
export var NAV_ICONS = {
    /* ---- 业务 ---- */
    grid:
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" aria-hidden="true">' +
        '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/>' +
        '<rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>',
    receipt:
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" aria-hidden="true">' +
        '<path d="M6 2h12v20l-2-1.5L14 22l-2-1.5L10 22 8 20.5 6 22V2z"/><path d="M9 7h6M9 11h6M9 15h4"/></svg>',
    bell:
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" aria-hidden="true">' +
        '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 7h18s-3 0-3-7"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/></svg>',
    users:
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" aria-hidden="true">' +
        '<circle cx="9" cy="8" r="3.25"/><path d="M2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6"/>' +
        '<path d="M16.2 5.1a3.25 3.25 0 0 1 0 5.8M17.6 14.4c2.3.6 3.9 2.4 3.9 5.1"/></svg>',
    /* Grok 官方标记是实心 fill，与线条图标风格不同 —— 品牌标识，刻意保留 */
    grok:
        '<svg viewBox="0 0 24 24" fill="currentColor" fill-rule="evenodd" aria-hidden="true">' +
        '<path d="M9.27 15.29l7.978-5.897c.391-.29.95-.177 1.137.272.98 2.369.542 5.215-1.41 7.169-1.951 1.954-4.667 2.382-7.149 1.406l-2.711 1.257c3.889 2.661 8.611 2.003 11.562-.953 2.341-2.344 3.066-5.539 2.388-8.42l.006.007c-.983-4.232.242-5.924 2.75-9.383.06-.082.12-.164.179-.248l-3.301 3.305v-.01L9.267 15.292M7.623 16.723c-2.792-2.67-2.31-6.801.071-9.184 1.761-1.763 4.647-2.483 7.166-1.425l2.705-1.25a7.808 7.808 0 00-1.829-1A8.975 8.975 0 005.984 5.83c-2.533 2.536-3.33 6.436-1.962 9.764 1.022 2.487-.653 4.246-2.34 6.022-.599.63-1.199 1.259-1.682 1.925l7.62-6.815"/></svg>',

    /* ---- 数据与内容 ---- */
    chart:
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" aria-hidden="true">' +
        '<path d="M3 20h18"/>' +
        '<rect x="5" y="12" width="3.5" height="8" rx="1"/>' +
        '<rect x="10.25" y="7" width="3.5" height="13" rx="1"/>' +
        '<rect x="15.5" y="10" width="3.5" height="10" rx="1"/></svg>',
    image:
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" aria-hidden="true">' +
        '<rect x="3" y="4.5" width="18" height="15" rx="2.5"/>' +
        '<circle cx="8.5" cy="10" r="1.5"/>' +
        '<path d="M4 17.5l4.5-4.5 3 3 3.2-2.7 4.8 4.2"/></svg>',
    folder:
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" aria-hidden="true">' +
        '<path d="M3.5 7.5a2 2 0 0 1 2-2h3.2l1.8 2h8a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z"/></svg>',
    quote:
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" aria-hidden="true">' +
        '<path d="M6.5 3h7.5l4.5 4.5V21h-12z"/><path d="M14 3v4.5h4.5"/>' +
        '<path d="M9.5 12.5h6M9.5 16.5h4"/></svg>',
    send:
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" aria-hidden="true">' +
        '<path d="M21 3.5L3.2 10.4l6.9 2.6 2.6 6.9z"/><path d="M10.1 13L21 3.5"/></svg>',

    /* ---- 账号与资料 ---- */
    bookmark:
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" aria-hidden="true">' +
        '<path d="M7 3.5h10v17l-5-3.8-5 3.8z"/></svg>',
    key:
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" aria-hidden="true">' +
        '<circle cx="8.5" cy="15.5" r="3.5"/><path d="M11 13L19.5 4.5M16.5 7.5l3 3"/></svg>',
    gear:
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" aria-hidden="true">' +
        '<circle cx="12" cy="12" r="3"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>'
};

/**
 * 工作台面板用图标 —— 与 NAV_ICONS 同一套线条风格。
 * 页面里不用 emoji 当图标：风格不统一、不同系统渲染差异大、暗色下不可控。
 */
export var WB_ICONS = {
    /* 两叠金币（左高右矮），实心 —— hero 金额区与待回款统计共用 */
    coin:
        '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">' +
        '<ellipse cx="8" cy="17.6" rx="5" ry="1.9"/><ellipse cx="8" cy="14.4" rx="5" ry="1.9"/>' +
        '<ellipse cx="8" cy="11.2" rx="5" ry="1.9"/><ellipse cx="8" cy="8" rx="5" ry="1.9"/>' +
        '<ellipse cx="16.6" cy="17.6" rx="4" ry="1.7"/><ellipse cx="16.6" cy="14.6" rx="4" ry="1.7"/>' +
        '<ellipse cx="16.6" cy="11.6" rx="4" ry="1.7"/></svg>',
    briefcase:
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" aria-hidden="true">' +
        '<rect x="3" y="7.5" width="18" height="12.5" rx="2.5"/>' +
        '<path d="M9 7.5V5.8A1.8 1.8 0 0 1 10.8 4h2.4A1.8 1.8 0 0 1 15 5.8v1.7"/>' +
        '<path d="M3.5 12.5h17"/></svg>',
    box:
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" aria-hidden="true">' +
        '<path d="M12 3l7.5 4.2v9.6L12 21l-7.5-4.2V7.2z"/>' +
        '<path d="M12 11.7l7.5-4.2M12 11.7L4.5 7.5M12 11.7V21"/></svg>',
    user:
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" aria-hidden="true">' +
        '<circle cx="12" cy="8" r="3.5"/>' +
        '<path d="M4.5 20c.8-3.6 3.8-5.5 7.5-5.5s6.7 1.9 7.5 5.5"/></svg>',
    star:
        '<svg viewBox="0 0 24 24" aria-hidden="true">' +
        '<path d="M12 2.5l2.9 6 6.6.8-4.9 4.5 1.3 6.5-5.9-3.3-5.9 3.3 1.3-6.5-4.9-4.5 6.6-.8z" fill="#f5b32b"/>' +
        '<path d="M12 5.8l1.8 3.7 4.1.5-3.1 2.8.9 4.1-3.7-2-3.7 2 .9-4.1-3.1-2.8 4.1-.5z" fill="#ffd873"/></svg>',
    trophy:
        '<svg viewBox="0 0 24 24" aria-hidden="true">' +
        '<path d="M6.5 4.5C4 4.5 3 6 3 7.8c0 1.9 1.3 3.4 3.7 3.6A6 6 0 0 1 6.5 9V4.5z" fill="#d8891a"/>' +
        '<path d="M17.5 4.5C20 4.5 21 6 21 7.8c0 1.9-1.3 3.4-3.7 3.6A6 6 0 0 0 17.5 9V4.5z" fill="#d8891a"/>' +
        '<path d="M7.5 3.5h9V9a4.5 4.5 0 0 1-9 0z" fill="#f5b32b"/>' +
        '<rect x="9.5" y="4.8" width="2" height="4" rx="1" fill="#ffd873"/>' +
        '<rect x="11" y="12.5" width="2" height="3.5" fill="#d8891a"/>' +
        '<rect x="7.5" y="16.5" width="9" height="2.6" rx="1.3" fill="#b8791a"/>' +
        '<rect x="5.5" y="19.4" width="13" height="1.8" rx=".9" fill="#8f5f12"/></svg>',
    car:
        '<svg viewBox="0 0 24 24" aria-hidden="true">' +
        '<path d="M6.9 6.9a2.3 2.3 0 0 0-2.2 1.7L3.9 12h16.2l-.8-3.4a2.3 2.3 0 0 0-2.2-1.7z" fill="#4a90e2"/>' +
        '<path d="M9.2 8.2h5.6a1.3 1.3 0 0 1 1.2.9l.6 1.9H7.4l.6-1.9a1.3 1.3 0 0 1 1.2-.9z" fill="#dceaff"/>' +
        '<path d="M4.2 11.8h15.6c1 0 1.8.8 1.8 1.8v3.2a1.6 1.6 0 0 1-1.6 1.6H4a1.6 1.6 0 0 1-1.6-1.6v-3.2c0-1 .8-1.8 1.8-1.8z" fill="#2f7cf6"/>' +
        '<rect x="3.6" y="13" width="2.6" height="1.4" rx=".7" fill="#fff" opacity=".9"/>' +
        '<rect x="17.8" y="13" width="2.6" height="1.4" rx=".7" fill="#ffe08a"/>' +
        '<circle cx="7.6" cy="18.2" r="2" fill="#1d1d1f"/>' +
        '<circle cx="7.6" cy="18.2" r=".9" fill="#9aa5b1"/>' +
        '<circle cx="16.4" cy="18.2" r="2" fill="#1d1d1f"/>' +
        '<circle cx="16.4" cy="18.2" r=".9" fill="#9aa5b1"/></svg>',
    flag:
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" aria-hidden="true">' +
        '<path d="M6 21V4"/><path d="M6 5h10.5L14 8.5l2.5 3.5H6"/></svg>',
    // Grok 官方标记（与桌面端 header.js 的 GROK_PATH 同源，单 path evenodd）
    grok:
        '<svg viewBox="0 0 24 24" fill="currentColor" fill-rule="evenodd" aria-hidden="true">' +
        '<path d="M9.27 15.29l7.978-5.897c.391-.29.95-.177 1.137.272.98 2.369.542 5.215-1.41 7.169-1.951 1.954-4.667 2.382-7.149 1.406l-2.711 1.257c3.889 2.661 8.611 2.003 11.562-.953 2.341-2.344 3.066-5.539 2.388-8.42l.006.007c-.983-4.232.242-5.924 2.75-9.383.06-.082.12-.164.179-.248l-3.301 3.305v-.01L9.267 15.292M7.623 16.723c-2.792-2.67-2.31-6.801.071-9.184 1.761-1.763 4.647-2.483 7.166-1.425l2.705-1.25a7.808 7.808 0 00-1.829-1A8.975 8.975 0 005.984 5.83c-2.533 2.536-3.33 6.436-1.962 9.764 1.022 2.487-.653 4.246-2.34 6.022-.599.63-1.199 1.259-1.682 1.925l7.62-6.815"/></svg>'
};

export var ICON_CARET =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">' +
    '<path d="M6 9l6 6 6-6"/></svg>';

/** 顶栏返回按钮（左向 chevron） */
export var ICON_BACK =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25" ' +
    'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<path d="M14.5 5L8 12l6.5 7"/></svg>';

/** 列表行右侧的「可进入」指示 */
export var ICON_CHEVRON =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
    'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<path d="M9 5l7 7-7 7"/></svg>';
