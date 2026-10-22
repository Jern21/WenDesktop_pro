/**
 * 资源地址解析（上传附件 / 海报图 / 头像）
 *
 * 为什么需要这一层：
 * 后端把附件挂在 `/uploads/*`，返回的是**根路径**（如 `/uploads/users/trial/uploads/a.jpg`）。
 * 开发时 Vite 把 `/uploads` 代理到后端，根路径能直接用；
 * 但真机直连（`VITE_API_BASE_URL=http://192.168.1.10:3456`）时，
 * 页面源是 `:3460`，根路径会打到 Vite 自己身上 → 图全裂。
 * 所以所有图片地址都必须过这里。
 *
 * ⚠️ `<img>` 发不出 Authorization 头，`/uploads` 的归属校验只认 cookie。
 *    也就是说：**登录必须让后端 setCookie（不要改成纯 token）**，
 *    否则真机上附件图一律 401/404。client.js 里 `credentials:'include'` 就是保这个的。
 */
import { getApiBase } from './config.js';

var ABSOLUTE_RE = /^(https?:)?\/\//i;
var DATA_RE = /^(data|blob):/i;

/**
 * 图片字段有时是路径字符串，有时是 { url }。
 * 空值返回空串，调用方不要渲染成 src=""。
 */
export function assetSrc(value) {
    if (!value) return '';
    if (typeof value === 'string') return resolveAssetUrl(value);
    return resolveAssetUrl(value.url || value.path || value.src || '');
}

/**
 * 只放行 http/https 的绝对地址。javascript:、data: 和站内相对路径都不算外部链接。
 */
export function safeHttpUrl(value) {
    var raw = String(value || '').trim();
    if (!/^https?:\/\//i.test(raw)) return '';
    try {
        var url = new URL(raw);
        if (url.protocol !== 'http:' && url.protocol !== 'https:') return '';
        return url.href;
    } catch (e) {
        return '';
    }
}

export function resolveAssetUrl(path) {
    var p = String(path || '').trim();
    if (!p) return '';
    if (DATA_RE.test(p)) return p;
    if (ABSOLUTE_RE.test(p)) return p;

    // 兼容历史脏数据：'uploads/a.jpg'、'./uploads/a.jpg'、'/data/uploads/a.jpg'
    p = p.replace(/^\.\//, '');
    if (p.charAt(0) !== '/') p = '/' + p;

    var base = getApiBase();
    return base ? base + p : p;
}

/** 是否是「看起来像图片」的路径（决定要不要当图渲染） */
export function isImagePath(path) {
    return /\.(jpe?g|png|gif|webp|avif|svg|bmp)(\?|#|$)/i.test(String(path || ''));
}

/** 内联占位图（避免裂图图标 + 额外请求） */
export function placeholderImage() {
    var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 80 80">' +
        '<rect width="80" height="80" rx="10" fill="#eef1f5"/>' +
        '<path d="M22 52l11-13 8 9 6-6 11 10H22z" fill="#c3cbd8"/>' +
        '<circle cx="30" cy="30" r="5" fill="#c3cbd8"/></svg>';
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
}

/**
 * 给容器里所有 `img[data-asset]` 挂一次性的加载失败兜底。
 * 用事件委托 + 标记位，重复调用不会重复处理。
 * @param {HTMLElement} container
 */
export function wireImageFallback(container) {
    if (!container || container.__imgFallbackWired) return;
    container.__imgFallbackWired = true;

    container.addEventListener('error', function (e) {
        var img = e.target;
        if (!img || img.tagName !== 'IMG') return;
        if (img.dataset.fallbackApplied === '1') return;
        img.dataset.fallbackApplied = '1';
        img.classList.add('img-fallback');
        img.src = placeholderImage();
    }, true);
}
