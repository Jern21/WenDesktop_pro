<div align="center">

<img src="frontend/assets/gif/logo.gif" alt="文的项目工作台" width="80" height="80">

# 文的项目工作台

**轻量架构 · Agent 驱动 · 自由扩展 · 多端协同**

把客户、订单、项目与灵感，放进一个属于自己的工作台。

[![Version](https://img.shields.io/badge/version-2.1.0-2563eb?style=flat-square)](CHANGELOG.json)
[![Architecture](https://img.shields.io/badge/架构-轻量可扩展-10b981?style=flat-square)](ARCHITECTURE.md)
[![Agent](https://img.shields.io/badge/Agent-自选模型%20%7C%20GrokBot-8b5cf6?style=flat-square)](GROK_BOT_CONNECTION.md)
[![Platforms](https://img.shields.io/badge/多端-Web%20%7C%20Windows%20%7C%20iOS%20PWA%20%7C%20Android-0ea5e9?style=flat-square)](#多端使用)

[快速开始](#快速开始) · [多端使用](#多端使用) · [部署指南](docs/deployment.md) · [开发架构](ARCHITECTURE.md)

</div>

<p align="center">
  <img src="docs/screenshots/desktop-home.png" alt="桌面端首页" height="320">
  <img src="docs/screenshots/mobile-workbench.png" alt="移动端工作台" height="320">
</p>

## 五个核心亮点

| | 亮点 | 能带来什么 |
| :---: | :--- | :--- |
| 🧩 | **架构重构，轻松二开** | 前后端分层、业务模块拆分；桌面网页零构建，Express + JSON 文件存储无需额外数据库。配套脚手架与架构检查，扩展有章可循。 |
| <a href="GROK_BOT_CONNECTION.md"><img src="docs/assets/grok.svg" alt="GrokBot" width="28" height="28"></a> | **内置 Agent，自选驱动** | 自行配置 OpenAI 兼容接口与模型，驱动内置助手；也可接入 **GrokBot**，通过授权接口读写业务数据、串联工作流程。 |
| 🎨 | **自定义组件，灵活组合** | 复用列表、表单、弹层等通用组件，结合页面自注册机制，按自己的业务定制页面与交互，扩展更多玩法。 |
| 📱 | **一套服务，多端使用** | 覆盖 **网页、Windows 桌面应用、iOS PWA、Android**，共用后端与账号数据，在不同设备继续处理工作。 |
| 🚀 | **快速启动，部署有据** | 本机脚本启动；服务器提供 **宝塔 + Nginx**、公网域名及内网穿透方案，附可直接交给 AI 的部署指令。 |

日常业务也已备齐：**客户 / 订单 / 报价 / 项目看板 / 发帖 / 素材 / 无限画布 / 备忘提醒 / 数据统计**，并提供外观设置、备份恢复、导出与回收站。

## 快速开始

准备 Node.js 18+。Windows 双击 **`start.bat`**，停止使用 `stop.bat`；也可在终端启动：

```bash
cd backend
npm install
npm start
```

打开 [http://localhost:3456](http://localhost:3456)。首次启动的账号密码见控制台，也可通过 `APP_USERNAME` / `APP_PASSWORD` 指定。

## 多端使用

| 入口 | 使用方式 |
| :--- | :--- |
| **网页** | 后端直接托管桌面网页；手机端运行 `start-mobile.bat`，访问 [http://localhost:3460](http://localhost:3460)（需后端已启动）。 |
| **Windows 桌面应用** | Electron 联网版，首次启动填写桌面网站地址。[构建与使用 →](desktop-electron/README.md) |
| **iOS PWA** | 部署手机站点后，在 Safari 中添加到主屏幕。[移动端说明 →](mobile-pwa/README.md) |
| **Android** | Capacitor 独立应用构建，连接同一后端。[构建与安装 →](mobile-pwa/ANDROID.md) |

## 部署与扩展

**服务器部署只需一个后端**：桌面网页无需构建，手机网页构建为 `dist/`，由 Nginx 提供访问入口。按[部署指南](docs/deployment.md)选择公网域名或内网穿透，完成 HTTPS、常驻进程与数据备份配置。

[架构与二次开发](ARCHITECTURE.md) · [AI 协作准则](AGENTS.md) · [GrokBot 接入](GROK_BOT_CONNECTION.md) · [更新日志](CHANGELOG.json)

开发完成后运行 `node tools/check-all.js`。本项目采用 **MIT License**。
