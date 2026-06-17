# worldcup2026-live-calendar

2026 世界杯可订阅日历服务。项目目标是生成稳定的 `.ics` 订阅源，并在比赛结束后自动更新赛果。

默认面向中文用户展示：日历标题、比赛摘要、描述、场馆和状态使用中文，比赛时间按北京时间呈现。

## 功能

- 生成 `worldcup2026.ics`。
- 提供全量、淘汰赛、按球队订阅源。
- 提供“我的世界杯日历”：按球队、球星关注、比赛阶段、比赛状态和北京时间段生成个性化 Webcal 订阅源。
- 为每个个性化订阅生成可分享页面，方便球迷把“自己的世界杯日历”转发给同队球迷。
- 提供首页、公开健康检查接口，以及令牌保护的状态页和指标接口。
- 从 OpenFootball 读取公开赛程数据。
- 支持后续接入更稳定的比分数据源。
- 使用稳定 `UID` 和递增 `SEQUENCE` 更新日历事件。

## 本地运行

```bash
npm install
cp .env.example .env
npm run sync:schedule
npm run publish:ics
npm run dev
```

打开：

- `http://localhost:3000/`
- `http://localhost:3000/worldcup2026.ics`
- `http://localhost:3000/feeds/knockout.ics`
- `http://localhost:3000/feeds/teams/mexico.ics`
- `http://localhost:3000/feeds/custom.ics?teams=mexico&stages=group`
- `http://localhost:3000/share/custom?stars=messi`
- `http://localhost:3000/status?token=<STATUS_ACCESS_TOKEN>`
- `http://localhost:3000/readiness?token=<STATUS_ACCESS_TOKEN>`
- `http://localhost:3000/healthz`
- `http://localhost:3000/metrics?token=<STATUS_ACCESS_TOKEN>`

## 个性化订阅

`/feeds/custom.ics` 支持以下查询参数：

- `teams`：球队 slug，多个用英文逗号分隔，例如 `mexico,brazil`。
- `stars`：球星关注 slug，多个用英文逗号分隔，例如 `messi,mbappe`。当前会追踪球星所在国家队赛程，正式名单稳定后可继续增强到球员级信息。
- `stages`：`group`、`knockout`。
- `statuses`：`scheduled`、`live`、`final`。
- `timeStart` / `timeEnd`：北京时间窗口，例如 `20:00` 到 `08:00`，支持跨午夜。

同样参数可用于 `/share/custom` 生成分享页。分享页会展示二维码、一键订阅、复制订阅源和赛程预览。

## Docker 运行

```bash
cp .env.example .env
docker compose up -d --build
```

默认只需要 `web` 和 `worker`。`postgres` 和 `redis` 已作为后续生产增强预留。

## 生产健康检查

仓库提供了一个通用健康检查脚本：

```bash
HEALTHCHECK_URL=http://127.0.0.1:3026/healthz scripts/healthcheck.sh
```

生产环境可以用 systemd timer、cron 或外部监控定时执行。真实服务名、内网地址和告警地址应放在服务器环境中，不要提交到仓库。

## 运行态备份

备份当前状态和生成后的 ICS：

```bash
APP_DIR=/path/to/app BACKUP_DIR=/path/to/backups scripts/backup-runtime.sh
```

从备份恢复：

```bash
APP_DIR=/path/to/app scripts/restore-runtime.sh /path/to/backups/20260616T000000Z
```

真实服务器路径不要提交到仓库。

## 配置

真实配置写入 `.env`，不要提交。

关键配置：

- `PUBLIC_BASE_URL`
- `CALENDAR_DOMAIN`
- `SCHEDULE_SYNC_INTERVAL_MS`
- `STATUS_ACCESS_TOKEN`
- `PRIMARY_SCORE_PROVIDER`
- `API_FOOTBALL_API_KEY`
- `CCTV_SCHEDULE_URL`
- `CCTV_TEAMS_URL`
- `SUPPORT_ALIPAY_URL`
- `SUPPORT_ALIPAY_QR_URL`
- `SUPPORT_GITHUB_SPONSORS_URL`
- `ALIPAY_APP_ID`
- `ALIPAY_PRIVATE_KEY`
- `ALIPAY_PRIVATE_KEY_TYPE`
- `ALIPAY_PUBLIC_KEY`
- `ALIPAY_GATEWAY`
- `ALIPAY_RETURN_URL`
- `ALIPAY_NOTIFY_URL`
- `FEISHU_WEBHOOK_URL`
- `FEISHU_WEBHOOK_SECRET`
- `ALERT_WEBHOOK_URL`

