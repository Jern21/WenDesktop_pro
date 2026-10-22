# <img src="frontend/assets/gif/logo.gif" alt="" width="56" height="56" align="absmiddle"> 文的项目工作台

[![Version](https://img.shields.io/badge/version-2.0.2-2563eb?style=flat-square)](CHANGELOG.json)
[![Node.js](https://img.shields.io/badge/node-%3E%3D18-339933?style=flat-square&logo=node.js&logoColor=white)](https://nodejs.org)
[![Express](https://img.shields.io/badge/Express-4.x-000000?style=flat-square&logo=express&logoColor=white)](https://expressjs.com)
[![Frontend](https://img.shields.io/badge/frontend-native%20SPA-f59e0b?style=flat-square)](docs/架构重构方案.md)
[![Storage](https://img.shields.io/badge/storage-JSON%20files-6b7280?style=flat-square)](#技术栈)
[![Auth](https://img.shields.io/badge/auth-HMAC%20cookie-8b5cf6?style=flat-square)](#快速开始)
[![License](https://img.shields.io/badge/license-MIT-22c55e?style=flat-square)](#许可)
[![Tests](https://img.shields.io/badge/tests-node%20--test-0ea5e9?style=flat-square)](#运行测试)

个人接单工作台：一套跑在本机的 Web 应用，用来记下客户、订单、报价、项目、发帖和素材，并在手机上查进度、改状态。桌面端是零构建 SPA，移动端是独立的 PWA，两边共用同一套后端和按账号隔离的 JSON 数据。

<p>
  <img src="docs/screenshots/desktop-home.png" alt="桌面端首页" height="260">
  <img src="docs/screenshots/mobile-workbench.png" alt="移动端工作台" height="260">
</p>

> 版本说明与更新记录：维护仓库根目录 [`CHANGELOG.json`](CHANGELOG.json)（push 到 GitHub 后，应用内顶栏 **更新日志** 会通过 Raw 链接对比本地与线上版本差异）。

> **开发前必读**：分层与规则见 [`ARCHITECTURE.md`](ARCHITECTURE.md)，AI 协作者准则见 [`AGENTS.md`](AGENTS.md)。
> 提交前跑 `node tools/check-all.js` —— 它会拦住「绕过封装直接请求」「复制第二份工具函数」
> 「单文件超过 600 行」这类**编译能过、但三个月后就改不动**的问题。

## 功能特性

业务数据按登录账号分目录存放（`backend/data/users/<账号>/`），账号之间互不可见。写入前会自动留一份备份。

### 桌面端（侧栏）

| 入口 | 能做什么 |
|------|----------|
| 首页 | 今日 / 本月 / 年度收入与订单、趋势图、待办与提醒聚合 |
| 我的订单 | 状态流转（待确认 → 开发中 → 待验收 → 完成 / 关闭）、付款状态、筛选、回收站 |
| 报价管理 | 在线报价、多版本、砍价记录、话术复制 |
| 宣传海报 | 图片 / 视频素材、分类与标签、使用次数 |
| 无限画布 | 自由排布的内容画布 |
| 平台管理 | 总览看板，以及闲鱼 / 小红书 / 抖音发帖台账（草稿、待发布、已发布、下架） |
| 客户管理 | 客户资料、画像标签、跟进记录 |
| 数据统计 | 收入趋势、客源占比、项目类型、利润率；可导出报表 |
| 项目管理 | 看板：进行中 / 待验收 / 已完成 |
| 账号管理 | 登录凭据（加密存储，界面脱敏） |
| 网址收藏 | 常用链接 |
| 简历管理 | 多份简历版本 |
| 信息备忘录 | 自由备忘 |
| 日期提醒 | 截止日期、优先级、到期提醒 |
| 设置中心 | 见下表。侧栏其余项可在「菜单选项」里逐项隐藏，设置中心本身始终可见 |

顶栏另有更新日志（对比本地与 GitHub 上的 `CHANGELOG.json`），侧栏底部是可对话的小柴桌宠。顶栏 Grok 状态按钮目前只展示样式，通道尚未接入。

### 设置中心

账号信息、外观（含深色）、菜单显示、安全（访问密码）、通知、AI 生图配置、数据导出、备份与恢复、Bug 记录、数据清理、回收站、关于。

### 移动端 PWA

右侧导航 12 项，详情页从列表进入，不占导航位。写操作刻意收窄：手机上改状态、勾待办、记跟进，完整建单和传附件留在桌面端。

| 状态 | 页面 |
|------|------|
| 已接入 | 工作台（今日概览 + 开发小账）、订单列表 / 详情（改订单状态与付款状态）、待办（含月历、勾选完成）、客户列表 / 详情（加跟进）、项目列表 / 详情、报价列表 / 详情、素材库、发帖列表 / 详情、链接收藏、设置（主题、退出登录） |
| 仍是占位 | 数据看板、账号密码（计划只读脱敏） |

备忘录和简历没有移动端入口。

## 技术栈

| 层 | 技术 |
|----|------|
| 后端 | Node.js + Express |
| 桌面端 | 原生 JavaScript SPA（`app.html` + History 路由）+ Tailwind CSS + ECharts + Phosphor Icons |
| 移动端 | Vite PWA，独立端口，`/api` 代理到后端 |
| 存储 | 按账号分目录的 JSON 文件，写入前自动备份 |
| 安全 | HMAC 无状态 Cookie 鉴权；敏感字段加密（`secret-box`） |

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

**提交前只跑这一条**（静态检查 + 纯逻辑单测，2 秒，不需要起任何服务）：

```bash
node tools/check-all.js
```

它会依次跑：桌面端一致性 / 桌面端依赖接线 / 架构守卫 / 移动端接线 / 移动端纯逻辑。

```bash
node tools/check-all.js --full   # 额外跑接口层、桌面端冒烟、全部后端测试（需 backend 在跑）
```

单独跑某一项：

```bash
cd backend && npm test            # 或双击 test.bat（node --test）
node tools/verify-arch.js         # 架构规则（只拦新增，历史债务见 tools/arch-baseline.json）
node tools/verify-mobile.js       # 移动端 nav↔registry / import / panel 契约
node tools/test-mobile-lib.mjs    # 移动端纯逻辑（路径、分页、路由匹配）
```

移动端新增页面用脚手架，它会同时完成「生成面板 + 注册表登记 + 导航入口 + 校验」：

```bash
node tools/new-panel.js orders 订单 --icon receipt
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
│   ├── server.js            # 挂中间件、挂路由、托管桌面静态文件
│   ├── src/routes/          # REST API（一个资源一个文件）
│   ├── src/utils/           # 存储、鉴权、备份、业务规则
│   └── data/users/<账号>/   # 该账号的 JSON 与备份（不要手改）
├── frontend/                # 桌面 SPA（零构建，由 backend :3456 托管）
│   ├── app.html             # 唯一入口
│   ├── js/core/             # router / view / ui / dom
│   ├── js/views/            # 页面自注册
│   ├── js/project/          # 项目管理（page.js 为唯一入口）
│   └── js/settings/         # 设置中心各区块
├── mobile-pwa/              # 移动 PWA（Vite，:3460）
│   └── src/views/panels/    # 页面；导航在 config/nav.js，路径在 config/routes.js
├── docs/                    # 方案文档（移动端页面规划等）
├── tools/                   # 架构检查与脚手架（check-all、new-panel）
└── start.bat / start-mobile.bat / stop.bat / test.bat
```

分层规则以 [`ARCHITECTURE.md`](ARCHITECTURE.md) 为准。移动端做哪些页、刻意不做哪些，见 [`docs/mobile-page-plan.md`](docs/mobile-page-plan.md)。

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
| 认证 | `/api/auth` | 登录 / 登出 / 状态（守卫之前挂载） |
| 订单 | `/api/orders` | 订单；列表为分页对象 |
| 客户 | `/api/customers` | 客户与跟进 |
| 报价 | `/api/quotes` | 报价单 |
| 海报素材 | `/api/posters` | 宣传素材 |
| 项目 | `/api/projects` | 项目与看板 |
| 平台发布 | `/api/platform-posts` | 发帖台账；列表为分页对象 |
| 备忘录 | `/api/memos` | 备忘 |
| 提醒 | `/api/reminders` | 日程；`/calendar` 的 `days` 按日分组，不是数组 |
| 简历 | `/api/resume` | 简历版本 |
| 账本 | `/api/ledger` | 开发小账（移动端工作台「记一笔」） |
| 统计 | `/api/stats` | 收入、待办聚合、通知 |
| 上传 | `/api/upload` | 附件；图片访问靠登录 Cookie，不能只带 Bearer |
| 设置 | `/api/settings` | 账号设置 |
| 账号 | `/api/accounts` | 凭据（加密存储） |
| 收藏 | `/api/bookmarks` | 链接收藏 |
| AI 生图 | `/api/image-gen` | 配置与生成 |
| Bug 记录 | `/api/bug-reports` | 问题反馈 |

除 `/api/auth` 与 `/api/health` 外，接口默认需已登录。成功时返回 `{ success: true, data }`。

## 许可

MIT License
