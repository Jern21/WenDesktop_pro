/**
 * 应用更新日志（顶栏「更新日志」）
 *
 * 数据源：仓库根目录 CHANGELOG.json（本地 /CHANGELOG.json，线上 GitHub Raw）
 * 维护：只改 CHANGELOG.json 里的 latestVersion 与 entries，push 到 GitHub 后
 *       其他环境打开应用即可对比「当前运行版本」与「线上最新版本」。
 */
(function (global) {
    'use strict';

    var LOCAL_URL = '/CHANGELOG.json';
    var STORAGE_KEY = 'wt_changelog_seen';

    var state = {
        local: null,
        remote: null,
        remoteError: null,
        loading: false,
        loaded: false
    };

    function escapeHtml(value) {
        if (global.App && global.App.dom && global.App.dom.escapeHtml) {
            return global.App.dom.escapeHtml(value);
        }
        return String(value == null ? '' : value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function parseVersion(v) {
        var parts = String(v || '0').replace(/^v/i, '').split('.');
        var out = [];
        for (var i = 0; i < 3; i++) {
            out.push(parseInt(parts[i], 10) || 0);
        }
        return out;
    }

    function compareVersion(a, b) {
        var pa = parseVersion(a);
        var pb = parseVersion(b);
        for (var i = 0; i < 3; i++) {
            if (pa[i] > pb[i]) return 1;
            if (pa[i] < pb[i]) return -1;
        }
        return 0;
    }

    function getLocalVersion() {
        return (state.local && state.local.latestVersion) || '0.0.0';
    }

    function getRemoteVersion() {
        return (state.remote && state.remote.latestVersion) || null;
    }

    function getRemoteUrl() {
        if (state.local && state.local.changelogRawUrl) return state.local.changelogRawUrl;
        if (state.remote && state.remote.changelogRawUrl) return state.remote.changelogRawUrl;
        return '';
    }

    function readSeen() {
        try {
            var raw = localStorage.getItem(STORAGE_KEY);
            if (!raw) return { local: '', remote: '' };
            return JSON.parse(raw);
        } catch (e) {
            return { local: '', remote: '' };
        }
    }

    function writeSeen(localVer, remoteVer) {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify({
                local: localVer || '',
                remote: remoteVer || ''
            }));
        } catch (e) { /* ignore */ }
    }

    function fetchJson(url) {
        return fetch(url, { cache: 'no-store', credentials: 'same-origin' }).then(function (res) {
            if (!res.ok) throw new Error('HTTP ' + res.status);
            return res.json();
        });
    }

    function loadRemote() {
        var url = getRemoteUrl();
        if (!url) {
            state.remoteError = '未配置 changelogRawUrl';
            return Promise.resolve(null);
        }
        return fetch(url, { cache: 'no-store', mode: 'cors' })
            .then(function (res) {
                if (!res.ok) throw new Error('HTTP ' + res.status);
                return res.json();
            })
            .then(function (data) {
                state.remote = data;
                state.remoteError = null;
                return data;
            })
            .catch(function (err) {
                state.remote = null;
                state.remoteError = err && err.message ? err.message : 'fetch failed';
                return null;
            });
    }

    function ensureData() {
        if (state.loaded && !state.loading) return Promise.resolve(state);
        if (state.loading) {
            return new Promise(function (resolve) {
                var tick = function () {
                    if (!state.loading) resolve(state);
                    else setTimeout(tick, 50);
                };
                tick();
            });
        }
        state.loading = true;
        return fetchJson(LOCAL_URL)
            .then(function (data) {
                state.local = data;
                return loadRemote();
            })
            .catch(function () {
                state.local = {
                    latestVersion: '0.0.0',
                    entries: [],
                    repository: '',
                    changelogRawUrl: ''
                };
                return loadRemote();
            })
            .then(function () {
                state.loaded = true;
                state.loading = false;
                syncBadge();
                return state;
            });
    }

    function tagClass(tag) {
        if (tag === '重大更新') return 'bg-brand-50 text-brand-700';
        if (tag === '首发') return 'bg-purple-50 text-purple-700';
        return 'bg-gray-100 text-gray-600';
    }

    function pickDisplayEntries() {
        var source = state.remote && state.remote.entries && state.remote.entries.length
            ? state.remote
            : state.local;
        return (source && source.entries) ? source.entries.slice() : [];
    }

    function buildSyncStatusHtml() {
        var localV = getLocalVersion();
        var remoteV = getRemoteVersion();
        var repo = (state.local && state.local.repository) || (state.remote && state.remote.repository) || '';
        var rawUrl = getRemoteUrl();
        var parts = [
            '<div class="mb-4 rounded-lg border border-gray-100 bg-gray-50 px-4 py-3 text-sm text-gray-600 space-y-2">',
            '<div class="flex flex-wrap items-center gap-x-3 gap-y-1">',
            '<span>当前运行 <strong class="text-gray-900">v' + escapeHtml(localV) + '</strong></span>'
        ];

        if (remoteV) {
            parts.push('<span>GitHub 线上 <strong class="text-gray-900">v' + escapeHtml(remoteV) + '</strong></span>');
            var cmp = compareVersion(remoteV, localV);
            if (cmp > 0) {
                parts.push(
                    '<span class="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-800">线上较新，建议 pull / 重新部署</span>'
                );
            } else if (cmp < 0) {
                parts.push(
                    '<span class="text-xs font-semibold px-2 py-0.5 rounded-full bg-sky-50 text-sky-800">本地 changelog 未 push，请提交 CHANGELOG.json</span>'
                );
            } else {
                parts.push(
                    '<span class="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800">与线上一致</span>'
                );
            }
        } else if (state.remoteError) {
            parts.push(
                '<span class="text-xs text-gray-400">未能拉取 GitHub（' + escapeHtml(state.remoteError) + '），仅显示本地日志</span>'
            );
        }

        parts.push('</div>');

        if (remoteV && compareVersion(remoteV, localV) > 0) {
            var pending = (state.remote.entries || []).filter(function (entry) {
                return compareVersion(entry.version, localV) > 0;
            });
            if (pending.length) {
                parts.push('<p class="text-xs text-amber-800">相对本机，线上另有 ' + pending.length + ' 个版本更新：</p>');
                parts.push('<ul class="text-xs list-disc pl-4 text-amber-900/90">');
                pending.forEach(function (entry) {
                    parts.push('<li>v' + escapeHtml(entry.version) + ' · ' + escapeHtml(entry.title) + '</li>');
                });
                parts.push('</ul>');
            }
        }

        if (repo || rawUrl) {
            parts.push('<p class="text-xs text-gray-400 flex flex-wrap gap-3">');
            if (repo) {
                parts.push('<a href="' + escapeHtml(repo) + '" target="_blank" rel="noopener noreferrer" class="text-brand-600 hover:underline">打开 GitHub 仓库</a>');
            }
            if (rawUrl) {
                parts.push('<a href="' + escapeHtml(rawUrl) + '" target="_blank" rel="noopener noreferrer" class="text-brand-600 hover:underline">线上 CHANGELOG.json</a>');
            }
            parts.push('</p>');
        }

        parts.push('</div>');
        return parts.join('');
    }

    function buildContentHtml() {
        var entries = pickDisplayEntries();
        var localV = getLocalVersion();
        var parts = [
            buildSyncStatusHtml(),
            '<p class="text-sm text-gray-500 mb-4">维护说明：在仓库根目录编辑 <code class="px-1 bg-gray-100 rounded text-xs">CHANGELOG.json</code> 并 push 到 GitHub，应用将通过 Raw 链接同步对比。</p>',
            '<div class="space-y-5">'
        ];

        entries.forEach(function (entry, index) {
            var isLatest = index === 0;
            var newerThanLocal = compareVersion(entry.version, localV) > 0;
            parts.push(
                '<section class="relative pl-4 border-l-2 ' + (isLatest ? 'border-brand-500' : 'border-gray-200') + '">',
                '<div class="flex flex-wrap items-center gap-2 mb-1">',
                '<span class="text-sm font-bold text-gray-900">v' + escapeHtml(entry.version) + '</span>',
                '<span class="text-xs text-gray-400">' + escapeHtml(entry.date) + '</span>'
            );
            if (newerThanLocal && getRemoteVersion()) {
                parts.push('<span class="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700">仅线上</span>');
            }
            if (entry.tag) {
                parts.push(
                    '<span class="text-[10px] font-semibold px-2 py-0.5 rounded-full ' +
                    tagClass(entry.tag) + '">' + escapeHtml(entry.tag) + '</span>'
                );
            }
            parts.push(
                '</div>',
                '<h4 class="text-sm font-medium text-gray-800 mb-2">' + escapeHtml(entry.title) + '</h4>',
                '<ul class="space-y-1.5 text-sm text-gray-600 leading-relaxed list-disc pl-4">'
            );
            (entry.highlights || []).forEach(function (line) {
                parts.push('<li>' + escapeHtml(line) + '</li>');
            });
            parts.push('</ul></section>');
        });

        parts.push('</div>');
        return parts.join('');
    }

    function hasUnread() {
        var seen = readSeen();
        var localV = getLocalVersion();
        if (!state.loaded) return seen.local !== localV;
        if (seen.local !== localV) return true;
        var remoteV = getRemoteVersion();
        if (remoteV && compareVersion(remoteV, localV) > 0 && seen.remote !== remoteV) return true;
        return false;
    }

    function markSeen() {
        writeSeen(getLocalVersion(), getRemoteVersion() || '');
        syncBadge();
    }

    function syncBadge() {
        var badge = document.getElementById('changelog-badge');
        if (!badge) return;
        badge.style.display = hasUnread() ? 'block' : 'none';
    }

    function openFallbackModal(html) {
        var overlay = document.createElement('div');
        overlay.className = 'fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-[100000]';
        overlay.innerHTML =
            '<div class="bg-white rounded-xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden shadow-xl">' +
            '<div class="flex items-center justify-between px-5 py-4 border-b border-gray-100">' +
            '<h3 class="text-base font-medium text-gray-900">更新日志</h3>' +
            '<button type="button" id="changelog-fallback-close" class="text-gray-400 hover:text-gray-600">' +
            '<i class="ph ph-x text-lg"></i></button></div>' +
            '<div class="flex-1 overflow-y-auto px-5 py-4 changelog-modal-body">' + html + '</div></div>';
        document.body.appendChild(overlay);
        document.body.style.overflow = 'hidden';
        function close() {
            if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
            document.body.style.overflow = '';
            markSeen();
        }
        overlay.addEventListener('click', function (e) {
            if (e.target === overlay || e.target.closest('#changelog-fallback-close')) close();
        });
        markSeen();
    }

    function open() {
        ensureData().then(function () {
            var html = buildContentHtml();
            if (global.App && global.App.ui && typeof global.App.ui.modal === 'function') {
                global.App.ui.modal({
                    title: '更新日志',
                    width: 'max-w-2xl',
                    content: html,
                    onClose: syncBadge
                });
                markSeen();
                return;
            }
            openFallbackModal(html);
        });
    }

    ensureData();

    global.AppChangelog = {
        get version() { return getLocalVersion(); },
        ensureData: ensureData,
        compareVersion: compareVersion,
        open: open,
        hasUnread: hasUnread,
        markSeen: markSeen,
        syncBadge: syncBadge,
        refresh: function () {
            state.loaded = false;
            state.remote = null;
            return ensureData();
        }
    };
})(typeof window !== 'undefined' ? window : this);
