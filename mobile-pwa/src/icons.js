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
