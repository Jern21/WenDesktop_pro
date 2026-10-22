# Agent 接入规划（GrokBot → wen-workbench）

> **状态**：规划稿，本轮未改任何业务代码。
> **修订 2026-10-22 11:35**：确认 GrokBot 是 **Agent 形态、自有电脑、能自己写代码** →
> 接入性质从"可选内网"变成**跨公网远程调用**，新增第 11 节（七条约束：网络 / 两把钥匙 / 数据出站 / 时区 / 绕过 / 断线 / 协议）。
> **修订 2026-10-22 11:42**：文总决定**第一期先求简单**，不做网络加固，只做接口鉴权 + 直接请求 →
> 新增第 13 节「简版路线」，**冲突时以第 13 节为准**；第 10、11 节转为后期加固路线。
> **修订 11:50**：代码由文总自己实施 → 补**第 14 节实施规格**（逐文件函数签名 + 坑）与
> **第 15 节**（与根目录 `GROK_BOT_CONNECTION.md` 的衔接，含待插入段落草稿）。
> 网络可达方式暂不处理（GrokBot 走命令行请求）。
> **基线**：2026-10-22 当前代码实测（`backend/server.js`、`utils/auth.js`、`utils/storage.js`、`utils/data-backups.js`、`routes/orders.js|memos.js`）。
> **结论**：建议稿的业务切分是对的，但有 4 处**在实现层会踩坑**，本文已修正（见第 1 节）。

---

## 0. 一句话方案

给 Agent 开一条**独立鉴权、只读优先**的专用通道：

```
Agent 凭证(专用 header) → 校验签名/有效期/撤销/权限 → 落地成 ownerUser 的请求上下文
  → 复用 utils 里的查询与统计 → 统一分页与投影 → 强制审计
```

不建 `grokbot` 用户，不复用登录密码，不允许 Agent 调老 `/api/*`。

---

## 1. 对建议稿的四处修正（读了代码之后的结论）

### ① 挂载位置：放在 `apiGuard()` **之前**，不要塞进守卫内部

建议稿写的是"在守卫内部为 Agent 路径选择专用验证方式"。问题在 `utils/auth.js:427-431`：

```js
function apiGuard() {
    return function (req, res, next) {
        if (!AUTH_ENABLED) {                      // ← 这里
            return attachUserContext(req, res, next);   // 直接当 admin 处理
        }
        ...
```

只要有人为了本机调试设了 `AUTH_ENABLED=0`，走守卫内部的 Agent 分支会**一起被豁免** —— Agent 通道就变成"免凭证、admin 全权"的公网接口。

**改为**（`backend/server.js`，在 `app.use('/api', auth.apiGuard())` 之前插入一行）：

```js
// Agent 专用通道：自带鉴权，不依赖 AUTH_ENABLED，必须挂在通用守卫之前
app.use('/api/agent/v1', require('./src/routes/agent'));
// 其余 /api/* 仍然必须已登录
app.use('/api', auth.apiGuard());
```

`routes/agent.js` 顶层第一行就是 `router.use(agentAuth.guard())`，任何子路由都在 guard 之下。

> ⚠️ 这与 `AGENTS.md` 的「新路由一律挂在 `apiGuard()` 之后」冲突，属于**必须明文记录的例外**。
> 按 `AGENTS.md §5` 的要求：改规则要先说理由、并同步写进 `ARCHITECTURE.md` 第四节。
> 理由就是上面那条：Agent 校验要独立于「认证总开关」，否则总开关会连带打开 Agent 的后门。

### ② 查询逻辑必须先抽到 `utils`，否则第一期就得复制一份

现状（这就是 A7「同一概念重复实现」的入口）：

| 现状 | 位置 |
|---|---|
| 订单 12 个筛选条件 + 4 种排序 + 分页，全写在路由里 | `routes/orders.js:103-212` |
| 备忘录筛选 + 置顶排序 | `routes/memos.js:33-60` |
| 项目列表排序 | `routes/projects.js:97` |

Agent 路由如果"照着自己写一遍"，同一个筛选规则立刻有第二份实现。所以**批次 1 的第一个动作不是写 Agent 路由**，而是：

- 新增 `utils/list-query.js`：通用引擎（`applyFilters` / `applySort` / `paginate`）
- 新增 `utils/agent-specs.js`：每个实体允许的筛选字段、排序字段、字段投影白名单
- **老路由同步改成调用引擎**（行为不变，用现有 `backend/test/*.test.js` 兜回归）

一次动两处，但换来的是"网页和 Agent 用同一份规则"。

### ③ 返回形态不统一，Agent 侧必须归一

`/api/orders` 返回 `{list, total, page, pageSize}`（`orders.js:206`），
`/api/memos`、`/api/reminders`、`/api/projects` 返回**裸数组**。

Agent 契约一律用 `{ list, total, page, pageSize }`。否则模型会写出两套解析分支，
换一个接口就报 `data.filter is not a function`。

### ④ 默认分页 50 → Agent 默认 20、上限 100

`orders.js:119` 现在是 `pageSize` 默认 50、**没有上限**。Agent 侧必须夹死上限：
模型很容易写 `pageSize=100000`，一次把全库塞进上下文窗口，既费 token 又容易超时。

### 补充一条建议稿没提的

**trial 账号不得创建 Agent 凭证。** trial 是免密登录（`TRIAL_LOGIN`），
如果能给 trial 签发凭证，等于给一个免密入口配了把长期有效的公网钥匙。
创建接口里显式拒绝 `auth.isTrialLogin(username)`。

---

## 2. 三个身份，别混

| 身份 | 来源 | 决定什么 |
|---|---|---|
| **ownerUser** | 凭证记录里的 `ownerUser` | `userContext.run(ownerUser)` → `Storage` 读写哪个用户目录 |
| **agentId** | 凭证 token 的 id 段 | 审计记录归属、限流配额、撤销粒度 |
| **scopes** | 凭证记录里的数组 | 接口级授权，后端 `requireScope()` 强制 |

`agentAuth.guard()` 最后一步必须是 `userContext.run(ownerUser, next)`。
少了它，`Storage` 会读到**根目录**（`data-backups.captureScope()` 拿不到用户 → 落 `DATA_DIR`），
表现是"Agent 查到 0 条数据"，而且不报错 —— 与 `Storage.filePath` 那个历史坑同源。

