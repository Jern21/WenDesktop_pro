# Grok Bot 通信说明（wen-workbench）

> 把本文件整份喂给 Grok Bot，它就能按 HTTPS + Bearer Token 连接本系统，发起接口控制，并在重要结果时通过微信通知你。  
> 面向：**第一次对接的新用户**，从 0 到能读写业务数据。

---

## 0. 这份文档回答三件事

| 问题 | 看哪一节 |
|------|----------|
| **怎么接入 Grok Bot** | §11 |
| **怎么让 Grok 主动发起接口调用、控制本系统** | §12（协议细节见 §1–§7） |
| **怎么用微信通知用户** | §13 |

---

## 1. 一句话怎么连

1. 拿到公网地址 `$BASE_URL`（形如 `https://your-domain.com`，不要末尾斜杠）
2. `POST /api/auth/login` 换取 `data.token`
3. 之后所有业务请求带：`Authorization: Bearer <token>`
4. 先打 `GET /api/health` 确认服务活着，再登录、再读写

Grok Bot / 脚本**只用 JSON 里的 token + Bearer**，不要依赖浏览器 Cookie。

---

## 2. 你需要准备什么

| 项 | 说明 |
|----|------|
| `$BASE_URL` | 已部署、公网可达的 HTTPS 地址 |
| `$WEN_USER` / `$WEN_PASS` | 正式账号（环境变量 `APP_USERNAME` / `APP_PASSWORD`，或首次启动写入的 `backend/data/auth.json`） |
| `$WEN_TOKEN` | 登录成功后 `data.token` 的值 |

后端默认端口 `3456`；公网只应暴露反向代理后的 `443`。

认证默认开启。`AUTH_ENABLED=0` 仅本机临时调试，**公网禁止关闭**。

---

## 3. 登录与鉴权（必读）

### 3.1 登录拿 token

```http
POST $BASE_URL/api/auth/login
Content-Type: application/json

{"username":"$WEN_USER","password":"$WEN_PASS","remember":true}
```

成功示例：

```json
{
  "success": true,
  "data": {
    "token": "<HMAC 签名的无状态 token>",
    "username": "admin",
    "expiresIn": 2592000000,
    "trial": false
  }
}
```

要点：

- `username` 必填；正式账号还要 `password`
- `remember: true` → TTL 约 30 天；不传则约 12 小时
- 兼容：只传 `password`、不传 `username` 时，服务端按管理员用户名处理
- 登录失败约 5 次后，该 IP 锁定约 5 分钟（`429` / `code: LOCKED`）
- 响应可能同时 `Set-Cookie: wt_auth=...`；**对接时忽略 Cookie，只用 `data.token`**

### 3.2 业务请求怎么带 token

```http
Authorization: Bearer $WEN_TOKEN
```

服务端从 Cookie `wt_auth` **或** `Authorization: Bearer ...` 取 token（见 `backend/src/utils/auth.js`）。改密码后旧 token 全部失效。

### 3.3 认证相关接口

| 方法 | 路径 | 要登录？ | 说明 |
|------|------|----------|------|
| GET | `/api/auth/status` | 否 | 是否启用认证、是否已登录、试用是否可用 |
| POST | `/api/auth/login` | 否 | 登录，返回 `token` |
| POST | `/api/auth/logout` | 建议 | 清 Cookie |
| POST | `/api/auth/password` | 是 | body：`oldPassword`、`newPassword`（至少 6 位） |

**没有** `/api/auth/me`，不要调用。  
**没有** `/api/grok`（尚未实现），不要调用。

### 3.4 试用账号（可选，仅测试）

默认用户名 `trial`（可用环境变量 `TRIAL_USERNAME` 改）。免密码：

```http
POST $BASE_URL/api/auth/login
Content-Type: application/json

{"username":"trial"}
```

试用会话约 **8 小时**。生产建议设 `TRIAL_LOGIN=0` 关闭。正式使用请用正式账号。

### 3.5 哪些接口要登录

- `/api/auth/*`：挂在守卫之前，登录本身不需要 token
- `GET /api/health`：**公开**，不需要 token
- 其余 `/api/*`：**必须**带有效 token，否则 `401` + `{ "success": false, "error": "...", "code": "UNAUTHORIZED" }`

---

## 4. 最小连通检查（按顺序）

任一步失败就先查域名 / 证书 / 账号，再谈业务。

```bash
# 1) 健康检查（不需要 token）
curl -sS "$BASE_URL/api/health"

# 2) 登录拿 token
curl -sS -X POST "$BASE_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"$WEN_USER\",\"password\":\"$WEN_PASS\",\"remember\":true}"

# 把返回的 data.token 赋给 WEN_TOKEN

# 3) 带 token 读一笔业务
curl -sS "$BASE_URL/api/orders" \
  -H "Authorization: Bearer $WEN_TOKEN"

# 4) 无 token 应返回 401
curl -sS -o /dev/null -w "%{http_code}\n" "$BASE_URL/api/orders"
```

