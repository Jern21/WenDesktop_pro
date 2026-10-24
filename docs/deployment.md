# 桌面端 + 移动端部署指南（宝塔 / 内网穿透）

适用项目：文的项目工作台。文档依据 2026-10-24 的仓库代码编写；执行前应复核当前源码和服务器环境。

目标：一台 Linux 服务器运行一个后端，桌面端和移动端分别通过 HTTPS 地址访问，共享账号和业务数据。本文提供实施方案和配置模板，不代表服务器已经部署完成。

## 1. 项目如何运行

| 部分 | 位置 | 是否构建 | 生产运行方式 |
|---|---|---|---|
| 桌面端 | `frontend/`，入口 `app.html` | 无需构建 | 后端 Express 托管整个目录 |
| 后端 | `backend/server.js` | 无需构建 | Node.js 常驻进程，默认 3456 端口 |
| 移动端 | `mobile-pwa/` | `npm run build` | Nginx 托管生成的 `dist/` |
| 数据 | 默认 `backend/data/` | 不构建 | JSON、附件和认证文件持久化保存 |

两端调用相同的 `/api/auth/*` 和业务接口。同一账号读取同一份数据；不同账号的数据按后端规则隔离。两个域名各自保存 Cookie 和浏览器存储，需要分别登录。数据更新在另一端重新加载后可见，不承诺实时推送。

生产只运行一个后端实例；JSON 文件存储不按多进程共享写入设计，不启用 PM2 cluster、多副本或多台后端同时写同一目录。移动端不需要常驻 Vite；`npm run dev` 和 `npm run preview` 不作为生产服务器。

## 2. 部署方案

### 方案 A：宝塔 + 内网穿透（用户当前计划）

```text
桌面 HTTPS 地址 → 穿透客户端 → 127.0.0.1:8081 → Nginx → 127.0.0.1:3456
手机 HTTPS 地址 → 穿透客户端 → 127.0.0.1:8082 → Nginx → 移动 dist/
                                                        └→ API/附件 → 同一 :3456
后端 → 独立持久化目录 /www/workbench-data
```

两个入口可以是同一主域下的子域名，也可以是穿透服务提供的两个独立域名。使用独立本地端口，避免穿透服务改写 Host 后匹配到错误站点。

- 穿透客户端与 Nginx 在同一机器时，站点只监听 `127.0.0.1:8081/8082`。
- 客户端在容器或其他机器时，回环地址不通；应确认网络拓扑，改为能到达的私网地址，并限制来源。
- 穿透服务负责外网 HTTPS，内层可走 HTTP。提供商需支持两个 HTTP 网站入口、Cookie、上传和足够的请求超时。
- 固定外网地址便于保存书签和安装 PWA；更换域名后通常需要重新登录、重新安装 PWA。
- 不把 3456、宝塔面板或数据目录直接映射到公共入口。
- 运行项目和穿透客户端的机器需要持续开机，且两者都需要开机启动。

### 方案 B：宝塔 + 公网域名直连

```text
work.example.com ─ HTTPS → Nginx → 后端 :3456（同时提供桌面页面）
m.example.com    ─ HTTPS → Nginx → 移动 dist/，API/附件代理到同一后端
```

域名解析到服务器公网 IP，宝塔为两个站点配置证书和 HTTP 跳转 HTTPS。公开网站端口 80/443，3456 仅供内部代理使用。具体域名备案、网络和证书条件按实际服务商核实。

两种方案共用下面的构建、数据和后端配置。当前不采用 `/m/` 子路径：移动端默认资源基址、路由、PWA scope/start_url 都按站点根路径设计，改为子路径需要另行实现和验证。

## 3. AI 开始执行前需要的参数

从已有会话、服务器配置和用户提供的信息读取；只询问真正缺失的项目。不要猜测域名、服务器凭据或现有数据归属。

