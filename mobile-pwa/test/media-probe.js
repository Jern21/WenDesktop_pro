/**
 * 素材库 / 发帖 / 收藏探针
 *
 * 跑法：http://127.0.0.1:3460/test/media-probe.html （后端需在 3456）
 */
import { loginWithCredentials } from '../src/api/auth.js';
import { api } from '../src/api/client.js';
import { startRouter, subscribe, navigate, getPath } from '../src/router.js';
import { mountMobileShell, updateMobileShell } from '../src/mobile-shell.js';
import { posterListSession, postListSession, bookmarkListSession } from '../src/views/browse-session.js';

var results = [];
var created = { poster: '', post: '', link: '', bad: '' };
var opened = [];
var nativeOpen = window.open;

function record(name, ok, detail) {
    results.push({ name: name, ok: !!ok, detail: detail || '' });
}

function sleep(ms) {
    return new Promise(function (r) { setTimeout(r, ms); });
}

async function waitFor(fn, timeout, label) {
    var deadline = Date.now() + (timeout || 8000);
    while (Date.now() < deadline) {
        var v = fn();
        if (v) return v;
        await sleep(60);
    }
    throw new Error('等待超时：' + (label || ''));
}

function appEl() { return document.getElementById('app'); }

function textHas(selector, text) {
    var nodes = appEl().querySelectorAll(selector);
    for (var i = 0; i < nodes.length; i++) {
        if (nodes[i].textContent.indexOf(text) !== -1) return nodes[i];
    }
    return null;
}

function cardTitled(title) {
    var nodes = appEl().querySelectorAll('.br-card strong');
    for (var i = 0; i < nodes.length; i++) {
        if (nodes[i].textContent === title) return nodes[i].closest('.br-card');
    }
    return null;
}

async function run() {
    posterListSession.filters.keyword = '';
    posterListSession.filters.platform = '';
    posterListSession.filters.label = '';
    postListSession.filters.keyword = '';
    postListSession.filters.platform = '';
    postListSession.filters.status = '';
    postListSession.snapshot = null;
    bookmarkListSession.filters.keyword = '';
    bookmarkListSession.filters.category = '';
    bookmarkListSession.snapshot = null;
    window.open = function (url) {
        opened.push(url);
        return null;
    };

    var login = await loginWithCredentials('trial', '', false);
    if (!login.ok) throw new Error('trial 登录失败：' + (login.error || ''));

    startRouter();
    subscribe(function (path) { updateMobileShell(path); });
    mountMobileShell(appEl(), '/posters');
    navigate('/posters');

    var img = await waitFor(function () { return appEl().querySelector('.br-shot img[src]'); }, 12000, '素材图');
    var src = img.getAttribute('src') || '';
    record('图片地址不带 token', src.indexOf('token=') === -1 && src.indexOf('/uploads/') !== -1, src.slice(0, 80));
    var imageRes = await fetch(src, { credentials: 'include' });
    record('图片请求带上登录 Cookie', imageRes.status === 200, 'status=' + imageRes.status);

    appEl().querySelector('[data-platform="xianyu"]').click();
    await waitFor(function () {
        var shots = appEl().querySelectorAll('.br-shot');
        if (!shots.length) return null;
        for (var i = 0; i < shots.length; i++) {
            if (shots[i].textContent.indexOf('闲鱼') === -1) return null;
        }
        return shots[0];
    }, 8000, '闲鱼筛选');
    record('平台筛选后只剩闲鱼', true, '');

    var stamp = '探针素材' + Date.now();
    var posterRes = await api.post('/api/posters', {
        title: stamp,
        platform: 'xianyu',
        sourceUrl: 'https://example.com/poster-' + stamp
    });
    created.poster = posterRes && posterRes.data && posterRes.data.id;
    record('探针素材已创建', !!created.poster, created.poster || '');

    var search = appEl().querySelector('.br-search');
    search.value = stamp;
    search.dispatchEvent(new Event('input', { bubbles: true }));
    var shot = await waitFor(function () { return textHas('.br-shot', stamp); }, 8000, '搜到素材');
    shot.click();
    var link = await waitFor(function () { return document.querySelector('.br-lightbox .br-ext'); }, 4000, '原文链接');
    record('原文链接是 https', (link.getAttribute('href') || '').indexOf('https://example.com/poster-') === 0, link.getAttribute('href'));
    document.querySelector('.br-lightbox [data-act="close"]').click();

    var postRes = await api.post('/api/platform-posts', {
        title: stamp,
        platform: 'douyin',
        status: 'published',
        content: '探针正文',
        videoUrl: 'https://example.com/video-' + stamp
    });
    created.post = postRes && postRes.data && postRes.data.id;
    record('探针发帖已创建', !!created.post, created.post || '');

    navigate('/platform-posts');
    await waitFor(function () { return appEl().querySelector('.br-search'); }, 8000, '发帖列表');
    appEl().querySelector('[data-platform="douyin"]').click();
    appEl().querySelector('[data-status="published"]').click();
    search = await waitFor(function () { return appEl().querySelector('.br-search'); }, 4000, '搜索框');
    search.value = stamp;
    search.dispatchEvent(new Event('input', { bubbles: true }));
    var card = await waitFor(function () { return textHas('.br-card', stamp); }, 8000, '搜到发帖');
    record('平台和状态筛选能留下这条发帖', card.textContent.indexOf('抖音') !== -1 && card.textContent.indexOf('已发布') !== -1, '');
    card.click();
    var video = await waitFor(function () {
        var a = appEl().querySelector('.br-ext');
        return a && (a.getAttribute('href') || '').indexOf('https://example.com/video-') === 0 ? a : null;
    }, 8000, '视频链接');
    record('发帖详情能打开外部视频', true, video.getAttribute('href'));
    record('发帖详情不把 token 写进页面', appEl().innerHTML.indexOf('token=') === -1, '');

    var good = await api.post('/api/bookmarks', {
        title: stamp,
        url: 'https://example.com/go-' + stamp,
        category: 'tools'
    });
    var bad = await api.post('/api/bookmarks', {
        title: stamp + '坏链',
        url: 'javascript:alert(1)',
        category: 'tools'
    });
    created.link = good && good.data && good.data.id;
    created.bad = bad && bad.data && bad.data.id;
    record('探针收藏已创建', !!created.link && !!created.bad, '');

    navigate('/bookmarks');
    await waitFor(function () { return appEl().querySelector('.br-search'); }, 8000, '收藏列表');
    appEl().querySelector('[data-cat="tools"]').click();
    search = appEl().querySelector('.br-search');
    search.value = stamp;
    search.dispatchEvent(new Event('input', { bubbles: true }));
    var badCard = await waitFor(function () { return cardTitled(stamp + '坏链'); }, 8000, '坏链');
    opened = [];
    badCard.click();
    await waitFor(function () {
        return document.body.textContent.indexOf('不能打开') !== -1;
    }, 4000, '坏链提示');
    record('javascript 链接不会被打开', opened.length === 0, String(opened.length));

    var goodCard = await waitFor(function () { return cardTitled(stamp); }, 4000, '好链');
    opened = [];
    goodCard.click();
    await waitFor(function () { return opened.length === 1; }, 4000, '打开链接');
    record('http 链接会在新窗口打开', opened[0].indexOf('https://example.com/go-') === 0, opened[0]);
    await sleep(300);
    var listed = await api.get('/api/bookmarks?keyword=' + encodeURIComponent(stamp));
    var row = (listed.data || []).filter(function (item) { return item.id === created.link; })[0];
    record('点击后次数加一', row && row.clickCount >= 1, String(row && row.clickCount));

    return results;
}

