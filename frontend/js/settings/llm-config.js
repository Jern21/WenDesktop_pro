/**
 * 设置中心 → 大模型配置
 *
 * 这张卡片服务的是侧栏小柴犬对话窗口（js/shiba-agent.js）。
 * 后端接口在 backend/src/routes/llm.js，密钥落盘走 secret-box 加密。
 *
 * 注意：这里**不做任何真机密钥校验**，能不能用只有「测试连接」知道
 * （不同厂商的 /models 探测行为不一致，直接发一轮对话最准）。
 */
(function (global) {
    'use strict';
    global.SettingsPage.section(function (ctx) {
function initLlmConfig() {
    var apiUrlInput = document.getElementById('llm-api-url');
    if (!apiUrlInput || apiUrlInput.dataset.bound) return;

    // 先取齐所有关键 DOM，缺一个就不初始化（不写 dataset.bound，允许下次重试）
    var apiKeyInput = document.getElementById('llm-api-key');
    var modelInput = document.getElementById('llm-model');
    var timeoutInput = document.getElementById('llm-timeout');
    var saveBtn = document.getElementById('llm-save-btn');
    var testBtn = document.getElementById('llm-test-btn');
    var toggleKeyBtn = document.getElementById('llm-toggle-key');
    var testResult = document.getElementById('llm-test-result');
    var statusBar = document.getElementById('llm-status-bar');
    var statusText = document.getElementById('llm-status-text');
    var presetBox = document.getElementById('llm-presets');

    if (!saveBtn || !testBtn || !apiKeyInput || !statusBar || !statusText) {
        console.warn('[LLM Config] 关键 DOM 元素缺失，跳过初始化');
        return;
    }

    var API_BASE = (window.ROOT_URL || '') + 'api/llm';
    if (!window.ROOT_URL) {
        var base = window.PAGE_BASE || '';
        var url = window.location.href.split('#')[0].split('?')[0];
        url = url.substring(0, url.lastIndexOf('/'));
        if (base) {
            var ups = (base.match(/\.\.\//g) || []).length;
            for (var i = 0; i < ups; i++) url = url.substring(0, url.lastIndexOf('/'));
        }
        API_BASE = url + '/api/llm';
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
        testResult.innerHTML = '<i class="ph ' + (icons[type] || icons.testing) + '"></i><span></span>';
        // 用 textContent 写文案：后端会带回厂商原始报文，可能含尖括号
        testResult.querySelector('span').textContent = msg;
    }

    /** 上次加载时服务端是否已存有密钥（用变量记，不能用 input.value 推断：用户一敲键盘就丢了） */
    var storedKeyConfigured = false;

    function loadConfig() {
        global.SettingsPage.call(API_BASE + '/config', { signal: ctx && ctx.signal })
            .then(function (result) {
                if (!result || !result.data) return;
                var cfg = result.data;
                apiUrlInput.value = cfg.apiUrl || '';
                modelInput.value = cfg.model || '';
                timeoutInput.value = cfg.timeout || 60;
                storedKeyConfigured = !!cfg.apiKeyConfigured;

                if (cfg.apiKeyConfigured) {
                    apiKeyInput.value = cfg.apiKeyMasked || '';
                    apiKeyInput.dataset.hasKey = '1';
                } else {
                    apiKeyInput.value = '';
                    delete apiKeyInput.dataset.hasKey;
                }

                if (cfg.configured) {
                    showStatusBar('success', '已接入大模型：' + cfg.model + '，小柴现在能正常聊天了');
                } else if (cfg.apiKeyConfigured) {
                    showStatusBar('info', '密钥已保存，但还缺 API 地址或模型名称');
                } else {
                    showStatusBar('error', '还没接大模型，小柴只会回你「你还没接入大模型喔」');
                }
            })
            .catch(function (err) {
                showStatusBar('error', (err && err.message) || '无法连接后端服务，请确认服务器已启动');
            });
    }

    /** 收集表单。脱敏值（含 ****）不提交，否则会把真密钥覆盖成星号 */
    function collectPayload() {
        var payload = {
            apiUrl: apiUrlInput.value.trim(),
            model: modelInput.value.trim(),
            timeout: parseInt(timeoutInput.value, 10) || 60
        };
        var keyVal = apiKeyInput.value.trim();
        if (storedKeyConfigured && !keyVal) {
            // 原来有密钥，现在被清空了 —— 当成「删除密钥」，否则永远删不掉
            payload.clearApiKey = true;
        } else if (keyVal && keyVal.indexOf('****') === -1) {
            payload.apiKey = keyVal;
        }
        return payload;
    }

    var SAVE_IDLE = '<i class="ph ph-floppy-disk"></i> 保存配置';
    var TEST_IDLE = '<i class="ph ph-plug"></i> 测试连接';

    function setBtnBusy(btn, busy, idleHtml, busyText) {
        btn.disabled = busy;
        btn.innerHTML = busy
            ? '<i class="ph ph-spinner-gap animate-spin"></i> ' + (busyText || '处理中') + '...'
            : idleHtml;
    }

    saveBtn.addEventListener('click', function () {
        setBtnBusy(saveBtn, true, SAVE_IDLE, '保存中');
        global.SettingsPage.call(API_BASE + '/config', {
            method: 'PUT',
            body: collectPayload(),
            signal: ctx && ctx.signal
        })
            .then(function () {
                setBtnBusy(saveBtn, false, SAVE_IDLE);
                showStatusBar('success', '配置已保存');
                loadConfig();
            })
            .catch(function (err) {
                setBtnBusy(saveBtn, false, SAVE_IDLE);
                showStatusBar('error', '保存失败：' + ((err && err.message) || '网络错误'));
            });
    });

    testBtn.addEventListener('click', function () {
        setBtnBusy(testBtn, true, TEST_IDLE, '测试中');
        showTestResult('testing', '正在连大模型，可能要几秒…');

        // 先存再测：只测不存的话，测的和以后用的不是同一套配置
        global.SettingsPage.call(API_BASE + '/config', {
            method: 'PUT',
            body: collectPayload(),
            signal: ctx && ctx.signal
        })
            .then(function () {
                return global.SettingsPage.call(API_BASE + '/test', {
                    method: 'POST',
                    signal: ctx && ctx.signal
                });
            })
            .then(function (result) {
                setBtnBusy(testBtn, false, TEST_IDLE);
                showTestResult('success', (result.data && result.data.message) || '连接成功');
                loadConfig();
            })
            .catch(function (err) {
                setBtnBusy(testBtn, false, TEST_IDLE);
                showTestResult('error', (err && err.message) || '网络错误，无法连接后端服务');
            });
    });

    toggleKeyBtn.addEventListener('click', function () {
        if (apiKeyInput.type === 'password') {
            apiKeyInput.type = 'text';
            toggleKeyBtn.innerHTML = '<i class="ph ph-eye-slash text-sm"></i>';
        } else {
            apiKeyInput.type = 'password';
            toggleKeyBtn.innerHTML = '<i class="ph ph-eye text-sm"></i>';
        }
    });

    apiKeyInput.addEventListener('input', function () {
        if (apiKeyInput.dataset.hasKey && apiKeyInput.value.indexOf('****') === -1) {
            delete apiKeyInput.dataset.hasKey;
        }
    });

    // 常见厂商一键填地址 + 模型名（密钥各家不同，只能自己粘）
    if (presetBox) {
        presetBox.addEventListener('click', function (e) {
            var btn = e.target.closest('.llm-preset');
            if (!btn) return;
            e.preventDefault();
            apiUrlInput.value = btn.dataset.apiUrl || '';
            modelInput.value = btn.dataset.model || '';
            showStatusBar('info', '已填入「' + btn.textContent.trim() + '」的默认地址，别忘了粘 API 密钥');
            apiKeyInput.focus();
        });
    }

    // 全部绑定成功后才打标记（中途抛异常时还能重试）
    apiUrlInput.dataset.bound = '1';

    loadConfig();
}

        initLlmConfig();
    });
})(typeof window !== 'undefined' ? window : this);
