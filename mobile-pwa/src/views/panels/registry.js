/**
 * 面板注册表 —— 页面接入的唯一出口
 *
 * 这里解决的问题：以前 `mobile-shell.js` 的 renderPanel() 是
 *   `if (panel === 'workbench') ... if (panel === 'settings') ...`
 * 的硬编码分支 —— 新增一个页面必须回头改 shell，shell 就成了「所有页面都得碰一下」的公共瓶颈，
 * 而且漏改不报错（静默落到 placeholder），是典型的隐性故障点。
 *
 * 现在规则变成：**新增页面 = 写一个 panel 文件 + 在这里加一行 + nav.js 加一项**，
 * shell 一行都不用动。nav 里的 `panel` 字段就是这张表的 key。
 *
 * 每个 panel 模块必须导出 `mountXxxPanel(container) => { destroy? }`：
 *   - container 是 `.mobile-content`（滚动容器），panel 自己负责渲染；
 *   - 返回值里的 `destroy()` 在切换页面时由 shell 调用，
 *     有定时器/事件监听/长连接的页面**必须**实现它，否则切走再回来会重复绑定。
 *
 * 注册项字段：
 *   mount  {Function} 挂载函数，必填
 *   flush  {Boolean}  是否去掉内容区默认内边距（整屏自绘背景的页面用，如工作台）
 */
import { mountWorkbenchPanel } from './workbench.js';
import { mountSettingsPanel } from './settings.js';
import { mountOrdersPanel } from './orders.js';
import { mountOrderDetailPanel } from './order-detail.js';
import { mountReminderPanel } from './reminder.js';
import { mountCustomersPanel } from './customers.js';
import { mountCustomerDetailPanel } from './customer-detail.js';
import { mountProjectsPanel } from './projects.js';
import { mountProjectDetailPanel } from './project-detail.js';
import { mountQuotesPanel } from './quotes.js';
import { mountQuoteDetailPanel } from './quote-detail.js';
import { mountPostersPanel } from './posters.js';
import { mountPlatformPostsPanel } from './platform-posts.js';
import { mountPlatformPostDetailPanel } from './platform-post-detail.js';
import { mountBookmarksPanel } from './bookmarks.js';
import { mountStatsPanel } from './stats.js';
import { mountAccountsPanel } from './accounts.js';
import { mountGrokPanel } from './grok.js';
import { mountGrokKeysPanel } from './grok-keys.js';

export var PANEL_REGISTRY = {
    workbench: {
        mount: mountWorkbenchPanel,
        flush: true
    },

    settings: {
        mount: mountSettingsPanel
    },

    orders: {
        mount: mountOrdersPanel
    },

    'order-detail': {
        mount: mountOrderDetailPanel
    },

    reminder: {
        mount: mountReminderPanel
    },

    customers: {
        mount: mountCustomersPanel
    },

    'customer-detail': {
        mount: mountCustomerDetailPanel
    },

    projects: {
        mount: mountProjectsPanel
    },

    'project-detail': {
        mount: mountProjectDetailPanel
    },

    quotes: {
        mount: mountQuotesPanel
    },

    'quote-detail': {
        mount: mountQuoteDetailPanel
    },

    posters: {
        mount: mountPostersPanel
    },

    'platform-posts': {
        mount: mountPlatformPostsPanel
    },

    'platform-post-detail': {
        mount: mountPlatformPostDetailPanel
    },

    bookmarks: {
        mount: mountBookmarksPanel
    },

    stats: {
        mount: mountStatsPanel
    },

    accounts: {
        mount: mountAccountsPanel
    },

    grok: {
        mount: mountGrokPanel
    },

    'grok-keys': {
        mount: mountGrokKeysPanel
    },

    // 新增页面模板：
    // orders: {
    //     mount: mountOrdersPanel
    // }
    //
    // 说明：现在是同步 import，页面多了以后可以改成动态 import 做按需加载
    // （首屏体积会明显下降），届时 mount 返回 Promise，shell 里需要加一个 loading 态。
};