`/healthz` 用于公开存活检查；`/status`、`/readiness`、`/api/status`、`/api/readiness` 和 `/metrics` 建议在生产环境配置 `STATUS_ACCESS_TOKEN`，通过查询参数 `?token=` 或请求头 `x-status-token` 访问。

### 启用支付宝官方支付

首页荣耀榜区域有“赞助支持”收银台。未配置支付宝密钥时，接口会安全返回“支付宝支付通道正在配置中”。申请完成后，在生产环境 `.env` 写入：

```bash
ALIPAY_APP_ID=<your-alipay-app-id>
ALIPAY_PRIVATE_KEY=<your-app-private-key>
ALIPAY_PUBLIC_KEY=<alipay-public-key>
ALIPAY_GATEWAY=https://openapi.alipay.com/gateway.do
ALIPAY_RETURN_URL=https://<public-host>/?payment=return
ALIPAY_NOTIFY_URL=https://<public-host>/api/v1/alipay/notify
```

真实支付结果必须以支付宝异步通知 `/api/v1/alipay/notify` 验签成功为准，前端跳转只用于用户体验。

留言与反馈表单会把用户填写的内容通过飞书通知站点维护者；联系方式仅用于必要时回复反馈。

### 启用 API-Football 主比分源

API-Football 的 2026 世界杯参数是 `league=1`、`season=2026`。把生产环境 `.env` 配成：

```bash
PRIMARY_SCORE_PROVIDER=api-football
API_FOOTBALL_API_KEY=<your-api-football-key>
API_FOOTBALL_LEAGUE_ID=1
API_FOOTBALL_SEASON=2026
```

没有配置 key 时，默认仍使用 ESPN 备源运行，不会把公开服务打红。

## Readiness

`/healthz` 表示当前服务是否可用，适合健康检查和自动重启。

`/readiness` 和 `/api/readiness` 表示是否达到无人值守生产标准。它会检查：

- 运行时健康。
- 是否发布完整 104 场比赛。
- 是否配置付费主比分源。
- 是否配置外部告警 webhook。
- 是否存在已发布 ICS 的哈希。

## Metrics

`/metrics` 暴露 Prometheus 文本格式指标，便于接入 Uptime Kuma、Prometheus 或其他 HTTP 监控。

包含：

- `wc2026_matches_total`
- `wc2026_matches_final_total`
- `wc2026_calendar_publication_age_seconds`
- `wc2026_worker_heartbeat_age_seconds`
- `wc2026_provider_up`
- `wc2026_provider_last_success_age_seconds`

## 告警测试

配置 `ALERT_WEBHOOK_URL` 后可以运行：

```bash
npm run alert:test
```

没有配置 webhook 时，命令会明确失败，避免误以为告警已打通。

支持三种 webhook payload：

```bash
ALERT_WEBHOOK_TYPE=generic
ALERT_WEBHOOK_TYPE=feishu
ALERT_WEBHOOK_TYPE=slack
```

飞书自定义机器人建议使用：

```bash
ALERT_WEBHOOK_TYPE=feishu
ALERT_WEBHOOK_URL=<feishu-bot-webhook>
```

## 安全

这是公开仓库。不要提交生产服务器、云账号、SSH、数据库、API Key、Webhook 或其他私有运维信息。详见 [SECURITY.md](./SECURITY.md)。

## 数据来源

基础赛程来自 OpenFootball 的公开数据。该数据源适合做赛程基线，不承诺实时比分 SLA。公开生产服务应接入付费实时比分源作为主源，并使用其他来源作为备源。

## 许可证

MIT
