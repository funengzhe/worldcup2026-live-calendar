import QRCode from "qrcode";
import type { ReadinessResult } from "./readiness.js";
import type { AppState, Match, SponsorRecord } from "./types.js";
import { summary } from "./calendar.js";
import type { CustomFeedResult } from "./customFeed.js";
import { STAR_PRESETS, customFeedQuery } from "./customFeed.js";
import { slugify, teamFeeds } from "./feeds.js";
import {
  formatBeijingDateTime,
  formatBeijingTime,
  groupOrRoundZh,
  stageZh,
  statusZh,
  teamDisplayNameZh,
  teamFlag,
  teamNameZh,
  venueZh
} from "./localization.js";

const CCTV_WORLD_CUP_SCHEDULE_URL = "https://worldcup.cctv.com/2026/schedule/index.shtml";

export interface SupportConfig {
  alipayUrl?: string;
  alipayQrUrl?: string;
  githubSponsorsUrl?: string;
}

export async function renderHome(
  state: AppState,
  publicBaseUrl: string,
  support: SupportConfig = {}
): Promise<string> {
  const baseUrl = publicBaseUrl.replace(/\/$/, "");
  const icsUrl = `${baseUrl}/worldcup2026.ics`;
  const webcalUrl = toWebcalUrl(icsUrl);
  const teams = teamFeeds(state.matches);
  const days = scheduleDays(state.matches);
  const initialDate = pickInitialDateKey(days);
  const initialMatches = matchesForDate(state.matches, initialDate).slice(0, 12);
  const initialDay = days.find((day) => day.key === initialDate);
  const clientState = {
    webcalUrl,
    googleUrl: `https://calendar.google.com/calendar/render?cid=${encodeURIComponent(icsUrl)}`,
    customFeedBase: `${baseUrl}/feeds/custom.ics`,
    customWebcalBase: toWebcalUrl(`${baseUrl}/feeds/custom.ics`),
    customShareBase: `${baseUrl}/share/custom`,
    days,
    selectedDate: initialDate,
    matches: state.matches.map(clientMatch),
    teams: teams.map((feed) => teamClientCard(feed.team, state.matches, baseUrl)),
    stars: STAR_PRESETS.map((star) => ({
      ...star,
      teamSlug: slugify(star.team),
      teamLabel: teamDisplayNameZh(star.team)
    }))
  };
  const qrSvg = await QRCode.toString(webcalUrl, {
    type: "svg",
    margin: 1,
    width: 168,
    color: {
      dark: "#07160e",
      light: "#ffffff"
    }
  });
  const teamCount = teams.length || countKnownTeams(state.matches);
  const groupCount = countGroups(state.matches);
  const venueCount = countVenues(state.matches);

  return page(
    "2026 世界杯赛程订阅日历",
    `
      <header class="topbar">
        <a class="brand" href="#top" aria-label="2026世界杯赛程首页">
          <img
            class="brand-icon"
            src="/assets/img/worldcup-trophy-circle-icon.webp"
            alt="2026世界杯日历"
            width="36"
            height="36"
          />
          <img
            class="brand-logo"
            src="/assets/img/2026-chinese-calendar-logo.webp"
            alt="2026世界杯日历官方赛程"
            width="320"
            height="80"
          />
        </a>
        <nav class="topnav" aria-label="主导航">
          <a href="#top">开幕</a>
          <a href="#schedule">赛程</a>
          <a href="#calendar-guide">订阅说明</a>
          <a href="#honor-wall">英雄榜</a>
          <a href="#honor-wall">支持</a>
        </nav>
        <a class="login-pill" href="${escapeHtml(webcalUrl)}" data-webcal-link>订阅</a>
      </header>

      <main id="top">
        <div class="wechat-tip" id="wechat-tip" hidden>
          <strong>微信内打开可能无法唤起手机日历</strong>
          <span>请点击右上角“...”选择“在浏览器打开”，再点“一键添加到手机日历”。复制 webcal 链接后也可以在系统日历中手动添加订阅。</span>
        </div>

        <section class="screen hero-screen flow-screen" id="subscribe" aria-label="2026世界杯赛程订阅">
          <img class="hero-trophy" src="/assets/img/worldcup-trophy-hero.webp" alt="" aria-hidden="true" width="1024" height="1536" />
          <div class="screen-inner hero-composition">
            <div class="hero-copy">
              <p class="eyebrow live-eyebrow"><span></span>LIVE 动态同步</p>
              <h1>2026 FIFA 世界杯赛程日历订阅</h1>
              <p class="hero-subtitle">北京时间 · 中文队名 · 赛果持续同步 · 手机日历网络订阅</p>
              <div class="hero-bullets" aria-label="核心卖点">
                <span>一键添加到手机日历</span>
                <span>北京时间日期时间</span>
                <span>赛果持续同步</span>
                <span>网络订阅自动刷新</span>
              </div>
            </div>

            <section class="hero-console" aria-label="极速订阅控制台">
              <div class="qr-token">
                <div class="qr" aria-label="订阅二维码">${qrSvg}</div>
              </div>
              <div class="hero-actions">
                <a class="mobile-primary" href="${escapeHtml(webcalUrl)}" data-webcal-link>立即一键添加到手机日历</a>
                <button type="button" data-copy="${escapeHtml(webcalUrl)}">复制订阅源链接</button>
              </div>
              <div class="hero-link-stack">
                <div class="copy-row">
                  <input readonly value="${escapeHtml(webcalUrl)}" aria-label="订阅地址" />
                  <button type="button" data-copy="${escapeHtml(webcalUrl)}">复制</button>
                </div>
                ${renderSyncStatus(state, "hero-sync-status")}
              </div>
            </section>
          </div>
          <div class="hero-bottom-board" aria-label="赛事数据看板">
            ${renderLedStat(teamCount, "支球队", "teams")}
            ${renderLedStat(state.matches.length, "场比赛", "matches")}
            ${renderLedStat(groupCount, "个小组", "groups")}
            ${renderLedStat(venueCount, "座球场", "venues")}
          </div>
          <a class="scroll-cue" href="#schedule" aria-label="滚动到完整赛程">↓</a>
        </section>

        <section class="screen schedule-screen flow-screen" id="schedule">
          <div class="screen-heading">
            <h2>赛程大厅</h2>
          </div>
          <nav class="schedule-tabs" aria-label="赛程视图">
            <button class="active" type="button" data-tab="focus">今日焦点</button>
            <button type="button" data-tab="teams">球队赛程</button>
            <button type="button" data-tab="knockout">淘汰赛</button>
            <button type="button" data-tab="custom">我的日历</button>
          </nav>
          <nav class="date-picker" aria-label="选择比赛日期">
            ${renderDatePicker(days, initialDate)}
          </nav>
          <div class="schedule-summary" id="schedule-summary">
            ${renderScheduleSummary(initialDay, initialMatches)}
          </div>
          <div id="schedule-panel">
            ${renderScheduleMatches(initialMatches)}
          </div>
          <div class="empty-state" id="empty-state" hidden>这一天暂无比赛。</div>
          <script id="schedule-data" type="application/json">${escapeJsonForHtml(JSON.stringify(clientState))}</script>
        </section>

        <section class="screen guide-screen flow-screen" id="calendar-guide" aria-label="日历订阅说明">
          <div class="guide-panel">
            <div class="guide-title">
              <h2>日历订阅说明</h2>
              <p>当前公开订阅源包含全部 ${state.matches.length} 场比赛，使用北京时间、中文队名和网络动态同步。网页会优先展示最新赛程与赛果；手机日历会按各客户端自己的节奏刷新。</p>
            </div>
            <div class="guide-grid">
              <article>
                <strong>北京时间汉化</strong>
                <span>全 104 场比赛会自动转换为北京时间，球队名字使用中文显示，手机日历里不用再手动换算时差。</span>
              </article>
              <article>
                <strong>什么是 Webcal</strong>
                <span>这不是一次性 ICS 下载死数据，而是动态网络流。订阅一次，未来淘汰赛对阵、时间微调和赛果都会更新到同一个源。</span>
              </article>
              <article>
                <strong>刷新预期</strong>
                <span>网页赛果会优先展示最新数据；iPhone、Google 日历等客户端可能延迟数小时显示。</span>
              </article>
              <article>
                <strong>直播入口</strong>
                <span>比赛行内提供央视 2026 世界杯官方赛程入口，开赛后可直达直播或回放页面。</span>
              </article>
            </div>
            <div class="guide-actions">
              <a class="neon-link" href="${escapeHtml(webcalUrl)}" data-webcal-link>一键添加到手机日历</a>
              <button type="button" data-copy="${escapeHtml(webcalUrl)}">复制 webcal 订阅链接</button>
              <a class="blue-link" href="#schedule">查看网页实时赛果</a>
              <a class="blue-link" href="https://calendar.google.com/calendar/render?cid=${encodeURIComponent(icsUrl)}">Google 日历</a>
            </div>
            <div class="device-guides" aria-label="不同设备订阅指引">
              <article>
                <strong>iPhone / iPad</strong>
                <span>用 Safari 打开本站，点击“一键添加到手机日历”。订阅后等待系统后台刷新；如长时间不变，可删除旧订阅后重新添加。</span>
              </article>
              <article>
                <strong>安卓 / 小米</strong>
                <span>可直接点击订阅链接，或复制 webcal 地址，在系统日历、Google 日历等客户端中添加“网络日历/通过网址订阅”。</span>
              </article>
              <article>
                <strong>微信内打开</strong>
                <span>微信通常无法直接唤起系统日历。点击订阅时会自动复制链接，请从右上角选择“在浏览器打开”后再添加。</span>
              </article>
            </div>
            <div class="guide-steps" aria-label="日历订阅操作步骤">
              <div>
                <strong>01</strong>
                <span>复制订阅链接</span>
                <p>一键复制 webcal 网络订阅地址。</p>
              </div>
              <div>
                <strong>02</strong>
                <span>打开日历应用</span>
                <p>在手机或电脑的日历 App 中选择添加订阅日历。</p>
              </div>
              <div>
                <strong>03</strong>
                <span>粘贴并确认</span>
                <p>确认后全部赛程自动出现，赛果和时间变更会同步刷新。</p>
              </div>
            </div>
            <p class="sync-note">iPhone、Google 日历等客户端的实际刷新频率由各自系统决定，通常不会像网页一样立即刷新。</p>
            <div class="calendar-diagnosis">
              <strong>如果手机日历暂时没更新</strong>
              <span>先以网页赛程大厅为准；iPhone 如长时间不变，可删除旧订阅后重新添加同一个 webcal 链接。</span>
            </div>
          </div>
        </section>

        <section class="screen honor-screen flow-screen" id="honor-wall" aria-label="荣耀赞助英雄榜">
          <div class="honor-panel">
            <div class="honor-title">
              <p class="eyebrow">Honor Wall</p>
              <h2>荣耀赞助英雄榜</h2>
              <p>数据基于支付宝网关安全加密结算。为保护球迷隐私，系统默认匿名展示；如需自定义荣耀昵称或留言，请在右侧收银台填写后完成支付，榜单会自动同步。不打赏作者也完全支持你免费使用全部赛程订阅功能。</p>
              <div class="honor-rules" aria-label="赞助说明">
                <span>名字永久荣登荣耀榜</span>
                <span>前三名获得头号球迷 / 核心球迷 / 助攻球迷标记</span>
                <span>资助独立开源开发者</span>
                <span>支持赛程与赛果持续同步</span>
              </div>
            </div>
            ${renderHonorGrid(state.sponsors ?? [])}
          </div>
        </section>
        ${renderSiteFooter(support)}
      </main>
    `
  );
}

export async function renderCustomSharePage(
  feed: CustomFeedResult,
  publicBaseUrl: string,
  savedLinks: { title?: string; shareUrl?: string; feedUrl?: string } = {}
): Promise<string> {
  const baseUrl = publicBaseUrl.replace(/\/$/, "");
  const query = customFeedQuery(feed.options);
  const feedUrl = savedLinks.feedUrl ?? `${baseUrl}/feeds/custom.ics${query ? `?${query}` : ""}`;
  const webcalUrl = toWebcalUrl(feedUrl);
  const shareUrl = savedLinks.shareUrl ?? `${baseUrl}/share/custom${query ? `?${query}` : ""}`;
  const customizeUrl = `${baseUrl}/?tab=custom${query ? `&${query}` : ""}`;
  const title = savedLinks.title || feed.title;
  const poster = customPosterContent(feed, title);
  const qrSvg = await QRCode.toString(webcalUrl, {
    type: "svg",
    margin: 1,
    width: 210,
    color: {
      dark: "#07160e",
      light: "#ffffff"
    }
  });

  return page(
    `${title} - 分享订阅`,
    `
      <main class="share-page">
        <section class="share-poster-wrap" aria-label="个性化赛程分享卡">
          <article class="share-poster">
            <div class="poster-cut poster-cut-left" aria-hidden="true"></div>
            <div class="poster-cut poster-cut-right" aria-hidden="true"></div>
            <div class="poster-confetti" aria-hidden="true"></div>
            <div class="poster-topline"><span></span><b>2026</b><span></span></div>
            <h1 class="poster-title">${escapeHtml(poster.headline)}</h1>
            <p class="poster-subtitle">${escapeHtml(poster.subtitle)}</p>
            <p class="poster-owner">${escapeHtml(poster.ownerLine)}</p>
            <div class="poster-tags" aria-label="定制条件">
              ${poster.tags
                .map((tag) => `<span>${escapeHtml(tag)}</span>`)
                .join("")}
            </div>
            <div class="poster-stats">
              ${poster.stats
                .map(
                  (stat) => `
                    <span>
                      <strong>${escapeHtml(stat.value)}</strong>
                      <em>${escapeHtml(stat.label)}</em>
                    </span>
                  `
                )
                .join("")}
            </div>
            <div class="poster-feature-strip">
              <span>北京时间已换算</span>
              <span>一键添加手机日历</span>
              <span>中文队名显示</span>
              <span>赛果/时间同步</span>
            </div>
            <div class="poster-stage" aria-hidden="true">
              <img src="/assets/img/worldcup-trophy-hero.webp" alt="" />
            </div>
            <div class="poster-focus-list" aria-label="我的定制关注">
              <div class="poster-focus-head">
                <strong>我的定制关注</strong>
                <span>${escapeHtml(poster.previewLabel)}</span>
              </div>
              ${renderPosterFocusTags(poster.focusTags)}
              <p>${escapeHtml(poster.previewNote)}</p>
            </div>
            <div class="poster-ticket">
              <div class="poster-barcode" aria-hidden="true"><i></i><span>WC2026-${escapeHtml(poster.passId)}</span></div>
              <div>
                <strong>扫码添加同款赛程日历</strong>
                <span>网络订阅源 · 订阅后自动同步</span>
              </div>
              <div class="qr poster-qr" aria-label="分享订阅二维码">${qrSvg}</div>
            </div>
            <div class="poster-url">wc2026.funengzhe.cn</div>
          </article>
          <div class="share-actions poster-actions">
            <button class="poster-download-action" type="button" data-download-poster>保存海报图片</button>
            <button type="button" data-copy="${escapeHtml(shareUrl)}">复制分享链接</button>
            <a href="${escapeHtml(webcalUrl)}" data-webcal-link>添加到手机日历</a>
            <details class="poster-more-actions">
              <summary>更多操作</summary>
              <div>
                <button type="button" data-native-share data-share-url="${escapeHtml(shareUrl)}" data-share-title="${escapeHtml(title)}">系统分享</button>
                <a href="${escapeHtml(customizeUrl)}">基于它重新定制</a>
                <button type="button" data-copy="${escapeHtml(webcalUrl)}">复制订阅源</button>
              </div>
            </details>
          </div>
          <div class="share-brief">
            <strong>这是一个可订阅的个性化世界杯赛程</strong>
            <span>包含 ${escapeHtml(String(feed.matches.length))} 场比赛。你可以一键添加同款到手机日历，也可以基于这套方案重新定制自己的观赛日历。</span>
          </div>
        </section>
      </main>
    `
  );
}

function renderPosterFocusTags(tags: PosterFocusTag[]): string {
  if (tags.length === 0) return '<div class="poster-empty">赛程正在等待点亮</div>';
  return `
    <div class="poster-focus-tags">
      ${tags
        .map(
          (tag) =>
            `<span class="${escapeHtml(tag.kind)}" data-focus-kind="${escapeHtml(tag.kind)}">${tag.icon ? `<i>${escapeHtml(tag.icon)}</i>` : ""}${escapeHtml(tag.label)}</span>`
        )
        .join("")}
    </div>
  `;
}

type PosterFocusTag = {
  icon?: string;
  kind: "people" | "trait";
  label: string;
};

function countPosterDays(matches: Match[]): number {
  return new Set(matches.map((match) => beijingDateKey(match.kickoffAtUtc))).size;
}

function customPosterContent(feed: CustomFeedResult, fallbackTitle: string): {
  headline: string;
  subtitle: string;
  ownerLine: string;
  tags: string[];
  focusTags: PosterFocusTag[];
  stats: Array<{ value: string; label: string }>;
  previewLabel: string;
  previewNote: string;
  passId: string;
} {
  const selectedTeams = uniqueTeamsFromOptions(feed);
  const selectedTeamNames = selectedTeams.map(teamNameZh);
  const days = countPosterDays(feed.matches);
  const teamTags: PosterFocusTag[] = selectedTeams.map((team) => ({
    icon: teamFlag(team),
    kind: "people" as const,
    label: teamNameZh(team)
  }));
  const starTags: PosterFocusTag[] = [];
  for (const slug of feed.options.stars) {
    const star = STAR_PRESETS.find((item) => item.slug === slug);
    if (star) {
      starTags.push({
        icon: teamFlag(star.team),
        kind: "people",
        label: star.label
      });
    }
  }
  const packTags: PosterFocusTag[] = feed.options.packs.map((pack) => ({
    icon: posterPackIcon(pack),
    kind: "trait" as const,
    label: posterPackLabel(pack)
  }));
  const starNames = starTags.map((tag) => tag.label);
  const packNames = packTags.map((tag) => tag.label);
  const rawTags = [...selectedTeamNames, ...starNames, ...packNames];
  const focusTags = rawTags.length
    ? [...teamTags, ...starTags, ...packTags]
    : [{ kind: "trait" as const, label: "全部未来赛程" }];
  const focusCount = rawTags.length || 1;
  const tags = rawTags.length
    ? [`已定制 ${focusCount} 项关注`, `完整 ${feed.matches.length} 场赛程`]
    : ["全部未来赛程"];
  const previewLabel = `${focusCount} 项关注 · ${feed.matches.length} 场赛程`;

  return {
    headline: "我的世界杯观赛日历",
    subtitle: "一键导入手机日历 · 北京时间自动同步",
    ownerLine: rawTags.length ? "已为你生成专属世界杯赛程日历" : "我的专属世界杯赛程日历",
    tags,
    focusTags,
    stats: [
      { value: String(feed.matches.length), label: "场赛程" },
      { value: String(focusCount), label: "项关注" },
      { value: String(days), label: "个比赛日" }
    ],
    previewLabel,
    previewNote: feed.matches.length
      ? `完整 ${feed.matches.length} 场将写入你的手机日历`
      : "筛选条件暂未匹配到赛程",
    passId: String(Math.abs(hashString(customFeedQuery(feed.options) || fallbackTitle))).slice(0, 5).padStart(5, "0")
  };
}

function posterPackLabel(pack: CustomFeedResult["options"]["packs"][number]): string {
  if (pack === "knockout") return "淘汰赛";
  if (pack === "prime") return "黄金时间";
  if (pack === "lesslate") return "少熬夜";
  return "强强对话";
}

function posterPackIcon(pack: CustomFeedResult["options"]["packs"][number]): string {
  if (pack === "knockout") return "🏆";
  if (pack === "prime") return "⏰";
  if (pack === "lesslate") return "🌙";
  return "⚔️";
}

function uniqueTeamsFromOptions(feed: CustomFeedResult): string[] {
  const teams = new Set<string>();
  for (const team of feed.options.teams) teams.add(team);
  for (const starSlug of feed.options.stars) {
    const team = STAR_PRESETS.find((star) => star.slug === starSlug)?.team;
    if (team) teams.add(team);
  }
  return [...teams].filter((team) => !isPlaceholderTeam(team));
}

function hashString(value: string): number {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) | 0;
  }
  return hash;
}

function renderSiteFooter(support: SupportConfig): string {
  return `
    <footer class="site-footer">
      <div class="footer-inner">
        ${renderFeedbackFooter()}
        <div class="footer-strip">
          <div>
            <strong>免费使用</strong>
            <p>本站面向普通球迷免费提供 2026 世界杯赛程查询和手机日历订阅服务。</p>
          </div>
          <div>
            <strong>开源仓库</strong>
            <p><a href="https://github.com/funengzhe/worldcup2026-live-calendar" target="_blank" rel="noreferrer">GitHub: funengzhe/worldcup2026-live-calendar</a></p>
          </div>
          ${renderSupportFooter(support)}
        </div>
        <div class="footer-disclaimer">
          本站为球迷自建开源项目，非 FIFA 官方服务。赛程、赛果、直播信息可能因官方调整、数据源延迟或日历客户端刷新频率产生偏差，请以 FIFA、央视等官方发布为准。
        </div>
      </div>
    </footer>
  `;
}

function renderFeedbackFooter(): string {
  return `
    <form class="feedback-card" id="feedback-form">
      <div class="feedback-intro">
        <strong>留言与反馈</strong>
        <p>发现赛程、直播链接或日历订阅问题，可以直接发给作者。联系方式仅用于必要时回复反馈。</p>
      </div>
      <div class="feedback-fields">
        <label>
          <span>类型</span>
          <select name="type" aria-label="反馈类型">
            <option value="问题反馈">问题反馈</option>
            <option value="访客留言">访客留言</option>
            <option value="功能建议">功能建议</option>
          </select>
        </label>
        <label>
          <span>昵称</span>
          <input name="name" maxlength="24" placeholder="可匿名" />
        </label>
        <label>
          <span>联系方式</span>
          <input name="contact" maxlength="80" placeholder="邮箱/微信，可选" />
        </label>
        <label class="feedback-message-field">
          <span>内容</span>
          <textarea name="message" maxlength="800" rows="1" required placeholder="说说你遇到的问题或建议"></textarea>
        </label>
        <input class="feedback-trap" name="website" tabindex="-1" autocomplete="off" />
        <button type="submit">发送反馈</button>
      </div>
      <small id="feedback-message" role="status" aria-live="polite"></small>
    </form>
  `;
}

function renderSupportFooter(support: SupportConfig): string {
  const githubUrl = "https://github.com/funengzhe/worldcup2026-live-calendar";
  const sponsorUrl = support.githubSponsorsUrl;

  return `
    <div class="support-card">
      <strong>开源与免费</strong>
      <p>本站完整免费使用，打赏完全自愿。觉得有用，可以给开源仓库点 Star，或查看源码一起改进。</p>
      <div class="support-actions">
        <a class="support-button" href="${escapeHtml(githubUrl)}" target="_blank" rel="noreferrer">GitHub Star</a>
        <a class="support-button" href="${escapeHtml(githubUrl)}" target="_blank" rel="noreferrer">查看源码</a>
        ${sponsorUrl ? `<a class="support-button" href="${escapeHtml(sponsorUrl)}" target="_blank" rel="noreferrer">开源赞助</a>` : ""}
      </div>
    </div>
  `;
}

function renderHonorGrid(sponsors: SponsorRecord[]): string {
  const paidSponsors = sponsors
    .filter((sponsor) => sponsor.status === "paid")
    .sort(compareSponsorsForHonor)
    .slice(0, 30);
  const sponsorCards = [
    ...paidSponsors.map((sponsor, index) => renderSponsorHonorCard(sponsor, index + 1)),
    ...renderMockHonorCards(paidSponsors.length, paidSponsors.length > 0)
  ];

  return `
    <div class="honor-board">
      <section class="honor-rank-panel" aria-label="赞助排名">
        <div class="honor-rank-head">
          <strong>当前排名</strong>
          <span data-honor-count>荣耀榜单实时更新</span>
        </div>
        <div class="honor-rank-list" data-honor-list>
          ${sponsorCards.join("")}
        </div>
      </section>
      <aside class="honor-sponsor-panel" aria-label="赞助支持收银台">
        ${renderSponsorCheckout()}
      </aside>
    </div>
  `;
}

function renderMockHonorCards(offset: number, afterReal = false): string[] {
  const sponsors = afterReal
    ? [
        { displayName: "绿茵同路人", amount: "1.00", paidAt: "刚刚", note: "免费也欢迎使用" },
        { displayName: "夜场看球员", amount: "1.00", paidAt: "8分钟前", note: "支持开源" },
        { displayName: "赛程收藏家", amount: "1.00", paidAt: "19分钟前", note: "订阅成功" },
        { displayName: "匿名球迷", amount: "1.00", paidAt: "32分钟前", note: "一起看球" },
        { displayName: "代码搬运工", amount: "1.00", paidAt: "1小时前", note: "持续维护" },
        { displayName: "主场观众", amount: "1.00", paidAt: "2小时前", note: "绿茵见" }
      ]
    : [
        { displayName: "绿茵守夜人", amount: "50.00", paidAt: "今天 20:26", note: "一起看球" },
        { displayName: "代码搬运工", amount: "15.00", paidAt: "2小时前", note: "支持开源" },
        { displayName: "赛程收藏家", amount: "15.00", paidAt: "昨天 23:18", note: "订阅成功" },
        { displayName: "匿名球迷", amount: "5.00", paidAt: "10分钟前", note: "先占个座" },
        { displayName: "夜场看球员", amount: "5.00", paidAt: "昨天 21:00", note: "等揭幕战" },
        { displayName: "主场观众", amount: "1.00", paidAt: "刚刚", note: "绿茵见" }
      ];
  return sponsors.map((sponsor, index) => renderSponsorHonorCard(sponsor, offset + index + 1, { demo: afterReal }));
}

function renderSponsorHonorCard(
  sponsor: Pick<SponsorRecord, "amount" | "displayName" | "paidAt"> & Partial<Pick<SponsorRecord, "note" | "createdAt">>,
  rank: number,
  options: { demo?: boolean } = {}
): string {
  const amount = normalizeDisplayAmount(sponsor.amount);
  const badge = sponsorHonorBadge(rank, Number(amount), Boolean(options.demo));
  const note = sponsor.note ? ` · ${sponsor.note}` : "";
  return `
    <article class="honor-card${badge ? " highlighted" : ""}${rank <= 3 && !options.demo ? ` rank-${rank}` : ""}${options.demo ? " demo" : ""}">
      <b>${rank.toString().padStart(2, "0")}</b>
      <div>
        <strong>${badge ? `<span class="rank-badge">${escapeHtml(badge)}</span>` : ""}${escapeHtml(sponsor.displayName || "匿名球迷")}</strong>
        <span>${escapeHtml(formatSponsorPaidAt(sponsor.paidAt ?? sponsor.createdAt ?? ""))}${escapeHtml(note)}</span>
      </div>
      <em>¥ ${escapeHtml(amount)}</em>
    </article>
  `;
}

function compareSponsorsForHonor(
  a: Pick<SponsorRecord, "amount" | "createdAt" | "paidAt">,
  b: Pick<SponsorRecord, "amount" | "createdAt" | "paidAt">
): number {
  const amountDiff = Number(b.amount) - Number(a.amount);
  if (Number.isFinite(amountDiff) && amountDiff !== 0) return amountDiff;
  return Date.parse(b.paidAt ?? b.createdAt) - Date.parse(a.paidAt ?? a.createdAt);
}