| 参数 | 示例 / 决策 |
|---|---|
| 服务器访问方式 | 已授权的 SSH 或宝塔会话；密钥不写进仓库和报告 |
| 系统与环境 | Linux 发行版、宝塔版本、Nginx 路径、现有站点及占用端口 |
| 代码来源 | 本地上传包或用户指定仓库及提交；包含必要的未提交功能文件 |
| 代码目录 | 示例 `/www/wwwroot/workbench` |
| 数据目录 | 示例 `/www/workbench-data`，必须在静态站点根目录之外 |
| 运行身份 | 示例 `www`，需有代码读取和数据目录写入权限 |
| Node.js | 使用执行时仍受支持的 LTS，先核对锁文件和构建兼容性 |
| 公网入口 | 桌面地址、手机地址；未确定时先只完成本机可验收部分 |
| 接入方式 | A 内网穿透，或 B 域名直连 |
| 穿透参数 | 服务商、配置位置、两个隧道和 HTTPS 终止位置 |
| 数据来源 | 全新空数据，或完整迁移指定的旧数据目录 |
| 加密来源 | 旧 `.secret` 文件或原 `APP_SECRET`；不要输出其值 |
| 登录策略 | 保留原账号密码；私人部署默认关闭免密 trial |
| 备份与切换 | 备份路径、可接受的短暂停机窗口、回滚版本 |

本文中的路径、域名、用户名、Node 可执行文件均为示例，AI 必须用实际值生成最终配置。未获得服务器访问方式时可以准备配置，不能声称已上线。

## 4. 上传代码、迁移数据和构建

### 4.1 保留项目结构

```text
/www/wwwroot/workbench/
  backend/                 # server.js、src/、package.json、package-lock.json
  frontend/                # 完整桌面静态资源
  mobile-pwa/              # 构建所需源码和锁文件，构建后有 dist/
  tools/                   # 部署检查
  CHANGELOG.json           # 桌面版本记录
  GROK_BOT_CONNECTION.md    # 当前 Grok 接入文档接口读取此文件
  ARCHITECTURE.md
  AGENTS.md
/www/workbench-data/       # 独立业务数据，不由 Nginx 托管
/www/backup/workbench/    # 示例备份位置，同样不可公开访问
```

建议上传经过检查的完整项目源码，排除 `.git/`、`node_modules/`、日志及不需要的个人文件。依赖在 Linux 上按锁文件重新安装，不上传 Windows 的 `node_modules`。业务数据独立迁移，不混在可公开下载的发布包里。

执行前读 `AGENTS.md` 和架构规则，检查并行改动。不要使用 `git reset --hard`、`git clean` 覆盖现有工作。存在未提交功能时，确认发布来源包含这些文件，不能仅凭远端分支部署后宣称功能齐全。

### 4.2 数据必须在首次启动之前就位

1. 停止旧实例的写入，在一致性窗口内备份完整数据目录，包含隐藏文件、`auth.json`、`.secret`、`users/`、附件及已有备份。
2. 迁移到 `/www/workbench-data`；使用带隐藏文件的复制方式，例如从已备份的源目录执行 `cp -a /实际源目录/. /www/workbench-data/`。先验证目标路径和容量，不覆盖未核实的已有数据。
3. 若旧环境用 `APP_SECRET`，新环境必须保留原值；若用 `.secret`，保留原文件且不要突然改用一个新 `APP_SECRET`。两种来源优先级不同，随意切换会使已有密文不可解读。
4. 数据目录仅授予后端运行用户所需的读写权限，不使用 `chmod -R 777`。迁移后的用户名称和目录归属应保持一致。
5. 全新部署创建空的数据目录，让后端初始化认证与密钥；部署 AI 不得为试运行而直接启动当前开发机器上的真实数据副本。

`backend/data/` 被 Git 忽略，拉取代码不会迁移数据。不要默认开启 `USER_SCOPE_MIGRATE`、`ASSIGN_DATA_TO_TRIAL`，这些开关会改变业务数据归属。确需历史数据迁移时另按对应脚本的实际行为评估。

### 4.3 安装与构建（Linux Bash）

确认 Node/npm 来自选定的同一安装环境；宝塔安装的 Node 未必在 SSH 的 PATH 中。构建目录需要对执行用户可写。

```bash
cd /www/wwwroot/workbench/backend
npm ci --omit=dev

cd /www/wwwroot/workbench/mobile-pwa
npm ci --include=dev
VITE_API_BASE_URL= npm run build

cd /www/wwwroot/workbench
node tools/check-all.js
```