function cleanup() {
    window.open = nativeOpen;
    var jobs = [];
    if (created.poster) jobs.push(api.del('/api/posters/' + encodeURIComponent(created.poster)).catch(function () { return null; }));
    if (created.post) jobs.push(api.del('/api/platform-posts/' + encodeURIComponent(created.post)).catch(function () { return null; }));
    if (created.link) jobs.push(api.del('/api/bookmarks/' + encodeURIComponent(created.link)).catch(function () { return null; }));
    if (created.bad) jobs.push(api.del('/api/bookmarks/' + encodeURIComponent(created.bad)).catch(function () { return null; }));
    created.poster = '';
    created.post = '';
    created.link = '';
    created.bad = '';
    return Promise.all(jobs);
}

run().then(function (list) {
    return cleanup().then(function () { return list; });
}).then(function (list) {
    var failed = list.filter(function (r) { return !r.ok; });
    var text = list.map(function (r) {
        return (r.ok ? '✓ ' : '✗ ') + r.name + (r.detail ? '  [' + r.detail + ']' : '');
    });
    text.push('');
    text.push(failed.length ? ('失败 ' + failed.length + ' / 共 ' + list.length) : ('全部通过：' + list.length + ' 项'));
    var pre = document.getElementById('result');
    pre.textContent = text.join('\n');
    pre.className = failed.length ? 'bad' : 'ok';
    document.body.setAttribute('data-probe-result', failed.length ? 'FAIL' : 'OK');
}).catch(function (e) {
    cleanup().then(function () {
        var pre = document.getElementById('result');
        var done = results.map(function (r) {
            return (r.ok ? '✓ ' : '✗ ') + r.name + (r.detail ? '  [' + r.detail + ']' : '');
        });
        done.push('');
        done.push('探针异常：' + (e && e.message ? e.message : e));
        pre.textContent = done.join('\n');
        pre.className = 'bad';
        document.body.setAttribute('data-probe-result', 'ERROR');
    });
});
