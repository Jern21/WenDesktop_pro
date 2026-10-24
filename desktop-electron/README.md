# 联网桌面版（Windows x64）

此目录是独立的 Electron 外壳，直接加载已部署的桌面网页。服务器继续提供网页、API、登录及附件，网页更新后刷新即可使用；客户端升级需要重新安装。运行时不启动本地后端，不打包仓库业务数据。

## 开发与打包

在本目录执行：

```powershell
npm ci
npm start
npm test
npm run test:smoke
npm run dist
```

首次启动填写完整的 **桌面网页 HTTPS 地址**，例如 `https://work.example.com/app.html`，不要填写手机站点或 `/api` 地址。只填写域名时自动补 `/app.html`。地址中不能携带账号密码。本机调试可使用 `http://127.0.0.1:3456/app.html`，后端需自行启动。

安装包输出为 `dist/WenWorkbench-Setup-1.0.0-x64.exe`，解包版为 `dist/win-unpacked/文的项目工作台.exe`。`npm run pack` 只生成解包版。构建不自动发布，不需要服务器凭据。

如 npm 缓存目录受限，可执行 `npm ci --cache .cache/npm`。Electron 和打包工具首次运行会下载二进制；Electron 安装器使用 `electron_config_cache` 指定缓存，打包工具使用 `ELECTRON_BUILDER_CACHE`。已安装 Electron 时，可以复用本地二进制：

```powershell
$env:electron_config_cache = Join-Path $PWD '.cache/electron'
$env:ELECTRON_BUILDER_CACHE = Join-Path $PWD '.cache/builder'
node node_modules/electron/install.js
npm run dist -- --config.electronDist=node_modules/electron/dist
```

## 使用

- 登录与原网页相同；Electron 的 Cookie、localStorage 与普通浏览器独立，首次需要重新登录，后续按服务器登录有效期保持会话。
- “工作台 → 修改服务器地址”可以换域名；换到其他站点需要重新登录。“返回首页”可从附件页回到工作台。
- 同站新窗口链接在当前窗口打开，以保留附件 Cookie；外站新窗口链接交给系统浏览器。阻止远程网页跳到其他站点或打开系统协议。
- 网页加载失败会提供重试和修改地址入口；断网时无法处理线上业务。
- 配置保存在 Electron 用户目录的 `server.json`，仅保存地址。应用使用 Windows 当前用户目录保存会话；不与本地仓库的 `backend/data/` 建立联系。

目前未配置代码签名、自定义图标、自动更新及第三方跨站登录。未签名安装包可能出现 Windows 发布者提示。生产服务器需要有效 HTTPS 证书，客户端不忽略证书错误。打印、上传、下载使用网页和 Chromium 的现有能力；真实服务器上的登录、附件及业务导出仍需验收。

## 验证范围

`npm test` 验证 URL、凭据与导航策略。`npm run test:smoke` 用临时目录和本机临时站点启动真实 Electron，验证首次设置、表单保存、远程隔离、Cookie 会话、跨站导航拦截和修改地址菜单，不访问真实业务数据。测试目录路径会打印在终端，以便排查。

构建后，可设置 `WEN_DESKTOP_SMOKE_APP` 为 `dist/win-unpacked/resources/app.asar/main.js` 的绝对路径，再执行 `npm run test:smoke`，对打包后的入口和设置页重复上述检查。设置页截图保存在 `.cache/setup-preview.png`。
