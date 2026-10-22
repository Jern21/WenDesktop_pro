# 架构与开发规约

> 这份文档只回答一个问题：**新代码该放在哪、该怎么分层、怎么保证下次还能改得动。**
> 凡是能被脚本检查的规则，`node tools/check-all.js` 都会替你盯着（见文末对照表）。
> 给 AI 协作者的行为准则另见 `AGENTS.md`。

---

## 一、项目地形

```
myProject_pro/
├── backend/              后端（Express + JSON 文件存储）
│   ├── server.js         唯一入口，只做「挂中间件 + 挂路由」
│   ├── src/routes/       18 个路由模块（每个端点一个文件）
│   ├── src/utils/        仓储 / 规则 / 加密 / 路径（业务内脏）
│   └── test/             后端测试（node --test）
│
├── frontend/             桌面端 SPA（零构建，普通脚本 + 全局命名空间）
│   ├── app.html          唯一入口
│   ├── js/api.js         公共请求（window.api）
│   ├── js/core/          基础设施：router / view / ui / dom
│   ├── js/views/         页面视图（每个页面自注册）
│   ├── js/project/       模块目录化示范：项目管理的 list/detail/form/board
│   └── js/settings/      模块目录化示范：设置的 profile/backups/ai-config…
│
├── mobile-pwa/           移动端 PWA（Vite，独立端口 3460，共享同一套后端 API）
│   ├── src/api/          client（传输）→ auth（会话）→ resources（业务）
│   ├── src/components/   可复用组件（list-view）
│   ├── src/config/       nav.js（导航展示）· routes.js（路径→页面，唯一映射）
│   ├── src/lib/          基础工具：format / pagination / path / config / urls / toast
│   ├── src/views/panels/ 面板 + registry.js（页面注册表）
│   └── test/             浏览器探针（**不放 src/**）
│
└── tools/                检查与脚手架（不是业务代码）
```

**两端前端不共享代码**，只共享后端 API。这是有意的：桌面端零构建、移动端要打包，
构建模型不同，强行共享会引入构建依赖。共享的是**契约**（`/api/*`）和**规范**（本文档）。

---

## 二、依赖方向（铁律）

依赖只能**自上而下**。反向或跨层依赖一律不允许。

### 后端

```
routes/  →  utils/  →  storage / json-file-store
   ↑           ↑
 只处理      只管业务规则与持久化
 req/res
```

- `routes/*.js`：**不许直接读文件**，一律走 `utils` 里的仓储。也不许写业务计算，计算放 `utils`。
- `utils/*.js`：**不许依赖 `req`/`res`**。需要请求信息就以参数传进来（例外：`auth.js` 这类中间件本身）。
- `utils/storage.js` 是所有 JSON 读写的唯一入口。**不要自己 `fs.readFile` 业务数据。**

### 桌面端

```
views/  →  <feature>/（project、settings…）  →  js/api.js（window.api）与 core/（router、view、ui、dom）
```

- 视图**不许直接 `fetch`**，走 `frontend/js/api.js` 的 `window.api`。桌面端没有 `core/api.js`。
- 模块**不许操作 `app.html` 顶层 DOM**，只操作自己的容器。
- `core/` 不许反向 import `views/` 或任何 `<feature>/`。

### 移动端

```
views/panels/  →  api/resources.js  →  api/client.js
      ↓                   ↓
 components/  →  lib/*（format / pagination / urls / toast）
```

- `views/**`、`components/**` **不许出现 `api.get('/api/...')` 这种字面路径**，必须走 `resources.js`。
- `components/**` **不许 import `views/**`**（组件不能依赖具体页面）。
- `lib/**` 是**基础工具层**：`format`/`pagination`/`config` 必须是纯函数（脱离浏览器可单测），
  `toast`/`urls` 会碰 DOM 但也不许 import 任何 api 或业务模块。
- 登录态只在 `api/auth.js` 里读写 token，视图**不许碰 localStorage 里的 token**。

---

## 三、模块目录化（大文件的标准拆法）

**信号：单文件 > 600 行，或同时承担 3 种以上职责（取数 / 渲染 / 交互 / 校验）。**
满足任意一条，就应该从「一个文件」变成「一个目录」：

