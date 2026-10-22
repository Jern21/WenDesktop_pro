# AGENTS.md — 给 AI 协作者的项目准则

> 你（AI）在本仓库写的每一行代码，都会有人（或下一个你）在三个月后修改。
> **唯一目标：让那次修改不需要先读 1300 行。**
> 架构细节见 `ARCHITECTURE.md`；本文件只讲「你必须怎么做」。

---

## 0. 开工前（每次任务都要做，不要跳过）

1. **读 `ARCHITECTURE.md` 的「二、依赖方向」和「五、禁止清单」** —— 这两节决定你的代码能不能合入。
2. **查并行会话**，避免和别人改同一批文件：
   ```bash
   find . -path ./node_modules -prune -o -type f -name "*.js" -newermt "-40 minutes" -print
   ```
   若同一功能域的 5 个以上文件同时在变 → **先问用户**，不要动手。
3. **确认改动范围**：说清楚你要动哪些文件、为什么。范围外的文件不要顺手改。

---

## 1. 写代码前的第一件事：先搜索，别先写

新写任何一个工具函数之前，先 grep：

```bash
# 例：要写金额格式化
grep -rn "function formatMoney\|formatMoney =" --include=*.js frontend/js mobile-pwa/src
```

- 已有 → **import 它**。不许复制，哪怕"只是小改一下"。
- 已有但不够用 → **改那一个**，然后修所有调用点。**不许并行造第二个。**
- 确实没有 → 按下面第 3 条放到正确位置。

> 判断依据：`ARCHITECTURE.md` 第三节「同一概念只许有一个实现」那张表。

---

## 2. 依赖方向不许反（最容易被违反的一条）

| 你在改 | 绝对不许 |
|---|---|
| `mobile-pwa/src/views/**`、`components/**` | `api.get('/api/...')` 字面路径、直接读写 token、`window.alert` |
| `mobile-pwa/src/components/**` | import `views/**` |
| `mobile-pwa/src/lib/**` | import 任何 api / 业务模块（必须能脱离浏览器单测） |
| `frontend/js/views/**` | 直接 `fetch`、操作 `app.html` 顶层 DOM |
| `frontend/js/core/**` | import `views/` 或任何 `<feature>/` |
| `backend/src/routes/**` | 直接 `fs.readFile` 业务数据、写业务计算 |
| `backend/src/utils/**` | 依赖 `req` / `res`（中间件除外） |

接口一律：移动端走 `api/resources.js`，桌面端走 `js/core/api.js`。

---

## 3. 新文件放哪（对照表，别凭感觉）

| 你要写的东西 | 放这里 |
|---|---|
| 新接口 | `backend/src/routes/<name>.js` + `server.js` 挂载（在 `auth.apiGuard()` 之后） |
| 后端业务规则/计算 | `backend/src/utils/<name>.js` |
| 桌面端页面 | `frontend/js/views/<name>.js`（用 `App.view({...})` 自注册） |
| 桌面端某功能的多个子文件 | `frontend/js/<feature>/`，**`page.js` 是唯一对外入口** |
| 移动端一级页面 | `node tools/new-panel.js <name> <标签>` 生成（不要手搓三处） |
| 移动端详情页/子页面 | `node tools/new-panel.js <name> <标签> --subpage --parent <父路径> --path '<模式>'`（**不要**让它进导航栏） |
| 移动端可复用组件 | `mobile-pwa/src/components/` |
| 移动端纯函数/配置 | `mobile-pwa/src/lib/`（format/pagination/path/config 保持纯函数，可脱离浏览器单测） |
| 移动端「路径 → 页面」 | `mobile-pwa/src/config/routes.js`（唯一映射，别在 shell 里写 if-else） |
| 移动端导航栏显示什么 | `mobile-pwa/src/config/nav.js`（只管展示，不做匹配） |
| 移动端浏览器测试 | `mobile-pwa/test/`（**不许放 `src/`**） |
| 检查/脚手架脚本 | `tools/` |

---

## 4. 什么时候必须拆（硬判据）

**满足任意一条就拆：**

- 单文件 **> 600 行**
- 一个文件同时干 **3 种以上**职责（取数 / 渲染 / 交互 / 校验 / 持久化）
- 同一段逻辑你**第二次**复制粘贴

拆法见 `ARCHITECTURE.md` 第三节。**拆完只有 `page.js` 被外部 import**，别人的用法不变才算拆对。

