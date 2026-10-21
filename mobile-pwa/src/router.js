var listeners = [];

function normalizePath(pathname) {
    if (!pathname) return '/';
    var p = String(pathname).split('#')[0];
    if (p.length > 1 && p.endsWith('/')) p = p.slice(0, -1);
    return p || '/';
}

export function getPath() {
    return normalizePath(location.pathname);
}

export function safeNextFromQuery() {
    var raw = new URLSearchParams(location.search).get('next') || '/';
    if (raw.charAt(0) !== '/' || raw.charAt(1) === '/' || raw.indexOf('\\') !== -1) {
        return '/';
    }
    return normalizePath(raw);
}

export function navigate(path, options) {
    var opts = options || {};
    var raw = String(path || '/');
    var qIndex = raw.indexOf('?');
    var pathname = qIndex === -1 ? raw : raw.slice(0, qIndex);
    var search = qIndex === -1 ? '' : raw.slice(qIndex);
    var targetPath = normalizePath(pathname);
    var url = targetPath + search;

    if (getPath() === targetPath && location.search === search) {
        notify();
        return;
    }
    if (opts.replace) {
        history.replaceState(null, '', url);
    } else {
        history.pushState(null, '', url);
    }
    notify();
}

export function subscribe(fn) {
    listeners.push(fn);
    return function () {
        var i = listeners.indexOf(fn);
        if (i !== -1) listeners.splice(i, 1);
    };
}

function notify() {
    listeners.forEach(function (fn) {
        try { fn(getPath()); } catch (e) { console.error(e); }
    });
}

export function startRouter() {
    window.addEventListener('popstate', function () { notify(); });
}
