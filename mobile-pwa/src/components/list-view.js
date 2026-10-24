/**
 * 通用分页列表视图（下拉刷新 + 上拉加载 + 空态/错误/骨架）
 *
 * 为什么要造这个组件，而不是每个页面各写一遍：
 *  1. 后端两种列表形态（分页对象 / 裸数组），页面层不应该关心；
 *  2. 移动端「下拉刷新」是刚需，但手势要和滚动容器配合，写错一次全页都不能滚动；
 *  3. 翻页竞态（快速切换筛选、连续上拉）不做代际控制就会出现
 *     「后发的请求先返回」→ 列表内容错乱。这是最难复现也最容易漏掉的 bug。
 *
 * 用法：
 * ```js
 * const lv = createListView({
 *     container: el,
 *     fetchPage: ({ page, pageSize, signal }) => orders.list({ page, pageSize }, { signal }),
 *     renderItem: (o) => `<article class="order-card">...</article>`,
 *     onItemClick: (o) => navigate('/orders/' + o.id),
 *     emptyText: '还没有订单'
 * });
 * ```
 * 返回：`{ reload(), refresh(), getItems(), destroy() }`
 */
import { normalizeList, mergeUnique } from '../lib/pagination.js';

/** 触发刷新所需的实际位移（px） */
var PULL_THRESHOLD = 56;
/** 下拉位移阻尼：手指拉 100px，指示器只长高 55px */
var PULL_DAMPING = 0.55;
var MAX_PULL = 88;
/** 刷新中指示器保持的高度 */
var PULL_HOLD_HEIGHT = 44;

/**
 * @param {Object} opts
 * @param {HTMLElement} opts.container 挂载点（会被清空）
 * @param {(ctx:{page:number,pageSize:number,signal:AbortSignal}) => Promise<*>} opts.fetchPage
 *        返回 api 的完整 JSON（组件自己归一化），或直接返回 {list,total}
 * @param {(item:*, index:number) => string} opts.renderItem 返回 HTML 字符串（**必须自行转义**）
 * @param {(item:*, el:HTMLElement) => void} [opts.onItemClick]
 * @param {(item:*) => string} [opts.keyOf]
 * @param {number} [opts.pageSize]
 * @param {string} [opts.emptyText]
 * @param {string} [opts.emptyHint]
 * @param {number} [opts.skeletonCount]
 * @param {boolean} [opts.pullToRefresh] 默认 true
 * @param {boolean} [opts.autoLoad] 默认 true
 * @param {HTMLElement} [opts.scroller] 滚动容器，默认找最近的 .mobile-content
 * @param {string} [opts.className] 附加到根节点的类名
 * @param {(items:Array) => void} [opts.onLoaded] 每次数据变化后回调（用于渲染统计条）
 */
