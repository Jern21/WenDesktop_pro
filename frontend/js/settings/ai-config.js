(function (global) {
    'use strict';
    global.SettingsPage.section(function (ctx) {
function initAiImageConfig() {
    var apiUrlInput = document.getElementById('ai-image-api-url');
    if (!apiUrlInput || apiUrlInput.dataset.bound) return;

    // 先获取所有关键 DOM 元素，任何一个缺失则不初始化（允许下次重试）
    var apiKeyInput = document.getElementById('ai-image-api-key');
    var modelInput = document.getElementById('ai-image-model');
    var timeoutInput = document.getElementById('ai-image-timeout');
    var saveBtn = document.getElementById('ai-image-save-btn');
    var testBtn = document.getElementById('ai-image-test-btn');
    var toggleKeyBtn = document.getElementById('ai-image-toggle-key');
    var testResult = document.getElementById('ai-image-test-result');
    var statusBar = document.getElementById('ai-image-status-bar');
    var statusText = document.getElementById('ai-image-status-text');

    if (!saveBtn || !testBtn || !apiKeyInput || !statusBar || !statusText) {
        console.warn('[AI Image Config] 关键 DOM 元素缺失，跳过初始化');
        return; // 不设置 dataset.bound，允许 spa:ready 重试
    }

    // 构造 API 基础路径（兼容 SPA 和直接访问）
    var API_BASE = (window.ROOT_URL || '') + 'api/image-gen';
    if (!window.ROOT_URL) {
        // 回退：基于当前页面推导
        var base = window.PAGE_BASE || '';
        var url = window.location.href.split('#')[0].split('?')[0];
        url = url.substring(0, url.lastIndexOf('/'));
        if (base) {
            var ups = (base.match(/\.\.\//g) || []).length;
            for (var i = 0; i < ups; i++) url = url.substring(0, url.lastIndexOf('/'));
        }
        API_BASE = url + '/api/image-gen';
    }

    function showStatusBar(type, msg) {
        statusBar.classList.remove('hidden');
        statusBar.classList.add('flex');
        var styles = {
            success: 'bg-green-50 text-green-600 border-green-100',
            error: 'bg-red-50 text-red-600 border-red-100',
            info: 'bg-blue-50 text-blue-600 border-blue-100'
        };
        statusBar.className = 'flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium mb-4 border ' + (styles[type] || styles.info);
        statusText.textContent = msg;
    }

    function showTestResult(type, msg) {
        testResult.classList.remove('hidden');
        testResult.classList.add('flex');
        var styles = {
            success: 'bg-green-50 text-green-600 border-green-100',
            error: 'bg-red-50 text-red-600 border-red-100',
            testing: 'bg-amber-50 text-amber-600 border-amber-100'
        };
        var icons = { success: 'ph-check-circle', error: 'ph-x-circle', testing: 'ph-spinner-gap animate-spin' };
        testResult.className = 'flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border ' + (styles[type] || styles.testing);
        testResult.innerHTML = '<i class="ph ' + (icons[type] || icons.testing) + '"></i><span>' + msg + '</span>';
    }

    // 加载已有配置
    function loadConfig() {
        global.SettingsPage.call(API_BASE + '/config', { signal: ctx && ctx.signal })
            .then(function(result) {
                if (result && result.data) {
                    var cfg = result.data;
                    apiUrlInput.value = cfg.apiUrl || '';
                    modelInput.value = cfg.model || 'dall-e-3';
                    timeoutInput.value = cfg.timeout || 90;
                    if (cfg.apiKeyConfigured) {
                        apiKeyInput.value = cfg.apiKeyMasked || '';
                        apiKeyInput.dataset.hasKey = '1';
                        showStatusBar('info', '已配置密钥: ' + cfg.apiKeyMasked + '，重新输入可覆盖');
                    } else {
                        showStatusBar('error', '尚未配置密钥，无限画布生图功能将不可用');
                    }
                }
            })
            .catch(function() {
                showStatusBar('error', '无法连接后端服务，请确认服务器已启动');
            });
    }

    // 保存配置
    saveBtn.addEventListener('click', function() {
        var payload = {
            apiUrl: apiUrlInput.value.trim(),
            model: modelInput.value.trim(),
            timeout: parseInt(timeoutInput.value, 10) || 90
        };
        // 仅当用户输入了新密钥（非脱敏值）时才提交
        var keyVal = apiKeyInput.value.trim();
        if (keyVal && keyVal.indexOf('****') === -1) {
            payload.apiKey = keyVal;
        }

        saveBtn.disabled = true;
        saveBtn.innerHTML = '<i class="ph ph-spinner-gap animate-spin"></i> 保存中...';

        global.SettingsPage.call(API_BASE + '/config', {
            method: 'PUT',
            body: payload,
            signal: ctx && ctx.signal
        })
            .then(function() {
                saveBtn.disabled = false;
                saveBtn.innerHTML = '<i class="ph ph-floppy-disk"></i> 保存配置';
                showStatusBar('success', '配置已保存成功');
                loadConfig();
            })
            .catch(function() {
                saveBtn.disabled = false;
                saveBtn.innerHTML = '<i class="ph ph-floppy-disk"></i> 保存配置';
                showStatusBar('error', '网络错误，保存失败');
            });
    });

    // 测试连接
    testBtn.addEventListener('click', function() {
        // 先保存当前配置再测试
        var payload = {
            apiUrl: apiUrlInput.value.trim(),
            model: modelInput.value.trim(),
            timeout: parseInt(timeoutInput.value, 10) || 90
        };
        var keyVal = apiKeyInput.value.trim();
        if (keyVal && keyVal.indexOf('****') === -1) {
            payload.apiKey = keyVal;
        }

        testBtn.disabled = true;
        testBtn.innerHTML = '<i class="ph ph-spinner-gap animate-spin"></i> 测试中...';
        showTestResult('testing', '正在连接...');

        // 先保存
        global.SettingsPage.call(API_BASE + '/config', {
            method: 'PUT',
            body: payload,
            signal: ctx && ctx.signal
        })
            .then(function() {
                return global.SettingsPage.call(API_BASE + '/test', {
                    method: 'POST',
                    signal: ctx && ctx.signal
                });
            })
            .then(function(result) {
                testBtn.disabled = false;
                testBtn.innerHTML = '<i class="ph ph-plug"></i> 测试连接';
                showTestResult('success', (result.data && result.data.message) || '连接成功');
            })
            .catch(function() {
                testBtn.disabled = false;
                testBtn.innerHTML = '<i class="ph ph-plug"></i> 测试连接';
                showTestResult('error', '网络错误，无法连接后端服务');
            });
    });

    // 显示/隐藏密钥
    toggleKeyBtn.addEventListener('click', function() {
        if (apiKeyInput.type === 'password') {
            apiKeyInput.type = 'text';
            toggleKeyBtn.innerHTML = '<i class="ph ph-eye-slash text-sm"></i>';
        } else {
            apiKeyInput.type = 'password';
            toggleKeyBtn.innerHTML = '<i class="ph ph-eye text-sm"></i>';
        }
    });

    // 当用户修改密钥输入框时清除脱敏标记
    apiKeyInput.addEventListener('input', function() {
        if (apiKeyInput.dataset.hasKey && apiKeyInput.value.indexOf('****') === -1) {
            delete apiKeyInput.dataset.hasKey;
        }
    });

    // 所有事件绑定成功后，标记为已绑定（放在末尾确保异常时允许重试）
    apiUrlInput.dataset.bound = '1';

    loadConfig();
}

// ========== Bug记录 ==========
        initAiImageConfig();
    });
})(typeof window !== 'undefined' ? window : this);
