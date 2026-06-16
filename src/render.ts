import QRCode from "qrcode";
import type { ReadinessResult } from "./readiness.js";
import type { AppState, Match } from "./types.js";
import { summary } from "./calendar.js";
import { teamFeeds } from "./feeds.js";
import {
  formatBeijingDateTime,
  groupOrRoundZh,
  stageZh,
  statusZh,
  teamDisplayNameZh,
  teamNameZh,
  venueZh
} from "./localization.js";

export async function renderHome(state: AppState, publicBaseUrl: string): Promise<string> {
  const baseUrl = publicBaseUrl.replace(/\/$/, "");
  const icsUrl = `${baseUrl}/worldcup2026.ics`;
  const webcalUrl = `webcal://${icsUrl.replace(/^https?:\/\//, "")}`;
  const knockoutUrl = `${baseUrl}/feeds/knockout.ics`;
  const next = nextMatch(state.matches);
  const recent = recentFinals(state.matches);
  const teams = teamFeeds(state.matches);
  const qrSvg = await QRCode.toString(webcalUrl, {
    type: "svg",
    margin: 1,
    width: 184,
    color: {
      dark: "#10271a",
      light: "#ffffff"
    }
  });
  const finalCount = state.matches.filter((match) => match.status === "final").length;
  const upcomingCount = state.matches.filter((match) => match.status !== "final").length;

  return page(
    "2026 世界杯赛程订阅日历",
    `
      <main class="shell">
        <section class="hero" id="subscribe">
          <div class="hero-copy">
            <p class="eyebrow">2026 世界杯 · 北京时间</p>
            <h1>全部赛程，一次订阅</h1>
            <p class="subtle">把 104 场比赛、中文队名、国旗、场馆和赛果更新同步到手机日历。订阅后不需要手动导入新文件。</p>
            <div class="hero-stats" aria-label="赛程概览">
              <span><strong>${state.matches.length}</strong> 场比赛</span>
              <span><strong>${finalCount}</strong> 已完场</span>
              <span><strong>${upcomingCount}</strong> 待开赛</span>
            </div>
          </div>
          <div class="subscribe-panel">
            <div class="qr" aria-label="订阅二维码">${qrSvg}</div>
            <div class="subscribe-copy">
              <h2>扫码订阅</h2>
              <p>用 iPhone 相机或支持 webcal 的日历应用扫描。</p>
              <div class="copy-row">
                <input readonly value="${escapeHtml(icsUrl)}" aria-label="订阅地址" />
                <button type="button" data-copy="${escapeHtml(icsUrl)}">复制</button>
              </div>
              <div class="actions">
                <a class="button primary" href="${escapeHtml(webcalUrl)}">Apple 日历</a>
                <a class="button" href="https://calendar.google.com/calendar/render?cid=${encodeURIComponent(icsUrl)}">Google 日历</a>
                <a class="button" href="${escapeHtml(icsUrl)}">下载 ICS</a>
              </div>
            </div>
          </div>
        </section>

        <nav class="section-nav" aria-label="页面导航">
          <a href="#schedule">完整赛程</a>
          <a href="#watch">直播/回放</a>
          <a href="#team-feeds">球队订阅</a>
          <a href="${escapeHtml(knockoutUrl)}">淘汰赛 ICS</a>
        </nav>

        <section class="overview">
          <article>
            <span>下一场</span>
            ${next ? `<strong>${escapeHtml(summary(next))}</strong><p>${escapeHtml(formatBeijingDateTime(next.kickoffAtUtc))} · ${escapeHtml(venueZh(next.venue))}</p>` : "<strong>暂无下一场比赛</strong>"}
          </article>
          <article>
            <span>最近赛果</span>
            ${recent[0] ? `<strong>${escapeHtml(summary(recent[0]))}</strong><p>${escapeHtml(formatBeijingDateTime(recent[0].kickoffAtUtc))}</p>` : "<strong>暂无赛果</strong>"}
          </article>
          <article>
            <span>更新时间</span>
            <strong>${state.publication ? escapeHtml(formatDate(state.publication.publishedAt)) : "尚未发布"}</strong>
            <p>订阅源建议客户端每 15 分钟刷新</p>
          </article>
        </section>

        <section class="content-grid">
          <section class="main-column" id="schedule">
            <div class="section-heading">
              <div>
                <p class="eyebrow">Schedule</p>
                <h2>完整赛程</h2>
              </div>
              <a class="text-link" href="${escapeHtml(icsUrl)}">订阅全部 104 场</a>
            </div>
            ${renderSchedule(state.matches)}
          </section>

          <aside class="side-column">
            <section class="watch-box" id="watch">
              <p class="eyebrow">Watch</p>
              <h2>直播/回放入口</h2>
              <p>具体直播间会在比赛临近时变化。这里先提供每场比赛的搜索入口，方便跳到 CCTV、抖音、小红书、B 站查看直播、集锦或回放。</p>
              <div class="provider-list">
                <a href="https://worldcup.cctv.com/2026/schedule/index.shtml" target="_blank" rel="noreferrer">CCTV 赛程</a>
                <a href="https://www.douyin.com/search/2026%E4%B8%96%E7%95%8C%E6%9D%AF" target="_blank" rel="noreferrer">抖音搜索</a>
                <a href="https://www.xiaohongshu.com/search_result?keyword=2026%E4%B8%96%E7%95%8C%E6%9D%AF" target="_blank" rel="noreferrer">小红书搜索</a>
                <a href="https://search.bilibili.com/all?keyword=2026%E4%B8%96%E7%95%8C%E6%9D%AF" target="_blank" rel="noreferrer">B 站搜索</a>
              </div>
            </section>

            <section class="team-box" id="team-feeds">
              <p class="eyebrow">Teams</p>
            <h2>球队订阅</h2>
            <div class="chips">
                ${teams.map((feed) => `<a href="${escapeHtml(`${baseUrl}/feeds/teams/${feed.slug}.ics`)}">${escapeHtml(teamDisplayNameZh(feed.team))}</a>`).join("")}
            </div>
            </section>
          </aside>
        </section>
      </main>
    `
  );
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
  <style>
    :root { color-scheme: light; --ink:#17211a; --muted:#61706a; --line:#dbe4dd; --bg:#f5f7f4; --panel:#fff; --accent:#1f8f3a; --accent-dark:#126129; --accent-ink:#fff; --gold:#c89b3c; --soft:#eaf4ec; }
    * { box-sizing: border-box; }
    html { scroll-behavior:smooth; }
    body { margin:0; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color:var(--ink); background:var(--bg); }
    .shell { max-width:1180px; margin:0 auto; padding:28px 18px 56px; }
    .hero { min-height:360px; display:grid; grid-template-columns:minmax(0, 1fr) 420px; align-items:center; gap:28px; padding:22px 0 28px; border-bottom:1px solid var(--line); }
    .hero.compact { min-height:160px; }
    .hero-copy { max-width:680px; }
    .eyebrow { margin:0 0 8px; color:var(--accent-dark); font-weight:800; text-transform:uppercase; font-size:13px; }
    h1 { margin:0; font-size:clamp(42px, 7vw, 84px); line-height:0.98; letter-spacing:0; }
    h2 { margin:0; font-size:20px; }
    .subtle { color:var(--muted); font-size:18px; max-width:660px; line-height:1.65; }
    .hero-stats { display:flex; flex-wrap:wrap; gap:10px; margin-top:20px; }
    .hero-stats span { min-height:38px; display:inline-flex; align-items:center; gap:6px; padding:0 12px; border:1px solid var(--line); border-radius:8px; background:#fff; color:var(--muted); }
    .hero-stats strong { color:var(--ink); font-size:20px; }
    .subscribe-panel { display:grid; grid-template-columns:184px minmax(0, 1fr); gap:18px; align-items:center; background:var(--panel); border:1px solid var(--line); border-radius:8px; padding:18px; box-shadow:0 18px 44px rgba(23,33,26,.08); }
    .qr { width:184px; height:184px; border:1px solid var(--line); border-radius:8px; overflow:hidden; background:#fff; }
    .qr svg { width:100%; height:100%; display:block; }
    .subscribe-copy p { margin:8px 0 14px; color:var(--muted); }
    .copy-row { display:grid; grid-template-columns:minmax(0, 1fr) 76px; gap:8px; margin-bottom:12px; }
    .copy-row input { min-width:0; height:40px; border:1px solid var(--line); border-radius:8px; padding:0 10px; color:var(--muted); background:#f9fbf9; font:inherit; }
    .copy-row button { height:40px; border:1px solid var(--accent); border-radius:8px; background:var(--accent); color:#fff; font-weight:800; cursor:pointer; }
    .actions { display:flex; flex-wrap:wrap; gap:10px; }
    .button { min-height:42px; display:inline-flex; align-items:center; justify-content:center; padding:0 14px; border:1px solid var(--line); border-radius:8px; color:var(--ink); background:#fff; text-decoration:none; font-weight:800; }
    .button.primary { border-color:var(--accent); background:var(--accent); color:var(--accent-ink); }
    .section-nav { position:sticky; top:0; z-index:5; display:flex; flex-wrap:wrap; gap:8px; padding:12px 0; background:rgba(245,247,244,.94); backdrop-filter:blur(10px); border-bottom:1px solid var(--line); }
    .section-nav a { min-height:36px; display:inline-flex; align-items:center; padding:0 12px; border:1px solid var(--line); border-radius:8px; background:#fff; color:var(--ink); text-decoration:none; font-weight:800; font-size:14px; }
    .overview { display:grid; grid-template-columns:repeat(3, minmax(0, 1fr)); gap:14px; margin:18px 0 22px; }
    .overview article { min-height:118px; background:var(--panel); border:1px solid var(--line); border-radius:8px; padding:16px; }
    .overview span { display:block; color:var(--muted); font-size:13px; font-weight:800; margin-bottom:8px; }
    .overview strong { display:block; font-size:19px; line-height:1.35; }
    .overview p { color:var(--muted); }
    .content-grid { display:grid; grid-template-columns:minmax(0, 1fr) 330px; gap:18px; align-items:start; }
    .main-column, .side-column { min-width:0; }
    .side-column { position:sticky; top:70px; display:grid; gap:14px; }
    .section-heading { display:flex; align-items:end; justify-content:space-between; gap:14px; margin-bottom:12px; }
    .text-link { color:var(--accent-dark); font-weight:800; text-decoration:none; }
    .day-group { margin-bottom:18px; border:1px solid var(--line); border-radius:8px; overflow:hidden; background:var(--panel); }
    .day-heading { display:flex; justify-content:space-between; gap:12px; padding:13px 15px; background:var(--soft); border-bottom:1px solid var(--line); font-weight:900; }
    .day-heading span { color:var(--muted); font-weight:800; }
    .match-row { display:grid; grid-template-columns:88px minmax(0, 1fr) 190px; gap:14px; padding:14px 15px; border-top:1px solid var(--line); }
    .match-row:first-of-type { border-top:0; }
    .match-time { color:var(--accent-dark); font-size:24px; line-height:1; font-weight:900; }
    .match-no { margin-top:6px; color:var(--muted); font-size:13px; }
    .match-title { display:flex; align-items:center; gap:10px; flex-wrap:wrap; font-size:18px; font-weight:900; line-height:1.35; }
    .status { display:inline-flex; align-items:center; min-height:24px; padding:0 8px; border-radius:999px; font-size:12px; font-weight:900; background:#eef2f0; color:var(--muted); }
    .status.live, .status.halftime { background:#e33d3d; color:#fff; }
    .status.final { background:#17211a; color:#fff; }
    .match-meta { display:flex; flex-wrap:wrap; gap:7px 12px; margin-top:8px; color:var(--muted); font-size:14px; }
    .watch-links { display:flex; flex-wrap:wrap; gap:7px; justify-content:flex-end; align-content:center; }
    .watch-links a, .provider-list a { min-height:30px; display:inline-flex; align-items:center; padding:0 9px; border:1px solid var(--line); border-radius:8px; background:#fff; color:var(--ink); text-decoration:none; font-size:13px; font-weight:800; }
    .watch-box, .team-box { background:var(--panel); border:1px solid var(--line); border-radius:8px; padding:16px; }
    .watch-box p { color:var(--muted); }
    .provider-list { display:flex; flex-wrap:wrap; gap:8px; margin-top:12px; }
    .grid { display:grid; grid-template-columns:repeat(2, minmax(0, 1fr)); gap:16px; margin-top:16px; }
    .panel { background:var(--panel); border:1px solid var(--line); border-radius:8px; padding:18px; overflow:auto; }
    .match { border-top:1px solid var(--line); padding:12px 0; }
    .match:first-of-type { border-top:0; padding-top:0; }
    code, pre { white-space:pre-wrap; overflow-wrap:anywhere; }
    a { color:var(--accent); }
    .chips { display:flex; flex-wrap:wrap; gap:8px; }
    .chips a { display:inline-flex; align-items:center; min-height:32px; padding:0 10px; border:1px solid var(--line); border-radius:8px; text-decoration:none; color:var(--ink); background:#fff; font-size:14px; font-weight:800; }
    p { margin:8px 0; line-height:1.55; }
    @media (max-width:980px) { .hero, .content-grid, .overview { grid-template-columns:1fr; } .side-column { position:static; } .subscribe-panel { max-width:620px; } }
    @media (max-width:720px) { .shell { padding:18px 12px 40px; } .hero { min-height:auto; padding-top:12px; } h1 { font-size:44px; } .subscribe-panel { grid-template-columns:1fr; } .qr { margin:0 auto; } .copy-row { grid-template-columns:1fr; } .copy-row button { width:100%; } .match-row { grid-template-columns:1fr; gap:10px; } .watch-links { justify-content:flex-start; } .grid { grid-template-columns:1fr; } }
  </style>
</head>
<body>${body}<script>
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
</script></body>
</html>`;
}

function renderSchedule(matches: Match[]): string {
  const groups = new Map<string, Match[]>();
  for (const match of [...matches].sort((a, b) => a.kickoffAtUtc.localeCompare(b.kickoffAtUtc))) {
    const day = formatBeijingDay(match.kickoffAtUtc);
    groups.set(day, [...(groups.get(day) ?? []), match]);
  }

  return [...groups.entries()]
    .map(
      ([day, dayMatches]) => `
        <section class="day-group">
          <div class="day-heading">${escapeHtml(day)}<span>${dayMatches.length} 场</span></div>
          ${dayMatches.map(renderScheduleMatch).join("")}
        </section>
      `
    )
    .join("");
}

function renderScheduleMatch(match: Match): string {
  return `
    <article class="match-row">
      <div>
        <div class="match-time">${escapeHtml(formatBeijingTime(match.kickoffAtUtc))}</div>
        <div class="match-no">第 ${match.matchNo} 场</div>
      </div>
      <div>
        <div class="match-title">
          <span>${escapeHtml(summary(match))}</span>
          <span class="status ${escapeHtml(match.status)}">${escapeHtml(statusZh(match.status))}</span>
        </div>
        <div class="match-meta">
          <span>${escapeHtml(groupOrRoundZh(match))}</span>
          <span>${escapeHtml(stageZh(match.stage))}</span>
          <span>${escapeHtml(venueZh(match.venue))}</span>
        </div>
      </div>
      <div class="watch-links" aria-label="直播和回放链接">
        ${renderWatchLinks(match)}
      </div>
    </article>
  `;
}

function renderWatchLinks(match: Match): string {
  const query = encodeURIComponent(
    `2026世界杯 ${teamNameZh(match.homeTeam)} ${teamNameZh(match.awayTeam)} 直播 回放`
  );
  const links = [
    ["CCTV", `https://search.cctv.com/search.php?qtext=${query}`],
    ["抖音", `https://www.douyin.com/search/${query}`],
    ["小红书", `https://www.xiaohongshu.com/search_result?keyword=${query}`],
    ["B站", `https://search.bilibili.com/all?keyword=${query}`]
  ];
  return links
    .map(
      ([label, href]) =>
        `<a href="${escapeHtml(href)}" target="_blank" rel="noreferrer">${escapeHtml(label)}</a>`
    )
    .join("");
}

function renderReadinessCheck(check: ReadinessResult["checks"][number]): string {
  return `<article class="panel"><h2>${escapeHtml(check.ok ? "OK" : "TODO")} · ${escapeHtml(check.name)}</h2><p>${escapeHtml(check.message)}</p><p>${check.required ? "Required" : "Optional"}</p></article>`;
}

function nextMatch(matches: Match[]) {
  const now = Date.now();
  return matches
    .filter((match) => new Date(match.kickoffAtUtc).getTime() >= now)
    .sort((a, b) => a.kickoffAtUtc.localeCompare(b.kickoffAtUtc))[0];
}

function recentFinals(matches: Match[]) {
  return matches
    .filter((match) => match.status === "final")
    .sort((a, b) => b.kickoffAtUtc.localeCompare(a.kickoffAtUtc))
    .slice(0, 5);
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

function formatBeijingTime(iso: string): string {
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(new Date(iso));
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

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
