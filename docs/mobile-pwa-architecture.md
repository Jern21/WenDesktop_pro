# 移动端 PWA 与并行开发架构

## 目标

- 桌面 Web（`frontend/` + `app.html`）与移动 PWA（`mobile-pwa/`）**代码分离、端口分离**
- **数据统一**：仅通过 `backend` 的 REST API（及 `/uploads`）访问，不维护第二份 JSON
- 两人 / 两个 Agent 可同时改仓库，**默认不碰同一目录**

## 进程与端口

```
┌─────────────────────┐     proxy /api      ┌─────────────────────┐
│  mobile-pwa (Vite)  │ ──────────────────► │  backend :3456      │
│  :3460              │                     │  Express + JSON DB  │
└─────────────────────┘                     └──────────▲──────────┘
┌─────────────────────┐                                │
│  frontend (静态)     │ ───────────────────────────────┘
│  经 backend 托管    │
└─────────────────────┘
```

| 服务 | 默认端口 | 说明 |
|------|----------|------|
| Backend | 3456 | 唯一数据源与 API |
| Desktop | 3456 | 与 backend 同进程静态托管 |
| Mobile PWA dev | 3460 | `mobile-pwa/vite.config.js` 中 `strictPort: true` |

改移动端口：只改 `mobile-pwa/vite.config.js` 的 `MOBILE_DEV_PORT`，**不要**改 backend 端口，除非全项目一起迁移。

## 代码边界（减少冲突）

| 区域 | 移动 Agent | 桌面 Agent |
|------|------------|------------|
| `mobile-pwa/**` | ✅ 主责 | ❌ 避免改 |
| `frontend/**` | ❌ 避免改 | ✅ 主责 |
| `backend/src/routes/**` | ⚠️ 新增接口需约定 | ⚠️ 同上 |
| `backend/server.js` | ⚠️ 仅小改（CORS 等） | ⚠️ 同上 |
| `backend/data/**` | ❌ 运行时，不提交 | ❌ |

推荐协作方式：

1. **API 先行**：移动需要新字段时，在 `backend` 加路由或扩展现有 DTO，写清响应结构
2. **Git 分支**：`feature/mobile-xxx` vs `feature/desktop-xxx`，合并前跑 `backend` 测试
3. **Git worktree**（可选）：同一仓库两个工作目录、两个分支，物理隔离未提交改动

## 鉴权

Backend 支持：

- Cookie（`wt_auth`）— 适合 **代理模式** 下与页面同源
- `Authorization: Bearer <token>` — 适合 **跨端口 / 真机 / 未来独立域名**

登录接口：`POST /api/auth/login` 响应 `data.token`。

环境变量：

| 变量 | 作用 |
|------|------|
| `CORS_ORIGINS` | 逗号分隔的 Origin 白名单；设置后启用 `credentials: true` |
| `AUTH_ENABLED` / `AUTH_TRUST_LOCALHOST` | 与桌面一致 |

## PWA

- 使用 `vite-plugin-pwa`，Service Worker 只缓存 **本域静态资源**
- API 使用 `NetworkFirst` 短缓存（见 `vite.config.js`），避免脏数据长期离线可用

## 验收清单（移动迭代）

- [ ] `backend` 已启动，`/api/health` 正常
- [ ] `npm run dev` 3460 可打开，占位页显示 API 正常
- [ ] 需登录环境下，登录后 `GET /api/auth/status` 为已认证
- [ ] 未改动 `frontend/js/views` 中与本次无关的文件
