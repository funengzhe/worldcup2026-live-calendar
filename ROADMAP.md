# worldcup2026-live-calendar 开发路线图

## 1. 项目目标

构建一个开源的 2026 世界杯可订阅日历服务。服务端尽量做到自动同步、自动发布、自动恢复，并在比赛结束后尽快把赛果写入日历订阅源。

示例公开入口：

- `https://<public-host>/`
- `https://<public-host>/worldcup2026.ics`
- `https://<public-host>/status`
- `https://<public-host>/healthz`

仓库信息：

- Repository: `git@github.com:funengzhe/worldcup2026-live-calendar.git`
- 对外访问：通过 HTTPS 和反向代理提供服务
- 运行方式：容器化部署

注意：这是公开仓库。不要提交服务器 IP、云账号信息、SSH 别名、内部路径、凭据、比分服务 API Key、生产环境防火墙细节或其他私有运维信息。

## 2. 产品范围

### 必须具备

- 完整的 2026 世界杯赛程日历。
- 稳定的 `.ics` 订阅源。
- 兼容 iPhone、Google Calendar、Outlook。
- 比赛结束后自动更新赛果。
- 服务端目标：在可靠数据源确认后 3-5 分钟内发布结果。
- 状态页：展示订阅源新鲜度、数据源状态、最近更新、下一场比赛。
- 健康检查接口。
- 进程或服务器重启后自动恢复。
- 同步异常、发布异常、赛果延迟更新时自动告警。

### 应该具备

- 多种订阅源：
  - 全部赛程。
  - 按球队订阅。
  - 只看淘汰赛。
  - 按城市/球场订阅。
- 可选赛前提醒。
- Web 页面提供 Apple Calendar、Google Calendar、Outlook 和复制链接按钮。
- 后续可考虑无剧透模式。

### 明确限制

本服务可以在服务端快速更新 `.ics` 文件，但不能强制 Apple Calendar、Google Calendar 或 Outlook 立即刷新。用户实际看到更新的时间取决于日历客户端自己的同步机制。

## 3. 推荐技术栈

- 运行时：Node.js 22 LTS
- 语言：TypeScript
- Web 框架：Fastify
- 数据库：PostgreSQL
- ORM / 查询层：Drizzle ORM
- 调度：BullMQ + Redis；MVP 阶段也可以先用简单 worker loop
- ICS 生成：`ical-generator`
- 数据校验：`zod`
- 测试：Vitest
- 代码规范：ESLint + Prettier
- 容器：Docker Compose
- 反向代理：Nginx 或同类服务
- TLS：使用生产服务器自己的证书流程

MVP 可以由四个服务组成：`web`、`worker`、`postgres`、`redis`。

## 4. 数据源策略

### 基础赛程

- 开源基础源：`openfootball/worldcup.json`
- 官方校验源：FIFA 官方赛程页

### 实时比分

使用 provider adapter 架构，避免业务逻辑绑定某一个比分源。

初始 adapter：

- `EspnScoreProvider`：备用源，不承诺 SLA。
- `ManualJsonProvider`：紧急修正用的本地覆盖文件。
- `MockProvider`：用于测试和模拟。

生产 adapter：

- 公开上线前选择一个付费比分源作为主源。
- 候选：Sportmonks、API-FOOTBALL、LiveScore API、BALLDONTLIE。

生产原则：公开服务不能只依赖单一非官方免费源。

## 5. 数据模型

核心表：

- `teams`
- `venues`
- `matches`
- `score_snapshots`
- `provider_status`
- `sync_runs`
- `calendar_publications`
- `calendar_feeds`
- `alerts`

比赛关键字段：

- `id`
- `fifa_match_no`
- `stage`
- `group_name`
- `home_team_id`
- `away_team_id`
- `home_score`
- `away_score`
- `penalty_home_score`
- `penalty_away_score`
- `kickoff_at_utc`
- `venue_id`
- `status`
- `winner_team_id`
- `last_score_update_at`
- `confidence`
- `sequence`

ICS 身份规则：

- 每场比赛的 `UID` 必须永久稳定。
- 推荐格式：`worldcup2026-match-{fifa_match_no}@<calendar-domain>`

## 6. 自动更新逻辑

### 赛程同步

