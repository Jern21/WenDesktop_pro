# 文的项目工作台 · 移动端 PWA

独立前端工程，与桌面 `frontend/` **物理隔离**，通过 **同一 backend** 读写数据。

| 角色 | 端口 | 目录 |
|------|------|------|
| 后端 API + 桌面静态 | **3456** | `backend/`、`frontend/` |
| 移动 PWA 开发服务 | **3460** | `mobile-pwa/`（本目录） |

## 快速开始

1. 启动后端（若未启动）：

```bash
cd backend && npm start
```

2. 启动移动开发服务：

```bash
cd mobile-pwa
cp .env.example .env   # Windows 可手动复制
npm install
npm run dev
```

浏览器打开：<http://localhost:3460>

## 与后端如何通信

### 开发（推荐）：Vite 代理

- 页面在 `localhost:3460`，请求 `/api/*` 由 Vite 转发到 `http://localhost:3456`
- 配置见 `vite.config.js` 与 `.env` 的 `VITE_API_PROXY_TARGET`
- 登录后可使用 **HttpOnly Cookie**（同源）或响应体里的 **Bearer token**（见 `src/api/client.js`）

### 真机 / 跨源直连

1. `.env` 设置 `VITE_API_BASE_URL=http://<电脑局域网IP>:3456`
2. 启动 backend 时设置允许来源（逗号分隔）：

```bash
set CORS_ORIGINS=http://192.168.1.10:3460
cd backend && npm start
```

3. 移动端用密码登录，Token 存 `localStorage`，请求头带 `Authorization: Bearer …`

## 目录约定（便于多人 / 多 Agent）

```
mobile-pwa/
├── src/
│   ├── api/          # 仅移动端的 HTTP 封装（勿依赖 frontend/js/api.js）
│   ├── views/        # 业务页面（按功能拆文件）
│   ├── components/   # 可复用 UI 块
│   └── main.js       # 入口 / 壳层路由
├── public/           # 静态资源、PWA 图标
└── vite.config.js    # 端口、代理、PWA
```

**请勿修改**（除非团队同步）：

- `frontend/js/views/*` — 桌面 SPA 视图
- `backend/data/*` — 运行时数据（被 gitignore）

**可协作修改**：

- `backend/src/routes/*` — 新增 API 时优先 **新路由文件** 或 **向后兼容** 扩展
- `docs/mobile-pwa-architecture.md` — 架构约定

## 构建与预览

```bash
npm run build
npm run preview   # http://localhost:3460
```

生产部署可将 `dist/` 交给 Nginx 单独监听 3460，或反代到同一域名的 `/m/`（需另配 `base`）。

## 更多说明

仓库根目录 [`docs/mobile-pwa-architecture.md`](../docs/mobile-pwa-architecture.md) — 并行开发、鉴权与冲突规避。
