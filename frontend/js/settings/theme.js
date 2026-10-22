(function (global) {
    'use strict';
    global.SettingsPage.section(function (ctx) {
function initThemeSwitcher() {
    var themeCards = document.querySelectorAll('.theme-card');
    if (!themeCards.length || themeCards[0].dataset.themeBound) return;

    function updateUI(theme) {
        themeCards.forEach(function(card) {
            var val = card.dataset.themeValue;
            var check = card.querySelector('.theme-check');
            if (val === theme) {
                card.style.borderColor = '#3b82f6';
                card.style.boxShadow = '0 0 0 3px rgba(59,130,246,0.1)';
                if (check) {
                    check.style.borderColor = '#3b82f6';
                    check.style.backgroundColor = '#3b82f6';
                    var icon = check.querySelector('i');
                    if (icon) { icon.style.color = '#fff'; }
                }
            } else {
                card.style.borderColor = '#e5e7eb';
                card.style.boxShadow = 'none';
                if (check) {
                    check.style.borderColor = '#d1d5db';
                    check.style.backgroundColor = 'transparent';
                    var icon = check.querySelector('i');
                    if (icon) { icon.style.color = 'transparent'; }
                }
            }
        });
    }

    // 初始化当前选中状态
    var currentTheme = (window.AppTheme && window.AppTheme.get()) || 'pure-white';
    updateUI(currentTheme);

    // 绑定点击切换
    themeCards.forEach(function(card) {
        card.addEventListener('click', function() {
            var theme = card.dataset.themeValue;
            if (window.AppTheme) {
                window.AppTheme.set(theme);
                updateUI(theme);
            }
        });
    });

    // 监听主题变化（其他页面也可能触发）
    window.addEventListener('themechange', function(e) {
        updateUI(e.detail.theme);
    });

    // 所有逻辑完成后才标记为已绑定（放在末尾确保异常时允许重试）
    themeCards[0].dataset.themeBound = '1';
}

// ========== AI生图配置 ==========
        initThemeSwitcher();
    });
})(typeof window !== 'undefined' ? window : this);
