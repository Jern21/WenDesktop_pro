/**
 * 宣传海报表单组件 —— 独立可复用的右侧抽屉表单
 *
 * 功能：
 *   - 上传新海报（拖拽 / 点击上传，图片预览）
 *   - 编辑海报信息（标题、平台、自定义标签、备注、关联链接）
 *   - 海报尺寸 / 比例选择
 *   - 表单校验
 *
 * 用法：
 *   window.openPosterForm()          // 上传新海报
 *   window.openPosterForm(data)      // 编辑已有海报
 *   window.closePosterForm()         // 关闭
 */
(function () {
    'use strict';

    // ========== 常量 ==========

    var PLATFORMS = [
        { value: 'xianyu', label: '闲鱼', color: 'yellow' },
        { value: 'xiaohongshu', label: '小红书', color: 'red' },
        { value: 'douyin', label: '抖音', color: 'gray' },
        { value: 'wechat', label: '微信朋友圈', color: 'green' },
        { value: 'other', label: '其他平台', color: 'blue' }
    ];

    var POSTER_RATIOS = [
        { value: '3/4', label: '竖版 3:4（闲鱼/小红书）' },
        { value: '9/16', label: '竖版 9:16（抖音/视频封面）' },
        { value: '1/1', label: '正方形 1:1（朋友圈）' },
        { value: '16/9', label: '横版 16:9（B站/宽屏）' }
    ];

    var POSTER_TAGS = ['引流', '爆款', '干货', '促销', '品牌', '季节性', '急单', '复购'];

    // ========== 状态 ==========

    var drawer = null;
    var overlay = null;
    var closeTimer = null; // 关闭动画的销毁定时器，切页清理时要能取消它
    var isOpen = false;
    var editMode = false;
    var editId = null; // 编辑模式下的海报 ID
    var selectedTags = [];
    var uploadedImage = null; // 文件上传后的 URL
    var previewHtmlContent = null; // CSS 渲染的海报视觉快照 HTML
    var originalPlaceholderHtml = null; // 上传区原始 HTML（用于上传中状态恢复）
    var isUploading = false; // 是否正在上传文件

    // ========== 工具函数 ==========

    function formatDate(d) {
        if (!d) return '';
        if (typeof d === 'string') return d;
        var y = d.getFullYear();
        var m = String(d.getMonth() + 1).padStart(2, '0');
        var day = String(d.getDate()).padStart(2, '0');
        return y + '-' + m + '-' + day;
    }

    function normalizeHexColor(value, fallback) {
        var color = String(value || '').trim();
        if (/^#[0-9a-fA-F]{6}$/.test(color)) return color;
        return fallback || '#10b981';
    }

    function hexToRgba(hex, alpha) {
        hex = normalizeHexColor(hex);
        var r = parseInt(hex.slice(1, 3), 16);
        var g = parseInt(hex.slice(3, 5), 16);
        var b = parseInt(hex.slice(5, 7), 16);
        return 'rgba(' + r + ',' + g + ',' + b + ',' + alpha + ')';
    }

    function updateLabelPreview() {
        var form = document.getElementById('poster-form');
        var preview = document.getElementById('poster-label-preview');
        if (!form || !preview) return;

        var text = form.labelText.value.trim() || '自定义标签';
        var color = normalizeHexColor(form.labelColor.value);
        preview.textContent = text;
        preview.style.color = color;
        preview.style.backgroundColor = hexToRgba(color, 0.1);
        preview.style.borderColor = hexToRgba(color, 0.28);
    }

    // ========== 构建 HTML ==========

    function buildField(label, innerHtml, opts) {
        opts = opts || {};
        var required = opts.required ? '<span class="text-red-400">*</span>' : '';
        var widthClass = opts.half ? 'col-span-1' : 'col-span-2';
        return [
            '<div class="' + widthClass + '">',
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

    function selectHtml(name, options) {
        var opts = options.map(function (o) {
            var val = typeof o === 'object' ? o.value : o;
            var text = typeof o === 'object' ? o.label : o;
            return '<option value="' + val + '">' + text + '</option>';
        }).join('');
        return '<select name="' + name + '" class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/15 transition-all bg-white">' + opts + '</select>';
    }

    function textareaHtml(name, placeholder, rows) {
        rows = rows || 3;
        return '<textarea name="' + name + '" placeholder="' + placeholder + '" rows="' + rows + '" ' +
            'class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/15 transition-all bg-white resize-none"></textarea>';
    }

    function buildTagHtml() {
        return POSTER_TAGS.map(function (tag) {
            return '<button type="button" data-tag="' + tag + '" ' +
                'class="poster-tag px-2.5 py-1 rounded-md text-xs border transition-all ' +
                'border-gray-200 text-gray-500 hover:border-brand-300 hover:text-brand-600">' + tag + '</button>';
        }).join('');
    }

    function buildPlatformOptions() {
        return PLATFORMS.map(function (p) {
            return '<option value="' + p.value + '">' + p.label + '</option>';
        }).join('');
    }

    function buildDrawerHTML() {
        return [
            // Overlay
            '<div id="poster-form-overlay" class="fixed inset-0 bg-black/20 z-40 opacity-0 transition-opacity duration-200"></div>',
            // Drawer
            '<div id="poster-form-drawer" class="fixed right-0 top-0 bottom-0 w-[560px] bg-white z-50 flex flex-col shadow-2xl translate-x-full transition-transform duration-300">',
            // Header
            '  <div class="flex items-center justify-between px-6 py-4 border-b border-gray-100 flex-shrink-0">',
            '    <div>',
            '      <h3 class="font-bold text-gray-800 text-base" id="poster-form-title">上传海报</h3>',
            '      <p class="text-xs text-gray-400 mt-0.5">填写海报信息，标记星号的字段为必填</p>',
            '    </div>',
            '    <button id="poster-form-close" class="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition">',
            '      <i class="ph ph-x text-lg"></i>',
            '    </button>',
            '  </div>',
            // Body (scrollable)
            '  <div class="flex-1 overflow-y-auto px-6 py-5">',
            '    <form id="poster-form" class="space-y-6">',
            // === Section 1: 图片上传 / 预览 ===
            '      <div>',
            '        <div class="flex items-center gap-2 mb-3">',
            '          <div class="w-6 h-6 rounded-md bg-brand-50 flex items-center justify-center"><i class="ph ph-image text-brand-500 text-sm"></i></div>',
            '          <h4 class="text-sm font-semibold text-gray-800">海报图片</h4>',
            '        </div>',
            // 上传区
            '        <div id="poster-upload-zone" class="border-2 border-dashed border-gray-200 rounded-xl p-6 text-center hover:border-brand-300 transition cursor-pointer relative overflow-hidden">',
            '          <div id="poster-upload-placeholder">',
            '            <div class="w-12 h-12 mx-auto bg-gray-50 rounded-full flex items-center justify-center mb-3">',
            '              <i class="ph ph-cloud-arrow-up text-2xl text-gray-400"></i>',
            '            </div>',
            '            <p class="text-sm text-gray-500 font-medium">点击或拖拽图片到此处上传</p>',
            '            <p class="text-xs text-gray-300 mt-1">支持 JPG / PNG / GIF / WebP，单张不超过 10MB</p>',
            '          </div>',
            // 预览区（隐藏，上传后显示）
            '          <div id="poster-preview-wrap" class="hidden">',
            '            <img id="poster-preview-img" class="max-h-48 mx-auto rounded-lg shadow-sm hidden" alt="预览">',
            '            <div id="poster-preview-html" class="max-h-52 mx-auto rounded-lg shadow-sm overflow-hidden hidden relative aspect-[3/4]"></div>',
            '            <div class="mt-3 flex items-center justify-center gap-3">',
            '              <button type="button" id="poster-replace-btn" class="text-xs text-brand-600 hover:text-brand-700 font-medium flex items-center gap-1"><i class="ph ph-arrow-clockwise"></i>更换图片</button>',
            '              <button type="button" id="poster-remove-btn" class="text-xs text-red-500 hover:text-red-600 font-medium flex items-center gap-1"><i class="ph ph-trash"></i>移除</button>',
            '            </div>',
            '          </div>',
            '          <input type="file" id="poster-file-input" accept="image/*" class="hidden">',
            '        </div>',
            '      </div>',
            // === Section 2: 基本信息 ===
            '      <div class="border-t border-gray-50 pt-5">',
            '        <div class="flex items-center gap-2 mb-3">',
            '          <div class="w-6 h-6 rounded-md bg-blue-50 flex items-center justify-center"><i class="ph ph-info text-blue-500 text-sm"></i></div>',
            '          <h4 class="text-sm font-semibold text-gray-800">基本信息</h4>',
            '        </div>',
            '        <div class="grid grid-cols-2 gap-x-4 gap-y-3">',
            buildField('海报标题', inputHtml('title', '如：闲鱼引流主图-07'), { required: true }),
            buildField('发布平台', '<select name="platform" class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/15 transition-all bg-white">' + buildPlatformOptions() + '</select>', { required: true, half: true }),
            buildField('自定义标签', inputHtml('labelText', '如：引流主图'), { half: true }),
            buildField('标签颜色', '<div class="flex items-center gap-3"><input type="color" name="labelColor" value="#10b981" class="w-11 h-10 rounded-lg border border-gray-200 bg-white p-1 cursor-pointer"><span id="poster-label-preview" class="px-2 py-0.5 rounded text-[10px] font-medium border inline-block" style="color:#10b981;background-color:rgba(16,185,129,0.1);border-color:rgba(16,185,129,0.28)">自定义标签</span></div>', { half: true }),
            buildField('图片比例', selectHtml('ratio', POSTER_RATIOS), { half: true }),
            buildField('排序权重', inputHtml('sortOrder', '数字越大越靠前', 'number'), { half: true }),
            '        </div>',
            // Tags
            '        <div class="mt-3">',
            '          <label class="block text-xs text-gray-500 mb-2">海报标签 <span class="text-gray-400">（可多选）</span></label>',
            '          <div class="flex flex-wrap gap-2">' + buildTagHtml() + '</div>',
            '        </div>',
            '      </div>',
            // === Section 3: 投放信息 ===
            '      <div class="border-t border-gray-50 pt-5">',
            '        <div class="flex items-center gap-2 mb-3">',
            '          <div class="w-6 h-6 rounded-md bg-green-50 flex items-center justify-center"><i class="ph ph-target text-green-500 text-sm"></i></div>',
            '          <h4 class="text-sm font-semibold text-gray-800">投放信息</h4>',
            '        </div>',
            '        <div class="grid grid-cols-2 gap-x-4 gap-y-3">',
            buildField('上线日期', inputHtml('onlineDate', '', 'date'), { half: true }),
            buildField('下线日期', inputHtml('offlineDate', '', 'date'), { half: true }),
            buildField('投放目标', inputHtml('target', '如：引流100人/月'), { half: true }),
            buildField('实际效果', inputHtml('effect', '如：浏览1.2k / 成交15单'), { half: true }),
            '        </div>',
            '      </div>',
            // === Section 4: 备注与关联 ===
            '      <div class="border-t border-gray-50 pt-5">',
            '        <div class="flex items-center gap-2 mb-3">',
            '          <div class="w-6 h-6 rounded-md bg-cyan-50 flex items-center justify-center"><i class="ph ph-paperclip text-cyan-500 text-sm"></i></div>',
            '          <h4 class="text-sm font-semibold text-gray-800">备注与关联</h4>',
            '        </div>',
            '        <div class="space-y-3">',
            buildField('设计备注', textareaHtml('remark', '记录设计思路、配色方案、字体等信息...', 3)),
            buildField('源文件链接', inputHtml('sourceUrl', '如：Figma / 蓝湖 / 本地路径')),
            buildField('关联项目', inputHtml('projectRef', '如：企业官网定制开发')),
            '        </div>',
            '      </div>',
            '    </form>',
            '  </div>',
            // Footer
            '  <div class="px-6 py-4 border-t border-gray-100 bg-gray-50/50 flex items-center justify-between flex-shrink-0">',
            '    <div class="text-xs text-gray-400" id="poster-form-hint">数据将保存到后端服务器</div>',
            '    <div class="flex gap-3">',
            '      <button id="poster-form-cancel" class="px-5 py-2 border border-gray-200 text-gray-600 bg-white rounded-lg hover:bg-gray-50 transition text-sm font-medium">取消</button>',
            '      <button id="poster-form-submit" class="px-5 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition text-sm font-medium shadow-sm shadow-brand-500/30 flex items-center gap-1.5"><i class="ph ph-check"></i>保存</button>',
            '    </div>',
            '  </div>',
            '</div>'
        ].join('');
    }

    // ========== 图片上传逻辑 ==========

    function handleFile(file) {
        if (!file || !file.type.startsWith('image/')) {
            showHint('请选择图片文件（JPG / PNG / GIF / WebP）', 'error');
            return;
        }
        if (file.size > 10 * 1024 * 1024) {
            showHint('图片大小不能超过 10MB', 'error');
            return;
        }
        if (isUploading) return;
        isUploading = true;

        // 缓存原始占位区 HTML 并显示上传中状态
        var placeholder = document.getElementById('poster-upload-placeholder');
        if (placeholder) {
            if (!originalPlaceholderHtml) {
                originalPlaceholderHtml = placeholder.innerHTML;
            }
            placeholder.innerHTML = '<div class="py-4">' +
                '<i class="ph ph-spinner inline-block animate-spin text-2xl text-brand-500"></i>' +
                '<p class="text-xs text-gray-400 mt-2">图片上传中...</p>' +
                '</div>';
        }

        // 通过 /api/upload 直接上传文件到服务器
        var formData = new FormData();
        formData.append('file', file);

        fetch('/api/upload', { method: 'POST', body: formData })
            .then(function (r) { return r.json(); })
            .then(function (res) {
                isUploading = false;
                if (res.success && res.data && res.data.url) {
                    uploadedImage = res.data.url;
                    // 恢复占位区 HTML（后续 hidePreview 时可正确显示）
                    if (placeholder && originalPlaceholderHtml) {
                        placeholder.innerHTML = originalPlaceholderHtml;
                    }
                    showPreview(uploadedImage);
                } else {
                    if (placeholder && originalPlaceholderHtml) {
                        placeholder.innerHTML = originalPlaceholderHtml;
                    }
                    showHint(res.error || '上传失败', 'error');
                }
            })
            .catch(function (err) {
                isUploading = false;
                if (placeholder && originalPlaceholderHtml) {
                    placeholder.innerHTML = originalPlaceholderHtml;
                }
                showHint('上传失败: ' + err.message, 'error');
            });
    }

    function showPreview(src) {
        var placeholder = document.getElementById('poster-upload-placeholder');
        var previewWrap = document.getElementById('poster-preview-wrap');
        var previewImg = document.getElementById('poster-preview-img');
        var previewHtmlDiv = document.getElementById('poster-preview-html');
        if (placeholder) placeholder.classList.add('hidden');
        if (previewWrap) previewWrap.classList.remove('hidden');
        // 隐藏 HTML 预览，显示 img
        if (previewHtmlDiv) { previewHtmlDiv.classList.add('hidden'); previewHtmlDiv.innerHTML = ''; }
        if (previewImg) { previewImg.classList.remove('hidden'); previewImg.src = src; }
        uploadedImage = src;
        previewHtmlContent = null;
    }

    function showPreviewHtml(html) {
        var placeholder = document.getElementById('poster-upload-placeholder');
        var previewWrap = document.getElementById('poster-preview-wrap');
        var previewImg = document.getElementById('poster-preview-img');
        var previewHtmlDiv = document.getElementById('poster-preview-html');
        if (placeholder) placeholder.classList.add('hidden');
        if (previewWrap) previewWrap.classList.remove('hidden');
        // 隐藏 img，显示 HTML 预览
        if (previewImg) { previewImg.classList.add('hidden'); previewImg.src = ''; }
        if (previewHtmlDiv) { previewHtmlDiv.classList.remove('hidden'); previewHtmlDiv.innerHTML = html; }
        previewHtmlContent = html;
        uploadedImage = null;
    }

    function hidePreview() {
        var placeholder = document.getElementById('poster-upload-placeholder');
        var previewWrap = document.getElementById('poster-preview-wrap');
        var previewImg = document.getElementById('poster-preview-img');
        var previewHtmlDiv = document.getElementById('poster-preview-html');
        if (placeholder) placeholder.classList.remove('hidden');
        if (previewWrap) previewWrap.classList.add('hidden');
        if (previewImg) { previewImg.src = ''; }
        if (previewHtmlDiv) { previewHtmlDiv.innerHTML = ''; }
        uploadedImage = null;
        previewHtmlContent = null;
    }

    function bindUploadEvents() {
        var zone = document.getElementById('poster-upload-zone');
        var fileInput = document.getElementById('poster-file-input');
        if (!zone || !fileInput) return;

        // 点击上传
        zone.addEventListener('click', function (e) {
            // 避免点击「更换/移除」按钮时触发
            if (e.target.closest('#poster-replace-btn') || e.target.closest('#poster-remove-btn')) return;
            fileInput.click();
        });

        // 文件选择
        fileInput.addEventListener('change', function () {
            if (this.files && this.files[0]) {
                handleFile(this.files[0]);
            }
        });

        // 拖拽
        zone.addEventListener('dragover', function (e) {
            e.preventDefault();
            zone.classList.add('border-brand-400', 'bg-brand-50/30');
        });
        zone.addEventListener('dragleave', function () {
            zone.classList.remove('border-brand-400', 'bg-brand-50/30');
        });
        zone.addEventListener('drop', function (e) {
            e.preventDefault();
            zone.classList.remove('border-brand-400', 'bg-brand-50/30');
            if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                handleFile(e.dataTransfer.files[0]);
            }
        });

        // 更换图片
        var replaceBtn = document.getElementById('poster-replace-btn');
        if (replaceBtn) {
            replaceBtn.addEventListener('click', function (e) {
                e.stopPropagation();
                fileInput.click();
            });
        }

        // 移除图片
        var removeBtn = document.getElementById('poster-remove-btn');
        if (removeBtn) {
            removeBtn.addEventListener('click', function (e) {
                e.stopPropagation();
                hidePreview();
            });
        }
    }

    // ========== 标签交互 ==========

    function toggleTag(btn) {
        var tag = btn.getAttribute('data-tag');
        var idx = selectedTags.indexOf(tag);
        if (idx === -1) {
            selectedTags.push(tag);
            btn.className = 'poster-tag px-2.5 py-1 rounded-md text-xs border transition-all border-brand-500 bg-brand-50 text-brand-600';
        } else {
            selectedTags.splice(idx, 1);
            btn.className = 'poster-tag px-2.5 py-1 rounded-md text-xs border transition-all border-gray-200 text-gray-500 hover:border-brand-300 hover:text-brand-600';
        }
    }

    // ========== 校验 ==========

    function validate() {
        var form = document.getElementById('poster-form');
        if (!form) return false;

        if (!form.title.value.trim()) {
            showHint('请填写海报标题', 'error');
            form.title.focus();
            return false;
        }
        return true;
    }

    function showHint(msg, type) {
        var hint = document.getElementById('poster-form-hint');
        if (!hint) return;
        hint.textContent = msg;
        if (type === 'error') {
            hint.className = 'text-xs text-red-500';
        } else {
            hint.className = 'text-xs text-gray-400';
        }
        if (type === 'error') {
            setTimeout(function () {
                hint.textContent = '数据将保存到后端服务器';
                hint.className = 'text-xs text-gray-400';
            }, 3000);
        }
    }

    // ========== 收集数据 ==========

    function collectData() {
        var form = document.getElementById('poster-form');
        return {
            title: form.title.value.trim(),
            platform: form.platform.value,
            labelText: form.labelText.value.trim() || '自定义标签',
            labelColor: normalizeHexColor(form.labelColor.value),
            ratio: form.ratio.value,
            sortOrder: parseInt(form.sortOrder.value) || 0,
            tags: selectedTags.slice(),
            onlineDate: form.onlineDate.value,
            offlineDate: form.offlineDate.value,
            target: form.target.value.trim(),
            effect: form.effect.value.trim(),
            remark: form.remark.value.trim(),
            sourceUrl: form.sourceUrl.value.trim(),
            projectRef: form.projectRef.value.trim(),
            image: uploadedImage || null,
            imageHtml: previewHtmlContent || null
        };
    }

    // ========== 填充数据（编辑模式） ==========

    function fillData(data) {
        var form = document.getElementById('poster-form');
        if (!form || !data) return;

        form.title.value = data.title || '';
        form.platform.value = data.platform || 'xianyu';
        form.labelText.value = data.labelText || data.statusText || '自定义标签';
        form.labelColor.value = normalizeHexColor(data.labelColor, '#10b981');
        form.ratio.value = data.ratio || '3/4';
        form.sortOrder.value = data.sortOrder || '';
        form.onlineDate.value = data.onlineDate || '';
        form.offlineDate.value = data.offlineDate || '';
        form.target.value = data.target || '';
        form.effect.value = data.effect || '';
        form.remark.value = data.remark || '';
        form.sourceUrl.value = data.sourceUrl || '';
        form.projectRef.value = data.projectRef || '';

        // 标签
        selectedTags = (data.tags || []).slice();
        document.querySelectorAll('.poster-tag').forEach(function (btn) {
            var tag = btn.getAttribute('data-tag');
            if (selectedTags.indexOf(tag) !== -1) {
                btn.className = 'poster-tag px-2.5 py-1 rounded-md text-xs border transition-all border-brand-500 bg-brand-50 text-brand-600';
            }
        });

        // 图片预览：优先使用真实图片，其次使用 HTML 快照
        if (data.image) {
            showPreview(data.image);
        } else if (data.imageHtml) {
            showPreviewHtml(data.imageHtml);
        }

        updateLabelPreview();
    }

    // ========== 事件绑定 ==========

    function bindEvents() {
        // 关闭
        document.getElementById('poster-form-close').addEventListener('click', closePosterForm);
        document.getElementById('poster-form-cancel').addEventListener('click', closePosterForm);
        overlay.addEventListener('click', closePosterForm);

        // 提交（对接后端 API）
        document.getElementById('poster-form-submit').addEventListener('click', function () {
            if (!validate()) return;

            var submitBtn = document.getElementById('poster-form-submit');
            var originalHtml = submitBtn.innerHTML;
            submitBtn.innerHTML = '<i class="ph ph-spinner animate-spin"></i> 保存中...';
            submitBtn.disabled = true;

            var data = collectData();
            var url = editId ? '/api/posters/' + encodeURIComponent(editId) : '/api/posters';
            var method = editId ? 'PUT' : 'POST';

            fetch(url, {
                method: method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            }).then(function (r) { return r.json(); }).then(function (res) {
                if (res.success) {
                    window.dispatchEvent(new CustomEvent('poster-form:saved', { detail: res.data }));
                    closePosterForm();
                } else {
                    showHint('保存失败：' + (res.error || '未知错误'), 'error');
                    submitBtn.innerHTML = originalHtml;
                    submitBtn.disabled = false;
                }
            }).catch(function (err) {
                console.error('[PosterForm] 保存失败:', err);
                showHint('保存失败：' + err.message, 'error');
                submitBtn.innerHTML = originalHtml;
                submitBtn.disabled = false;
            });
        });

        // 上传
        bindUploadEvents();

        var form = document.getElementById('poster-form');
        if (form && form.labelText && form.labelColor) {
            form.labelText.addEventListener('input', updateLabelPreview);
            form.labelColor.addEventListener('input', updateLabelPreview);
            updateLabelPreview();
        }

        // 标签点击
        document.querySelectorAll('.poster-tag').forEach(function (btn) {
            btn.addEventListener('click', function () { toggleTag(btn); });
        });

        // ESC 关闭改由模块级的单次监听处理（见文件末尾）。
        // 原来写在这里，每开一次抽屉就往 document 上叠一个 keydown 监听。
    }

    // ========== 打开 / 关闭 ==========

    function openPosterForm(data) {
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
        drawer = document.getElementById('poster-form-drawer');
        overlay = document.getElementById('poster-form-overlay');
        selectedTags = [];
        uploadedImage = null;
        originalPlaceholderHtml = null;
        isUploading = false;
        editMode = !!data;
        editId = data && data.id ? data.id : null;

        // 标题
        document.getElementById('poster-form-title').textContent = editMode ? '编辑海报信息' : '上传海报';

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
        // 只有自己确实开着锁的时候才去复位 body.overflow
        var wasOpen = isOpen || overlay || drawer;
        if (overlay) { overlay.remove(); overlay = null; }
        if (drawer) { drawer.remove(); drawer = null; }
        if (wasOpen) document.body.style.overflow = '';
        isOpen = false;
    }

    function closePosterForm() {
        if (!isOpen) return;

        if (overlay) overlay.classList.add('opacity-0');
        if (drawer) drawer.classList.add('translate-x-full');

        if (closeTimer) clearTimeout(closeTimer);
        closeTimer = setTimeout(destroyDrawer, 300);
    }

    // ========== 全局事件监听 ==========

    // 监听包含「上传海报」「编辑信息」「继续编辑」的按钮点击
    document.addEventListener('click', function (e) {
        var btn = e.target.closest('button');
        if (!btn) return;
        var text = btn.textContent.trim();
        if (text === '上传海报' || text === '新增海报') {
            e.preventDefault();
            openPosterForm();
        }
    });

    // 统一销毁入口：切页时不管抽屉开没开、动画跑到哪一步，都直接清干净
    window.addEventListener('spa:cleanup-forms', destroyDrawer);

    // ESC 关闭（模块级只挂一次）
    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && isOpen) closePosterForm();
    });

    // 暴露全局 API
    window.openPosterForm = openPosterForm;
    window.closePosterForm = closePosterForm;
})();