移动端构建依赖在 devDependencies 中，不能在移动端执行 `npm ci --omit=dev`。命令中显式设置空 `VITE_API_BASE_URL`，使构建产物使用当前手机站点的相对地址，避免 `.env` 中残留的局域网 IP 被打包进去。

检查 `dist/index.html`、`dist/assets/`、生成的 manifest 和 service worker。`VITE_API_PROXY_TARGET` 仅用于 Vite 开发/预览代理，生产代理必须由 Nginx 配置。未来更换入口域名一般不需要重新构建，但仍需检查业务数据中是否存有旧域名的绝对资源地址。

## 5. 后端环境与常驻进程

建议配置：

```ini
NODE_ENV=production
PORT=3456
APP_DATA_DIR=/www/workbench-data
AUTH_ENABLED=1
AUTH_TRUST_LOCALHOST=0
TRIAL_LOGIN=0
```

- 当前后端直接读取 `process.env`，不会自动加载 `.env`。通过宝塔进程环境或 systemd EnvironmentFile 注入。
- 两个站点都通过自己的 `/api` 转发，无需将手机 API 指向另一个域名。通常无需额外配置 CORS；若已有 `CORS_ORIGINS` 白名单，必须纳入实际两个外网 Origin（协议 + 主机 + 必要端口）。
- `AUTH_TRUST_LOCALHOST` 必须关闭，否则反代请求来自回环地址时可能被当成本机免登录。
- `APP_USERNAME` / `APP_PASSWORD` 只在有明确需要时使用。保留原 `auth.json` 可保留原账号。长期固定 `APP_PASSWORD` 会在重启时重新应用该密码，覆盖用户在应用内修改后的密码。
- 全新部署可使用首次启动生成的账号密码，通过受控日志交付用户；不要写入本文件或公开报告。
- 后端当前 `app.listen(PORT)` 未限制监听地址，依靠主机防火墙/云安全组阻止外网访问 3456；不能仅因 Nginx 使用 127.0.0.1 就认定后端只监听本机。

### 5.1 宝塔管理方式

在宝塔当前可用的 Node 项目/进程管理功能里创建单实例：项目目录为 `/www/wwwroot/workbench/backend`，启动入口 `server.js` 或 `npm start`，选择已安装的 LTS Node，运行用户使用前述服务用户，注入以上环境变量。启用异常重启、开机启动并记录日志位置。宝塔不同版本菜单不同，以实际界面为准。

### 5.2 没有合适的宝塔进程管理器时，使用 systemd

以下作为替代方案，不与宝塔同时启动同一后端。先核实系统支持 systemd、`www` 用户存在，并确认 `command -v node` 的结果。将环境变量写入 `/etc/workbench.env`，权限设为 root 可读写；若使用旧 `APP_SECRET`，安全写入其中，不在命令输出中展示。

在 `/etc/systemd/system/workbench.service` 创建（替换 ExecStart 为实际 Node 绝对路径）：

```ini
[Unit]
Description=Wen Workbench
After=network.target

[Service]
Type=simple
User=www
Group=www
WorkingDirectory=/www/wwwroot/workbench/backend
EnvironmentFile=/etc/workbench.env
ExecStart=/实际/node/绝对路径 server.js
Restart=on-failure
RestartSec=5
UMask=0077

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now workbench
sudo systemctl status workbench --no-pager
curl -fsS http://127.0.0.1:3456/api/auth/status
```

`/api/auth/status` 应返回 JSON，认证已开启且未登录时 `authenticated` 为 false，`trialLoginAvailable` 为 false。`/api/health` 在认证守卫之后，未登录返回 401 是预期行为，不能拿它当匿名 200 探针。

## 6. Nginx 配置模板

下面给出方案 A 的本机 HTTP 入口。先备份相关站点配置，并用 `nginx -T` 或宝塔配置视图检查现有 server/location；不要覆盖其他站点或整份 nginx.conf。所有 `nginx` 命令要使用宝塔实际安装的二进制和配置路径。

### 6.1 后端代理公共片段