验收：`health.success === true` → 登录 `success === true` 且有 `data.token` → 带 token 业务 `success === true` → 无 token 为 `401`。

---

## 5. 请求约定

- **Base**：`$BASE_URL/api/...`
- **Header**：写操作加 `Content-Type: application/json`；业务请求加 `Authorization: Bearer $WEN_TOKEN`
- **成功**：多为 `{ "success": true, "data": ... }`；创建类常见 HTTP `201`
- **失败**：`{ "success": false, "error": "..." }`，可能带 `code`（如 `UNAUTHORIZED`、`LOCKED`、`BAD_CREDENTIALS`）
- **超时**：客户端建议 15–30s；上传可更长
- **CORS**：开发默认较松；生产可用 `CORS_ORIGINS`。纯服务端调用一般不受影响

---

## 6. 现有 API 能力地图

以下路由挂在 `backend/server.js`；除已注明外都要 Bearer。

| 前缀 | 用途 |
|------|------|
| `/api/auth` | 登录相关 |
| `/api/health` | 健康检查（公开） |
| `/api/orders` | 订单（含 `/stats/summary`、CRUD、`/batch`） |
| `/api/customers` | 客户（含 `/:id/detail`、跟进 `/:id/follows`） |
| `/api/quotes` | 报价 |
| `/api/posters` | 海报/素材标签与列表 |
| `/api/projects` | 项目（含 `/stats`、`/board`） |
| `/api/platform-posts` | 平台发布（含 `/stats/overview`） |
| `/api/memos` | 备忘录 CRUD、置顶 |
| `/api/reminders` | 提醒 CRUD、日历、`/:id/toggle` |
| `/api/resume` | 简历相关 |
| `/api/upload` | 上传 |
| `/api/settings` | 设置、账号列表等 |
| `/api/stats` | 首页指标、看板、营收等只读统计 |
| `/api/ledger` | 台账（含 `/workbench`） |
| `/api/image-gen` | 生图配置等 |
| `/api/accounts` | 账号/平台 |
| `/api/bookmarks` | 书签收藏 |
| `/api/bug-reports` | 缺陷反馈 |

探测清单可参考仓库 `tools/probe-api-surface.mjs`；以当前代码为准。  
**不要调用**：`/api/auth/me`（不存在）、`/api/grok/*`（未实现）。

---

## 7. 三个可复制的 curl 剧本

先替换 `$BASE_URL`、`$WEN_USER`、`$WEN_PASS`。

### A. 登录并导出 token

```bash
export BASE_URL="https://your-domain.com"
export WEN_USER="admin"
export WEN_PASS="your-password"

export WEN_TOKEN="$(curl -sS -X POST "$BASE_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"$WEN_USER\",\"password\":\"$WEN_PASS\",\"remember\":true}" \
  | python -c "import sys,json; print(json.load(sys.stdin)['data']['token'])")"

echo "token length: ${#WEN_TOKEN}"
```

### B. 读取订单列表

```bash
curl -sS "$BASE_URL/api/orders" \
  -H "Authorization: Bearer $WEN_TOKEN"
```

### C. 新建一条备忘录（写操作）

```bash
curl -sS -X POST "$BASE_URL/api/memos" \
  -H "Authorization: Bearer $WEN_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"title\":\"Grok Bot 连通测试\",\"content\":\"来自远程 API 的第一条备忘\",\"category\":\"测试\",\"tags\":[\"grok-bot\"]}"
```

备忘录必填：`title`、`content`。  
新建提醒：`POST /api/reminders`，必填 `title`、`date`；可选 `time`、`priority` 等。

---

## 8. 安全（开源也适用）

- 本文件可以开源：只写协议与路径，**不要**写入真实密码、token、私钥
- 仓库里用占位符 `$BASE_URL` / `$WEN_TOKEN`；真实密钥只放部署环境或私密配置
- 公网保持 `AUTH_ENABLED` 开启；不要设 `AUTH_TRUST_LOCALHOST=1`（那是本机调试）
- 生产建议 `TRIAL_LOGIN=0`
- Token 能读写对应用户数据；泄露后应改密码使旧 token 失效
- 微信通知里**不要**发送密码、完整 token、私钥

---

## 9. 部署 checklist

