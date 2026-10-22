export function mountPlaceholderPanel(container, title, hint) {
    container.innerHTML =
        '<section class="m-card m-card-center">' +
        '  <h2 class="m-card-title-lg">' + escapeHtml(title || '开发中') + '</h2>' +
        '  <p class="m-card-body m-muted">' + escapeHtml(hint || '该页面即将上线。') + '</p>' +
        '</section>';
    return { destroy: function () {} };
}

function escapeHtml(s) {
    return String(s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}