创建 `/www/server/nginx/conf/workbench-proxy.inc`（不是完整站点，不放进自动加载全部 `.conf` 的站点目录）：

```nginx
proxy_pass http://127.0.0.1:3456;
proxy_http_version 1.1;
proxy_set_header Host $host;
proxy_set_header X-Real-IP $remote_addr;
proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
# 此片段仅供外网已由可信穿透服务终止 HTTPS 的专用入口使用。
proxy_set_header X-Forwarded-Proto https;
proxy_read_timeout 180s;
proxy_send_timeout 180s;
proxy_cache off;
proxy_buffering off;
```

`proxy_pass` 不附带 URI 和尾部 `/`，保留原始 `/api/...`、`/uploads/...` 路径。不隐藏 Set-Cookie，也不缓存用户接口。长请求的实际超时还受穿透服务和客户端限制。

本模板将 HTTPS 来源固定为 https，只适用于约定的外部 HTTPS 入口，本机纯 HTTP 测试时不验收 Cookie 登录。若改用 Nginx 自己终止 HTTPS 的方案 B，则将该行改为 `proxy_set_header X-Forwarded-Proto $scheme;`。不要盲目信任公网客户端可自行填写的转发头。

### 6.2 桌面站点

```nginx
server {
    listen 127.0.0.1:8081;
    server_name desktop.example.com;
    client_max_body_size 55m;

    location / {
        include /www/server/nginx/conf/workbench-proxy.inc;
    }
}
```

桌面站点所有请求交给 Express，保留其页面认证守卫与 SPA 回退。不要把整个项目目录设成静态网站根目录。

### 6.3 移动站点