- [ ] 本机 `GET /api/health` 成功
- [ ] 反向代理（Nginx / Caddy / Cloudflare Tunnel 等）把 `443` 转到后端 `3456`
- [ ] 有效 TLS；`$BASE_URL` 以 `https://` 开头
- [ ] 已设 `APP_USERNAME` / `APP_PASSWORD`（或确认 `auth.json`）
- [ ] `AUTH_ENABLED` 未关闭；未开启本机免登录
- [ ] （生产）`TRIAL_LOGIN=0`
- [ ] 跑通第 4 节：健康 → 登录 → 有 token 读 → 无 token 401
- [ ] 防火墙只开 80/443；数据目录已备份
- [ ] 按 §11 把本文件喂给 Grok Bot，完成接入
- [ ] 按 §12 试一条只读 + 一条经确认的写操作
- [ ] 按 §13 确认重要结果能落到微信（若你启用了微信通道）

---

## 10. 复制给 Grok Bot 的启动指令

把下面整段（并填好 `$BASE_URL`）发给 Grok Bot：

```text
请按仓库根目录 GROK_BOT_CONNECTION.md 对接 wen-workbench（尤其 §11 接入、§12 控制、§13 微信通知）。

约定：
1. 地址：$BASE_URL（HTTPS）。先 GET /api/health，再 POST /api/auth/login 取 Bearer token；之后业务请求都带 Authorization: Bearer $WEN_TOKEN。
2. 只使用文档列出的现有 /api/*。不要调用 /api/grok（未实现），不要调用 /api/auth/me（不存在）。
3. 成功看 JSON 的 success；401 表示未登录或 token 失效，重新 login。
4. 写操作前先向我确认目标与字段；我说「直接做 / 不用确认」时可跳过确认。不要猜测密码。需要 $BASE_URL 和账号时向我索取，不要把 token 写进公开回复或微信。
5. 比较重要的结果（连通成功/失败、写操作成败、需要我立刻处理的事）按 §13 走微信通知；不要把密码或完整 token 发到微信。

现在：确认 $BASE_URL 可达，完成最小连通检查，用一句话向我汇报结果，然后等我下一条业务指令。
```

---

## 11. 怎么接入 Grok Bot（从 0 到能控）

wen-workbench **不负责**安装 Grok Bot。接入发生在「你的 Grok Bot 助手」这一侧：把本文件当作说明书喂进去，再给它地址和一次性凭证。

### 11.1 你需要有什么

1. 已能用的 **Grok Bot**（Cursor / Grok Bot 应用里的一个助手对话即可）
2. 本仓库已按 §9 **公网 HTTPS 部署**好，你知道真实的 `$BASE_URL`
3. 一份本文件（仓库根目录 `GROK_BOT_CONNECTION.md`）
4. 正式账号 `$WEN_USER` / `$WEN_PASS`（或你已签发、仍有效的 `$WEN_TOKEN`）

### 11.2 接入步骤（给用户）

1. 打开要用来遥控 workbench 的那个 Grok Bot 对话  
2. 把**本文件全文**贴进对话（或告诉它仓库路径让它自己读）  
3. 再发一句，填上真实地址，例如：  
   `按 GROK_BOT_CONNECTION.md 对接。BASE_URL=https://你的域名`  
4. 当它向你要账号时，**私聊发给它**用户名和密码（或只发已有 token）；不要把密码写进会公开的地方  
5. 让它执行 §4 最小连通检查，并向你回报：health 是否成功、是否拿到 token、只读接口是否通  
6. 连通成功后，用自然语言下指令即可（见 §12），例如：「查一下最近订单」「新建一条备忘：……」

### 11.3 接入验收

- [ ] Grok 已读过本文件（或对话里有全文）  
- [ ] `$BASE_URL` 已确认且为 `https://`  
- [ ] 已完成 §4 四步，Grok 用一句话向你确认  
- [ ] 试过一条只读（如 `GET /api/orders` 或 `/api/stats`）  
- [ ] （可选）启用 §13 微信通道后，收到一条「连通成功」类通知  

### 11.4 常见卡住点

| 现象 | 先查 |
|------|------|
| health 都失败 | 域名、证书、反代是否转到 `3456` |
| 登录 401 / BAD_CREDENTIALS | 账号密码、是否误用试用规则 |
| 登录 429 LOCKED | 失败次数过多，等约 5 分钟 |
| 业务 401 UNAUTHORIZED | token 过期或改过密码 → 重新 login |
| Grok 去调 `/api/grok` 或 `/api/auth/me` | 本文件禁止；纠正它只用 §6 列表 |

---

## 12. 怎么让 Grok 发起接口调用、控制本系统

Grok **不内嵌**在 wen-workbench 进程里。控制方式是：你（或定时任务）在 Grok 对话里下指令 → Grok 按本文件用 HTTPS 调 `$BASE_URL/api/*` → 把结果告诉你（重要时再走 §13 微信）。

### 12.1 谁触发调用

| 触发方式 | 说明 |
|----------|------|
| **对话指令（主路径）** | 你在 Grok 里说「查订单 / 建备忘 / 改提醒……」，它再发 HTTP |
| **定时 / 例行** | 若你在 Grok 侧建了例行任务（如每天汇总），到点由 Grok 主动调只读或约定好的接口 |
| **不要** | 不要指望 workbench 反连 Grok；当前**没有** `/api/grok` 回调。控制方向是 **Grok → workbench** |