export function createListView(opts) {
    var o = opts || {};
    var container = o.container;
    if (!container) throw new Error('createListView: 缺少 container');

    var pageSize = o.pageSize || 15;
    var pullEnabled = o.pullToRefresh !== false;
    var scroller = o.scroller || container.closest('.mobile-content') || container;

    // ---- 运行状态 ----
    var state = {
        items: [],
        page: 0,
        total: 0,
        hasMore: true,
        loading: false,
        refreshing: false,
        loadingMore: false,
        error: null,
        generation: 0,
        destroyed: false,
        firstLoadDone: false
    };

    var abortCtrl = null;
    var observer = null;
    var pullStartY = 0;
    var pullDistance = 0;
    var pullActive = false;
    var pullDragging = false;
    var touchId = null;

    /* ---------- DOM ---------- */
    container.innerHTML = '';
    var root = document.createElement('div');
    root.className = 'lv-root' + (o.className ? ' ' + o.className : '');

    var pullEl = document.createElement('div');
    pullEl.className = 'lv-pull';
    pullEl.innerHTML = '<span class="lv-pull-text">下拉刷新</span>';

    var listEl = document.createElement('div');
    listEl.className = 'lv-list';
    listEl.setAttribute('role', 'list');

    var footerEl = document.createElement('div');
    footerEl.className = 'lv-footer';

    root.appendChild(pullEl);
    root.appendChild(listEl);
    root.appendChild(footerEl);
    container.appendChild(root);

    /* ---------- 渲染 ---------- */
    function renderSkeleton() {
        var n = o.skeletonCount || 5;
        var html = '';
        for (var i = 0; i < n; i++) {
            html += '<div class="lv-skeleton"><div class="lv-skeleton-line lv-skeleton-line--title"></div>' +
                '<div class="lv-skeleton-line"></div>' +
                '<div class="lv-skeleton-line lv-skeleton-line--short"></div></div>';
        }
        listEl.innerHTML = html;
        footerEl.innerHTML = '';
    }

    function renderEmpty() {
        listEl.innerHTML =
            '<div class="lv-empty">' +
            '  <div class="lv-empty-icon" aria-hidden="true">🗂️</div>' +
            '  <p class="lv-empty-title">' + (o.emptyText || '暂无数据') + '</p>' +
            (o.emptyHint ? '<p class="lv-empty-hint">' + o.emptyHint + '</p>' : '') +
            '</div>';
        footerEl.innerHTML = '';
    }

    function renderError(err) {
        var msg = (err && err.message) || '加载失败';
        var canRetry = !(err && err.aborted);
        listEl.innerHTML =
            '<div class="lv-error">' +
            '  <div class="lv-empty-icon" aria-hidden="true">⚠️</div>' +
            '  <p class="lv-empty-title"></p>' +
            (canRetry ? '  <button type="button" class="lv-retry" data-act="retry">重试</button>' : '') +
            '</div>';
        // 错误文案可能有单引号/尖括号，走 textContent
        listEl.querySelector('.lv-empty-title').textContent = msg;
    }

    function renderList() {
        if (!state.items.length) {
            renderEmpty();
            return;
        }
        var html = '';
        for (var i = 0; i < state.items.length; i++) {
            var item = state.items[i];
            var inner = o.renderItem ? o.renderItem(item, i) : '';
            html += '<div class="lv-item" role="listitem" data-index="' + i + '">' + (inner || '') + '</div>';
        }
        listEl.innerHTML = html;
        renderFooter();
    }

    function renderFooter() {
        if (state.loading || state.refreshing) return;
        if (state.loadingMore) {
            footerEl.innerHTML = '<span class="lv-footer-text">加载中…</span>';
            return;
        }
        if (!state.items.length) {
            footerEl.innerHTML = '';
            return;
        }
        if (state.hasMore) {
            footerEl.innerHTML = '<span class="lv-footer-text">上拉加载更多</span>';
        } else {
            footerEl.innerHTML = '<span class="lv-footer-text lv-footer-text--end">已经到底了</span>';
        }
    }

    function setPullText(text, mode) {
        var el = pullEl.querySelector('.lv-pull-text');
        if (el) el.textContent = text;
        pullEl.className = 'lv-pull' + (mode ? ' is-' + mode : '') + (pullDragging ? ' is-dragging' : '');
    }

    /**
     * 指示器高度就是下拉位移。
     *
     * 为什么不用 translateY：这个列表在 `.mobile-content`（overflow-y:auto）里面，
     * 负定位的指示器会被滚动容器裁掉，拉下来只能看到半个字。
     * 用高度撑开虽然会引发布局，但能保证指示器始终完整可见，且内容自然下移。
     * 跟手阶段加 `.is-dragging` 关掉 transition，避免过渡把手指动作拖慢。
     */
    function setPullHeight(px) {
        pullEl.style.height = Math.max(0, Math.round(px)) + 'px';
    }

    function resetPull() {
        pullDragging = false;
        pullEl.classList.remove('is-dragging');
        setPullHeight(0);
        root.classList.remove('is-pulling');
        pullDistance = 0;
        pullActive = false;
        touchId = null;
        setPullText('下拉刷新', '');
    }

    /* ---------- 数据 ---------- */
    function fetchOnce(page, isRefresh) {
        state.generation += 1;
        var gen = state.generation;

        if (abortCtrl) abortCtrl.abort();
        abortCtrl = new AbortController();

        var ctx = { page: page, pageSize: pageSize, signal: abortCtrl.signal };
        return Promise.resolve()
            .then(function () { return o.fetchPage(ctx); })
            .then(function (payload) {
                if (state.destroyed || gen !== state.generation) return null;
                var normalized = normalizeList(payload, pageSize);

                state.total = normalized.total;
                state.page = normalized.page || page;

                if (isRefresh || page <= 1) {
                    state.items = normalized.list;
                } else {
                    state.items = mergeUnique(state.items, normalized.list, o.keyOf);
                }

                // 用「已加载条数 vs 总数」判断还有没有下一页，比信后端 hasMore 稳：
                // 后端 pageSize 可能被它自己的默认值改掉（订单默认 50）
                var gotNothing = normalized.list.length === 0;
                state.hasMore = !gotNothing && state.items.length < normalized.total;
                state.error = null;
                return normalized;
            })
            .catch(function (err) {
                if (state.destroyed || gen !== state.generation) return null;
                if (err && err.aborted) return null;
                state.error = err;
                throw err;
            });
    }

    /**
     * 重新加载（筛选条件变了、切换 tab 时用）
     * @param {{silent?:boolean}} [options] silent=true 时不显示骨架
     */
    function reload(options) {
        var silent = !!(options && options.silent);
        if (state.destroyed) return Promise.resolve();

        state.items = [];
        state.page = 0;
        state.hasMore = true;
        state.error = null;
        state.loading = true;
        state.refreshing = !silent && state.firstLoadDone;

        if (!silent) renderSkeleton();
        else if (state.firstLoadDone) renderFooter();

        return fetchOnce(1, true)
            .then(function (normalized) {
                if (!normalized || state.destroyed) return;
                state.loading = false;
                state.refreshing = false;
                state.firstLoadDone = true;
                if (!state.items.length) renderEmpty();
                else renderList();
                if (o.onLoaded) o.onLoaded(state.items);
            })
            .catch(function (err) {
                if (state.destroyed || !err || err.aborted) return;
                state.loading = false;
                state.refreshing = false;
                state.firstLoadDone = true;
                renderError(err);
            });
    }

    /** 静默刷新：保留当前列表内容，成功后整体替换（下拉刷新手势用这个） */
    function refresh() {
        if (state.destroyed || state.refreshing) return Promise.resolve();
        state.refreshing = true;
        setPullText('刷新中…', 'loading');

        return fetchOnce(1, true)
            .then(function (normalized) {
                if (!normalized || state.destroyed) return;
                state.refreshing = false;
                state.firstLoadDone = true;
                if (!state.items.length) renderEmpty();
                else renderList();
                if (o.onLoaded) o.onLoaded(state.items);
            })
            .catch(function (err) {
                if (state.destroyed || !err || err.aborted) return;
                state.refreshing = false;
                // 刷新失败不清空已有内容 —— 断网时把已看到的列表打掉是最糟的体验
                renderFooter();
                footerEl.innerHTML = '<span class="lv-footer-text lv-footer-text--err"></span>';
                footerEl.querySelector('.lv-footer-text').textContent = '刷新失败：' + err.message;
            })
            .then(function () {
                setTimeout(function () {
                    if (state.destroyed) return;
                    resetPull();
                }, 220);
            });
    }

    function loadMore() {
        if (state.destroyed || state.loading || state.refreshing || state.loadingMore) return Promise.resolve();
        if (!state.hasMore || !state.items.length) return Promise.resolve();

        state.loadingMore = true;
        renderFooter();
        var nextPage = (state.page || 1) + 1;

        return fetchOnce(nextPage, false)
            .then(function (normalized) {
                if (!normalized || state.destroyed) return;
                state.loadingMore = false;
                renderList();
                if (o.onLoaded) o.onLoaded(state.items);
            })
            .catch(function (err) {
                if (state.destroyed || !err || err.aborted) return;
                state.loadingMore = false;
                renderFooter();
                footerEl.innerHTML = '<button type="button" class="lv-retry lv-retry--inline" data-act="more">加载失败，点此重试</button>';
            });
    }

    /* ---------- 交互 ---------- */
    listEl.addEventListener('click', function (e) {
        var retry = e.target.closest && e.target.closest('[data-act="retry"]');
        if (retry) {
            reload();
            return;
        }
        if (!o.onItemClick) return;
        var itemEl = e.target.closest && e.target.closest('.lv-item');
        if (!itemEl || !listEl.contains(itemEl)) return;
        var idx = parseInt(itemEl.getAttribute('data-index'), 10);
        var item = state.items[idx];
        if (item !== undefined) o.onItemClick(item, itemEl);
    });

    // 上拉加载失败后的手动重试
    footerEl.addEventListener('click', function (e) {
        var more = e.target.closest && e.target.closest('[data-act="more"]');
        if (more) {
            // 失败时 page 没有前进，hasMore 可能已被置 false，这里强制再试一次
            state.hasMore = true;
            loadMore();
        }
    });

    /* ---------- 下拉刷新手势 ---------- */
    function onTouchStart(e) {
        if (!pullEnabled || state.refreshing || e.touches.length !== 1) return;
        if (scroller.scrollTop > 0) return;
        pullStartY = e.touches[0].clientY;
        pullActive = true;
        touchId = e.touches[0].identifier;
    }

    function onTouchMove(e) {
        if (!pullActive || state.refreshing) return;
        // 滚动位置已经不是顶部 → 用户其实在正常滚动，放弃本次下拉
        if (scroller.scrollTop > 0) {
            resetPull();
            return;
        }
        var touch = null;
        for (var i = 0; i < e.touches.length; i++) {
            if (e.touches[i].identifier === touchId) { touch = e.touches[i]; break; }
        }
        if (!touch) return;

        var delta = touch.clientY - pullStartY;
        if (delta <= 0) {
            // 往上滑 → 交还给正常滚动
            if (pullDistance > 0) resetPull();
            return;
        }

        // 到这里说明确实在顶部往下拉，必须拦住原生回弹，否则手势和页面打架
        if (e.cancelable) e.preventDefault();

        pullDistance = Math.min(MAX_PULL, delta * PULL_DAMPING);
        pullDragging = true;
        root.classList.add('is-pulling');
        setPullHeight(pullDistance);

        if (pullDistance >= PULL_THRESHOLD) {
            setPullText('松开刷新', 'ready');
        } else {
            setPullText('下拉刷新', '');
        }
    }

    function onTouchEnd() {
        if (!pullActive) return;
        var shouldRefresh = pullDistance >= PULL_THRESHOLD;
        pullActive = false;
        pullDragging = false;
        pullEl.classList.remove('is-dragging');

        if (shouldRefresh) {
            // 保持一小段高度让「刷新中…」可见，refresh 结束后再归零
            setPullHeight(PULL_HOLD_HEIGHT);
            refresh();
        } else {
            resetPull();
        }
    }

    if (pullEnabled) {
        // passive:false 才能 preventDefault，别改成默认值
        scroller.addEventListener('touchstart', onTouchStart, { passive: true });
        scroller.addEventListener('touchmove', onTouchMove, { passive: false });
        scroller.addEventListener('touchend', onTouchEnd);
        scroller.addEventListener('touchcancel', resetPull);
    }

    /* ---------- 上拉加载（IntersectionObserver） ---------- */
    if (typeof IntersectionObserver === 'function') {
        // root 必须是真正在滚动的那个元素。只有挂到 document 上时才用视口（null）。
        // 写错成 null 会让「容器内滚动」的列表在 footer 还没进入视口时就疯狂预加载。
        var isDocScroll = scroller === document.documentElement || scroller === document.body;
        observer = new IntersectionObserver(function (entries) {
            entries.forEach(function (entry) {
                if (entry.isIntersecting) loadMore();
            });
        }, { root: isDocScroll ? null : scroller, rootMargin: '200px' });
        observer.observe(footerEl);
    } else {
        // 老浏览器兜底：滚动到底部附近就加载
        scroller.addEventListener('scroll', function () {
            if (scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 200) loadMore();
        });
    }

    function applySeed(seed) {
        state.items = seed.items.slice();
        state.page = seed.page || 1;
        state.total = typeof seed.total === 'number' ? seed.total : seed.items.length;
        state.hasMore = !!seed.hasMore && state.items.length < state.total;
        state.loading = false;
        state.refreshing = false;
        state.error = null;
        state.firstLoadDone = true;
        if (!state.items.length) renderEmpty();
        else renderList();
        if (o.onLoaded) o.onLoaded(state.items);
    }

    /* ---------- 启动 ----------
     * seed 用来「从详情返回」：先画出离开前的那一页，避免骨架把滚动位置打掉。
     * 有 seed 就不再自动请求；调用方要最新数据时自己 refresh()。 */
    var seeded = o.seed && Array.isArray(o.seed.items) && o.seed.items.length;
    if (seeded) applySeed(o.seed);
    if (o.autoLoad !== false && !seeded) reload();

    /* ---------- 行级增删改 ----------
     * 列表页上的编辑/删除（比如左滑）只想动一行，
     * 不该为一条记录把整页（含滚动位置）打回骨架屏重拉。 */
    function keyOfItem(item) {
        return o.keyOf ? o.keyOf(item) : (item && item.id);
    }

    function updateItem(patch) {
        var key = keyOfItem(patch);
        if (key === undefined || key === null) return false;
        for (var i = 0; i < state.items.length; i++) {
            if (keyOfItem(state.items[i]) === key) {
                state.items[i] = Object.assign({}, state.items[i], patch);
                renderList();
                if (o.onLoaded) o.onLoaded(state.items);
                return true;
            }
        }
        return false;
    }

    function removeItemById(key) {
        for (var i = 0; i < state.items.length; i++) {
            if (keyOfItem(state.items[i]) === key) {
                state.items.splice(i, 1);
                state.total = Math.max(0, state.total - 1);
                if (!state.items.length) renderEmpty();
                else renderList();
                if (o.onLoaded) o.onLoaded(state.items);
                return true;
            }
        }
        return false;
    }

    return {
        reload: reload,
        refresh: refresh,
        loadMore: loadMore,
        updateItem: updateItem,
        removeItemById: removeItemById,
        getItems: function () { return state.items.slice(); },
        getSnapshot: function () {
            return {
                items: state.items.slice(),
                page: state.page,
                total: state.total,
                hasMore: state.hasMore,
                ready: state.firstLoadDone && !state.loading && !state.refreshing && !state.error
            };
        },
        getState: function () {
            return {
                count: state.items.length,
                total: state.total,
                hasMore: state.hasMore,
                loading: state.loading,
                refreshing: state.refreshing
            };
        },
        destroy: function () {
            state.destroyed = true;
            state.generation += 1;
            if (abortCtrl) abortCtrl.abort();
            if (observer) observer.disconnect();
            if (pullEnabled) {
                scroller.removeEventListener('touchstart', onTouchStart);
                scroller.removeEventListener('touchmove', onTouchMove);
                scroller.removeEventListener('touchend', onTouchEnd);
                scroller.removeEventListener('touchcancel', resetPull);
            }
            container.innerHTML = '';
        }
    };
}