```nginx
server {
    listen 127.0.0.1:8082;
    server_name mobile.example.com;
    root /www/wwwroot/workbench/mobile-pwa/dist;
    index index.html;
    client_max_body_size 55m;
    add_header Cache-Control "no-cache" always;

    location ^~ /api/ {
        include /www/server/nginx/conf/workbench-proxy.inc;
    }
    location ^~ /uploads/ {
        include /www/server/nginx/conf/workbench-proxy.inc;
    }
    location ^~ /assets/ {
        try_files $uri @backend_asset;
    }
    location @backend_asset {
        include /www/server/nginx/conf/workbench-proxy.inc;
    }
    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

关键点：

- `/assets/` 既包含 Vite 构建的 JS/CSS，也可能有桌面共享资源。先查移动端 dist，缺失才走后端。不能把整个 `/assets/` 都代理给后端，否则移动端打包脚本会加载失败。
- `/uploads/` 必须走后端归属校验，不能给真实数据目录配置 alias。附件图片依靠手机域名上的登录 Cookie，不能只验收 Bearer API 成功就判断附件正常。
- `55m` 是给 multipart 头留余量；后端单文件限制目前为 50 MiB，Nginx 放大限制不会提高后端上限，穿透服务也可能另有限制。
- 默认 no-cache 使浏览器重新验证文件，避免 index、manifest、sw 长期不更新。若优化哈希资源缓存，必须单独保留 index/manifest/sw 的更新策略并验证 PWA 升级。
- 宝塔生成的静态后缀正则、代理缓存、PHP 重写等可能抢先处理请求。合并配置时删除或调整本项目站点内的冲突规则，不影响其他站点；不能简单追加两个 `location /`。

```bash
sudo /www/server/nginx/sbin/nginx -t
sudo /www/server/nginx/sbin/nginx -s reload
curl -fsS http://127.0.0.1:8081/api/auth/status
curl -fsS http://127.0.0.1:8082/api/auth/status
curl -I http://127.0.0.1:8082/orders/123
```

按实际二进制路径修改命令；语法检查成功后才重载。前两项应返回同一后端的认证状态 JSON，第三项应返回移动 HTML，不能返回桌面页面或 Nginx 404。

### 6.4 方案 B 的配置差异

保留上述代理与移动端路由配置，通过宝塔分别配置两个真实域名的 HTTPS 站点，使用实际证书路径与宝塔生成的 TLS 配置。将回环 8081/8082 监听改为对应站点的 443 TLS 监听，HTTP 80 入口跳转 HTTPS；公共片段中的协议头改用 `$scheme`。配置 DNS 和必要的防火墙规则。

本文不提供虚构证书路径。不要把为方案 A 写死 https 的片段直接用于可公开 HTTP 登录的站点。

## 7. 接入内网穿透

1. 按选定服务的官方文档安装客户端，记录实际版本和配置路径。不要假定服务商参数通用。
2. 建立桌面 HTTP 网站隧道：外网桌面 HTTPS 地址 → `127.0.0.1:8081`。
3. 建立手机 HTTP 网站隧道：外网手机 HTTPS 地址 → `127.0.0.1:8082`。
4. 将 Nginx `server_name` 替换为对应地址主机名；若服务改写 Host，核实这两个独立监听能正确匹配。
5. 核实外部 TLS 证书、Cookie、上传、请求超时及客户端开机启动。HTTP 访问由外网服务跳转 HTTPS；不要在内部 8081/8082 上根据 `$scheme` 强制跳转，避免 TLS 在外层终止时循环重定向。
6. 不公开中间 HTTP 端口。用外网移动数据网络访问两个 HTTPS 地址进行真实验收，不能只在服务器 curl 成功后宣告上线。

域名尚未确定时，本机代理和构建可先完成，但必须把“隧道、外网 TLS、Cookie/PWA 验收”列为未完成，不以 localhost 访问代替外网交付。

## 8. 上线验收（部署 AI 必须记录结果）

| 项目 | 通过标准 |
|---|---|
| 代码检查 | `node tools/check-all.js` 通过；失败须记录原始原因，不修改基线绕过 |
| 移动构建 | `npm run build` 成功，dist 的脚本和样式实际可访问 |
| 后端进程 | 单实例、环境与数据路径正确，异常重启和开机启动已配置 |
| Nginx | 使用实际配置 `nginx -t` 成功，两个站点均命中正确入口 |
| 外网 HTTPS | 桌面和手机地址证书有效，访问无跳转循环或混合内容错误 |
| 登录限制 | 两端未登录访问业务 API 返回 401；本机免登录和 trial 均关闭 |
| 账号共用 | 两端同一账号可登录；账户数据一致，修改密码后旧会话失效 |
| 双向业务 | 用用户允许的测试记录验证桌面写入→手机刷新可见，手机修改→桌面刷新可见；只清理自己的测试记录 |
| 图片与附件 | 两端登录后均能显示并上传测试附件；未授权请求不能绕过校验 |
| 路由 | 桌面和手机直接打开并刷新已存在的详情地址，页面及返回按钮正常 |
| 手机静态资源 | JS/CSS Content-Type 正确，没有把桌面 HTML 当脚本返回 |
| PWA | HTTPS 上 manifest 和 service worker 可加载；实际设备安装与更新正常 |
| 数据持久化 | 服务重启后记录、附件及密文字段保持可用，原密码可登录 |
| 运维 | 日志与备份位置明确；隧道、Nginx、后端重启后恢复路径明确 |

不要在生产环境运行可能创建、删除、改密码的整套接口测试，除非已确认测试隔离和用户授权。自动化集成测试需要临时数据目录及测试实例。任何失败项记录为失败或未验证，不隐瞒。

代理后的登录限流当前使用 Express `req.ip`，源码没有启用 `trust proxy`；同一反代后的用户可能共用失败次数。不要临时设置无边界的 `trust proxy=true`；如需真实客户端 IP，应另行按代理拓扑设计并测试。

## 9. 更新、备份与回滚

1. 更新前保存发布版本、相关 Nginx/进程/隧道配置，以及完整数据和原密钥。备份不能只做 Git 提交。认证秘密不写入普通部署报告。
2. 在新的工作目录安装和构建候选版本，验证通过再切换，避免在正在提供的 dist 中边构建边访问。保留旧静态产物供回滚；需要长期开着页面升级时，还应考虑旧哈希资源的保留。
3. 切换前停止业务写入或后端，在一致性窗口备份数据，然后切换代码和移动产物；数据目录继续使用同一个绝对路径。不要对真实目录执行删除式同步。
4. 后端每次启动会执行敏感字段迁移，因此版本更新可能写入数据；先备份再启动新版本，不能假定回滚只需换回代码。
5. 重启后端，检查 Nginx 配置后重载，再按第 8 节验收。PWA 需确认新 service worker 生效，不把旧缓存页面误判为发布成功。
6. 若失败，停止新实例，恢复旧代码和移动产物；核实数据兼容性。需要恢复数据时，明确恢复点和会丢失的新写入，按用户已授权的回滚范围处理，不能擅自覆盖上线后新增业务。
7. 备份计划应同时保存数据与密钥，限制备份访问并定期做隔离恢复演练；不要把备份目录挂到站点。日志按实际运行器配置轮转，避免磁盘写满。

## 10. 常见故障

| 现象 | 优先排查 |
|---|---|
| 502 | 后端进程、3456 监听、代理目标、运行权限和日志 |
| 手机看到桌面页面 | 隧道端口指错、站点匹配错误或把所有路径代理给后端 |
| 登录后图片 401 | Cookie 未保存、HTTPS 协议头错误、附件跨域或 `/uploads/` 未走后端 |
| 手机 JS 返回 HTML | `/assets/` 被整体代理、dist 不完整或错误的 SPA 回退 |
| 刷新详情页 404 | 手机缺少 `try_files` 回退，或桌面未交给 Express |
| 订单为空 / 账号变化 | `APP_DATA_DIR` 指错、数据漏迁、用户目录变化或误设 `APP_PASSWORD` |
| 敏感字段不可读 | `.secret` 漏迁、旧 `APP_SECRET` 未恢复或被新值覆盖 |
| 上传 413 / 超时 | 穿透、Nginx、后端的大小限制与各层超时 |
| 手机仍显示旧版本 | index/manifest/sw 缓存、旧 service worker、入口域名是否变化 |
| 修改密码后重启变回旧密码 | 进程环境仍固定了 `APP_PASSWORD` |

## 11. 可直接交给 AI 的部署指令

复制下面的指令，并补充你已掌握的服务器、地址和访问方式。无需把密码、密钥填写进公开文档。

```text
请按本仓库 docs/deployment.md 部署完整桌面端和移动端。