- 非赛事期每 6 小时运行一次。
- 赛事期每 30 分钟运行一次。
- 检测开球时间、球队、场馆、比赛状态变化。
- 永远不改变已经发布过的稳定 `UID`。

### 活跃比赛轮询

活跃窗口：

- 开赛前 30 分钟开始。
- 终场状态出现后继续 20 分钟。

轮询频率：

- 赛前：每 2 分钟。
- 比赛中：每 30-60 秒。
- 终场后：每 30 秒，持续 10 分钟。
- 长尾确认：每 5 分钟，持续 30 分钟。

### 结果判定

规则：

- 两个可信数据源的终场状态和比分一致时，立即发布。
- 只有主源给出终场状态时，等待 2 分钟后复查。
- 冲突超过阈值时，按最高权重数据源发布，并标记 `confidence=low`。
- 后续可信结果修正比分时，递增 `sequence` 并重新发布。

## 7. ICS 发布规则

每个日历事件应包含：

- `UID`
- `SEQUENCE`
- `DTSTAMP`
- `CREATED`
- `LAST-MODIFIED`
- `DTSTART`
- `DTEND`
- `SUMMARY`
- `LOCATION`
- `DESCRIPTION`
- `URL`
- 可选 `VALARM`

标题示例：

- 球队未确定：`World Cup 2026: Match 73`
- 开赛前：`World Cup 2026: Mexico vs South Africa`
- 终场后：`Mexico 2-1 South Africa`
- 点球后：`Argentina 1-1 France (4-2 pens)`

发布流程：

1. 读取数据库中的可信状态。
2. 生成临时 ICS 文件。
3. 校验 ICS 语法。
4. 原子替换发布文件，或上传到对象存储。
5. 写入 `calendar_publications` 记录。
6. 更新状态页数据。

## 8. Web 页面

首页内容：

- 世界杯日历订阅按钮。
- 可复制的 ICS URL。
- 解释日历客户端刷新时间由 Apple、Google、Microsoft 控制。
- 最近更新时间。
- 下一场比赛。
- 最近完场结果。

状态页内容：

- 订阅源新鲜度。
- 最近一次赛程同步。
- 最近一次比分同步。
- 数据源健康状态。
- 当前活跃比赛。
- 最近发布记录。

MVP 不做后台管理界面。紧急覆盖可以先通过版本化 JSON 文件或 CLI 命令完成。

## 9. 部署计划

本仓库只保存通用部署模板。生产环境的真实域名、服务器路径、主机信息、证书细节、密钥和告警地址必须放在仓库外。

### 服务器准备

DNS：

- 将公开域名解析到生产服务器。

目录：

- 使用服务器上的私有部署目录，不在提交脚本中硬编码。

反向代理：

- 使用 `deploy/nginx.example.conf` 作为模板。
- 将公开 HTTPS 流量代理到应用的私有监听地址。
- 不在仓库中记录生产服务器防火墙、主机和路径细节。

TLS：

- 使用生产服务器已有的证书签发与续期流程。

### Docker Compose 服务

- `web`：Fastify Web 服务。
- `worker`：赛程同步、比分同步和日历发布 worker。
- `postgres`：应用数据库。
- `redis`：队列和分布式锁。

所有服务都应设置自动重启策略。

### 部署命令示例

```bash
git clone git@github.com:funengzhe/worldcup2026-live-calendar.git
cd worldcup2026-live-calendar
cp .env.example .env
docker compose up -d --build
docker compose exec web npm run db:migrate
docker compose exec worker npm run sync:schedule
docker compose exec worker npm run publish:ics
```

验证命令示例：

```bash
curl -I https://<public-host>/
curl -I https://<public-host>/worldcup2026.ics
curl https://<public-host>/healthz
curl https://<public-host>/status
```

## 10. 监控与告警

最低检查项：

- `GET /healthz` 返回 200。
- `GET /worldcup2026.ics` 返回 200，且内容不是空日历。
- Feed 的 `LAST-MODIFIED` 没有过期。
- 活跃比赛比分轮询没有过期。
- 数据源错误率低于阈值。
- Worker 心跳是新鲜的。

告警条件：

