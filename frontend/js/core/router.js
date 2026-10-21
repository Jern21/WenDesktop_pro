/**
 * App.router —— 真 SPA 路由
 *
 * 与旧 spa-router.js 的本质区别：
 *   旧：拦截侧边栏点击 → fetch 整页 HTML → 抠出 #page-view → innerHTML 替换
 *       → 再手工重放 <style> 和内联 <script>（因此需要 let/const→var 的 hack）
 *   新：单一入口 → 只 fetch 页面「模板片段」→ 注入 → 调用 view.mount()
 *       脚本是独立 .js 文件，不进全局作用域，无需任何 hack
 *
 * URL 采用 History API（/orders 而非 #/orders），支持刷新、直达、前进后退。
 * 服务端只需把未知路径回退到 index.html（server.js 已有此逻辑）。
 */
(function (global) {
    'use strict';

    var App = global.App = global.App || {};

    var routes = [];              // { path, pattern, keys, name }
    var templateCache = {};       // path -> html 字符串
    var styleLoaded = {};         // css 路径 -> true（样式只加载不卸载）
    var navigating = false;
    var started = false;
    var rootEl = null;
    var scrollMemory = {};        // path -> scrollTop

    // ========== 路径匹配 ==========

    /**
     * 把 /orders/:id 编译成正则 + 参数名列表
     */
    function compile(path) {
        var keys = [];
        var clean = path.replace(/\/+$/, '');

        // 第一步：先把 :param 占位符换成哨兵并收集参数名
        // （必须先提取再转义，否则转义后的 \/ 会让 :param 匹配不到）
        var pattern = clean.replace(/:([A-Za-z_$][\w$]*)/g, function (_, key) {
            keys.push(key);
            return '\u0000PARAM\u0000';
        });

        // 第二步：对静态部分做正则转义
        pattern = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

        // 第三步：哨兵还原为捕获组
        pattern = pattern.replace(/\u0000PARAM\u0000/g, '([^/]+)');

        return {
            regex: new RegExp('^' + (pattern || '') + '/?$'),
            keys: keys
        };
    }

    function normalizePath(path) {
        if (!path) return '/';
        var clean = String(path).split('?')[0].split('#')[0];
        if (clean.charAt(0) !== '/') clean = '/' + clean;
        if (clean.length > 1 && clean.charAt(clean.length - 1) === '/') {
            clean = clean.slice(0, -1);
        }
        return clean;
    }

    function match(path) {
        // 路由表由已注册视图收集而来。启动流程里可能先 match 再 start
        // （比如入口要判断当前路径是否已有对应视图），此时表还是空的，
        // 会把一切路径都判成「未注册」。所以这里做一次惰性收集。
        collectFromViews();

        var target = normalizePath(path);
        for (var i = 0; i < routes.length; i++) {
            var route = routes[i];
            var m = route.regex.exec(target);
            if (m) {
                var params = {};
                route.keys.forEach(function (key, idx) {
                    params[key] = decodeURIComponent(m[idx + 1]);
                });
                return { name: route.name, params: params, path: target };
            }
        }
        return null;
    }

    // ========== 注册 ==========

    /**
     * 从已注册的 view 中收集路由。
     * 也可手动注册：App.router.add('/orders/:id', 'order-detail')
     */
    function add(path, viewName) {
        var compiled = compile(path);
        routes.push({
            path: path,
            pattern: compiled.regex,
            regex: compiled.regex,
            keys: compiled.keys,
            name: viewName
        });
        // 长路径优先匹配（/orders/:id 应排在 /orders 之前）
        routes.sort(function (a, b) {
            return b.keys.length - a.keys.length;
        });
    }

    var collected = false;

    function collectFromViews() {
        if (collected) return;
        collected = true;
        var views = App.views.all();
        Object.keys(views).forEach(function (name) {
            var def = views[name];
            if (def && def.path) add(def.path, name);
        });
    }

    // ========== 资源加载 ==========

    var basePath = '/';

    /**
     * 把模板/样式路径解析成应用根相对路径。
     * 不能用浏览器默认的相对解析：在 /orders/123 这类深路径下，
     * fetch('views/x.html') 会被解析成 /orders/views/x.html，直接 404。
     */
    function resolveAsset(asset) {
        if (!asset) return '';
        if (/^(https?:)?\/\//.test(asset) || asset.charAt(0) === '/') return asset;
        if (/^\.\//.test(asset)) asset = asset.slice(2);
        return (basePath === '/' ? '' : basePath.replace(/\/$/, '')) + '/' + asset;
    }

    function fetchTemplate(path) {
        var url = resolveAsset(path);
        if (templateCache[url] !== undefined) {
            return Promise.resolve(templateCache[url]);
        }
        return fetch(url, { cache: 'no-cache' })
            .then(function (res) {
                // 未登录时服务端返回 401（而不是登录页 HTML），此时跳转登录并带回跳地址
                if (res.status === 401) {
                    var next = encodeURIComponent(location.pathname + location.search);
                    location.href = '/login.html?next=' + next;
                    return Promise.reject(new Error('UNAUTHORIZED'));
                }
                if (!res.ok) throw new Error('模板加载失败 ' + res.status + ': ' + url);
                return res.text();
            })
            .then(function (html) {
                templateCache[url] = html;
                return html;
            });
    }

    function ensureStyle(href) {
        if (!href) return;
        var url = resolveAsset(href);
        if (styleLoaded[url]) return;
        styleLoaded[url] = true;
        var link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = url;
        document.head.appendChild(link);
    }

    // ========== 渲染 ==========

    function updateActiveNav(def, viewName) {
        var key = (def && def.nav) || viewName;
        if (typeof global.updateSidebarActive === 'function') {
            global.updateSidebarActive(key);
            return;
        }
        // 退路：直接操作 DOM
        var links = document.querySelectorAll('a[data-page]');
        Array.prototype.slice.call(links).forEach(function (link) {
            var page = link.getAttribute('data-page');
            var active = page === key || page === key + '.html';
            link.classList.toggle('bg-blue-50', active);
            link.classList.toggle('text-blue-600', active);
        });
    }

    function setTitle(text) {
        if (text) document.title = text;
    }

    var APP_NAME = '文的项目工作台';

    /**
     * 拼页面标题。
     * 首页视图的 title 本身就是 APP_NAME，直接拼会变成
     * 「文的项目工作台 - 文的项目工作台」，所以这里要判重。
     */
    function pageTitle(title) {
        if (!title) return APP_NAME;
        return title === APP_NAME ? title : title + ' - ' + APP_NAME;
    }

    function restoreScroll(path) {
        var saved = scrollMemory[path] || 0;
        var scroller = rootEl && (rootEl.querySelector('.overflow-y-auto, .overflow-auto') || rootEl);
        if (scroller) scroller.scrollTop = saved;
    }

    function saveScroll(path) {
        if (!rootEl) return;
        var scroller = rootEl.querySelector('.overflow-y-auto, .overflow-auto') || rootEl;
        scrollMemory[path] = scroller ? scroller.scrollTop : 0;
    }

    /**
     * 渲染指定路径
     */
    async function render(path, options) {
        var opts = options || {};
        var matched = match(path);

        // 1. 未匹配 → 404
        if (!matched) {
            renderNotFound(path);
            return;
        }

        // 2. 记录离开前的滚动位置
        if (!opts.silent) saveScroll(location.pathname);

        // 3. 关闭上一页遗留的浮层（统一入口，替代旧的手工枚举）
        if (App.ui && typeof App.ui.closeAll === 'function') App.ui.closeAll();
        // 兼容旧表单模块（order-form / poster-form / memo-form）：
        // 它们监听此事件来重置内部 isOpen 状态，否则抽屉会卡死打不开
        global.dispatchEvent(new CustomEvent('spa:cleanup-forms'));

        // 4. 离开旧 view（执行清理 + 卸载）
        var activation = await App.views.activate(matched.name, matched.params, matched.path);
        var def = activation.definition;

        // 5. 加载模板与样式
        ensureStyle(def.styles);
        var html = '';
        if (def.template) {
            html = await fetchTemplate(def.template);
        }

        // 6. 注入内容
        if (!rootEl) rootEl = document.getElementById('page-view');
        if (!rootEl) throw new Error('[router] 缺少 #page-view 容器');
        rootEl.innerHTML = html;

        // 7. 更新标题与导航
        setTitle(pageTitle(def.title));
        updateActiveNav(def, matched.name);

        // 8. 执行 view 的 mount
        await activation.mount(rootEl);

        // 9. 滚动复位 / 恢复
        restoreScroll(matched.path);

        // 10. 派发就绪事件（兼容旧页面里监听 spa:ready 的逻辑）
        //     detail.page 必须用旧页面标识（如 index.html / stats.html）：
        //     旧代码里普遍有 `if (page.indexOf('stats') === -1) return;`
        //     这类守卫，用视图名（stats / dashboard）会对不上，逻辑永远不执行。
        requestAnimationFrame(function () {
            global.dispatchEvent(new CustomEvent('spa:ready', {
                detail: {
                    page: (def && def.nav) || matched.name,
                    view: matched.name,
                    path: matched.path
                }
            }));
            if (typeof global.echarts !== 'undefined') {
                global.dispatchEvent(new CustomEvent('echarts-ready'));
            }
        });
    }

    function renderNotFound(path) {
        if (!rootEl) rootEl = document.getElementById('page-view');
        if (!rootEl) return;
        rootEl.innerHTML =
            '<div class="flex-1 flex flex-col items-center justify-center text-center p-10">' +
                '<i class="ph ph-map-pin text-5xl text-gray-300"></i>' +
                '<h2 class="mt-4 text-lg font-medium text-gray-700">页面不存在</h2>' +
                '<p class="mt-2 text-sm text-gray-400">' + App.dom.escapeHtml(path) + '</p>' +
                '<a href="/" data-link class="mt-6 px-5 py-2 rounded-lg bg-blue-500 text-white text-sm">返回仪表盘</a>' +
            '</div>';
        document.title = pageTitle('页面不存在');
    }

    // ========== 导航 ==========

    /**
     * 站内跳转
     * @param {string} to
     * @param {Object} [options] - { replace: true, silent: true }
     */
    async function navigate(to, options) {
        var opts = options || {};
        var target = normalizePath(to);
        var current = normalizePath(location.pathname);

        if (target === current && !opts.force) return;

        if (navigating) return;
        navigating = true;

        try {
            if (opts.replace) {
                history.replaceState({ spa: true, path: target }, '', target);
            } else {
                history.pushState({ spa: true, path: target }, '', target);
            }
            await render(target, opts);
        } catch (err) {
            console.error('[router] 导航失败:', err);
            // 降级：整页跳转，保证用户不会卡死
            location.href = target;
        } finally {
            navigating = false;
        }
    }

    // ========== 事件绑定 ==========

    function bindGlobalEvents() {
        // 1. 拦截站内跳转
        document.addEventListener('click', function (e) {
            // 1a. [data-path] —— 任意元素（卡片、按钮）声明目标路由
            var pathEl = e.target.closest('[data-path]');
            if (pathEl) {
                if (pathEl.hasAttribute('data-blank')) return;
                if (e.metaKey || e.ctrlKey || e.shiftKey) return;
                e.preventDefault();
                navigate(pathEl.getAttribute('data-path'));
                return;
            }

            // 1b. a[data-link] —— 显式声明的链接
            var link = e.target.closest('a[data-link]');
            if (!link) return;
            var href = link.getAttribute('href');
            if (!href || href.indexOf('http') === 0 || href.charAt(0) === '#') return;
            if (link.target === '_blank' || e.metaKey || e.ctrlKey || e.shiftKey) return;
            e.preventDefault();
            navigate(href);
        });

        // 2. 浏览器前进/后退
        global.addEventListener('popstate', function () {
            render(location.pathname, { silent: true }).catch(function (err) {
                console.error('[router] popstate 渲染失败:', err);
            });
        });

        // 3. 离开页面时记录滚动位置（刷新后恢复）
        global.addEventListener('beforeunload', function () {
            saveScroll(location.pathname);
        });
    }

    // ========== 启动 ==========

    /**
     * @param {Object} [options]
     * @param {string} [options.root='#page-view']
     */
    function start(options) {
        if (started) return Promise.resolve();
        started = true;

        var opts = options || {};
        basePath = opts.base || '/';
        rootEl = document.querySelector(opts.root || '#page-view');

        collectFromViews();
        bindGlobalEvents();

        // 首次进入：优先用 opts.initial（便于在非根路径下验证），否则按当前 URL
        var initialPath = opts.initial || location.pathname;
        return render(initialPath, { silent: true }).catch(function (err) {
            console.error('[router] 首屏渲染失败:', err);
            if (rootEl) {
                rootEl.innerHTML = '<div class="p-10 text-center text-sm text-red-500">' +
                    '页面加载失败：' + App.dom.escapeHtml(err.message) + '</div>';
            }
        });
    }

    App.router = {
        start: start,
        add: add,
        navigate: navigate,
        render: render,
        match: match,
        normalizePath: normalizePath,
        getRoutes: function () { return routes.slice(); },
        clearTemplateCache: function () { templateCache = {}; }
    };

})(typeof window !== 'undefined' ? window : this);
