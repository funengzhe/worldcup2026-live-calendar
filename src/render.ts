import type { AppState, Match } from "./types.js";
import { summary } from "./calendar.js";

export function renderHome(state: AppState, publicBaseUrl: string): string {
  const icsUrl = `${publicBaseUrl.replace(/\/$/, "")}/worldcup2026.ics`;
  const next = nextMatch(state.matches);
  const recent = recentFinals(state.matches);

  return page(
    "World Cup 2026 Calendar",
    `
      <main class="shell">
        <section class="hero">
          <div>
            <p class="eyebrow">World Cup 2026</p>
            <h1>Live calendar feed</h1>
            <p class="subtle">赛程、场馆和赛果会自动写入订阅日历。手机端实际刷新时间由日历客户端控制。</p>
          </div>
          <div class="actions">
            <a class="button primary" href="webcal://${icsUrl.replace(/^https?:\/\//, "")}">Apple Calendar</a>
            <a class="button" href="https://calendar.google.com/calendar/render?cid=${encodeURIComponent(icsUrl)}">Google Calendar</a>
            <a class="button" href="${icsUrl}">ICS</a>
          </div>
        </section>

        <section class="grid">
          <article class="panel">
            <h2>订阅地址</h2>
            <code>${escapeHtml(icsUrl)}</code>
          </article>
          <article class="panel">
            <h2>同步状态</h2>
            <p>${state.publication ? `最近发布：${formatDate(state.publication.publishedAt)}` : "尚未发布"}</p>
            <p>${state.matches.length} 场比赛，${state.matches.filter((match) => match.status === "final").length} 场已完场</p>
          </article>
        </section>

        <section class="grid">
          <article class="panel">
            <h2>下一场</h2>
            ${next ? renderMatch(next) : "<p>暂无下一场比赛。</p>"}
          </article>
          <article class="panel">
            <h2>最近赛果</h2>
            ${recent.length ? recent.map(renderMatch).join("") : "<p>暂无赛果。</p>"}
          </article>
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

export function renderMatchPage(match: Match): string {
  return page(
    summary(match),
    `
      <main class="shell">
        <section class="hero compact">
          <div>
            <p class="eyebrow">Match ${match.matchNo}</p>
            <h1>${escapeHtml(summary(match))}</h1>
            <p class="subtle">${escapeHtml(match.venue)} · ${formatDate(match.kickoffAtUtc)}</p>
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
    :root { color-scheme: light; --ink:#18212f; --muted:#667085; --line:#d9e0e8; --bg:#f7f8fb; --panel:#fff; --accent:#1473e6; --accent-ink:#fff; }
    * { box-sizing: border-box; }
    body { margin:0; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color:var(--ink); background:var(--bg); }
    .shell { max-width:1040px; margin:0 auto; padding:32px 18px 48px; }
    .hero { min-height:260px; display:flex; align-items:center; justify-content:space-between; gap:24px; border-bottom:1px solid var(--line); }
    .hero.compact { min-height:160px; }
    .eyebrow { margin:0 0 8px; color:var(--accent); font-weight:700; text-transform:uppercase; font-size:13px; }
    h1 { margin:0; font-size:clamp(38px, 7vw, 78px); line-height:0.96; letter-spacing:0; }
    h2 { margin:0 0 14px; font-size:18px; }
    .subtle { color:var(--muted); font-size:18px; max-width:620px; line-height:1.6; }
    .actions { display:flex; flex-wrap:wrap; gap:10px; justify-content:flex-end; }
    .button { min-height:42px; display:inline-flex; align-items:center; justify-content:center; padding:0 16px; border:1px solid var(--line); border-radius:8px; color:var(--ink); background:#fff; text-decoration:none; font-weight:700; }
    .button.primary { border-color:var(--accent); background:var(--accent); color:var(--accent-ink); }
    .grid { display:grid; grid-template-columns:repeat(2, minmax(0, 1fr)); gap:16px; margin-top:16px; }
    .panel { background:var(--panel); border:1px solid var(--line); border-radius:8px; padding:18px; overflow:auto; }
    .match { border-top:1px solid var(--line); padding:12px 0; }
    .match:first-of-type { border-top:0; padding-top:0; }
    code, pre { white-space:pre-wrap; overflow-wrap:anywhere; }
    p { margin:8px 0; line-height:1.55; }
    @media (max-width:760px) { .hero { align-items:flex-start; flex-direction:column; } .actions { justify-content:flex-start; } .grid { grid-template-columns:1fr; } h1 { font-size:42px; } }
  </style>
</head>
<body>${body}</body>
</html>`;
}

function renderMatch(match: Match): string {
  return `<div class="match"><strong>${escapeHtml(summary(match))}</strong><p>${escapeHtml(match.venue)} · ${formatDate(match.kickoffAtUtc)}</p></div>`;
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

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(iso));
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
