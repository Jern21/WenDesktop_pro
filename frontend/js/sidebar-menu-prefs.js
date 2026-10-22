/**
 * sidebar-menu-prefs.js —— 侧边栏菜单项的「显示 / 隐藏」偏好
 *
 * 用途：设置中心 →「菜单选项」里的那一组开关，控制左侧侧栏每个菜单项是否出现。
 *
 * 设计要点：
 *   1. 菜单清单不在这里写死 —— 直接从已渲染的 `#sidebar-nav [data-menu-key]`
 *      读。这样设置页的列表和侧栏天然一致，以后新增菜单项不用改两处，
 *      也不会出现「侧栏有、设置页漏」的对不上。
 *   2. 隐藏标记用 `[data-menu-hidden="1"]` 属性 + common.css 里的 `!important`
 *      规则，**不用 Tailwind 的 `hidden` 类**：视图 CSS 是路由器动态注入的，
 *      排在 Tailwind 之后，同优先级会把 display:none 压掉（本项目踩过，
 *      见 MEMORY.md 里 reminder 三个模态框常显的事故）。
 *   3. 设置中心自己不允许隐藏 —— 否则用户把自己锁在外面，只能去清 localStorage。
 *
 * 持久化：localStorage['app-sidebar-menu-hidden'] = 隐藏项的 key 数组
 */
(function (global) {
    'use strict';

    var STORAGE_KEY = 'app-sidebar-menu-hidden';
    var MARK_ATTR = 'data-menu-hidden';

    /** 永远可见的菜单项（key 来自 sidebar.js 的 data-menu-key） */
    var ALWAYS_VISIBLE = ['settings'];

    var LABEL_MAX = 24;

    function isLocked(key) {
        return ALWAYS_VISIBLE.indexOf(key) !== -1;
    }

    /** 读隐藏列表（容错：损坏/非数组一律当空，不影响侧栏可用） */
    function getHidden() {
        try {
            var raw = localStorage.getItem(STORAGE_KEY);
            if (!raw) return [];
            var parsed = JSON.parse(raw);
            if (!Array.isArray(parsed)) return [];
            return parsed.filter(function (k) {
                return typeof k === 'string' && k && !isLocked(k);
            });
        } catch (e) {
            return [];
        }
    }

    /**
     * 菜单清单：从侧栏 DOM 里读，保持「侧栏删改 → 设置页跟着变」
     * @returns {Array<{key,label,page,icon,parent,locked}>}
     */
    function getCatalog() {
        var nav = document.getElementById('sidebar-nav');
        if (!nav) return [];

        var items = [];
        var seen = {};

        Array.prototype.slice.call(
            nav.querySelectorAll('[data-menu-key]')
        ).forEach(function (el) {
            var key = el.getAttribute('data-menu-key');
            if (!key || seen[key]) return;
            seen[key] = true;

            // 组容器（平台管理那一整块）自身不是链接，文本要从内部第一个 .nav-link 取
            var linkEl = el.classList.contains('nav-link')
                ? el
                : el.querySelector('.nav-link');
            var label = ((linkEl || el).textContent || '').replace(/\s+/g, ' ').trim();

            // 图标：主项带 .icon-base，子项没有 → 由调用方给默认图标
            var iconEl = el.querySelector('.icon-base');
            var icon = '';
            if (iconEl) {
                var m = /(ph(?:-fill)?-[\w-]+)/.exec(iconEl.className || '');
                if (m) icon = m[1];
            }

            items.push({
                key: key,
                label: label.slice(0, LABEL_MAX) || key,
                page: (linkEl && linkEl.getAttribute('data-page')) || '',
                icon: icon,
                parent: el.getAttribute('data-menu-parent') || '',
                locked: isLocked(key)
            });
        });

        return items;
    }

    /** 把偏好写到侧栏 DOM 上（幂等，可反复调用） */
    function apply() {
        var nav = document.getElementById('sidebar-nav');
        if (!nav) return;

        var hidden = getHidden();
        var hideMap = {};
        hidden.forEach(function (k) { hideMap[k] = true; });

        Array.prototype.slice.call(
            nav.querySelectorAll('[data-menu-key]')
        ).forEach(function (el) {
            var key = el.getAttribute('data-menu-key');
            if (key && hideMap[key]) {
                el.setAttribute(MARK_ATTR, '1');
            } else {
                el.removeAttribute(MARK_ATTR);
            }
        });
    }

    function persist(list) {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
        } catch (e) {
            /* 隐私模式下写不进去：内存里也生效不了，只能提示调用方 */
        }
        apply();
        global.dispatchEvent(new CustomEvent('sidebar-menu-prefs-change', {
            detail: { hidden: list.slice() }
        }));
    }

    /**
     * 设置单项可见性
     * @param {string} key
     * @param {boolean} visible
     * @returns {boolean} 是否真的改动成功（锁定的项隐藏会返回 false）
     */
    function setVisible(key, visible) {
        if (!key) return false;
        if (!visible && isLocked(key)) return false;

        var list = getHidden().filter(function (k) { return k !== key; });
        if (!visible) list.push(key);
        persist(list);
        return true;
    }

    function isVisible(key) {
        return getHidden().indexOf(key) === -1;
    }

    /** 全部恢复显示 */
    function reset() {
        persist([]);
    }

    /** 全部隐藏（锁定的除外） */
    function hideAll() {
        persist(getCatalog().filter(function (it) {
            return !it.locked;
        }).map(function (it) { return it.key; }));
    }

    // 显式挂 window（而不是 global）：tools/verify-deps.js 只识别 `window.X =` 形式的全局声明，
    // 用 global 别名会被判成「视图引用了找不到定义的全局」。
    window.SidebarMenuPrefs = {
        getCatalog: getCatalog,
        getHidden: getHidden,
        isVisible: isVisible,
        setVisible: setVisible,
        apply: apply,
        reset: reset,
        hideAll: hideAll,
        isLocked: isLocked,
        storageKey: STORAGE_KEY
    };

    // 首屏尽早应用一次（侧栏还没插入时 apply() 是空操作，
    // 由 sidebar.js 插入 DOM 后再调一次）
    apply();
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', apply);
    }

})(typeof window !== 'undefined' ? window : this);
