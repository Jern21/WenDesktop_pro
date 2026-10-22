/**
 * 账号密码。接口返回的是明文，这里立刻打码，原始密码不进 DOM，也不回写。
 */
import '../../styles/browse.css';
import '../../styles/stats.css';
import { accounts } from '../../api/resources.js';
import { escapeHtml, maskSecret } from '../../lib/format.js';

var filters = { keyword: '', platform: '' };

function toSafe(item, names) {
    var platform = names[item.platform] || item.customPlatform || item.platform || '其他';
    return {
        id: item.id,
        platform: platform,
        name: item.accountName || '未命名账号',
        email: item.email || '',
        secret: maskSecret(item.password),
        remark: item.remark || ''
    };
}

export function mountAccountsPanel(container) {
    var alive = true;
    var gen = 0;
    var names = {};
    var platformList = [];
    var keywordTimer = null;

    container.innerHTML =
        '<div class="st-page br-page">' +
        '  <div class="br-tools">' +
        '    <input class="br-search" type="search" enterkeyhint="search" placeholder="搜账号、邮箱" aria-label="搜索账号" />' +
        '    <div class="br-chips"></div>' +
        '  </div>' +
        '  <div class="st-body"></div>' +
        '</div>';

    var search = container.querySelector('.br-search');
    var chips = container.querySelector('.br-chips');
    var body = container.querySelector('.st-body');
    search.value = filters.keyword || '';

    function paintChips() {
        var all = [{ id: '', name: '全部' }].concat(platformList);
        chips.innerHTML = all.map(function (item) {
            var on = item.id === filters.platform ? ' is-active' : '';
            return '<button type="button" class="br-chip' + on + '" data-platform="' +
                escapeHtml(item.id) + '">' + escapeHtml(item.name) + '</button>';
        }).join('');
    }
    paintChips();

    accounts.platforms().then(function (res) {
        var list = res && res.data;
        if (Array.isArray(list)) {
            platformList = list.filter(function (item) { return item && item.id; });
            platformList.forEach(function (item) { names[item.id] = item.name || item.id; });
        }
    }).catch(function () {}).then(function () {
        if (!alive) return;
        paintChips();
        load();
    });

    function render(items) {
        if (!items.length) {
            body.innerHTML = '<div class="st-state"><p>没有符合条件的账号</p></div>';
            return;
        }
        body.innerHTML = items.map(function (item) {
            return '<article class="st-block">' +
                '<h2>' + escapeHtml(item.name) + '</h2>' +
                '<p class="st-row-meta">' + escapeHtml(item.platform) + '</p>' +
                (item.email ? '<p class="st-row-meta">' + escapeHtml(item.email) + '</p>' : '') +
                (item.secret ? '<p class="st-row-meta">密码 ' + escapeHtml(item.secret) + '</p>' : '<p class="st-row-meta">未记录密码</p>') +
                (item.remark ? '<p class="st-row-meta">' + escapeHtml(item.remark) + '</p>' : '') +
                '</article>';
        }).join('');
    }

    function load() {
        gen += 1;
        var token = gen;
        body.innerHTML = '<div class="st-state"><p>加载中…</p></div>';
        var params = {};
        if (filters.keyword) params.keyword = filters.keyword;
        if (filters.platform) params.platform = filters.platform;
        accounts.list(params).then(function (res) {
            if (!alive || token !== gen) return;
            var list = res && res.data;
            var safe = (Array.isArray(list) ? list : []).map(function (item) {
                return toSafe(item || {}, names);
            });
            render(safe);
        }).catch(function (err) {
            if (!alive || token !== gen) return;
            body.innerHTML = '<div class="st-state"><p></p><button type="button" data-act="retry">重试</button></div>';
            body.querySelector('p').textContent = (err && err.message) || '加载失败';
        });
    }

    function onClick(e) {
        var chip = e.target.closest && e.target.closest('[data-platform]');
        if (chip && chips.contains(chip)) {
            filters.platform = chip.getAttribute('data-platform') || '';
            paintChips();
            load();
            return;
        }
        var retry = e.target.closest && e.target.closest('[data-act="retry"]');
        if (retry && body.contains(retry)) load();
    }

    search.addEventListener('input', function () {
        filters.keyword = search.value.trim();
        clearTimeout(keywordTimer);
        keywordTimer = setTimeout(load, 300);
    });
    container.addEventListener('click', onClick);

    return {
        destroy: function () {
            alive = false;
            gen += 1;
            clearTimeout(keywordTimer);
            container.removeEventListener('click', onClick);
            container.innerHTML = '';
        }
    };
}
