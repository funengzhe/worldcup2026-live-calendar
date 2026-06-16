# worldcup2026-live-calendar

2026 世界杯可订阅日历服务。项目目标是生成稳定的 `.ics` 订阅源，并在比赛结束后自动更新赛果。

## 功能

- 生成 `worldcup2026.ics`。
- 提供首页、状态页和健康检查接口。
- 从 OpenFootball 读取公开赛程数据。
- 支持后续接入实时比分源。
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
- `http://localhost:3000/status`
- `http://localhost:3000/healthz`

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
- `OPENFOOTBALL_URL`
- `SCHEDULE_SYNC_INTERVAL_MS`
- `PRIMARY_SCORE_PROVIDER`
- `API_FOOTBALL_API_KEY`
- `ALERT_WEBHOOK_URL`

### 启用 API-Football 主比分源

API-Football 的 2026 世界杯参数是 `league=1`、`season=2026`。把生产环境 `.env` 配成：

```bash
PRIMARY_SCORE_PROVIDER=api-football
API_FOOTBALL_API_KEY=<your-api-football-key>
API_FOOTBALL_LEAGUE_ID=1
API_FOOTBALL_SEASON=2026
```

没有配置 key 时，默认仍使用 ESPN 备源运行，不会把公开服务打红。

## 安全

这是公开仓库。不要提交生产服务器、云账号、SSH、数据库、API Key、Webhook 或其他私有运维信息。详见 [SECURITY.md](./SECURITY.md)。

## 数据来源

基础赛程来自 OpenFootball 的公开数据。该数据源适合做赛程基线，不承诺实时比分 SLA。公开生产服务应接入付费实时比分源作为主源，并使用其他来源作为备源。

## 许可证

MIT