**反向约束：不要为了"看起来整洁"拆。** 300 行的单职责文件保持单文件；
把 300 行拆成 5 个 60 行的碎片，跳转次数变多，反而更难读。

---

## 5. 不许做的事

| 不许 | 说明 |
|---|---|
| 为了通过检查而改检查脚本 | 规则要变可以，但必须**先说明理由**并同步改 `ARCHITECTURE.md` |
| 留半成品 `TODO` 就交付 | 要么做完，要么明确告诉用户"这部分没做，原因是 X" |
| 顺手改别人正在改的文件 | 见第 0.2 条 |
| 删除项目文件 | 除非：`grep` 确认无引用 **且** `git ls-files` 确认已被跟踪 |
| 改 `backend/data/` 下的业务数据 | 那是用户的真实数据。测试请用临时目录 |
| 在视图里加 `!important` 压样式 | 下一层覆盖要再加一层，很快失控 |
| 把敏感字段原样渲染 | 账号密码、API Key 必须走 `secret-box` 或脱敏（`sk-xxxx****1234`） |
| 用 `class` / 箭头函数改写既有文件风格 | **跟随所在目录的既有风格**（本项目多数文件是 `var` + `function`） |

---

## 6. 完成前必须跑（不跑就不算完成）

```bash
node tools/check-all.js
```

要求：**0 个新增违规**。历史债务已记在 `tools/arch-baseline.json`，不用你清。
但**你新引入的必须为 0**。

按改动类型追加：

| 你改了 | 还要跑 |
|---|---|
| 移动端 `lib/`、`api/` | `node tools/test-mobile-lib.mjs`；涉及接口则加 `node tools/test-mobile-api.mjs 3456` |
| 移动端页面/组件 | `mobile-pwa/test/` 下对应探针（无头 Chrome，见文件头注释） |
| 桌面端视图/路由 | `node tools/verify-consistency.js` + `node tools/verify-deps.js` + `frontend/test/core.smoke.js` |
| 后端路由/utils | `node backend/test/<相关>.test.js` |
| 公共层（api/format/components/storage/auth） | **全部相关测试**，公共层改错会一处崩全站 |

---

## 7. 汇报格式（用户要看的是结论，不是你做了什么）

必答三件事：

1. **改了哪些文件，各自为什么**（一句话一个）
2. **验证结果**（哪个命令、几项通过、有没有没覆盖到的）
3. **遗留问题 / 我没做的事**（不要藏）

不许只写"已完成"或"优化了一下"。用户需要能判断这次改动值不值得信任。

---

## 8. 项目已知的坑（改之前先看一眼）

节选，完整版在 `docs/` 与代码注释里：

- **`Storage` 的 `filePath` 必须是 getter**，写成构造时赋值会让所有用户共用一份数据
- **视图 CSS 别在孤立单类选择器上写 `display`**，会压掉 `.hidden`（历史事故：点日期弹出了删除框）
- **`api.js` 非 2xx 必须读 body**，否则后端中文校验文案全丢
- **`<img>` 带不了 Bearer**，附件图只能靠 Cookie，登录必须保留 `credentials:'include'`
- **`/api/orders`、`/api/platform-posts` 返回分页对象**，其余接口是裸数组，别混
- **`/api/reminders/calendar` 的 `days` 是按日分组的对象**，不是数组

移动端路由相关的坑（批次 0 实测踩出来的）：

- **详情页的返回按钮不能用裸 `history.back()`**。从微信直接打开 `/orders/123` 时
  history 里没有上一条本站记录，`back()` 会**退出站点**（PWA 里等于关掉应用）。
  现在用 `history.state.__mobIndex` 记深度，深度 0 走 `goBack()` 的 fallback。
  别改用 `history.length` —— 它把「打开标签之前的整段会话」都算进去，在 PWA 里恒为非零。
- **Windows Git Bash 会把以 `/` 开头的命令行参数翻译成 `C:/...` 路径**。
  `--parent /orders` 传到 node 手里会变成 `C:/Users/xxx/PortableGit/orders`。
  写成 `--parent orders`（不带前导斜杠）即可。
- **带连字符的面板名写进 `registry.js` 必须加引号**：`'order-detail': { … }`。
  不加就是语法错误，而纯正则的静态检查看不见，会一路溜到 `vite build`。
  现在 `verify-mobile.js` 用 acorn 真解析一遍，这条兜住了。

---

_这份文件是活文档。你发现规则有漏洞、或者某条规则在实践中总是被绕开，
就应该提出来改它 —— 但改之前先说明为什么。_
