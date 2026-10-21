import { api, setStoredToken, getStoredToken } from './client.js';

export async function fetchAuthStatus() {
    var res = await api.get('/api/auth/status');
    return res && res.data ? res.data : null;
}

/**
 * @returns {Promise<{ ok: boolean, error?: string, code?: string }>}
 */
export async function loginTrial() {
    var status = await fetchAuthStatus();
    var name = (status && status.trialUsername) || 'trial';
    return loginWithCredentials(name, '', false);
}

export async function loginWithCredentials(username, password, remember) {
    try {
        var res = await api.post('/api/auth/login', {
            username: username,
            password: password,
            remember: !!remember
        });
        if (res.success && res.data && res.data.token) {
            setStoredToken(res.data.token);
        }
        return { ok: true };
    } catch (e) {
        var payload = e.payload || {};
        return {
            ok: false,
            error: payload.error || e.message || '登录失败',
            code: payload.code
        };
    }
}

export async function logout() {
    try {
        await api.post('/api/auth/logout', {});
    } catch (e) { /* ignore */ }
    setStoredToken('');
}

export function hasLocalToken() {
    return !!getStoredToken();
}
