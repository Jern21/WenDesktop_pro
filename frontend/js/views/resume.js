/**
 * 简历管理 视图
 *
 * 自动迁移自 frontend/pages/personal/resume.html
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

    App.view('resume', {
        path: '/resume',
        nav: 'resume.html',
        title: '简历管理',
        template: 'views/resume.html',
        styles: 'css/views/resume.css',

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

                // ==================== Data ====================
                var jobs = [];
                var currentJobId = null;
                var currentPdfDoc = null;
                var currentScale = 1.2;
                var renderedPages = [];

                // ==================== API ====================
                function loadJobs() {
                    return fetch('/api/resume')
                        .then(function (r) { return r.json(); })
                        .then(function (res) {
                            if (res.success) {
                                jobs = res.data || [];
                                renderJobList();
                                // 如果当前有选中的简历，刷新显示
                                if (currentJobId) {
                                    var job = jobs.find(function (j) { return j.id === currentJobId; });
                                    if (job) {
                                        updateToolbar(job);
                                    } else {
                                        currentJobId = null;
                                        showEmptyState();
                                    }
                                }
                            }
                        })
                        .catch(function (err) {
                            console.error('加载简历列表失败:', err);
                        });
                }

                function formatDate(dateStr) {
                    if (!dateStr) return '';
                    return dateStr.split('T')[0];
                }

                function escapeHtml(str) {
                    if (!str) return '';
                    return String(str).replace(/[&<>"']/g, function (c) {
                        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
                    });
                }

                // ==================== Initialization ====================
                // SPA 导航时 DOMContentLoaded 已触发，必须同时监听 spa:ready
                function initResumePage() {
                    initWorker();
                    loadJobs();
                    setupEventListeners();
                }
                if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', initResumePage); } else { initResumePage(); }
                window.addEventListener('spa:ready', function(e) {
                    var page = (e && e.detail && e.detail.page) || '';
                    if (page && page.indexOf('resume') === -1) return;
                    initResumePage();
                });

                function initWorker() {
                    if (typeof pdfjsLib === 'undefined') return;
                    var base = window.ROOT_URL || (window.PAGE_BASE || '');
                    pdfjsLib.GlobalWorkerOptions.workerSrc = base + 'assets/pdf.worker.min.js';
                }

                // ==================== Job List ====================
                function renderJobList() {
                    var listEl = document.getElementById('job-list');
                    var searchTerm = (document.getElementById('job-search').value || '').toLowerCase();

                    var filteredJobs = jobs.filter(function (job) {
                        return (job.title && job.title.toLowerCase().indexOf(searchTerm) !== -1) ||
                               (job.company && job.company.toLowerCase().indexOf(searchTerm) !== -1);
                    });

                    document.getElementById('job-count').textContent = jobs.length;

                    if (filteredJobs.length === 0) {
                        listEl.innerHTML =
                            '<div class="text-center py-8 text-gray-400">' +
                            '<i class="ph ph-magnifying-glass text-3xl mb-2"></i>' +
                            '<p class="text-sm">未找到匹配的岗位</p>' +
                            '</div>';
                        return;
                    }

                    listEl.innerHTML = filteredJobs.map(function (job) {
                        var hasPdf = job.pdfUrl && job.pdfUrl.length > 0;
                        return '<div class="job-card p-3 rounded-lg border border-gray-100 bg-white hover:border-gray-300 cursor-pointer transition-all ' + (job.id === currentJobId ? 'active' : '') + '" ' +
                             'onclick="selectJob(\'' + job.id + '\')">' +
                            '<div class="flex items-start justify-between mb-2">' +
                                '<div>' +
                                    '<h4 class="font-medium text-gray-800 text-sm">' + escapeHtml(job.title) + '</h4>' +
                                    '<p class="text-xs text-gray-500 mt-0.5">' + escapeHtml(job.company || '未填写公司') + '</p>' +
                                '</div>' +
                                (hasPdf ? '<i class="ph-fill ph-file-pdf text-red-500 text-lg"></i>' : '<i class="ph ph-file text-gray-300 text-lg"></i>') +
                            '</div>' +
                            '<div class="flex items-center justify-between text-[11px] text-gray-400">' +
                                '<span>' + formatDate(job.createdAt) + '</span>' +
                                (hasPdf ? '<span>' + (job.pageCount || 0) + ' 页</span>' : '<span class="text-orange-500">待上传</span>') +
                            '</div>' +
                        '</div>';
                    }).join('');
                }

                function showEmptyState() {
                    document.getElementById('pdf-toolbar').classList.add('hidden');
                    document.getElementById('empty-state').classList.remove('hidden');
                    document.getElementById('pdf-container-wrapper').classList.add('hidden');
                }

                function updateToolbar(job) {
                    document.getElementById('current-job-name').textContent = job.title;
                    document.getElementById('current-job-company').textContent = job.company || '';
                    document.getElementById('pdf-toolbar').classList.remove('hidden');
                    document.getElementById('empty-state').classList.add('hidden');
                    document.getElementById('pdf-container-wrapper').classList.remove('hidden');
                }

                function selectJob(jobId) {
                    currentJobId = jobId;
                    renderJobList();

                    var job = jobs.find(function (j) { return j.id === jobId; });
                    if (!job) return;

                    updateToolbar(job);

                    // Load PDF from backend URL
                    if (job.pdfUrl) {
                        loadPdfFromUrl(job.pdfUrl);
                    } else {
                        showNoPdfState();
                    }
                }

                function showNoPdfState() {
                    document.getElementById('pdf-container').innerHTML =
                        '<div class="bg-white rounded-lg shadow-sm p-12 text-center max-w-md">' +
                        '<div class="w-16 h-16 mx-auto mb-4 rounded-full bg-orange-50 flex items-center justify-center">' +
                        '<i class="ph ph-upload-simple text-2xl text-orange-500"></i>' +
                        '</div>' +
                        '<h4 class="font-medium text-gray-700 mb-2">尚未上传简历</h4>' +
                        '<p class="text-sm text-gray-400 mb-4">请上传为该岗位定制的 PDF 简历</p>' +
                        '<button onclick="uploadPdfForCurrentJob()" class="px-4 py-2 bg-brand-600 text-white rounded-lg text-sm hover:bg-brand-700">' +
                        '上传简历 PDF' +
                        '</button>' +
                        '</div>';
                }

                // ==================== PDF Rendering ====================
                function loadPdfFromUrl(url) {
                    if (!url) return;

                    // 加 cache-busting 参数，避免替换 PDF 后仍显示旧文件
                    var fullUrl = url + (url.indexOf('?') === -1 ? '?' : '&') + 't=' + Date.now();

                    var loadingTask = pdfjsLib.getDocument({ url: fullUrl });
                    loadingTask.promise.then(function (pdf) {
                        currentPdfDoc = pdf;
                        document.getElementById('total-pages').textContent = pdf.numPages;
                        renderAllPages();
                    }).catch(function (error) {
                        console.error('Error loading PDF:', error);
                        document.getElementById('pdf-container').innerHTML =
                            '<div class="bg-white rounded-lg shadow-sm p-8 text-center">' +
                            '<i class="ph ph-warning text-3xl text-red-500 mb-2"></i>' +
                            '<p class="text-gray-600">PDF 加载失败</p>' +
                            '</div>';
                    });
                }

                function renderAllPages() {
                    if (!currentPdfDoc) return;
                    
                    const container = document.getElementById('pdf-container');
                    container.innerHTML = '';
                    renderedPages = [];
                    
                    for (let i = 1; i <= currentPdfDoc.numPages; i++) {
                        renderPage(i);
                    }
                }

                function renderPage(pageNum) {
                    currentPdfDoc.getPage(pageNum).then(function(page) {
                        const viewport = page.getViewport({ scale: currentScale });
                        
                        const pageDiv = document.createElement('div');
                        pageDiv.className = 'pdf-page-container';
                        pageDiv.style.width = viewport.width + 'px';
                        
                        const canvas = document.createElement('canvas');
                        canvas.className = 'pdf-page-canvas';
                        canvas.width = viewport.width;
                        canvas.height = viewport.height;
                        
                        pageDiv.appendChild(canvas);
                        document.getElementById('pdf-container').appendChild(pageDiv);
                        
                        const renderContext = {
                            canvasContext: canvas.getContext('2d'),
                            viewport: viewport
                        };
                        
                        page.render(renderContext);
                        renderedPages.push({ pageNum, canvas });
                    });
                }

                // ==================== Zoom & Navigation ====================
                function zoomIn() {
                    currentScale = Math.min(currentScale + 0.2, 3);
                    updateZoomDisplay();
                    if (currentPdfDoc) renderAllPages();
                }

                function zoomOut() {
                    currentScale = Math.max(currentScale - 0.2, 0.5);
                    updateZoomDisplay();
                    if (currentPdfDoc) renderAllPages();
                }

                function fitToWidth() {
                    if (!currentPdfDoc) return;
                    const container = document.getElementById('pdf-container-wrapper');
                    const availableWidth = container.clientWidth - 64; // padding
                    
                    currentPdfDoc.getPage(1).then(function(page) {
                        const viewport = page.getViewport({ scale: 1 });
                        currentScale = availableWidth / viewport.width;
                        updateZoomDisplay();
                        renderAllPages();
                    });
                }

                function updateZoomDisplay() {
                    document.getElementById('zoom-level').textContent = Math.round(currentScale * 100) + '%';
                }

                function prevPage() {
                    const container = document.getElementById('pdf-container-wrapper');
                    const pageHeight = container.clientHeight;
                    container.scrollBy({ top: -pageHeight * 0.8, behavior: 'smooth' });
                }

                function nextPage() {
                    const container = document.getElementById('pdf-container-wrapper');
                    const pageHeight = container.clientHeight;
                    container.scrollBy({ top: pageHeight * 0.8, behavior: 'smooth' });
                }

                // ==================== New Job Modal ====================
                function createNewJob() {
                    document.getElementById('new-job-modal').classList.remove('hidden');
                    document.getElementById('new-job-title').focus();
                }

                function closeNewJobModal() {
                    document.getElementById('new-job-modal').classList.add('hidden');
                    // Reset form
                    document.getElementById('new-job-title').value = '';
                    document.getElementById('new-job-company').value = '';
                    document.getElementById('new-job-pdf').value = '';
                    document.getElementById('selected-filename').classList.add('hidden');
                }

                function saveNewJob() {
                    var title = document.getElementById('new-job-title').value.trim();
                    var company = document.getElementById('new-job-company').value.trim();
                    var fileInput = document.getElementById('new-job-pdf');

                    if (!title) {
                        alert('请填写岗位名称');
                        return;
                    }

                    // 先创建简历记录
                    fetch('/api/resume', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ title: title, company: company })
                    })
                    .then(function (r) { return r.json(); })
                    .then(function (res) {
                        if (!res.success) {
                            alert(res.error || '创建失败');
                            return null;
                        }
                        var newRecord = res.data;

                        // 如果选择了 PDF 文件，上传到后端
                        if (fileInput.files && fileInput.files[0]) {
                            var file = fileInput.files[0];

                            // 先用 PDF.js 获取页数
                            return new Promise(function (resolve) {
                                var reader = new FileReader();
                                reader.onload = function (e) {
                                    var pdfBytes = new Uint8Array(e.target.result);
                                    var pdfDataCopy = pdfBytes.slice();
                                    pdfjsLib.getDocument({ data: pdfDataCopy }).promise.then(function (pdf) {
                                        var pageCount = pdf.numPages;

                                        var formData = new FormData();
                                        formData.append('file', file);
                                        formData.append('pageCount', pageCount);

                                        fetch('/api/resume/' + newRecord.id + '/pdf', {
                                            method: 'POST',
                                            body: formData
                                        })
                                        .then(function (r2) { return r2.json(); })
                                        .then(function () { resolve(); });
                                    }).catch(function () {
                                        // 获取页数失败也继续上传
                                        var formData = new FormData();
                                        formData.append('file', file);
                                        fetch('/api/resume/' + newRecord.id + '/pdf', {
                                            method: 'POST',
                                            body: formData
                                        })
                                        .then(function (r2) { return r2.json(); })
                                        .then(function () { resolve(); });
                                    });
                                };
                                reader.readAsArrayBuffer(file);
                            });
                        }
                        return Promise.resolve();
                    })
                    .then(function () {
                        closeNewJobModal();
                        return loadJobs();
                    })
                    .then(function () {
                        // 选中新创建的简历（排在最前面）
                        if (jobs.length > 0) {
                            selectJob(jobs[0].id);
                        }
                    })
                    .catch(function (err) {
                        console.error('创建简历失败:', err);
                        alert('创建简历失败: ' + (err.message || err));
                    });
                }

                function uploadPdfForCurrentJob() {
                    if (!currentJobId) return;

                    var input = document.createElement('input');
                    input.type = 'file';
                    input.accept = 'application/pdf';
                    input.onchange = function (e) {
                        if (e.target.files && e.target.files[0]) {
                            var file = e.target.files[0];

                            // 先用 PDF.js 获取页数，再上传到后端
                            var reader = new FileReader();
                            reader.onload = function (evt) {
                                var pdfBytes = new Uint8Array(evt.target.result);
                                var pdfDataCopy = pdfBytes.slice();

                                pdfjsLib.getDocument({ data: pdfDataCopy }).promise.then(function (pdf) {
                                    var pageCount = pdf.numPages;
                                    uploadPdfToBackend(file, pageCount);
                                }).catch(function () {
                                    // 获取页数失败也继续上传
                                    uploadPdfToBackend(file, 0);
                                });
                            };
                            reader.readAsArrayBuffer(file);
                        }
                    };
                    input.click();
                }

                function uploadPdfToBackend(file, pageCount) {
                    var formData = new FormData();
                    formData.append('file', file);
                    formData.append('pageCount', pageCount);

                    fetch('/api/resume/' + currentJobId + '/pdf', {
                        method: 'POST',
                        body: formData
                    })
                    .then(function (r) { return r.json(); })
                    .then(function (res) {
                        if (!res.success) {
                            alert(res.error || '上传失败');
                            return;
                        }
                        return loadJobs();
                    })
                    .then(function () {
                        // 重新加载 PDF 视图
                        var job = jobs.find(function (j) { return j.id === currentJobId; });
                        if (job && job.pdfUrl) {
                            loadPdfFromUrl(job.pdfUrl);
                        }
                    })
                    .catch(function (err) {
                        console.error('上传失败:', err);
                        alert('上传失败: ' + (err.message || err));
                    });
                }

                function downloadCurrentPdf() {
                    var job = jobs.find(function (j) { return j.id === currentJobId; });
                    if (!job || !job.pdfUrl) {
                        alert('没有可下载的 PDF');
                        return;
                    }

                    var a = document.createElement('a');
                    a.href = job.pdfUrl;
                    a.download = job.pdfName || 'resume.pdf';
                    document.body.appendChild(a);
                    a.click();
                    a.remove();
                }

                // ==================== Edit Job ====================
                function openEditModal() {
                    if (!currentJobId) return;
                    var job = jobs.find(function (j) { return j.id === currentJobId; });
                    if (!job) return;

                    document.getElementById('edit-job-title').value = job.title || '';
                    document.getElementById('edit-job-company').value = job.company || '';
                    document.getElementById('edit-job-modal').classList.remove('hidden');
                    document.getElementById('edit-job-title').focus();
                }

                function closeEditModal() {
                    document.getElementById('edit-job-modal').classList.add('hidden');
                }

                function saveEditJob() {
                    if (!currentJobId) return;

                    var title = document.getElementById('edit-job-title').value.trim();
                    var company = document.getElementById('edit-job-company').value.trim();

                    if (!title) {
                        alert('请填写岗位名称');
                        return;
                    }

                    fetch('/api/resume/' + currentJobId, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ title: title, company: company })
                    })
                    .then(function (r) { return r.json(); })
                    .then(function (res) {
                        if (!res.success) {
                            alert(res.error || '保存失败');
                            return;
                        }
                        closeEditModal();
                        return loadJobs();
                    })
                    .then(function () {
                        // 刷新工具栏显示
                        var job = jobs.find(function (j) { return j.id === currentJobId; });
                        if (job) {
                            updateToolbar(job);
                        }
                    })
                    .catch(function (err) {
                        console.error('保存失败:', err);
                        alert('保存失败: ' + (err.message || err));
                    });
                }

                // ==================== Delete Job ====================
                function deleteCurrentJob() {
                    if (!currentJobId) return;
                    var job = jobs.find(function (j) { return j.id === currentJobId; });
                    if (!job) return;

                    if (!confirm('确定要删除「' + job.title + '」的简历吗？此操作不可撤销。')) return;

                    fetch('/api/resume/' + currentJobId, { method: 'DELETE' })
                    .then(function (r) { return r.json(); })
                    .then(function (res) {
                        if (!res.success) {
                            alert(res.error || '删除失败');
                            return;
                        }
                        currentJobId = null;
                        currentPdfDoc = null;
                        showEmptyState();
                        return loadJobs();
                    })
                    .catch(function (err) {
                        console.error('删除失败:', err);
                        alert('删除失败: ' + (err.message || err));
                    });
                }

                // ==================== Event Listeners ====================
                function setupEventListeners() {
                    // Search
                    document.getElementById('job-search').addEventListener('input', renderJobList);
                    
                    // Page input
                    document.getElementById('page-input').addEventListener('change', function(e) {
                        const pageNum = parseInt(e.target.value);
                        if (pageNum >= 1 && pageNum <= (currentPdfDoc?.numPages || 1)) {
                            const container = document.getElementById('pdf-container-wrapper');
                            const targetPage = renderedPages[pageNum - 1];
                            if (targetPage) {
                                targetPage.canvas.scrollIntoView({ behavior: 'smooth' });
                            }
                        }
                    });
                    
                    // PDF upload in modal
                    document.getElementById('pdf-upload-area').addEventListener('click', function() {
                        document.getElementById('new-job-pdf').click();
                    });
                    
                    document.getElementById('pdf-upload-area').addEventListener('dragover', function(e) {
                        e.preventDefault();
                        this.classList.add('border-brand-400', 'bg-brand-50/30');
                    });
                    
                    document.getElementById('pdf-upload-area').addEventListener('dragleave', function(e) {
                        e.preventDefault();
                        this.classList.remove('border-brand-400', 'bg-brand-50/30');
                    });
                    
                    document.getElementById('pdf-upload-area').addEventListener('drop', function(e) {
                        e.preventDefault();
                        this.classList.remove('border-brand-400', 'bg-brand-50/30');
                        const files = e.dataTransfer.files;
                        if (files && files[0]) {
                            document.getElementById('new-job-pdf').files = files;
                            updateSelectedFilename(files[0].name);
                        }
                    });
                    
                    document.getElementById('new-job-pdf').addEventListener('change', function(e) {
                        if (e.target.files && e.target.files[0]) {
                            updateSelectedFilename(e.target.files[0].name);
                        }
                    });
                }

                function updateSelectedFilename(filename) {
                    const el = document.getElementById('selected-filename');
                    el.textContent = '已选择: ' + filename;
                    el.classList.remove('hidden');
                }

                // Handle SPA navigation cleanup
                window.addEventListener('spa:cleanup-forms', function() {
                    closeNewJobModal();
                    closeEditModal();
                });

                // 显式暴露到 window，确保 inline onclick 处理器能访问
                window.createNewJob = createNewJob;
                window.closeNewJobModal = closeNewJobModal;
                window.saveNewJob = saveNewJob;
                window.selectJob = selectJob;
                window.uploadPdfForCurrentJob = uploadPdfForCurrentJob;
                window.downloadCurrentPdf = downloadCurrentPdf;
                window.openEditModal = openEditModal;
                window.closeEditModal = closeEditModal;
                window.saveEditJob = saveEditJob;
                window.deleteCurrentJob = deleteCurrentJob;
                window.zoomIn = zoomIn;
                window.zoomOut = zoomOut;
                window.fitToWidth = fitToWidth;
                window.prevPage = prevPage;
                window.nextPage = nextPage;

                /* <<< auto:post-process >>> */
            /* ---------------- data-act 事件委托（自动生成，勿手改） ---------------- */
            // 模板里的内联 onclick 已统一改为 data-act 属性，这里转发到本作用域的函数。
            // 本块由 tools/post-process-views.js 生成，重跑会整体替换。
            var ACTION_MAP = {
                'prevPage': prevPage,
                'nextPage': nextPage,
                'zoomOut': zoomOut,
                'zoomIn': zoomIn,
                'fitToWidth': fitToWidth,
                'openEditModal': openEditModal,
                'uploadPdfForCurrentJob': uploadPdfForCurrentJob,
                'downloadCurrentPdf': downloadCurrentPdf,
                'deleteCurrentJob': deleteCurrentJob,
                'createNewJob': createNewJob,
                'closeNewJobModal': closeNewJobModal,
                'saveNewJob': saveNewJob,
                'closeEditModal': closeEditModal,
                'saveEditJob': saveEditJob,
            };
            ctx.onCleanup(App.dom.delegate(root, '[data-act]', 'click', function (e, el) {
                var act = el.getAttribute('data-act');
                var fn = ACTION_MAP[act];
                if (typeof fn !== 'function') {
                    console.warn('[resume] 未定义的动作:', act);
                    return;
                }
                e.preventDefault();
                fn(e, el);
            }));
/* <<< /auto:post-process >>> */
/* ==================== 原始脚本结束 ==================== */
            } finally {
                document.addEventListener = _docAdd;
                window.addEventListener = _winAdd;
            }
        }
    });

})(typeof window !== 'undefined' ? window : this);
