(function (global) {
    'use strict';
    global.SettingsPage.section(function (ctx) {
function initAccountProfile() {
    var root = document.getElementById('account');
    if (!root || root.dataset.profileBound) return;

    var API_BASE = (window.ROOT_URL || window.PAGE_BASE || '') + 'api/settings';
    var avatarImg = document.getElementById('profile-avatar-img');
    var avatarInput = document.getElementById('profile-avatar-input');
    var avatarBtn = document.getElementById('profile-avatar-btn');
    var changeAvatarBtn = document.getElementById('profile-change-avatar-btn');
    var displayName = document.getElementById('profile-display-name');
    var displayRole = document.getElementById('profile-display-role');
    var nicknameInput = document.getElementById('profile-nickname');
    var realNameInput = document.getElementById('profile-real-name');
    var phoneInput = document.getElementById('profile-phone');
    var emailInput = document.getElementById('profile-email');
    var roleInput = document.getElementById('profile-role');
    var cityInput = document.getElementById('profile-city');
    var bioInput = document.getElementById('profile-bio');
    var saveBtn = document.getElementById('profile-save-btn');
    var cancelBtn = document.getElementById('profile-cancel-btn');
    var statusBar = document.getElementById('profile-status-bar');

    if (!avatarImg || !nicknameInput || !saveBtn || !cancelBtn || !statusBar) return;

    var currentProfile = null;
    var pendingAvatar = '';

    function escapeXml(value) {
        return String(value || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&apos;');
    }

    function fallbackAvatar(name) {
        var label = String(name || '用').trim().charAt(0) || '用';
        var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128">' +
            '<rect width="128" height="128" rx="64" fill="#2563eb"/>' +
            '<text x="50%" y="50%" dy=".08em" text-anchor="middle" dominant-baseline="middle" ' +
            'font-family="Inter, system-ui, sans-serif" font-size="48" font-weight="700" fill="#fff">' +
            escapeXml(label) + '</text></svg>';
        return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
    }

    function defaultProfile() {
        return {
            nickname: '',
            realName: '',
            phone: '',
            email: '',
            role: '',
            city: '',
            bio: '',
            avatar: ''
        };
    }

    function normalizeProfile(profile) {
        return Object.assign(defaultProfile(), profile || {});
    }

    function showStatus(type, message) {
        var styles = {
            success: 'flex bg-green-50 text-green-600 border-green-100',
            error: 'flex bg-red-50 text-red-600 border-red-100',
            info: 'flex bg-blue-50 text-blue-600 border-blue-100'
        };
        var icons = { success: 'ph-check-circle', error: 'ph-warning-circle', info: 'ph-info' };
        statusBar.className = 'items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium mb-4 border ' + (styles[type] || styles.info);
        statusBar.innerHTML = '<i class="ph ' + (icons[type] || icons.info) + '"></i><span></span>';
        var span = statusBar.querySelector('span');
        if (span) span.textContent = message || '';
    }

    function setButtonLoading(btn, loading, text) {
        if (!btn) return;
        if (!btn.dataset.defaultHtml) btn.dataset.defaultHtml = btn.innerHTML;
        btn.disabled = loading;
        btn.classList.toggle('opacity-70', loading);
        btn.classList.toggle('cursor-not-allowed', loading);
        btn.innerHTML = loading ? '<i class="ph ph-spinner-gap animate-spin"></i> ' + text : btn.dataset.defaultHtml;
    }

    function updatePreview(profile) {
        var nickname = (profile.nickname || '').trim() || '未设置昵称';
        var role = (profile.role || '').trim() || '未设置职业方向';
        displayName.textContent = nickname;
        displayRole.textContent = role;
        avatarImg.src = profile.avatar || fallbackAvatar(nickname);
    }

    function fillForm(profile) {
        profile = normalizeProfile(profile);
        pendingAvatar = profile.avatar || '';
        nicknameInput.value = profile.nickname || '';
        realNameInput.value = profile.realName || '';
        phoneInput.value = profile.phone || '';
        emailInput.value = profile.email || '';
        roleInput.value = profile.role || '';
        cityInput.value = profile.city || '';
        bioInput.value = profile.bio || '';
        updatePreview(profile);
    }

    function collectProfile() {
        var profile = normalizeProfile(currentProfile);
        profile.nickname = nicknameInput.value.trim();
        profile.realName = realNameInput.value.trim();
        profile.phone = phoneInput.value.trim();
        profile.email = emailInput.value.trim();
        profile.role = roleInput.value.trim();
        profile.city = cityInput.value.trim();
        profile.bio = bioInput.value.trim();
        profile.avatar = pendingAvatar || '';
        return profile;
    }

    function publishProfile(profile) {
        window.__userProfile = profile;
        if (typeof window.applyUserProfileToHeader === 'function') {
            window.applyUserProfileToHeader(profile);
        }
        window.dispatchEvent(new CustomEvent('settings:profile-updated', {
            detail: { profile: profile }
        }));
    }

    function loadProfile() {
        showStatus('info', '正在读取账号信息...');
        return fetch(API_BASE)
            .then(function (res) { return res.json(); })
            .then(function (result) {
                if (!result.success) throw new Error(result.error || '读取账号信息失败');
                currentProfile = normalizeProfile(result.data && result.data.profile);
                fillForm(currentProfile);
                publishProfile(currentProfile);
                showStatus('success', '账号信息已从后端读取');
            })
            .catch(function (err) {
                currentProfile = defaultProfile();
                fillForm(currentProfile);
                showStatus('error', err.message || '无法连接后端服务');
            });
    }

    function saveProfile() {
        var profile = collectProfile();
        if (!profile.nickname) {
            showStatus('error', '请填写昵称');
            nicknameInput.focus();
            return;
        }

        setButtonLoading(saveBtn, true, '保存中...');
        fetch(API_BASE, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ profile: profile })
        })
            .then(function (res) { return res.json(); })
            .then(function (result) {
                if (!result.success) throw new Error(result.error || '保存失败');
                currentProfile = normalizeProfile(result.data && result.data.profile);
                fillForm(currentProfile);
                publishProfile(currentProfile);
                showStatus('success', '账号信息已保存');
            })
            .catch(function (err) {
                showStatus('error', err.message || '保存失败，请检查后端服务');
            })
            .finally(function () {
                setButtonLoading(saveBtn, false);
            });
    }

    function resizeAvatar(file) {
        return new Promise(function (resolve, reject) {
            if (!file || !file.type || file.type.indexOf('image/') !== 0) {
                reject(new Error('请选择图片文件'));
                return;
            }
            var reader = new FileReader();
            reader.onload = function () {
                var img = new Image();
                img.onload = function () {
                    var size = 256;
                    var canvas = document.createElement('canvas');
                    canvas.width = size;
                    canvas.height = size;
                    var ctx = canvas.getContext('2d');
                    var side = Math.min(img.width, img.height);
                    var sx = Math.max(0, (img.width - side) / 2);
                    var sy = Math.max(0, (img.height - side) / 2);
                    ctx.drawImage(img, sx, sy, side, side, 0, 0, size, size);
                    resolve(canvas.toDataURL('image/jpeg', 0.88));
                };
                img.onerror = function () { reject(new Error('头像图片读取失败')); };
                img.src = reader.result;
            };
            reader.onerror = function () { reject(new Error('头像图片读取失败')); };
            reader.readAsDataURL(file);
        });
    }

    function chooseAvatar() {
        if (avatarInput) avatarInput.click();
    }

    avatarBtn.addEventListener('click', chooseAvatar);
    changeAvatarBtn.addEventListener('click', chooseAvatar);
    avatarInput.addEventListener('change', function () {
        var file = avatarInput.files && avatarInput.files[0];
        if (!file) return;
        resizeAvatar(file)
            .then(function (dataUrl) {
                pendingAvatar = dataUrl;
                updatePreview(Object.assign({}, collectProfile(), { avatar: pendingAvatar }));
                showStatus('info', '头像已选择，点击保存后生效');
            })
            .catch(function (err) {
                showStatus('error', err.message || '头像处理失败');
            })
            .finally(function () {
                avatarInput.value = '';
            });
    });

    [nicknameInput, roleInput].forEach(function (input) {
        input.addEventListener('input', function () {
            updatePreview(collectProfile());
        });
    });
    saveBtn.addEventListener('click', saveProfile);
    cancelBtn.addEventListener('click', function () {
        fillForm(currentProfile || defaultProfile());
        showStatus('info', '已恢复为上次保存的账号信息');
    });

    root.dataset.profileBound = '1';
    loadProfile();
}

// 主题切换逻辑
        initAccountProfile();
    });
})(typeof window !== 'undefined' ? window : this);
