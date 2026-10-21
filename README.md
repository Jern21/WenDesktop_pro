# 文的项目工作台

[![Version](https://img.shields.io/badge/version-2.0.1-2563eb?style=flat-square)](CHANGELOG.json)
[![Node.js](https://img.shields.io/badge/node-%3E%3D18-339933?style=flat-square&logo=node.js&logoColor=white)](https://nodejs.org)
[![Express](https://img.shields.io/badge/Express-4.x-000000?style=flat-square&logo=express&logoColor=white)](https://expressjs.com)
[![Frontend](https://img.shields.io/badge/frontend-native%20SPA-f59e0b?style=flat-square)](docs/架构重构方案.md)
[![Storage](https://img.shields.io/badge/storage-JSON%20files-6b7280?style=flat-square)](#技术栈)
[![Auth](https://img.shields.io/badge/auth-HMAC%20cookie-8b5cf6?style=flat-square)](#快速开始)
[![License](https://img.shields.io/badge/license-MIT-22c55e?style=flat-square)](#许可)
[![Tests](https://img.shields.io/badge/tests-node%20--test-0ea5e9?style=flat-square)](#运行测试)

个人接单工作台，一套用于管理接单业务全流程的本地 Web 应用：从客户、订单、报价到多平台内容发布、素材库与数据统计，一站式完成记录与复盘。

> 版本说明与更新记录：维护仓库根目录 [`CHANGELOG.json`](CHANGELOG.json)（push 到 GitHub 后，应用内顶栏 **更新日志** 会通过 Raw 链接对比本地与线上版本差异）。

## 功能特性

- **智能仪表盘**：今日/本月/年度收入与订单统计、订单趋势图、平台发布状态、待办聚合、日程提醒
- **客户与订单管理**：客户信息、项目状态流转、付款状态、客户画像标签、多维筛选检索、回收站
- **报价单管理**：在线生成报价单、多版本（初版/协商版/最终版）、砍价记录、快捷话术复制
- **宣传素材库**：图片/视频上传、自定义分类、标签备注、使用频次追踪
- **多平台发布台账**：小红书/闲鱼/抖音发帖记录、数据表现统计、爆款标记、咨询客户追踪
- **待办与智能提醒**：待办事项、截止日期、优先级标记、到期自动提醒
- **数据统计**：收入趋势、平台客源占比、项目类型分布、利润率核算
- **系统管理**：访问密码、数据备份与恢复、一键导出 Excel

## 技术栈

| 层 | 技术 |
|----|------|
| 后端 | Node.js + Express |
| 前端 | 原生 JavaScript + Tailwind CSS + ECharts + Phosphor Icons |
| 存储 | JSON 文件存储（自动备份） |
| 架构 | 真 SPA（`app.html` + History 路由）+ RESTful API |
| 安全 | HMAC 无状态 Cookie 鉴权（本机可免登录） |

## 快速开始

### 环境要求

- [Node.js](https://nodejs.org) 18+

### Windows 一键启动

双击 `start.bat`，脚本会自动检查依赖、启动后端服务并打开浏览器：

- 前端地址：<http://localhost:3456>（默认进入新 SPA 入口 `app.html`）
- API 地址：<http://localhost:3456/api>
- 健康检查：<http://localhost:3456/api/health>

首次开启鉴权时，控制台会打印自动生成的 **用户名（默认 admin）+ 密码**。也可用 `APP_USERNAME` / `APP_PASSWORD` 指定。

| 环境变量 | 说明 |
|----------|------|
| `AUTH_ENABLED=0` | 关闭鉴权（仅建议完全可信的本机环境） |
| `AUTH_TRUST_LOCALHOST=1` | 恢复本机 127.0.0.1 免登录（默认关闭） |
| `APP_USERNAME` | 登录用户名（默认 `admin`） |
| `APP_PASSWORD` | 登录密码 |
| `TRIAL_LOGIN=0` | 关闭试用免密账号 |
| `TRIAL_USERNAME` | 试用用户名（默认 `trial`） |
| `SPA_AS_HOME=0` | 首页回退旧版 `index.html` |

停止服务请双击 `stop.bat`。

### 手动启动

```bash
cd backend
npm install
npm start          # 启动服务
npm run dev        # 开发模式（node --watch 热重载）
```

## 运行测试

```bash
cd backend
npm test           # 或双击 test.bat（node --test）
```

## 版本日志（CHANGELOG）

| 步骤 | 说明 |
|------|------|
| 1 | 编辑仓库根目录 [`CHANGELOG.json`](CHANGELOG.json)：更新 `latestVersion`，在 `entries` **最上方**追加新版本条目 |
| 2 | 提交并 **push 到 GitHub**（默认 `main` 分支） |
| 3 | 各环境打开应用后，顶栏 **更新日志** 会拉取 `changelogRawUrl` 与本地 `/CHANGELOG.json` 对比，提示「线上较新 / 与线上一致 / 本地未 push」 |

换仓库或分支时，请同步修改 `CHANGELOG.json` 里的 `repository` 与 `changelogRawUrl`（Raw 地址示例：`https://raw.githubusercontent.com/<owner>/<repo>/main/CHANGELOG.json`）。

前端另有路由冒烟、迁移校验等页面测试，见 `frontend/test/` 与 `tools/verify-consistency.js`。

## 项目结构

```
├── backend/                 # Node.js 后端
│   ├── server.js            # API + 静态托管 + SPA 回退 + 鉴权守卫
│   ├── src/routes/          # REST API（含 /api/auth）
│   ├── src/utils/           # 存储、鉴权等
│   └── test/                # 单元测试（含 auth）
├── frontend/
│   ├── app.html             # ★ SPA 唯一入口（默认首页）
│   ├── login.html           # 登录页
│   ├── js/
│   │   ├── core/            # dom / ui / view / router
│   │   ├── views/           # 各页面视图模块
│   │   ├── app.js           # 启动与导航桥接
│   │   └── changelog.js     # 更新日志 UI（读取 CHANGELOG.json + GitHub Raw）
│   ├── views/               # 页面 HTML 模板片段
│   ├── css/views/           # 按页样式
│   ├── pages/               # 旧版多页（迁移期可回退）
│   └── test/                # 前端冒烟与交互测试
├── mobile-pwa/              # ★ 移动端 PWA（Vite，默认 :3460）
├── docs/                    # 架构与方案文档
├── tools/                   # 视图迁移与一致性校验脚本
└── start.bat / start-mobile.bat / stop.bat / test.bat
```

架构细节见 [`docs/架构重构方案.md`](docs/架构重构方案.md)。

### 移动端 PWA（独立工程）

桌面与移动 **分目录、分端口**，共享同一 backend 数据：

| 工程 | 目录 | 开发端口 |
|------|------|----------|
| 桌面 SPA | `frontend/` | 3456（经 backend 托管） |
| 移动 PWA | [`mobile-pwa/`](mobile-pwa/) | **3460**（Vite，`/api` 代理到 3456） |

```bash
# 终端 1
cd backend && npm start

# 终端 2
cd mobile-pwa && npm install && npm run dev
```

或 Windows 双击 [`start-mobile.bat`](start-mobile.bat)（需 backend 已启动）。

并行开发约定见 [`docs/mobile-pwa-architecture.md`](docs/mobile-pwa-architecture.md)。

## 主要 API

| 模块 | 前缀 | 说明 |
|------|------|------|
| 认证 | `/api/auth` | 登录 / 登出 / 状态 |
| 订单 | `/api/orders` | 订单 CRUD |
| 客户 | `/api/customers` | 客户管理 |
| 报价 | `/api/quotes` | 报价单管理 |
| 海报素材 | `/api/posters` | 宣传素材 |
| 项目 | `/api/projects` | 项目案例 |
| 平台发布 | `/api/platform-posts` | 多平台发帖台账 |
| 备忘录 | `/api/memos` | 待办备忘 |
| 提醒 | `/api/reminders` | 日程提醒 |
| 统计 | `/api/stats` | 数据统计 |
| 上传 | `/api/upload` | 文件上传 |

> 除 `/api/auth` 与健康检查外，接口默认需已登录。统一返回 `{ success: boolean, data: ... }`。

## 许可

MIT License