```
js/<feature>/
├── page.js      编排与挂载 —— **唯一对外入口**，外部只认它
├── api.js       该 feature 的所有接口调用（不碰 DOM）
├── list.js      列表渲染与分页交互
├── detail.js    详情渲染
├── form.js      表单收集与校验
└── board.js     其他独立视图（按需）
```

现成范例：`frontend/js/project/`、`frontend/js/settings/`。

拆的时候守三条：
1. **对外只认 `page.js` 这一份入口**。桌面端由视图按 `SCRIPT_SRCS` 动态插入脚本，`page.js` 放在清单最后并负责挂载；不要再在 `app.html` 里静态引入这些文件。
2. **`api.js` 只做请求，返回数据**，不返回 HTML、不操作 DOM。提示走 `core/ui.js`。
3. **不为了拆而拆**：300 行的单职责文件保持单文件，拆成 5 个 60 行的碎片更难读。

### 同一概念只许有一个实现

以下这些是「必须复用、不许复制」的东西。出现第二份就是债：

| 概念 | 唯一实现位置 |
|---|---|
| 金额/日期格式化 | 移动端 `lib/format.js`；桌面端 `js/core/ui.js` |
| HTML 转义 | 同上 |
| 接口调用 | 移动端 `api/resources.js`；桌面端 `frontend/js/api.js` |
| 轻提示 / 确认框 | 移动端 `lib/toast.js`；桌面端 `core/ui.js` |
| 分页响应归一化 | 移动端 `lib/pagination.js` |
| 运行环境配置（API 基址） | 移动端 `lib/config.js`（在 lib 不在 api，因为它不含网络行为） |
| JSON 读写 | 后端 `utils/storage.js` |
| 字段加密 | 后端 `utils/secret-box.js` |
| 数据目录路径 | 后端 `utils/data-paths.js` |

`tools/verify-arch.js` 会扫重复定义（如 `function escapeHtml` 出现在两个文件里）。

---

## 四、新增一个功能的完整动作

### 后端加接口
1. `src/routes/<name>.js` 写路由，业务计算放 `src/utils/`
2. `server.js` 里 `app.use('/api/<name>', ...)`（**放在 `auth.apiGuard()` 之后**）
3. 数据读写走 `Storage`，路径**不要自己拼**（用 `data-paths.js`）
4. `backend/test/<name>.test.js` 补测试

### 桌面端加页面
1. `js/views/<name>.js`，用 `App.view({ path, nav, template, styles, mount })` 自注册
2. 路由与侧边栏由注册信息自动生成，**不要手工改 `app.html` 的列表**
3. 跑 `node tools/verify-consistency.js` + `node tools/verify-deps.js`

### 移动端加页面

**一级页面（进右侧导航栏）**
```bash
node tools/new-panel.js orders 订单 --icon receipt
```
手动做的话，**三处缺一不可**：

1. `src/views/panels/<name>.js` 导出 `mountXxxPanel(container, route)`，返回 `{ destroy() }`
2. `src/views/panels/registry.js` 加一行（漏了会**静默落到占位页**）
3. `src/config/nav.js` 加一项，`panel` 填注册表的 key

**详情页 / 子页面（进导航栏是错的）**
```bash
node tools/new-panel.js order-detail 订单详情 --subpage --parent orders --path 'orders/:id'
```
差别只在第 3 步：**不碰 nav.js，改成在 `src/config/routes.js` 的 `SUBPAGE_ROUTES` 加一条**
（`path` 模式 + `parent` 返回目标）。详情页出现在导航栏里是个很自然的手误，
所以这件事由 `--subpage` 开关决定，不靠人记。

> 路径参数别写前导斜杠：Windows 的 Git Bash 会把 `--parent /orders` 翻译成
> `C:/Users/.../PortableGit/orders`，工具现在会直接报错拦下，写成 `--parent orders` 即可。

> `destroy()` 不是可选项：有定时器、事件监听、长连接的页面不实现它，
> 切走再回来就会重复绑定，表现是「点一次触发两次」。

### 移动端的这三张表，别搞混

| 表 | 回答什么问题 | 加东西的时机 |
|---|---|---|
| `config/nav.js` | 右侧导航栏**显示哪几项**、什么图标 | 新增一级入口 |
| `config/routes.js` | **路径 → 页面**（含参数解析、返回目标） | 新增详情页 / 子页面 |
| `views/panels/registry.js` | **页面 key → 挂载函数** | 每新增一个真实页面都要 |

