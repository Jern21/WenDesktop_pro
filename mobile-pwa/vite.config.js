import { defineConfig, loadEnv } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

/** 与桌面端 3456 错开，便于多人/多 Agent 并行开发 */
const MOBILE_DEV_PORT = 3460;

export default defineConfig(function ({ mode }) {
    var env = loadEnv(mode, process.cwd(), '');
    var apiTarget = env.VITE_API_PROXY_TARGET || 'http://localhost:3456';

    return {
        root: '.',
        publicDir: 'public',
        appType: 'spa',
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
        plugins: [
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
