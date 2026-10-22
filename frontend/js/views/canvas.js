/**
 * 无限画布 视图
 *
 * 自动迁移自 frontend/pages/content/canvas.html
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

    App.view('canvas', {
        path: '/canvas',
        nav: 'canvas.html',
        title: '无限画布',
        template: 'views/canvas.html',
        styles: 'css/views/canvas.css',

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

                    var pageRoot = document.getElementById('infinite-canvas-page');
                    if (!pageRoot) return;

                    var instanceId = 'canvas_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
                    window.__infiniteCanvasActiveInstance = instanceId;

                    var zoomScale = 1;
                    var isPanning = false;
                    var panStart = { x: 0, y: 0 };
                    var panOffset = { x: 0, y: 0 };
                    var nodes = [];
                    var selectedParentId = null;
                    var selectedAspectRatio = '1:1';
                    var draggingNodeId = null;
                    var dragOffset = { x: 0, y: 0 };

                    var canvasViewport = document.getElementById('canvas-viewport');
                    var canvasBoard = document.getElementById('canvas-board');
                    var cardsContainer = document.getElementById('cards-container');
                    var connectionsSvg = document.getElementById('connections-svg');
                    var emptyTarget = document.getElementById('empty-target');
                    var hudZoom = document.getElementById('hud-zoom');
                    var promptInput = document.getElementById('prompt-input');
                    var btnGenerate = document.getElementById('btn-generate');
                    var btnResetSession = document.getElementById('btn-reset-session');
                    var presetStyleSelect = document.getElementById('preset-style-select');
                    var toastContainer = document.getElementById('toast-container');
                    var terminalRefInfo = document.getElementById('terminal-reference-info');
                    var refNodeDisplayId = document.getElementById('ref-node-display-id');

                    function isActivePage() {
                        return window.__infiniteCanvasActiveInstance === instanceId && document.getElementById('infinite-canvas-page');
                    }

                    var escapeHtml = App.dom.escapeHtml;

                    function request(url, options) {
                        options = options || {};
                        options.signal = ctx.signal;
                        return global.api.call(url, options);
                    }

                    // ========== API 调用相关 ==========

                    function getApiBase() {
                        if (window.ROOT_URL) return window.ROOT_URL + 'api/image-gen';
                        var base = window.PAGE_BASE || '';
                        var url = window.location.href.split('#')[0].split('?')[0];
                        url = url.substring(0, url.lastIndexOf('/'));
                        if (base) {
                            var ups = (base.match(/\.\.\//g) || []).length;
                            for (var i = 0; i < ups; i++) url = url.substring(0, url.lastIndexOf('/'));
                        }
                        return url + '/api/image-gen';
                    }

                    // 检查 API 是否已配置，未配置时显示提示
                    function checkApiConfig() {
                        request(getApiBase() + '/config')
                            .then(function (result) {
                                if (result.success && result.data) {
                                    var configured = result.data.apiKeyConfigured && result.data.apiUrl;
                                    var badge = document.getElementById('api-status-badge');
                                    if (!configured && badge) {
                                        badge.classList.remove('hidden');
                                    } else if (configured && badge) {
                                        badge.classList.add('hidden');
                                    }
                                }
                            })
                            .catch(function (err) {
                                if (err && err.name === 'AbortError') return;
                            });
                    }

                    // 调用后端 API 生成图片，返回 Promise<string(imageUrl)>
                    function generateImageViaApi(prompt, ratio) {
                        return request(getApiBase() + '/generate', {
                            method: 'POST',
                            body: { prompt: prompt, ratio: ratio },
                            timeout: 120000
                        })
                            .then(function (result) {
                                if (result.success && result.data && result.data.imageUrl) {
                                    return result.data.imageUrl;
                                }
                                throw new Error(result.error || '生图失败');
                            });
                    }

                    function hashText(text) {
                        var hash = 0;
                        for (var i = 0; i < text.length; i++) {
                            hash = ((hash << 5) - hash) + text.charCodeAt(i);
                            hash |= 0;
                        }
                        return Math.abs(hash);
                    }

                    function createMockImage(promptText, ratio) {
                        var hash = hashText(promptText + ratio);
                        var palettes = [
                            ['#111827', '#6366f1', '#38bdf8', '#f8fafc'],
                            ['#1f2937', '#10b981', '#f59e0b', '#fff7ed'],
                            ['#312e81', '#a78bfa', '#f0abfc', '#faf5ff'],
                            ['#0f172a', '#14b8a6', '#84cc16', '#ecfeff'],
                            ['#3f3f46', '#ef4444', '#f97316', '#fff1f2']
                        ];
                        var palette = palettes[hash % palettes.length];
                        var sizeMap = { '1:1': [1024, 1024], '16:9': [1280, 720], '9:16': [720, 1280], '4:3': [1200, 900] };
                        var dims = sizeMap[ratio] || sizeMap['1:1'];
                        var words = promptText.slice(0, 36);
                        var svg = [
                            '<svg xmlns="http://www.w3.org/2000/svg" width="' + dims[0] + '" height="' + dims[1] + '" viewBox="0 0 ' + dims[0] + ' ' + dims[1] + '">',
                            '<defs>',
                            '<linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="' + palette[0] + '"/><stop offset="0.52" stop-color="' + palette[1] + '"/><stop offset="1" stop-color="' + palette[2] + '"/></linearGradient>',
                            '<radialGradient id="r" cx="70%" cy="28%" r="55%"><stop offset="0" stop-color="' + palette[3] + '" stop-opacity="0.65"/><stop offset="1" stop-color="' + palette[3] + '" stop-opacity="0"/></radialGradient>',
                            '</defs>',
                            '<rect width="100%" height="100%" fill="url(#g)"/>',
                            '<rect width="100%" height="100%" fill="url(#r)"/>',
                            '<circle cx="' + (dims[0] * 0.24) + '" cy="' + (dims[1] * 0.34) + '" r="' + (Math.min(dims[0], dims[1]) * 0.18) + '" fill="#fff" opacity="0.14"/>',
                            '<circle cx="' + (dims[0] * 0.72) + '" cy="' + (dims[1] * 0.68) + '" r="' + (Math.min(dims[0], dims[1]) * 0.24) + '" fill="#fff" opacity="0.12"/>',
                            '<path d="M' + (dims[0] * 0.12) + ' ' + (dims[1] * 0.82) + ' C ' + (dims[0] * 0.32) + ' ' + (dims[1] * 0.52) + ', ' + (dims[0] * 0.58) + ' ' + (dims[1] * 0.98) + ', ' + (dims[0] * 0.9) + ' ' + (dims[1] * 0.62) + '" fill="none" stroke="#fff" stroke-width="' + (Math.max(6, dims[0] * 0.012)) + '" opacity="0.35"/>',
                            '<text x="' + (dims[0] * 0.08) + '" y="' + (dims[1] * 0.12) + '" fill="#fff" opacity="0.88" font-size="' + (Math.max(24, dims[0] * 0.032)) + '" font-family="Inter, Arial" font-weight="700">AI CANVAS PREVIEW</text>',
                            '<text x="' + (dims[0] * 0.08) + '" y="' + (dims[1] * 0.18) + '" fill="#fff" opacity="0.72" font-size="' + (Math.max(16, dims[0] * 0.018)) + '" font-family="Inter, Arial">' + escapeHtml(words) + '</text>',
                            '</svg>'
                        ].join('');
                        return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
                    }

                    function getViewportCenterPoint(clientX, clientY) {
                        var rect = canvasViewport.getBoundingClientRect();
                        return {
                            x: (clientX - rect.left - rect.width / 2 - panOffset.x) / zoomScale,
                            y: (clientY - rect.top - rect.height / 2 - panOffset.y) / zoomScale
                        };
                    }

                    function syncViewportMatrix() {
                        canvasBoard.style.transform = 'translate(' + panOffset.x + 'px, ' + panOffset.y + 'px) scale(' + zoomScale + ')';
                        hudZoom.textContent = Math.round(zoomScale * 100) + '%';
                    }

                    function calculateNewNodeCoordinates(parentId) {
                        if (!parentId) {
                            var roots = nodes.filter(function (n) { return !n.parentId; });
                            if (!roots.length) return { x: -160, y: -200 };
                            var lowest = roots.reduce(function (prev, curr) { return curr.y > prev.y ? curr : prev; });
                            return { x: lowest.x, y: lowest.y + 430 };
                        }
                        var parent = nodes.find(function (n) { return n.id === parentId; });
                        var children = nodes.filter(function (n) { return n.parentId === parentId; });
                        return {
                            x: parent.x + 460,
                            y: parent.y + (children.length * 370) - (children.length ? 60 : 0)
                        };
                    }

                    function smoothFocusOn(x, y) {
                        panOffset.x = -x * zoomScale;
                        panOffset.y = -y * zoomScale;
                        canvasBoard.style.transition = 'transform 0.45s cubic-bezier(0.2, 0.8, 0.2, 1)';
                        syncViewportMatrix();
                        setTimeout(function () {
                            if (isActivePage()) canvasBoard.style.transition = '';
                        }, 460);
                    }

                    function createCardElement(node) {
                        var card = document.createElement('div');
                        card.id = 'card-' + node.id;
                        card.className = 'absolute bg-white border p-3 rounded-2xl shadow-sm hover:shadow-md transition-shadow pointer-events-auto w-[320px] image-node-card group select-none ' +
                            (node.id === selectedParentId ? 'border-violet-400 ring-2 ring-violet-500/10' : 'border-zinc-200/70');
                        card.style.left = node.x + 'px';
                        card.style.top = node.y + 'px';

                        if (node.isSkeleton) {
                            card.innerHTML = [
                                '<div class="flex items-center justify-between border-b border-zinc-100 pb-2 mb-2">',
                                '  <span class="text-[9px] font-mono text-zinc-400 font-semibold tracking-wider flex items-center gap-1"><i class="ph ph-spinner-gap animate-spin text-zinc-300"></i> DRAFTING...</span>',
                                '</div>',
                                '<div class="w-full aspect-square bg-zinc-50 rounded-xl flex flex-col items-center justify-center gap-2 py-12">',
                                '  <div class="w-6 h-6 rounded-full border-2 border-zinc-200 border-t-zinc-600 animate-spin"></div>',
                                '  <div class="text-center space-y-0.5"><p class="text-[11px] font-medium text-zinc-500">正在生成画面</p><p class="text-[9px] text-zinc-400">构筑创意节点中，请稍候...</p></div>',
                                '</div>'
                            ].join('');
                            return card;
                        }

                        var parentBadgeHtml = node.id === selectedParentId
                            ? '<span class="bg-violet-50 text-violet-600 px-1.5 py-0.5 rounded text-[9px] font-semibold flex items-center gap-1 border border-violet-100"><i class="ph ph-git-branch text-[9px]"></i> 正在衍生</span>'
                            : '';
                        var ratioStyle = 'style="aspect-ratio:' + node.aspectRatio.replace(':', ' / ') + ';"';
                        card.innerHTML = [
                            '<div class="flex items-center justify-between border-b border-zinc-100 pb-2 mb-2 card-drag-handle cursor-grab active:cursor-grabbing">',
                            '  <div class="flex items-center gap-1.5">',
                            '    <span class="text-[10px] font-mono text-zinc-400 font-medium bg-zinc-100 px-1.5 py-0.5 rounded">#' + node.id.slice(0, 5) + '</span>',
                            parentBadgeHtml,
                            '  </div>',
                            '  <div class="flex items-center gap-1 opacity-60 group-hover:opacity-100 transition-opacity">',
                            '    <button type="button" data-action="branch" data-node-id="' + node.id + '" class="px-2 py-0.5 rounded bg-zinc-50 hover:bg-violet-50 hover:text-violet-600 text-[10px] font-medium transition-all border border-zinc-100/60 flex items-center gap-1" title="以此节点作为后续改图与衍生的起点"><i class="ph ph-git-branch text-[10px]"></i>衍生</button>',
                            '    <button type="button" data-action="delete" data-node-id="' + node.id + '" class="p-1 rounded text-zinc-400 hover:text-red-500 hover:bg-red-50 transition-colors" title="移除节点"><i class="ph ph-trash text-[11px]"></i></button>',
                            '  </div>',
                            '</div>',
                            '<div class="relative overflow-hidden bg-zinc-50 rounded-xl border border-zinc-100 flex items-center justify-center" ' + ratioStyle + '>',
                            '  <img src="' + node.imageUrl + '" class="w-full h-full object-cover rounded-lg" alt="Generated Workspace Layer">',
                            '  <div class="absolute bottom-2.5 right-2.5 flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200">',
                            '    <button type="button" data-action="download" data-node-id="' + node.id + '" class="h-7 w-7 rounded-lg bg-white/95 border border-zinc-200/80 text-zinc-600 hover:text-zinc-900 shadow-sm hover:shadow transition-all flex items-center justify-center text-xs" title="下载原图"><i class="ph ph-download-simple text-[12px]"></i></button>',
                            '    <button type="button" data-action="copy" data-node-id="' + node.id + '" class="h-7 w-7 rounded-lg bg-white/95 border border-zinc-200/80 text-zinc-600 hover:text-zinc-900 shadow-sm hover:shadow transition-all flex items-center justify-center text-xs" title="复制提示词"><i class="ph ph-copy text-[12px]"></i></button>',
                            '  </div>',
                            '</div>',
                            '<div class="mt-2.5 px-0.5 flex items-center justify-between">',
                            '  <span class="text-[9px] font-mono font-medium text-zinc-400 bg-zinc-100 px-1.5 py-0.5 rounded-md">' + node.aspectRatio + '</span>',
                            '  <span class="text-[10px] text-zinc-500 max-w-[200px] truncate" title="' + escapeHtml(node.rawPrompt) + '">' + escapeHtml(node.rawPrompt) + '</span>',
                            '</div>'
                        ].join('');

                        card.addEventListener('mousedown', function (e) {
                            if (e.target.closest('button') || e.target.closest('img')) return;
                            draggingNodeId = node.id;
                            var point = getViewportCenterPoint(e.clientX, e.clientY);
                            dragOffset.x = point.x - node.x;
                            dragOffset.y = point.y - node.y;
                            card.classList.add('node-dragging');
                        });

                        return card;
                    }

                    function renderNodes() {
                        emptyTarget.classList.toggle('hidden', nodes.length > 0);
                        cardsContainer.innerHTML = '';
                        nodes.forEach(function (node) {
                            cardsContainer.appendChild(createCardElement(node));
                        });
                        drawConnections();
                    }

                    function updateCardDomPosition(node) {
                        var cardEl = document.getElementById('card-' + node.id);
                        if (cardEl) {
                            cardEl.style.left = node.x + 'px';
                            cardEl.style.top = node.y + 'px';
                        }
                    }

                    function drawConnections() {
                        connectionsSvg.innerHTML = '';
                        var svgOffset = 10000;
                        nodes.forEach(function (node) {
                            if (!node.parentId) return;
                            var parent = nodes.find(function (n) { return n.id === node.parentId; });
                            if (!parent) return;
                            var parentEl = document.getElementById('card-' + parent.id);
                            var childEl = document.getElementById('card-' + node.id);
                            if (!parentEl || !childEl) return;

                            var x1 = parent.x + (parentEl.offsetWidth || 320) + svgOffset;
                            var y1 = parent.y + ((parentEl.offsetHeight || 340) / 2) + svgOffset;
                            var x2 = node.x + svgOffset;
                            var y2 = node.y + ((childEl.offsetHeight || 340) / 2) + svgOffset;
                            var controlOffset = Math.max(100, Math.abs(x2 - x1) * 0.4);
                            var path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
                            path.setAttribute('d', 'M ' + x1 + ' ' + y1 + ' C ' + (x1 + controlOffset) + ' ' + y1 + ', ' + (x2 - controlOffset) + ' ' + y2 + ', ' + x2 + ' ' + y2);
                            path.setAttribute('stroke', (node.parentId === selectedParentId || node.id === selectedParentId) ? '#818cf8' : '#e4e4e7');
                            path.setAttribute('stroke-width', (node.parentId === selectedParentId || node.id === selectedParentId) ? '2.5' : '1.5');
                            path.setAttribute('fill', 'none');
                            if (node.isSkeleton) {
                                path.setAttribute('class', 'animate-dash');
                                path.setAttribute('stroke', '#a78bfa');
                            }
                            connectionsSvg.appendChild(path);
                        });
                    }

                    function setParentReference(nodeId) {
                        var node = nodes.find(function (n) { return n.id === nodeId; });
                        if (!node) return;
                        selectedParentId = nodeId;
                        terminalRefInfo.classList.remove('hidden');
                        refNodeDisplayId.textContent = '#' + node.id.slice(0, 5);
                        renderNodes();
                        showToast('已将节点 #' + node.id.slice(0, 5) + ' 设为基础衍生源', 'info');
                    }

                    function clearParentReference() {
                        selectedParentId = null;
                        terminalRefInfo.classList.add('hidden');
                        renderNodes();
                    }

                    function deleteNode(nodeId) {
                        function getDescendantIds(id) {
                            var ids = [id];
                            nodes.forEach(function (n) {
                                if (n.parentId === id) ids = ids.concat(getDescendantIds(n.id));
                            });
                            return ids;
                        }
                        var idsToDelete = getDescendantIds(nodeId);
                        nodes = nodes.filter(function (n) { return idsToDelete.indexOf(n.id) === -1; });
                        if (idsToDelete.indexOf(selectedParentId) !== -1) clearParentReference();
                        renderNodes();
                        showToast('已移除节点及关联分支（' + idsToDelete.length + ' 个）', 'success');
                    }

                    function resetBoardToDefaults() {
                        nodes = [];
                        selectedParentId = null;
                        terminalRefInfo.classList.add('hidden');
                        promptInput.value = '';
                        promptInput.style.height = 'auto';
                        zoomScale = 1;
                        panOffset = { x: 0, y: 0 };
                        syncViewportMatrix();
                        renderNodes();
                        showToast('画布已重置', 'success');
                    }

                    function triggerRenderPipe() {
                        var rawPrompt = promptInput.value.trim();
                        if (!rawPrompt) {
                            showToast('请先提供画面指令内容', 'error');
                            return;
                        }
                        var activeStyle = presetStyleSelect.value;
                        var finalPrompt = activeStyle ? rawPrompt + '，' + activeStyle : rawPrompt;
                        var coordinates = calculateNewNodeCoordinates(selectedParentId);
                        var skeletonId = 'skeleton-' + Date.now();
                        nodes.push({
                            id: skeletonId,
                            parentId: selectedParentId,
                            rawPrompt: rawPrompt,
                            x: coordinates.x,
                            y: coordinates.y,
                            isSkeleton: true
                        });
                        renderNodes();
                        smoothFocusOn(coordinates.x + 160, coordinates.y + 170);
                        promptInput.value = '';
                        promptInput.style.height = 'auto';

                        // 调用后端 API 生成图片
                        generateImageViaApi(finalPrompt, selectedAspectRatio)
                            .then(function (imageUrl) {
                                if (!isActivePage()) return;
                                nodes = nodes.filter(function (n) { return n.id !== skeletonId; });
                                var newNodeId = 'node-' + Date.now();
                                nodes.push({
                                    id: newNodeId,
                                    parentId: selectedParentId,
                                    rawPrompt: rawPrompt,
                                    fullPrompt: finalPrompt,
                                    imageUrl: imageUrl,
                                    aspectRatio: selectedAspectRatio,
                                    x: coordinates.x,
                                    y: coordinates.y,
                                    isSkeleton: false
                                });
                                selectedParentId = null;
                                terminalRefInfo.classList.add('hidden');
                                renderNodes();
                                showToast('新创意画面已投放到画布', 'success');
                            })
                            .catch(function (err) {
                                if (!isActivePage()) return;
                                // 移除骨架节点
                                nodes = nodes.filter(function (n) { return n.id !== skeletonId; });
                                renderNodes();
                                var errMsg = err && err.message ? err.message : '生图失败';
                                // 如果后端未配置 API，回退到 mock 预览图并提示
                                if (errMsg.indexOf('未配置') !== -1 || errMsg.indexOf('设置中心') !== -1) {
                                    var fallbackId = 'node-' + Date.now();
                                    nodes.push({
                                        id: fallbackId,
                                        parentId: selectedParentId,
                                        rawPrompt: rawPrompt,
                                        fullPrompt: finalPrompt,
                                        imageUrl: createMockImage(finalPrompt, selectedAspectRatio),
                                        aspectRatio: selectedAspectRatio,
                                        x: coordinates.x,
                                        y: coordinates.y,
                                        isSkeleton: false
                                    });
                                    selectedParentId = null;
                                    terminalRefInfo.classList.add('hidden');
                                    renderNodes();
                                    showToast('API未配置，已生成预览占位图。请在「设置中心→AI生图配置」中配置', 'info');
                                } else {
                                    showToast(errMsg, 'error');
                                }
                            });
                    }

                    function downloadImageNode(nodeId) {
                        var node = nodes.find(function (n) { return n.id === nodeId; });
                        if (!node || !node.imageUrl) return;
                        var imageUrl = node.imageUrl;

                        // data URI 直接下载
                        if (imageUrl.indexOf('data:') === 0) {
                            var link = document.createElement('a');
                            link.href = imageUrl;
                            link.download = 'Canvas_Node_' + Date.now() + '.svg';
                            document.body.appendChild(link);
                            link.click();
                            link.remove();
                            showToast('图像已开始下载', 'success');
                            return;
                        }

                        // 远程 URL：通过后端代理下载，避免 CORS
                        var proxyUrl = getApiBase() + '/proxy?url=' + encodeURIComponent(imageUrl);
                        var link = document.createElement('a');
                        link.href = proxyUrl;
                        link.download = 'Canvas_Node_' + Date.now() + '.png';
                        document.body.appendChild(link);
                        link.click();
                        link.remove();
                        showToast('图像已开始下载', 'success');
                    }

                    function copyNodePrompt(nodeId) {
                        var node = nodes.find(function (n) { return n.id === nodeId; });
                        if (!node) return;
                        var text = node.rawPrompt || '';
                        if (navigator.clipboard && navigator.clipboard.writeText) {
                            navigator.clipboard.writeText(text).then(function () {
                                showToast('提示词已复制', 'success');
                            }).catch(function () {
                                fallbackCopy(text);
                            });
                            return;
                        }
                        fallbackCopy(text);
                    }

                    function fallbackCopy(text) {
                        var textarea = document.createElement('textarea');
                        textarea.value = text;
                        textarea.className = 'fixed -left-[9999px] top-0';
                        document.body.appendChild(textarea);
                        textarea.select();
                        document.execCommand('copy');
                        textarea.remove();
                        showToast('提示词已复制', 'success');
                    }

                    function showToast(message, type) {
                        App.ui.toast(message, type || 'success');
                    }

                    function setupCanvasInteraction() {
                        canvasViewport.addEventListener('mousedown', function (e) {
                            if (!isActivePage()) return;
                            var isUiTarget = e.target.closest('#float-terminal') ||
                                e.target.closest('.image-node-card') ||
                                e.target.closest('button') ||
                                e.target.closest('select');
                            if (isUiTarget) return;
                            isPanning = true;
                            panStart = { x: e.clientX - panOffset.x, y: e.clientY - panOffset.y };
                            canvasViewport.style.cursor = 'grabbing';
                        });

                        window.addEventListener('mousemove', function (e) {
                            if (!isActivePage()) return;
                            if (isPanning) {
                                panOffset.x = e.clientX - panStart.x;
                                panOffset.y = e.clientY - panStart.y;
                                syncViewportMatrix();
                            } else if (draggingNodeId) {
                                var node = nodes.find(function (n) { return n.id === draggingNodeId; });
                                if (node) {
                                    var point = getViewportCenterPoint(e.clientX, e.clientY);
                                    node.x = point.x - dragOffset.x;
                                    node.y = point.y - dragOffset.y;
                                    updateCardDomPosition(node);
                                    drawConnections();
                                }
                            }
                        });

                        window.addEventListener('mouseup', function () {
                            if (!isActivePage()) return;
                            isPanning = false;
                            draggingNodeId = null;
                            canvasViewport.style.cursor = 'grab';
                            document.querySelectorAll('.node-dragging').forEach(function (el) {
                                el.classList.remove('node-dragging');
                            });
                        });

                        canvasViewport.addEventListener('wheel', function (e) {
                            if (!isActivePage()) return;
                            e.preventDefault();
                            var scaleStep = 1.08;
                            zoomScale = e.deltaY < 0 ? Math.min(zoomScale * scaleStep, 3) : Math.max(zoomScale / scaleStep, 0.3);
                            syncViewportMatrix();
                        }, { passive: false });

                        document.getElementById('btn-zoom-in').addEventListener('click', function () {
                            zoomScale = Math.min(zoomScale * 1.2, 3);
                            syncViewportMatrix();
                        });
                        document.getElementById('btn-zoom-out').addEventListener('click', function () {
                            zoomScale = Math.max(zoomScale / 1.2, 0.3);
                            syncViewportMatrix();
                        });
                        document.getElementById('btn-zoom-reset').addEventListener('click', function () {
                            zoomScale = 1;
                            panOffset = { x: 0, y: 0 };
                            syncViewportMatrix();
                            showToast('视图已重置居中', 'info');
                        });

                        document.getElementById('aspect-ratio-selector').addEventListener('click', function (e) {
                            var btn = e.target.closest('.ratio-btn');
                            if (!btn) return;
                            document.querySelectorAll('.ratio-btn').forEach(function (b) {
                                b.classList.remove('bg-zinc-100', 'text-zinc-700');
                                b.classList.add('bg-transparent', 'text-zinc-400');
                            });
                            btn.classList.remove('bg-transparent', 'text-zinc-400');
                            btn.classList.add('bg-zinc-100', 'text-zinc-700');
                            selectedAspectRatio = btn.dataset.ratio;
                        });

                        btnGenerate.addEventListener('click', triggerRenderPipe);
                        btnResetSession.addEventListener('click', resetBoardToDefaults);
                        document.getElementById('btn-clear-reference').addEventListener('click', clearParentReference);

                        promptInput.addEventListener('keydown', function (e) {
                            if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                triggerRenderPipe();
                            }
                        });
                        promptInput.addEventListener('input', function () {
                            promptInput.style.height = 'auto';
                            promptInput.style.height = promptInput.scrollHeight + 'px';
                        });

                        cardsContainer.addEventListener('click', function (e) {
                            var btn = e.target.closest('button[data-action]');
                            if (!btn) return;
                            var nodeId = btn.getAttribute('data-node-id');
                            var action = btn.getAttribute('data-action');
                            if (action === 'branch') setParentReference(nodeId);
                            if (action === 'delete') deleteNode(nodeId);
                            if (action === 'download') downloadImageNode(nodeId);
                            if (action === 'copy') copyNodePrompt(nodeId);
                        });
                    }

                    setupCanvasInteraction();
                    renderNodes();
                    syncViewportMatrix();
                    checkApiConfig();
                })();

                /* ==================== 原始脚本结束 ==================== */
            } finally {
                document.addEventListener = _docAdd;
                window.addEventListener = _winAdd;
            }
        }
    });

})(typeof window !== 'undefined' ? window : this);