### 12.2 单次控制标准流程（给 Grok 执行）

1. 若还没有有效 `$WEN_TOKEN`：`GET /api/health` → `POST /api/auth/login` → 保存 `data.token`  
2. 根据用户意图，在 §6 地图里选**已有**路径与方法；字段不够就问用户，不猜  
3. **读操作**（GET）：可以直接执行，然后用白话汇报  
4. **写操作**（POST / PUT / PATCH / DELETE）：先向用户确认目标与关键字段；用户明确说「直接做 / 不用确认 / 按这个执行」后再发请求  
5. 看响应 `success`；失败时把 `error` / `code` / HTTP 状态说清楚；`401` 则重新 login 再重试一次  
6. 需要用户立刻知道的结果 → 走 §13  

### 12.3 控制边界（必须遵守）

- 只调 §6 列出的前缀；**禁止**编造路由（含 `/api/grok`、`/api/auth/me`）  
- 不在聊天或微信里回显完整 token / 密码  
- 不批量删除、不改密码、不关认证，除非用户在本轮明确要求  
- 遇到 `LOCKED`：停止重试登录，告知用户等待  
- 一次用户指令 = 一次明确业务意图；不要擅自扩大成「顺便清数据」  

### 12.4 给用户的口令示例

- 「按文档做连通检查」  
- 「读一下订单列表，总结条数和最近几条」  
- 「新建备忘：标题……内容……」  
- 「把提醒 XXX 标成完成」  
- 「直接做，不用再确认：……」  

### 12.5 控制验收

- [ ] 对话一条只读指令 → Grok 实际打出带 Bearer 的 GET 并回报数据  
- [ ] 对话一条写指令 → Grok 先确认（或你已声明免确认）再 POST，并回报 `success`  
- [ ] 故意用不存在的路径时，Grok 拒绝而不是瞎调  

---

## 13. 怎么用微信通知用户

**微信通知不是 wen-workbench 的 HTTP API**（§6 里没有微信接口）。它发生在 Grok Bot 生态里：Grok 调完 workbench 之后，把「值得你立刻看」的结果发到微信。

### 13.1 推荐架构（多助手时）

若你同时有多个 Grok Bot 助手：

1. 指定一个**专属微信通知助手**（只负责把文字发到你的微信）  
2. 其他助手（含对接 workbench 的这只）在需要通知时：把**通知正文**交给该专属助手发出  
3. **不要**每个助手各自直接抢微信通道，避免重复、漏发、互相顶号  

若你只有一个助手，且该助手已接通微信：由它自己发即可，仍遵守下面的「何时发 / 发什么」。

### 13.2 何时发微信（建议）

| 应该通知 | 可以不发 |
|----------|----------|
| 首次连通成功 / 失败 | 普通只读查询的细枝末节 |
| 写操作成功或失败（建备忘、改提醒、改数据等） | 你正盯着同一对话、已即时看到结果 |
| 需要你马上处理的事（登录锁定、服务 health 挂了、token 连续失效） | 调试过程中的每一步 curl 日志 |
| 你明确说「微信告诉我」的结果 | 含密码、完整 token 的任何内容 |

### 13.3 通知正文怎么写

- 短、可扫读：结论先行（成功/失败 + 一句话原因）  
- 可带：时间、`$BASE_URL` 主机名、操作对象（如备忘标题），**不要**带密码或完整 token  
- 示例：  
  - `【workbench】连通成功：health ok，已登录，只读订单接口正常。`  
  - `【workbench】新建备忘失败：401，已尝试重新登录仍失败，请检查账号或服务。`  

### 13.4 用户侧接入微信通道（概念步骤）

1. 在 Grok Bot 里准备好微信能力（专属微信助手，或本助手已连微信插件 / 通道）  
2. 确保你已经和该微信助手私聊过，通道可用  
3. 在对接 workbench 的助手里约定：「重要结果按 `GROK_BOT_CONNECTION.md` §13 通知」  
4. 做一次演练：让 Grok 完成 §4 后，微信应收到一条连通结果  

> 具体菜单名、插件安装以你当前 Grok Bot 产品界面为准；本仓库不绑定某一版 UI 路径。

### 13.5 微信验收

- [ ] 明确了「谁发微信」（专属助手或本助手）  
- [ ] 演练过：连通或一次写操作后，手机微信能收到短讯  
- [ ] 抽查：通知里无密码、无完整 token  

---

*依据：`backend/server.js`、`backend/src/utils/auth.js`、`backend/src/routes/auth.js`、`tools/probe-api-surface.mjs`。路由变更时请同步更新本文件。*