`nav.js` 的每一项会被 `routes.js` 自动注册成静态路由，
所以「导航项」和「子页面」写同一个 path 会被 `verify-mobile` 判成冲突。

---

## 五、禁止清单（每条都有脚本兜着）

| 禁止 | 为什么 | 谁在查 |
|---|---|---|
| 视图里拼 `/api/...` 字面路径 | 接口一改名就要全项目搜字符串 | `verify-arch.js` |
| `window.alert` / `confirm` | 阻塞 JS、打断手势、样式不可控 | `verify-arch.js` |
| 复制第二份工具函数 | 两份实现会慢慢分叉（金额精度、四舍五入各写各的） | `verify-arch.js` |
| 后端路由直接 `fs.readFile` 业务数据 | 绕过用户隔离与备份机制 | 人工 + code review |
| `Storage` 的 `filePath` 写成构造时赋值 | 会在模块加载时就固化到根目录，**所有用户共用一个文件** | `backend/test/storage-user-scope.test.js` |
| 孤立单类选择器上写 `display` | 会压掉 `.hidden`，元素永远显示 | `verify-consistency.js` |
| 视图 CSS 用 `!important` 硬压 | 下一层覆盖要再加 `!important`，很快就失控 | 人工 |
| 新增页面漏登记注册表 | 静默落到占位页，看起来像「还没做」 | `verify-arch.js` |
| 未登记就先删 `destroy()` | 定时器泄漏 | `verify-arch.js` 检查 panel 契约 |

---

## 六、验证命令

```bash
node tools/check-all.js            # 静态全检（秒级，提交前必跑）
node tools/check-all.js --full     # 加上需要后端在跑的测试
```

单独跑：

| 命令 | 查什么 |
|---|---|
| `node tools/verify-consistency.js` | 桌面端路由/视图/模板/样式是否齐备 |
| `node tools/verify-deps.js` | 桌面端 `window.X` 到底加载了没有 |
| `node tools/verify-arch.js` | 全项目架构规则（分层、重复、规模、注册） |
| `node tools/verify-mobile.js` | 移动端专项：nav↔registry、import、CSS 变量、**路由表完整性**、**语法（acorn 真解析）** |
| `node tools/test-mobile-lib.mjs` | 移动端纯逻辑（format / 分页 / 路由）。路由断言查的是「导航与路由一致、入口唯一、详情只挂在列表上」，不把菜单数量锁死成已作废的 5 项方案 |
| `node tools/test-mobile-api.mjs 3456` | 移动端接口层（需后端在跑） |

浏览器探针在 `mobile-pwa/test/`：`probe.html`、`workbench-probe.html`、
`shell-probe.html`（含「进详情 → 返回」、深度 0 的 fallback、短屏/横屏下设置按钮可滚到）、
`orders-probe.html`（订单搜索、筛选、改状态、返回后的列表位置）。
跑法见文件头注释（需要 `node backend/test/_start-lanfree-server.js` 或已登录的实例）。

### Baseline 机制（历史债务怎么处理）

`tools/verify-arch.js` 会把当前已知问题记进 `tools/arch-baseline.json`，
**只报「新增」违规，不逼你清理历史债**。这条很关键：一次要求清完所有旧问题，
结果一定是没人跑检查。

真的消化掉一批旧债之后，用 `node tools/verify-arch.js --update-baseline` 收缩基线。

---

## 七、写代码时的自检三问

1. **这段逻辑别处是不是已经有了？** 有 → import，不要重写。
2. **这段逻辑会不会被第二个页面用到？** 会 → 提到 `components/` 或 `lib/`，别留在页面里。
3. **这个文件超过 600 行了没？** 超了 → 按「模块目录化」拆，`page.js` 做唯一入口。

---

## 八、并行开发注意

这个仓库可能同时有多个会话/多个人在改。**动手前**：

```bash
# 看 40 分钟内有没有语义连贯的一批改动（= 有人在干活）
find . -path ./node_modules -prune -o -type f -name "*.js" -newermt "-40 minutes" -print
```

若同一功能域的 5 个以上文件同时在变，先确认再动手。
发现对方代码里有 bug：**报给维护者，不要顺手改**（各改一半最难查）。

---

_最后更新：2026-10-22 · 规则变更时同步更新本文档与 `tools/verify-arch.js`_