---

## 3. 文件清单

### 新增

| 文件 | 职责 | 硬约束 |
|---|---|---|
| `backend/src/utils/agent-registry.js` | 凭证 CRUD、摘要校验、`touchLastUsed` | **读注册表必须传 `scope={username:null}`**（见 §4 陷阱） |
| `backend/src/utils/agent-auth.js` | `guard()` 中间件、`requireScope()`、token 解析 | 不 require `auth.js`（避免循环依赖）；**失败一律 401，不区分原因** |
| `backend/src/utils/agent-audit.js` | 追加审计、脱敏、环形裁剪 | 只接收普通对象，不碰 `req`（A6） |
| `backend/src/utils/agent-ratelimit.js` | 进程内令牌桶，按 agentId | 单实例假设，写进注释 |
| `backend/src/utils/list-query.js` | 筛选/排序/分页引擎 | 纯函数，可脱离 express 单测 |
| `backend/src/utils/agent-specs.js` | 每实体的筛选白名单/排序白名单/投影白名单 | 纯配置，无副作用 |
| `backend/src/utils/orders-summary.js` | 订单汇总（从 `orders.js:45-92` 抽出） | 网页与 Agent 共用 |
| `backend/src/routes/agent.js` | `/api/agent/v1/*` 只读接口 | 只处理 `req/res`，无业务计算 |
| `backend/src/routes/agent-credentials.js` | 凭证管理（挂在 `apiGuard()` 之后，登录身份操作） | 拒绝 trial |
| `docs/agent-openapi.yaml` | 契约（交给 GrokBot） | 与实现同步，改接口必改它 |
| `docs/agent-tools.json` | 工具定义（`search_orders` / `get_order` / …） | 与 OpenAPI 一一对应 |
| `backend/test/agent-auth.test.js` | 凭证校验、越权、跨用户、撤销、过期 | 临时数据目录 |
| `backend/test/agent-read.test.js` | 筛选/排序/分页/投影/归一化 | 同上 |

### 修改

| 文件 | 改什么 | 为什么 |
|---|---|---|
| `backend/server.js` | 在 `apiGuard()` 前挂 `/api/agent/v1`；`apiGuard()` 后挂 `/api/agent-credentials` | §1① |
| `backend/src/routes/orders.js` | 筛选/排序/分页改调 `list-query` + `orders-summary` | §1② |
| `backend/src/routes/memos.js`、`projects.js`、`reminders.js`、`customers.js` | 同上（各自 spec） | §1② |
| `ARCHITECTURE.md` | 第四节记一条"Agent 通道路由在守卫之前"的例外 | §1① |
| `GROK_BOT_CONNECTION.md` | 第 3.2 节改为"Agent 凭证优先，登录 token 仅人工调试" | 交付物第 3 份 |
| `AGENTS.md` | 第 8 节补 agent 通道的三条坑 | 后来者要看 |

---

## 4. 凭证模型

### token 格式（自识别，避免与登录 token 混淆）

```
wt_agent_<id>.<secret>
         ↑12位base36          ↑32 字节 base64url（43 字符）

例：wt_agent_ag7f3k2m9q4x.KJ8s...（只在创建响应里出现这一次）
```

- 请求头双支持：`X-Agent-Key: <token>`（推荐）或 `Authorization: Bearer wt_agent_...`
- **判别只看 `wt_agent_` 前缀**：没有前缀的 Bearer 一律按普通会话处理 →
  登录 token 打不进 Agent 通道，Agent token 也打不进老接口（`parseToken` 会直接判为无效）。

### 存储（`backend/data/agent-registry.json`，对象数组）

```json
{
  "id": "ag7f3k2m9q4x",
  "ownerUser": "admin",
  "name": "GrokBot 助理",
  "secretHash": "<sha256(secret) 的 hex>",
  "secretHint": "wt_agent_ag7f3k2m9q4x…9f2c",
  "scopes": ["orders:read", "customers:read", "reports:read"],
  "createdAt": "2026-10-22T03:00:00.000Z",
  "createdBy": "admin",
  "expiresAt": "2027-01-20T00:00:00.000Z",
  "revokedAt": null,
  "lastUsedAt": "2026-10-22T03:05:00.000Z",
  "lastUsedIp": "203.0.113.7"
}
```

规则：

- **只存摘要**，不存明文，也不用 `secret-box`（那是可逆的 AES，这里没有"要还原"的需求）。
  secret 是 32 字节随机值，不是人选的密码，用一次 SHA-256 足够，不需要慢哈希。
- 校验用 `crypto.timingSafeEqual`，按 `id` 先定位记录（O(1)，不用全表扫）。
- `secretHint` 允许落盘，供界面识别"是哪把钥匙"，只有前后各一段。
- 创建时生成 12 个月有效期，可传更短；`expiresAt` 必填，不给"永久"。

> 🚨 **陷阱：读注册表必须显式传 `scope = { username: null }`。**
> 注册表是**全局**的（跨用户），而 `JsonFileStore.read(scope)` 不传 scope 就跟随
> `userContext`（`data-backups.js:84-96`）。Agent 通道在 `guard()` 里还没切用户，
> 侥幸读对；但**凭证管理接口**是在登录态下调用的，那时 `userContext` 已经是 admin，
> 不传 scope 就会去 `data/users/admin/agent-registry.json` 找一个不存在的文件 → 返回 `[]`。
> 一旦后续写入跟着写，就会在用户目录里造出第二份注册表，出现"凭证时而存在时而不存在"。
> 这与 `Storage.filePath` 那个历史坑是同一类问题：**路径必须显式、不能靠环境默认**。