- 活跃比赛结束后 5 分钟内 feed 没有更新。
- 活跃比赛期间连续 3 次拿不到任何比分源响应。
- ICS 生成失败。
- 数据库迁移或连接失败。
- 公开入口返回非 200。
- 磁盘使用率超过阈值。

建议告警渠道：

- Telegram bot。
- 飞书 webhook。
- 邮件兜底。

## 11. 开发里程碑

### Phase 0：仓库初始化

交付物：

- TypeScript 项目。
- Docker Compose。
- README。
- License。
- CI。
- `.env.example`。

验收标准：

- `npm test` 通过。
- `docker compose up` 可以在本地启动 web 和 worker。
- `/healthz` 返回 200。

### Phase 1：静态赛程日历

交付物：

- 从 fixture JSON 导入比赛。
- 数据库 schema 和 migration。
- 生成完整赛程 ICS。
- 首页提供订阅入口。

验收标准：

- `worldcup2026.ics` 可导入 Apple Calendar 和 Google Calendar。
- 所有比赛 UID 稳定。
- 中国和美国时区显示正确。

### Phase 2：状态页与发布流水线

交付物：

- 发布记录。
- 状态页。
- ICS 校验。
- 原子发布。

验收标准：

- 状态页显示最近一次生成的 feed。
- 损坏的 ICS 不会被发布。
- 比赛信息变化后 `SEQUENCE` 递增。

### Phase 3：比分源 adapter

交付物：

- Provider 接口。
- ESPN adapter。
- Mock provider。
- 比分快照存储。
- 数据源健康状态。

验收标准：

- 测试 fixture 可以模拟比赛中、中场、终场和赛后修正。
- 快照带有 provider 元数据并入库。

### Phase 4：结果判定与活跃轮询

交付物：

- 活跃比赛识别。
- 轮询频率控制。
- 结果判定器。
- 冲突处理。
- 低置信度发布标记。

验收标准：

- 模拟终场结果可在 3 分钟内重新发布 ICS。
- 数据源冲突不会导致发布流程崩溃。
- 后续修正会递增 `SEQUENCE` 并重新发布。

### Phase 5：生产加固

交付物：

- Redis 锁。
- Worker 心跳。
- 告警 hook。
- 备份脚本。
- 恢复脚本。
- 反向代理配置模板。
- 部署指南。

验收标准：

- 应用重启后可以自动恢复。
- 多 worker 不会并发发布冲突文件。
- 测试故障场景可以触发告警。

### Phase 6：生产发布

交付物：

- 服务部署到生产域名。
- HTTPS 可用。
- 监控可用。
- 第一版公开 ICS feed 可访问。

验收标准：

- iPhone 可以订阅 feed。
- Google Calendar 可以订阅 feed。
- `/healthz`、`/status` 和 `.ics` 公开可访问。
- 容器重启后服务可以恢复。

### Phase 7：赛前准备

交付物：

- 选定并接入付费比分源。
- Runbook。
- 负载测试。
- 日历客户端兼容性检查。
- 数据源故障演练。

验收标准：

- 数据源 failover 可用。
- 活跃比赛模拟通过。
- 公开状态页准确反映服务状态。

## 12. 风险清单

### 日历客户端刷新慢

影响：

- 即使服务端 feed 已更新，用户也可能不会马上看到赛果。

缓解：

- 在首页明确说明。
- 后续增加可选即时通知渠道。

### 非官方比分 API 变化

影响：

- 比分同步可能失效。

缓解：

- 使用 adapter 架构。
- 付费主源。
- 备用源。
- 告警。

### 终场比分冲突

影响：

- 可能发布错误结果。

缓解：

- 多源判定。
- 置信度标记。
- 修正时递增 `SEQUENCE` 并重新发布。

### 服务中断

影响：

- 动态页面不可用。

缓解：

- Docker 自动重启。
- 反向代理健康检查。
- 外部监控。
- MVP 后考虑将 `.ics` 发布到对象存储/CDN。

## 13. 近期下一步

1. 为本机配置 GitHub SSH 权限，或通过其他机器推送。
2. 初始化 TypeScript 项目。
3. 实现健康检查接口和 Docker Compose。
4. 实现静态赛程导入和 ICS 生成。
5. 将第一版静态 feed 部署到生产域名。
6. 增加比分源 adapter 和自动发布流程。
