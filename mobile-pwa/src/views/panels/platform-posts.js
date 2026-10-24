/**
 * 发帖记录。列表是分页对象，筛选交给后端。左滑可编辑/删除（swipe-crud 共享接线）。
 */
import '../../styles/browse.css';
import { platformPosts } from '../../api/resources.js';
import { createListView } from '../../components/list-view.js';
import { escapeHtml, formatDate, platformLabel, postStatusLabel } from '../../lib/format.js';
import { assetSrc, wireImageFallback } from '../../lib/urls.js';
import { navigate } from '../../router.js';
import { postListSession } from '../browse-session.js';
import { swipeRowHtml, attachSwipeCrud } from '../../components/swipe-crud.js';

var PLATFORMS = [
    { value: '', label: '全部' },
    { value: 'xianyu', label: '闲鱼' },
    { value: 'xiaohongshu', label: '小红书' },
    { value: 'douyin', label: '抖音' },
    { value: 'wechat', label: '微信' }
];

var STATUSES = [
    { value: '', label: '全部状态' },
    { value: 'published', label: '已发布' },
    { value: 'pending', label: '待发布' },
    { value: 'draft', label: '草稿' },
    { value: 'offline', label: '已下线' }
];

/** 编辑表单字段（swipe-crud → form-sheet 共用引擎） */
var POST_FIELDS = [
    { key: 'title', label: '标题', full: true },
    { key: 'platform', label: '平台', type: 'select',
      options: PLATFORMS.filter(function (p) { return p.value; }) },
    { key: 'status', label: '状态', type: 'select',
      options: STATUSES.filter(function (s) { return s.value; }) },
    { key: 'publishTime', label: '发布时间', type: 'date' },
    { key: 'videoUrl', label: '视频链接' }
];

export function renderPostCard(post) {
    var src = assetSrc(post.images && post.images[0]);
    var when = formatDate(post.publishTime, 'month-day') || '';
    var views = post.stats && post.stats.views;
    return '<article class="br-card">' +
        (src ? '<img class="br-thumb" data-asset alt="" src="' + escapeHtml(src) + '" />' : '') +
        '<strong>' + escapeHtml(post.title || '未命名发帖') + '</strong>' +
        '<div class="br-card-line">' +
        '<span class="br-badge">' + escapeHtml(platformLabel(post.platform)) + '</span>' +
        '<span class="br-badge">' + escapeHtml(postStatusLabel(post.status)) + '</span>' +
        '</div>' +
        '<p class="br-meta">' + escapeHtml([when, views !== undefined && views !== null ? views + ' 浏览' : ''].filter(Boolean).join(' · ')) + '</p>' +
        '</article>';
}

export function mountPlatformPostsPanel(container) {
    var filters = postListSession.filters;
    var snapshot = postListSession.snapshot;

    container.innerHTML =
        '<div class="br-page">' +
        '  <div class="br-tools">' +
        '    <input class="br-search" type="search" enterkeyhint="search" placeholder="搜标题、正文" aria-label="搜索发帖" />' +
        '    <div class="br-chips br-platforms"></div>' +
        '    <div class="br-chips br-statuses"></div>' +
        '    <p class="br-count"></p>' +
        '  </div>' +
        '  <div class="br-list"></div>' +
        '</div>';

    var scroller = container.closest('.mobile-content') || container;
    var search = container.querySelector('.br-search');
    var platforms = container.querySelector('.br-platforms');
    var statuses = container.querySelector('.br-statuses');
    var countEl = container.querySelector('.br-count');
    var listHost = container.querySelector('.br-list');
    search.value = filters.keyword || '';
    wireImageFallback(listHost);

    function chips(host, list, current, attr) {
        host.innerHTML = list.map(function (chip) {
            var on = chip.value === current ? ' is-active' : '';
            return '<button type="button" class="br-chip' + on + '" data-' + attr + '="' +
                escapeHtml(chip.value) + '">' + escapeHtml(chip.label) + '</button>';
        }).join('');
    }
    chips(platforms, PLATFORMS, filters.platform, 'platform');
    chips(statuses, STATUSES, filters.status, 'status');

    var keywordTimer = null;
    var restoreY = postListSession.scrollTop || 0;

    function paintCount() {
        if (!lv) return;
        var st = lv.getState();
        countEl.textContent = st.loading ? '' : ('共 ' + st.total + ' 条');
    }

    var lv = createListView({
        container: listHost,
        pageSize: 15,
        autoLoad: !(snapshot && snapshot.ready && snapshot.items && snapshot.items.length),
        seed: snapshot && snapshot.ready ? snapshot : null,
        emptyText: '没有符合条件的发帖',
        emptyHint: '换个平台或状态下拉刷新',
        fetchPage: function (ctx) {
            var params = { page: ctx.page, pageSize: ctx.pageSize };
            if (filters.keyword) params.keyword = filters.keyword;
            if (filters.platform) params.platform = filters.platform;
            if (filters.status) params.status = filters.status;
            return platformPosts.list(params, { signal: ctx.signal });
        },
        renderItem: function (item) { return swipeRowHtml(renderPostCard(item)); },
        onItemClick: function (item) {
            if (!item || !item.id) return;
            postListSession.scrollTop = scroller.scrollTop;
            navigate('/platform-posts/' + encodeURIComponent(item.id));
        },
        onLoaded: function () {
            paintCount();
            if (restoreY) {
                var y = restoreY;
                restoreY = 0;
                requestAnimationFrame(function () { scroller.scrollTop = y; });
            }
        }
    });

    var alive = true;
    var swipe = attachSwipeCrud(listHost, {
        itemOf: function (row) {
            var idx = parseInt(row.parentNode.getAttribute('data-index'), 10);
            return isNaN(idx) ? null : lv.getItems()[idx];
        },
        title: '编辑发帖',
        labelOf: function (p) { return p.title || '这条发帖'; },
        fields: POST_FIELDS,
        update: function (id, patch) { return platformPosts.update(id, patch); },
        remove: function (id) { return platformPosts.remove(id); },
        updated: function (saved) { lv.updateItem(saved); },
        removed: function (id) { lv.removeItemById(id); },
        alive: function () { return alive; }
    });

    function reloadFromFilters() {
        postListSession.snapshot = null;
        postListSession.scrollTop = 0;
        restoreY = 0;
        scroller.scrollTop = 0;
        chips(platforms, PLATFORMS, filters.platform, 'platform');
        chips(statuses, STATUSES, filters.status, 'status');
        lv.reload().then(paintCount);
    }

    function onClick(e) {
        var platformBtn = e.target.closest && e.target.closest('[data-platform]');
        if (platformBtn && platforms.contains(platformBtn)) {
            filters.platform = platformBtn.getAttribute('data-platform') || '';
            reloadFromFilters();
            return;
        }
        var statusBtn = e.target.closest && e.target.closest('[data-status]');
        if (statusBtn && statuses.contains(statusBtn)) {
            filters.status = statusBtn.getAttribute('data-status') || '';
            reloadFromFilters();
        }
    }

    search.addEventListener('input', function () {
        filters.keyword = search.value.trim();
        clearTimeout(keywordTimer);
        keywordTimer = setTimeout(reloadFromFilters, 300);
    });
    container.addEventListener('click', onClick);

    return {
        destroy: function () {
            alive = false;
            swipe.destroy();
            clearTimeout(keywordTimer);
            container.removeEventListener('click', onClick);
            if (lv) {
                var snap = lv.getSnapshot();
                if (snap.ready) postListSession.snapshot = snap;
                postListSession.scrollTop = scroller.scrollTop;
                lv.destroy();
            }
        }
    };
}
