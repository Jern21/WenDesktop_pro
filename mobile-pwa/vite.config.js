import { defineConfig, loadEnv } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import { fileURLToPath } from 'node:url';

/** 与桌面端 3456 错开，便于多人/多 Agent 并行开发 */
const MOBILE_DEV_PORT = 3460;

export default defineConfig(function ({ mode }) {
    var env = loadEnv(mode, process.cwd(), '');
    var apiTarget = env.VITE_API_PROXY_TARGET || 'http://localhost:3456';
    var android = mode === 'android';
    if (android) {
        var apiBase;
        try { apiBase = new URL(env.VITE_API_BASE_URL); } catch (e) { /* 下方统一报错 */ }
        if (!apiBase || apiBase.protocol !== 'https:' || apiBase.username || apiBase.password ||
            apiBase.search || apiBase.hash || apiBase.pathname !== '/' ||
            /^(localhost|127\..*|\[::1\])$/i.test(apiBase.hostname)) {
            throw new Error('Android 构建必须设置 VITE_API_BASE_URL 为 HTTPS 后端源地址（不带路径、账号或查询参数）');
        }
    }

    return {
        root: '.',
        publicDir: 'public',
        appType: 'spa',
        resolve: {
            alias: {
                '@mobile-platform': fileURLToPath(new URL(android
                    ? './src/platform/android/page.js' : './src/platform/pwa.js', import.meta.url))
            }
        },
        build: { outDir: android ? 'dist-android' : 'dist' },
        server: {
            port: MOBILE_DEV_PORT,
            strictPort: true,
            host: true,
            proxy: {
                '/api': {
                    target: apiTarget,
                    changeOrigin: true
                },
                '/uploads': {
                    target: apiTarget,
                    changeOrigin: true
                },
                '/assets': {
                    target: apiTarget,
                    changeOrigin: true
                }
            }
        },
        preview: {
            port: MOBILE_DEV_PORT,
            strictPort: true,
            host: true,
            proxy: {
                '/api': { target: apiTarget, changeOrigin: true },
                '/uploads': { target: apiTarget, changeOrigin: true },
                '/assets': { target: apiTarget, changeOrigin: true }
            }
        },
        plugins: android ? [] : [
            VitePWA({
                registerType: 'autoUpdate',
                includeAssets: ['icon.svg', 'assets/gif/logo.gif'],
                manifest: {
                    name: '文的项目工作台 · 移动版',
                    short_name: '文工作台',
                    description: '接单工作台移动端 PWA',
                    theme_color: '#f5f5f7',
                    background_color: '#f5f5f7',
                    display: 'standalone',
                    orientation: 'portrait-primary',
                    start_url: '/',
                    scope: '/',
                    icons: [
                        {
                            src: 'icon.svg',
                            sizes: 'any',
                            type: 'image/svg+xml',
                            purpose: 'any'
                        },
                        {
                            src: 'icon.svg',
                            sizes: 'any',
                            type: 'image/svg+xml',
                            purpose: 'maskable'
                        }
                    ]
                },
                workbox: {
                    globPatterns: ['**/*.{js,css,html,ico,svg,woff2}'],
                    // 业务接口和登录态不能进 Cache Storage。
                    // NetworkFirst 会在慢网时把上一账号的响应交出来。
                    // 静态资源仍由 precache 负责。旧的 api-cache 由应用启动和登出时删除。
                    runtimeCaching: [
                        {
                            urlPattern: /^https?:\/\/.*\/api\/.*/i,
                            handler: 'NetworkOnly'
                        }
                    ]
                }
            })
        ]
    };
});