function sponsorHonorBadge(rank: number, amount: number, demo = false): string {
  if (demo) return "";
  if (rank === 1) return "头号球迷";
  if (rank === 2) return "核心球迷";
  if (rank === 3) return "助攻球迷";
  if (amount >= 50) return "荣耀球迷";
  return "";
}

function normalizeDisplayAmount(value: string): string {
  const amount = Number(value);
  return Number.isFinite(amount) ? amount.toFixed(2) : "0.00";
}

function formatSponsorPaidAt(value: string): string {
  if (!/^\d{4}-\d{2}-\d{2}T|^\d{4}-\d{2}-\d{2} /.test(value)) return value || "刚刚";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "刚刚";
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(date);
}

function renderSponsorCheckout(): string {
  return `
    <section class="sponsor-checkout" id="sponsor-checkout" aria-label="赞助支持收银台">
      <div class="sponsor-star">
        <strong>2026 绿茵星光等待点亮</strong>
        <span>支持会点亮这座星光舱，也会把你的昵称写入左侧荣耀榜单。</span>
      </div>
      <div class="sponsor-head">
        <div>
          <p class="eyebrow">Sponsor Pass</p>
          <h2>赞助支持 / 为爱发电</h2>
          <span>完全自愿。赞助会用于服务器、数据同步和开源维护；不打赏也支持你免费使用。</span>
        </div>
        <div class="alipay-trust">支付宝官方安全支付</div>
      </div>
      <div class="amount-grid" role="group" aria-label="选择赞助金额">
        <button class="amount-option active" type="button" data-sponsor-amount="5">
          <strong>¥ 5</strong>
          <span>请喝可乐</span>
        </button>
        <button class="amount-option" type="button" data-sponsor-amount="15">
          <strong>¥ 15</strong>
          <span>来杯咖啡</span>
        </button>
        <button class="amount-option premium" type="button" data-sponsor-amount="50">
          <strong>¥ 50</strong>
          <span>超级球迷</span>
        </button>
      </div>
      <label class="custom-amount">
        <span>自定义金额</span>
        <input id="sponsor-custom-amount" type="number" min="1" max="999" step="0.01" inputmode="decimal" placeholder="输入任意赞助金额" />
        <small>元</small>
      </label>
      <label class="custom-amount sponsor-name">
        <span>荣耀昵称</span>
        <input id="sponsor-display-name" type="text" maxlength="18" placeholder="匿名也可以，付款后上榜" />
        <small>可选</small>
      </label>
      <label class="custom-amount sponsor-name">
        <span>荣耀留言</span>
        <input id="sponsor-note" type="text" maxlength="36" placeholder="例如：一起看球" />
        <small>可选</small>
      </label>
      <button class="sponsor-pay-button" type="button" id="sponsor-pay-button">
        <span class="alipay-mark" aria-hidden="true">支</span>
        <span data-pay-label>立即唤起支付宝赞助</span>
      </button>
      <p class="sponsor-safe-note">资金由支付宝官方网关清算。本站不会接触你的支付密码或银行卡信息；所有赛程订阅功能保持免费开放。</p>
      <p class="sponsor-message" id="sponsor-message" role="status" aria-live="polite"></p>
    </section>
  `;
}

export function renderStatus(state: AppState): string {
  return page(
    "Status",
    `
      <main class="shell">
        <section class="hero compact">
          <div>
            <p class="eyebrow">Service Status</p>
            <h1>Calendar health</h1>
          </div>
        </section>
        <section class="grid">
          <article class="panel"><h2>Feed</h2><pre>${escapeHtml(JSON.stringify(state.publication ?? {}, null, 2))}</pre></article>
          <article class="panel"><h2>Providers</h2><pre>${escapeHtml(JSON.stringify(state.providers, null, 2))}</pre></article>
          <article class="panel"><h2>Worker</h2><p>${state.workerHeartbeatAt ? formatDate(state.workerHeartbeatAt) : "No heartbeat"}</p></article>
          <article class="panel"><h2>Sync</h2><p>Schedule: ${state.lastScheduleSyncAt ? formatDate(state.lastScheduleSyncAt) : "Never"}</p><p>Score: ${state.lastScoreSyncAt ? formatDate(state.lastScoreSyncAt) : "Never"}</p></article>
        </section>
      </main>
    `
  );
}

export function renderReadiness(readiness: ReadinessResult): string {
  return page(
    "Production Readiness",
    `
      <main class="shell">
        <section class="hero compact">
          <div>
            <p class="eyebrow">Production Readiness</p>
            <h1>${readiness.ready ? "Ready" : readiness.operational ? "Operational" : "Needs attention"}</h1>
            <p class="subtle">Operational 表示当前服务可用；Ready 表示已经达到无人值守生产标准。</p>
          </div>
        </section>
        <section class="grid">
          ${readiness.checks.map(renderReadinessCheck).join("")}
        </section>
      </main>
    `
  );
}

export function renderMatchPage(match: Match): string {
  return page(
    summary(match),
    `
      <main class="shell">
        <section class="hero compact">
          <div>
            <p class="eyebrow">Match ${match.matchNo}</p>
            <h1>${escapeHtml(summary(match))}</h1>
            <p class="subtle">${escapeHtml(venueZh(match.venue))} · ${formatBeijingDateTime(match.kickoffAtUtc)}</p>
          </div>
        </section>
        <article class="panel"><pre>${escapeHtml(JSON.stringify(match, null, 2))}</pre></article>
      </main>
    `
  );
}

