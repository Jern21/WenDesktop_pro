/**
 * 链接收藏。点开前记下一次点击，只打开 http/https。
 * 左滑可编辑/删除（swipe-crud 共享接线）；不在这里新建。
 */
import '../../styles/browse.css';
import { bookmarks } from '../../api/resources.js';
import { createListView } from '../../components/list-view.js';
import { escapeHtml } from '../../lib/format.js';
import { safeHttpUrl } from '../../lib/urls.js';
import { toast } from '../../lib/toast.js';
import { bookmarkListSession } from '../browse-session.js';
import { swipeRowHtml, attachSwipeCrud } from '../../components/swipe-crud.js';

var CATEGORY_FALLBACK = [
    { id: 'docs', name: '技术文档' },
    { id: 'tools', name: '开发工具' },
    { id: 'learning', name: '学习资源' },
    { id: 'design', name: '设计资源' },
    { id: 'community', name: '技术社区' },
    { id: 'other', name: '其他' }
];

export function mountBookmarksPanel(container) {
    var filters = bookmarkListSession.filters;
    var snapshot = bookmarkListSession.snapshot;
    var names = {};
    CATEGORY_FALLBACK.forEach(function (item) { names[item.id] = item.name; });

    container.innerHTML =
        '<div class="br-page">' +
        '  <div class="br-tools">' +
        '    <input class="br-search" type="search" enterkeyhint="search" placeholder="搜标题、网址" aria-label="搜索收藏" />' +
        '    <div class="br-chips"></div>' +
        '    <p class="br-count"></p>' +
        '  </div>' +
        '  <div class="br-list"></div>' +
        '</div>';

    var scroller = container.closest('.mobile-content') || container;
    var search = container.querySelector('.br-search');
    var chips = container.querySelector('.br-chips');
    var countEl = container.querySelector('.br-count');
    var listHost = container.querySelector('.br-list');
    search.value = filters.keyword || '';

    function paintChips(list) {
        var all = [{ id: '', name: '全部' }].concat(list || CATEGORY_FALLBACK);
        chips.innerHTML = all.map(function (item) {
            var on = item.id === filters.category ? ' is-active' : '';
            return '<button type="button" class="br-chip' + on + '" data-cat="' +
                escapeHtml(item.id) + '">' + escapeHtml(item.name) + '</button>';
        }).join('');
    }
    paintChips(CATEGORY_FALLBACK);

    bookmarks.categories().then(function (res) {
        var list = res && res.data;
        if (!Array.isArray(list) || !list.length) return;
        list.forEach(function (item) { if (item && item.id) names[item.id] = item.name || item.id; });
        paintChips(list);
    }).catch(function () {});

    var keywordTimer = null;
    var restoreY = bookmarkListSession.scrollTop || 0;

    function paintCount() {
        if (!lv) return;
        var st = lv.getState();
        countEl.textContent = st.loading ? '' : ('共 ' + st.total + ' 条');
    }

    function renderItem(item) {
        var href = safeHttpUrl(item.url);
        return swipeRowHtml('<article class="br-card" data-id="' + escapeHtml(item.id) + '" data-href="' + escapeHtml(href) + '">' +
            '<strong>' + escapeHtml(item.title || '未命名链接') + '</strong>' +
            '<p class="br-meta">' + escapeHtml(names[item.category] || item.category || '其他') +
            ' · ' + (item.clickCount || 0) + ' 次</p>' +
            '<p class="br-meta">' + escapeHtml(item.url || '') + '</p>' +
            '</article>');
    }

    var lv = createListView({
        container: listHost,
        pageSize: 30,
        autoLoad: !(snapshot && snapshot.ready && snapshot.items && snapshot.items.length),
        seed: snapshot && snapshot.ready ? snapshot : null,
        emptyText: '没有符合条件的链接',
        fetchPage: function (ctx) {
            var params = {};
            if (filters.keyword) params.keyword = filters.keyword;
            if (filters.category) params.category = filters.category;
            return bookmarks.list(params, { signal: ctx.signal });
        },
        renderItem: renderItem,
        onItemClick: function (item) {
            var href = safeHttpUrl(item && item.url);
            if (!href) {
                toast.warn('这条链接不能打开');
                return;
            }
            if (item.id) bookmarks.click(item.id).catch(function () {});
            window.open(href, '_blank', 'noopener,noreferrer');
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
        title: '编辑收藏',
        labelOf: function (b) { return b.title || '这条收藏'; },
        fields: [
            { key: 'title', label: '标题', full: true },
            { key: 'url', label: '链接', full: true, placeholder: 'https://' },
            { key: 'category', label: '分类', placeholder: 'docs/tools/…' },
            { key: 'description', label: '描述', placeholder: '选填' }
        ],
        update: function (id, patch) { return bookmarks.update(id, patch); },
        remove: function (id) { return bookmarks.remove(id); },
        updated: function (saved) { lv.updateItem(saved); },
        removed: function (id) { lv.removeItemById(id); },
        alive: function () { return alive; }
    });

    function reloadFromFilters() {
        bookmarkListSession.snapshot = null;
        bookmarkListSession.scrollTop = 0;
        restoreY = 0;
        scroller.scrollTop = 0;
        chips.querySelectorAll('[data-cat]').forEach(function (btn) {
            btn.classList.toggle('is-active', btn.getAttribute('data-cat') === filters.category);
        });
        lv.reload().then(paintCount);
    }

    function onChipsClick(e) {
        var btn = e.target.closest && e.target.closest('[data-cat]');
        if (!btn || !chips.contains(btn)) return;
        filters.category = btn.getAttribute('data-cat') || '';
        reloadFromFilters();
    }

    search.addEventListener('input', function () {
        filters.keyword = search.value.trim();
        clearTimeout(keywordTimer);
        keywordTimer = setTimeout(reloadFromFilters, 300);
    });
    chips.addEventListener('click', onChipsClick);

    return {
        destroy: function () {
            alive = false;
            swipe.destroy();
            clearTimeout(keywordTimer);
            chips.removeEventListener('click', onChipsClick);
            if (lv) {
                var snap = lv.getSnapshot();
                if (snap.ready) bookmarkListSession.snapshot = snap;
                bookmarkListSession.scrollTop = scroller.scrollTop;
                lv.destroy();
            }
        }
    };
}
