/**
 * API 基址
 * - 开发默认留空：走 Vite 同源 + /api 代理到 backend:3456
 * - 真机调试：在 .env 设置 VITE_API_BASE_URL=http://<电脑IP>:3456
 */
export function getApiBase() {
    var fromEnv = import.meta.env.VITE_API_BASE_URL;
    if (fromEnv && String(fromEnv).trim()) {
        return String(fromEnv).replace(/\/+$/, '');
    }
    return '';
}

export const AUTH_TOKEN_KEY = 'wt_mobile_auth_token';