### 凭证管理接口（`/api/agent-credentials`，登录身份操作）

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/agent-credentials` | 列出**当前用户**创建的凭证（无 secret，只有 hint） |
| POST | `/api/agent-credentials` | 创建，响应里**只有这一次**返回明文 token；拒绝 trial |
| POST | `/api/agent-credentials/:id/rotate` | 换 secret（旧凭证立即失效），返回新 token 一次 |
| DELETE | `/api/agent-credentials/:id` | 撤销（写 `revokedAt`，不物理删，保留审计可追溯） |

---

## 5. 权限矩阵

| scope | 放开的接口 |
|---|---|
| `orders:read` | `GET /orders`、`GET /orders/:id` |
| `customers:read` | `GET /customers`、`GET /customers/:id` |
| `projects:read` | `GET /projects`、`GET /projects/:id` |
| `reminders:read` | `GET /reminders` |
| `memos:read` | `GET /memos`、`GET /memos/:id` |
| `reports:read` | `GET /reports/summary` |
| `customers:pii` | 客户手机号**完整号码**（默认情况下响应里是 `138****8000`，见 §11③） |
| `memos:write` | 第二期：`POST /memos` |
| `reminders:write` | 第二期：`POST /reminders` |
| `orders:write` | **第四期**：`POST /orders/:id/draft` + 确认后执行 |

- `GET /capabilities` 永远放行（不需要 scope），它返回**这把凭证自己的** scopes，
  让 Agent 开局就知道边界，而不是靠试错撞 403。
- 缺权限返回 `403 AGENT_SCOPE_DENIED`，**响应里只写缺哪个 scope**，不透露资源是否存在。
- 别人的记录一律 **404**（与 `/uploads` 的归属校验同一条原则：403 等于确认"存在但不给你"）。

---

## 6. 第一期接口契约

统一前缀 `/api/agent/v1`，统一响应：

```json
{ "success": true, "data": { "list": [], "total": 0, "page": 1, "pageSize": 20 } }
```

| 方法 | 路径 | 主要参数 | scope |
|---|---|---|---|
| GET | `/capabilities` | —（返回自身 scopes + `serverTime` + `timezone`） | 无 |
| GET | `/orders` | `status` `paymentStatus` `customerId` `keyword` `dateFrom` `dateTo` `overdue` `dueToday` `sort` `page` `pageSize` | orders:read |
| GET | `/orders/:id` | — | orders:read |
| GET | `/customers` | `keyword` `level` `sort` `page` `pageSize` | customers:read |
| GET | `/customers/:id` | — （含最近订单/跟进摘要） | customers:read |
| GET | `/projects` | `status` `keyword` `sort` `page` `pageSize` | projects:read |
| GET | `/reminders` | `from` `to` `done` `priority` `page` `pageSize` | reminders:read |
| GET | `/memos` | `keyword` `category` `page` `pageSize` | memos:read |
| GET | `/reports/summary` | `month`（默认当月） | reports:read |

实现约定：

1. **筛选字段白名单**：不在 `agent-specs.js` 里的查询参数 → `400`，不静默忽略。
   静默忽略最坏：Agent 以为筛了"未完成"，其实拿到全量。
2. **排序稳定**：任何排序都以 `id` 作次级键，翻页不会重复/漏项。
3. **分页**：`page` 默认 1，`pageSize` 默认 20、上限 100（超了按 100 处理并在响应里回真实 `pageSize`）。
4. **汇总在后端算**：`/reports/summary` 内部调 `orders-summary.js`，**不许**让 Agent 拉全量自己加。
5. **禁止 Agent 路由反过来 `fetch` 自己的 `/api/*`** —— 进程内 HTTP 自调用会绕开 `userContext`、
   多一跳超时、还把审计打成两条。一律直接 require utils。
6. 响应带 `X-Request-Id`，与审计记录、日志同值，方便对账。

### 错误码

| HTTP | code | 含义 |
|---|---|---|
| 401 | `AGENT_UNAUTHORIZED` | 凭证缺失/格式错/摘要不匹配/已过期/已撤销（**不区分**，防止探测） |
| 403 | `AGENT_SCOPE_DENIED` | 缺 scope，响应带 `required` 字段 |
| 404 | `NOT_FOUND` | 不存在**或**不属于该 owner |
| 400 | `BAD_REQUEST` | 参数非法（含不支持的筛选字段） |
| 409 | `VERSION_CONFLICT` | 记录已被改（第二期起） |
| 429 | `RATE_LIMITED` | 带 `Retry-After` 秒数 |

---

## 7. 一次请求的完整链路

```
请求 /api/agent/v1/orders?status=pending
  ↓ server.js（在 apiGuard 之前，与 AUTH_ENABLED 无关）
  ↓ agentAuth.guard()
      1. 取 token（X-Agent-Key 优先，其次 Bearer 且须带 wt_agent_ 前缀）
      2. 拆 id → agent-registry 按 id 查（scope 固定 {username:null}）
      3. timingSafeEqual(sha256(secret), secretHash) → 失败 401
      4. revokedAt / expiresAt 检查 → 失败 401
      5. 限流桶（按 agentId）→ 超额 429
      6. req.agent = { id, ownerUser, scopes, name }
      7. userContext.run(ownerUser, next)      ← 数据归属在这一步定下来
  ↓ agentAuth.requireScope('orders:read')
  ↓ routes/agent.js：只解析参数、调 utils、包响应
  ↓ utils/list-query（筛选/排序/分页）+ agent-specs（投影）
  ↓ utils/storage（读取 ownerUser 的 orders.json）
  ↓ agent-audit.append（异步、失败不影响响应）
  ↓ 响应 + X-Request-Id
```

审计字段：`{ ts, requestId, agentId, agentName, ownerUser, method, path, status, scope, ip, durationMs, resultCount }`。
**不记录**：token、`Authorization` 头、任何 `password` / `apiKey` 字段（`agent-audit` 内置字段黑名单，别指望调用方自觉）。

---

## 8. 第二期：写操作怎么开

分四档，按影响面递进：

| 档 | 操作 | 策略 |
|---|---|---|
| A | 新建备忘、新建提醒 | 有 `*:write` 直接执行；必须带 `Idempotency-Key` |
| B | 添加客户跟进 | 直接执行（追加型，不改原有数据） |
| C | 改订单金额 / 付款状态 / 项目状态 | **草案 + 用户确认**，Agent 不能自己执行 |
| D | 删除、批量修改、恢复备份、改系统配置 | 一期不开放（连草案都不给） |

### 草案/确认流程（C 档）

```
1. Agent: POST /api/agent/v1/orders/:id/draft
   body: { patch: { paymentStatus: "已结清" } }
   ← 返回 { draftId, target:{type,id}, before, after, expiresAt(+5min), version }

2. 用户在网页「待确认」卡片上点确认（登录态，走 /api/agent-drafts/:id/confirm）
   ← 后端校验：draft.ownerUser === session.username
               draft.usedAt == null
               Date.now() < expiresAt
               record.updatedAt === draft.version    ← 版本一致才执行
   ← 不一致 → 409 并作废草案
```

**关键：确认动作只认登录会话，不认 Agent 凭证。** Agent 传 `confirmed: true` 一律忽略 ——
确认是"人"的动作，Agent 只能提交草案。

### 幂等

- 请求头 `Idempotency-Key`（必填，UUID）
- 存储 `agent-idempotency.json`（按用户）：`key → { requestHash, status, body, createdAt }`，TTL 24h，上限 500
- 同 key 同 body → 直接回放上次响应（含原状态码）；同 key 不同 body → `409 IDEMPOTENCY_MISMATCH`

### 并发

`storage.js` 是 read-all → 改内存 → write-all（`json-file-store.js:80-89`），**没有文件锁**。
单进程内 Express 是单线程、每个 handler 全同步，天然串行 —— 这是它目前安全的原因。
但**第二期写操作引入 await 就会破功**（`asyncHandler` 里一旦有 await，两个请求可能交错读到同一份旧数组，
后写的覆盖先写的）。所以：

- 写路径**保持全同步**（不要 `await`），或
- 引入进程内串行队列（`utils/write-queue.js`，按文件名的 Promise 链）

这条必须写进 `agent.js` 顶部注释，否则半年后没人记得为什么这里不能加 await。

### 操作留痕：业务记录里必须能看出「是谁改的」

现在 `Storage.update()` 只写 `updatedAt`（`storage.js:296-299`），**没有操作者**。
Agent 接进来之后，"这单金额是谁改的"会立刻变成答不出来的问题 —— 只能翻审计日志按时间戳对，
一旦同一天有网页和 Agent 都改过同一条，就对不上了。

所以第二期起，写路径统一追加一个内部字段：

```json
{ "_updatedBy": "agent:ag7f3k2m9q4x", "_updatedVia": "agent" }
```

- 网页端写 → `user:admin` / `via:web`
- Agent 写 → `agent:<id>` / `via:agent`
- 字段以 `_` 开头，前端表单的白名单（`pick-fields` / `order-payload`）会自动丢弃，不会被误显示或误写回
- 顺手对网页端也统一，这样"这条记录最后一次是谁动的"永远有答案

`createdBy` 同理，第一版只在 Agent 创建时写，不改历史数据。

---

## 9. 护栏（防止后来者把洞重新打开）

| 项 | 做法 |
|---|---|
| 静态检查 | `tools/verify-arch.js` 加 A12：`routes/agent*.js` 必须出现 `requireScope`；`server.js` 里 `/api/agent/v1` 的挂载行必须在 `apiGuard()` **之前** |
| 单测 | `agent-auth.test.js`：坏 token / 过期 / 撤销 / scope 不足 / 跨用户 / trial 建凭证，六条必须全绿 |
| 契约测试 | `agent-read.test.js` 对每个实体断言"裸数组接口经 Agent 层后是分页对象" |
| 文档同步 | `docs/agent-openapi.yaml` 改了接口没改文档 → 在 `check-all.js` 里加一条"路径集合比对"（可选，第四批做） |
| 手工验收 | `curl` 剧本（无凭证 401 / 有凭证 200 / 缺 scope 403 / 别人的 id 404 / 撤销后 401） |

---

## 10. 批次与验收

| 批次 | 交付物 | 验收命令 | 完成标志 |
|---|---|---|---|
| **1 只读接入** | `list-query` + `agent-specs` + `orders-summary` 抽取；老路由改用；`agent-*` 五个 utils；`routes/agent.js`；`agent-credentials.js`；`server.js` 挂载 | `node tools/check-all.js`（0 新增违规）+ `node backend/test/agent-auth.test.js` + `node backend/test/agent-read.test.js` | 凭证可查 5 类数据；越权 403、跨用户 404、撤销后 401 |
| **2 契约交付** | `docs/agent-openapi.yaml`、`docs/agent-tools.json`、`GROK_BOT_CONNECTION.md` 升级 | OpenAPI 用 `npx @redocly/cli lint`（或至少 YAML 可解析） | GrokBot 按文档能完成"查本月未完成订单"且不用猜参数 |
| **3 低风险写入** | 备忘/提醒创建 + 幂等模块 | `node backend/test/agent-write.test.js`（含"同 key 重试不重复创建"） | 断网重试 3 次，库里只多 1 条 |
| **4 重要操作** | 草案模块 + 网页确认卡片 + 版本冲突 | `node backend/test/agent-draft.test.js` | 用户没点确认，数据不动；点之前记录被改则 409 |
| **5 上线** | 网络方案（见 §11①）、两把钥匙、`boundTo`/`lastUsedIp` 监控、`TRIAL_LOGIN=0`、`AUTH_ENABLED` 开启 | 手工 checklist（`GROK_BOT_CONNECTION.md §9`） | 可撤销、可追踪（`grep requestId` 能还原整条链路）、可恢复 |
| **6 观察期（可选）** | `GET /reports/digest` 日报 + 设置页只读审计列表 | — | 一周后看审计日志，用它**实际调过**的接口来决定开哪些写权限 |

**第一批只做只读，跑通再接写。** 顺序不能反：写操作会逼你同时解决幂等、并发、确认三个问题，
混在一起排查时根本分不清是权限没配对还是幂等没生效。

---

## 11. GrokBot 是「有自己一台电脑的远程 Agent」——由此新增的七条约束

> 前提更新（2026-10-22 11:35）：GrokBot 是 **Agent 形态**，能自己写代码、自己跑脚本，
> 机器在**另一台电脑**上，不在本项目所在的内网。
> 这一条把原来三个"待定"全定了：**跨公网访问、凭证落在第三方机器、数据会出站**。

### ① 网络：优先组虚拟私网，不要把 3456 直接开公网

| 方案 | 做法 | 代价 |
|---|---|---|
| **Tailscale（首选）** | 两台机器装客户端、登同一 tailnet，Agent 那台用 `http://100.x.x.x:3456` 直连 | 各装一次，之后等于"同一私网"：**不开端口、不要 DDNS、不用买证书** |
| Cloudflare Tunnel | 你这边跑 `cloudflared`，只映射 `/api/agent/v1/*` 与 `/api/health` | 对方机器不用装东西，但请求经 Cloudflare = 数据多过一手 |
| 开公网 + 反代 | Nginx/Caddy + TLS + DDNS + IP 白名单 | 最麻烦；家宽动态 IP 会断；暴露面最大 |

- 后端监听地址保持 `127.0.0.1` / 内网网卡，**不要 `0.0.0.0` 直接对公网**。
- 反代或隧道上**只放行 `/api/agent/v1` 前缀 + `/api/health`**，其余 `/api/*` 与网页一律 404。
  这样即使它那台机器被入侵，也摸不到"登录接口"和"网页接口"的攻击面。

#### 为什么不直接开公网 —— 先把两个维度分开

这是两件**互相独立**的事，混淆了就会得出"上了 VPN 就安全了"的错误结论：

| 维度 | 问题 | 谁来解 |
|---|---|---|
| **网络层** | 全世界谁能碰到你的 3456 端口 | 公网直连 → 靠你自己做对一堆事；Tailscale → 靠 WireGuard 默认拒绝 |
| **应用层** | 碰到之后能查什么、能改什么 | **两个方案都一样**：靠凭证 + scope + 审计 + 脱敏 |

开公网的真正代价不是"会被黑"，而是**你要一个人长期维护下面这张清单，任何一项漏了都可能出事**：

TLS 证书续期 · 反代只转发白名单路径 · 限流与防爆破 · 漏洞补丁（Node / Express / 依赖）·
端口与上传口暴露面 · 访问日志与告警 · IP 白名单 · 家宽入站 80/443 被运营商封（需备案或换非标端口）·
动态 IP 与 DDNS 掉线

而且这不是假设：**这个代码库自己就有过两次"默认路径漏了"的记录** ——
`/uploads` 只挂 `pageGuard()` 导致免密 trial 读到主账号合同；`AUTH_ENABLED=0` 会连带豁免整个守卫。
把这种"偶有疏漏、靠事后修"的服务直接对着全世界的扫描器，风险是实打实的。
（扫描器几小时内就会找到新开的端口，这是常态。）

Tailscale 的机制是**把"谁能在连接层进来"这件事外包出去**：WireGuard（Curve25519 + ChaCha20-Poly1305）
+ 每台设备一个 node key + 默认拒绝。没加入 tailnet 的设备，**在连接层就被丢弃，请求根本到不了 Express**，
不跑你的任何中间件和业务代码。也不需要开入站端口（NAT 穿透失败时走 DERP 中继，中继只转发密文）。

#### 但 Tailscale 有三个代价，别当成白拿

1. **对方那台机器进了你的私网 —— 这是最大的权衡。**
   默认情况下它能看到你 tailnet 里的**所有**设备，不只是这台。GrokBot 的机器你能让它自由操作，
   别人也可能；它一旦被入侵，就成了进入你内网的跳板。
   → **必须用 ACL 收窄**：给它打 `tag:grokbot`，你的机器打 `tag:workbench`，
   grant 只允许 `tag:grokbot → tag:workbench` 的 `tcp:3456`，**单向、单端口**，其余全拒。
   （具体语法以 Tailscale 官方 `grants` 文档为准，别照抄笔记。）
2. **控制面账号成了新的单点。** Tailscale 账号被盗 = 攻击者能把自己的机器加进 tailnet。
   → 必须开 MFA。想彻底不依赖第三方就自建 Headscale，但那等于"控制面也要你自己维护"。
3. **客户端常驻、掉线全断。** 这不影响安全，但影响可用性，正好对上 §11⑥ 的"离线话术"。

#### Tailscale 明确不解决的
凭证泄露、越权访问、数据出站、审计追溯 —— 一条都不解决（就是上图底下那条）。
所以正确说法是：**Tailscale 把"谁能碰到服务"从"全世界"缩到"两台已认证机器"，
剩下的仍然全靠第 4–6 节那套凭证/权限/审计机制。**

#### 什么时候直接开公网是合理的
托管在正规云主机、有运维、有 WAF、有监控告警、只暴露一个 `/api` 前缀并配 IP 白名单 ——
这是企业里的标准做法，没问题。它的问题是**前提条件你都得有**。

你现在的情况是：个人电脑 + 家庭宽带 + 一个人维护 + 没有 WAF 与日志告警。
不是"不能做"，是**性价比不划算**：省下装一个客户端的时间，换来一张要长期维护的清单。


### ② 凭证拆成"两把钥匙"，别用一把全权钥匙

凭证现在放在**它的**机器上 —— 保管责任从"你"变成"它"，泄露概率相应上升。

- **只读钥匙**（`*:read` + `reports:read`）：有效期 90 天，长期放在它机器上
- **写钥匙**（`memos:write` / `reminders:write`）：有效期 7 天，**只在你让它做写操作的那几天给它**
- 两把可独立撤销。损失量级不同就不该用同一把：只读泄露 = 数据外流；写钥匙泄露 = 数据被改。
- 凭证**不要写进 prompt / 对话历史**（会话可能被留存、被插件读到、被日志捞走）。
  放它机器上的 `~/.config/wen-workbench/agent.key`（`chmod 600`）或 secret manager，环境变量注入。
- registry 里补两个远程场景专用字段：`boundTo`（"GrokBot@他家 Mac"）、`lastUsedIp`。
  **`lastUsedIp` 出现陌生地址 → 立刻撤销并轮换**，这是远程场景里唯一有效的泄露信号。
- 轮换用已规划的 `POST /api/agent-credentials/:id/rotate`，旧钥匙当场失效。

### ③ 数据出站：只读也是外流，客户手机号默认脱敏

它在**别人的**机器上，查到的客户姓名、电话、金额都会进它的上下文，可能被服务方留存。

- 客户手机号默认过 `maskPhone` → `138****8000`；要完整号码需单独授 `customers:pii`
- 与项目已有的 `sk-xxxx****1234` 脱敏习惯一致，不新增规则
- 工具说明里写一句："需要完整号码做回拨时，先向文总说明用途再申请该权限"

### ④ 时区：写死 `Asia/Shanghai`，别让它用 UTC 算"本月"

Agent 默认按 UTC 算日期，这个项目已经为此踩过一次坑（`lib/format.js` 的 `parseLocalDate`
就是为绕开 `new Date(str)` 被 UTC 拉偏才写的）。契约里必须明写：

- 所有日期参数与返回一律 `YYYY-MM-DD`（`Asia/Shanghai`）——**不带 `Z`、不带偏移、不用 ISO 时间戳做筛选**
- `/capabilities` 响应带 `serverTime` 与 `timezone: "Asia/Shanghai"`，让它自己校准
- 否则它会算出"本月"少 8 小时的数据，然后郑重汇报"这个月收入下降了" —— 实际是时区错位

### ⑤ 它能"自由操作"，所以它会试图绕过限制

不是恶意，是 Agent 的本能：接口说"不行"，它就找替代路径。

- 机制上已堵住：Agent token 带 `wt_agent_` 前缀，打不进老 `/api/*`（`parseToken` 直接判无效）
- 还要在**工具说明**里写死三条（写清楚比写委婉有效）：
  1. 权限不足 → **停下来告诉文总**，不要尝试替代路径
  2. 改订单金额/状态 → 提交草案 → 让文总去网页确认，**不要反复重试草案接口**
  3. **不要索取 `backend/data` 目录或数据导出包** —— 数据只能经 API 获取
- 最现实的绕过风险其实是**人**：它可能建议"你把数据打包发我"。这条约定要同时告诉文总。

### ⑥ 关机与断线：约定汇报话术，禁止编数据

你这边关机/休眠/tailnet 掉线，它就打不通 —— 这是常态，不是故障。

- 超时 15–30s；GET 最多重试 1 次；写操作**绝不盲重试**（靠 `Idempotency-Key`）
- 连不上 → 明确汇报"工作台离线，本次未取到数据，请确认那台电脑是否开机"
- **禁止**拿上一次的结果冒充"实时查询"，**禁止**根据历史推测当前状态
- 这是这类接入最典型的失败模式，比权限漏洞更常见、也更难被发现

### ⑦ 协议：HTTP + OpenAPI 就够，先不必上 MCP

它能自己写代码，REST 是最灵活的形态：

- 第 2 批交付 **OpenAPI + 工具定义 + 调用说明**，让它用 `curl` 先跑通最小连通
- 若它只支持 MCP 而你又想零配置，再包一层 MCP server —— 复用同一套 HTTP 契约，只换壳
- 判断标准很简单：让它照文档手写一次 `GET /api/agent/v1/orders?pageSize=5`，跑通就不需要 MCP

---

## 12. 还需要确认的两件事

1. **GrokBot 用哪个地址访问到你** —— 文总说它走命令行请求、这块暂不处理。
   需要时按 §13.4 三条路选一条即可（Cloudflare Tunnel 最省事）；代码不受影响，
   只影响把哪段 URL 交给它。
2. **第一期要不要"客户跟进记录"和"报价"**？
   "张三上次跟进说了什么"是高频问法，没有 `follows` 答不好。加的话是两个只读接口，成本很低。

> 原来列的三项待定（GrokBot 形态 / 运行位置 / 网络方案）已由本轮信息确定：
> **远程 Agent、自有电脑、能写代码 → 跨公网接入**，对应本文 §11。
> 但按 §13 的决定，第一期**先不做网络加固**，直接开接口 + 凭证鉴权。

---

## 13. 简版路线（2026-10-22 11:40 决定：先简单，后期再加固）

文总的判断：Tailscale / 网关那套成本偏高，第一期只要「**接口鉴权 + GrokBot 直接请求**」。

**这个取舍是对的。** 第一期只读、单用户、数据量小，风险确实可接受。
§11 那七条是"有写权限之后才真正要紧"的东西，不是上线前置条件。
本节把范围砍到最小，**冲突时以本节为准**；§10 的五批结构保留作为后期加固路线。

### 13.1 第一期只做四件事

1. 凭证（签发 / 校验 / 撤销）
2. scope 检查（后端强制）
3. 只读接口 5 个 + `/capabilities`
4. **一条命令行签发凭证**（不做管理页面，省一整个前端）

### 13.2 明确砍掉，后期再加

| 砍掉 | 理由 | 什么时候加 |
|---|---|---|
| Tailscale / ACL / 反代 | 一期不值得 | 有写权限之后，或凭证被扫过一次 |
| `list-query` 通用引擎 | 过度设计 | 改成"把现有过滤函数挪进 utils 并 export"，约 30 行 |
| 限流 | 单人使用 | 真出现刷接口时 |
| 审计落文件 | `server.js:90-94` 已有请求日志 | 有写操作时（要能追责） |
| 幂等 / 草案 / 409 | 一期没有写操作 | 第三、四批 |
| OpenAPI yaml | 一份 markdown 表格够 GrokBot 读 | 接口超过 10 个时 |
| `boundTo` / `lastUsedIp` | 先不记录 | 凭证泄露过一次之后 |

### 13.3 不能省的（成本≈0，省了会出事）

- **只存摘要**：`sha256(secret)` 落盘，明文只出现一次（一行代码）
- **scope 检查在后端**：一个中间件，不靠 prompt 里写"请不要删数据"
- **trial 禁建凭证**：一个 `if (auth.isTrialLogin(...)) return 403`
- **一期只读**：不给任何写 scope —— 这是最省事也最有效的降险手段
- **手机号脱敏**：复用已有 `maskPhone`，一行

### 13.4 网络：三条最省事的路

1. **Cloudflare Tunnel（最推荐）** —— 本机跑一条命令：
   ```bash
   cloudflared tunnel --url http://127.0.0.1:3456
   ```
   直接给你一个 `https://xxx.trycloudflare.com` 地址。不开端口、不用证书、不用备案、
   不用 DDNS；**GrokBot 那台机器什么都不用装**。要固定域名再绑 CF 账号（免费额度够）。

2. **已有云服务器**：把项目部署上去，天然公网。

3. **同一局域网**：两台机器在同一个 WiFi 下，直接用内网 IP，最简单。

> 注意"GrokBot 直接请求"有个物理前提：**你这台电脑得有个它够得着的地址**。
> 家宽在 NAT 后面，所以要么走隧道（第 1 条），要么有公网服务器（第 2 条）。

### 13.5 公网开出去后，唯一边界就是那把凭证

所以三条硬要求（成本都很低，别省）：

- 有效期 **90 天**，不设永久
- **能撤销**（一个 DELETE）
- **泄露即 rotate**（新 key 生效、旧 key 当场失效）
- 顺带：**不要设 `AUTH_ENABLED=0`、不要开 `AUTH_TRUST_LOCALHOST=1`** —— 这两个一开，
  凭证体系整个失效

### 13.6 第一批改为「最小只读上线」：6 个文件 + 1 条命令

| 文件 | 量级 | 干什么 |
|---|---|---|
| `backend/src/utils/agent-registry.js` | ~90 行 | 凭证表读写、签发、摘要校验、撤销 |
| `backend/src/utils/agent-auth.js` | ~60 行 | `guard()` + `requireScope()` |
| `backend/src/routes/agent.js` | ~150 行 | 6 个只读接口 |
| `backend/src/routes/agent-credentials.js` | ~60 行 | 签发 / 列表 / 撤销 |
| `backend/server.js` | +2 行 | 挂载（在 `apiGuard()` 之前） |
| `tools/agent-issue-key.js` | ~40 行 | 命令行签发，**不用打开网页** |
| `routes` 里挪出的过滤函数 | 各 ~30 行 | `utils/orders-query.js`、`memos-query.js`、`reminders-query.js` |

签发就一条命令：

```bash
node tools/agent-issue-key.js --name "GrokBot" --days 90 \
  --scopes orders:read,customers:read,projects:read,reminders:read,memos:read,reports:read
# 输出一次：wt_agent_ag7f3k2m9q4x.KJ8s...   ← 复制给 GrokBot，服务端只留摘要
```

### 13.7 一句话判断

如果三个月后你只需要它"查数据、报情况"，这套最小实现够用很久；
**写权限和网络加固是"用出需求再加"，不是"上线前先备齐"。**
等到真要给它改订单的能力时，再回头做 §8 的草案确认和 §11 的加固。

---

## 14. 实施规格（代码由文总自己写，这里给到能照抄的粒度）

> 逐文件给「导出什么、参数是什么、坑在哪」，不给完整实现 —— 实现照 `AGENTS.md` 的既有风格
> （本项目后端多数文件是 `var` + `function`，跟随所在目录风格，别用 class / 箭头函数）。

### 14.1 `backend/src/utils/agent-registry.js`

**存放位置（关键）**：`JsonFileStore('agent-registry', { shape: 'array' })`，
读写**必须显式传 `{ username: null }`**：

```js
var ROOT = { username: null };          // 强制根目录，不跟随当前用户
store.read(ROOT) / store.write(list, ROOT)
```

忘了传 → 在请求内（`userContext` 已是 admin）去 `data/users/admin/agent-registry.json` 找，
读到空数组；再写就在用户目录造出第二份表，出现"凭证时而存在时而不存在"。

**导出**

| 函数 | 入参 | 返回 |
|---|---|---|
| `readAll()` | — | `Array`（scope=ROOT） |
| `writeAll(list)` | `Array` | — |
| `issue(opts)` | `{ ownerUser, name, scopes, days, createdBy, boundTo? }` | `{ record, token }`（`token` 明文只此一次） |
| `verify(token)` | `string` | `record \| null`（已含撤销 / 过期判断） |
| `revoke(id)` | `string` | `boolean` |
| `listByOwner(ownerUser)` | `string` | `Array`（**剔除 `secretHash`**） |
| `touch(id, ip)` | `string, string` | —（更新 `lastUsedAt/lastUsedIp`，失败不影响主流程） |

**token 生成与解析**

```js
var id     = 'ag' + crypto.randomBytes(6).toString('hex');   // ag + 12 hex = 14 字符
var secret = crypto.randomBytes(32).toString('base64url');   // 43 字符
var token  = 'wt_agent_' + id + '.' + secret;
var secretHash = crypto.createHash('sha256').update(secret).digest('hex');

var m = /^wt_agent_(ag[0-9a-f]{12})\.([A-Za-z0-9_-]{43})$/.exec(String(token || ''));
if (!m) return null;                       // 格式不对直接 null，别抛错
```

校验用 `crypto.timingSafeEqual(Buffer.from(hashHex), Buffer.from(record.secretHash))`，
**先比长度**（不等直接 false，否则 `timingSafeEqual` 会抛）。记录不存在时也要走一次等长比较，
别用 `if (!record) return null` 提前返回（能按响应时间探出哪个 id 存在 —— 虽然风险很低，一行的事）。

**为什么用 sha256 而不是 `secret-box`**：`secret-box` 是 AES，**可逆**；
凭证只需要"验证对不对"，不需要"还原出来"。用可逆加密存凭证 = 多一个必须守住的东西。

### 14.2 `backend/src/utils/agent-auth.js`

```js
module.exports = {
  extractToken: function (req) {},      // X-Agent-Key 优先；否则 Bearer 且必须以 wt_agent_ 开头
  guard: function () {},                // 返回中间件
  requireScope: function (scope) {}     // 返回中间件
};
```

`guard()` 顺序（**任何一步失败都返回同一个 401，不区分原因**）：

1. `extractToken` → 没有 → 401 `AGENT_UNAUTHORIZED`
2. `agentRegistry.verify(token)` → null → 401
3. `req.agent = { id, ownerUser, scopes, name }`
4. `agentRegistry.touch(...)` —— 放在 `try/catch` 里，**不能因为它失败就让请求失败**
5. `userContext.run(req.agent.ownerUser, next)` ← **这一步绝不能漏**

不做的事：不 `require('./auth')`（避免循环依赖）、不看 `AUTH_ENABLED`（Agent 通道独立）。

`requireScope(scope)`：`req.agent.scopes.indexOf(scope) === -1` → `403 { code:'AGENT_SCOPE_DENIED', required: scope }`。

### 14.3 `backend/src/routes/agent.js`

```js
var router = express.Router();
router.use(agentAuth.guard());        // ← 第一行，后面所有子路由自动受保护
```

- 每个接口单独挂 `agentAuth.requireScope('orders:read')`
- 只做：解析 query → 调 utils → `resp.success(res, { list, total, page, pageSize })`
- **不要**在这里写筛选逻辑（那是 §1② 要抽的那份）
- 404 一律用同一个文案 `'未找到该记录'`，不区分"不存在"和"不是你的"
- 分页夹紧：`page = Math.max(1, parseInt(q.page) || 1)`、`pageSize = Math.min(100, Math.max(1, parseInt(q.pageSize) || 20))`

`/capabilities` 返回（让它开局就知道边界）：

```json
{ "agentId": "ag…", "name": "GrokBot", "scopes": ["orders:read"],
  "serverTime": "2026-10-22T11:42:00+08:00", "timezone": "Asia/Shanghai" }
```

### 14.4 `backend/server.js`（两行，位置不能错）

```js
// Agent 专用通道：自带鉴权，必须挂在通用守卫之前
app.use('/api/agent/v1', require('./src/routes/agent'));

app.use('/api', auth.apiGuard());
app.use('/api/agent-credentials', require('./src/routes/agent-credentials'));  // 登录身份用
```

同时**在 `ARCHITECTURE.md` 第四节补一条例外说明**（`AGENTS.md §5` 要求规则变更要留痕），
否则下次跑 `verify-arch` 或下一个 AI 协作时会以为这里写错了。

### 14.5 `tools/agent-issue-key.js`

- 参数全走 `process.argv`，**不要用环境变量传参** —— 本机 Bash 会剥掉脚本文件里的 `export`，
  表现是静默退回默认值，日志里看不出来（项目踩过）
- 所有开关都要能 `--help` 看到；执行后**打印一次 token 并明确写"只显示这一次"**
- 不写进任何日志文件

### 14.6 三个过滤函数提取（不要做通用引擎）

只做"把 `routes/orders.js:103-212` 那段原地搬走"，导出一个函数，老路由改成调它：

```js
// utils/orders-query.js
module.exports = { filterOrders: function (all, query) {}, sortOrders: … , paginate: … };
```

`memos`（`memos.js:33-60`）、`reminders` 同样。**搬的时候一行逻辑都别改**，
改完立刻跑 `node backend/test/orders-put-guard.test.js` 等现有测试验证行为不变。

### 14.7 验收（自己写代码时先跑这五条）

```bash
# 1) 无凭证必须 401
curl -s -o /dev/null -w "%{http_code}\n" "$BASE/api/agent/v1/orders"

# 2) 有凭证 200 且是分页对象
curl -s "$BASE/api/agent/v1/orders?pageSize=2" -H "X-Agent-Key: $KEY"

# 3) 缺 scope 必须 403（用只给了 orders:read 的 key 去打 customers）
curl -s "$BASE/api/agent/v1/customers" -H "X-Agent-Key: $READONLY_KEY"

# 4) 撤销后立即 401
#    node tools/agent-issue-key.js --revoke agxxxxxxxxxxxx  → 再执行第 2 条
# 5) 登录 token 打不进 Agent 通道（必须 401）
curl -s -o /dev/null -w "%{http_code}\n" "$BASE/api/agent/v1/orders" -H "Authorization: Bearer $LOGIN_TOKEN"
```

第 5 条最容易被忽略：它验证的是"两套身份互不串门"，而 `getTokenFromRequest`
（`auth.js:330-339`）本来就会读 Bearer，所以必须靠前缀判别挡住。

---

## 15. 与 `GROK_BOT_CONNECTION.md` 的衔接（**等接口跑通后再合入**）

根目录那份文件现在教的是"用 `APP_USERNAME`/`APP_PASSWORD` 登录换 token"（第 2、3 节）。
Agent 接进来之后，**这条路径对 Agent 应该被降级**：不要让 GrokBot 拿登录密码，
它只需要一把 scope 受限的 Agent 凭证。

### 15.1 建议在文件里新增的一节（放在现第 3 节之后，编号 3.6）

```markdown
### 3.6 Agent 凭证（GrokBot 请用这个，不要用账号密码）

请求头二选一，都不要混用：
  X-Agent-Key: wt_agent_xxxxxxxxxxxx.xxxx…
  Authorization: Bearer wt_agent_xxxxxxxxxxxx.xxxx…

- 只用 /api/agent/v1/* 下的接口；拿它去调 /api/orders 会 401
- 先调 GET /api/agent/v1/capabilities 看自己被允许做什么
- 401 = 凭证无效/过期/已撤销（不区分原因，别猜）
- 403 = 缺权限，响应里有 required 字段，不要换别的接口试
- 日期一律 YYYY-MM-DD（Asia/Shanghai），不要用 UTC、不要用时间戳筛选
- 连不上就如实说"工作台离线"，禁止拿上次结果冒充实时数据
```

### 15.2 第 10 节"启动指令"要换一版

现在那段让它"先 login 再带 token"。改成一版以 Agent 凭证为主的（同样的语气，短句、可执行）：

```text
请按仓库根目录 GROK_BOT_CONNECTION.md 的 3.6 节对接 wen-workbench。
凭证放在环境变量 WEN_AGENT_KEY 里，不要写进回复、不要写进代码仓库。

1. 先 GET /api/agent/v1/capabilities，确认自己有哪些 scope，以及服务器时间。
2. 只调 /api/agent/v1/*；不要调 /api/auth/login（不需要密码），不要调 /api/grok（不存在）。
3. 权限不足时停下来告诉我，不要尝试别的接口，也不要索取数据导出包。
4. 日期按 Asia/Shanghai 算；连不上就说"工作台离线"，不要用旧数据充数。
5. 现在先做一件事：查一下本月未完成的订单，按订单日期倒序列前 5 条给我。
```

### 15.3 为什么先不发这份文档

文档先于实现会害了它：它会照着文档去调一堆还不存在的接口，然后报"工作台坏了"，
你再花时间排查其实是 404。**顺序是：接口跑通 → 自己 curl 验证 5 条 → 再更新文档 → 才把文档给它。**

---

*依据：`backend/server.js`、`backend/src/utils/auth.js`、`storage.js`、`json-file-store.js`、`data-backups.js`、`user-context.js`、`response.js`、`routes/orders.js|memos.js|projects.js|reminders.js|customers.js|stats.js`、`ARCHITECTURE.md`、`AGENTS.md`。落地时若与代码不符，以代码为准并回来改本文。*