function page(title: string, body: string): string {
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)}</title>
  <link rel="icon" type="image/webp" href="/assets/img/worldcup-trophy-circle-icon.webp" />
  <meta property="og:image" content="/assets/img/2026-chinese-calendar-logo.webp" />
  <style>
    :root { color-scheme:dark; --ink:#f5fff8; --muted:#98aaa0; --soft:#c7d6ce; --line:rgba(235,248,255,.12); --line-strong:rgba(235,248,255,.20); --panel:rgba(4,18,12,.68); --panel-strong:rgba(5,25,16,.86); --neon:#00ff66; --blue:#1677ff; --blue-2:#2f80ff; --silver:#dbe6ee; --pitch:#06130d; --black:#020805; }
    * { box-sizing: border-box; }
    html { scroll-behavior:smooth; }
    body { min-width:320px; margin:0; font-family:Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color:var(--ink); background:#040d08; }
    .site-bg { position:relative; isolation:isolate; min-height:100vh; overflow-x:hidden; color:#fff; background:#040d08; }
    .site-bg::before { content:""; position:fixed; inset:0; z-index:0; pointer-events:none; background-image:url("/assets/img/stadium-hero-mobile.webp"); background-size:cover; background-position:center bottom; background-repeat:no-repeat; background-attachment:scroll; transform:translateZ(0); }
    .site-overlay { position:relative; z-index:1; min-height:100vh; width:100%; background:linear-gradient(180deg, rgba(0,0,0,.10), rgba(3,12,8,.30) 34%, rgba(4,13,8,.92) 100%); }
    .topbar { position:sticky; top:0; z-index:60; min-height:62px; margin:0; display:grid; grid-template-columns:260px minmax(0, 1fr) auto; align-items:center; gap:14px; padding:0 max(18px, calc((100vw - 1240px) / 2 + 18px)); border-bottom:1px solid var(--line); background:rgba(4,13,8,.72); backdrop-filter:blur(18px); box-shadow:0 14px 40px rgba(0,0,0,.36); }
    .brand { display:flex; align-items:center; color:#fff; text-decoration:none; min-width:0; }
    .brand-icon { display:block; width:36px; height:36px; object-fit:contain; filter:drop-shadow(0 0 10px rgba(0,255,102,.22)); animation:brandSpin 34s linear infinite; }
    .brand-logo { display:none; width:auto; height:34px; max-width:260px; object-fit:contain; filter:drop-shadow(0 0 10px rgba(0,255,102,.14)); transition:transform .2s ease; }
    .brand:hover .brand-logo { transform:scale(1.01); }
    @keyframes brandSpin { to { transform:rotate(360deg); } }
    @keyframes pulseGlow { 0%, 100% { opacity:.62; box-shadow:0 0 0 rgba(0,255,102,0); } 50% { opacity:1; box-shadow:0 0 18px rgba(0,255,102,.45); } }
    @keyframes checkoutAura { 0%, 100% { opacity:.42; box-shadow:0 0 18px rgba(0,255,102,.12), 0 0 38px rgba(0,255,102,.06), inset 0 0 22px rgba(0,255,102,.035); } 50% { opacity:1; box-shadow:0 0 28px rgba(0,255,102,.50), 0 0 72px rgba(0,255,102,.24), inset 0 0 46px rgba(0,255,102,.10); } }
    @keyframes nudgeDown { 0%, 100% { transform:translateY(0); opacity:.45; } 50% { transform:translateY(8px); opacity:1; } }
    @keyframes trophyFloat { 0%, 100% { transform:translate3d(0, 0, 0); } 50% { transform:translate3d(0, -16px, 0); } }
    @media (min-width:768px) {
      .site-bg::before { background-image:url("/assets/img/stadium-hero-pc.webp"); background-position:center; background-attachment:fixed; }
      .brand-icon { display:none; }
      .brand-logo { display:block; }
    }
    .topnav { height:58px; display:flex; justify-content:center; min-width:0; overflow:auto; scrollbar-width:none; }
    .topnav a { min-width:84px; height:58px; display:inline-flex; align-items:center; justify-content:center; color:#d9e6df; text-decoration:none; font-weight:850; font-size:14px; border-left:1px solid rgba(255,255,255,.06); transition:color .18s ease, background .18s ease; }
    .topnav a:last-child { border-right:1px solid rgba(255,255,255,.06); }
    .topnav a:hover { color:#fff; background:rgba(47,128,255,.12); }
    .login-pill { min-height:34px; display:inline-flex; align-items:center; justify-content:center; padding:0 15px; border:1px solid rgba(0,255,102,.45); border-radius:999px; color:var(--neon); text-decoration:none; font-weight:950; font-size:13px; background:rgba(0,255,102,.08); }
    .screen { position:relative; min-height:calc(100dvh - 62px); padding:78px max(18px, calc((100vw - 1240px) / 2 + 18px)); }
    .flow-screen { background:linear-gradient(180deg, transparent, rgba(0,0,0,.18) 42%, transparent); isolation:isolate; }
    .flow-screen::before,
    .flow-screen::after { content:""; position:absolute; left:0; right:0; height:140px; pointer-events:none; z-index:0; }
    .flow-screen::before { top:-70px; background:linear-gradient(180deg, transparent, rgba(4,13,8,.45), transparent); filter:blur(18px); }
    .flow-screen::after { bottom:-70px; background:linear-gradient(180deg, transparent, rgba(0,255,102,.055), transparent); filter:blur(22px); }
    .screen-inner { position:relative; z-index:2; max-width:1240px; margin:0 auto; }
    .wechat-tip { position:fixed; left:50%; top:78px; z-index:80; width:min(720px, calc(100vw - 28px)); transform:translateX(-50%); padding:14px 16px; border:1px solid rgba(0,255,102,.32); border-radius:16px; background:rgba(3,16,10,.88); backdrop-filter:blur(16px); box-shadow:0 16px 40px rgba(0,0,0,.34), inset 0 0 20px rgba(0,255,102,.06); color:#dff7e6; }
    .wechat-tip[hidden] { display:none; }
    .wechat-tip strong { display:block; color:var(--neon); font-size:15px; margin-bottom:6px; }
    .wechat-tip span { display:block; color:#b9cbbf; font-size:13px; line-height:1.65; }
    .payment-toast { position:fixed; left:50%; top:78px; z-index:90; width:min(520px, calc(100vw - 28px)); transform:translateX(-50%); display:grid; gap:5px; padding:14px 16px; border:1px solid rgba(0,255,102,.38); border-radius:16px; background:rgba(3,18,11,.92); backdrop-filter:blur(16px); box-shadow:0 18px 48px rgba(0,0,0,.38), inset 0 0 18px rgba(0,255,102,.06); color:#dff7e6; transition:opacity .28s ease, transform .28s ease; }
    .payment-toast strong { color:var(--neon); font-size:15px; }
    .payment-toast span { color:#b9cbbf; font-size:12px; line-height:1.55; }
    .payment-toast.is-hiding { opacity:0; transform:translate(-50%, -8px); }
    .hero-screen { display:grid; align-items:start; overflow:hidden; padding-top:0; padding-bottom:0; min-height:calc(100dvh - 62px); height:calc(100dvh - 62px); }
    .hero-screen::after { content:""; position:absolute; inset:auto 0 0; height:48%; background:linear-gradient(180deg, transparent, rgba(0,0,0,.42)); pointer-events:none; z-index:0; }
    .hero-composition { height:calc(100dvh - 62px); display:grid; grid-template-rows:minmax(0, 1fr) auto; justify-items:start; align-content:stretch; gap:22px; text-align:left; width:100%; padding-top:clamp(48px, 8vh, 88px); padding-bottom:128px; }
    .hero-trophy { position:absolute; right:max(4px, calc((100vw - 1240px) / 2 + 4px)); bottom:34px; width:min(27vw, 398px); max-height:calc(100dvh - 112px); height:auto; opacity:.76; filter:saturate(.72) contrast(1.02) brightness(.84) drop-shadow(0 34px 72px rgba(0,0,0,.70)); mix-blend-mode:screen; mask-image:radial-gradient(ellipse at center, #000 0 58%, rgba(0,0,0,.88) 72%, transparent 100%); pointer-events:none; z-index:1; animation:trophyFloat 6s ease-in-out infinite; }
    .hero-copy { position:relative; z-index:3; display:grid; justify-items:start; max-width:min(68vw, 900px); }
    h1 { margin:0; max-width:none; font-size:clamp(44px, 4.65vw, 72px); line-height:.98; letter-spacing:0; font-weight:1000; color:#fff; white-space:nowrap; text-shadow:0 3px 0 rgba(0,0,0,.34), 0 0 34px rgba(255,255,255,.16); }
    h2 { margin:0; font-size:clamp(26px, 3.2vw, 44px); line-height:1.08; color:#fff; }
    .eyebrow { margin:0 0 10px; color:#dfe9ef; text-transform:uppercase; font-size:12px; font-weight:950; letter-spacing:.08em; }
    .live-eyebrow { display:inline-flex; align-items:center; gap:9px; color:var(--neon); }
    .live-eyebrow span { width:10px; height:10px; border-radius:50%; background:var(--neon); animation:pulseGlow 1.8s ease-in-out infinite; }
    .hero-subtitle { margin:18px 0 0; color:#d7e7de; font-size:clamp(16px, 1.6vw, 22px); font-weight:900; text-shadow:0 0 22px rgba(0,0,0,.54); }
    .hero-bullets { display:grid; gap:10px; margin-top:26px; max-width:540px; }
    .hero-bullets span { position:relative; min-height:30px; display:flex; align-items:center; padding-left:24px; color:var(--neon); font-size:clamp(15px, 1.25vw, 18px); font-weight:950; text-shadow:0 0 14px rgba(0,255,102,.24); }
    .hero-bullets span::before { content:""; position:absolute; left:0; width:9px; height:9px; border-radius:50%; background:var(--neon); box-shadow:0 0 16px rgba(0,255,102,.48); }
    .hero-console { position:relative; z-index:4; width:min(1240px, 100%); display:grid; grid-template-columns:140px minmax(230px, 300px) minmax(420px, 1fr); gap:12px; align-items:center; padding:14px; border:1px solid rgba(235,248,255,.18); border-radius:24px; background:linear-gradient(90deg, rgba(235,248,255,.12), rgba(3,16,10,.54), rgba(235,248,255,.075)); backdrop-filter:blur(20px); box-shadow:0 30px 92px rgba(0,0,0,.36), inset 0 0 0 1px rgba(255,255,255,.05); }
    .qr-token { width:132px; aspect-ratio:1; display:grid; place-items:center; border-radius:24px; background:rgba(255,255,255,.09); box-shadow:0 0 34px rgba(0,255,102,.16), inset 0 0 28px rgba(255,255,255,.04); }
    .qr { position:relative; width:108px; height:108px; padding:6px; border-radius:15px; background:rgba(255,255,255,.96); overflow:hidden; }
    .qr svg { width:100%; height:100%; display:block; }
    .copy-row { display:grid; grid-template-columns:minmax(0, 1fr) 82px; gap:10px; }
    .copy-row input { min-width:0; height:50px; border:1px solid var(--line); border-radius:14px; padding:0 15px; color:#d9eee0; background:rgba(0,0,0,.38); font:14px/1.2 "SFMono-Regular", Consolas, monospace; }
    .copy-row button, .hero-actions button, .guide-actions button { min-height:50px; border:1px solid rgba(0,255,102,.42); border-radius:14px; background:rgba(0,255,102,.11); color:var(--neon); font-weight:950; cursor:pointer; }
    .hero-actions, .hero-link-stack { display:grid; grid-template-columns:1fr; grid-template-rows:50px 42px; gap:8px; min-width:0; }
    .hero-actions button { display:flex; }
    .hero-actions a, .hero-actions button, .guide-actions a, .guide-actions button { min-height:50px; display:flex; align-items:center; justify-content:center; padding:0 16px; text-align:center; text-decoration:none; font-size:14px; font-weight:1000; }
    .mobile-primary, .neon-link { border:1px solid transparent; border-radius:12px; background:linear-gradient(180deg, #00ff66, #00d957); color:#031007; box-shadow:0 0 18px rgba(0,255,102,.18); }
    .hero-bottom-board { position:absolute; left:0; right:0; bottom:34px; z-index:2; display:grid; grid-template-columns:repeat(4, minmax(0, 1fr)); max-width:100%; border-top:1px solid var(--line); border-bottom:1px solid var(--line); background:rgba(2,8,5,.62); backdrop-filter:blur(15px); box-shadow:0 -18px 52px rgba(0,0,0,.30), inset 0 0 30px rgba(0,255,102,.035); }
    .led-board { display:grid; grid-template-columns:repeat(4, minmax(0, 1fr)); gap:0; overflow:hidden; }
    .led-stat { min-height:92px; display:flex; flex-direction:column; align-items:center; justify-content:center; border-left:1px solid rgba(255,255,255,.08); position:relative; }
    .led-stat:first-child { border-left:0; }
    .led-stat strong { font-family:"SFMono-Regular", Consolas, "Liberation Mono", monospace; color:var(--neon); font-size:clamp(34px, 4vw, 48px); line-height:1; letter-spacing:1px; text-shadow:0 0 9px rgba(0,255,102,.5), 0 0 24px rgba(0,255,102,.20); }
    .led-stat span { margin-top:9px; color:#a7bab0; font-size:13px; font-weight:850; }
    .led-icon { display:none; }
    .scroll-cue { position:absolute; left:50%; bottom:4px; z-index:3; transform:translateX(-50%); width:28px; height:28px; display:grid; place-items:center; color:var(--neon); text-decoration:none; border-radius:50%; border:1px solid rgba(0,255,102,.28); background:rgba(0,0,0,.28); animation:nudgeDown 1.8s ease-in-out infinite; }
    .screen-heading { max-width:1240px; margin:0 auto 18px; }
    .screen-heading h2 { font-size:clamp(28px, 4vw, 54px); }
    .sync-status { margin-top:16px; display:flex; flex-wrap:wrap; align-items:center; gap:9px; color:#a8b9ad; font-size:12px; font-weight:850; }
    .sync-status span, .sync-status em { min-height:32px; display:inline-flex; align-items:center; padding:0 12px; border:1px solid rgba(255,255,255,.08); border-radius:999px; background:rgba(0,0,0,.20); font-style:normal; }
    .sync-status span:first-child { color:var(--neon); border-color:rgba(0,255,102,.22); background:rgba(0,255,102,.075); }
    .sync-status b { width:7px; height:7px; margin-right:8px; border-radius:50%; background:var(--neon); box-shadow:0 0 12px rgba(0,255,102,.48); animation:pulseGlow 1.8s ease-in-out infinite; }
    .sync-status em { color:#8fa49a; }
    .hero-sync-status { width:100%; min-width:0; margin-top:0; display:grid; grid-template-columns:max-content max-content max-content minmax(0, 1fr); align-items:center; gap:6px; overflow:hidden; }
    .hero-sync-status span, .hero-sync-status em { min-width:0; min-height:42px; padding:0 10px; background:rgba(0,0,0,.26); backdrop-filter:blur(10px); font-size:11px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
    .hero-sync-status span:first-child { position:relative; overflow:hidden; color:var(--neon); border-color:rgba(0,255,102,.44); background:linear-gradient(180deg, rgba(0,255,102,.14), rgba(0,255,102,.06)); font-size:12px; box-shadow:0 0 18px rgba(0,255,102,.18), inset 0 0 22px rgba(0,255,102,.055); }
    .hero-sync-status span:first-child::after { content:""; position:absolute; inset:-1px; border-radius:inherit; border:1px solid rgba(0,255,102,.42); box-shadow:0 0 20px rgba(0,255,102,.24); animation:checkoutAura 3.2s ease-in-out infinite; pointer-events:none; }
    .schedule-screen { padding-top:74px; }
    .schedule-tabs { display:grid; grid-template-columns:repeat(4, minmax(0, 1fr)); min-height:54px; max-width:1240px; margin:0 auto 12px; border:1px solid var(--line); border-radius:18px; background:rgba(2,8,5,.74); backdrop-filter:blur(14px); overflow:hidden; box-shadow:0 16px 40px rgba(0,0,0,.34); }
    .schedule-tabs button { appearance:none; border:0; border-left:1px solid rgba(255,255,255,.08); background:transparent; display:flex; align-items:center; justify-content:center; color:#f5fff7; text-decoration:none; font:950 15px/1.2 inherit; cursor:pointer; }
    .schedule-tabs button:first-child { border-left:0; }
    .schedule-tabs button.active { color:#fff; box-shadow:inset 0 -2px 0 var(--blue); background:linear-gradient(180deg, rgba(47,128,255,.12), rgba(47,128,255,.04)); }
    .date-picker { position:sticky; top:62px; z-index:45; max-width:1240px; margin:0 auto 18px; padding:12px 4px; border:1px solid var(--line); border-radius:18px; background:rgba(3,14,9,.78); backdrop-filter:blur(16px); overflow-x:auto; scrollbar-width:none; scroll-behavior:smooth; }
    .date-track { display:flex; align-items:center; gap:10px; min-width:max-content; }
    .date-item { flex:0 0 auto; width:70px; height:70px; border:1px solid rgba(255,255,255,.09); border-radius:15px; background:rgba(255,255,255,.045); color:#9bad9f; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:3px; font:850 12px/1 inherit; cursor:pointer; transition:background .2s ease, color .2s ease, border-color .2s ease; }
    .date-item:hover { color:#fff; background:rgba(255,255,255,.09); }
    .date-item.active { border-color:rgba(0,255,102,.35); background:rgba(0,255,102,.16); color:var(--neon); box-shadow:0 0 15px rgba(0,255,102,.22), inset 0 0 16px rgba(0,255,102,.08); }
    .date-item span:first-child { font-size:10px; opacity:.82; }
    .date-item strong { font:950 14px/1 "SFMono-Regular", Consolas, monospace; }
    .date-item small { min-height:13px; color:inherit; opacity:.72; font-size:9px; }
    .schedule-summary { max-width:1240px; margin:0 auto 12px; display:grid; grid-template-columns:auto auto minmax(0, 1fr); align-items:center; gap:12px; min-height:42px; color:#a8b9ad; font-size:13px; }
    .schedule-summary span { min-width:max-content; }
    .schedule-summary strong { min-width:max-content; color:#e6eef2; font-size:15px; }
    .schedule-summary em { min-width:0; color:#83a890; font-style:normal; text-align:right; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
    #schedule-panel { max-width:1240px; margin:0 auto; display:grid; gap:10px; }
    #schedule-panel[hidden] { display:none; }
    .day-group { display:grid; grid-template-columns:158px minmax(0, 1fr); gap:0; margin-bottom:10px; }
    .day-heading { padding:18px 16px; border:1px solid var(--line); border-right:0; border-radius:16px 0 0 16px; background:rgba(5,22,14,.72); color:#e6eef2; font-weight:950; line-height:1.35; }
    .day-heading span { display:block; margin-top:5px; color:#91a79a; font-size:12px; }
    .day-matches { display:grid; gap:8px; }
    .match-row { min-height:76px; display:grid; grid-template-columns:112px minmax(0, 1fr) minmax(330px, 380px); align-items:center; gap:16px; padding:11px 16px 11px 20px; border:1px solid var(--line); border-radius:999px; background:rgba(6,22,14,.62); backdrop-filter:blur(12px); box-shadow:inset 0 0 22px rgba(0,0,0,.25); transition:border-color .2s ease, background .2s ease, transform .2s ease; }
    .match-row:hover { border-color:rgba(0,255,102,.28); background:rgba(7,28,17,.78); transform:translateY(-1px); }
    .match-time { color:#fff; font:950 19px/1 "SFMono-Regular", Consolas, monospace; }
    .match-no { margin-top:6px; color:#82978a; font-size:11px; font-weight:850; }
    .match-core { min-width:0; display:grid; grid-template-columns:minmax(170px, 1fr) 108px minmax(170px, 1fr); gap:16px; align-items:center; }
    .team { min-width:0; display:flex; align-items:center; gap:13px; color:#f8fff9; font-size:19px; font-weight:1000; }
    .team.home { justify-content:flex-end; text-align:right; }
    .team.away { justify-content:flex-start; }
    .team-name { min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
    .team-flag { flex:0 0 auto; min-width:58px; height:38px; display:inline-flex; align-items:center; justify-content:center; border-radius:6px; background:rgba(255,255,255,.08); box-shadow:0 0 0 1px rgba(255,255,255,.18), 0 9px 16px rgba(0,0,0,.28); font-size:36px; line-height:1; }
    .score-stack { min-width:0; display:grid; justify-items:center; gap:6px; }
    .score-box { width:108px; min-height:38px; display:flex; align-items:center; justify-content:center; border:1px solid rgba(255,255,255,.14); border-radius:999px; background:rgba(0,0,0,.42); color:var(--neon); font:1000 21px/1 "SFMono-Regular", Consolas, monospace; letter-spacing:.08em; text-shadow:0 0 9px rgba(0,255,102,.36); }
    .status { display:inline-flex; align-items:center; justify-content:center; min-height:23px; padding:0 9px; border-radius:999px; font-size:11px; font-weight:950; border:1px solid rgba(255,255,255,.13); color:#b7c8bc; background:rgba(255,255,255,.06); white-space:nowrap; }
    .status.live, .status.halftime { border-color:rgba(47,128,255,.50); background:rgba(47,128,255,.20); color:#d9eaff; }
    .status.final { border-color:rgba(0,255,102,.28); background:rgba(0,0,0,.38); color:#c8f7d2; }
    .match-side { min-width:0; display:grid; grid-template-columns:minmax(0, 1fr) 148px; align-items:center; gap:14px; }
    .venue { min-width:0; color:#aebfb4; font-size:12px; line-height:1.32; text-align:left; white-space:normal; overflow:visible; text-overflow:clip; }
    .watch-links { display:flex; justify-content:flex-end; min-width:0; }
    .watch-links a { width:148px; min-height:40px; display:inline-flex; align-items:center; justify-content:center; gap:6px; padding:0 14px; border:1px solid rgba(0,255,102,.30); border-radius:999px; color:#031007; background:var(--neon); text-decoration:none; font-size:12px; line-height:1; font-weight:1000; white-space:nowrap; box-shadow:0 0 12px rgba(0,255,102,.18); }
    .watch-links a.replay { border-color:rgba(47,128,255,.36); color:#eaf3ff; background:linear-gradient(180deg, rgba(47,128,255,.98), rgba(22,98,214,.98)); box-shadow:0 0 14px rgba(47,128,255,.22); }
    .watch-links a.live { border-color:rgba(0,255,102,.34); color:#031007; background:var(--neon); box-shadow:0 0 12px rgba(0,255,102,.18); }
    .watch-links a::before { content:"▶"; font-size:10px; }
    .match-meta { margin-top:6px; color:#708579; font-size:10px; font-weight:850; }
    .empty-state { max-width:1240px; margin:0 auto; border:1px solid var(--line); border-radius:18px; padding:20px; background:rgba(5,16,10,.74); backdrop-filter:blur(12px); color:#9fb2a5; text-align:center; }
    .empty-state[hidden] { display:none; }
    .guide-screen, .sponsor-screen, .honor-screen { display:grid; align-items:center; }
    .guide-panel, .honor-panel { width:min(1240px, 100%); margin:0 auto; border:1px solid var(--line); border-radius:26px; padding:34px; background:rgba(5,18,12,.70); backdrop-filter:blur(18px); box-shadow:0 28px 80px rgba(0,0,0,.36), inset 0 0 0 1px rgba(255,255,255,.035); }
    .guide-title p:not(.eyebrow), .honor-title p { max-width:780px; color:#aebfb4; font-size:15px; line-height:1.65; }
    .honor-rules { display:flex; flex-wrap:wrap; align-items:center; gap:10px; margin-top:18px; }
    .honor-rules span { width:max-content; max-width:100%; min-height:42px; display:flex; align-items:center; padding:10px 12px 10px 26px; position:relative; border:1px solid rgba(255,255,255,.08); border-radius:14px; background:rgba(0,0,0,.16); color:#c6d6ce; font-size:12px; font-weight:900; line-height:1.35; white-space:nowrap; }
    .honor-rules span::before { content:""; position:absolute; left:12px; width:7px; height:7px; border-radius:50%; background:var(--neon); box-shadow:0 0 12px rgba(0,255,102,.35); }
    .guide-grid { display:grid; grid-template-columns:repeat(4, minmax(0, 1fr)); gap:14px; margin-top:28px; }
    .guide-grid article { min-height:190px; padding:20px; border:1px solid var(--line); border-radius:18px; background:rgba(0,0,0,.20); }
    .guide-grid strong { display:block; color:#fff; font-size:18px; margin-bottom:12px; }
    .guide-grid span { display:block; color:#aebfb4; font-size:14px; line-height:1.7; }
    .guide-actions { display:flex; flex-wrap:wrap; gap:10px; margin-top:22px; }
    .device-guides { display:grid; grid-template-columns:repeat(3, minmax(0, 1fr)); gap:12px; margin-top:18px; }
    .device-guides article { min-height:132px; padding:18px; border:1px solid rgba(47,128,255,.18); border-radius:18px; background:linear-gradient(180deg, rgba(47,128,255,.09), rgba(0,0,0,.16)); }
    .device-guides strong { display:block; color:#eaf3ff; font-size:16px; margin-bottom:10px; }
    .device-guides span { display:block; color:#aebfb4; font-size:13px; line-height:1.68; }
    .guide-steps { display:grid; grid-template-columns:repeat(3, minmax(0, 1fr)); gap:18px; margin-top:38px; padding-top:28px; border-top:1px solid rgba(255,255,255,.08); }
    .guide-steps div { position:relative; min-height:148px; display:grid; grid-template-rows:86px 30px minmax(42px, auto); align-items:start; justify-items:center; gap:10px; text-align:center; }
    .guide-steps div:not(:last-child)::after { content:""; position:absolute; top:54px; left:calc(50% + 42px); width:calc(100% - 84px); height:2px; background:linear-gradient(90deg, rgba(0,255,102,.42), rgba(0,255,102,.08)); }
    .guide-steps strong { position:relative; align-self:start; color:rgba(0,255,102,.13); font:1000 68px/1 "SFMono-Regular", Consolas, monospace; letter-spacing:0; }
    .guide-steps span { position:relative; align-self:center; display:flex; align-items:center; justify-content:center; min-height:30px; color:#fff; font-size:18px; font-weight:1000; }
    .guide-steps p { position:relative; max-width:260px; margin:0; color:#83a890; font-size:13px; line-height:1.6; }
    .blue-link { border:1px solid rgba(47,128,255,.38); border-radius:12px; background:rgba(47,128,255,.14); color:#d9eaff; }
    .sync-note { margin:16px auto 0; color:#91a79a; font-size:13px; line-height:1.6; text-align:center; }
    .calendar-diagnosis { margin:14px auto 0; display:grid; gap:5px; max-width:860px; padding:13px 16px; border:1px solid rgba(47,128,255,.20); border-radius:16px; background:linear-gradient(90deg, rgba(47,128,255,.10), rgba(0,255,102,.055)); color:#b9cbc0; text-align:center; }
    .calendar-diagnosis strong { color:#eaf6f0; font-size:13px; }
    .calendar-diagnosis span { font-size:12px; line-height:1.65; }
    .sponsor-stage { width:min(1100px, 100%); margin:0 auto; display:grid; grid-template-columns:minmax(360px, 1fr) minmax(360px, 450px); gap:22px; align-items:stretch; justify-content:center; }
    .sponsor-progress { position:relative; min-height:401px; padding:28px; border:1px solid var(--line); border-radius:24px; background:linear-gradient(180deg, rgba(215,233,242,.09), rgba(3,16,10,.62)); backdrop-filter:blur(18px); box-shadow:0 28px 82px rgba(0,0,0,.34), inset 0 0 0 1px rgba(255,255,255,.035); overflow:hidden; }
    .sponsor-progress::before { content:""; position:absolute; left:8%; right:8%; top:0; height:1px; background:linear-gradient(90deg, transparent, rgba(0,255,102,.62), transparent); }
    .sponsor-progress h2 { max-width:460px; }
    .progress-meter { position:relative; height:12px; margin:42px 0 16px; border:1px solid rgba(255,255,255,.12); border-radius:999px; background:rgba(0,0,0,.34); overflow:hidden; box-shadow:inset 0 0 18px rgba(0,0,0,.42); }
    .progress-meter-fill { width:85%; height:100%; border-radius:999px; background:linear-gradient(90deg, rgba(0,255,102,.55), #00ff66); box-shadow:0 0 18px rgba(0,255,102,.42); }
    .progress-row { display:flex; align-items:baseline; justify-content:space-between; gap:18px; padding-bottom:22px; border-bottom:1px solid rgba(255,255,255,.08); }
    .progress-row strong { color:var(--neon); font:1000 52px/1 "SFMono-Regular", Consolas, monospace; text-shadow:0 0 22px rgba(0,255,102,.28); }
    .progress-row span { color:#c0cec6; font-size:14px; font-weight:900; text-align:right; }
    .sponsor-privileges { display:grid; gap:12px; margin-top:24px; color:#aebfb4; font:850 13px/1.3 "SFMono-Regular", Consolas, monospace; }
    .sponsor-privileges span { position:relative; padding-left:18px; }
    .sponsor-privileges span::before { content:""; position:absolute; left:0; top:.45em; width:6px; height:6px; border-radius:50%; background:var(--neon); box-shadow:0 0 10px rgba(0,255,102,.4); }
    .sponsor-checkout { position:relative; isolation:isolate; width:100%; min-height:100%; display:grid; align-content:start; padding:24px; border:1px solid rgba(0,255,102,.24); border-radius:24px; background:radial-gradient(circle at 88% 0%, rgba(0,255,102,.14), transparent 32%), linear-gradient(180deg, rgba(0,255,102,.09), rgba(215,233,242,.08) 34%, rgba(3,16,10,.70)); backdrop-filter:blur(18px); box-shadow:0 28px 82px rgba(0,0,0,.38), 0 0 32px rgba(0,255,102,.14), inset 0 0 0 1px rgba(255,255,255,.04); overflow:visible; }
    .sponsor-checkout::before { content:""; position:absolute; inset:-2px; z-index:0; border-radius:26px; border:1px solid rgba(0,255,102,.46); background:linear-gradient(180deg, rgba(0,255,102,.045), transparent 42%, rgba(0,255,102,.025)); pointer-events:none; animation:checkoutAura 3.2s ease-in-out infinite; }
    .sponsor-checkout::after { content:""; position:absolute; z-index:0; left:8%; right:8%; top:0; height:1px; background:linear-gradient(90deg, transparent, rgba(0,255,102,.86), transparent); pointer-events:none; }
    .sponsor-checkout > * { position:relative; z-index:1; }
    .sponsor-star { min-height:142px; display:grid; align-content:center; justify-items:center; gap:12px; padding:10px 8px 22px; text-align:center; }
    .sponsor-star strong { max-width:360px; color:#e6eef2; font-size:clamp(26px, 3vw, 42px); line-height:1.08; }
    .sponsor-star span { max-width:360px; color:#9fb2a5; font-size:13px; line-height:1.6; }
    .sponsor-head { display:flex; align-items:flex-start; justify-content:space-between; gap:12px; padding-bottom:12px; margin-bottom:14px; border-bottom:1px solid rgba(255,255,255,.09); }
    .sponsor-head h2 { color:#fff; font-size:17px; line-height:1.2; }
    .sponsor-head span { display:block; margin-top:6px; color:#94a89a; font-size:12px; line-height:1.5; }
    .alipay-trust { flex:0 0 auto; min-height:24px; display:inline-flex; align-items:center; padding:0 8px; border:1px solid rgba(22,119,255,.28); border-radius:8px; background:rgba(22,119,255,.12); color:#5ca1ff; font-size:10px; font-weight:1000; white-space:nowrap; }
    .amount-grid { display:grid; grid-template-columns:repeat(3, minmax(0, 1fr)); gap:9px; margin-bottom:12px; }
    .amount-option { min-height:66px; display:flex; flex-direction:column; align-items:center; justify-content:center; border:1px solid rgba(255,255,255,.11); border-radius:14px; background:rgba(0,0,0,.28); color:#dbe8df; cursor:pointer; transition:border-color .18s ease, background .18s ease, transform .18s ease, box-shadow .18s ease; }
    .amount-option:hover { border-color:rgba(255,255,255,.22); transform:translateY(-1px); }
    .amount-option strong { font:1000 15px/1 "SFMono-Regular", Consolas, monospace; }
    .amount-option span { margin-top:6px; color:#7f9388; font-size:10px; font-weight:900; }
    .amount-option.active { border-color:rgba(0,255,102,.75); background:rgba(0,255,102,.10); color:var(--neon); box-shadow:0 0 16px rgba(0,255,102,.12); }
    .amount-option.premium.active { border-color:rgba(47,128,255,.62); background:rgba(47,128,255,.14); color:#d9eaff; box-shadow:0 0 16px rgba(47,128,255,.13); }
    .custom-amount { min-height:44px; display:grid; grid-template-columns:auto minmax(0, 1fr) auto; gap:8px; align-items:center; margin-bottom:13px; padding:0 11px; border:1px solid rgba(255,255,255,.10); border-radius:14px; background:rgba(0,0,0,.34); transition:border-color .18s ease; }
    .custom-amount:focus-within { border-color:rgba(0,255,102,.45); }
    .custom-amount span, .custom-amount small { color:#7f9388; font-size:12px; font-weight:900; }
    .custom-amount input { min-width:0; height:42px; border:0; outline:0; background:transparent; color:#fff; font:900 13px/1 "SFMono-Regular", Consolas, monospace; }
    .custom-amount input::placeholder { color:#5d6e64; }
    .sponsor-pay-button { width:100%; min-height:46px; display:flex; align-items:center; justify-content:center; gap:9px; border:0; border-radius:14px; background:#1677ff; color:#fff; font:1000 14px/1.2 inherit; cursor:pointer; box-shadow:0 0 18px rgba(22,119,255,.28); transition:transform .18s ease, background .18s ease, opacity .18s ease; }
    .sponsor-pay-button:hover { background:#0f66df; }
    .sponsor-pay-button:active { transform:scale(.98); }
    .sponsor-pay-button[disabled] { opacity:.62; cursor:not-allowed; transform:none; }
    .alipay-mark { width:20px; height:20px; display:inline-flex; align-items:center; justify-content:center; border-radius:6px; background:rgba(255,255,255,.18); color:#fff; font-size:13px; font-weight:1000; }
    .sponsor-safe-note { margin:10px 0 0; color:#75887d; text-align:center; font-size:11px; line-height:1.5; }
    .sponsor-message { min-height:18px; margin:8px 0 0; color:#aebfb4; text-align:center; font-size:12px; line-height:1.45; }
    .sponsor-message.error { color:#ffb4a8; }
    .sponsor-message.success { color:var(--neon); }
    .honor-board { display:grid; grid-template-columns:minmax(460px, 1.08fr) minmax(360px, .92fr); gap:18px; margin-top:26px; align-items:stretch; }
    .honor-rank-panel, .honor-card, .honor-empty, .honor-sponsor-panel, .support-card, .feedback-card, .footer-strip > div { padding:16px; border:1px solid var(--line); border-radius:16px; background:rgba(0,0,0,.18); }
    .honor-rank-panel { min-height:360px; display:grid; grid-template-rows:auto minmax(0, 1fr); gap:12px; overflow:hidden; }
    .honor-rank-head { display:flex; justify-content:space-between; align-items:center; gap:12px; padding-bottom:12px; border-bottom:1px solid rgba(255,255,255,.08); }
    .honor-rank-head strong { color:#fff; font-size:16px; }
    .honor-rank-head span { color:#84978b; font-size:12px; font-weight:900; }
    .honor-rank-list { max-height:620px; overflow:auto; display:grid; gap:10px; padding-right:4px; scrollbar-width:thin; scrollbar-color:rgba(0,255,102,.35) rgba(255,255,255,.06); }
    .honor-card { min-height:76px; display:grid; grid-template-columns:42px minmax(0, 1fr) auto; align-items:center; gap:12px; }
    .honor-card b { color:rgba(219,230,238,.42); font:1000 18px/1 "SFMono-Regular", Consolas, monospace; }
    .honor-card strong { display:flex; align-items:center; gap:8px; color:#fff; font-size:15px; }
    .honor-card span { display:block; margin-top:7px; color:#84978b; font:850 11px/1 "SFMono-Regular", Consolas, monospace; }
    .honor-card em { flex:0 0 auto; color:#dfe9ef; font:1000 18px/1 "SFMono-Regular", Consolas, monospace; font-style:normal; }
    .honor-card.highlighted { border-color:rgba(0,255,102,.30); background:rgba(0,255,102,.07); }
    .honor-card.rank-1 { border-color:rgba(0,255,102,.44); background:linear-gradient(90deg, rgba(0,255,102,.10), rgba(47,128,255,.08)); }
    .honor-card.rank-2 { border-color:rgba(219,230,238,.28); background:rgba(219,230,238,.055); }
    .honor-card.rank-3 { border-color:rgba(47,128,255,.30); background:rgba(47,128,255,.07); }
    .honor-card.highlighted em { color:var(--neon); animation:pulseGlow 2.2s ease-in-out infinite; }
    .honor-card.demo { opacity:.68; }
    .honor-card.demo em { color:#9fb2a5; animation:none; }
    .rank-badge { display:inline-flex !important; align-items:center; min-height:18px; margin-top:0 !important; padding:0 7px; border:1px solid rgba(235,248,255,.32); border-radius:999px; color:#dfe9ef !important; background:linear-gradient(180deg, rgba(255,255,255,.13), rgba(255,255,255,.035)); font:1000 10px/1 "SFMono-Regular", Consolas, monospace !important; }
    .honor-sponsor-panel { display:block; padding:0; border:0; background:transparent; }
    .honor-sponsor-panel .sponsor-checkout { height:100%; }
    .honor-empty { min-height:360px; display:grid; align-content:center; justify-items:center; gap:12px; color:#e6eef2; text-align:center; animation:pulseGlow 3s ease-in-out infinite; }
    .honor-sponsor-panel .honor-empty { min-height:148px; padding:20px; }
    .honor-empty strong { max-width:360px; font-size:clamp(26px, 3vw, 42px); line-height:1.08; }
    .honor-empty span { color:#9fb2a5; }
    .honor-empty button { min-height:40px; padding:0 18px; border:1px solid rgba(0,255,102,.42); border-radius:999px; background:rgba(0,255,102,.12); color:var(--neon); font-weight:1000; cursor:pointer; }
    .site-footer { position:relative; padding:34px max(18px, calc((100vw - 1240px) / 2 + 18px)) 54px; background:linear-gradient(180deg, transparent, rgba(0,0,0,.24)); }
    .footer-inner { max-width:1240px; margin:0 auto; display:grid; gap:14px; color:#aebfb4; }
    .footer-strip { display:grid; grid-template-columns:1fr 1fr 1.2fr; gap:14px; color:#aebfb4; }
    .footer-strip strong { color:#fff; font-size:15px; }
    .footer-strip p { margin:8px 0 0; color:#9fb2a5; font-size:13px; line-height:1.6; }
    .footer-strip a { color:var(--neon); text-decoration:none; font-weight:900; overflow-wrap:anywhere; }
    .support-card { position:relative; min-height:142px; overflow:hidden; }
    .support-card > * { position:relative; }
    .support-card p { margin:8px 0 12px; }
    .support-actions { display:flex; flex-wrap:wrap; gap:8px; align-items:center; }
    .support-button { min-height:38px; display:inline-flex; align-items:center; justify-content:center; gap:7px; padding:0 13px; border-radius:999px; border:1px solid rgba(255,255,255,.12); background:rgba(255,255,255,.055); color:#fff; text-decoration:none; font-size:12px; font-weight:1000; cursor:pointer; }
    .support-button.primary { border-color:rgba(0,255,102,.36); background:linear-gradient(180deg, #00ff66, #00d957); color:#031007; box-shadow:0 0 14px rgba(0,255,102,.18); }
    .feedback-card { display:grid; grid-template-columns:1fr; gap:14px; align-items:start; margin:0; }
    .feedback-intro { display:flex; align-items:baseline; gap:18px; min-width:0; }
    .feedback-intro strong { flex:0 0 auto; }
    .feedback-intro p { flex:1 1 auto; min-width:0; }
    .feedback-card p { margin:0; }
    .feedback-fields { display:grid; grid-template-columns:124px minmax(110px, .75fr) minmax(140px, .9fr) minmax(220px, 1.35fr) 108px; gap:9px; align-items:end; }
    .feedback-card label { display:grid; gap:5px; color:#84978b; font-size:11px; font-weight:900; }
    .feedback-card input, .feedback-card select, .feedback-card textarea { width:100%; min-width:0; border:1px solid rgba(255,255,255,.10); border-radius:10px; background:rgba(0,0,0,.28); color:#eaffef; font:850 12px/1.35 inherit; outline:0; }
    .feedback-card input, .feedback-card select { height:34px; padding:0 9px; }
    .feedback-card textarea { height:34px; min-height:34px; resize:vertical; padding:8px 9px; }
    .feedback-card input:focus, .feedback-card select:focus, .feedback-card textarea:focus { border-color:rgba(0,255,102,.42); }
    .feedback-card button { min-height:38px; border:1px solid rgba(47,128,255,.42); border-radius:999px; background:rgba(47,128,255,.16); color:#d9eaff; font-size:12px; font-weight:1000; cursor:pointer; }
    .feedback-card button[disabled] { opacity:.62; cursor:not-allowed; }
    .feedback-card small { min-height:16px; color:#7f9388; font-size:11px; line-height:1.4; text-align:center; }
    .feedback-card small.success { color:var(--neon); }
    .feedback-card small.error { color:#ffb4a8; }
    .feedback-trap { position:absolute !important; left:-9999px !important; width:1px !important; height:1px !important; opacity:0 !important; }
    .footer-disclaimer { padding-top:12px; border-top:1px solid rgba(255,255,255,.08); color:#84978b; font-size:12px; line-height:1.7; }
    .team-index { display:grid; gap:12px; }
    .team-index-toolbar { display:grid; grid-template-columns:minmax(240px, .7fr) minmax(0, 1fr) auto; gap:10px; align-items:center; padding:12px; border:1px solid rgba(235,248,255,.12); border-radius:18px; background:rgba(2,8,5,.54); backdrop-filter:blur(14px); }
    .team-search { min-width:0; display:grid; gap:6px; color:#8fa49a; font-size:11px; font-weight:950; }
    .team-search input { width:100%; min-width:0; height:38px; border:1px solid rgba(255,255,255,.10); border-radius:12px; padding:0 12px; outline:0; color:#f5fff8; background:rgba(0,0,0,.30); font:850 12px/1.2 inherit; }
    .team-search input:focus { border-color:rgba(0,255,102,.38); box-shadow:0 0 0 3px rgba(0,255,102,.055); }
    .team-group-filter { min-width:0; display:flex; gap:6px; overflow-x:auto; scrollbar-width:none; }
    .team-group-filter button { flex:0 0 auto; min-width:42px; min-height:34px; border:1px solid rgba(255,255,255,.10); border-radius:999px; padding:0 10px; background:rgba(255,255,255,.045); color:#c4d4ca; font-size:12px; font-weight:1000; cursor:pointer; }
    .team-group-filter button.active { border-color:rgba(0,255,102,.42); background:rgba(0,255,102,.13); color:var(--neon); box-shadow:0 0 14px rgba(0,255,102,.12); }
    .team-result-count { min-height:34px; display:inline-flex; align-items:center; justify-content:center; padding:0 12px; border:1px solid rgba(47,128,255,.24); border-radius:999px; background:rgba(47,128,255,.10); color:#d9eaff; font-size:12px; white-space:nowrap; }
    .team-grid-scroll { max-height:min(680px, calc(100dvh - 260px)); overflow:auto; overscroll-behavior:contain; padding:2px 4px 2px 0; scrollbar-width:thin; scrollbar-color:rgba(0,255,102,.28) rgba(255,255,255,.06); }
    .team-grid-scroll::-webkit-scrollbar { width:8px; }
    .team-grid-scroll::-webkit-scrollbar-track { background:rgba(255,255,255,.05); border-radius:999px; }
    .team-grid-scroll::-webkit-scrollbar-thumb { background:rgba(0,255,102,.24); border-radius:999px; }
    .team-grid { display:grid; grid-template-columns:repeat(auto-fit, minmax(210px, 1fr)); gap:9px; }
    .team-feed-card { position:relative; min-height:118px; display:grid; grid-template-rows:auto 1fr; gap:7px; border:1px solid rgba(235,248,255,.14); border-radius:15px; padding:10px; background:linear-gradient(180deg, rgba(4,19,12,.90), rgba(3,14,9,.80) 58%, rgba(0,0,0,.66)); color:#eefcf1; box-shadow:0 12px 32px rgba(0,0,0,.24), inset 0 0 0 1px rgba(255,255,255,.035), inset 0 -34px 52px rgba(0,0,0,.18); overflow:hidden; }
    .team-feed-card::before { content:""; position:absolute; inset:0; background:radial-gradient(circle at 18% 0%, rgba(0,255,102,.10), transparent 34%), linear-gradient(90deg, rgba(0,0,0,.12), transparent 48%, rgba(0,0,0,.22)); pointer-events:none; }
    .team-feed-card[hidden] { display:none; }
    .team-feed-card > * { position:relative; z-index:1; }
    .team-feed-main { display:grid; grid-template-columns:36px minmax(0, 1fr); align-items:center; gap:8px; min-width:0; }
    .team-feed-flag { width:36px; height:26px; display:grid; place-items:center; border-radius:8px; background:rgba(255,255,255,.11); font-size:21px; box-shadow:0 0 0 1px rgba(255,255,255,.16), 0 8px 18px rgba(0,0,0,.24); }
    .team-feed-card strong { display:block; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; color:#fff; font-size:14px; text-shadow:0 1px 10px rgba(0,0,0,.38); }
    .team-feed-card small { display:block; margin-top:4px; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; color:#a8beb1; font-size:10px; font-weight:900; }
    .team-feed-card p { margin:0; padding:10px 0; border-top:1px solid rgba(255,255,255,.075); border-bottom:1px solid rgba(255,255,255,.055); color:#d6e6dd; font-size:13px; line-height:1.45; font-weight:850; }
    .team-next-match { display:grid; gap:4px; align-content:center; min-height:40px; padding:6px 0; border-top:1px solid rgba(255,255,255,.07); border-bottom:1px solid rgba(255,255,255,.055); }
    .team-next-match strong { min-width:0; color:#fff; font-size:11px; line-height:1.1; text-shadow:none; }
    .team-next-match em { min-width:0; display:grid; gap:3px; color:#b8c9be; font-style:normal; font-size:11px; font-weight:900; line-height:1.2; }
    .team-next-match em span { min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
    .knockout-scroll { width:100%; overflow-x:auto; padding-bottom:8px; scrollbar-width:thin; scrollbar-color:rgba(0,255,102,.30) rgba(255,255,255,.06); }
    .knockout-bracket { width:100%; min-width:1180px; display:grid; grid-template-columns:minmax(0, 1fr) 260px minmax(0, 1fr); gap:18px; align-items:stretch; padding:16px; border:1px solid rgba(235,248,255,.14); border-radius:24px; background:linear-gradient(180deg, rgba(2,11,24,.84), rgba(4,17,11,.76)); box-shadow:0 22px 68px rgba(0,0,0,.34), inset 0 0 0 1px rgba(255,255,255,.035); overflow:visible; }
    .bracket-side { display:grid; grid-template-columns:repeat(4, minmax(128px, 1fr)); gap:12px; align-items:center; }
    .bracket-side.right { direction:rtl; }
    .bracket-side.right .bracket-column, .bracket-side.right .knockout-card { direction:ltr; }
    .bracket-column { position:relative; display:grid; gap:10px; align-content:center; }
    .bracket-column::after { content:""; position:absolute; top:10%; bottom:10%; right:-7px; width:1px; background:linear-gradient(180deg, transparent, rgba(235,248,255,.34), transparent); opacity:.7; }
    .bracket-side.right .bracket-column::after { right:auto; left:-7px; }
    .bracket-column:last-child::after { opacity:.28; }
    .bracket-heading { min-height:34px; display:flex; align-items:center; justify-content:space-between; gap:8px; padding:0 10px; border:1px solid rgba(235,248,255,.13); border-radius:12px; background:rgba(0,0,0,.30); color:#fff; font-size:12px; font-weight:1000; }
    .bracket-heading span { color:#9fb2a5; font:900 10px/1 "SFMono-Regular", Consolas, monospace; }
    .bracket-finals { display:grid; align-content:center; gap:18px; text-align:center; }
    .bracket-trophy-mark { display:grid; justify-items:center; gap:6px; color:#dfe9ef; font-size:13px; font-weight:1000; text-transform:uppercase; letter-spacing:.05em; opacity:.92; }
    .bracket-trophy-mark strong { color:#fff; font:1000 54px/.82 "SFMono-Regular", Consolas, monospace; letter-spacing:0; }
    .bracket-final-card { border-color:rgba(0,255,102,.34) !important; background:radial-gradient(circle at 50% 0%, rgba(0,255,102,.22), transparent 46%), linear-gradient(160deg, rgba(5,42,24,.95), rgba(0,0,0,.58)) !important; min-height:190px !important; }
    .bracket-third-card { border-color:rgba(47,128,255,.32) !important; background:linear-gradient(160deg, rgba(47,128,255,.18), rgba(0,0,0,.54)) !important; }
    .knockout-card { position:relative; min-height:116px; display:grid; gap:8px; align-content:space-between; padding:12px; border:1px solid rgba(255,255,255,.12); border-radius:16px; background:linear-gradient(180deg, rgba(7,28,17,.88), rgba(0,0,0,.42)); box-shadow:inset 0 0 18px rgba(0,0,0,.26), 0 10px 28px rgba(0,0,0,.22); overflow:hidden; }
    .knockout-card::before { content:""; position:absolute; inset:0; background:linear-gradient(90deg, rgba(0,255,102,.045), transparent 44%, rgba(47,128,255,.045)); pointer-events:none; }
    .knockout-card > * { position:relative; z-index:1; }
    .knockout-card.empty { align-content:center; text-align:center; color:#8ea599; }
    .knockout-card.empty strong { color:#dfe9ef; }
    .knockout-card.empty span { font-size:12px; line-height:1.45; }
    .knockout-match-no { display:flex; justify-content:space-between; gap:8px; color:#9fb2a5; font:850 11px/1.2 "SFMono-Regular", Consolas, monospace; }
    .knockout-teams { display:grid; gap:7px; }
    .knockout-teams span { min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; color:#f6fff9; font-size:13px; font-weight:950; }
    .knockout-teams strong { width:max-content; min-width:58px; min-height:28px; display:flex; align-items:center; justify-content:center; padding:0 10px; border:1px solid rgba(255,255,255,.13); border-radius:999px; background:rgba(0,0,0,.38); color:var(--neon); font:1000 14px/1 "SFMono-Regular", Consolas, monospace; letter-spacing:.06em; }
    .knockout-foot { display:grid; grid-template-columns:minmax(0, 1fr) auto; align-items:center; gap:8px; }
    .knockout-foot span { min-width:0; color:#91a79a; font-size:11px; font-weight:900; }
    .knockout-foot a { min-height:30px; display:inline-flex; align-items:center; justify-content:center; padding:0 10px; border:1px solid rgba(0,255,102,.30); border-radius:999px; background:rgba(0,255,102,.12); color:var(--neon); text-decoration:none; font-size:11px; font-weight:1000; white-space:nowrap; }
    .knockout-foot a.replay { border-color:rgba(47,128,255,.34); background:rgba(47,128,255,.16); color:#d9eaff; }
    .knockout-stage { width:100%; max-width:1240px; margin:0 auto; border:1px solid rgba(235,248,255,.14); border-radius:24px; background:linear-gradient(180deg, rgba(2,13,34,.68), rgba(1,8,24,.50)); box-shadow:0 26px 80px rgba(0,0,0,.34), inset 0 0 0 1px rgba(255,255,255,.035); overflow:hidden; }
    .knockout-stage-head { min-height:48px; display:flex; align-items:center; justify-content:flex-start; gap:12px; padding:0 16px; border-bottom:1px solid rgba(255,255,255,.08); background:rgba(0,0,0,.18); }
    .knockout-stage-head strong { color:#fff; font-size:15px; font-weight:1000; }
    .knockout-canvas-wrap { width:100%; overflow:visible; padding:14px; }
    .knockout-canvas { position:relative; width:min(100%, 1500px); aspect-ratio:2600 / 2138; margin:0 auto; border-radius:24px; background:#011d5f url("/assets/img/knockout-bracket-frame.png") center / 100% 100% no-repeat; box-shadow:0 26px 80px rgba(0,0,0,.42), 0 0 0 1px rgba(255,255,255,.10), inset 0 0 80px rgba(0,0,0,.16); overflow:hidden; }
    .knockout-canvas::after { content:""; position:absolute; inset:0; background:radial-gradient(circle at 50% 28%, rgba(255,255,255,.10), transparent 14%), radial-gradient(circle at 50% 70%, rgba(0,255,102,.06), transparent 18%); pointer-events:none; }
    .bracket-match-card { position:absolute; z-index:2; left:var(--x); top:var(--y); width:var(--w); height:var(--h); display:grid; grid-template-rows:auto minmax(0, 1fr) auto; gap:4px; padding:7px 8px; border:1px solid rgba(255,255,255,.22); border-radius:10px; color:#fff; box-shadow:0 10px 24px rgba(0,0,0,.28), inset 0 0 0 1px rgba(255,255,255,.055); overflow:hidden; }
    .bracket-match-card::before { content:""; position:absolute; inset:0; background:linear-gradient(145deg, rgba(255,255,255,.12), transparent 38%, rgba(0,0,0,.12)); pointer-events:none; }
    .bracket-match-card > * { position:relative; z-index:1; }
    .bracket-card-head { display:flex; align-items:flex-start; justify-content:space-between; gap:6px; font-size:clamp(8px, .64vw, 11px); line-height:1.12; font-weight:1000; }
    .bracket-card-head, .bracket-card-foot { min-width:0; overflow:hidden; }
    .bracket-card-head span { display:grid; gap:1px; }
    .bracket-card-head time { opacity:.86; font-weight:850; }
    .bracket-card-head b { font:1000 clamp(11px, .76vw, 14px)/1 "SFMono-Regular", Consolas, monospace; }
    .bracket-card-main { min-height:0; display:grid; grid-template-columns:minmax(0, 1fr) auto minmax(0, 1fr); align-items:center; gap:6px; text-align:center; }
    .bracket-team { min-width:0; display:grid; justify-items:center; gap:3px; color:rgba(255,255,255,.92); font-size:clamp(8px, .62vw, 11px); font-weight:900; }
    .bracket-team i { width:28px; height:20px; display:grid; place-items:center; border-radius:7px; background:rgba(0,0,0,.16); font-style:normal; font-size:17px; box-shadow:inset 0 0 0 1px rgba(0,0,0,.08); }
    .bracket-team i.placeholder { position:relative; background:rgba(0,0,0,.12); color:transparent; opacity:.42; }
    .bracket-team i.placeholder::before { content:""; width:22px; height:18px; border:3px solid rgba(0,0,0,.30); border-radius:6px 6px 9px 9px; border-top-width:5px; }
    .bracket-team i.placeholder::after { content:""; position:absolute; width:30px; height:8px; border-radius:999px; background:rgba(0,0,0,.18); transform:translateY(-8px); }
    .bracket-team span { max-width:100%; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
    .bracket-score { min-width:30px; color:#fff; font:1000 clamp(14px, 1.02vw, 20px)/1 "SFMono-Regular", Consolas, monospace; letter-spacing:.02em; }
    .bracket-card-foot { display:flex; align-items:center; justify-content:space-between; gap:6px; color:rgba(255,255,255,.82); font-size:clamp(7px, .52vw, 10px); font-weight:900; }
    .bracket-card-foot span { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
    .bracket-card-foot a { color:#fff; text-decoration:none; white-space:nowrap; opacity:.92; }
    .bracket-card-foot a::before { content:"▶ "; font-size:9px; }
    .bracket-match-card.theme-blue { background:linear-gradient(180deg, #0e5bff, #0648df); }
    .bracket-match-card.theme-teal { background:linear-gradient(180deg, #04c893, #00a982); }
    .bracket-match-card.theme-green { background:linear-gradient(180deg, #5bbb2b, #45a91f); }
    .bracket-match-card.theme-red { background:linear-gradient(180deg, #ed0808, #c90000); }
    .bracket-match-card.theme-cyan { background:linear-gradient(180deg, #0c69ff, #05c8a0); }
    .bracket-match-card.theme-gold { border-color:rgba(255,255,255,.28); background:linear-gradient(135deg, #caa95b, #8c5c12 48%, #d0ad61); }
    .bracket-match-card.theme-bronze { border-color:rgba(255,255,255,.24); background:linear-gradient(135deg, #9e6418, #6d3d0b 48%, #c09b4f); }
    .bracket-match-card.theme-gold .bracket-score { font-size:clamp(18px, 1.55vw, 30px); }
    .bracket-match-card.theme-gold .bracket-team i { width:40px; height:30px; }
    .bracket-match-card.theme-gold .bracket-card-main { gap:12px; }
    .bracket-match-card.empty { opacity:.68; background:rgba(3,22,79,.62); border-color:rgba(255,255,255,.08); }
    .bracket-match-card.empty .bracket-card-main { display:grid; place-items:center; color:rgba(255,255,255,.78); font-size:14px; font-weight:1000; }
    .bracket-match-card.empty .bracket-card-head, .bracket-match-card.empty .bracket-card-foot { display:none; }
    .custom-builder { display:grid; grid-template-columns:minmax(0, .98fr) minmax(380px, .72fr); gap:16px; align-items:stretch; }
    .custom-panel, .custom-result { height:min(900px, calc(100vh - 164px)); min-height:720px; border:1px solid rgba(235,248,255,.12); border-radius:22px; padding:18px; background:linear-gradient(180deg, rgba(3,18,12,.88), rgba(0,0,0,.44)); backdrop-filter:blur(16px); box-shadow:0 24px 62px rgba(0,0,0,.28), inset 0 0 0 1px rgba(255,255,255,.025); overflow:hidden; }
    .custom-panel { overflow:auto; scrollbar-width:thin; scrollbar-color:rgba(0,255,102,.32) rgba(255,255,255,.06); }
    .custom-main { display:grid; grid-template-rows:auto auto auto auto auto; gap:14px; }
    .custom-head { display:flex; justify-content:space-between; align-items:flex-end; gap:12px; color:#fff; }
    .custom-head h3 { margin:0; color:#fff; font-size:clamp(22px, 2.4vw, 34px); line-height:1.1; }
    .custom-head p { max-width:580px; margin:7px 0 0; color:#aebfb4; font-size:13px; line-height:1.55; }
    .custom-head span { flex:0 0 auto; color:var(--neon); font:1000 12px/1 "SFMono-Regular", Consolas, monospace; }
    .custom-block { display:grid; gap:10px; padding-top:2px; }
    .custom-block-title { display:flex; align-items:center; justify-content:space-between; gap:10px; color:#fff; font-size:13px; font-weight:1000; }
    .custom-block-title small { color:#8ea599; font-size:11px; font-weight:900; }
    .preset-grid { display:grid; grid-template-columns:repeat(4, minmax(0, 1fr)); gap:9px; }
    .preset-grid button { min-height:58px; display:grid; align-content:center; gap:4px; border:1px solid rgba(235,248,255,.10); border-radius:14px; padding:8px 10px; background:linear-gradient(180deg, rgba(255,255,255,.055), rgba(0,0,0,.18)); color:#eaf6f0; text-align:left; font-size:12px; font-weight:1000; cursor:pointer; transition:.18s ease; }
    .preset-grid button small { display:block; color:#8ea599; font-size:10px; font-weight:900; }
    .preset-grid button.active, .preset-grid button:hover { border-color:rgba(0,255,102,.34); background:linear-gradient(180deg, rgba(0,255,102,.12), rgba(47,128,255,.07)); color:var(--neon); box-shadow:0 0 18px rgba(0,255,102,.08); }
    .custom-search { display:grid; gap:7px; color:#8ea599; font-size:11px; font-weight:900; }
    .custom-search input, .custom-options select, .custom-add-search input { min-height:40px; border:1px solid rgba(255,255,255,.10); border-radius:12px; background:rgba(0,0,0,.28); color:#eaffef; padding:0 12px; font:850 13px/1.2 inherit; outline:0; }
    .custom-search input:focus, .custom-options select:focus, .custom-add-search input:focus { border-color:rgba(0,255,102,.40); box-shadow:0 0 0 3px rgba(0,255,102,.055); }
    .custom-chip-row { display:flex; flex-wrap:wrap; gap:8px; min-height:34px; }
    .custom-chip-row:empty::before { content:"还没有选择关注对象"; display:inline-flex; align-items:center; color:#71867a; font-size:12px; font-weight:900; }
    .custom-chip { min-height:30px; display:inline-flex; align-items:center; gap:7px; padding:0 10px; border:1px solid rgba(0,255,102,.24); border-radius:999px; background:rgba(0,255,102,.08); color:#eaffef; font-size:12px; font-weight:1000; }
    .custom-chip button { width:18px; height:18px; display:grid; place-items:center; border:0; border-radius:999px; background:rgba(255,255,255,.11); color:#dcefe4; cursor:pointer; }
    .star-picker, .custom-team-picker { display:grid; grid-template-columns:repeat(4, minmax(0, 1fr)); gap:8px; }
    .star-picker label, .custom-team-picker label, .custom-options label { min-height:40px; display:flex; align-items:center; gap:8px; padding:0 10px; border:1px solid rgba(255,255,255,.08); border-radius:12px; background:rgba(0,0,0,.18); color:#d9eee0; font-size:12px; font-weight:900; cursor:pointer; }
    .star-picker label { display:grid; grid-template-columns:auto minmax(0, 1fr); grid-template-rows:auto auto; align-content:center; min-height:52px; column-gap:7px; color:#d9eaff; background:rgba(47,128,255,.075); }
    .star-picker input { grid-row:1 / 3; }
    .star-picker small { min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; color:#8ea599; font-size:10px; font-weight:850; }
    .custom-team-picker { max-height:182px; overflow:auto; padding-right:2px; scrollbar-width:thin; scrollbar-color:rgba(0,255,102,.30) rgba(255,255,255,.06); overscroll-behavior:contain; }
    .custom-team-picker label[hidden] { display:none; }
    .star-picker input, .custom-team-picker input, .custom-options input { accent-color:#00ff66; }
    .custom-team-toggle { justify-self:start; min-height:34px; border:1px solid rgba(47,128,255,.28); border-radius:999px; padding:0 13px; background:rgba(47,128,255,.10); color:#d9eaff; font-size:12px; font-weight:1000; cursor:pointer; }
    .custom-options { display:grid; grid-template-columns:repeat(3, minmax(0, 1fr)); gap:10px; }
    .custom-options > div { display:grid; gap:8px; align-content:start; }
    .custom-options strong, .custom-result strong { color:#fff; }
    .custom-advanced { border:1px solid rgba(255,255,255,.08); border-radius:16px; background:rgba(255,255,255,.035); overflow:hidden; }
    .custom-advanced summary { min-height:46px; display:flex; align-items:center; justify-content:space-between; padding:0 14px; color:#dfe9ef; font-size:13px; font-weight:1000; cursor:pointer; }
    .custom-advanced summary::after { content:"展开"; color:#8ea599; font-size:11px; }
    .custom-advanced[open] summary::after { content:"收起"; }
    .custom-advanced-body { padding:0 14px 14px; }
    .custom-result { position:sticky; top:126px; display:grid; grid-template-rows:auto minmax(0, 1fr) auto auto; gap:12px; }
    .custom-result p, .custom-result small { margin:0; color:#aebfb4; line-height:1.55; }
    .custom-result small { overflow-wrap:anywhere; font-size:11px; }
    .custom-result-head { display:grid; gap:8px; padding-bottom:10px; border-bottom:1px solid rgba(255,255,255,.08); }
    .custom-result-head strong { font-size:18px; }
    .custom-result-tags { display:flex; flex-wrap:wrap; gap:7px; }
    .custom-result-tags span { min-height:28px; display:inline-flex; align-items:center; gap:7px; padding:0 10px; border:1px solid rgba(0,255,102,.22); border-radius:999px; background:rgba(0,255,102,.075); color:#dff7e6; font-size:12px; font-weight:1000; }
    .custom-result-tags b { color:var(--neon); font:inherit; }
    .custom-result-tags span.muted { border-color:rgba(255,255,255,.10); background:rgba(255,255,255,.055); color:#aebfb4; }
    .custom-result-tags button { width:18px; height:18px; display:grid; place-items:center; border:0; border-radius:999px; background:rgba(255,255,255,.12); color:#eaffef; font-size:13px; font-weight:1000; line-height:1; cursor:pointer; }
    .custom-result-tags button:hover { background:rgba(255,120,100,.18); color:#ffb4a8; }
    .custom-result-meta { display:flex; flex-wrap:wrap; gap:7px; }
    .custom-result-meta span { min-height:26px; display:inline-flex; align-items:center; padding:0 9px; border-radius:999px; background:rgba(255,255,255,.06); color:#b9cbc0; font-size:11px; font-weight:1000; }
    .custom-restore-link { justify-self:start; min-height:26px; border:0; border-radius:999px; padding:0 9px; background:rgba(255,255,255,.055); color:#8ea599; font-size:11px; font-weight:1000; cursor:pointer; }
    .custom-restore-link:hover { color:var(--neon); background:rgba(0,255,102,.08); }
    .custom-preview { min-height:0; display:grid; grid-template-rows:auto minmax(0, 1fr) auto; gap:9px; }
    .custom-preview-heading { display:flex; align-items:center; justify-content:space-between; gap:10px; color:#dfe9ef; font-size:12px; font-weight:1000; }
    .custom-preview-heading span { color:#8ea599; font-weight:900; }
    .custom-preview-list { min-height:0; display:grid; align-content:start; gap:8px; overflow:auto; padding-right:2px; scrollbar-width:thin; scrollbar-color:rgba(0,255,102,.30) rgba(255,255,255,.06); }
    .custom-preview-match { display:grid; grid-template-columns:74px minmax(0, 1fr) auto; gap:10px; align-items:center; min-height:66px; padding:10px; border:1px solid rgba(255,255,255,.09); border-radius:14px; background:rgba(0,0,0,.24); }
    .custom-preview-match time { color:var(--neon); font:1000 12px/1.35 "SFMono-Regular", Consolas, monospace; }
    .custom-preview-match strong { display:block; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; color:#fff; font-size:13px; }
    .custom-preview-match span { display:block; margin-top:4px; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; color:#8ea599; font-size:11px; font-weight:850; }
    .custom-preview-match button, .custom-add-match button { min-height:30px; border:1px solid rgba(255,255,255,.12); border-radius:999px; padding:0 10px; background:rgba(255,255,255,.055); color:#dfe9ef; font-size:11px; font-weight:1000; cursor:pointer; white-space:nowrap; }
    .custom-preview-match button:hover { border-color:rgba(255,120,100,.30); color:#ffb4a8; }
    .custom-preview-empty { min-height:108px; display:grid; place-items:center; border:1px dashed rgba(255,255,255,.14); border-radius:14px; color:#9fb2a5; font-size:12px; font-weight:900; text-align:center; padding:16px; }
    .custom-available-panel { min-height:260px; display:grid; grid-template-rows:auto auto minmax(150px, 1fr); gap:9px; padding:12px; border:1px solid rgba(47,128,255,.18); border-radius:16px; background:rgba(47,128,255,.055); overflow:hidden; }
    .custom-add-list { min-height:0; max-height:280px; display:grid; align-content:start; gap:7px; overflow:auto; scrollbar-width:thin; scrollbar-color:rgba(47,128,255,.32) rgba(255,255,255,.06); overscroll-behavior:contain; }
    .custom-add-match { display:grid; grid-template-columns:minmax(0, 1fr) auto; gap:8px; align-items:center; min-height:50px; padding:9px 10px; border:1px solid rgba(255,255,255,.08); border-radius:12px; background:rgba(0,0,0,.20); }
    .custom-add-match strong { display:block; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-size:12px; }
    .custom-add-match span { display:block; margin-top:4px; color:#8ea599; font-size:10px; font-weight:900; }
    .custom-actions { display:grid; grid-template-columns:1fr 1fr; gap:8px; }
    .custom-actions a, .custom-actions button { min-height:40px; display:flex; align-items:center; justify-content:center; border:1px solid rgba(0,255,102,.22); border-radius:12px; background:rgba(0,255,102,.075); color:var(--neon); text-decoration:none; font-size:12px; font-weight:1000; cursor:pointer; text-align:center; }
    .custom-actions .custom-primary-action { grid-column:1 / -1; min-height:48px; border-color:transparent; background:linear-gradient(180deg, #00ff66, #00d957); color:#031007; font-size:13px; box-shadow:0 0 18px rgba(0,255,102,.18); }
    .custom-actions .custom-secondary-action { border-color:rgba(47,128,255,.28); background:rgba(47,128,255,.10); color:#d9eaff; }
    .custom-actions .custom-subtle-action { grid-column:1 / -1; min-height:30px; border:0; background:transparent; color:#8ea599; font-size:11px; }
    .custom-actions .custom-subtle-action:hover { color:#d9eaff; background:rgba(255,255,255,.045); }
    .custom-actions .is-hidden { display:none; }
    .custom-undo { min-height:34px; border:1px solid rgba(0,255,102,.25); border-radius:999px; background:rgba(0,255,102,.08); color:var(--neon); font-size:12px; font-weight:1000; cursor:pointer; }
    .share-page { min-height:100vh; padding:18px max(18px, calc((100vw - 1240px) / 2 + 18px)) 44px; }
    .share-actions { display:flex; flex-wrap:wrap; gap:10px; margin-top:20px; }
    .share-actions a, .share-actions button, .share-actions summary { min-height:44px; display:flex; align-items:center; justify-content:center; padding:0 16px; border:1px solid rgba(0,255,102,.28); border-radius:999px; background:rgba(0,255,102,.08); color:var(--neon); text-decoration:none; font-weight:1000; cursor:pointer; }
    .share-actions .poster-download-action { border-color:transparent; background:linear-gradient(180deg, #00ff66, #00d957); color:#031007; box-shadow:0 0 18px rgba(0,255,102,.16); }
    .share-brief { width:min(500px, calc((100dvh - 112px) * 9 / 16), 100%); margin-top:14px; display:grid; gap:5px; padding:12px 15px; border:1px solid rgba(235,248,255,.12); border-radius:18px; background:rgba(0,0,0,.22); color:#aebfb4; text-align:center; backdrop-filter:blur(12px); }
    .share-brief strong { color:#eaffef; font-size:13px; }
    .share-brief span { font-size:12px; line-height:1.55; }
    .share-qr-card { display:grid; justify-items:center; gap:9px; text-align:center; color:#aebfb4; }
    .share-preview { max-width:1240px; margin:18px auto 0; }
    .share-poster-wrap { max-width:1240px; margin:0 auto; display:grid; place-items:center; }
    .share-poster { container-type:inline-size; position:relative; width:min(500px, calc((100dvh - 112px) * 9 / 16), 100%); aspect-ratio:9 / 16; display:grid; grid-template-rows:auto auto auto auto auto auto auto minmax(0, 1fr) auto auto auto; gap:clamp(5px, 1.35cqw, 8px); padding:clamp(14px, 4.4cqw, 22px) clamp(16px, 5.2cqw, 26px) clamp(12px, 3.6cqw, 18px); border:1px solid rgba(235,248,255,.38); border-radius:28px; overflow:hidden; background:radial-gradient(circle at 50% 35%, rgba(0,255,102,.18), transparent 20%), linear-gradient(180deg, rgba(3,13,9,.94), rgba(1,6,4,.96)); box-shadow:0 32px 100px rgba(0,0,0,.56), inset 0 0 0 1px rgba(255,255,255,.06), inset 0 0 72px rgba(0,255,102,.045); }
    .share-poster::before { content:""; position:absolute; inset:0; background:linear-gradient(180deg, rgba(0,0,0,.12), rgba(0,0,0,.18)), url("/assets/img/stadium-hero-mobile.webp") center / cover no-repeat; opacity:.58; filter:saturate(.9) contrast(1.08); pointer-events:none; }
    .share-poster::after { content:""; position:absolute; inset:0; background:linear-gradient(180deg, rgba(0,0,0,.40) 0 19%, rgba(1,7,5,.16) 28%, rgba(0,0,0,.18) 55%, rgba(0,0,0,.70) 78%, rgba(0,0,0,.90) 100%); pointer-events:none; }
    .share-poster > * { position:relative; z-index:1; }
    .poster-cut { position:absolute; z-index:2; top:76%; width:34px; height:58px; border:1px solid rgba(235,248,255,.30); background:#040d08; }
    .poster-cut-left { left:-18px; border-radius:0 999px 999px 0; border-left:0; }
    .poster-cut-right { right:-18px; border-radius:999px 0 0 999px; border-right:0; }
    .poster-confetti { position:absolute; inset:0; z-index:1; background:radial-gradient(circle at 18% 9%, rgba(0,255,102,.85) 0 2px, transparent 3px), radial-gradient(circle at 84% 14%, rgba(219,230,238,.75) 0 2px, transparent 3px), radial-gradient(circle at 28% 28%, rgba(0,255,102,.50) 0 1px, transparent 2px), radial-gradient(circle at 76% 42%, rgba(47,128,255,.72) 0 2px, transparent 3px), radial-gradient(circle at 61% 7%, rgba(255,222,138,.55) 0 2px, transparent 3px); opacity:.70; pointer-events:none; }
    .poster-topline { display:grid; grid-template-columns:1fr auto 1fr; align-items:center; gap:12px; color:var(--neon); font:1000 14px/1 "SFMono-Regular", Consolas, monospace; letter-spacing:.22em; }
    .poster-topline span { height:1px; background:linear-gradient(90deg, transparent, rgba(0,255,102,.62), transparent); box-shadow:0 0 12px rgba(0,255,102,.32); }
    .poster-topline b { color:var(--neon); font-size:clamp(20px, 5.6cqw, 28px); letter-spacing:.18em; text-shadow:0 0 14px rgba(0,255,102,.30); }
    .poster-title { margin:0; color:#f5f8f1; font-size:clamp(30px, 9.4cqw, 48px); line-height:.98; text-align:center; white-space:normal; text-wrap:balance; text-shadow:0 3px 0 rgba(0,0,0,.62), 0 0 28px rgba(255,255,255,.12); }
    .poster-subtitle { margin:-2px 0 0; color:var(--neon); text-align:center; font-size:clamp(11px, 3cqw, 15px); font-weight:1000; letter-spacing:.04em; text-shadow:0 0 14px rgba(0,255,102,.24); }
    .poster-owner { margin:0; color:#eef6f2; text-align:center; font-size:clamp(11px, 2.8cqw, 14px); font-weight:950; letter-spacing:.04em; text-shadow:0 2px 12px rgba(0,0,0,.70); }
    .poster-ribbon { width:min(440px, 100%); min-height:clamp(32px, 9cqw, 48px); justify-self:center; display:flex; align-items:center; justify-content:center; gap:clamp(7px, 2.4cqw, 12px); padding:0 clamp(12px, 4.2cqw, 22px); border:1px solid rgba(235,248,255,.36); border-radius:12px; background:linear-gradient(90deg, rgba(235,248,255,.08), rgba(0,0,0,.46), rgba(0,255,102,.08)); box-shadow:0 0 20px rgba(0,255,102,.10), inset 0 0 18px rgba(255,255,255,.035); color:#fff; transform:skewX(-10deg); }
    .poster-ribbon > * { transform:skewX(10deg); }
    .poster-ribbon-flag { display:grid; place-items:center; width:clamp(30px, 8.4cqw, 42px); height:clamp(21px, 6cqw, 30px); border-radius:8px; background:rgba(255,255,255,.12); font-size:clamp(16px, 4.4cqw, 22px); box-shadow:0 0 0 1px rgba(255,255,255,.16); }
    .poster-ribbon strong { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-size:clamp(12px, 4cqw, 19px); letter-spacing:.04em; }
    .poster-tags { min-height:clamp(34px, 8.8cqw, 44px); display:flex; align-items:center; justify-content:center; gap:6px; padding:5px 8px; border:1px solid rgba(235,248,255,.18); border-radius:999px; background:linear-gradient(90deg, rgba(235,248,255,.08), rgba(0,0,0,.36), rgba(0,255,102,.08)); box-shadow:inset 0 0 18px rgba(255,255,255,.035); overflow:hidden; }
    .poster-tags span { min-width:0; max-width:118px; display:inline-flex; align-items:center; justify-content:center; padding:0 9px; height:clamp(22px, 5.4cqw, 27px); border-radius:999px; background:rgba(0,0,0,.28); color:#eaffef; font-size:clamp(10px, 2.7cqw, 13px); font-weight:1000; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; box-shadow:0 0 0 1px rgba(255,255,255,.08); }
    .poster-stats { min-height:clamp(34px, 8.2cqw, 42px); display:flex; align-items:center; justify-content:center; gap:0; padding:0 12px; border:1px solid rgba(235,248,255,.18); border-radius:999px; background:linear-gradient(90deg, rgba(235,248,255,.07), rgba(0,0,0,.32), rgba(0,255,102,.07)); color:#d3e3d9; box-shadow:inset 0 0 18px rgba(255,255,255,.025), 0 0 14px rgba(0,255,102,.055); overflow:hidden; }
    .poster-stats span { min-width:0; display:inline-flex; align-items:baseline; justify-content:center; gap:3px; padding:0 clamp(6px, 2.2cqw, 11px); white-space:nowrap; }
    .poster-stats span + span { border-left:1px solid rgba(235,248,255,.13); }
    .poster-stats strong { display:block; color:var(--neon); font:1000 clamp(16px, 4.9cqw, 24px)/1 "SFMono-Regular", Consolas, monospace; text-shadow:0 0 12px rgba(0,255,102,.42); }
    .poster-stats em { color:#d3e3d9; font-size:clamp(8px, 2.25cqw, 11px); line-height:1.1; font-style:normal; white-space:nowrap; }
    .poster-feature-strip { display:grid; grid-template-columns:repeat(4, minmax(0, 1fr)); gap:6px; }
    .poster-feature-strip span { min-height:clamp(25px, 6cqw, 31px); display:flex; align-items:center; justify-content:center; border:1px solid rgba(0,255,102,.18); border-radius:12px; background:linear-gradient(180deg, rgba(0,255,102,.10), rgba(0,0,0,.28)); color:#dcece3; font-size:clamp(9px, 2.38cqw, 12px); font-weight:1000; white-space:nowrap; box-shadow:inset 0 0 0 1px rgba(255,255,255,.025); }
    .poster-stage { position:relative; min-height:0; margin:-2px -10px -5px; display:grid; place-items:center; overflow:visible; }
    .poster-stage::before { content:""; position:absolute; left:50%; bottom:4%; width:72%; height:28%; transform:translateX(-50%); background:radial-gradient(ellipse, rgba(0,0,0,.70), transparent 68%); filter:blur(8px); }
    .poster-stage img { position:relative; z-index:2; width:min(74%, 286px); max-height:clamp(150px, 57cqw, 286px); object-fit:contain; object-position:center; filter:saturate(.82) contrast(1.08) brightness(.92) drop-shadow(0 28px 50px rgba(0,0,0,.74)); mix-blend-mode:screen; -webkit-mask-image:radial-gradient(ellipse at center, #000 0 60%, rgba(0,0,0,.86) 73%, transparent 100%); mask-image:radial-gradient(ellipse at center, #000 0 60%, rgba(0,0,0,.86) 73%, transparent 100%); }
    .poster-focus-list { display:grid; align-content:start; gap:clamp(6px, 1.9cqw, 10px); padding:clamp(8px, 2.2cqw, 12px); border:1px solid rgba(235,248,255,.20); border-radius:22px; background:linear-gradient(180deg, rgba(235,248,255,.08), rgba(8,42,30,.36)); box-shadow:inset 0 0 22px rgba(255,255,255,.035), 0 14px 34px rgba(2,28,18,.24); }
    .poster-focus-head { display:flex; align-items:center; justify-content:space-between; min-height:clamp(20px, 5cqw, 26px); color:#dcece3; font-size:clamp(9px, 2.4cqw, 12px); font-weight:1000; }
    .poster-focus-head strong { color:#fff; font-size:clamp(12px, 3.2cqw, 16px); }
    .poster-focus-head span { color:#95a99d; }
    .poster-focus-tags { min-height:clamp(96px, 27cqw, 136px); display:flex; flex-wrap:wrap; align-content:center; justify-content:center; gap:clamp(5px, 1.7cqw, 8px); overflow:hidden; }
    .poster-focus-tags span { min-width:0; max-width:clamp(92px, 25cqw, 132px); min-height:clamp(27px, 7cqw, 36px); display:inline-flex; align-items:center; justify-content:center; gap:clamp(3px, 1cqw, 5px); padding:0 clamp(10px, 3cqw, 15px); border:1px solid rgba(0,255,102,.20); border-radius:999px; background:linear-gradient(180deg, rgba(13,39,27,.70), rgba(6,24,16,.58)); backdrop-filter:blur(12px); color:rgba(255,255,255,.90); font-size:clamp(11px, 3.1cqw, 15px); font-weight:1000; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; text-shadow:0 1px 8px rgba(4,45,28,.58); box-shadow:inset 0 1px 0 rgba(255,255,255,.10), 0 0 13px rgba(0,255,102,.08); }
    .poster-focus-tags span i { flex:0 0 auto; display:inline-flex; align-items:center; justify-content:center; font-style:normal; font-size:.95em; line-height:1; filter:saturate(1.05); }
    .poster-focus-tags span.trait { border-color:rgba(0,255,102,.20); background:linear-gradient(180deg, rgba(13,39,27,.70), rgba(6,24,16,.58)); color:rgba(255,255,255,.90); text-shadow:0 1px 8px rgba(4,45,28,.58); box-shadow:inset 0 1px 0 rgba(255,255,255,.10), 0 0 13px rgba(0,255,102,.08); }
    .poster-empty { min-height:88px; display:grid; place-items:center; border:1px dashed rgba(255,255,255,.15); border-radius:16px; color:#8ea599; font-weight:900; }
    .poster-focus-list p { margin:0; min-height:clamp(18px, 4.6cqw, 24px); display:flex; align-items:center; justify-content:center; border:1px solid rgba(0,255,102,.18); border-radius:999px; background:rgba(0,255,102,.07); color:#bfffd8; font-size:clamp(9px, 2.45cqw, 12px); font-weight:1000; text-align:center; }
    .poster-ticket { min-height:clamp(78px, 22.4cqw, 112px); display:grid; grid-template-columns:clamp(62px, 19cqw, 96px) minmax(0, 1fr) clamp(78px, 21.6cqw, 108px); gap:clamp(8px, 2.4cqw, 12px); align-items:center; margin:5px -12px 0; padding:clamp(9px, 2.6cqw, 13px) clamp(10px, 3.2cqw, 16px) clamp(8px, 2cqw, 10px); border-top:1px dashed rgba(235,248,255,.46); background:linear-gradient(180deg, rgba(4,18,12,.60), rgba(0,0,0,.48)); }
    .poster-ticket strong { display:block; color:#dfffdf; font-size:clamp(12px, 3.5cqw, 20px); line-height:1.25; }
    .poster-ticket span { display:block; margin-top:clamp(4px, 1.6cqw, 8px); color:#aebfb4; font-size:clamp(9px, 2.4cqw, 12px); font-weight:900; line-height:1.45; }
    .poster-barcode { min-width:0; display:grid; gap:clamp(4px, 1.6cqw, 8px); color:#aebfb4; font:800 clamp(7px, 2cqw, 10px)/1 "SFMono-Regular", Consolas, monospace; letter-spacing:.08em; }
    .poster-barcode i { display:block; width:clamp(52px, 15.2cqw, 76px); height:clamp(34px, 10cqw, 50px); background:repeating-linear-gradient(90deg, #e9f0eb 0 2px, transparent 2px 4px, #e9f0eb 4px 5px, transparent 5px 8px, #e9f0eb 8px 11px, transparent 11px 14px); opacity:.86; }
    .poster-qr { justify-self:end; width:clamp(78px, 21.6cqw, 108px); height:clamp(78px, 21.6cqw, 108px); padding:7px; border-radius:14px; box-shadow:0 0 0 1px rgba(0,255,102,.34), 0 0 18px rgba(0,255,102,.22); }
    .poster-url { justify-self:center; color:var(--neon); font:1000 13px/1 "SFMono-Regular", Consolas, monospace; letter-spacing:.035em; text-shadow:0 0 12px rgba(0,255,102,.28); }
    .poster-actions { width:min(500px, calc((100dvh - 112px) * 9 / 16), 100%); display:grid; grid-template-columns:1fr 1fr; margin-top:10px; }
    .poster-actions a, .poster-actions button { min-height:38px; font-size:12px; }
    .poster-actions .poster-download-action { grid-column:1 / -1; min-height:46px; font-size:13px; }
    .poster-more-actions { grid-column:1 / -1; display:grid; gap:8px; }
    .poster-more-actions summary { min-height:32px; color:#9fb2a6; border-color:rgba(255,255,255,.10); background:rgba(0,0,0,.16); font-size:11px; list-style:none; }
    .poster-more-actions summary::-webkit-details-marker { display:none; }
    .poster-more-actions summary::after { content:""; width:7px; height:7px; margin-left:7px; border-right:1.5px solid currentColor; border-bottom:1.5px solid currentColor; transform:rotate(45deg) translateY(-2px); opacity:.78; transition:transform .18s ease; }
    .poster-more-actions[open] summary::after { transform:rotate(225deg) translateY(-1px); }
    .poster-more-actions div { display:grid; grid-template-columns:repeat(3, minmax(0, 1fr)); gap:8px; }
    .poster-more-actions div a, .poster-more-actions div button { min-height:34px; padding:0 10px; border-color:rgba(255,255,255,.11); background:rgba(255,255,255,.045); color:#b7cbc0; font-size:11px; }
    .poster-preview-layer { position:fixed; inset:0; z-index:120; display:grid; place-items:center; padding:20px; background:rgba(0,0,0,.72); backdrop-filter:blur(18px); }
    .poster-preview-card { width:min(460px, 100%); display:grid; gap:12px; padding:14px; border:1px solid rgba(235,248,255,.18); border-radius:22px; background:linear-gradient(180deg, rgba(9,26,17,.96), rgba(2,8,5,.96)); box-shadow:0 28px 90px rgba(0,0,0,.62), inset 0 0 0 1px rgba(255,255,255,.04); }
    .poster-preview-card img { width:100%; max-height:min(72dvh, 720px); object-fit:contain; border-radius:16px; background:#040d08; }
    .poster-preview-card strong { color:#eaffef; font-size:14px; }
    .poster-preview-card span { color:#9fb2a6; font-size:12px; line-height:1.5; }
    .poster-preview-card button { min-height:38px; border:1px solid rgba(0,255,102,.24); border-radius:999px; background:rgba(0,255,102,.08); color:var(--neon); font-weight:1000; cursor:pointer; }
    .neon-link { min-height:44px; display:inline-flex; align-items:center; justify-content:center; padding:0 16px; text-decoration:none; font-weight:950; }
    .grid { display:grid; grid-template-columns:repeat(2, minmax(0, 1fr)); gap:16px; margin-top:16px; }
    .panel { background:var(--panel); border:1px solid var(--line); border-radius:14px; padding:18px; overflow:auto; color:#eaffef; }
    .shell { max-width:1180px; margin:0 auto; padding:42px 18px 72px; }
    .hero.compact h1 { font-size:clamp(40px, 6vw, 72px); }
    code, pre { white-space:pre-wrap; overflow-wrap:anywhere; }
    a { color:var(--neon); }
    p { margin:8px 0; line-height:1.55; }
    @media (max-width:980px) {
      .topbar { grid-template-columns:1fr auto; padding:0 14px; }
      .topnav { grid-column:1 / -1; order:3; justify-content:flex-start; height:46px; }
      .topnav a { height:46px; min-width:82px; }
      .screen { padding-left:14px; padding-right:14px; }
      .sponsor-stage { grid-template-columns:1fr; }
      .hero-copy { max-width:78vw; }
      h1 { font-size:clamp(40px, 5.1vw, 58px); }
      .hero-trophy { width:min(36vw, 350px); right:8px; bottom:104px; opacity:.58; mix-blend-mode:screen; }
      .hero-console { grid-template-columns:116px minmax(0, 1fr); gap:10px; padding:12px; }
      .hero-actions { grid-template-rows:auto auto; }
      .hero-link-stack { grid-column:1 / -1; grid-template-rows:auto auto; }
      .qr-token { width:116px; }
      .qr { width:92px; height:92px; }
      .day-group { grid-template-columns:1fr; gap:8px; }
      .day-heading { border-right:1px solid var(--line); border-radius:14px; display:flex; justify-content:space-between; align-items:center; }
      .day-heading span { margin-top:0; }
      .guide-grid, .guide-steps, .device-guides { grid-template-columns:repeat(2, minmax(0, 1fr)); }
      .guide-steps div:not(:last-child)::after { display:none; }
      .honor-board { grid-template-columns:1fr; }
      .custom-builder { grid-template-columns:1fr; }
      .custom-builder > .custom-panel:first-child, .custom-result { grid-column:auto; grid-row:auto; }
      .custom-panel, .custom-result { height:auto; min-height:0; overflow:visible; }
      .custom-main { grid-template-rows:none; }
      .custom-result { position:static; grid-template-rows:none; }
      .custom-preview-list, .custom-add-list { max-height:360px; }
      .share-hero { grid-template-columns:1fr; }
      .feedback-fields { grid-template-columns:1fr 1fr; }
      .feedback-message-field { grid-column:1 / -1; }
      .feedback-card small { grid-column:1; }
      .footer-strip { grid-template-columns:1fr; }
      .support-card { min-height:auto; }
      .match-row { grid-template-columns:94px minmax(0, 1fr); border-radius:24px; }
      .match-side { grid-column:1 / -1; grid-template-columns:minmax(0, 1fr) 148px; padding-left:94px; }
      .venue { text-align:left; }
    }
    @media (max-width:720px) {
      .login-pill { display:none; }
      .topbar { min-height:54px; }
      .topnav a { min-width:0; flex:1 0 auto; padding:0 8px; font-size:13px; }
      .screen { min-height:auto; padding-top:54px; padding-bottom:64px; }
      .hero-screen { min-height:calc(100dvh - 97px); height:auto; overflow:visible; padding-top:0; padding-bottom:0; }
      .hero-composition { min-height:calc(100dvh - 97px); height:auto; grid-template-rows:auto auto; align-content:start; gap:14px; padding-top:28px; padding-bottom:112px; }
      .hero-copy { max-width:100%; }
      .site-bg::before { background-position:center bottom; }
      .site-overlay { background:linear-gradient(180deg, rgba(0,0,0,.08), rgba(3,12,8,.22) 30%, rgba(4,13,8,.88) 100%); }
      .hero-trophy { width:min(30vw, 142px); right:0; top:330px; bottom:auto; max-height:none; opacity:.94; z-index:5; mix-blend-mode:normal; filter:saturate(.92) contrast(1.08) brightness(1.04) drop-shadow(0 24px 46px rgba(0,0,0,.72)); mask-image:radial-gradient(ellipse at center, #000 0 84%, rgba(0,0,0,.96) 93%, transparent 100%); }
      .live-eyebrow { margin-bottom:7px; }
      h1 { font-size:34px; line-height:1.04; white-space:normal; }
      .hero-subtitle { margin-top:10px; font-size:13px; }
      .hero-bullets { gap:6px; margin-top:14px; padding-bottom:4px; }
      .hero-bullets span { min-height:23px; padding-left:18px; font-size:14px; }
      .hero-bullets span::before { width:7px; height:7px; }
      .hero-console { grid-template-columns:1fr; justify-items:center; align-self:start; margin-top:0; padding:12px; border-radius:18px; background:linear-gradient(180deg, rgba(235,248,255,.10), rgba(3,16,10,.72)); }
      .qr-token { width:112px; border-radius:20px; }
      .qr { width:88px; height:88px; }
      .qr { border-radius:12px; }
      .hero-link-stack .copy-row { display:none; }
      .copy-row input { height:42px; }
      .copy-row button, .hero-actions button, .guide-actions button { min-height:38px; }
      .hero-actions { gap:7px; margin-top:8px; }
      .hero-actions a, .hero-actions button, .guide-actions a, .guide-actions button { min-height:40px; font-size:12px; }
      .hero-actions, .copy-row, .hero-link-stack, .guide-actions { grid-template-columns:1fr; display:grid; }
      .hero-sync-status { display:grid; grid-template-columns:1fr 1fr; gap:6px; padding-top:0; }
      .hero-sync-status span, .hero-sync-status em { width:100%; min-height:30px; padding:5px 8px; justify-content:center; border-radius:12px; font-size:10px; line-height:1.25; text-align:center; }
      .hero-sync-status span:first-child, .hero-sync-status em { grid-column:1 / -1; font-size:11px; }
      .hero-sync-status b { width:6px; height:6px; margin-right:6px; }
      .hero-bottom-board { grid-template-columns:repeat(4, minmax(0, 1fr)); bottom:26px; }
      .led-stat { min-height:56px; border-top:0; }
      .led-stat:nth-child(-n+2) { border-top:0; }
      .led-stat:nth-child(odd) { border-left:1px solid rgba(255,255,255,.08); }
      .led-stat:first-child { border-left:0; }
      .led-stat strong { font-size:22px; }
      .led-stat span { margin-top:5px; font-size:10px; }
      .sponsor-head { display:grid; }
      .alipay-trust { width:max-content; }
      .amount-grid { grid-template-columns:repeat(3, minmax(0, 1fr)); }
      .schedule-tabs button { min-width:0; min-height:46px; padding:0 6px; font-size:12px; }
      .match-row { grid-template-columns:1fr; border-radius:18px; padding:14px; gap:12px; }
      .match-core { grid-template-columns:minmax(0, 1fr) 82px minmax(0, 1fr); gap:8px; }
      .team { gap:7px; font-size:15px; align-items:center; }
      .team-name { white-space:normal; line-height:1.25; }
      .team-flag { min-width:42px; height:29px; border-radius:5px; font-size:27px; }
      .score-box { width:82px; min-height:34px; font-size:18px; }
      .team.home { justify-content:flex-end; }
      .match-side { grid-column:auto; grid-template-columns:1fr; gap:10px; padding-left:0; }
      .venue { white-space:normal; text-align:left; }
      .watch-links { justify-content:flex-start; }
      .watch-links a { width:148px; min-height:38px; padding:0 16px; }
      .knockout-stage { margin-left:-4px; margin-right:-4px; border-radius:18px; }
      .knockout-stage-head { min-height:auto; display:grid; gap:4px; padding:12px 14px; }
      .knockout-stage-head strong { font-size:14px; }
      .knockout-canvas-wrap { margin-left:0; margin-right:0; padding:5px; overflow:visible; }
      .knockout-canvas { width:100%; min-width:0; border-radius:10px; }
      .bracket-match-card { border-radius:4px; padding:2px 3px; gap:1px; border-width:.5px; box-shadow:0 4px 10px rgba(0,0,0,.22), inset 0 0 0 1px rgba(255,255,255,.035); }
      .bracket-card-head { gap:2px; font-size:clamp(4px, 1.18vw, 8px); line-height:1.05; }
      .bracket-card-head span { gap:0; }
      .bracket-card-head time { font-size:clamp(4px, 1.06vw, 7px); }
      .bracket-card-head b { font-size:clamp(5px, 1.35vw, 9px); }
      .bracket-card-main { gap:2px; }
      .bracket-score { min-width:12px; font-size:clamp(7px, 2.1vw, 14px); }
      .bracket-team { font-size:clamp(4px, 1.12vw, 8px); gap:1px; }
      .bracket-card-foot { font-size:clamp(4px, 1vw, 7px); gap:2px; }
      .bracket-card-foot a { display:none; }
      .bracket-team i { width:13px; height:10px; font-size:8px; border-radius:3px; }
      .bracket-team i.placeholder::before { width:9px; height:7px; border-width:1px; border-top-width:2px; border-radius:3px 3px 4px 4px; }
      .bracket-team i.placeholder::after { width:12px; height:3px; transform:translateY(-4px); }
      .team-index-toolbar { grid-template-columns:1fr; gap:9px; padding:10px; border-radius:16px; }
      .team-search { gap:5px; }
      .team-search input { height:36px; font-size:12px; }
      .team-group-filter { padding-bottom:1px; }
      .team-group-filter button { min-width:38px; min-height:30px; padding:0 9px; font-size:11px; }
      .team-result-count { justify-self:start; min-height:28px; padding:0 10px; font-size:11px; }
      .team-grid-scroll { max-height:min(560px, calc(100dvh - 230px)); padding-right:2px; }
      .team-grid { grid-template-columns:repeat(2, minmax(0, 1fr)); gap:9px; }
      .custom-team-picker { grid-template-columns:1fr; max-height:none; }
      .team-feed-card { min-height:118px; padding:8px; gap:6px; background:linear-gradient(180deg, rgba(4,19,12,.96), rgba(0,0,0,.82)); border-radius:13px; }
      .team-feed-main { grid-template-columns:31px minmax(0, 1fr); gap:6px; }
      .team-feed-flag { width:31px; height:22px; font-size:18px; border-radius:6px; }
      .team-feed-card strong { font-size:13px; }
      .team-feed-card small { margin-top:2px; font-size:9px; }
      .team-card-record { display:none; }
      .team-next-match { min-height:34px; gap:3px; padding:5px 0; }
      .team-next-match strong { font-size:10px; }
      .team-next-match em { gap:2px; font-size:10px; }
      .share-page { padding:16px 12px 54px; }
      .share-actions { display:grid; grid-template-columns:1fr; }
      .share-poster { width:min(100%, 420px); border-radius:22px; padding:18px 16px 14px; gap:8px; }
      .poster-topline b { font-size:20px; }
      .poster-title { font-size:clamp(28px, 8.6vw, 36px); }
      .poster-owner { font-size:11px; letter-spacing:.03em; }
      .poster-ribbon { min-height:38px; padding:0 12px; border-radius:10px; }
      .poster-ribbon-flag { width:32px; height:23px; font-size:17px; }
      .poster-ribbon strong { font-size:12px; }
      .poster-stats { min-height:34px; padding:0 8px; }
      .poster-stats span { padding:0 6px; gap:2px; }
      .poster-stats strong { font-size:clamp(16px, 5vw, 21px); }
      .poster-stats em { font-size:8px; }
      .poster-feature-strip { grid-template-columns:repeat(2, minmax(0, 1fr)); min-height:24px; gap:4px; }
      .poster-feature-strip span { min-height:25px; font-size:9px; }
      .poster-stage { min-height:150px; margin:-2px -6px -4px; }
      .poster-stage img { width:min(72%, 188px); max-height:188px; }
      .poster-focus-list { gap:7px; padding:9px; border-radius:18px; }
      .poster-focus-tags { min-height:116px; gap:5px; }
      .poster-focus-tags span { max-width:104px; min-height:28px; padding:0 10px; font-size:11px; }
      .poster-ticket { min-height:94px; grid-template-columns:64px minmax(0, 1fr) 84px; gap:8px; margin:4px -6px 0; padding:12px 8px 8px; }
      .poster-ticket strong { font-size:13px; }
      .poster-ticket span { margin-top:5px; font-size:10px; }
      .poster-barcode { font-size:7px; }
      .poster-barcode i { width:52px; height:40px; }
      .poster-qr { width:84px; height:84px; padding:5px; border-radius:12px; }
      .poster-url { font-size:10px; }
      .poster-actions { width:min(100%, 420px); grid-template-columns:1fr; }
      .poster-more-actions div { grid-template-columns:1fr; }
      .share-brief { width:min(100%, 420px); }
      .guide-panel, .honor-panel { padding:20px; border-radius:20px; }
      .sync-status { gap:7px; }
      .sync-status span, .sync-status em { width:100%; justify-content:center; text-align:center; border-radius:14px; padding:7px 10px; }
      .hero-sync-status { grid-template-columns:1fr 1fr; gap:6px; }
      .hero-sync-status span, .hero-sync-status em { min-height:30px; padding:5px 8px; border-radius:12px; font-size:10px; line-height:1.25; }
      .hero-sync-status span:first-child, .hero-sync-status em { grid-column:1 / -1; font-size:11px; }
      .schedule-summary { grid-template-columns:1fr; gap:5px; text-align:left; }
      .schedule-summary span, .schedule-summary strong { min-width:0; }
      .schedule-summary em { text-align:left; white-space:normal; }
      .guide-grid, .guide-steps, .device-guides, .honor-board { grid-template-columns:1fr; }
      .honor-rules span { width:100%; white-space:normal; }
      .guide-steps { margin-top:28px; gap:12px; }
      .guide-steps div { min-height:118px; grid-template-rows:58px 28px minmax(38px, auto); }
      .guide-steps strong { font-size:52px; }
      .honor-empty { min-height:220px; }
      .honor-sponsor-panel .honor-empty { min-height:132px; }
      .honor-rank-panel { min-height:320px; }
      .honor-rank-list { max-height:360px; }
      .honor-card { grid-template-columns:34px minmax(0, 1fr) auto; }
      .feedback-intro { display:grid; gap:8px; text-align:left; }
      .feedback-fields { grid-template-columns:1fr; }
      .feedback-message-field { grid-column:auto; }
      .feedback-card button { min-height:42px; }
      .guide-grid article { min-height:auto; }
      .preset-grid { grid-template-columns:repeat(2, minmax(0, 1fr)); }
      .star-picker { grid-template-columns:repeat(2, minmax(0, 1fr)); }
      .custom-team-picker { grid-template-columns:repeat(2, minmax(0, 1fr)); }
      .sponsor-stage { gap:18px; }
      .sponsor-progress { min-height:auto; padding:20px; border-radius:20px; }
      .progress-row strong { font-size:42px; }
      .progress-row { display:grid; }
      .progress-row span { text-align:left; }
      .support-actions { display:grid; grid-template-columns:1fr; }
      .support-button { min-height:44px; }
      .grid { grid-template-columns:1fr; }
    }
  </style>
</head>
<body>
  <div class="site-bg">
    <div class="site-overlay">
      ${body}
    </div>
  </div>
<script>
  async function copyText(value) {
    if (navigator.clipboard && window.isSecureContext) {
      try {
        await navigator.clipboard.writeText(value);
        return;
      } catch {}
    }
    const textarea = document.createElement("textarea");
    textarea.value = value;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.left = "-9999px";
    document.body.appendChild(textarea);
    textarea.select();
    const ok = document.execCommand("copy");
    textarea.remove();
    if (!ok) throw new Error("copy failed");
  }

  document.addEventListener("click", async (event) => {
    if (!(event.target instanceof Element)) return;
    const button = event.target.closest("[data-copy]");
    if (!button) return;
    const value = button.getAttribute("data-copy");
    if (!value) return;
    const original = button.textContent;
    try {
      await copyText(value);
      button.textContent = "已复制";
    } catch {
      const input = button.closest(".copy-row")?.querySelector("input");
      input?.focus();
      input?.select();
      button.textContent = "已选中";
    }
    setTimeout(() => {
      button.textContent = original;
    }, 1600);
  });

  document.addEventListener("click", async (event) => {
    if (!(event.target instanceof Element)) return;
    const button = event.target.closest("[data-native-share]");
    if (!button) return;
    const url = button.getAttribute("data-share-url") || window.location.href;
    const title = button.getAttribute("data-share-title") || document.title;
    if (navigator.share) {
      try {
        await navigator.share({ title, text: "北京时间、中文队名、赛果持续同步。", url });
        return;
      } catch {}
    }
    const original = button.textContent;
    try {
      await copyText(url);
      button.textContent = "分享链接已复制";
    } catch {
      button.textContent = "请手动复制链接";
    }
    setTimeout(() => {
      button.textContent = original;
    }, 1600);
  });

  async function blobToDataUrl(blob) {
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  async function imageUrlToDataUrl(url) {
    const response = await fetch(url, { cache: "force-cache" });
    if (!response.ok) throw new Error("图片素材加载失败");
    return blobToDataUrl(await response.blob());
  }

  async function inlinePosterImages(root) {
    const images = Array.from(root.querySelectorAll("img"));
    await Promise.all(
      images.map(async (image) => {
        const src = image.getAttribute("src");
        if (!src || src.startsWith("data:")) return;
        const absolute = new URL(src, window.location.href).href;
        image.setAttribute("src", await imageUrlToDataUrl(absolute));
      })
    );
  }

  function showPosterSavePreview(pngUrl) {
    document.querySelector(".poster-preview-layer")?.remove();
    const layer = document.createElement("div");
    layer.className = "poster-preview-layer";
    layer.setAttribute("role", "dialog");
    layer.setAttribute("aria-modal", "true");
    layer.setAttribute("aria-label", "保存海报图片");
    const card = document.createElement("div");
    card.className = "poster-preview-card";
    const image = document.createElement("img");
    image.src = pngUrl;
    image.alt = "世界杯个性化日历分享海报";
    const title = document.createElement("strong");
    title.textContent = "海报已生成";
    const tip = document.createElement("span");
    tip.textContent = "如果浏览器没有自动下载，可以长按图片或右键保存。";
    const close = document.createElement("button");
    close.type = "button";
    close.textContent = "关闭";
    close.addEventListener("click", () => layer.remove());
    layer.addEventListener("click", (event) => {
      if (event.target === layer) layer.remove();
    });
    card.append(image, title, tip, close);
    layer.append(card);
    document.body.appendChild(layer);
  }

  function canvasRoundRect(context, x, y, width, height, radius) {
    const r = Math.min(radius, width / 2, height / 2);
    context.beginPath();
    context.moveTo(x + r, y);
    context.arcTo(x + width, y, x + width, y + height, r);
    context.arcTo(x + width, y + height, x, y + height, r);
    context.arcTo(x, y + height, x, y, r);
    context.arcTo(x, y, x + width, y, r);
    context.closePath();
  }

  function canvasFillRoundRect(context, x, y, width, height, radius, fill, stroke) {
    canvasRoundRect(context, x, y, width, height, radius);
    context.fillStyle = fill;
    context.fill();
    if (stroke) {
      context.strokeStyle = stroke;
      context.lineWidth = 2;
      context.stroke();
    }
  }

  function loadCanvasImage(src) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.crossOrigin = "anonymous";
      image.onload = () => resolve(image);
      image.onerror = reject;
      image.src = src;
    });
  }

  function drawCoverImage(context, image, x, y, width, height) {
    const scale = Math.max(width / image.naturalWidth, height / image.naturalHeight);
    const sourceWidth = width / scale;
    const sourceHeight = height / scale;
    const sourceX = (image.naturalWidth - sourceWidth) / 2;
    const sourceY = (image.naturalHeight - sourceHeight) / 2;
    context.drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight, x, y, width, height);
  }

  function drawContainImage(context, image, x, y, width, height) {
    const scale = Math.min(width / image.naturalWidth, height / image.naturalHeight);
    const drawWidth = image.naturalWidth * scale;
    const drawHeight = image.naturalHeight * scale;
    const drawX = x + (width - drawWidth) / 2;
    const drawY = y + (height - drawHeight) / 2;
    context.drawImage(image, drawX, drawY, drawWidth, drawHeight);
  }

  function setCanvasFont(context, size, weight) {
    context.font = weight + " " + size + "px -apple-system, BlinkMacSystemFont, 'PingFang SC', 'Microsoft YaHei', sans-serif";
  }

  function drawCenteredCanvasText(context, text, x, y, maxWidth, size, weight, color) {
    let fontSize = size;
    context.fillStyle = color;
    setCanvasFont(context, fontSize, weight);
    while (fontSize > 22 && context.measureText(text).width > maxWidth) {
      fontSize -= 2;
      setCanvasFont(context, fontSize, weight);
    }
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(text, x, y, maxWidth);
  }

  function drawLeftCanvasText(context, text, x, y, maxWidth, size, weight, color) {
    let fontSize = size;
    context.fillStyle = color;
    setCanvasFont(context, fontSize, weight);
    while (fontSize > 18 && context.measureText(text).width > maxWidth) {
      fontSize -= 2;
      setCanvasFont(context, fontSize, weight);
    }
    context.textAlign = "left";
    context.textBaseline = "middle";
    context.fillText(text, x, y, maxWidth);
  }

  function drawRightCanvasText(context, text, x, y, maxWidth, size, weight, color) {
    let fontSize = size;
    context.fillStyle = color;
    setCanvasFont(context, fontSize, weight);
    while (fontSize > 18 && context.measureText(text).width > maxWidth) {
      fontSize -= 2;
      setCanvasFont(context, fontSize, weight);
    }
    context.textAlign = "right";
    context.textBaseline = "middle";
    context.fillText(text, x, y, maxWidth);
  }

  function serializeQrToDataUrl() {
    const qrSvg = document.querySelector(".poster-qr svg");
    if (!qrSvg) return "";
    const source = new XMLSerializer().serializeToString(qrSvg);
    return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(source);
  }

  async function renderPosterCanvasPng() {
    const poster = document.querySelector(".share-poster");
    if (!poster) throw new Error("海报节点不存在");
    const width = 1080;
    const height = 1920;
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("当前浏览器不支持海报生成");

    const stadium = await loadCanvasImage(new URL("/assets/img/stadium-hero-mobile.webp", window.location.href).href);
    const trophy = await loadCanvasImage(new URL("/assets/img/worldcup-trophy-hero.webp", window.location.href).href);
    const qrDataUrl = serializeQrToDataUrl();
    const qrImage = qrDataUrl ? await loadCanvasImage(qrDataUrl) : null;

    drawCoverImage(context, stadium, 0, 0, width, height);
    let gradient = context.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, "rgba(0,0,0,.62)");
    gradient.addColorStop(.35, "rgba(2,14,9,.34)");
    gradient.addColorStop(.72, "rgba(0,0,0,.68)");
    gradient.addColorStop(1, "rgba(0,0,0,.94)");
    context.fillStyle = gradient;
    context.fillRect(0, 0, width, height);

    context.save();
    context.globalAlpha = .86;
    context.shadowColor = "rgba(0,0,0,.78)";
    context.shadowBlur = 44;
    drawContainImage(context, trophy, 340, 610, 400, 500);
    context.restore();

    context.strokeStyle = "rgba(0,255,102,.48)";
    context.lineWidth = 2;
    context.beginPath();
    context.moveTo(126, 82);
    context.lineTo(434, 82);
    context.moveTo(646, 82);
    context.lineTo(954, 82);
    context.stroke();
    drawCenteredCanvasText(context, "2026", 540, 82, 180, 58, "1000", "#00ff66");

    drawCenteredCanvasText(context, poster.querySelector(".poster-title")?.textContent?.trim() || "我的世界杯观赛日历", 540, 188, 900, 78, "1000", "#f4fff7");
    drawCenteredCanvasText(context, poster.querySelector(".poster-subtitle")?.textContent?.trim() || "一键导入手机日历", 540, 266, 860, 34, "1000", "#00ff66");
    drawCenteredCanvasText(context, poster.querySelector(".poster-owner")?.textContent?.trim() || "个性化专属赛程订阅", 540, 318, 860, 30, "950", "#eef6f2");

    const tags = Array.from(poster.querySelectorAll(".poster-tags span")).map((item) => item.textContent?.trim()).filter(Boolean).slice(0, 6);
    let tagX = 540 - Math.min(760, tags.length * 122) / 2;
    tags.forEach((tag) => {
      const tagWidth = Math.min(148, Math.max(88, context.measureText(tag).width + 42));
      canvasFillRoundRect(context, tagX, 370, tagWidth, 48, 24, "rgba(0,0,0,.42)", "rgba(235,248,255,.16)");
      drawCenteredCanvasText(context, tag, tagX + tagWidth / 2, 394, tagWidth - 20, 24, "1000", "#eaffef");
      tagX += tagWidth + 12;
    });

    const stats = Array.from(poster.querySelectorAll(".poster-stats span")).map((item) => ({
      value: item.querySelector("strong")?.textContent?.trim() || "",
      label: item.querySelector("em")?.textContent?.trim() || ""
    })).filter((item) => item.value || item.label);
    canvasFillRoundRect(context, 120, 454, 840, 76, 38, "rgba(0,0,0,.36)", "rgba(235,248,255,.18)");
    stats.slice(0, 3).forEach((stat, index) => {
      const centerX = 260 + index * 280;
      drawRightCanvasText(context, stat.value, centerX, 492, 82, 44, "1000", "#00ff66");
      drawLeftCanvasText(context, stat.label, centerX + 9, 494, 145, 22, "900", "#d3e3d9");
      if (index > 0) {
        context.strokeStyle = "rgba(235,248,255,.13)";
        context.beginPath();
        context.moveTo(120 + index * 280, 472);
        context.lineTo(120 + index * 280, 512);
        context.stroke();
      }
    });

    const features = Array.from(poster.querySelectorAll(".poster-feature-strip span")).map((item) => item.textContent?.trim()).filter(Boolean);
    features.slice(0, 4).forEach((feature, index) => {
      const x = 90 + index * 225;
      canvasFillRoundRect(context, x, 562, 200, 52, 16, "rgba(0,255,102,.10)", "rgba(0,255,102,.20)");
      drawCenteredCanvasText(context, feature, x + 100, 588, 176, 22, "1000", "#dcece3");
    });

    canvasFillRoundRect(context, 76, 1054, 928, 318, 28, "rgba(8,42,30,.42)", "rgba(235,248,255,.20)");
    drawLeftCanvasText(context, "我的定制关注", 112, 1104, 300, 34, "1000", "#ffffff");
    drawRightCanvasText(context, poster.querySelector(".poster-focus-head span")?.textContent?.trim() || "", 966, 1104, 400, 22, "900", "#aebfb4");
    const focusTags = Array.from(poster.querySelectorAll(".poster-focus-tags span")).map((item) => ({
      kind: item.getAttribute("data-focus-kind") || "people",
      text: item.textContent?.trim() || ""
    })).filter((item) => item.text);
    let tagCursorX = 122;
    let tagCursorY = 1150;
    const tagMaxX = 958;
    const tagRowGap = 14;
    const tagHeight = 44;
    const focusTagPalette = {
      people: { fill: "rgba(10,26,17,.60)", stroke: "rgba(0,255,102,.24)", text: "rgba(255,255,255,.92)", glow: "rgba(0,255,102,.10)", shadow: "rgba(4,45,28,.58)" },
      trait: { fill: "rgba(10,26,17,.60)", stroke: "rgba(0,255,102,.24)", text: "rgba(255,255,255,.92)", glow: "rgba(0,255,102,.10)", shadow: "rgba(4,45,28,.58)" }
    };
    focusTags.slice(0, 18).forEach((tag) => {
      setCanvasFont(context, 24, "1000");
      const tagWidth = Math.min(200, Math.max(104, context.measureText(tag.text).width + 52));
      if (tagCursorX + tagWidth > tagMaxX) {
        tagCursorX = 122;
        tagCursorY += tagHeight + tagRowGap;
      }
      if (tagCursorY > 1280) return;
      const palette = tag.kind === "trait" ? focusTagPalette.trait : focusTagPalette.people;
      context.save();
      context.shadowColor = palette.glow;
      context.shadowBlur = 13;
      canvasFillRoundRect(context, tagCursorX, tagCursorY, tagWidth, tagHeight, 22, palette.fill, palette.stroke);
      context.restore();
      context.save();
      context.globalAlpha = .16;
      canvasFillRoundRect(context, tagCursorX + 8, tagCursorY + 3, tagWidth - 16, 14, 8, "rgba(255,255,255,.32)");
      context.restore();
      context.save();
      context.shadowColor = palette.shadow;
      context.shadowBlur = 8;
      drawCenteredCanvasText(context, tag.text, tagCursorX + tagWidth / 2, tagCursorY + tagHeight / 2, tagWidth - 24, 24, "1000", palette.text);
      context.restore();
      tagCursorX += tagWidth + 12;
    });
    drawCenteredCanvasText(context, poster.querySelector(".poster-focus-list p")?.textContent?.trim() || "完整赛程已进入专属日历", 540, 1338, 740, 22, "1000", "#bfffd8");

    context.setLineDash([12, 12]);
    context.strokeStyle = "rgba(235,248,255,.46)";
    context.beginPath();
    context.moveTo(72, 1462);
    context.lineTo(1008, 1462);
    context.stroke();
    context.setLineDash([]);
    canvasFillRoundRect(context, 82, 1490, 916, 256, 22, "rgba(2,12,8,.68)", "rgba(235,248,255,.16)");
    drawLeftCanvasText(context, "扫码添加同款赛程日历", 330, 1588, 420, 40, "1000", "#dfffdf");
    drawLeftCanvasText(context, "网络订阅源 · 订阅后自动同步", 330, 1644, 430, 24, "900", "#aebfb4");
    context.fillStyle = "rgba(255,255,255,.86)";
    for (let x = 128; x < 266; x += 12) {
      const barWidth = x % 24 === 0 ? 6 : 3;
      context.fillRect(x, 1580, barWidth, 82);
    }
    drawCenteredCanvasText(context, "WC2026", 198, 1692, 180, 18, "800", "#aebfb4");
    if (qrImage) {
      canvasFillRoundRect(context, 780, 1532, 150, 150, 18, "#ffffff", "rgba(0,255,102,.42)");
      context.drawImage(qrImage, 792, 1544, 126, 126);
    }

    drawCenteredCanvasText(context, "wc2026.funengzhe.cn", 540, 1816, 720, 30, "1000", "#00ff66");
    drawCenteredCanvasText(context, "个性化世界杯赛程 · 一键添加到手机日历", 540, 1862, 820, 24, "900", "#c7d8ce");
    return canvas.toDataURL("image/png");
  }

  async function downloadPosterImage(button) {
    const original = button.textContent;
    button.disabled = true;
    button.textContent = "正在生成海报...";
    try {
      const pngUrl = await renderPosterCanvasPng();
      const link = document.createElement("a");
      link.href = pngUrl;
      link.download = "wc2026-calendar-poster.png";
      document.body.appendChild(link);
      link.click();
      link.remove();
      showPosterSavePreview(pngUrl);
      button.textContent = "海报已生成";
    } catch (error) {
      button.textContent = "生成失败，请截图保存";
    } finally {
      setTimeout(() => {
        button.disabled = false;
        button.textContent = original;
      }, 1800);
    }
  }

  document.addEventListener("click", (event) => {
    if (!(event.target instanceof Element)) return;
    const button = event.target.closest("[data-download-poster]");
    if (!button) return;
    event.preventDefault();
    downloadPosterImage(button);
  });

  const isWechatBrowser = /MicroMessenger/i.test(window.navigator.userAgent || "");
  const wechatTip = document.getElementById("wechat-tip");

  function escapeClientText(value) {
    return String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  function normalizeClientAmount(value) {
    const amount = Number(value);
    return Number.isFinite(amount) ? amount.toFixed(2) : "0.00";
  }

  function formatClientSponsorTime(value) {
    if (!value) return "刚刚";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return new Intl.DateTimeFormat("zh-CN", {
      timeZone: "Asia/Shanghai",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false
    }).format(date);
  }

  function sponsorClientBadge(rank, amount) {
    if (rank === 1) return "头号球迷";
    if (rank === 2) return "核心球迷";
    if (rank === 3) return "助攻球迷";
    if (amount >= 50) return "荣耀球迷";
    return "";
  }

  function renderClientSponsorCard(sponsor, rank, isDemo) {
    const amount = normalizeClientAmount(sponsor.amount);
    const badge = isDemo ? "" : sponsorClientBadge(rank, Number(amount));
    const note = sponsor.note ? " · " + sponsor.note : "";
    return \`
      <article class="honor-card\${badge ? " highlighted" : ""}\${rank <= 3 && !isDemo ? " rank-" + rank : ""}\${isDemo ? " demo" : ""}">
        <b>\${String(rank).padStart(2, "0")}</b>
        <div>
          <strong>\${badge ? '<span class="rank-badge">' + escapeClientText(badge) + '</span>' : ""}\${escapeClientText(sponsor.displayName || "匿名球迷")}</strong>
          <span>\${escapeClientText(formatClientSponsorTime(sponsor.paidAt))}\${escapeClientText(note)}</span>
        </div>
        <em>¥ \${escapeClientText(amount)}</em>
      </article>
    \`;
  }

  function clientMockSponsors(offset) {
    return [
      { displayName: "绿茵同路人", amount: "1.00", paidAt: "刚刚", note: "免费也欢迎使用" },
      { displayName: "夜场看球员", amount: "1.00", paidAt: "8分钟前", note: "支持开源" },
      { displayName: "赛程收藏家", amount: "1.00", paidAt: "19分钟前", note: "订阅成功" },
      { displayName: "匿名球迷", amount: "1.00", paidAt: "32分钟前", note: "一起看球" },
      { displayName: "代码搬运工", amount: "1.00", paidAt: "1小时前", note: "持续维护" },
      { displayName: "主场观众", amount: "1.00", paidAt: "2小时前", note: "绿茵见" }
    ].map((sponsor, index) => renderClientSponsorCard(sponsor, offset + index + 1, true));
  }

  function showPaymentToast(title, message) {
    const existing = document.querySelector(".payment-toast");
    existing?.remove();
    const toast = document.createElement("div");
    toast.className = "payment-toast";
    toast.setAttribute("role", "status");
    toast.setAttribute("aria-live", "polite");
    toast.innerHTML = \`<strong>\${escapeClientText(title)}</strong><span>\${escapeClientText(message)}</span>\`;
    document.body.appendChild(toast);
    setTimeout(() => toast.classList.add("is-hiding"), 5200);
    setTimeout(() => toast.remove(), 5600);
  }

  async function refreshHonorWallFromApi() {
    const list = document.querySelector("[data-honor-list]");
    const count = document.querySelector("[data-honor-count]");
    if (!list || !count) return;
    const response = await fetch("/api/v1/sponsors", { cache: "no-store" });
    const payload = await response.json();
    const sponsors = Array.isArray(payload.sponsors) ? payload.sponsors : [];
    if (!payload.ok || sponsors.length === 0) return;
    const realCards = sponsors.slice(0, 30).map((sponsor, index) => renderClientSponsorCard(sponsor, index + 1, false));
    list.innerHTML = [...realCards, ...clientMockSponsors(realCards.length)].join("");
    count.textContent = "荣耀榜单实时更新";
  }

  const paymentStatus = new URLSearchParams(window.location.search).get("payment");
  if (paymentStatus === "success" || paymentStatus === "return") {
    const honorWall = document.getElementById("honor-wall");
    setTimeout(() => honorWall?.scrollIntoView({ behavior: "smooth", block: "start" }), 180);
    showPaymentToast("赞助支付成功", "感谢支持，荣耀榜正在同步刷新。");
    refreshHonorWallFromApi().catch(() => {});
    setTimeout(() => refreshHonorWallFromApi().catch(() => {}), 2500);
    window.history.replaceState({}, "", window.location.pathname + "#honor-wall");
  }

  document.addEventListener("click", (event) => {
    if (!isWechatBrowser || !(event.target instanceof Element)) return;
    const link = event.target.closest("a[data-webcal-link], a[href^='webcal:']");
    if (!link) return;
    event.preventDefault();
    const href = link.getAttribute("href") || "";
    if (href) {
      copyText(href).catch(() => {});
    }
    if (wechatTip) {
      const title = wechatTip.querySelector("strong");
      const body = wechatTip.querySelector("span");
      if (title) title.textContent = "微信内无法直接唤起系统日历";
      if (body) {
        body.textContent =
          "订阅链接已复制。请点击右上角“...”选择“在浏览器打开”，再点“一键添加到手机日历”；也可以到系统日历里手动添加网络订阅。";
      }
      wechatTip.hidden = false;
      wechatTip.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  });

  const sponsorCheckout = document.getElementById("sponsor-checkout");
  const sponsorButtons = Array.from(document.querySelectorAll("[data-sponsor-amount]"));
  const sponsorCustomAmount = document.getElementById("sponsor-custom-amount");
  const sponsorDisplayName = document.getElementById("sponsor-display-name");
  const sponsorNote = document.getElementById("sponsor-note");
  const sponsorPayButton = document.getElementById("sponsor-pay-button");
  const sponsorPayLabel = sponsorPayButton?.querySelector("[data-pay-label]");
  const sponsorMessage = document.getElementById("sponsor-message");
  let selectedSponsorAmount = "5";
  let sponsorSubmitting = false;

  function setSponsorMessage(message, type) {
    if (!sponsorMessage) return;
    sponsorMessage.textContent = message || "";
    sponsorMessage.classList.toggle("error", type === "error");
    sponsorMessage.classList.toggle("success", type === "success");
  }

  function setSponsorSubmitting(isSubmitting) {
    sponsorSubmitting = isSubmitting;
    if (sponsorPayButton) sponsorPayButton.disabled = isSubmitting;
    if (sponsorPayLabel) {
      sponsorPayLabel.textContent = isSubmitting ? "正在安全连接支付宝..." : "立即唤起支付宝赞助";
    }
  }

  sponsorButtons.forEach((button) => {
    button.addEventListener("click", () => {
      selectedSponsorAmount = button.getAttribute("data-sponsor-amount") || "5";
      sponsorButtons.forEach((item) => item.classList.toggle("active", item === button));
      if (sponsorCustomAmount) sponsorCustomAmount.value = "";
      setSponsorMessage("", "");
    });
  });

  sponsorCustomAmount?.addEventListener("input", () => {
    selectedSponsorAmount = "";
    sponsorButtons.forEach((item) => item.classList.remove("active"));
    setSponsorMessage("", "");
  });

  document.addEventListener("click", (event) => {
    if (!(event.target instanceof Element)) return;
    const openSponsor = event.target.closest("[data-open-sponsor]");
    if (!openSponsor) return;
    sponsorCheckout?.scrollIntoView({ behavior: "smooth", block: "center" });
    setSponsorMessage("选择金额后即可唤起支付宝，支付成功会自动进入英雄榜。", "success");
    setTimeout(() => sponsorDisplayName?.focus(), 500);
  });

  sponsorPayButton?.addEventListener("click", async () => {
    if (sponsorSubmitting) return;
    const customAmount = sponsorCustomAmount?.value?.trim();
    const finalAmount = customAmount || selectedSponsorAmount;
    const amount = Number(finalAmount);
    if (!Number.isFinite(amount) || amount < 1 || amount > 999) {
      setSponsorMessage("请输入 1-999 元之间的有效赞助金额。", "error");
      return;
    }

    setSponsorSubmitting(true);
    setSponsorMessage("正在创建支付宝安全订单...", "");
    try {
      const response = await fetch("/api/v1/alipay/create_order", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          amount,
          displayName: sponsorDisplayName?.value?.trim(),
          note: sponsorNote?.value?.trim()
        })
      });
      const payload = await response.json();
      if (!response.ok || !payload.ok || !payload.formHtml) {
        throw new Error(payload.message || "支付通道暂时不可用");
      }

      setSponsorMessage("订单已创建，正在跳转支付宝...", "success");
      const mount = document.createElement("div");
      mount.hidden = true;
      mount.innerHTML = payload.formHtml;
      document.body.appendChild(mount);
      const form = mount.querySelector("form");
      if (!form) throw new Error("支付宝表单生成失败");
      form.submit();
    } catch (error) {
      setSponsorMessage(error instanceof Error ? error.message : "创建支付订单失败", "error");
      setSponsorSubmitting(false);
    }
  });

  const feedbackForm = document.getElementById("feedback-form");
  const feedbackMessage = document.getElementById("feedback-message");
  feedbackForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const submitButton = feedbackForm.querySelector("button[type='submit']");
    const setFeedbackMessage = (message, type) => {
      if (!feedbackMessage) return;
      feedbackMessage.textContent = message;
      feedbackMessage.classList.toggle("success", type === "success");
      feedbackMessage.classList.toggle("error", type === "error");
    };
    submitButton.disabled = true;
    setFeedbackMessage("正在发送...", "");
    try {
      const data = new FormData(feedbackForm);
      const payload = {
        type: data.get("type"),
        name: data.get("name"),
        contact: data.get("contact"),
        message: data.get("message"),
        website: data.get("website"),
        page: window.location.href
      };
      const response = await fetch("/api/v1/feedback", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload)
      });
      const result = await response.json();
      if (!response.ok || !result.ok) throw new Error(result.message || "发送失败");
      feedbackForm.reset();
      setFeedbackMessage("已发送，感谢反馈。", "success");
    } catch (error) {
      setFeedbackMessage(error instanceof Error ? error.message : "发送失败，请稍后再试。", "error");
    } finally {
      submitButton.disabled = false;
    }
  });

  const scheduleDataEl = document.getElementById("schedule-data");
  const scheduleData = scheduleDataEl ? JSON.parse(scheduleDataEl.textContent || "{}") : null;
  const schedulePanel = document.getElementById("schedule-panel");
  const scheduleSummary = document.getElementById("schedule-summary");
  const emptyState = document.getElementById("empty-state");
  const subscribePanelView = document.getElementById("subscribe-panel-view");
  const datePicker = document.querySelector(".date-picker");
  let activeTab = "focus";
  let selectedDate = scheduleData?.selectedDate;

  function text(value) {
    return String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  function setTab(tab) {
    activeTab = tab;
    document.querySelectorAll("[data-tab]").forEach((item) => item.classList.toggle("active", item.dataset.tab === tab));
    document.querySelectorAll("[data-tab-link]").forEach((item) => item.classList.toggle("active", item.dataset.tabLink === tab));
    renderActiveView();
  }

  function setDate(dateKey) {
    selectedDate = dateKey;
    activeTab = "focus";
    document.querySelectorAll(".date-item").forEach((item) => item.classList.toggle("active", item.dataset.date === dateKey));
    setTab("focus");
  }

  function showSubscribePanel(show) {
    if (!subscribePanelView || !schedulePanel || !emptyState) return;
    subscribePanelView.hidden = !show;
    schedulePanel.hidden = show;
    emptyState.hidden = true;
  }

  function renderActiveView() {
    if (!scheduleData || !schedulePanel || !scheduleSummary || !emptyState || !datePicker) return;
    showSubscribePanel(false);
    datePicker.hidden = activeTab !== "focus";

    if (activeTab === "focus") {
      const day = scheduleData.days.find((item) => item.key === selectedDate);
      const matches = scheduleData.matches.filter((match) => match.dateKey === selectedDate);
      scheduleSummary.innerHTML =
        "<span>" +
        text(day?.label || "今日焦点") +
        "</span><strong>" +
        matches.length +
        " 场焦点赛程</strong><em>" +
        text(clientDayInsight(matches)) +
        "</em>";
      schedulePanel.innerHTML = matches.map(renderMatch).join("");
      emptyState.hidden = matches.length > 0;
      return;
    }

    if (activeTab === "teams") {
      scheduleSummary.innerHTML = "<span>球队赛程</span><strong>" + scheduleData.teams.length + " 支球队赛程概览</strong><em>按小组或队名快速查看下一场比赛</em>";
      schedulePanel.innerHTML = renderTeamIndex();
      emptyState.hidden = scheduleData.teams.length > 0;
      updateTeamIndexFilter();
      return;
    }

    if (activeTab === "knockout") {
      const matches = scheduleData.matches.filter((match) => match.stage !== "group");
      scheduleSummary.innerHTML =
        "<span>淘汰赛</span><strong>" +
        matches.length +
        " 场淘汰赛</strong><em>对阵出炉后会自动进入同一个订阅源</em>";
      schedulePanel.innerHTML = renderKnockoutGroups(matches);
      emptyState.hidden = matches.length > 0;
      return;
    }

    if (activeTab === "custom") {
      scheduleSummary.innerHTML = "<span>我的日历</span><strong>生成你的专属世界杯日历</strong><em>选择球队、球星、阶段和时间段后，可订阅也可分享</em>";
      datePicker.hidden = true;
      schedulePanel.innerHTML = renderCustomBuilder();
      emptyState.hidden = true;
      updateCustomPreview();
    }
  }

  function renderTeamIndex() {
    const groups = Array.from(new Set(scheduleData.teams.map((team) => team.group).filter(Boolean))).sort();
    return (
      '<section class="team-index"><div class="team-index-toolbar"><label class="team-search"><span>搜索球队</span><input type="search" data-team-index-search placeholder="输入中文队名、英文名、小组或国旗" /></label><div class="team-group-filter" aria-label="按小组筛选"><button class="active" type="button" data-team-group-filter="">全部</button>' +
      groups.map((group) => '<button type="button" data-team-group-filter="' + text(group) + '">' + text(group) + "</button>").join("") +
      '</div><strong class="team-result-count" data-team-result-count>' +
      scheduleData.teams.length +
      ' 支球队</strong></div><div class="team-grid-scroll"><div class="team-grid">' +
      scheduleData.teams.map(renderTeamFeed).join("") +
      '</div></div></section>'
    );
  }

  function renderTeamFeed(feed) {
    return (
      '<article class="team-feed-card" data-team-card data-team-group="' +
      text(feed.group) +
      '" data-team-search="' +
      text([feed.flag, feed.label, feed.slug, feed.group, feed.nextOpponent].join(" ")) +
      '"><div class="team-feed-main"><span class="team-feed-flag">' +
      text(feed.flag) +
      '</span><div><strong>' +
      text(feed.label) +
      '</strong><small><span>' +
      text(feed.group) +
      " · " +
      text(feed.matchCount) +
      ' 场</span><span class="team-card-record"> · 已完 ' +
      text(feed.finalCount) +
      " / 未赛 " +
      text(feed.upcomingCount) +
      '</span></small></div></div><div class="team-next-match"><strong>' +
      text(feed.nextDate) +
      '</strong><em><span>' +
      text(feed.nextTime) +
      '</span><span>' +
      text(feed.nextOpponent) +
      "</span></em></div></article>"
    );
  }

  function updateTeamIndexFilter() {
    const keyword = (document.querySelector("[data-team-index-search]")?.value || "").trim().toLowerCase();
    const activeGroup = document.querySelector("[data-team-group-filter].active")?.dataset.teamGroupFilter || "";
    let visibleCount = 0;
    document.querySelectorAll("[data-team-card]").forEach((card) => {
      const haystack = (card.getAttribute("data-team-search") || "").toLowerCase();
      const group = card.getAttribute("data-team-group") || "";
      const visible = (!keyword || haystack.includes(keyword)) && (!activeGroup || group === activeGroup);
      card.hidden = !visible;
      if (visible) visibleCount += 1;
    });
    const count = document.querySelector("[data-team-result-count]");
    if (count) count.textContent = visibleCount + " 支球队";
  }

  function clientDayInsight(matches) {
    if (!matches.length) return "这一天暂无比赛";
    const finalCount = matches.filter((match) => match.status === "final").length;
    const liveCount = matches.filter((match) => match.status === "live" || match.status === "halftime").length;
    const upcoming = matches.filter((match) => match.status === "scheduled");
    if (liveCount > 0) return liveCount + " 场进行中 · " + finalCount + " 场已完场 · " + upcoming.length + " 场未开赛";
    if (upcoming.length > 0) return finalCount + " 场已完场 · " + upcoming.length + " 场未开赛 · 下一场 " + upcoming[0].time;
    return finalCount + " 场已完场 · 赛果已写入订阅源";
  }

  function renderDayGroups(matches) {
    const byDay = new Map();
    for (const match of matches) {
      if (!byDay.has(match.dateKey)) byDay.set(match.dateKey, []);
      byDay.get(match.dateKey).push(match);
    }
    return Array.from(byDay.entries())
      .map(([dateKey, dayMatches]) => {
        const day = scheduleData.days.find((item) => item.key === dateKey);
        return (
          '<section class="day-group"><div class="day-heading">' +
          text(day?.label || dateKey) +
          "<span>" +
          dayMatches.length +
          ' 场</span></div><div class="day-matches">' +
          dayMatches.map(renderMatch).join("") +
          "</div></section>"
        );
      })
      .join("");
  }

  function renderKnockoutGroups(matches) {
    const byMatchNo = new Map(matches.map((match) => [Number(match.matchNo), match]));
    const pickMatches = (numbers) => numbers.map((number) => byMatchNo.get(number)).filter(Boolean);
    const slots = [
      ...slotMatches(pickMatches([74, 77, 73, 75, 83, 84, 81, 82]), "r32-left"),
      ...slotMatches(pickMatches([76, 78, 79, 80, 86, 88, 85, 87]), "r32-right"),
      ...slotMatches(pickMatches([89, 90, 93, 94]), "r16-left"),
      ...slotMatches(pickMatches([91, 92, 95, 96]), "r16-right"),
      ...slotMatches(pickMatches([97, 98]), "qf-left"),
      ...slotMatches(pickMatches([99, 100]), "qf-right"),
      ...slotMatches(pickMatches([101]), "sf-left"),
      ...slotMatches(pickMatches([102]), "sf-right"),
      ...slotMatches(pickMatches([104]), "final"),
      ...slotMatches(pickMatches([103]), "third")
    ];
    return (
      '<div class="knockout-stage"><div class="knockout-stage-head"><strong>2026 世界杯淘汰赛晋级树</strong></div><div class="knockout-canvas-wrap" aria-label="淘汰赛晋级树"><div class="knockout-canvas">' +
      slots.map((slot) => renderBracketSlot(slot)).join("") +
      "</div></div></div>"
    );
  }

  function slotMatches(matches, group) {
    const slotMap = bracketSlots();
    return slotMap[group].map((slot, index) => ({
      ...slot,
      match: matches[index]
    }));
  }

  function bracketSlots() {
    return {
      "r32-left": [
        { x: 1.6, y: 1.2, w: 15.4, h: 10.6, theme: "blue" },
        { x: 1.6, y: 12.7, w: 15.4, h: 10.6, theme: "blue" },
        { x: 1.6, y: 24.2, w: 15.4, h: 10.6, theme: "blue" },
        { x: 1.6, y: 35.7, w: 15.4, h: 10.6, theme: "blue" },
        { x: 1.6, y: 49.6, w: 15.4, h: 10.6, theme: "teal" },
        { x: 1.6, y: 61.1, w: 15.4, h: 10.6, theme: "teal" },
        { x: 1.6, y: 72.6, w: 15.4, h: 10.6, theme: "teal" },
        { x: 1.6, y: 84.1, w: 15.4, h: 10.6, theme: "teal" }
      ],
      "r16-left": [
        { x: 19.0, y: 4.9, w: 14.6, h: 10.6, theme: "blue" },
        { x: 19.0, y: 30.1, w: 14.6, h: 10.6, theme: "blue" },
        { x: 19.0, y: 55.4, w: 14.6, h: 10.6, theme: "teal" },
        { x: 19.0, y: 80.6, w: 14.6, h: 10.6, theme: "teal" }
      ],
      "qf-left": [
        { x: 23.9, y: 18.8, w: 14.8, h: 10.8, theme: "blue" },
        { x: 23.9, y: 68.5, w: 14.8, h: 10.8, theme: "teal" }
      ],
      "sf-left": [{ x: 30.4, y: 42.0, w: 12.7, h: 11.0, theme: "cyan" }],
      final: [{ x: 43.4, y: 32.6, w: 13.2, h: 21.4, theme: "gold" }],
      third: [{ x: 43.4, y: 65.2, w: 13.2, h: 14.2, theme: "bronze" }],
      "sf-right": [{ x: 56.9, y: 42.0, w: 12.7, h: 11.0, theme: "cyan" }],
      "qf-right": [
        { x: 61.3, y: 18.8, w: 14.8, h: 10.8, theme: "green" },
        { x: 61.3, y: 68.5, w: 14.8, h: 10.8, theme: "red" }
      ],
      "r16-right": [
        { x: 66.4, y: 4.9, w: 14.6, h: 10.6, theme: "green" },
        { x: 66.4, y: 30.1, w: 14.6, h: 10.6, theme: "green" },
        { x: 66.4, y: 55.4, w: 14.6, h: 10.6, theme: "red" },
        { x: 66.4, y: 80.6, w: 14.6, h: 10.6, theme: "red" }
      ],
      "r32-right": [
        { x: 83.0, y: 1.2, w: 15.4, h: 10.6, theme: "green" },
        { x: 83.0, y: 12.7, w: 15.4, h: 10.6, theme: "green" },
        { x: 83.0, y: 24.2, w: 15.4, h: 10.6, theme: "green" },
        { x: 83.0, y: 35.7, w: 15.4, h: 10.6, theme: "green" },
        { x: 83.0, y: 49.6, w: 15.4, h: 10.6, theme: "red" },
        { x: 83.0, y: 61.1, w: 15.4, h: 10.6, theme: "red" },
        { x: 83.0, y: 72.6, w: 15.4, h: 10.6, theme: "red" },
        { x: 83.0, y: 84.1, w: 15.4, h: 10.6, theme: "red" }
      ]
    };
  }

  function renderBracketSlot(slot) {
    const style = "--x:" + slot.x + "%;--y:" + slot.y + "%;--w:" + slot.w + "%;--h:" + slot.h + "%";
    if (!slot.match) {
      return '<article class="bracket-match-card empty theme-' + text(slot.theme) + '" style="' + text(style) + '"><div class="bracket-card-main">对阵待定</div></article>';
    }
    return renderKnockoutCard(slot.match, "theme-" + slot.theme, style);
  }

  function renderKnockoutCard(match, extraClass, style) {
    const date = match.dateKey ? match.dateKey.slice(5).replace("-", "月") + "日" : "";
    return (
      '<article class="bracket-match-card ' +
      text(extraClass || "") +
      '" style="' +
      text(style || "") +
      '"><div class="bracket-card-head"><span>' +
      text(stageShortLabel(match.stage)) +
      '<time>' +
      text(date) +
      " " +
      text(match.time) +
      '</time></span><b>M' +
      text(match.matchNo) +
      '</b></div><div class="bracket-card-main"><div class="bracket-team">' +
      bracketTeamIcon(match.home.flag) +
      "<span>" +
      text(match.home.name) +
      '</span></div><strong class="bracket-score">' +
      text(match.center) +
      '</strong><div class="bracket-team">' +
      bracketTeamIcon(match.away.flag) +
      "<span>" +
      text(match.away.name) +
      '</span></div></div><div class="bracket-card-foot"><span>' +
      text(match.statusLabel) +
      '</span><a class="' +
      text(match.watchClass) +
      '" href="' +
      text(match.cctvUrl) +
      '" target="_blank" rel="noreferrer">' +
      text(match.watchLabel) +
      "</a></div></article>"
    );
  }

  function bracketTeamIcon(flag) {
    if (flag) return '<i>' + text(flag) + "</i>";
    return '<i class="placeholder" aria-hidden="true"></i>';
  }

  function stageShortLabel(stage) {
    if (stage === "round-of-32") return "1/16决赛";
    if (stage === "round-of-16") return "1/8决赛";
    if (stage === "quarter-final") return "1/4决赛";
    if (stage === "semi-final") return "1/2决赛";
    if (stage === "final") return "决赛";
    if (stage === "third-place" || stage === "match-for-third-place") return "铜牌";
    return "淘汰赛";
  }

  let customInclude = [];
  let customExclude = [];
  let customLastRemoved = null;
  let customExpandedTeams = false;
  let customPacks = [];
  let customSavedQuery = "";
  let customSavedShareUrl = "";
  let customSavedWebcalUrl = "";

  function renderCustomBuilder() {
    customInclude = [];
    customExclude = [];
    customLastRemoved = null;
    customExpandedTeams = false;
    customPacks = [];
    customSavedQuery = "";
    customSavedShareUrl = "";
    customSavedWebcalUrl = "";
    const popularTeamSlugs = ["argentina", "brazil", "france", "england", "spain", "germany", "portugal", "mexico", "united-states", "japan", "south-korea", "morocco"];
    return (
      '<section class="custom-builder"><div class="custom-panel custom-main"><div class="custom-head"><div><h3>定制我的世界杯日历</h3><p>选择球队、球星和关键比赛，生成可订阅、可分享的专属赛程。</p></div><span>Webcal Live</span></div><div class="custom-block"><div class="custom-block-title"><strong>选择赛程包</strong><small>从你最关心的比赛开始</small></div><div class="preset-grid" aria-label="定制日历模板"><button class="active" type="button" data-custom-preset="all">全部赛程<small>未来赛程完整订阅</small></button><button type="button" data-custom-preset="team">我的主队<small>先选球队再生成</small></button><button type="button" data-custom-preset="knockout">淘汰赛<small>只追关键晋级战</small></button><button type="button" data-custom-preset="big">强强对话<small>热门球队优先</small></button><button type="button" data-custom-preset="lesslate">少熬夜精选<small>06:00-12:00</small></button><button type="button" data-custom-preset="prime">黄金时间比赛<small>08:00-12:00</small></button></div></div><div class="custom-block"><div class="custom-block-title"><strong>关心的球星</strong><small>追踪国家队赛程</small></div><div class="star-picker">' +
      scheduleData.stars
        .map(
          (star) =>
            '<label><input type="checkbox" value="' +
            text(star.slug) +
            '" data-star-team="' +
            text(star.teamSlug) +
            '" data-custom-star data-custom-control /><span>' +
            text(star.label) +
            '</span><small>' +
            text(star.teamLabel) +
            "</small></label>"
        )
        .join("") +
      '</div></div><div class="custom-block"><div class="custom-block-title"><strong>选择球队</strong><small>热门球队优先</small></div><label class="custom-search"><span>搜索球队</span><input type="search" data-custom-team-search placeholder="输入中文队名、英文名、小组或国旗" /></label><div class="custom-team-picker">' +
      scheduleData.teams
        .map((team) => {
          const isPopular = popularTeamSlugs.includes(team.slug);
          return (
            '<label><input type="checkbox" value="' +
            text(team.slug) +
            '" data-team-search="' +
            text([team.flag, team.label, team.slug, team.group].join(" ")) +
            '" data-custom-team data-custom-control data-popular-team="' +
            (isPopular ? "1" : "0") +
            '" /><span>' +
            text(team.flag) +
            " " +
            text(team.label) +
            "</span></label>"
          );
        })
        .join("") +
      '</div><button class="custom-team-toggle" type="button" data-custom-team-toggle>展开全部球队</button></div><div class="custom-block custom-available-panel"><div class="custom-block-title"><strong>全部可选比赛</strong><small>未进入右侧清单的比赛可单独加入</small></div><label class="custom-add-search"><input type="search" data-custom-available-search placeholder="搜索球队、日期、比赛编号" /></label><div class="custom-add-list" id="custom-available-matches"></div></div></div><aside class="custom-result" aria-live="polite"><div class="custom-result-head"><strong id="custom-count">正在生成...</strong><div class="custom-result-tags" id="custom-desc">选择条件后生成专属 webcal 订阅源和分享页。</div><div class="custom-result-meta" id="custom-meta"></div><button class="custom-restore-link" type="button" data-custom-restore>恢复推荐清单</button></div><div class="custom-preview" id="custom-preview"></div><div class="custom-actions"><button class="custom-primary-action" type="button" id="custom-save-share" data-custom-save>保存并添加到手机日历</button><a id="custom-subscribe" class="custom-primary-action is-hidden" href="' +
      text(scheduleData.customWebcalBase) +
      '" data-webcal-link>再次添加到手机日历</a><button class="custom-secondary-action is-hidden" type="button" id="custom-copy-share" data-copy="' +
      text(scheduleData.customShareBase) +
      '">复制分享链接</button><a class="custom-secondary-action is-hidden" id="custom-open-share" href="' +
      text(scheduleData.customShareBase) +
      '" target="_blank" rel="noreferrer">打开分享海报</a><button class="custom-subtle-action is-hidden" type="button" id="custom-copy-feed" data-copy="' +
      text(scheduleData.customWebcalBase) +
      '">复制订阅源</button></div><small id="custom-url">' +
      text(scheduleData.customShareBase) +
      "</small></aside></section>"
    );
  }

  function updateCustomPreview() {
    if (activeTab !== "custom" || !scheduleData) return;
    const options = readCustomOptions();
    const query = customQuery(options);
    const suffix = query ? "?" + query : "";
    const webcalUrl = scheduleData.customWebcalBase + suffix;
    const shareUrl = scheduleData.customShareBase + suffix;
    const matches = customMatches(options);
    const baseMatches = baseCustomMatches(options);
    const count = document.getElementById("custom-count");
    const desc = document.getElementById("custom-desc");
    const meta = document.getElementById("custom-meta");
    const subscribe = document.getElementById("custom-subscribe");
    const copyFeed = document.getElementById("custom-copy-feed");
    const copyShare = document.getElementById("custom-copy-share");
    const openShare = document.getElementById("custom-open-share");
    const saveShare = document.getElementById("custom-save-share");
    const preview = document.getElementById("custom-preview");
    const availableMatches = document.getElementById("custom-available-matches");
    const url = document.getElementById("custom-url");
    if (count) count.textContent = matches.length + " 场比赛将进入你的专属日历";
    if (desc) desc.innerHTML = renderCustomResultTags(options, matches);
    if (meta) meta.innerHTML = renderCustomMeta(options, matches);
    if (preview) preview.innerHTML = renderCustomPreviewMatches(matches, options, baseMatches);
    if (availableMatches) availableMatches.innerHTML = renderCustomAvailableMatches(matches, options);
    const isSaved = customSavedQuery === query && customSavedShareUrl;
    if (subscribe) subscribe.setAttribute("href", isSaved && customSavedWebcalUrl ? customSavedWebcalUrl : webcalUrl);
    if (copyFeed) copyFeed.setAttribute("data-copy", isSaved && customSavedWebcalUrl ? customSavedWebcalUrl : webcalUrl);
    if (copyShare) copyShare.setAttribute("data-copy", isSaved ? customSavedShareUrl : shareUrl);
    if (openShare) openShare.setAttribute("href", isSaved ? customSavedShareUrl : shareUrl);
    if (subscribe) subscribe.classList.toggle("is-hidden", !isSaved);
    if (copyShare) copyShare.classList.toggle("is-hidden", !isSaved);
    if (openShare) openShare.classList.toggle("is-hidden", !isSaved);
    if (copyFeed) copyFeed.classList.toggle("is-hidden", !isSaved);
    if (saveShare) {
      saveShare.disabled = false;
      saveShare.classList.toggle("is-hidden", Boolean(isSaved));
      saveShare.textContent = "保存并添加到手机日历";
    }
    if (url) url.textContent = isSaved ? "已保存。分享链接已复制，可打开海报页保存图片：" + customSavedShareUrl : "会先保存成短链接，再添加到手机日历。";
    updateCustomPresetState();
    updateCustomTeamVisibility();
  }

  function openCalendarSubscription(webcalUrl) {
    if (!webcalUrl) return;
    if (isWechatBrowser) {
      copyText(webcalUrl).catch(() => {});
      if (wechatTip) {
        const title = wechatTip.querySelector("strong");
        const body = wechatTip.querySelector("span");
        if (title) title.textContent = "微信内无法直接唤起系统日历";
        if (body) {
          body.textContent =
            "订阅链接已复制。请点击右上角“...”选择“在浏览器打开”，再点“一键添加到手机日历”；也可以到系统日历里手动添加网络订阅。";
        }
        wechatTip.hidden = false;
        wechatTip.scrollIntoView({ behavior: "smooth", block: "center" });
      }
      return;
    }
    window.location.href = webcalUrl;
  }

  async function saveCustomCalendar() {
    const options = readCustomOptions();
    const query = customQuery(options);
    const matches = customMatches(options);
    const saveShare = document.getElementById("custom-save-share");
    const subscribe = document.getElementById("custom-subscribe");
    const copyFeed = document.getElementById("custom-copy-feed");
    const copyShare = document.getElementById("custom-copy-share");
    const openShare = document.getElementById("custom-open-share");
    const url = document.getElementById("custom-url");
    if (!matches.length) {
      if (url) url.textContent = "当前方案没有匹配比赛，暂时不能保存。";
      return;
    }
    if (saveShare) {
      saveShare.disabled = true;
      saveShare.textContent = "正在保存...";
    }
    try {
      const response = await fetch("/api/v1/calendars/save", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          query,
          title: customShareTitle(options)
        })
      });
      const payload = await response.json();
      if (!response.ok || !payload.ok) throw new Error(payload.message || "保存失败");
      customSavedQuery = query;
      customSavedShareUrl = payload.shareUrl || "";
      customSavedWebcalUrl = payload.webcalUrl || "";
      if (subscribe && payload.webcalUrl) subscribe.setAttribute("href", payload.webcalUrl);
      if (copyFeed && payload.webcalUrl) copyFeed.setAttribute("data-copy", payload.webcalUrl);
      if (copyShare && payload.shareUrl) copyShare.setAttribute("data-copy", payload.shareUrl);
      if (openShare && payload.shareUrl) openShare.setAttribute("href", payload.shareUrl);
      updateCustomPreview();
      if (payload.shareUrl) {
        copyText(payload.shareUrl).catch(() => {});
      }
      if (payload.webcalUrl) {
        setTimeout(() => openCalendarSubscription(payload.webcalUrl), 120);
      }
    } catch (error) {
      if (url) url.textContent = error instanceof Error ? error.message : "保存失败，请稍后再试。";
      if (saveShare) {
        saveShare.disabled = false;
        saveShare.textContent = "保存并添加到手机日历";
      }
    }
  }

  function readCustomOptions() {
    const teams = Array.from(document.querySelectorAll("[data-custom-team]:checked")).map((item) => item.value);
    const stars = Array.from(document.querySelectorAll("[data-custom-star]:checked")).map((item) => item.value);
    return { packs: customPacks.slice(), teams, stars, stages: ["group", "knockout"], statuses: ["scheduled", "live"], timeStart: "", timeEnd: "", include: customInclude.slice(), exclude: customExclude.slice() };
  }

  function customQuery(options) {
    const params = new URLSearchParams();
    if (options.packs.length) params.set("packs", options.packs.join(","));
    if (options.teams.length) params.set("teams", options.teams.join(","));
    if (options.stars.length) params.set("stars", options.stars.join(","));
    if (options.include.length) params.set("include", options.include.join(","));
    if (options.exclude.length) params.set("exclude", options.exclude.join(","));
    return params.toString();
  }

  function baseCustomMatches(options) {
    const starTeams = options.stars
      .map((slug) => scheduleData.stars.find((star) => star.slug === slug)?.teamSlug)
      .filter(Boolean);
    const selectedTeams = Array.from(new Set([...options.teams, ...starTeams]));
    const byMatchNo = new Map();
    const add = (match) => {
      const status = match.status === "halftime" ? "live" : match.status;
      if (options.statuses.length && !options.statuses.includes(status)) return;
      byMatchNo.set(Number(match.matchNo), match);
    };
    if (!options.packs.length && !selectedTeams.length) {
      scheduleData.matches.forEach(add);
    }
    if (selectedTeams.length) {
      scheduleData.matches
        .filter((match) => selectedTeams.includes(match.home.slug) || selectedTeams.includes(match.away.slug))
        .forEach(add);
    }
    options.packs.forEach((pack) => {
      scheduleData.matches.filter((match) => customPackMatches(match, pack)).forEach(add);
    });
    return Array.from(byMatchNo.values()).sort((a, b) => String(a.dateKey + a.time).localeCompare(String(b.dateKey + b.time)));
  }

  function customMatches(options) {
    const include = new Set(options.include.map(Number));
    const exclude = new Set(options.exclude.map(Number));
    const byMatchNo = new Map();
    baseCustomMatches(options).forEach((match) => {
      if (!exclude.has(Number(match.matchNo))) byMatchNo.set(Number(match.matchNo), match);
    });
    scheduleData.matches.forEach((match) => {
      const matchNo = Number(match.matchNo);
      if (include.has(matchNo) && !exclude.has(matchNo)) byMatchNo.set(matchNo, match);
    });
    return Array.from(byMatchNo.values()).sort((a, b) => String(a.dateKey + a.time).localeCompare(String(b.dateKey + b.time)));
  }

  function customDescription(options, matches) {
    const teamNames = options.teams
      .map((slug) => scheduleData.teams.find((team) => team.slug === slug)?.label)
      .filter(Boolean);
    const starNames = options.stars
      .map((slug) => scheduleData.stars.find((star) => star.slug === slug)?.label)
      .filter(Boolean);
    const parts = [
      starNames.length ? "球星：" + starNames.slice(0, 4).join("、") + (starNames.length > 4 ? "等" : "") : "",
      teamNames.length ? "球队：" + teamNames.slice(0, 4).join("、") + (teamNames.length > 4 ? "等" : "") : "",
      options.packs.length ? "赛程包：" + options.packs.map(customPackLabel).join("、") : "",
      !teamNames.length && !starNames.length && !options.packs.length ? "范围：全部未来赛程" : "",
      options.include.length || options.exclude.length ? "已手动调整：" + (options.include.length + options.exclude.length) + " 处" : ""
    ].filter(Boolean);
    return matches.length ? parts.join(" · ") : "当前条件暂无比赛，可以减少筛选条件。";
  }

  function renderCustomResultTags(options, matches) {
    const tags = [
      ...options.packs.map((pack) => ({
        label: "赛程包",
        value: customPackLabel(pack),
        type: "pack",
        slug: pack
      })),
      ...options.teams
        .map((slug) => {
          const team = scheduleData.teams.find((item) => item.slug === slug);
          return team
            ? {
                label: "球队",
                value: team.flag + " " + team.label,
                type: "team",
                slug
              }
            : null;
        })
        .filter(Boolean),
      ...options.stars
        .map((slug) => {
          const star = scheduleData.stars.find((item) => item.slug === slug);
          return star
            ? {
                label: "球星",
                value: star.label + " · " + star.teamLabel,
                type: "star",
                slug
              }
            : null;
        })
        .filter(Boolean),
      ...(options.include.length ? [{ label: "单场加入", value: options.include.length + " 场", type: "", slug: "" }] : []),
      ...(options.exclude.length ? [{ label: "已移出清单", value: options.exclude.length + " 场", type: "", slug: "" }] : [])
    ];
    if (!tags.length) tags.push({ label: "范围", value: "全部未来赛程", type: "", slug: "", muted: true });
    if (!matches.length) tags.push({ label: "状态", value: "暂无匹配", type: "", slug: "", muted: true });
    return tags
      .map((tag) => {
        const remove =
          tag.type && tag.slug
            ? '<button type="button" aria-label="移除' +
              text(tag.value) +
              '" data-custom-chip="' +
              text(tag.type) +
              '" data-value="' +
              text(tag.slug) +
              '">×</button>'
            : "";
        return '<span class="' + (tag.muted ? "muted" : "") + '"><b>' + text(tag.label) + "：</b>" + text(tag.value) + remove + "</span>";
      })
      .join("");
  }

  function renderCustomMeta(options, matches) {
    const total = scheduleData.matches.length;
    const selected = matches.length;
    const remaining = Math.max(0, total - selected);
    return [
      '<span>总计 ' + total + ' 场</span>',
      '<span>已选择 ' + selected + ' 场</span>',
      '<span>未选择 ' + remaining + ' 场</span>',
      ...(options.include.length ? ['<span>单场加入 ' + options.include.length + ' 场</span>'] : []),
      ...(options.exclude.length ? ['<span>已移出 ' + options.exclude.length + ' 场</span>'] : [])
    ].join("");
  }

  function customPackLabel(preset) {
    const labels = {
      knockout: "淘汰赛",
      big: "强强对话",
      lesslate: "少熬夜精选",
      prime: "黄金时间比赛"
    };
    return labels[preset] || preset;
  }

  function customPackMatches(match, pack) {
    if (pack === "knockout") return match.stage !== "group";
    if (pack === "prime") return match.time >= "08:00" && match.time <= "12:00";
    if (pack === "lesslate") return match.time >= "06:00" && match.time <= "12:00";
    return ["argentina", "brazil", "france", "england", "spain", "germany", "portugal"].includes(match.home.slug) || ["argentina", "brazil", "france", "england", "spain", "germany", "portugal"].includes(match.away.slug);
  }

  function updateCustomPresetState() {
    const hasCustomTargets =
      Boolean(document.querySelector("[data-custom-team]:checked")) ||
      Boolean(document.querySelector("[data-custom-star]:checked")) ||
      customInclude.length > 0 ||
      customExclude.length > 0;
    document.querySelectorAll("[data-custom-preset]").forEach((button) => {
      const preset = button.dataset.customPreset;
      button.classList.toggle(
        "active",
        preset === "all" ? customPacks.length === 0 && !hasCustomTargets : customPacks.includes(preset)
      );
    });
  }

  function updateCustomTeamVisibility() {
    const keyword = (document.querySelector("[data-custom-team-search]")?.value || "").trim().toLowerCase();
    document.querySelectorAll("[data-custom-team]").forEach((item) => {
      const label = item.closest("label");
      if (!label) return;
      const haystack = (item.getAttribute("data-team-search") || "").toLowerCase();
      const popular = item.getAttribute("data-popular-team") === "1";
      label.hidden = Boolean((keyword && !haystack.includes(keyword)) || (!keyword && !customExpandedTeams && !popular && !item.checked));
    });
    const toggle = document.querySelector("[data-custom-team-toggle]");
    if (toggle) toggle.textContent = customExpandedTeams ? "收起非热门球队" : "展开全部球队";
  }

  function renderCustomPreviewMatches(matches, options, baseMatches) {
    if (!matches.length) {
      return '<div class="custom-preview-empty">当前条件没有匹配比赛。可以换一个赛程包，或从左侧“全部可选比赛”里加入单场比赛。</div>';
    }
    const baseNos = new Set(baseMatches.map((match) => Number(match.matchNo)));
    const rows = matches
      .map((match) => {
        const date = match.dateKey ? match.dateKey.slice(5).replace("-", "/") : "";
        const manual = !baseNos.has(Number(match.matchNo));
        return (
          '<article class="custom-preview-match"><time>' +
          text(date) +
          "<br />" +
          text(match.time) +
          '</time><div><strong>' +
          text(match.home.flag) +
          " " +
          text(match.home.name) +
          " " +
          text(match.center) +
          " " +
          text(match.away.flag) +
          " " +
          text(match.away.name) +
          '</strong><span>' +
          text(match.stageLabel) +
          " · " +
          text(match.groupRound) +
          " · " +
          text(match.watchLabel) +
          (manual ? " · 手动添加" : "") +
          '</span></div><button type="button" data-custom-remove="' +
          text(match.matchNo) +
          '">移除</button></article>'
        );
      })
      .join("");
    const undo = customLastRemoved ? '<button class="custom-undo" type="button" data-custom-undo>撤销刚才移除</button>' : "";
    return '<div class="custom-preview-heading"><strong>我的赛程清单</strong><span>' + matches.length + ' 场</span></div><div class="custom-preview-list">' + rows + "</div>" + undo;
  }

  function renderCustomAvailableMatches(currentMatches, options) {
    const currentNos = new Set(currentMatches.map((match) => Number(match.matchNo)));
    const keyword = (document.querySelector("[data-custom-available-search]")?.value || "").trim().toLowerCase();
    const candidates = scheduleData.matches
      .filter((match) => ["scheduled", "live", "halftime"].includes(match.status))
      .filter((match) => !currentNos.has(Number(match.matchNo)))
      .filter((match) => {
        if (!keyword) return true;
        const haystack = [match.matchNo, match.dateKey, match.time, match.home.name, match.away.name, match.stageLabel, match.groupRound, match.venue].join(" ").toLowerCase();
        return haystack.includes(keyword);
      })
      .slice(0, 28);
    if (!candidates.length) return '<div class="custom-preview-empty">当前没有可添加的比赛。换个关键词，或先从右侧移除一场。</div>';
    return candidates
      .map((match) => {
        const date = match.dateKey ? match.dateKey.slice(5).replace("-", "/") : "";
        return (
          '<article class="custom-add-match"><div><strong>M' +
          text(match.matchNo) +
          " · " +
          text(match.home.flag) +
          " " +
          text(match.home.name) +
          " " +
          text(match.center) +
          " " +
          text(match.away.flag) +
          " " +
          text(match.away.name) +
          '</strong><span>' +
          text(date) +
          " " +
          text(match.time) +
          " · " +
          text(match.stageLabel) +
          " · " +
          text(match.watchLabel) +
          '</span></div><button type="button" data-custom-add="' +
          text(match.matchNo) +
          '">添加</button></article>'
        );
      })
      .join("");
  }

  function customShareTitle(options) {
    const stars = options.stars
      .map((slug) => scheduleData.stars.find((star) => star.slug === slug)?.label)
      .filter(Boolean);
    const teams = options.teams
      .map((slug) => scheduleData.teams.find((team) => team.slug === slug)?.label)
      .filter(Boolean);
    if (stars.length) return "我生成了" + stars.slice(0, 2).join("、") + "关注赛程";
    if (teams.length) return "我生成了" + teams.slice(0, 2).join("、") + "专属赛程";
    if (options.packs.length === 1) return "2026 世界杯" + customPackLabel(options.packs[0]) + "赛程";
    if (options.packs.length > 1) return "2026 世界杯" + options.packs.slice(0, 2).map(customPackLabel).join(" + ") + "赛程";
    return "我的 2026 世界杯日历";
  }

  function applyCustomPreset(preset) {
    customInclude = [];
    customExclude = [];
    customLastRemoved = null;
    if (preset === "all") {
      customPacks = [];
      document.querySelectorAll("[data-custom-team], [data-custom-star]").forEach((item) => {
        item.checked = false;
      });
      updateCustomPreview();
      return;
    }
    if (preset === "team") {
      const search = document.querySelector("[data-custom-team-search]");
      if (search) search.focus();
      updateCustomPreview();
      return;
    }
    customPacks = customPacks.includes(preset)
      ? customPacks.filter((pack) => pack !== preset)
      : [...customPacks, preset];
    updateCustomPreview();
  }

  function renderMatch(match) {
    return (
      '<article class="match-row"><div><div class="match-time">' +
      text(match.time) +
      '</div><div class="match-no">' +
      text(match.stageLabel) +
      " · " +
      text(match.groupRound) +
      '</div></div><div class="match-core"><div><div class="team home"><span class="team-name">' +
      text(match.home.name) +
      '</span><span class="team-flag" aria-hidden="true">' +
      text(match.home.flag) +
      '</span></div><div class="match-meta">第 ' +
      text(match.matchNo) +
      ' 场</div></div><div class="score-stack"><div class="score-box">' +
      text(match.center) +
      '</div><span class="status ' +
      text(match.status) +
      '">' +
      text(match.statusLabel) +
      '</span></div><div><div class="team away"><span class="team-flag" aria-hidden="true">' +
      text(match.away.flag) +
      '</span><span class="team-name">' +
      text(match.away.name) +
      '</span></div></div></div><div class="match-side"><span class="venue">' +
      text(match.venue) +
      '</span><div class="watch-links" aria-label="直播和回放链接"><a class="' +
      text(match.watchClass) +
      '" href="' +
      text(match.cctvUrl) +
      '" target="_blank" rel="noreferrer">' +
      text(match.watchLabel) +
      "</a></div></div></article>"
    );
  }

  document.addEventListener("click", (event) => {
    if (!(event.target instanceof Element)) return;
    const teamGroupButton = event.target.closest("[data-team-group-filter]");
    if (teamGroupButton) {
      event.preventDefault();
      document.querySelectorAll("[data-team-group-filter]").forEach((item) => item.classList.toggle("active", item === teamGroupButton));
      updateTeamIndexFilter();
      return;
    }
    const tab = event.target.closest("[data-tab]");
    if (tab) {
      event.preventDefault();
      setTab(tab.dataset.tab);
      return;
    }
    const preset = event.target.closest("[data-custom-preset]");
    if (preset) {
      event.preventDefault();
      applyCustomPreset(preset.dataset.customPreset);
      return;
    }
    const saveCustom = event.target.closest("[data-custom-save]");
    if (saveCustom) {
      event.preventDefault();
      saveCustomCalendar();
      return;
    }
    const chip = event.target.closest("[data-custom-chip]");
    if (chip) {
      event.preventDefault();
      const type = chip.getAttribute("data-custom-chip");
      const value = chip.getAttribute("data-value");
      if (type && value) {
        if (type === "pack") {
          customPacks = customPacks.filter((pack) => pack !== value);
        } else {
          const selector = type === "star" ? "[data-custom-star]" : "[data-custom-team]";
          const control = document.querySelector(selector + '[value="' + value + '"]');
          if (control) control.checked = false;
        }
        updateCustomPreview();
      }
      return;
    }
    const removeMatch = event.target.closest("[data-custom-remove]");
    if (removeMatch) {
      event.preventDefault();
      const matchNo = Number(removeMatch.getAttribute("data-custom-remove"));
      if (Number.isFinite(matchNo)) {
        const options = readCustomOptions();
        const wasIncluded = customInclude.includes(matchNo);
        if (wasIncluded) {
          customInclude = customInclude.filter((item) => item !== matchNo);
        } else if (!customExclude.includes(matchNo)) {
          customExclude = [...customExclude, matchNo];
        }
        customLastRemoved = { matchNo, wasIncluded };
        updateCustomPreview();
      }
      return;
    }
    const addMatch = event.target.closest("[data-custom-add]");
    if (addMatch) {
      event.preventDefault();
      const matchNo = Number(addMatch.getAttribute("data-custom-add"));
      if (Number.isFinite(matchNo)) {
        customExclude = customExclude.filter((item) => item !== matchNo);
        if (!customInclude.includes(matchNo)) customInclude = [...customInclude, matchNo];
        customLastRemoved = null;
        updateCustomPreview();
      }
      return;
    }
    const undoCustom = event.target.closest("[data-custom-undo]");
    if (undoCustom) {
      event.preventDefault();
      if (customLastRemoved) {
        const matchNo = Number(customLastRemoved.matchNo);
        if (customLastRemoved.wasIncluded && !customInclude.includes(matchNo)) {
          customInclude = [...customInclude, matchNo];
        } else {
          customExclude = customExclude.filter((item) => item !== matchNo);
        }
        customLastRemoved = null;
        updateCustomPreview();
      }
      return;
    }
    const restoreCustom = event.target.closest("[data-custom-restore]");
    if (restoreCustom) {
      event.preventDefault();
      customInclude = [];
      customExclude = [];
      customLastRemoved = null;
      updateCustomPreview();
      return;
    }
    const teamToggle = event.target.closest("[data-custom-team-toggle]");
    if (teamToggle) {
      event.preventDefault();
      customExpandedTeams = !customExpandedTeams;
      updateCustomTeamVisibility();
      return;
    }
    const tabLink = event.target.closest("[data-tab-link]");
    if (tabLink) {
      event.preventDefault();
      setTab(tabLink.dataset.tabLink);
      return;
    }
    const dateItem = event.target.closest("[data-date]");
    if (dateItem) {
      setDate(dateItem.dataset.date);
    }
  });

  document.addEventListener("change", (event) => {
    if (!(event.target instanceof Element)) return;
    if (event.target.matches("[data-custom-control]")) {
      updateCustomPreview();
    }
  });

  document.addEventListener("input", (event) => {
    if (!(event.target instanceof Element)) return;
    if (event.target.matches("[data-team-index-search]")) {
      updateTeamIndexFilter();
      return;
    }
    if (event.target.matches("[data-custom-team-search]")) {
      updateCustomTeamVisibility();
      return;
    }
    if (event.target.matches("[data-custom-available-search]")) {
      updateCustomPreview();
      return;
    }
  });

  function applyInitialCustomFromUrl() {
    if (!scheduleData) return;
    const params = new URLSearchParams(window.location.search);
    const hasCustomParams =
      params.get("tab") === "custom" ||
      params.has("packs") ||
      params.has("teams") ||
      params.has("stars") ||
      params.has("include") ||
      params.has("exclude");
    if (!hasCustomParams) return;
    setTab("custom");
    const list = (name) =>
      String(params.get(name) || "")
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
    const allowedPacks = new Set(["knockout", "prime", "lesslate", "big"]);
    customPacks = list("packs").filter((pack) => allowedPacks.has(pack));
    customInclude = list("include").map(Number).filter((value) => Number.isInteger(value));
    customExclude = list("exclude").map(Number).filter((value) => Number.isInteger(value));
    document.querySelectorAll("[data-custom-team], [data-custom-star]").forEach((item) => {
      item.checked = false;
    });
    list("teams").forEach((slug) => {
      const control = document.querySelector('[data-custom-team][value="' + slug.replace(/"/g, "") + '"]');
      if (control) control.checked = true;
    });
    list("stars").forEach((slug) => {
      const control = document.querySelector('[data-custom-star][value="' + slug.replace(/"/g, "") + '"]');
      if (control) control.checked = true;
    });
    customExpandedTeams = true;
    updateCustomPresetState();
    updateCustomTeamVisibility();
    updateCustomPreview();
    setTimeout(() => document.getElementById("schedule")?.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
  }

  applyInitialCustomFromUrl();
</script></body>
</html>`;
}

function renderDatePicker(days: ScheduleDay[], initialDate: string): string {
  return `<div class="date-track">${days
    .map(
      (day) => `
        <button class="date-item ${day.key === initialDate ? "active" : ""}" type="button" data-date="${escapeHtml(day.key)}">
          <span>${escapeHtml(day.shortDate)}</span>
          <strong>${escapeHtml(day.weekday)}</strong>
          <small>${escapeHtml(day.badge)}</small>
        </button>
      `
    )
    .join("")}</div>`;
}

function renderSyncStatus(state: AppState, className = ""): string {
  const lastUpdated = state.publication?.publishedAt ?? state.lastScoreSyncAt ?? state.lastScheduleSyncAt;
  const finalCount = state.matches.filter((match) => match.status === "final").length;
  return `
    <div class="sync-status${className ? ` ${escapeHtml(className)}` : ""}" aria-label="赛程同步状态">
      <span><b></b>订阅源已连接</span>
      <span>最近更新：${escapeHtml(formatSyncTime(lastUpdated))}</span>
      <span>已同步 ${finalCount}/${state.matches.length} 场赛果</span>
      <em>网页分钟级更新；手机日历刷新频率由系统决定</em>
    </div>
  `;
}

function renderScheduleSummary(day: ScheduleDay | undefined, matches: Match[]): string {
  return `
    <span>${escapeHtml(day?.label ?? "今日焦点")}</span>
    <strong>${matches.length} 场焦点赛程</strong>
    <em>${escapeHtml(dayInsight(matches))}</em>
  `;
}

function dayInsight(matches: Match[]): string {
  if (matches.length === 0) return "这一天暂无比赛";
  const finalCount = matches.filter((match) => match.status === "final").length;
  const liveCount = matches.filter((match) => match.status === "live" || match.status === "halftime").length;
  const upcoming = matches.filter((match) => match.status === "scheduled");
  if (liveCount > 0) return `${liveCount} 场进行中 · ${finalCount} 场已完场 · ${upcoming.length} 场未开赛`;
  if (upcoming.length > 0) return `${finalCount} 场已完场 · ${upcoming.length} 场未开赛 · 下一场 ${formatBeijingTime(upcoming[0]?.kickoffAtUtc ?? matches[0].kickoffAtUtc)}`;
  return `${finalCount} 场已完场 · 赛果已写入订阅源`;
}

function renderScheduleMatches(matches: Match[]): string {
  return matches.map(renderScheduleMatch).join("");
}

function renderScheduleMatch(match: Match): string {
  const matchup = matchDisplay(match);
  return `
    <article class="match-row">
      <div>
        <div class="match-time">${escapeHtml(formatBeijingTime(match.kickoffAtUtc))}</div>
        <div class="match-no">${escapeHtml(stageZh(match.stage))} · ${escapeHtml(groupOrRoundZh(match))}</div>
      </div>
      <div class="match-core">
        <div>
          <div class="team home"><span class="team-name">${escapeHtml(matchup.home.name)}</span><span class="team-flag" aria-hidden="true">${escapeHtml(matchup.home.flag)}</span></div>
          <div class="match-meta">第 ${match.matchNo} 场</div>
        </div>
        <div class="score-stack">
          <div class="score-box">${escapeHtml(matchup.center)}</div>
          <span class="status ${escapeHtml(match.status)}">${escapeHtml(statusZh(match.status))}</span>
        </div>
        <div>
          <div class="team away"><span class="team-flag" aria-hidden="true">${escapeHtml(matchup.away.flag)}</span><span class="team-name">${escapeHtml(matchup.away.name)}</span></div>
        </div>
      </div>
      <div class="match-side">
        <span class="venue">${escapeHtml(displayVenue(match))}</span>
        <div class="watch-links" aria-label="直播和回放链接">
          ${renderWatchLinks(match)}
        </div>
      </div>
    </article>
  `;
}

function renderWatchLinks(match: Match): string {
  return `<a class="${escapeHtml(cctvActionClass(match.status))}" href="${escapeHtml(match.cctvUrl ?? CCTV_WORLD_CUP_SCHEDULE_URL)}" target="_blank" rel="noreferrer">${escapeHtml(cctvActionLabel(match.status))}</a>`;
}

function displayVenue(match: Match): string {
  const base = venueZh(match.venue);
  const cctvVenue = normalizeCctvVenue(match.cctvVenue);
  if (!cctvVenue) return base;
  const city = base.split(" · ")[0] ?? base;
  if (city.includes(cctvVenue)) return city;
  return `${city} · ${cctvVenue}`;
}

function normalizeCctvVenue(venue?: string): string | undefined {
  if (!venue) return undefined;
  const normalized: Record<string, string> = {
    "Kansas City Stadium": "堪萨斯城体育场",
    "流明球場": "流明球场",
    "西班牙外换银行": "BBVA体育场"
  };
  return normalized[venue] ?? venue;
}

function cctvActionLabel(status: Match["status"]): string {
  return status === "final" ? "CCTV 5 回放" : "CCTV 5 直播";
}

function cctvActionClass(status: Match["status"]): string {
  return status === "final" ? "replay" : "live";
}

interface ScheduleDay {
  key: string;
  label: string;
  shortDate: string;
  weekday: string;
  matchCount: number;
  badge: string;
}

function scheduleDays(matches: Match[]): ScheduleDay[] {
  const counts = new Map<string, number>();
  for (const match of matches) {
    const key = beijingDateKey(match.kickoffAtUtc);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  return [...counts.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([key, matchCount]) => {
      const sample = matches.find((match) => beijingDateKey(match.kickoffAtUtc) === key);
      const label = sample ? formatBeijingDay(sample.kickoffAtUtc) : key;
      return {
        key,
        label,
        shortDate: key.slice(5).replace("-", "/"),
        weekday: sample ? formatBeijingWeekday(sample.kickoffAtUtc) : "",
        matchCount,
        badge: `${matchCount}场`
      };
    });
}

function pickInitialDateKey(days: ScheduleDay[]): string {
  if (days.length === 0) return "";
  const today = beijingDateKey(new Date().toISOString());
  return days.find((day) => day.key === today)?.key ?? days[0]?.key ?? "";
}

function matchesForDate(matches: Match[], dateKey: string): Match[] {
  return [...matches]
    .filter((match) => beijingDateKey(match.kickoffAtUtc) === dateKey)
    .sort((a, b) => a.kickoffAtUtc.localeCompare(b.kickoffAtUtc));
}

function clientMatch(match: Match) {
  const display = matchDisplay(match);
  return {
    id: match.id,
    matchNo: match.matchNo,
    dateKey: beijingDateKey(match.kickoffAtUtc),
    time: formatBeijingTime(match.kickoffAtUtc),
    group: match.group ? groupOrRoundZh(match) : "",
    groupRound: groupOrRoundZh(match),
    stage: match.stage,
    stageLabel: stageZh(match.stage),
    status: match.status,
    statusLabel: statusZh(match.status),
    venue: displayVenue(match),
    home: { ...display.home, slug: slugify(match.homeTeam) },
    away: { ...display.away, slug: slugify(match.awayTeam) },
    homePlaceholder: isPlaceholderTeam(match.homeTeam),
    awayPlaceholder: isPlaceholderTeam(match.awayTeam),
    center: display.center,
    cctvUrl: match.cctvUrl ?? CCTV_WORLD_CUP_SCHEDULE_URL,
    watchLabel: cctvActionLabel(match.status),
    watchClass: cctvActionClass(match.status)
  };
}

function teamClientCard(team: string, matches: Match[], baseUrl: string) {
  const teamMatches = matchesForTeamLocal(matches, team).sort((a, b) => a.kickoffAtUtc.localeCompare(b.kickoffAtUtc));
  const nextMatch = teamMatches.find((match) => match.status !== "final") ?? teamMatches[teamMatches.length - 1];
  const nextOpponent = nextMatch ? (nextMatch.homeTeam === team ? nextMatch.awayTeam : nextMatch.homeTeam) : "";
  const query = `teams=${encodeURIComponent(slugify(team))}`;
  const nextDate = nextMatch ? formatBeijingShortDate(nextMatch.kickoffAtUtc) : "赛程待定";
  const nextTime = nextMatch ? formatBeijingTime(nextMatch.kickoffAtUtc) : "";
  const nextOpponentLabel = nextMatch ? `vs ${teamDisplayNameZh(nextOpponent)}` : "";
  return {
    label: teamNameZh(team),
    slug: slugify(team),
    flag: teamFlag(team) ?? "",
    path: toWebcalUrl(`${baseUrl}/feeds/teams/${slugify(team)}.ics`),
    sharePath: `${baseUrl}/share/custom?${query}`,
    customPath: toWebcalUrl(`${baseUrl}/feeds/custom.ics?${query}`),
    matchCount: teamMatches.length,
    finalCount: teamMatches.filter((match) => match.status === "final").length,
    upcomingCount: teamMatches.filter((match) => match.status !== "final").length,
    group: teamMatches.find((match) => match.group)?.group?.replace(/^Group ([A-L])$/, "$1组") ?? "待定",
    nextDate,
    nextTime,
    nextOpponent: nextOpponentLabel,
    nextMatch: nextMatch ? `${nextDate} ${nextTime} ${nextOpponentLabel}` : "赛程待定"
  };
}

function matchesForTeamLocal(matches: Match[], team: string): Match[] {
  return matches.filter((match) => match.homeTeam === team || match.awayTeam === team);
}

function renderLedStat(value: number, label: string, icon: string): string {
  const icons: Record<string, string> = {
    teams: "♟",
    matches: "⚽",
    groups: "▦",
    venues: "⌂"
  };
  return `
    <div class="led-stat">
      <strong>${value}</strong>
      <span>${escapeHtml(label)}</span>
      <div class="led-icon" aria-hidden="true">${escapeHtml(icons[icon] ?? "•")}</div>
    </div>
  `;
}

function matchDisplay(match: Match): {
  home: { flag: string; name: string };
  away: { flag: string; name: string };
  center: string;
} {
  return {
    home: {
      flag: teamFlag(match.homeTeam) ?? "",
      name: teamNameZh(match.homeTeam)
    },
    away: {
      flag: teamFlag(match.awayTeam) ?? "",
      name: teamNameZh(match.awayTeam)
    },
    center: match.score ? `${match.score.home} : ${match.score.away}` : "VS"
  };
}

function countKnownTeams(matches: Match[]): number {
  const teams = new Set<string>();
  for (const match of matches) {
    if (!isPlaceholderTeam(match.homeTeam)) teams.add(match.homeTeam);
    if (!isPlaceholderTeam(match.awayTeam)) teams.add(match.awayTeam);
  }
  return teams.size;
}

function countGroups(matches: Match[]): number {
  return new Set(matches.map((match) => match.group).filter(Boolean)).size || 12;
}

function countVenues(matches: Match[]): number {
  return new Set(matches.map((match) => match.venue).filter(Boolean)).size || 16;
}

function isPlaceholderTeam(team: string): boolean {
  return /^[123][A-L](?:\/[A-L])*$/.test(team) || /^[WL]\d+$/.test(team);
}

function renderReadinessCheck(check: ReadinessResult["checks"][number]): string {
  return `<article class="panel"><h2>${escapeHtml(check.ok ? "OK" : "TODO")} · ${escapeHtml(check.name)}</h2><p>${escapeHtml(check.message)}</p><p>${check.required ? "Required" : "Optional"}</p></article>`;
}

function formatBeijingDay(iso: string): string {
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "long"
  }).format(new Date(iso));
}

function formatBeijingShortDate(iso: string): string {
  const parts = new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    month: "2-digit",
    day: "2-digit",
    weekday: "short"
  }).formatToParts(new Date(iso));
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  return `${get("month")}月${get("day")}日 ${get("weekday")}`;
}

function formatBeijingWeekday(iso: string): string {
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    weekday: "short"
  }).format(new Date(iso));
}

function beijingDateKey(iso: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(new Date(iso));
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(iso));
}

function formatSyncTime(iso?: string): string {
  if (!iso) return "等待首次同步";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "等待首次同步";
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(date);
}

function toWebcalUrl(url: string): string {
  return `webcal://${url.replace(/^https?:\/\//, "")}`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeJsonForHtml(value: string): string {
  return value.replace(/</g, "\\u003c").replace(/>/g, "\\u003e").replace(/&/g, "\\u0026");
}
