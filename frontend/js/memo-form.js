/**
 * 备忘录表单组件 —— 独立可复用的右侧抽屉表单
 *
 * 功能：
 *   - 新建 / 编辑备忘录
 *   - 标题、分类、标签、内容、置顶设置
 *   - 字数统计
 *   - 表单校验
 *
 * 用法：
 *   window.openMemoForm()          // 新建
 *   window.openMemoForm(data)      // 编辑（传入已有数据）
 *   window.closeMemoForm()         // 关闭
 */
(function () {
    'use strict';

    // ========== 常量 ==========
    var CATEGORIES = ['客户信息', '项目笔记', '技术方案', '报价参考', '灵感记录', '其他'];
    var TAGS = ['重要', '紧急', '已处理', '待跟进', '参考', '备忘'];

    // ========== 状态 ==========
    var drawer = null;
    var overlay = null;
    var closeTimer = null; // 关闭动画的销毁定时器，切页清理时要能取消它
    var selectedTags = [];
    var isOpen = false;
    var editMode = false;
    var currentId = null;

    // ========== 构建 HTML ==========
    function buildField(label, innerHtml, opts) {
        opts = opts || {};
        var required = opts.required ? '<span class="text-red-400">*</span>' : '';
        return [
            '<div class="mb-4">',
            '  <label class="block text-xs text-gray-500 mb-1.5">' + label + required + '</label>',
            innerHtml,
            '</div>'
        ].join('');
    }

    function inputHtml(name, placeholder, type) {
        type = type || 'text';
        return '<input type="' + type + '" name="' + name + '" placeholder="' + placeholder + '" ' +
            'class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/15 transition-all bg-white">';
    }

    function textareaHtml(name, placeholder, rows) {
        rows = rows || 8;
        return '<textarea name="' + name + '" placeholder="' + placeholder + '" rows="' + rows + '" ' +
            'class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/15 transition-all bg-white resize-none"></textarea>';
    }

    function selectHtml(name, options) {
        var opts = options.map(function (o) {
            return '<option value="' + o + '">' + o + '</option>';
        }).join('');
        return '<select name="' + name + '" class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/15 transition-all bg-white">' + opts + '</select>';
    }

    function buildCategoryHtml() {
        var colors = {
            '客户信息': 'blue',
            '项目笔记': 'green',
            '技术方案': 'purple',
            '报价参考': 'orange',
            '灵感记录': 'yellow',
            '其他': 'gray'
        };
        var icons = {
            '客户信息': 'ph-users',
            '项目笔记': 'ph-kanban',
            '技术方案': 'ph-code',
            '报价参考': 'ph-currency-cny',
            '灵感记录': 'ph-lightbulb',
            '其他': 'ph-tag'
        };

        return CATEGORIES.map(function (cat, idx) {
            var color = colors[cat];
            var icon = icons[cat];
            var checked = idx === 0 ? 'checked' : '';
            return [
                '<label class="cursor-pointer">',
                '  <input type="radio" name="category" value="' + cat + '" class="peer hidden" ' + checked + '>',
                '  <div class="memo-category-option peer-checked:ring-2 peer-checked:ring-' + color + '-500 peer-checked:bg-' + color + '-50 px-3 py-2 rounded-lg border border-gray-200 text-center text-xs hover:bg-gray-50 transition-all">',
                '    <i class="ph ' + icon + ' text-' + color + '-500 mb-1 block text-lg"></i>',
                '    ' + cat,
                '  </div>',
                '</label>'
            ].join('');
        }).join('');
    }

    function buildTagHtml() {
        var colors = {
            '重要': 'blue',
            '紧急': 'red',
            '已处理': 'green',
            '待跟进': 'orange',
            '参考': 'purple',
            '备忘': 'gray'
        };

        return TAGS.map(function (tag) {
            var color = colors[tag];
            return '<button type="button" data-tag="' + tag + '" ' +
                'class="memo-tag px-2.5 py-1 rounded-full text-xs border transition-all ' +
                'border-gray-200 text-gray-500 hover:border-' + color + '-300 hover:text-' + color + '-600">' + tag + '</button>';
        }).join('');
    }

    function buildDrawerHTML() {
        return [
            // Overlay
            '<div id="memo-form-overlay" class="fixed inset-0 bg-black/20 z-[10000] opacity-0 transition-opacity duration-200"></div>',
            // Drawer
            '<div id="memo-form-drawer" class="fixed right-0 top-0 bottom-0 w-[480px] bg-white z-[10001] flex flex-col shadow-2xl translate-x-full transition-transform duration-300">',
            // Header
            '  <div class="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-brand-50 to-white flex-shrink-0">',
            '    <div class="flex items-center gap-3">',
            '      <div class="w-8 h-8 rounded-lg bg-brand-100 flex items-center justify-center">',
            '        <i class="ph-fill ph-notebook text-brand-600"></i>',
            '      </div>',
            '      <div>',
            '        <h3 class="font-bold text-gray-800 text-base" id="memo-form-title">新建备忘</h3>',
            '        <p class="text-xs text-gray-400 mt-0.5">记录重要信息，方便随时查看</p>',
            '      </div>',
            '    </div>',
            '    <button id="memo-form-close" class="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:bg-white hover:text-gray-700 transition">',
            '      <i class="ph ph-x text-lg"></i>',
            '    </button>',
            '  </div>',
            // Body (scrollable)
            '  <div class="flex-1 overflow-y-auto px-6 py-5">',
            '    <form id="memo-form" class="space-y-5">',
            // 标题
            '      <div>',
            buildField('标题', inputHtml('title', '输入备忘标题...'), { required: true }),
            '      </div>',
            // 分类
            '      <div>',
            '        <label class="block text-xs text-gray-500 mb-2">分类</label>',
            '        <div class="grid grid-cols-3 gap-2">' + buildCategoryHtml() + '</div>',
            '      </div>',
            // 标签
            '      <div>',
            '        <label class="block text-xs text-gray-500 mb-2">标签 <span class="text-gray-400">（可多选）</span></label>',
            '        <div class="flex flex-wrap gap-2">' + buildTagHtml() + '</div>',
            '      </div>',
            // 内容
            '      <div>',
            buildField('内容', textareaHtml('content', '输入备忘内容...'), { required: true }),
            '        <div class="flex justify-between mt-1">',
            '          <span class="text-xs text-gray-400">支持多行文本</span>',
            '          <span id="memo-char-count" class="text-xs text-gray-400">0 字</span>',
            '        </div>',
            '      </div>',
            // 置顶
            '      <div class="flex items-center gap-3 p-4 bg-gray-50 rounded-xl">',
            '        <label class="flex items-center gap-3 cursor-pointer">',
            '          <input type="checkbox" name="pinned" class="w-5 h-5 rounded border-gray-300 text-brand-600 focus:ring-brand-500">',
            '          <div>',
            '            <span class="text-sm font-medium text-gray-700 block">置顶此备忘</span>',
            '            <span class="text-xs text-gray-400">置顶备忘会显示在列表顶部</span>',
            '          </div>',
            '        </label>',
            '      </div>',
            '    </form>',
            '  </div>',
            // Footer
            '  <div class="px-6 py-4 border-t border-gray-100 bg-gray-50/50 flex items-center justify-between flex-shrink-0">',
            '    <div class="text-xs text-gray-400" id="memo-form-hint">所有数据仅保存在本地浏览器</div>',
            '    <div class="flex gap-3">',
            '      <button id="memo-form-cancel" class="px-5 py-2 border border-gray-200 text-gray-600 bg-white rounded-lg hover:bg-gray-50 transition text-sm font-medium">取消</button>',
            '      <button id="memo-form-submit" class="px-5 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition text-sm font-medium shadow-sm shadow-brand-500/30 flex items-center gap-1.5"><i class="ph ph-check"></i>保存</button>',
            '    </div>',
            '  </div>',
            '</div>'
        ].join('');
    }

    // ========== 标签交互 ==========
    function toggleTag(btn) {
        var tag = btn.getAttribute('data-tag');
        var colors = {
            '重要': 'blue',
            '紧急': 'red',
            '已处理': 'green',
            '待跟进': 'orange',
            '参考': 'purple',
            '备忘': 'gray'
        };
        var color = colors[tag];
        var idx = selectedTags.indexOf(tag);

        if (idx === -1) {
            selectedTags.push(tag);
            btn.className = 'memo-tag px-2.5 py-1 rounded-full text-xs border transition-all ' +
                'border-' + color + '-500 bg-' + color + '-50 text-' + color + '-600';
        } else {
            selectedTags.splice(idx, 1);
            btn.className = 'memo-tag px-2.5 py-1 rounded-full text-xs border transition-all ' +
                'border-gray-200 text-gray-500 hover:border-' + color + '-300 hover:text-' + color + '-600';
        }
    }

    // ========== 字数统计 ==========
    function updateCharCount() {
        var form = document.getElementById('memo-form');
        if (!form) return;
        var content = form.content.value;
        var countEl = document.getElementById('memo-char-count');
        if (countEl) {
            countEl.textContent = content.length + ' 字';
        }
    }

    // ========== 校验 ==========
    function validate() {
        var form = document.getElementById('memo-form');
        if (!form) return false;
        var errors = [];

        if (!form.title.value.trim()) errors.push('标题');
        if (!form.content.value.trim()) errors.push('内容');

        if (errors.length > 0) {
            console.warn('[MemoForm] 缺少必填字段:', errors);
            return false;
        }
        return true;
    }

    // ========== 收集数据 ==========
    function collectData() {
        var form = document.getElementById('memo-form');
        return {
            id: currentId || Date.now().toString(),
            title: form.title.value.trim(),
            category: form.category.value,
            tags: selectedTags.slice(),
            content: form.content.value.trim(),
            pinned: form.pinned.checked,
            updatedAt: new Date().toISOString()
        };
    }

    // ========== 填充数据（编辑模式） ==========
    function fillData(data) {
        var form = document.getElementById('memo-form');
        if (!form || !data) return;

        currentId = data.id;
        form.title.value = data.title || '';
        form.content.value = data.content || '';
        form.pinned.checked = data.pinned || false;

        // 设置分类
        var categoryRadio = form.querySelector('input[name="category"][value="' + data.category + '"]');
        if (categoryRadio) categoryRadio.checked = true;

        // 设置标签
        selectedTags = (data.tags || []).slice();
        document.querySelectorAll('.memo-tag').forEach(function (btn) {
            var tag = btn.getAttribute('data-tag');
            var colors = {
                '重要': 'blue', '紧急': 'red', '已处理': 'green',
                '待跟进': 'orange', '参考': 'purple', '备忘': 'gray'
            };
            var color = colors[tag];
            if (selectedTags.indexOf(tag) !== -1) {
                btn.className = 'memo-tag px-2.5 py-1 rounded-full text-xs border transition-all ' +
                    'border-' + color + '-500 bg-' + color + '-50 text-' + color + '-600';
            }
        });

        updateCharCount();
    }

    // ========== 事件绑定 ==========
    function bindEvents() {
        var form = document.getElementById('memo-form');

        // 关闭
        document.getElementById('memo-form-close').addEventListener('click', closeMemoForm);
        document.getElementById('memo-form-cancel').addEventListener('click', closeMemoForm);
        overlay.addEventListener('click', closeMemoForm);

        // 提交
        document.getElementById('memo-form-submit').addEventListener('click', function () {
            if (!validate()) {
                var hint = document.getElementById('memo-form-hint');
                hint.textContent = '请填写所有必填字段（标题和内容）';
                hint.className = 'text-xs text-red-500';
                setTimeout(function () {
                    hint.textContent = '所有数据仅保存在本地浏览器';
                    hint.className = 'text-xs text-gray-400';
                }, 3000);
                return;
            }
            var data = collectData();
            window.dispatchEvent(new CustomEvent('memo-form:submit', { detail: data }));
            closeMemoForm();
        });

        // 字数统计
        form.content.addEventListener('input', updateCharCount);

        // 标签点击
        document.querySelectorAll('.memo-tag').forEach(function (btn) {
            btn.addEventListener('click', function () { toggleTag(btn); });
        });

        // ESC 关闭
        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape' && isOpen) closeMemoForm();
        });
    }

    // ========== 打开 / 关闭 ==========
    function openMemoForm(data) {
        if (isOpen) {
            // 关闭动画进行中就直接把旧抽屉销毁、继续打开新的，
            // 否则「关掉后立刻再点」会什么都不发生
            if (!closeTimer) return;
            destroyDrawer();
        }
        // 上一次关闭的销毁定时器如果还挂着，会把这次新建的节点一起干掉
        if (closeTimer) { clearTimeout(closeTimer); closeTimer = null; }

        // 构建 DOM
        document.body.insertAdjacentHTML('beforeend', buildDrawerHTML());
        drawer = document.getElementById('memo-form-drawer');
        overlay = document.getElementById('memo-form-overlay');
        selectedTags = [];
        currentId = null;
        editMode = !!data;

        // 标题
        document.getElementById('memo-form-title').textContent = editMode ? '编辑备忘' : '新建备忘';

        bindEvents();

        // 编辑模式填充数据
        if (editMode) fillData(data);

        // 动画打开。rAF 回调是异步的，执行时抽屉可能已被切页清理或关闭动画销毁，
        // 所以用局部引用 + isConnected 判断，不直接吃模块级的 overlay / drawer。
        var openingOverlay = overlay;
        var openingDrawer = drawer;
        requestAnimationFrame(function () {
            if (!isOpen) return;
            if (openingOverlay && openingOverlay.isConnected) openingOverlay.classList.remove('opacity-0');
            if (openingDrawer && openingDrawer.isConnected) openingDrawer.classList.remove('translate-x-full');
        });

        // 锁定 body 滚动
        document.body.style.overflow = 'hidden';
        isOpen = true;
    }

    // 统一的销毁入口：关闭动画结束、SPA 切页清理，两条路径都只走这里，
    // 避免一边把引用置 null、另一边还拿 null 去点 classList。
    function destroyDrawer() {
        if (closeTimer) { clearTimeout(closeTimer); closeTimer = null; }
        var wasOpen = isOpen || overlay || drawer;
        if (overlay) { overlay.remove(); overlay = null; }
        if (drawer) { drawer.remove(); drawer = null; }
        if (wasOpen) document.body.style.overflow = '';
        isOpen = false;
    }

    function closeMemoForm() {
        if (!isOpen) return;

        if (overlay) overlay.classList.add('opacity-0');
        if (drawer) drawer.classList.add('translate-x-full');

        if (closeTimer) clearTimeout(closeTimer);
        closeTimer = setTimeout(destroyDrawer, 300);
    }

    // SPA 切换页面时清理
    window.addEventListener('spa:cleanup-forms', destroyDrawer);

    // 暴露全局 API
    window.openMemoForm = openMemoForm;
    window.closeMemoForm = closeMemoForm;
})();
