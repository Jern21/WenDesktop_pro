/**
 * 客户管理 视图
 *
 * 自动迁移自 frontend/pages/business/customer.html
 *
 * 迁移方式：原脚本整段放入 mount() 作用域，
 *   - 所有 var/function 成为局部变量，不再污染 window
 *   - document/window 上的监听由框架自动登记并清理
 *
 * ⚠️ 人工复核清单：
 *   1. 若含 onclick 内联属性 → 需改造成 data-act 委托
 *   2. 若含 spa:ready / spa:cleanup-forms 监听 → 新架构下应删除
 *   3. 若 css 含 @apply → 需展开为原生 CSS
 */
(function (global) {
    'use strict';

    var App = global.App = global.App || {};

    App.view('customer', {
        path: '/customer',
        nav: 'customer.html',
        title: '客户管理',
        template: 'views/customer.html',
        styles: 'css/views/customer.css',

        async mount(root, ctx) {
            // ---- 自动捕获本页注册的全局监听，卸载时统一移除 ----
            var _docAdd = document.addEventListener;
            var _winAdd = window.addEventListener;
            var _listeners = [];
            document.addEventListener = function (t, f, o) {
                _listeners.push(['doc', t, f, o]);
                return _docAdd.call(document, t, f, o);
            };
            window.addEventListener = function (t, f, o) {
                _listeners.push(['win', t, f, o]);
                return _winAdd.call(window, t, f, o);
            };
            ctx.onCleanup(function () {
                document.addEventListener = _docAdd;
                window.addEventListener = _winAdd;
                _listeners.forEach(function (r) {
                    try {
                        (r[0] === 'doc' ? document : window).removeEventListener(r[1], r[2], r[3]);
                    } catch (e) { /* ignore */ }
                });
            });

            try {
                /* ==================== 原始脚本开始 ==================== */

                    (function () {
                        'use strict';

                        // ========== SPA 模式下注入自定义 CSS ==========
                        if (!document.getElementById('cust-page-styles')) {
                            var styleEl = document.createElement('style');
                            styleEl.id = 'cust-page-styles';
                            styleEl.textContent = [
                                '.cust-modal-overlay { position: fixed; inset: 0; z-index: 60; display: flex; align-items: center; justify-content: center; background: rgba(0,0,0,0.4); }',
                                '.cust-modal-panel { background: #fff; border-radius: 1rem; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.1); width: 100%; max-width: 560px; max-height: 92vh; overflow-y: auto; }',
                                '.cust-action-menu { position: fixed; z-index: 55; background: #fff; border-radius: 0.5rem; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1); border: 1px solid #f1f5f9; padding: 0.25rem 0; width: 9rem; opacity: 0; transform: scale(0.95); transform-origin: top right; transition: all 0.15s ease; pointer-events: none; }',
                                '.cust-action-menu.show { opacity: 1; transform: scale(1); pointer-events: auto; }',
                                '.cust-action-item { width: 100%; padding: 0.5rem 0.75rem; text-align: left; font-size: 0.875rem; color: #4b5563; display: flex; align-items: center; gap: 0.5rem; transition: background 0.15s ease; }',
                                '.cust-action-item:hover { background: #f9fafb; }',
                                '.cust-form-input { width: 100%; border: 1px solid #e5e7eb; border-radius: 0.5rem; padding: 0.5rem 0.75rem; font-size: 0.875rem; outline: none; transition: border-color 0.15s ease; }',
                                '.cust-form-input:focus { border-color: #3b82f6; }',
                                '.cust-form-label { display: block; font-size: 0.75rem; color: #6b7280; margin-bottom: 0.375rem; }'
                            ].join('\n');
                            document.head.appendChild(styleEl);
                        }

                        // ========== 数据缓存 ==========
                        var customerCache = [];
                        var customerMap = {};
                        var selectedCustomerId = null;
                        var currentFilter = { keyword: '', source: '', level: '', type: '' };
                        var detailOrders = [];
                        var detailFollows = [];
                        var currentDetailTab = 'basic';
                        var orderSavedListenerBound = false;

                        // 分页配置
                        var pagination = { page: 1, pageSize: 20 };

                        // 获取当前页数据
                        function getCurrentPageList() {
                            var start = (pagination.page - 1) * pagination.pageSize;
                            var end = start + pagination.pageSize;
                            return customerCache.slice(start, end);
                        }

                        // ========== 颜色映射 ==========
                        var SOURCE_COLORS = {
                            '闲鱼': 'bg-yellow-50 text-yellow-600',
                            '小红书': 'bg-red-50 text-red-600',
                            '抖音': 'bg-gray-100 text-gray-600',
                            '微信': 'bg-green-50 text-green-600',
                            '淘宝': 'bg-orange-50 text-orange-600',
                            '朋友推荐': 'bg-blue-50 text-blue-600'
                        };

                        // 平台图标映射（使用 assets/svg 中的图标）
                        var SOURCE_ICONS = {
                            '闲鱼': '<svg class="w-3.5 h-3.5" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg"><path d="M170.667 0h682.666Q1024 0 1024 170.667v682.666Q1024 1024 853.333 1024H170.667Q0 1024 0 853.333V170.667Q0 0 170.667 0z" fill="#FEE50F"></path><path d="M748.16 676.437c66.901 16.427 118.059 17.195 153.173 3.584a27.52 27.52 0 0 1 35.414 14.763 26.197 26.197 0 0 1-15.232 34.304c-47.531 18.432-109.654 17.493-185.472-1.152-50.475-9.984-91.99-8.96-125.099-0.512-10.965 2.773-20.053 6.187-27.179 9.728l-2.09 1.11-3.67 2.133-1.962 1.365-2.39 1.28-1.706 0.768-3.03 1.067-3.968 0.768c-14.634-0.768-24.106-5.675-28.501-14.806-4.395-9.13-2.176-19.413 6.57-30.933l0.683-0.683 0.043-0.042H544l1.707-1.323 2.048-1.408 1.024-0.64c2.816-1.792 6.229-3.712 10.112-5.632a192.427 192.427 0 0 1 38.186-13.867c41.259-10.538 91.222-11.733 151.083 0.128zM195.84 561.92l17.792 7.552c5.803 5.12 8.533 11.179 8.192 18.347l-0.384 117.461a25.43 25.43 0 0 1-7.936 17.92 27.264 27.264 0 0 1-18.901 7.893c-5.035 0.171-10.795-2.261-17.238-7.381a25.643 25.643 0 0 1-8.106-18.347l0.085-118.826c0.128-6.528 3.328-12.118 8.405-17.11a23.125 23.125 0 0 1 18.091-7.509z m240.512-242.603c9.685 2.134 16.043 4.822 19.072 7.936 4.523 4.694 7.253 10.838 7.125 17.366l-2.048 360.448a25.387 25.387 0 0 1-7.978 17.92 23.381 23.381 0 0 1-18.518 6.698c-4.906-0.213-10.965-2.304-18.218-6.357a26.923 26.923 0 0 1-7.552-18.133l2.261-207.787-108.587 0.299-2.858 207.573a23.808 23.808 0 0 1-7.766 17.28 22.87 22.87 0 0 1-18.09 7.552c-4.48-0.085-10.582-2.219-18.219-6.4a22.101 22.101 0 0 1-8.15-18.347l2.39-208.341-108.544 0.299-2.432 208.341a24.021 24.021 0 0 1-8.363 17.152 22.443 22.443 0 0 1-18.346 8.107c-4.864-0.256-10.752-2.987-17.622-8.192a19.243 19.243 0 0 1-8.533-17.152l2.219-361.046a25.387 25.387 0 0 1 7.978-17.92 25.301 25.301 0 0 1 18.518-6.656c4.906 0.214 10.922 2.56 18.048 6.912 5.76 5.12 8.064 10.454 7.722 17.579l0.427 102.741 108.63-0.256 0.298-11.093c0.299-7.125 3.499-12.715 8.747-18.347a21.333 21.333 0 0 1 17.28-7.082c4.906 0.213 11.093 2.602 18.645 7.168a30.72 30.72 0 0 1 8.192 18.346l-0.939 10.88 110.422 0.299-0.171-77.013H268.288c-9.685-2.134-16.043-4.779-19.072-7.936a26.88 26.88 0 0 1-7.51-18.134 24.32 24.32 0 0 1 7.766-17.28 26.283 26.283 0 0 1 18.688-7.338z m-80.299 242.006l19.03 7.936c4.565 4.693 7.253 10.837 6.954 17.92l0.683 118.485a23.85 23.85 0 0 1-7.765 17.323 23.467 23.467 0 0 1-18.902 7.893c-4.906-0.213-10.88-2.73-17.877-7.552a22.315 22.315 0 0 1-7.936-16.939l0.128-118.869a24.576 24.576 0 0 1 7.552-18.688 29.61 29.61 0 0 1 18.133-7.51zM564.992 406.74l323.072 0.939 18.261 6.23a25.856 25.856 0 0 1 7.083 13.653l0.427 4.138-1.579 4.694 1.877 4.394 0.512 160.512-1.194 3.499 0.64 4.053a20.779 20.779 0 0 1-7.168 17.152 23.85 23.85 0 0 1-14.592 7.595l-4.267 0.17-322.304 0.555-19.03-7.765a25.728 25.728 0 0 1-7.082-13.61l-0.47-4.14 1.195-3.498-0.853-3.499V431.787c-0.256-7.168 1.707-12.971 6.57-17.28a31.104 31.104 0 0 1 14.422-7.04l4.48-0.726z m135.552 138.07l-108.8 0.853-0.17 38.57 109.78 0.129-0.81-39.552z m161.28 0.426l-109.227 0.043-0.213 38.57 109.824 0.129-0.427-38.784z m-271.019-88.746l0.256 39.381 109.184-0.085 0.384-39.168-109.824-0.086z m161.451-0.171l0.213 39.339 109.227-0.086 0.384-39.168-109.824-0.085z m135.125-157.653l19.072 7.936a26.88 26.88 0 0 1 7.552 18.133l-0.682 30.72a19.541 19.541 0 0 1-6.571 17.664 23.467 23.467 0 0 1-18.901 7.936l-18.646-7.168a21.973 21.973 0 0 1-6.912-17.92l-0.085-5.973-270.848-1.11-0.341 7.168a23.893 23.893 0 0 1-7.766 17.28 26.795 26.795 0 0 1-17.664 8.278l-19.072-7.894a23.765 23.765 0 0 1-6.912-17.962l-0.554-31.104a24.576 24.576 0 0 1 7.594-18.688 25.344 25.344 0 0 1 18.475-6.699l322.261-0.597zM187.35 309.504a32.768 32.768 0 1 1 0 65.536 32.768 32.768 0 0 1 0-65.536z" fill="#342318"></path></svg>',
                            '小红书': '<svg class="w-3.5 h-3.5" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg"><path d="M960 797.248V226.784C960 137.248 886.752 64 797.216 64H226.784C137.248 64 64 137.248 64 226.784v570.464c0 88.64 71.808 161.344 160.16 162.752h575.68c88.32-1.408 160.16-74.08 160.16-162.752" fill="#FF2442"></path><path d="M700.544 384h50.4v18.048c0 1.44 0.704 2.112 2.08 2.08 29.888-0.896 60 0.064 75.424 30.72 9.184 18.176 7.296 45.824 6.784 67.52-0.032 1.28 0.576 1.984 1.792 2.112 3.52 0.32 6.944 0.64 10.272 1.056 59.424 7.136 47.68 63.168 47.872 107.2 0.096 15.36-1.632 26.592-5.12 33.76-7.36 14.848-20.544 23.36-39.552 25.472H813.44l-18.944-43.968a1.44 1.44 0 0 1 0.096-1.344 1.376 1.376 0 0 1 1.152-0.64l40.192-0.032c2.24 0 4.352-0.96 5.888-2.624a8.896 8.896 0 0 0 2.368-6.176c-0.192-13.44-0.288-26.848-0.224-40.256 0-12.064-5.696-18.24-17.184-18.56-12.992-0.32-37.6-0.32-73.856 0.064-1.28 0-1.92 0.704-1.92 2.08l-0.192 111.456H700.48l-0.16-111.936a1.984 1.984 0 0 0-1.952-2.048h-47.04a2.24 2.24 0 0 1-2.176-2.24l0.064-48.704c0-1.632 0.768-2.464 2.304-2.464l46.496 0.096a2.208 2.208 0 0 0 1.6-0.704 2.432 2.432 0 0 0 0.64-1.664v-42.112a2.784 2.784 0 0 0-2.688-2.848l-28.704 0.128c-1.504 0-2.24-0.8-2.24-2.368l-0.096-48.96c0-1.44 0.64-2.144 2.08-2.144h29.728c1.28 0 1.92-0.64 1.92-2.016l0.32-17.984z m52.192 120.736l31.264-0.064c0.512 0 0.992-0.224 1.344-0.608a2.016 2.016 0 0 0 0.544-1.408l-0.16-39.136c0-3.072-2.24-5.568-4.96-5.568l-25.088 0.064a4.704 4.704 0 0 0-3.52 1.664 5.984 5.984 0 0 0-1.44 4l0.16 39.136c0 1.088 0.864 1.92 1.856 1.92zM429.344 508.256c-12.16 0.224-34.144 3.616-38.944-12.032-2.912-9.344 3.68-22.368 7.68-31.488 11.392-25.952 22.56-52 33.536-78.144 0.448-1.056 1.216-1.6 2.304-1.6h48.096c0.416 0 0.768 0.224 0.96 0.576a1.28 1.28 0 0 1 0.128 1.152l-27.84 65.056c-0.64 1.504-0.48 3.2 0.352 4.608a4.544 4.544 0 0 0 3.84 2.176h41.216c0.512 0 0.96 0.256 1.248 0.672 0.256 0.448 0.32 0.96 0.096 1.44-11.904 27.744-23.776 55.296-35.616 82.656-1.184 2.72-1.696 4.736-1.504 6.016 0.416 2.784 1.984 4.192 4.672 4.224l26.08 0.16c1.504 0.032 1.984 0.768 1.376 2.24l-16.864 39.68a3.328 3.328 0 0 1-3.2 2.208c-26.496 0.32-45.024 0.32-55.584-0.16-17.472-0.8-21.76-16.096-14.976-31.872l23.968-55.936a1.216 1.216 0 0 0-0.096-1.088 1.088 1.088 0 0 0-0.96-0.544zM229.504 671.968h-18.88l-18.496-43.424a1.408 1.408 0 0 1 0.096-1.312 1.28 1.28 0 0 1 1.088-0.64l26.112-0.064a6.112 6.112 0 0 0 5.984-6.24l0.704-230.304a2.24 2.24 0 0 1 2.208-2.304h44.928c2.112 0 3.168 1.12 3.2 3.328 0.192 77.984 0.192 154.624 0 229.952-0.128 30.912-14.464 52.032-46.944 51.008z" fill="#FFFFFF"></path><path d="M650.944 671.968h-170.432l22.848-51.52a3.04 3.04 0 0 1 2.976-1.952l41.728 0.064c1.472 0 2.24-0.736 2.24-2.24v-156.32c0-1.344-0.64-2.016-1.92-2.016l-27.68-0.032c-1.248 0-2.24-1.088-2.24-2.4v-50.144c0-0.768 0.576-1.408 1.312-1.408h112.832c1.408 0 2.08 0.736 2.08 2.208l0.064 49.6c0 1.44-0.704 2.176-2.112 2.176h-27.904c-1.28 0-1.92 0.672-1.92 2.016v156.224c0 1.504 0.736 2.24 2.144 2.24l44.224 0.096c1.216 0 1.824 0.64 1.824 1.92L650.944 672zM853.92 408.864c34.816-23.936 59.328 37.088 21.184 47.552-6.208 1.728-16.096 1.824-29.632 0.32-1.216-0.128-1.792-0.8-1.792-2.08-0.192-14.4-3.04-36.672 10.24-45.76zM373.312 588.288l-23.04 53.664c-2.08 4.8-4.352 4.896-6.88 0.384-16.96-30.656-22.72-55.68-26.048-93.792-2.56-29.6-4.768-59.2-6.688-88.864-0.064-1.344 0.544-2.016 1.824-2.016l46.688 0.032c1.312 0 2.048 0.704 2.144 2.048 2.4 34.496 4.928 68.896 7.552 103.2 0.672 8.832 2.176 16.16 4.48 21.984a4.16 4.16 0 0 1-0.032 3.36zM128 586.304v-2.208a22.592 22.592 0 0 0 4.16-10.112c3.456-38.08 6.272-76.128 8.48-114.208 0.096-1.184 0.672-1.792 1.792-1.792h47.68c0.416 0 0.832 0.192 1.152 0.544 0.288 0.32 0.448 0.768 0.416 1.216a6351.04 6351.04 0 0 1-8.416 105.184c-2.24 25.44-10.368 59.488-27.36 80.128-1.088 1.312-2.016 1.184-2.72-0.416L128 586.304zM453.184 671.968h-69.056l-8.8-3.488c-1.248-0.48-1.6-1.344-1.024-2.592l21.664-49.6c0.64-1.44 1.664-1.984 3.136-1.6 23.68 6.432 51.104 3.776 75.328 3.872 1.504 0.032 1.92 0.768 1.28 2.176l-22.528 51.2z" fill="#FFFFFF"></path></svg>',
                            '抖音': '<svg class="w-3.5 h-3.5" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg"><path d="M855.52032 0H165.44032A165.696 165.696 0 0 0 0.00032 165.92v689.376a165.696 165.696 0 0 0 165.344 166.016h690.272a165.696 165.696 0 0 0 165.408-165.984V166.016A165.76 165.76 0 0 0 855.52032 0z" fill="#170B1A"></path><path d="M511.42432 302.08c0.576-64.32 0-128.576 0.576-192.832h131.392c-0.576 11.328 1.152 22.72 2.88 33.6h-96.704v522.24a124.8 124.8 0 0 1-16 63.68 107.84 107.84 0 0 1-83.008 52.864 111.424 111.424 0 0 1-63.168-13.12 108.416 108.416 0 0 1-36.928-32.96c33.536 18.816 77.312 17.088 109.76-3.968A111.68 111.68 0 0 0 512.00032 638.272c-0.576-112.064-0.576-224.128-0.576-336.192z m216.768-36.992c18.176 11.392 38.656 20.48 59.712 25.024 12.544 2.88 25.024 4.032 38.08 4.032v29.568a187.36 187.36 0 0 1-97.792-58.56v-0.064z" fill="#25F4EE"></path><path d="M274.75232 428.928a238.016 238.016 0 0 1 159.36-33.6v31.36c-14.72 0.576-29.376 2.272-43.84 5.12a249.44 249.44 0 0 0-97.92 43.84c-31.232 23.296-55.104 55.104-71.68 90.368a243.424 243.424 0 0 0-23.296 108.16c0 40.96 11.392 80.768 30.72 116.608 9.152 16.448 19.392 32.384 33.024 45.44a233.44 233.44 0 0 1-68.288-75.072 246.24 246.24 0 0 1-33.6-131.392 250.144 250.144 0 0 1 35.904-120 240.352 240.352 0 0 1 79.616-80.832z" fill="#25F4EE"></path><path d="M549.56832 142.784h97.28c3.392 18.752 10.24 36.416 18.752 53.504 13.632 26.176 33.024 49.472 58.048 64.832 1.664 1.152 2.88 2.304 3.968 3.968a186.688 186.688 0 0 0 98.432 58.56c0.576 34.176 0 68.864 0 103.04a308.16 308.16 0 0 1-180.928-57.472c0 81.92 0 163.84 0.576 245.76 0 10.816 0.576 21.632 0 32.96a268.8 268.8 0 0 1-35.264 113.792 247.392 247.392 0 0 1-68.288 77.44 219.296 219.296 0 0 1-124.608 42.56c-22.72 0.64-45.44-0.512-67.648-5.632a243.52 243.52 0 0 1-87.04-38.08l-1.728-1.728a202.464 202.464 0 0 1-33.024-45.504 244.32 244.32 0 0 1-30.72-116.672 245.6 245.6 0 0 1 23.36-108.096c16.512-35.2 40.96-67.072 71.68-90.432a249.44 249.44 0 0 1 141.632-48.896c0.576 13.12 0 26.176 0.576 38.656v66.56a94.176 94.176 0 0 0-51.776-1.728 128.32 128.32 0 0 0-55.68 27.328c-9.824 8.448-17.952 18.688-23.936 30.144a112.16 112.16 0 0 0-11.392 63.744c2.432 21.216 11.168 41.216 25.024 57.472 9.088 11.328 21.056 19.904 33.024 27.84 9.664 13.632 22.144 25.024 36.928 33.024 19.392 10.24 41.536 14.72 63.168 13.12 34.112-2.304 65.984-23.36 83.072-52.992a124.8 124.8 0 0 0 15.936-63.68c1.152-175.232 0.576-349.312 0.576-523.392z" fill="#FFFFFF"></path><path d="M646.84832 142.784c11.328 0.576 22.72 0 34.688 0 0 38.08 11.968 76.224 34.112 107.52 2.88 3.968 5.76 7.36 8.576 10.816-25.088-15.36-44.992-38.656-58.048-64.832a214.208 214.208 0 0 1-19.328-53.504z m179.2 180.928c12.48 2.88 24.96 3.968 38.08 3.968v132.544c-64.832 0.576-129.664-21.056-182.592-59.136v262.784a229.76 229.76 0 0 1-5.696 59.2 244.32 244.32 0 0 1-96.704 147.328c-25.92 18.56-55.36 31.744-86.464 38.656a240.448 240.448 0 0 1-113.792-1.664 239.776 239.776 0 0 1-115.52-69.44 234.016 234.016 0 0 0 87.104 38.08c22.144 5.184 44.928 6.336 67.648 5.76a219.296 219.296 0 0 0 124.608-42.688 254.784 254.784 0 0 0 68.288-77.376 269.024 269.024 0 0 0 35.2-113.792 319.072 319.072 0 0 0 0-32.96c-0.512-81.92-0.512-163.84-0.512-245.76a308.16 308.16 0 0 0 180.928 57.472c-0.576-34.176 0-68.8-0.576-102.976z" fill="#FE2C55"></path><path d="M434.62432 426.112c12.544 0 25.6 0.576 38.08 2.24v136a103.872 103.872 0 0 0-57.408-2.304c-35.84 8-65.984 35.264-78.528 70.016-12.48 34.112-7.36 73.92 14.208 102.912a119.552 119.552 0 0 1-32.96-27.84 107.328 107.328 0 0 1-25.024-57.472 112.16 112.16 0 0 1 11.392-63.68c5.632-11.392 14.208-21.632 23.872-30.208 15.936-13.632 35.84-22.144 55.744-27.264a94.176 94.176 0 0 1 51.776 1.664V463.68c-1.152-11.36-0.576-24.48-1.152-37.536v-0.032z" fill="#FE2C55"></path></svg>',
                            '微信': '<svg class="w-3.5 h-3.5" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg"><path d="M503.552 406.95808c16.89088 0 27.648-10.84928 27.648-27.13088 0-17.05472-10.75712-27.13088-27.648-27.13088-16.128 0-31.488 10.07616-31.488 27.13088 0 16.28672 15.36 27.13088 31.488 27.13088zM351.48288 352.69632c-16.12288 0-33.024 10.07616-33.024 27.13088 0 16.2816 16.896 27.136 33.024 27.136 15.36 0 27.648-10.8544 27.648-27.136 0.00512-17.05472-12.28288-27.13088-27.648-27.13088zM574.20288 511.616c-10.752 0-21.504 10.07104-21.504 22.48192 0 10.07104 10.752 20.1472 21.504 20.1472 16.128 0 27.648-10.07616 27.648-20.1472 0.00512-12.40576-11.51488-22.48192-27.648-22.48192zM694.77888 511.616c-11.51488 0-21.504 10.07104-21.504 22.48192 0 10.07104 9.984 20.1472 21.504 20.1472 15.36 0 26.88512-10.07616 26.88512-20.1472 0-12.40576-11.52512-22.48192-26.88512-22.48192z" fill="#2AAE67"></path><path d="M849.92 51.2H174.08c-67.8656 0-122.88 55.0144-122.88 122.88v675.84c0 67.8656 55.0144 122.88 122.88 122.88h675.84c67.8656 0 122.88-55.0144 122.88-122.88V174.08c0-67.8656-55.0144-122.88-122.88-122.88zM422.912 632.54016c-28.416 0-49.15712-4.64896-76.03712-12.40576l-77.568 39.54176 22.27712-66.66752C237.06112 554.25536 204.8 505.41056 204.8 445.7216c0-105.42592 98.304-186.04032 218.112-186.04032 105.984 0 200.45312 63.5648 218.88 153.49248-7.68-1.55648-14.592-2.3296-20.736-2.3296-104.44288 0-185.08288 79.06816-185.08288 174.4128 0 16.27648 2.304 31.00672 6.144 46.5152-6.144 0.768-13.06112 0.768-19.20512 0.768z m320.25088 75.96544l15.36 55.81312-58.368-33.3312c-22.26688 4.64896-43.776 11.62752-66.04288 11.62752-102.912 0-184.32-71.31648-184.32-159.68256s81.408-159.68768 184.32-159.68768c97.536 0 185.088 71.31648 185.088 159.68768 0 49.60768-33.024 93.78816-76.03712 125.57312z" fill="#2AAE67"></path></svg>',
                            '淘宝': '<svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"/></svg>',
                            '朋友推荐': '<svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/></svg>'
                        };

                        // 生成带图标的客户来源 HTML
                        function renderSourceWithIcon(source) {
                            if (!source) return '<span class="px-2 py-0.5 bg-gray-50 text-gray-500 border border-gray-100 rounded text-xs inline-flex items-center gap-1">-</span>';
                            var colorClass = SOURCE_COLORS[source] || 'bg-gray-50 text-gray-500';
                            var iconHtml = SOURCE_ICONS[source] || '<div class="w-1.5 h-1.5 rounded-full" style="background:currentColor"></div>';
                            return '<span class="px-2 py-0.5 ' + colorClass + ' border border-gray-100 rounded text-xs inline-flex items-center gap-1">' + iconHtml + ' ' + escapeAttr(source) + '</span>';
                        }

                        // 生成详情页带图标的客户来源 HTML
                        function renderDetailSourceWithIcon(source) {
                            if (!source) return '<span class="text-gray-700">-</span>';
                            var iconHtml = SOURCE_ICONS[source] || '';
                            if (iconHtml) {
                                return '<span class="inline-flex items-center gap-1 text-gray-700">' + iconHtml + ' ' + escapeAttr(source) + '</span>';
                            }
                            return '<span class="text-gray-700">' + escapeAttr(source) + '</span>';
                        }

                        var FOLLOW_STATUS_COLOR = {
                            '跟进中': 'text-green-500',
                            '已成交': 'text-blue-500',
                            '待跟进': 'text-orange-500',
                            '已流失': 'text-gray-400'
                        };

                        var TYPE_STYLES = {
                            '成交客户': 'bg-blue-50 text-blue-600 border-blue-100',
                            '潜在客户': 'bg-orange-50 text-orange-500 border-orange-100',
                            '流失客户': 'bg-gray-100 text-gray-500 border-gray-200',
                            '黑名单': 'bg-red-50 text-red-500 border-red-100'
                        };

                        // ========== 工具函数 ==========
                        function escapeAttr(s) {
                            return String(s || '').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
                        }
                        function escapeHtml(s) {
                            return String(s || '').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/&/g, '&amp;');
                        }

                        function customerAvatarDataUrl(name) {
                            var label = String(name || '客').trim().charAt(0) || '客';
                            var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96">' +
                                '<rect width="96" height="96" rx="48" fill="#e0e7ff"/>' +
                                '<text x="50%" y="50%" dy=".08em" text-anchor="middle" dominant-baseline="middle" ' +
                                'font-family="Inter, system-ui, sans-serif" font-size="38" font-weight="700" fill="#4f46e5">' +
                                escapeHtml(label) + '</text></svg>';
                            return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
                        }

                        function normalizeCustomerAvatar(src, name) {
                            if (src && src.indexOf('ui-avatars.com') === -1) return src;
                            return customerAvatarDataUrl(name);
                        }

                        // ========== API 加载 ==========
                        function loadCustomers() {
                            var params = new URLSearchParams();
                            if (currentFilter.keyword) params.append('keyword', currentFilter.keyword);
                            if (currentFilter.source) params.append('source', currentFilter.source);
                            if (currentFilter.level) params.append('level', currentFilter.level);
                            if (currentFilter.type) params.append('type', currentFilter.type);

                            var url = '/api/customers';
                            var qs = params.toString();
                            if (qs) url += '?' + qs;

                            return fetch(url)
                                .then(function (r) { return r.json(); })
                                .then(function (res) {
                                    if (res.success) {
                                        customerCache = res.data || [];
                                        customerMap = {};
                                        customerCache.forEach(function (c) { customerMap[c.id] = c; });
                                        renderTable();
                                        renderPagination();
                                        renderSummary();
                                        // 默认选中第一个客户；刷新后优先保留当前客户
                                        if (customerCache.length > 0) {
                                            var nextId = selectedCustomerId && customerMap[selectedCustomerId]
                                                ? selectedCustomerId
                                                : customerCache[0].id;
                                            selectCustomer(nextId);
                                        } else {
                                            selectedCustomerId = null;
                                            detailOrders = [];
                                            detailFollows = [];
                                            renderOrdersList([]);
                                            renderFollowList([]);
                                            renderEmptyDetailPanel();
                                        }
                                    }
                                })
                                .catch(function (err) {
                                    console.error('加载客户列表失败:', err);
                                    customerCache = [];
                                    customerMap = {};
                                    renderTable();
                                    renderPagination();
                                    renderSummary();
                                    renderEmptyDetailPanel('客户数据加载失败，请检查后端服务是否启动。');
                                });
                        }

                        // ========== 渲染摘要卡片 ==========
                        function renderSummary() {
                            var all = customerCache;
                            var total = all.length;
                            var dealt = all.filter(function (c) { return c.type === '成交客户'; }).length;
                            var potential = all.filter(function (c) { return c.type === '潜在客户'; }).length;
                            var highValue = all.filter(function (c) { return c.level && c.level.charAt(0) === 'A'; }).length;
                            var lost = all.filter(function (c) { return c.type === '流失客户'; }).length;
                            var repurchase = all.filter(function (c) { return c.tags && c.tags.indexOf('复购客户') !== -1; }).length;

                            var cards = [
                                { label: '全部客户', value: total, icon: 'ph-users', bg: 'bg-blue-50 text-blue-500', border: 'border-blue-100' },
                                { label: '成交客户', value: dealt, icon: 'ph-check-circle', bg: 'bg-blue-50 text-blue-500', border: 'border-blue-100' },
                                { label: '潜在客户', value: potential, icon: 'ph-user-plus', bg: 'bg-green-50 text-green-500', border: 'border-green-100' },
                                { label: '高价值客户', value: highValue, icon: 'ph-crown', bg: 'bg-yellow-50 text-yellow-500', border: 'border-yellow-100' },
                                { label: '复购客户', value: repurchase, icon: 'ph-users-three', bg: 'bg-purple-50 text-purple-500', border: 'border-purple-100' },
                                { label: '流失客户', value: lost, icon: 'ph-clock', bg: 'bg-red-50 text-red-500', border: 'border-red-100' }
                            ];

                            var html = cards.map(function (c) {
                                return '<div class="min-w-[180px] rounded-xl border ' + c.border + ' bg-white p-4 relative shadow-sm flex-1">' +
                                    '<div class="flex justify-between items-start mb-2">' +
                                    '<p class="text-gray-500 text-xs">' + c.label + '</p>' +
                                    '<div class="w-8 h-8 rounded-full ' + c.bg + ' flex items-center justify-center">' +
                                    '<i class="ph-fill ' + c.icon + ' text-lg"></i></div></div>' +
                                    '<h3 class="text-2xl font-bold text-gray-800 mb-1">' + c.value + '</h3>' +
                                    '</div>';
                            }).join('');

                            var container = document.getElementById('summary-cards');
                            if (container) container.innerHTML = html;
                        }

                        // ========== 渲染表格 ==========
                        function renderTable() {
                            var tbody = document.getElementById('customer-tbody');
                            if (!tbody) return;

                            var pageList = getCurrentPageList();

                            if (customerCache.length === 0) {
                                tbody.innerHTML = '<tr><td colspan="8" class="py-12 text-center text-gray-400"><i class="ph ph-users text-3xl mb-2 block"></i>暂无客户数据</td></tr>';
                                return;
                            }

                            tbody.innerHTML = pageList.map(function (c, idx) {
                                var typeStyle = TYPE_STYLES[c.type] || 'bg-gray-50 text-gray-500 border-gray-100';
                                var isLost = c.type === '流失客户';
                                var rowClass = isLost ? 'border-b border-gray-50 hover:bg-gray-50/80 transition-colors text-gray-500 cursor-pointer' : 'border-b border-gray-50 hover:bg-gray-50/80 transition-colors cursor-pointer';
                                var opacityCls = isLost ? 'opacity-70' : '';
                                var selectedCls = c.id === selectedCustomerId ? ' bg-brand-50/30' : '';

                                var tagsHtml = (c.tags || []).slice(0, 2).map(function (t) {
                                    return '<span class="text-[10px] text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">' + escapeAttr(t) + '</span>';
                                }).join('');

                                var avatar = normalizeCustomerAvatar(c.avatar, c.name);
                                var avatarCls = isLost ? 'w-8 h-8 rounded-full grayscale' : 'w-10 h-10 rounded-full';

                                return '<tr class="' + rowClass + selectedCls + '" data-cid="' + c.id + '">' +
                                    '<td class="py-4 px-2 ' + opacityCls + '">' +
                                    '<div class="flex items-center gap-3">' +
                                    '<img src="' + escapeAttr(avatar) + '" alt="Avatar" class="' + avatarCls + '">' +
                                    '<div><div class="flex items-center gap-2">' +
                                    '<span class="font-medium text-gray-900">' + escapeAttr(c.name) + '</span>' +
                                    '<span class="px-1.5 py-0.5 rounded text-[10px] font-medium border ' + typeStyle + '">' + escapeAttr(c.type || '') + '</span>' +
                                    '</div><p class="text-xs text-gray-500 mt-0.5">' + escapeAttr(c.desc || '') + '</p></div></div></td>' +
                                    '<td class="py-4 px-2 ' + opacityCls + '"><div class="flex items-center gap-1.5"><span>' + escapeAttr(c.phone || '') + '</span><i class="ph-fill ph-wechat-logo text-green-500 text-sm"></i></div></td>' +
                                    '<td class="py-4 px-2 ' + opacityCls + '">' + renderSourceWithIcon(c.source) + '</td>' +
                                    '<td class="py-4 px-2 ' + opacityCls + ' font-medium">' + escapeAttr(c.amount || '-') + '</td>' +
                                    '<td class="py-4 px-2 ' + opacityCls + ' text-center text-gray-600">' + (c.orderCount || 0) + '</td>' +
                                    '<td class="py-4 px-2 ' + opacityCls + '"><div class="flex gap-1 flex-wrap">' + tagsHtml + '</div></td>' +
                                    '<td class="py-4 px-2 ' + opacityCls + ' whitespace-nowrap"><p class="text-gray-800 text-xs">' + escapeAttr(c.followTime || '') + '</p></td>' +
                                    '<td class="py-4 px-4 text-center"><div class="flex items-center justify-center gap-2">' +
                                    '<button class="cust-view-btn w-7 h-7 rounded border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-100 hover:text-gray-800 transition" data-cid="' + c.id + '"><i class="ph ph-eye"></i></button>' +
                                    '<button class="cust-more-btn w-7 h-7 rounded border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-100 hover:text-gray-800 transition relative" data-cid="' + c.id + '"><i class="ph ph-dots-three"></i></button>' +
                                    '</div></td>' +
                                    '</tr>';
                            }).join('');

                            // 绑定按钮事件
                            tbody.querySelectorAll('.cust-view-btn').forEach(function (btn) {
                                btn.addEventListener('click', function (e) {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    selectCustomer(btn.dataset.cid);
                                });
                            });
                            tbody.querySelectorAll('.cust-more-btn').forEach(function (btn) {
                                btn.addEventListener('click', function (e) {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    if (currentDropdown) { closeMenu(); return; }
                                    showMenu(btn);
                                });
                            });
                            // 行点击也选中
                            tbody.querySelectorAll('tr[data-cid]').forEach(function (tr) {
                                tr.addEventListener('click', function () {
                                    selectCustomer(tr.dataset.cid);
                                });
                            });
                        }

                        // ========== 渲染分页 ==========
                        function renderPagination() {
                            var container = document.getElementById('cust-pagination-btns');
                            var info = document.getElementById('cust-pagination-info');
                            if (!container || !info) return;

                            var total = customerCache.length;
                            var page = pagination.page;
                            var pageSize = pagination.pageSize;
                            var totalPages = Math.ceil(total / pageSize) || 1;

                            info.textContent = '共 ' + total + ' 条';

                            var html = '';
                            // 上一页
                            html += '<button class="cust-page-prev w-8 h-8 rounded flex items-center justify-center border border-gray-200 hover:bg-gray-50 ' + (page <= 1 ? 'opacity-40 pointer-events-none' : '') + '"><i class="ph ph-caret-left"></i></button>';

                            // 页码按钮
                            var maxVisible = 5;
                            var startPage = Math.max(1, page - 2);
                            var endPage = Math.min(totalPages, startPage + maxVisible - 1);
                            if (endPage - startPage < maxVisible - 1) startPage = Math.max(1, endPage - maxVisible + 1);

                            for (var i = startPage; i <= endPage; i++) {
                                if (i === page) {
                                    html += '<button class="cust-page-btn w-8 h-8 rounded flex items-center justify-center border border-brand-500 bg-brand-50 text-brand-600 font-medium" data-page="' + i + '">' + i + '</button>';
                                } else {
                                    html += '<button class="cust-page-btn w-8 h-8 rounded flex items-center justify-center hover:bg-gray-50" data-page="' + i + '">' + i + '</button>';
                                }
                            }

                            if (endPage < totalPages) {
                                html += '<span>...</span>';
                                html += '<button class="cust-page-btn w-8 h-8 rounded flex items-center justify-center hover:bg-gray-50" data-page="' + totalPages + '">' + totalPages + '</button>';
                            }

                            // 下一页
                            html += '<button class="cust-page-next w-8 h-8 rounded flex items-center justify-center border border-gray-200 hover:bg-gray-50 ' + (page >= totalPages ? 'opacity-40 pointer-events-none' : '') + '"><i class="ph ph-caret-right"></i></button>';

                            // 每页条数
                            html += '<select id="cust-page-size" class="ml-2 border border-gray-200 rounded px-2 py-1 bg-white outline-none">';
                            [10, 20, 50].forEach(function (s) {
                                html += '<option value="' + s + '"' + (s === pageSize ? ' selected' : '') + '>' + s + '条/页</option>';
                            });
                            html += '</select>';

                            container.innerHTML = html;

                            // 绑定分页事件
                            container.querySelectorAll('.cust-page-btn').forEach(function (btn) {
                                btn.addEventListener('click', function () {
                                    pagination.page = parseInt(btn.getAttribute('data-page'));
                                    renderTable();
                                    renderPagination();
                                    var pl = getCurrentPageList();
                                    if (pl.length > 0) selectCustomer(pl[0].id);
                                });
                            });
                            var prevBtn = container.querySelector('.cust-page-prev');
                            if (prevBtn) prevBtn.addEventListener('click', function () {
                                if (pagination.page > 1) {
                                    pagination.page--;
                                    renderTable();
                                    renderPagination();
                                    var pl = getCurrentPageList();
                                    if (pl.length > 0) selectCustomer(pl[0].id);
                                }
                            });
                            var nextBtn = container.querySelector('.cust-page-next');
                            if (nextBtn) nextBtn.addEventListener('click', function () {
                                var tp = Math.ceil(customerCache.length / pagination.pageSize) || 1;
                                if (pagination.page < tp) {
                                    pagination.page++;
                                    renderTable();
                                    renderPagination();
                                    var pl = getCurrentPageList();
                                    if (pl.length > 0) selectCustomer(pl[0].id);
                                }
                            });
                            var sizeSel = document.getElementById('cust-page-size');
                            if (sizeSel) sizeSel.addEventListener('change', function () {
                                pagination.pageSize = parseInt(sizeSel.value);
                                pagination.page = 1;
                                renderTable();
                                renderPagination();
                                var pl = getCurrentPageList();
                                if (pl.length > 0) selectCustomer(pl[0].id);
                            });
                        }

                        // ========== 详情 Tab / 订单 / 跟进 ==========
                        function switchDetailTab(tab) {
                            currentDetailTab = tab || 'basic';
                            document.querySelectorAll('.detail-tab').forEach(function (btn) {
                                var active = btn.dataset.tab === currentDetailTab;
                                var base = 'detail-tab pb-2 border-b-2 text-sm transition-colors ';
                                if (btn.dataset.tab !== 'notes') base += 'mr-6 ';
                                btn.className = active
                                    ? base + 'border-brand-600 text-brand-600 font-medium'
                                    : base + 'border-transparent text-gray-500 hover:text-gray-800';
                            });
                            document.querySelectorAll('.detail-panel').forEach(function (panel) {
                                if (panel.dataset.panel === currentDetailTab) panel.classList.remove('hidden');
                                else panel.classList.add('hidden');
                            });
                        }

                        var ORDER_STATUS_LABEL = {
                            pending: '待确认', processing: '进行中', acceptance: '待验收',
                            completed: '已完成', closed: '已关闭', cancelled: '已取消'
                        };

                        function formatMoneyNum(n) {
                            return '¥ ' + Math.round(parseFloat(n) || 0).toLocaleString('zh-CN');
                        }

                        function formatFollowTime(iso) {
                            if (!iso) return '';
                            var d = new Date(iso);
                            if (isNaN(d.getTime())) return iso;
                            var pad = function (x) { return String(x).padStart(2, '0'); };
                            return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) +
                                ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
                        }

                        function renderFollowList(list) {
                            var box = document.getElementById('detail-follow-list');
                            if (!box) return;
                            if (!list || !list.length) {
                                box.innerHTML = '<div class="py-8 text-center text-gray-400 text-sm"><i class="ph ph-notebook text-2xl block mb-2"></i>暂无跟进记录</div>';
                                return;
                            }
                            box.innerHTML = list.map(function (f) {
                                return '<div class="relative pl-4 border-l-2 border-brand-100">' +
                                    '<div class="absolute -left-[5px] top-1.5 w-2 h-2 rounded-full bg-brand-500"></div>' +
                                    '<p class="text-[11px] text-gray-400 mb-1">' + escapeAttr(formatFollowTime(f.createdAt)) +
                                    (f.author ? ' · ' + escapeAttr(f.author) : '') + '</p>' +
                                    '<p class="text-sm text-gray-700 leading-relaxed bg-white border border-gray-100 rounded-lg px-3 py-2">' +
                                    escapeAttr(f.content || '') + '</p></div>';
                            }).join('');
                        }

                        function renderOrdersList(list) {
                            var box = document.getElementById('detail-orders-list');
                            var summary = document.getElementById('detail-orders-summary');
                            if (summary) {
                                var paidSum = (list || []).reduce(function (s, o) { return s + (o.paidAmount || 0); }, 0);
                                summary.textContent = '共 ' + ((list && list.length) || 0) + ' 单 · 已收 ' + formatMoneyNum(paidSum);
                            }
                            if (!box) return;
                            if (!list || !list.length) {
                                box.innerHTML = '<div class="py-8 text-center text-gray-400 text-sm"><i class="ph ph-receipt text-2xl block mb-2"></i>暂无关联订单<br><span class="text-xs">订单「客户昵称」与客户姓名一致即可自动关联</span></div>';
                                return;
                            }
                            box.innerHTML = list.map(function (o) {
                                var statusText = ORDER_STATUS_LABEL[o.orderStatus] || o.orderStatus || '-';
                                return '<div class="border border-gray-100 rounded-lg p-3 hover:border-brand-200 hover:bg-brand-50/30 transition-colors">' +
                                    '<div class="flex items-start justify-between gap-2 mb-1.5">' +
                                    '<div class="min-w-0"><p class="text-sm font-medium text-gray-800 truncate">' + escapeAttr(o.projectName || '未命名项目') + '</p>' +
                                    '<p class="text-[11px] text-gray-400 mt-0.5">' + escapeAttr(o.orderNo || '') +
                                    (o.projectType ? ' · ' + escapeAttr(o.projectType) : '') + '</p></div>' +
                                    '<span class="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 flex-shrink-0">' + escapeAttr(statusText) + '</span></div>' +
                                    '<div class="flex items-center justify-between text-xs mt-2">' +
                                    '<span class="text-gray-500">' + escapeAttr(o.orderDate || '--') + '</span>' +
                                    '<span class="text-gray-500">' + escapeAttr(o.paymentStatus || '') +
                                    (o.paymentStatus === '部分付款' && o.paymentRatio ? ' ' + o.paymentRatio + '%' : '') + '</span>' +
                                    '<span class="font-semibold text-gray-800">' + formatMoneyNum(o.paidAmount) +
                                    '<span class="text-gray-400 font-normal text-[10px] ml-1">/ ' + formatMoneyNum(o.amount) + '</span></span></div>' +
                                    '<div class="mt-2 flex justify-end">' +
                                    '<button type="button" class="cust-order-open-btn px-2.5 py-1 text-[11px] rounded-md border border-brand-100 text-brand-600 bg-white hover:bg-brand-50 transition" data-order-id="' + escapeAttr(o.id || '') + '">查看 / 编辑订单</button>' +
                                    '</div></div>';
                            }).join('');
                            box.querySelectorAll('.cust-order-open-btn').forEach(function (btn) {
                                btn.addEventListener('click', function (e) {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    openRelatedOrder(btn.getAttribute('data-order-id'));
                                });
                            });
                        }

                        function openRelatedOrder(orderId) {
                            if (!orderId) return;
                            if (typeof window.openOrderForm !== 'function') {
                                showToast('订单表单组件未加载');
                                return;
                            }
                            fetch('/api/orders/' + encodeURIComponent(orderId))
                                .then(function (r) { return r.json(); })
                                .then(function (res) {
                                    if (!res.success || !res.data) {
                                        showToast(res.error || '订单不存在');
                                        return;
                                    }
                                    window.openOrderForm(res.data);
                                })
                                .catch(function (err) {
                                    console.error('打开关联订单失败:', err);
                                    showToast('打开订单失败');
                                });
                        }

                        function openNewOrderForSelectedCustomer() {
                            if (!selectedCustomerId) {
                                showToast('请先选择客户');
                                return;
                            }
                            if (typeof window.openOrderForm !== 'function') {
                                showToast('订单表单组件未加载');
                                return;
                            }
                            var c = customerMap[selectedCustomerId];
                            if (!c) return;
                            window.openOrderForm({
                                customerId: c.id,
                                customerNick: c.name || '',
                                customerName: c.name || '',
                                customerPhone: c.phone || '',
                                customerSource: c.source || '闲鱼',
                                customerTags: Array.isArray(c.tags) ? c.tags.slice() : [],
                                projectDesc: c.desc || ''
                            }, { mode: 'create' });
                        }

                        // ========== 选中客户 -> 更新详情面板 ==========
                        function selectCustomer(id) {
                            selectedCustomerId = id;
                            var c = customerMap[id];
                            if (!c) {
                                renderEmptyDetailPanel();
                                return;
                            }

                            document.querySelectorAll('#customer-tbody tr').forEach(function (tr) {
                                if (tr.dataset.cid === id) tr.classList.add('bg-brand-50/30');
                                else tr.classList.remove('bg-brand-50/30');
                            });

                            updateDetailPanel(c);
                            loadCustomerDetail(id);
                        }

                        function renderEmptyDetailPanel(message) {
                            selectedCustomerId = null;
                            var set = function (id, text) {
                                var el = document.getElementById(id);
                                if (el) el.textContent = text;
                            };

                            set('detail-name', '暂无客户数据');
                            set('detail-phone', '创建客户后这里会显示联系方式');
                            set('detail-addtime', '—');
                            set('detail-amount', '—');
                            set('detail-orders', '0 单');
                            set('detail-firstdeal', '—');
                            set('detail-status', '未选择');
                            set('detail-followstatus', '—');
                            set('detail-level-grid', '—');
                            set('detail-level', '—');
                            set('detail-type', '—');
                            set('detail-desc', message || '暂无客户数据，新增客户后这里会显示基本信息、跟进记录、订单记录和备注。');

                            var sourceEl = document.getElementById('detail-source');
                            if (sourceEl) sourceEl.textContent = '—';

                            var avatar = document.getElementById('detail-avatar');
                            if (avatar) avatar.src = customerAvatarDataUrl('客');

                            var fsEl = document.getElementById('detail-followstatus');
                            if (fsEl) fsEl.className = 'text-sm font-medium text-gray-400';

                            var statusEl = document.getElementById('detail-status');
                            if (statusEl) statusEl.className = 'text-sm font-medium text-gray-400';

                            var typeEl = document.getElementById('detail-type');
                            if (typeEl) typeEl.className = 'px-1.5 py-0.5 rounded text-[10px] font-medium bg-gray-50 text-gray-400 border border-gray-100';
                            var levelEl = document.getElementById('detail-level');
                            if (levelEl) levelEl.className = 'px-1.5 py-0.5 rounded text-[10px] font-medium bg-gray-50 text-gray-400 border border-gray-100';

                            var tagsEl = document.getElementById('detail-tags');
                            if (tagsEl) tagsEl.innerHTML = '<span class="text-xs text-gray-400">暂无标签</span>';

                            var notesInput = document.getElementById('detail-notes-input');
                            if (notesInput) notesInput.value = '';

                            detailOrders = [];
                            detailFollows = [];
                            renderOrdersList([]);
                            renderFollowList([]);
                            switchDetailTab('basic');
                        }

                        function updateDetailPanel(c) {
                            if (!c) {
                                renderEmptyDetailPanel();
                                return;
                            }
                            var set = function (id, text) {
                                var el = document.getElementById(id);
                                if (el) el.textContent = text;
                            };

                            set('detail-name', c.name || '');
                            set('detail-phone', c.phone || '');
                            var detailSourceEl = document.getElementById('detail-source');
                            if (detailSourceEl) detailSourceEl.innerHTML = renderDetailSourceWithIcon(c.source);
                            set('detail-addtime', c.addTime || '');
                            set('detail-amount', c.totalAmount || c.amount || '-');
                            set('detail-orders', (c.orderCount || 0) + ' 单');
                            set('detail-firstdeal', c.firstDeal || '—');
                            set('detail-status', c.status || '正常');
                            set('detail-followstatus', c.followStatus || '');
                            set('detail-level-grid', c.level || '');
                            set('detail-level', c.level || '');
                            set('detail-type', c.type || '');
                            set('detail-desc', c.desc || '暂无需求描述');

                            var avatar = document.getElementById('detail-avatar');
                            if (avatar) {
                                avatar.src = normalizeCustomerAvatar(c.avatar, c.name);
                            }

                            var fsEl = document.getElementById('detail-followstatus');
                            if (fsEl) {
                                fsEl.className = 'text-sm font-medium ' + (FOLLOW_STATUS_COLOR[c.followStatus] || 'text-gray-500');
                            }

                            var statusEl = document.getElementById('detail-status');
                            if (statusEl) {
                                statusEl.className = 'text-sm font-medium ' + (c.status === '已流失' ? 'text-gray-400' : 'text-green-500');
                            }

                            var typeEl = document.getElementById('detail-type');
                            if (typeEl) {
                                typeEl.className = 'px-1.5 py-0.5 rounded text-[10px] font-medium border ' + (TYPE_STYLES[c.type] || 'bg-gray-50 text-gray-500 border-gray-100');
                            }
                            var levelEl = document.getElementById('detail-level');
                            if (levelEl) {
                                levelEl.className = 'px-1.5 py-0.5 rounded text-[10px] font-medium bg-green-50 text-green-600 border border-green-100';
                            }

                            var tagsEl = document.getElementById('detail-tags');
                            if (tagsEl) {
                                if (c.tags && c.tags.length) {
                                    tagsEl.innerHTML = c.tags.map(function (t) {
                                        return '<span class="px-2 py-1 text-xs text-brand-600 bg-brand-50 border border-brand-100 rounded">' + escapeAttr(t) + '</span>';
                                    }).join('');
                                } else {
                                    tagsEl.innerHTML = '<span class="text-xs text-gray-400">暂无标签</span>';
                                }
                            }

                            var notesInput = document.getElementById('detail-notes-input');
                            if (notesInput) notesInput.value = c.notes || '';

                            var drawer = document.getElementById('detail-drawer');
                            if (drawer) drawer.style.display = 'flex';
                        }

                        function loadCustomerDetail(id) {
                            fetch('/api/customers/' + encodeURIComponent(id) + '/detail')
                                .then(function (r) { return r.json(); })
                                .then(function (res) {
                                    if (!res.success || !res.data) return;
                                    if (selectedCustomerId !== id) return;

                                    var customer = res.data.customer;
                                    detailOrders = res.data.orders || [];
                                    detailFollows = res.data.followLogs || [];

                                    if (customer) {
                                        customerMap[id] = Object.assign({}, customerMap[id] || {}, customer);
                                        for (var i = 0; i < customerCache.length; i++) {
                                            if (customerCache[i].id === id) {
                                                customerCache[i] = Object.assign({}, customerCache[i], {
                                                    orderCount: customer.orderCount,
                                                    totalAmount: customer.totalAmount,
                                                    amount: customer.amount,
                                                    firstDeal: customer.firstDeal,
                                                    followTime: customer.followTime,
                                                    notes: customer.notes
                                                });
                                                break;
                                            }
                                        }
                                        updateDetailPanel(customerMap[id]);
                                    }

                                    renderOrdersList(detailOrders);
                                    renderFollowList(detailFollows);
                                })
                                .catch(function (err) {
                                    console.error('加载客户详情失败:', err);
                                    renderOrdersList([]);
                                    renderFollowList([]);
                                });
                        }

                        function submitFollow() {
                            if (!selectedCustomerId) {
                                showToast('请先选择客户');
                                return;
                            }
                            var input = document.getElementById('follow-input');
                            var content = ((input && input.value) || '').trim();
                            if (!content) {
                                showToast('请输入跟进内容');
                                return;
                            }
                            fetch('/api/customers/' + encodeURIComponent(selectedCustomerId) + '/follows', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ content: content })
                            })
                                .then(function (r) { return r.json(); })
                                .then(function (res) {
                                    if (!res.success) {
                                        showToast(res.error || '保存失败');
                                        return;
                                    }
                                    if (input) input.value = '';
                                    showToast('跟进已保存');
                                    loadCustomerDetail(selectedCustomerId);
                                    switchDetailTab('follow');
                                })
                                .catch(function (err) { console.error('保存跟进失败:', err); });
                        }

                        function saveNotes() {
                            if (!selectedCustomerId) {
                                showToast('请先选择客户');
                                return;
                            }
                            var input = document.getElementById('detail-notes-input');
                            var notes = input ? input.value : '';
                            fetch('/api/customers/' + encodeURIComponent(selectedCustomerId), {
                                method: 'PUT',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ notes: notes })
                            })
                                .then(function (r) { return r.json(); })
                                .then(function (res) {
                                    if (!res.success) {
                                        showToast(res.error || '保存失败');
                                        return;
                                    }
                                    if (customerMap[selectedCustomerId]) customerMap[selectedCustomerId].notes = notes;
                                    showToast('备注已保存');
                                })
                                .catch(function (err) { console.error('保存备注失败:', err); });
                        }

                        // ========== 更多按钮下拉菜单 ==========
                        var currentDropdown = null;

                        function createDropdown(cid) {
                            var menu = document.createElement('div');
                            menu.className = 'cust-action-menu';
                            menu.innerHTML = [
                                '<button class="cust-action-item cust-action-edit"><i class="ph ph-pencil-simple text-base text-gray-400"></i> 编辑客户</button>',
                                '<button class="cust-action-item cust-action-view"><i class="ph ph-eye text-base text-gray-400"></i> 查看详情</button>',
                                '<div style="height:1px;background:#f8fafc;margin:4px 0;"></div>',
                                '<button class="cust-action-item cust-action-delete" style="color:#ef4444;"><i class="ph ph-trash text-base"></i> 删除客户</button>'
                            ].join('');

                            menu.querySelector('.cust-action-edit').addEventListener('click', function () {
                                closeMenu();
                                openCustomerForm(customerMap[cid], cid);
                            });
                            menu.querySelector('.cust-action-view').addEventListener('click', function () {
                                closeMenu();
                                selectCustomer(cid);
                            });
                            menu.querySelector('.cust-action-delete').addEventListener('click', function () {
                                closeMenu();
                                showDeleteConfirm(cid);
                            });

                            return menu;
                        }

                        function showMenu(btn) {
                            closeMenu();
                            var cid = btn.dataset.cid;
                            var menu = createDropdown(cid);
                            document.body.appendChild(menu);
                            var rect = btn.getBoundingClientRect();
                            menu.style.left = (rect.right - 144) + 'px';
                            menu.style.top = (rect.bottom + 6) + 'px';
                            currentDropdown = menu;
                            requestAnimationFrame(function () { menu.classList.add('show'); });
                        }

                        function closeMenu() {
                            if (currentDropdown) {
                                currentDropdown.remove();
                                currentDropdown = null;
                            }
                        }

                        document.addEventListener('click', function (e) {
                            if (currentDropdown && !e.target.closest('.cust-action-menu') && !e.target.closest('.cust-more-btn')) {
                                closeMenu();
                            }
                        });
                        document.addEventListener('scroll', closeMenu, true);

                        // ========== 删除确认 ==========
                        function showDeleteConfirm(cid) {
                            var c = customerMap[cid];
                            if (!c) return;
                            var name = c.name || '该客户';

                            var modal = document.createElement('div');
                            modal.id = 'cust-delete-modal';
                            modal.className = 'cust-modal-overlay';
                            modal.innerHTML = [
                                '<div class="absolute inset-0 bg-black/40"></div>',
                                '<div class="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 z-10">',
                                '  <div class="flex items-start gap-3 mb-5">',
                                '    <div class="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center flex-shrink-0">',
                                '      <i class="ph-fill ph-warning text-red-500 text-xl"></i>',
                                '    </div>',
                                '    <div>',
                                '      <h3 class="font-bold text-gray-800 text-base mb-1">确认删除该客户？</h3>',
                                '      <p class="text-sm text-gray-500 leading-relaxed">客户 <span class="font-medium text-gray-700">' + escapeAttr(name) + '</span> 删除后不可恢复，确定要继续吗？</p>',
                                '    </div>',
                                '  </div>',
                                '  <div class="flex gap-3 justify-end">',
                                '    <button id="cust-delete-cancel" class="px-5 py-2 border border-gray-200 text-gray-600 bg-white rounded-lg hover:bg-gray-50 transition text-sm font-medium">取消</button>',
                                '    <button id="cust-delete-confirm" class="px-5 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition text-sm font-medium shadow-sm flex items-center gap-1.5"><i class="ph ph-trash"></i>确认删除</button>',
                                '  </div>',
                                '</div>'
                            ].join('');
                            document.body.appendChild(modal);
                            document.body.style.overflow = 'hidden';

                            function closeModal() {
                                modal.remove();
                                document.body.style.overflow = '';
                            }

                            modal.querySelector('#cust-delete-cancel').addEventListener('click', closeModal);
                            modal.addEventListener('click', function (e) {
                                if (!e.target.closest('.relative')) closeModal();
                            });

                            modal.querySelector('#cust-delete-confirm').addEventListener('click', function () {
                                fetch('/api/customers/' + cid, { method: 'DELETE' })
                                    .then(function (r) { return r.json(); })
                                    .then(function (res) {
                                        if (res.success) {
                                            showToast('客户已删除');
                                            if (selectedCustomerId === cid) {
                                                selectedCustomerId = null;
                                            }
                                            loadCustomers();
                                        } else {
                                            showToast(res.error || '删除失败');
                                        }
                                    })
                                    .catch(function (err) {
                                        console.error('删除失败:', err);
                                        showToast('删除失败');
                                    });
                                closeModal();
                            });

                            document.addEventListener('keydown', function esc(e) {
                                if (e.key === 'Escape' && document.getElementById('cust-delete-modal')) {
                                    document.removeEventListener('keydown', esc);
                                    closeModal();
                                }
                            });
                        }

                        // ========== 新增/编辑客户表单 ==========
                        function openCustomerForm(data, cid) {
                            var existing = document.getElementById('cust-form-modal');
                            if (existing) existing.remove();

                            var isEdit = !!data;
                            var tagsStr = (data && data.tags) ? data.tags.join('、') : '';
                            var sourceVal = (data && data.source) ? data.source : '闲鱼';
                            var levelVal = (data && data.level) ? data.level : 'B 普通客户';
                            var typeVal = (data && data.type) ? data.type : '潜在客户';
                            var followVal = (data && data.followStatus) ? data.followStatus : '待跟进';
                            var phoneVal = (data && data.phone) ? data.phone : '';
                            var nameVal = (data && data.name) ? data.name : '';
                            var descVal = (data && data.desc) ? data.desc : '';
                            var notesVal = (data && data.notes) ? data.notes : '';

                            var modal = document.createElement('div');
                            modal.id = 'cust-form-modal';
                            modal.className = 'cust-modal-overlay';
                            modal.innerHTML = [
                                '<div class="absolute inset-0 bg-black/40"></div>',
                                '<div class="relative cust-modal-panel z-10">',
                                '  <div class="flex justify-between items-center p-5 border-b border-gray-100">',
                                '    <h3 class="font-semibold text-gray-800 text-base">' + (isEdit ? '编辑客户' : '新增客户') + '</h3>',
                                '    <button id="cust-form-close" class="text-gray-400 hover:text-gray-600 transition"><i class="ph ph-x text-lg"></i></button>',
                                '  </div>',
                                '  <div class="p-5 space-y-4">',
                                '    <div class="grid grid-cols-2 gap-4">',
                                '      <div><label class="cust-form-label">客户姓名 <span class="text-red-500">*</span></label><input type="text" id="form-name" class="cust-form-input" value="' + escapeAttr(nameVal) + '" placeholder="如：张先生"></div>',
                                '      <div><label class="cust-form-label">联系电话</label><input type="text" id="form-phone" class="cust-form-input" value="' + escapeAttr(phoneVal) + '" placeholder="如：138****5678"></div>',
                                '    </div>',
                                '    <div class="grid grid-cols-2 gap-4">',
                                '      <div><label class="cust-form-label">客户来源</label><select id="form-source" class="cust-form-input"><option value="闲鱼">闲鱼</option><option value="小红书">小红书</option><option value="抖音">抖音</option><option value="微信">微信</option><option value="淘宝">淘宝</option><option value="朋友推荐">朋友推荐</option></select></div>',
                                '      <div><label class="cust-form-label">客户类型</label><select id="form-type" class="cust-form-input"><option value="成交客户">成交客户</option><option value="潜在客户">潜在客户</option><option value="流失客户">流失客户</option><option value="黑名单">黑名单</option></select></div>',
                                '    </div>',
                                '    <div class="grid grid-cols-2 gap-4">',
                                '      <div><label class="cust-form-label">客户等级</label><select id="form-level" class="cust-form-input"><option value="A 高价值">A 高价值</option><option value="B 普通客户">B 普通客户</option><option value="C 潜在客户">C 潜在客户</option></select></div>',
                                '      <div><label class="cust-form-label">跟进状态</label><select id="form-follow" class="cust-form-input"><option value="跟进中">跟进中</option><option value="已成交">已成交</option><option value="待跟进">待跟进</option><option value="已流失">已流失</option></select></div>',
                                '    </div>',
                                '    <div><label class="cust-form-label">需求描述</label><input type="text" id="form-desc" class="cust-form-input" value="' + escapeAttr(descVal) + '" placeholder="如：企业官网定制开发"></div>',
                                '<div><label class="cust-form-label">客户标签（顿号分隔，最多2个）</label><input type="text" id="form-tags" class="cust-form-input" value="' + escapeAttr(tagsStr) + '" placeholder="如：爽快型、大厂员工"></div>',
                                '    <div><label class="cust-form-label">客户备注</label><textarea id="form-notes" rows="3" class="cust-form-input" placeholder="客户特点、沟通偏好等..." style="resize:none;">' + escapeHtml(notesVal) + '</textarea></div>',
                                '  </div>',
                                '  <div class="flex justify-end gap-3 p-5 border-t border-gray-100">',
                                '    <button id="cust-form-cancel" class="px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition">取消</button>',
                                '    <button id="cust-form-save" class="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-sm font-medium transition">保存</button>',
                                '  </div>',
                                '</div>'
                            ].join('');
                            document.body.appendChild(modal);
                            document.body.style.overflow = 'hidden';

                            // 设置 select 默认值
                            setSelectValue('form-source', sourceVal);
                            setSelectValue('form-type', typeVal);
                            var levelMatch = levelVal.charAt(0);
                            var levelSelect = modal.querySelector('#form-level');
                            if (levelSelect) {
                                for (var i = 0; i < levelSelect.options.length; i++) {
                                    if (levelSelect.options[i].value.charAt(0) === levelMatch) {
                                        levelSelect.selectedIndex = i;
                                        break;
                                    }
                                }
                            }
                            setSelectValue('form-follow', followVal);

                            function closeModal() {
                                modal.remove();
                                document.body.style.overflow = '';
                            }

                            modal.querySelector('#cust-form-close').addEventListener('click', closeModal);
                            modal.querySelector('#cust-form-cancel').addEventListener('click', closeModal);
                            modal.addEventListener('click', function (e) {
                                if (!e.target.closest('.cust-modal-panel')) closeModal();
                            });

                            // 保存
                            modal.querySelector('#cust-form-save').addEventListener('click', function () {
                                var name = (modal.querySelector('#form-name').value || '').trim();
                                if (!name) { showToast('请输入客户姓名'); return; }

                                var formData = {
                                    name: name,
                                    phone: (modal.querySelector('#form-phone').value || '').trim(),
                                    source: modal.querySelector('#form-source').value,
                                    type: modal.querySelector('#form-type').value,
                                    level: modal.querySelector('#form-level').value,
                                    followStatus: modal.querySelector('#form-follow').value,
                                    desc: (modal.querySelector('#form-desc').value || '').trim(),
                                    tags: (modal.querySelector('#form-tags').value || '').trim().split(/[、,，]/).map(function (t) { return t.trim(); }).filter(Boolean).slice(0, 2),
                                    notes: (modal.querySelector('#form-notes').value || '').trim()
                                };

                                // 生成当前时间
                                var now = new Date();
                                var mm = String(now.getMonth() + 1).padStart(2, '0');
                                var dd = String(now.getDate()).padStart(2, '0');
                                var hh = String(now.getHours()).padStart(2, '0');
                                var mi = String(now.getMinutes()).padStart(2, '0');
                                formData.followTime = '今天 ' + hh + ':' + mi;

                                if (!isEdit) {
                                    // 新增默认值
                                    formData.amount = '-';
                                    formData.orderCount = 0;
                                    formData.addTime = now.getFullYear() + '-' + mm + '-' + dd + ' ' + hh + ':' + mi;
                                    formData.totalAmount = '-';
                                    formData.firstDeal = '—';
                                    formData.status = '正常';
                                    formData.avatar = '';
                                }

                                var apiUrl = '/api/customers';
                                var method = 'POST';
                                if (isEdit && cid) {
                                    apiUrl = '/api/customers/' + cid;
                                    method = 'PUT';
                                }

                                fetch(apiUrl, {
                                    method: method,
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify(formData)
                                })
                                .then(function (r) { return r.json(); })
                                .then(function (res) {
                                    if (res.success) {
                                        showToast(isEdit ? '客户信息已更新' : '客户已添加');
                                        closeModal();
                                        loadCustomers().then(function () {
                                            if (isEdit && cid) {
                                                selectCustomer(cid);
                                            }
                                        });
                                    } else {
                                        showToast(res.error || '保存失败');
                                    }
                                })
                                .catch(function (err) {
                                    console.error('保存失败:', err);
                                    showToast('保存失败');
                                });
                            });

                            document.addEventListener('keydown', function esc(e) {
                                if (e.key === 'Escape' && document.getElementById('cust-form-modal')) {
                                    document.removeEventListener('keydown', esc);
                                    closeModal();
                                }
                            });
                        }

                        function setSelectValue(id, val) {
                            var sel = document.getElementById(id);
                            if (!sel) return;
                            for (var i = 0; i < sel.options.length; i++) {
                                if (sel.options[i].value === val || sel.options[i].textContent === val) {
                                    sel.selectedIndex = i;
                                    return;
                                }
                            }
                        }

                        // ========== Toast ==========
                        var toastTimer = null;
                        function showToast(msg) {
                            var existing = document.getElementById('cust-action-toast');
                            if (existing) existing.remove();
                            if (toastTimer) clearTimeout(toastTimer);

                            var toast = document.createElement('div');
                            toast.id = 'cust-action-toast';
                            toast.style.cssText = 'position:fixed;bottom:2.5rem;left:50%;transform:translateX(-50%) translateY(2.5rem);background:#1e293b;color:#fff;padding:0.5rem 1rem;border-radius:0.5rem;box-shadow:0 10px 15px -3px rgba(0,0,0,0.1);display:flex;align-items:center;gap:0.5rem;font-size:0.875rem;opacity:0;transition:all 0.3s ease;pointer-events:none;z-index:90;';
                            toast.innerHTML = '<i class="ph-fill ph-check-circle" style="color:#4ade80"></i><span>' + escapeAttr(msg) + '</span>';
                            document.body.appendChild(toast);

                            requestAnimationFrame(function () {
                                toast.style.opacity = '1';
                                toast.style.transform = 'translateX(-50%) translateY(0)';
                            });

                            toastTimer = setTimeout(function () {
                                toast.style.opacity = '0';
                                toast.style.transform = 'translateX(-50%) translateY(2.5rem)';
                                setTimeout(function () { toast.remove(); }, 300);
                            }, 2500);
                        }

                        // ========== 绑定事件 ==========
                        function bindEvents() {
                            // 新增按钮
                            var addBtn = document.getElementById('add-customer-btn');
                            if (addBtn && !addBtn.dataset.bound) {
                                addBtn.dataset.bound = 'true';
                                addBtn.addEventListener('click', function () {
                                    openCustomerForm(null, null);
                                });
                            }

                            // 详情编辑按钮
                            var editBtn = document.getElementById('detail-edit-btn');
                            if (editBtn && !editBtn.dataset.bound) {
                                editBtn.dataset.bound = 'true';
                                editBtn.addEventListener('click', function () {
                                    if (selectedCustomerId) {
                                        openCustomerForm(customerMap[selectedCustomerId], selectedCustomerId);
                                    }
                                });
                            }

                            // 详情关闭按钮（与订单页一致：面板始终显示，关闭按钮仅清空选中状态）
                            var closeBtn = document.getElementById('detail-close-btn');
                            if (closeBtn && !closeBtn.dataset.bound) {
                                closeBtn.dataset.bound = 'true';
                                closeBtn.addEventListener('click', function () {
                                    selectedCustomerId = null;
                                    document.querySelectorAll('#customer-tbody tr').forEach(function (tr) {
                                        tr.classList.remove('bg-brand-50/30');
                                    });
                                    if (customerCache.length > 0) {
                                        selectCustomer(customerCache[0].id);
                                    } else {
                                        renderEmptyDetailPanel();
                                    }
                                });
                            }

                            // 详情 Tab 切换
                            document.querySelectorAll('.detail-tab').forEach(function (tab) {
                                if (tab.dataset.bound) return;
                                tab.dataset.bound = 'true';
                                tab.addEventListener('click', function () {
                                    switchDetailTab(tab.dataset.tab || 'basic');
                                });
                            });

                            // 保存跟进
                            var followSubmitBtn = document.getElementById('follow-submit-btn');
                            if (followSubmitBtn && !followSubmitBtn.dataset.bound) {
                                followSubmitBtn.dataset.bound = 'true';
                                followSubmitBtn.addEventListener('click', submitFollow);
                            }

                            var followInput = document.getElementById('follow-input');
                            if (followInput && !followInput.dataset.bound) {
                                followInput.dataset.bound = 'true';
                                followInput.addEventListener('keydown', function (e) {
                                    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                                        submitFollow();
                                    }
                                });
                            }

                            // 保存备注
                            var notesSaveBtn = document.getElementById('notes-save-btn');
                            if (notesSaveBtn && !notesSaveBtn.dataset.bound) {
                                notesSaveBtn.dataset.bound = 'true';
                                notesSaveBtn.addEventListener('click', saveNotes);
                            }

                            // 快捷写跟进
                            var quickFollowBtn = document.getElementById('quick-follow-btn');
                            if (quickFollowBtn && !quickFollowBtn.dataset.bound) {
                                quickFollowBtn.dataset.bound = 'true';
                                quickFollowBtn.addEventListener('click', function () {
                                    if (!selectedCustomerId) {
                                        showToast('请先选择客户');
                                        return;
                                    }
                                    switchDetailTab('follow');
                                    var input = document.getElementById('follow-input');
                                    if (input) input.focus();
                                });
                            }

                            // 从客户直接新建关联订单
                            var quickOrderBtn = document.getElementById('quick-order-btn');
                            if (quickOrderBtn && !quickOrderBtn.dataset.bound) {
                                quickOrderBtn.dataset.bound = 'true';
                                quickOrderBtn.addEventListener('click', function (e) {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    openNewOrderForSelectedCustomer();
                                });
                            }

                            if (!orderSavedListenerBound) {
                                orderSavedListenerBound = true;
                                window.addEventListener('order-form:saved', function () {
                                    if (!document.getElementById('customer-tbody')) return;
                                    var keepId = selectedCustomerId;
                                    loadCustomers().then(function () {
                                        if (keepId && customerMap[keepId]) selectCustomer(keepId);
                                    });
                                });
                            }

                            // 筛选按钮
                            var filterBtn = document.getElementById('filter-btn');
                            if (filterBtn && !filterBtn.dataset.bound) {
                                filterBtn.dataset.bound = 'true';
                                filterBtn.addEventListener('click', function () {
                                    currentFilter.keyword = (document.getElementById('filter-keyword').value || '').trim();
                                    currentFilter.source = document.getElementById('filter-source').value;
                                    currentFilter.level = document.getElementById('filter-level').value;
                                    currentFilter.type = document.getElementById('filter-type').value;
                                    pagination.page = 1;
                                    loadCustomers();
                                });
                            }

                            // 重置按钮
                            var resetBtn = document.getElementById('filter-reset-btn');
                            if (resetBtn && !resetBtn.dataset.bound) {
                                resetBtn.dataset.bound = 'true';
                                resetBtn.addEventListener('click', function () {
                                    document.getElementById('filter-keyword').value = '';
                                    document.getElementById('filter-source').value = '';
                                    document.getElementById('filter-level').value = '';
                                    document.getElementById('filter-type').value = '';
                                    currentFilter = { keyword: '', source: '', level: '', type: '' };
                                    pagination.page = 1;
                                    loadCustomers();
                                });
                            }

                            // 搜索回车
                            var keywordInput = document.getElementById('filter-keyword');
                            if (keywordInput && !keywordInput.dataset.bound) {
                                keywordInput.dataset.bound = 'true';
                                keywordInput.addEventListener('keypress', function (e) {
                                    if (e.key === 'Enter') {
                                        currentFilter.keyword = keywordInput.value.trim();
                                        pagination.page = 1;
                                        loadCustomers();
                                    }
                                });
                            }

                            // Tab 切换
                            document.querySelectorAll('.cust-tab').forEach(function (tab) {
                                if (tab.dataset.bound) return;
                                tab.dataset.bound = 'true';
                                tab.addEventListener('click', function () {
                                    document.querySelectorAll('.cust-tab').forEach(function (t) {
                                        t.className = 'cust-tab px-4 py-3 border-b-2 border-transparent text-gray-500 hover:text-gray-800 font-medium text-sm transition-colors mx-2';
                                    });
                                    tab.className = 'cust-tab px-4 py-3 border-b-2 border-brand-600 text-brand-600 font-medium text-sm mr-2';
                                    currentFilter.type = tab.dataset.type;
                                    document.getElementById('filter-type').value = tab.dataset.type;
                                    pagination.page = 1;
                                    loadCustomers();
                                });
                            });
                        }

                        // ========== 初始化 ==========
                        function init() {
                            bindEvents();
                            switchDetailTab(currentDetailTab);
                            loadCustomers();
                        }

                        if (document.readyState === 'loading') {
                            document.addEventListener('DOMContentLoaded', init);
                        } else {
                            init();
                        }

                        window.addEventListener('spa:ready', function (e) {
                            var page = (e.detail && e.detail.page) || '';
                            if (page && page.indexOf('customer') === -1) return;
                            init();
                        });

                        // 暴露到 window
                        window.openCustomerForm = openCustomerForm;
                    })();
                    
                /* ==================== 原始脚本结束 ==================== */
            } finally {
                document.addEventListener = _docAdd;
                window.addEventListener = _winAdd;
            }
        }
    });

})(typeof window !== 'undefined' ? window : this);
