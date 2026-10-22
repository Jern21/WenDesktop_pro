(function (global) {
    'use strict';
    global.SettingsPage.section(function (ctx) {
function initSettingsNav() {
    var navItems = document.querySelectorAll('.settings-nav-item');
    // 防重复绑定
    if (!navItems.length || navItems[0].dataset.navBound) return;
    navItems.forEach(function(item) {
        item.addEventListener('click', function(e) {
            e.preventDefault();
            navItems.forEach(function(n) { n.classList.remove('active'); });
            item.classList.add('active');
            // 滚动到对应区块
            var sectionId = item.dataset.section;
            var target = document.getElementById(sectionId);
            if (target) {
                var scrollContainer = target.closest('.overflow-y-auto');
                if (scrollContainer) {
                    var rect = target.getBoundingClientRect();
                    var containerRect = scrollContainer.getBoundingClientRect();
                    scrollContainer.scrollTo({
                        top: scrollContainer.scrollTop + rect.top - containerRect.top - 16,
                        behavior: 'smooth'
                    });
                } else {
                    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
            }
        });
        item.dataset.navBound = '1'; // 标记放在绑定之后
    });

    // 滚动时自动高亮对应区块
    var sections = document.querySelectorAll('div[id]');
    var observer = new IntersectionObserver(function(entries) {
        entries.forEach(function(entry) {
            if (entry.isIntersecting) {
                var id = entry.target.id;
                navItems.forEach(function(n) {
                    if (n.dataset.section === id) {
                        navItems.forEach(function(nn) { nn.classList.remove('active'); });
                        n.classList.add('active');
                    }
                });
            }
        });
    }, { rootMargin: '-20% 0px -70% 0px' });

    document.querySelectorAll('#account, #appearance, #menu-options, #security, #notification, #ai-image, #llm, #export, #backup, #bug-reports, #cleanup, #recycle, #about').forEach(function(sec) {
        observer.observe(sec);
    });
    return observer;
}

        var observer = initSettingsNav();
        return function () {
            if (observer && typeof observer.disconnect === 'function') observer.disconnect();
        };
    });
})(typeof window !== 'undefined' ? window : this);
