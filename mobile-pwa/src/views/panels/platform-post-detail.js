/**
 * 发帖详情：正文、配图、视频外链。只读。
 */
import '../../styles/browse.css';
import { platformPosts } from '../../api/resources.js';
import { escapeHtml, formatDate, platformLabel, postStatusLabel } from '../../lib/format.js';
import { assetSrc, safeHttpUrl, wireImageFallback } from '../../lib/urls.js';
import { goBack } from '../../router.js';

export function mountPlatformPostDetailPanel(container, route) {
    var id = route && route.params ? route.params.id : '';
    var alive = true;

    container.innerHTML = '<div class="br-detail"></div>';
    var root = container.querySelector('.br-detail');
    wireImageFallback(root);

    function showState(message, act, label) {
        root.innerHTML = '<div class="br-state"><p></p>' +
            (act ? '<button type="button" data-act="' + act + '">' + escapeHtml(label) + '</button>' : '') +
            '</div>';
        root.querySelector('p').textContent = message;
    }

    function render(post) {
        var images = Array.isArray(post.images) ? post.images : [];
        var video = safeHttpUrl(post.videoUrl);
        var stats = post.stats || {};
        root.innerHTML =
            '<section class="br-block">' +
            '<h1 class="br-name">' + escapeHtml(post.title || '未命名发帖') + '</h1>' +
            '<p class="br-meta">' + escapeHtml(platformLabel(post.platform) + ' · ' + postStatusLabel(post.status)) + '</p>' +
            '<p class="br-meta">' + escapeHtml([
                formatDate(post.publishTime, 'datetime') || post.publishTime || '',
                stats.views != null ? stats.views + ' 浏览' : '',
                stats.likes != null ? stats.likes + ' 赞' : ''
            ].filter(Boolean).join(' · ')) + '</p>' +
            (post.content ? '<p class="br-copy">' + escapeHtml(post.content) + '</p>' : '') +
            (video ? '<a class="br-ext" target="_blank" rel="noopener noreferrer" href="' + escapeHtml(video) + '">打开视频</a>' : '') +
            '</section>' +
            (images.length
                ? '<section class="br-block"><h2>配图</h2><div class="br-grid">' + images.map(function (image) {
                    var src = assetSrc(image);
                    return src ? '<img data-asset alt="" src="' + escapeHtml(src) + '" />' : '';
                }).join('') + '</div></section>'
                : '');
    }

    function load() {
        if (!id) {
            showState('发帖不存在', 'back', '返回发帖记录');
            return;
        }
        showState('加载中…');
        platformPosts.detail(id).then(function (res) {
            if (!alive) return;
            if (!res || !res.data) {
                showState('发帖不存在', 'back', '返回发帖记录');
                return;
            }
            render(res.data);
        }).catch(function (err) {
            if (!alive) return;
            var missing = err && err.status === 404;
            showState(
                (err && err.message) || (missing ? '发帖不存在' : '加载失败'),
                missing ? 'back' : 'retry',
                missing ? '返回发帖记录' : '重试'
            );
        });
    }

    function onClick(e) {
        var act = e.target.closest && e.target.closest('[data-act]');
        if (!act || !root.contains(act)) return;
        var name = act.getAttribute('data-act');
        if (name === 'back') goBack('/platform-posts');
        if (name === 'retry') load();
    }

    root.addEventListener('click', onClick);
    load();

    return {
        destroy: function () {
            alive = false;
            root.removeEventListener('click', onClick);
        }
    };
}
