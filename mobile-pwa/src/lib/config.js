/**
 * 运行环境配置
 *
 * 为什么放在 `lib/` 而不是 `api/`：
 * 它只读环境变量、不含任何网络行为，属于最底层的基础能力。
 * `lib/` 不许依赖 `api/`（否则纯工具层被业务污染、无法脱离浏览器单测），
 * 而 `api/client.js` 和 `lib/urls.js` 都需要它 —— 放 `lib/` 才能让依赖方向保持单向。
 *
 * - 开发默认留空：走 Vite 同源 + /api 代理到 backend:3456
 * - 真机调试：在 .env 设置 VITE_API_BASE_URL=http://<电脑IP>:3456
 *
 * 注意：`import.meta.env` 在 Vite 里是编译期常量，但在 Node 里直接 import
 * 这个文件时它是 undefined。必须兜一层，否则纯逻辑单测（node tools/xxx）
 * 一 import 就 TypeError。下面的兜底就是为这个。
 */
function readEnv() {
    try {
        return (import.meta && import.meta.env) || {};
    } catch (e) {
        return {};
    }
}

export function getApiBase() {
    var env = readEnv();
    var fromEnv = env.VITE_API_BASE_URL;
    if (fromEnv && String(fromEnv).trim()) {
        return String(fromEnv).trim().replace(/\/+$/, '');
    }
    return '';
}

/** 是否走了「跨端口/跨主机」直连模式（决定资源 URL 要不要拼绝对地址） */
export function isDirectMode() {
    return !!getApiBase();
}

export const AUTH_TOKEN_KEY = 'wt_mobile_auth_token';