我使用 Linux + 宝塔，默认选择方案 A：两个 HTTPS 内网穿透入口，
分别接入桌面和手机 Nginx 站点，两端共用一个 Node.js 后端和一个持久化数据目录。
如果我明确选择公网直连，请按方案 B 适配。

先读取 AGENTS.md、ARCHITECTURE.md 和部署文档，检查代码改动及服务器现状。
从已有上下文读取服务器、代码来源、域名、穿透配置、旧数据和密钥来源；
仅询问实际缺失的必要参数。不把秘密输出到报告或提交到仓库。

请实际完成依赖安装、移动构建、数据备份与迁移、单实例进程管理、
Nginx 配置、HTTPS/穿透接入、开机启动、验收和回滚准备。
保留现有业务数据、账号与加密密钥，禁止自动归属迁移和覆盖其他站点。
修改配置前备份，只操作本项目涉及的服务；需要短暂停机时说明影响。

用部署文档第 8 节逐项验收，最后给我两个外网访问地址、发布版本、
进程/代码/数据/日志/配置/备份位置、检查结果、回滚方式与未完成事项。
如果缺少连接权限、域名或穿透参数，先完成能独立完成的部分，
明确列出剩余阻塞，不能把“已生成配置”说成“已上线”。
```

## 12. 配置依据

项目实现以 `backend/server.js`、`backend/src/utils/auth.js`、`backend/src/utils/data-paths.js`、`backend/src/utils/secret-box.js` 和 `mobile-pwa/vite.config.js` 为准。

- [Vite：静态部署](https://vite.dev/guide/static-deploy.html)：构建输出与 preview 的用途。
- [Nginx：HTTP 代理模块](https://nginx.org/en/docs/http/ngx_http_proxy_module.html)：proxy_pass URI 和转发头行为。
- [Node.js：发布与支持状态](https://nodejs.org/en/about/previous-releases)：部署时选择仍受支持的 LTS。
