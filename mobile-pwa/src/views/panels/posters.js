/**
 * 素材库。图片地址走 resolveAssetUrl，靠登录 Cookie 取图，不把 token 写进地址。
 * 只读。外部原文链接只放行 http/https。
 */
import '../../styles/browse.css';
import { posters } from '../../api/resources.js';
import { escapeHtml, platformLabel } from '../../lib/format.js';
import { assetSrc, safeHttpUrl, wireImageFallback } from '../../lib/urls.js';
import { posterListSession } from '../browse-session.js';

var PLATFORMS = [
    { value: '', label: '全部平台' },
    { value: 'xianyu', label: '闲鱼' },
    { value: 'xiaohongshu', label: '小红书' },
    { value: 'douyin', label: '抖音' },
    { value: 'wechat', label: '微信' }
];

function safeColor(value) {
    return /^#[0-9a-fA-F]{3,8}$/.test(String(value || '')) ? value : '';
}

export function mountPostersPanel(container) {
    var filters = posterListSession.filters;
    var alive = true;
    var keywordTimer = null;
    var loadGen = 0;
    var lightbox = null;

    container.innerHTML =
        '<div class="br-page">' +
        '  <div class="br-tools">' +
        '    <input class="br-search" type="search" enterkeyhint="search" placeholder="搜标题、标签" aria-label="搜索素材" />' +
        '    <div class="br-chips br-platforms"></div>' +
        '    <div class="br-chips br-labels"></div>' +
        '    <p class="br-count"></p>' +
        '  </div>' +
        '  <div class="br-grid"></div>' +
        '</div>';

    var scroller = container.closest('.mobile-content') || container;
    var search = container.querySelector('.br-search');
    var platforms = container.querySelector('.br-platforms');
    var labels = container.querySelector('.br-labels');
    var countEl = container.querySelector('.br-count');
    var grid = container.querySelector('.br-grid');
    search.value = filters.keyword || '';
    wireImageFallback(grid);

    function paintPlatforms() {
        platforms.innerHTML = PLATFORMS.map(function (chip) {
            var on = chip.value === filters.platform ? ' is-active' : '';
            return '<button type="button" class="br-chip' + on + '" data-platform="' +
                escapeHtml(chip.value) + '">' + escapeHtml(chip.label) + '</button>';
        }).join('');
    }

    function paintLabels(list) {
        var chips = [{ label: '全部标签', value: '' }].concat((list || []).map(function (item) {
            return { label: item.label, value: item.label };
        }));
        labels.innerHTML = chips.map(function (chip) {
            var on = chip.value === filters.label ? ' is-active' : '';
            return '<button type="button" class="br-chip' + on + '" data-label="' +
                escapeHtml(chip.value) + '">' + escapeHtml(chip.label) + '</button>';
        }).join('');
    }

    function loadLabels() {
        var params = {};
        if (filters.platform) params.platform = filters.platform;
        posters.labels(params).then(function (res) {
            if (!alive) return;
            var list = res && res.data;
            paintLabels(Array.isArray(list) ? list : []);
        }).catch(function () {
            if (alive) paintLabels([]);
        });
    }

    function render(items) {
        countEl.textContent = '共 ' + items.length + ' 张';
        if (!items.length) {
            grid.innerHTML = '<div class="br-state"><p>没有符合条件的素材</p></div>';
            return;
        }
        grid.innerHTML = items.map(function (item) {
            var src = assetSrc(item.image);
            var color = safeColor(item.labelColor);
            return '<button type="button" class="br-shot" data-id="' + escapeHtml(item.id) + '">' +
                (src ? '<img data-asset alt="" src="' + escapeHtml(src) + '" />' : '<span class="br-shot-empty"></span>') +
                '<strong>' + escapeHtml(item.title || '未命名素材') + '</strong>' +
                '<p class="br-meta">' + escapeHtml(platformLabel(item.platform)) +
                (item.labelText ? ' · ' + escapeHtml(item.labelText) : '') + '</p>' +
                (color ? '<span class="br-badge" data-color="' + escapeHtml(color) + '" hidden></span>' : '') +
                '</button>';
        }).join('');
        var byId = {};
        items.forEach(function (item) { byId[item.id] = item; });
        grid.__items = byId;
        if (posterListSession.scrollTop) {
            var y = posterListSession.scrollTop;
            posterListSession.scrollTop = 0;
            requestAnimationFrame(function () { scroller.scrollTop = y; });
        }
    }

    function load() {
        loadGen += 1;
        var gen = loadGen;
        grid.innerHTML = '<div class="br-state"><p>加载中…</p></div>';
        var params = {};
        if (filters.keyword) params.keyword = filters.keyword;
        if (filters.platform) params.platform = filters.platform;
        if (filters.label) params.label = filters.label;
        posters.list(params).then(function (res) {
            if (!alive || gen !== loadGen) return;
            var data = res && res.data;
            render(Array.isArray(data) ? data : []);
        }).catch(function (err) {
            if (!alive || gen !== loadGen) return;
            countEl.textContent = '';
            grid.innerHTML = '<div class="br-state"><p></p><button type="button" data-act="retry">重试</button></div>';
            grid.querySelector('p').textContent = (err && err.message) || '加载失败';
        });
    }

    function closeLightbox() {
        if (!lightbox) return;
        lightbox.remove();
        lightbox = null;
    }

    function openLightbox(item) {
        closeLightbox();
        var src = assetSrc(item.image);
        var link = safeHttpUrl(item.sourceUrl);
        lightbox = document.createElement('div');
        lightbox.className = 'br-lightbox';
        lightbox.innerHTML =
            '<div class="sheet-panel" role="dialog" aria-modal="true">' +
            (src ? '<img data-asset alt="" src="' + escapeHtml(src) + '" />' : '') +
            '<h3 class="sheet-title"></h3>' +
            '<p class="br-meta"></p>' +
            (link ? '<a class="br-ext" target="_blank" rel="noopener noreferrer"></a>' : '<p class="br-meta">没有可打开的原文链接</p>') +
            '<div class="sheet-actions"><button type="button" class="sheet-btn" data-act="close">关闭</button></div>' +
            '</div>';
        lightbox.querySelector('.sheet-title').textContent = item.title || '未命名素材';
        lightbox.querySelector('.br-meta').textContent = platformLabel(item.platform) +
            (item.labelText ? ' · ' + item.labelText : '');
        if (link) {
            var anchor = lightbox.querySelector('.br-ext');
            anchor.href = link;
            anchor.textContent = '打开原文';
        }
        wireImageFallback(lightbox);
        lightbox.addEventListener('click', function (e) {
            if (e.target === lightbox || (e.target.getAttribute && e.target.getAttribute('data-act') === 'close')) {
                closeLightbox();
            }
        });
        document.body.appendChild(lightbox);
    }

    function onClick(e) {
        var platformBtn = e.target.closest && e.target.closest('[data-platform]');
        if (platformBtn && platforms.contains(platformBtn)) {
            filters.platform = platformBtn.getAttribute('data-platform') || '';
            filters.label = '';
            paintPlatforms();
            loadLabels();
            load();
            return;
        }
        var labelBtn = e.target.closest && e.target.closest('[data-label]');
        if (labelBtn && labels.contains(labelBtn)) {
            filters.label = labelBtn.getAttribute('data-label') || '';
            paintLabelsFromDom();
            load();
            return;
        }
        var retry = e.target.closest && e.target.closest('[data-act="retry"]');
        if (retry && grid.contains(retry)) {
            load();
            return;
        }
        var shot = e.target.closest && e.target.closest('.br-shot');
        if (shot && grid.contains(shot)) {
            var item = grid.__items && grid.__items[shot.getAttribute('data-id')];
            if (item) openLightbox(item);
        }
    }

    function paintLabelsFromDom() {
        labels.querySelectorAll('[data-label]').forEach(function (btn) {
            btn.classList.toggle('is-active', btn.getAttribute('data-label') === filters.label);
        });
    }

    search.addEventListener('input', function () {
        filters.keyword = search.value.trim();
        clearTimeout(keywordTimer);
        keywordTimer = setTimeout(load, 300);
    });
    container.addEventListener('click', onClick);
    paintPlatforms();
    loadLabels();
    load();

    return {
        destroy: function () {
            alive = false;
            clearTimeout(keywordTimer);
            closeLightbox();
            container.removeEventListener('click', onClick);
            posterListSession.scrollTop = scroller.scrollTop;
        }
    };
}
