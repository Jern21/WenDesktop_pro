# Android 安装包与 iOS PWA

同一套业务页面，两套独立构建。原来的 `npm run dev`、`npm run build` 和
`npm run preview` 继续服务网站与 iOS PWA。Android 不注册 Service Worker，
不生成 Web Manifest，不加载远程网页作为应用入口。

## 文件与职责

- `vite.config.js`：默认输出 `dist/`；`--mode android` 输出 `dist-android/`，不启用 PWA 插件。
- `src/platform/pwa.js`：只负责网站 Service Worker 注册。
- `src/platform/android/page.js`：Android 平台唯一入口，处理系统返回键；业务页面无需引用原生插件。
- `capacitor.config.json`：包名 `com.wen.workbench`、应用名、独立网页目录及网络策略。
- `android/`：Capacitor 8 生成的原生工程，当前最低 Android 7（API 24）。
- `../tools/mobile-android.mjs`：构建、隔离检查、同步、打开工程和调试 APK 编译。
- `../tools/test-mobile-android.mjs`：检查实际安装包网页目录，阻止 PWA 产物混入。

页面与组件仍按原有架构维护，不复制第二套业务代码。平台入口通过构建别名选择，
网站产物不包含 Android 插件，Android 产物不包含 PWA 注册模块。

## 准备与构建

在 `mobile-pwa/` 下安装依赖：

```powershell
npm ci
Copy-Item .env.android.example .env.android.local
```

把 `.env.android.local` 中的 `VITE_API_BASE_URL` 换成真实后端的 HTTPS 源地址，
例如 `https://api.your-domain.com`，不要带 `/api`、账号、路径或查询参数。
环境文件不提交 Git。该变量会在编译时写入网页，不能放密钥。

```powershell
npm run build:android  # 只构建 Android 网页并检查隔离
npm run android:sync   # 重新构建、检查并同步到原生工程
npm run android:open   # 同步后打开 Android Studio
npm run android:apk    # 同步后用 Gradle 编译调试 APK
```

原生编译需 Android Studio 2025.2.1 或更新版本、JDK 21、Android SDK 36；
在 Android Studio 的 SDK Manager 安装 SDK，并让 IDE 创建本机 `android/local.properties`。
命令行也可设置 `ANDROID_HOME`。首次编译需要网络下载 Gradle 和 Android 依赖。
Android Studio 可使用自带的 JDK。

调试 APK 输出位置：`android/app/build/outputs/apk/debug/app-debug.apk`。
正式发布前在 Android Studio 生成签名 APK/AAB，妥善保存签名证书，更新时沿用包名与证书，
递增 `android/app/build.gradle` 的 `versionCode` 和 `versionName`。
当前图标、启动屏和原生版本号仍是 Capacitor 模板默认值。

## 验证两种构建

```powershell
npm run build
npm run build:android
npm run test:android
node --test test/android-shell.test.mjs
node ../tools/check-all.js
```

PWA 的 `dist/` 应有 `manifest.webmanifest`、`sw.js`；Android 的 `dist-android/`
不得有这些文件。`android:sync` 每次重新构建并执行检查，不能手动把 `dist/` 拷进安装包。
同时构建两种目标也不会互相清空对方目录。

## 返回键

已有确认/编辑弹层（`role="dialog" aria-modal="true"` 且含 `data-act="cancel"`）
优先调用取消按钮；其他模态框存在时不切换后台页面。
普通页面复用现有 `goBack()`；从详情直接进入时退到路由表中的父页；首页和登录页返回时
最小化应用。特殊页面可以监听可取消的 `window` 事件 `android-back`，调用
`event.preventDefault()` 后自行处理关闭动作。iOS PWA 不注册这些行为。

## 当前交付边界

这是 Android 壳基础，尚未完成真实服务器和真机业务验收：

- 后端必须单独运行。APK 不包含 Express 后端，也没有离线业务数据。
- WebView 本地源默认是 `https://localhost`；后端需要明确允许该 Origin 和凭据请求。
  现有 `SameSite=Lax` Cookie 及附件图片鉴权需要专项适配，单改 CORS 不能解决跨站图片登录态。
  本次没有修改后端或公共接口层，避免影响 PWA 和并行页面开发。
- 文件下载、外部链接、分享、剪贴板、键盘避让和系统栏布局需后续真机验证及必要的插件适配。
- 首次生成/同步工程使用过 `https://api.example.com` 占位地址验证构建，不代表业务可连接；
  交付业务测试包前必须填写真实地址再执行 `android:apk`。
- PWA 网站部署后按原来的更新机制更新；Android 内置页面更改后需重新构建并安装更新包。

并行开发时，其他会话可以修改页面、组件与样式；构建配置、平台入口、依赖/锁文件和
`android/` 由同一会话维护，避免互相覆盖。打包会读取当时的页面工作区，
页面还在修改时的临时编译失败应等页面修改完成后复验。

官方参考：[Capacitor 安装](https://capacitorjs.com/docs/getting-started)、
[Android 环境要求](https://capacitorjs.com/docs/updating/8-0)。
