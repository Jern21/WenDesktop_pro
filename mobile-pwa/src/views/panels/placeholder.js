import { escapeHtml } from '../../lib/format.js';

/**
 * 占位面板 —— 页面尚未实现时的统一回退视图
 *
 * 由 shell 在「nav.panel 没在 registry 登记」时调用，
 * 所以它也算一个隐性入口：文案清晰一点，用户就不会以为是页面坏了。
 */
export function mountPlaceholderPanel(container, title, hint) {
    container.innerHTML =
        '<section class="m-card m-card-center">' +
        '  <h2 class="m-card-title-lg">' + escapeHtml(title || '开发中') + '</h2>' +
        '  <p class="m-card-body m-muted">' + escapeHtml(hint || '该页面即将上线。') + '</p>' +
        '</section>';
    return { destroy: function () {} };
}
