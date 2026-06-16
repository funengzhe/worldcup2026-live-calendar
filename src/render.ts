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
  teamFlag,
  teamNameZh,
  venueZh
} from "./localization.js";

export async function renderHome(state: AppState, publicBaseUrl: string): Promise<string> {
  const baseUrl = publicBaseUrl.replace(/\/$/, "");
  const icsUrl = `${baseUrl}/worldcup2026.ics`;
  const webcalUrl = `webcal://${icsUrl.replace(/^https?:\/\//, "")}`;
  const teams = teamFeeds(state.matches);
  const days = scheduleDays(state.matches);
  const initialDate = pickInitialDateKey(days);
  const initialMatches = matchesForDate(state.matches, initialDate).slice(0, 12);
  const initialDay = days.find((day) => day.key === initialDate);
  const clientState = {
    webcalUrl,
    googleUrl: `https://calendar.google.com/calendar/render?cid=${encodeURIComponent(icsUrl)}`,
    days,
    selectedDate: initialDate,
    matches: state.matches.map(clientMatch),
    teams: teams.map((feed) => ({
      label: teamDisplayNameZh(feed.team),
      path: `${baseUrl}/feeds/teams/${feed.slug}.ics`,
      matchCount: feed.matchCount
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
          <span class="brand-mark">🏆</span>
          <span><strong>2026世界杯</strong><small>赛程 · 赛果 · 日历订阅</small></span>
        </a>
        <nav class="topnav" aria-label="主导航">
          <a class="active" href="#schedule" data-tab-link="focus">今日焦点</a>
          <a href="#team-feeds" data-tab-link="teams">球队赛程</a>
          <a href="#schedule" data-tab-link="groups">小组积分</a>
          <a href="#schedule" data-tab-link="knockout">淘汰赛</a>
          <a href="#schedule" data-tab-link="subscribe">日历订阅</a>
        </nav>
        <a class="login-pill" href="${escapeHtml(webcalUrl)}">订阅</a>
      </header>

      <main class="shell" id="top">
        <section class="hero-grid" id="subscribe" aria-label="2026世界杯赛程订阅">
          <div class="hero-left">
            <h1>2026世界杯赛程</h1>
            <div class="feature-pills" aria-label="服务特性">
              <span>北京时间</span>
              <span>中文队名</span>
              <span>赛果自动更新</span>
              <span>网络实时同步</span>
            </div>

            <div class="led-board" aria-label="赛事数据看板">
              ${renderLedStat(teamCount, "支球队", "teams")}
              ${renderLedStat(state.matches.length, "场比赛", "matches")}
              ${renderLedStat(groupCount, "个小组", "groups")}
              ${renderLedStat(venueCount, "座球场", "venues")}
            </div>
          </div>

          <section class="match-pass" aria-label="赛程订阅通行证">
            <div class="pass-art">
              <div class="pass-title">
                <p>FIFA WORLD CUP 2026™</p>
                <h2>MATCH PASS</h2>
              </div>
              <div class="pass-qr-slot">
                <div class="qr" aria-label="订阅二维码">
                  ${qrSvg}
                  <span class="qr-scan" aria-hidden="true"></span>
                </div>
              </div>
              <div class="pass-badge">
                <strong>2026</strong>
                <span>世界杯</span>
                <small>赛程通行证</small>
              </div>
              <div class="pass-info">
                <strong>日历订阅</strong>
                <span>赛果自动更新</span>
                <span>北京时间汉化</span>
                <span>手机无感同步</span>
              </div>
              <div class="pass-live-tag" aria-label="实时源状态">LIVE SRC</div>
            </div>
            <div class="copy-row pass-copy">
              <input readonly value="${escapeHtml(webcalUrl)}" aria-label="订阅地址" />
              <button type="button" data-copy="${escapeHtml(webcalUrl)}">复制</button>
            </div>
            <p class="pass-note">网络订阅源会持续同步赛程、赛果和时间调整。</p>
            <div class="pass-actions">
              <a class="mobile-primary" href="${escapeHtml(webcalUrl)}">一键添加到手机日历</a>
              <a href="${escapeHtml(webcalUrl)}">Apple 日历</a>
              <a href="https://calendar.google.com/calendar/render?cid=${encodeURIComponent(icsUrl)}">Google 日历</a>
            </div>
          </section>
        </section>

        <section class="schedule-shell" id="schedule">
          <nav class="schedule-tabs" aria-label="赛程视图">
            <button class="active" type="button" data-tab="focus">今日焦点</button>
            <button type="button" data-tab="teams">球队赛程</button>
            <button type="button" data-tab="groups">小组积分</button>
            <button type="button" data-tab="knockout">淘汰赛</button>
            <button type="button" data-tab="subscribe">日历订阅</button>
          </nav>
          <nav class="date-picker" aria-label="选择比赛日期">
            ${renderDatePicker(days, initialDate)}
          </nav>
          <div class="schedule-summary" id="schedule-summary">
            <span>${escapeHtml(initialDay?.label ?? "今日焦点")}</span>
            <strong>${initialMatches.length} 场焦点赛程</strong>
          </div>
          <div id="schedule-panel">
            ${renderScheduleMatches(initialMatches)}
          </div>
          <div class="empty-state" id="empty-state" hidden>这一天暂无比赛。</div>
          <div class="subscribe-panel-view" id="subscribe-panel-view" hidden>
            <h2>订阅网络日历，自动同步赛程变化</h2>
            <p>请使用 webcal 网络订阅，不下载静态 ICS 文件。之后淘汰赛对阵、赛果和时间调整会由后台更新到订阅源。</p>
            <a class="neon-link" href="${escapeHtml(webcalUrl)}">一键添加到手机日历</a>
            <button type="button" data-copy="${escapeHtml(webcalUrl)}">复制 webcal 订阅链接</button>
          </div>
          <script id="schedule-data" type="application/json">${escapeJsonForHtml(JSON.stringify(clientState))}</script>
        </section>

        <section class="bottom-grid">
          <section class="info-card">
            <p class="eyebrow">Live</p>
            <h2>CCTV 直播/回放入口</h2>
            <p>每场比赛提供 CCTV 搜索入口；等官方单场直播页稳定后，可以替换为直达链接。</p>
            <a class="neon-link" href="https://worldcup.cctv.com/2026/schedule/index.shtml" target="_blank" rel="noreferrer">打开 CCTV 赛程</a>
          </section>

          <section class="info-card" id="team-feeds">
            <p class="eyebrow">Teams</p>
            <h2>球队订阅</h2>
            <div class="chips" id="team-feed-list">
              ${teams.map((feed) => `<a href="${escapeHtml(`${baseUrl}/feeds/teams/${feed.slug}.ics`)}">${escapeHtml(teamDisplayNameZh(feed.team))}</a>`).join("")}
            </div>
          </section>
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
    :root { color-scheme: dark; --ink:#f7fff9; --muted:#94a89a; --line:rgba(255,255,255,.12); --panel:rgba(8,24,15,.72); --panel-strong:rgba(13,35,23,.9); --neon:#00ff66; --gold:#d4af37; --gold-2:#f1d988; --pitch:#07160e; --black:#020805; }
    * { box-sizing: border-box; }
    html { scroll-behavior:smooth; }
    body { min-width:320px; margin:0; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color:var(--ink); background:
      linear-gradient(180deg, rgba(7,22,14,.78), rgba(4,13,8,.98)),
      radial-gradient(ellipse at 20% 8%, rgba(255,255,255,.22), transparent 20%),
      radial-gradient(ellipse at 82% 10%, rgba(255,255,255,.18), transparent 18%),
      linear-gradient(90deg, rgba(255,255,255,.05) 1px, transparent 1px),
      linear-gradient(180deg, #07160e 0%, #0c2317 46%, #040d08 100%);
      background-size:auto, auto, auto, 86px 86px, auto; }
    body::before { content:""; position:fixed; inset:46px 0 auto; height:290px; pointer-events:none; background:
      linear-gradient(108deg, transparent 0 9%, rgba(255,255,255,.14) 10%, transparent 28%),
      linear-gradient(252deg, transparent 0 9%, rgba(255,255,255,.12) 10%, transparent 28%);
      opacity:.65; }
    body::after { content:""; position:fixed; left:0; right:0; bottom:0; height:48vh; pointer-events:none; background:
      linear-gradient(90deg, transparent 49.7%, rgba(255,255,255,.12) 50%, transparent 50.3%),
      linear-gradient(0deg, transparent 82%, rgba(255,255,255,.10) 82.4%, transparent 82.8%);
      opacity:.28; }
    .topbar { position:sticky; top:0; z-index:20; max-width:1180px; min-height:58px; margin:0 auto; display:grid; grid-template-columns:220px minmax(0, 1fr) auto; align-items:center; gap:14px; padding:0 18px; border:1px solid rgba(255,255,255,.08); border-top:0; border-radius:0 0 18px 18px; background:rgba(3,10,6,.86); backdrop-filter:blur(16px); box-shadow:0 14px 40px rgba(0,0,0,.45); }
    .brand { display:flex; align-items:center; gap:10px; color:#fff; text-decoration:none; min-width:0; }
    .brand-mark { width:30px; height:30px; display:grid; place-items:center; border-radius:50%; background:linear-gradient(180deg, #f3d982, #a87721); color:#111; }
    .brand strong { display:block; font-size:15px; line-height:1.1; }
    .brand small { display:block; margin-top:2px; color:var(--muted); font-size:11px; }
    .topnav { height:58px; display:flex; justify-content:center; min-width:0; overflow:auto; scrollbar-width:none; }
    .topnav a { min-width:88px; height:58px; display:inline-flex; align-items:center; justify-content:center; color:#eaf7ef; text-decoration:none; font-weight:800; font-size:14px; border-left:1px solid rgba(255,255,255,.08); }
    .topnav a:last-child { border-right:1px solid rgba(255,255,255,.08); }
    .topnav a.active { color:#fff; box-shadow:inset 0 -2px 0 var(--gold); background:linear-gradient(180deg, transparent, rgba(212,175,55,.10)); }
    .login-pill { min-height:32px; display:inline-flex; align-items:center; justify-content:center; padding:0 14px; border:1px solid rgba(212,175,55,.48); border-radius:999px; color:var(--gold-2); text-decoration:none; font-weight:900; font-size:13px; }
    .shell { position:relative; z-index:1; max-width:1180px; margin:0 auto; padding:42px 18px 72px; }
    .hero-grid { min-height:338px; display:grid; grid-template-columns:minmax(0, 7fr) minmax(360px, 5fr); gap:34px; align-items:stretch; margin-bottom:26px; }
    .hero-left { display:flex; flex-direction:column; justify-content:space-between; gap:24px; padding:20px 0; }
    h1 { margin:0; max-width:760px; font-size:clamp(44px, 7.2vw, 86px); line-height:.98; letter-spacing:0; font-weight:1000; transform:skewX(-5deg); color:#fff; text-shadow:0 2px 0 rgba(0,0,0,.35), 0 0 24px rgba(255,255,255,.18); }
    h2 { margin:0; font-size:20px; }
    .feature-pills { display:flex; flex-wrap:wrap; gap:10px; margin-top:18px; }
    .feature-pills span { min-height:30px; display:inline-flex; align-items:center; padding:0 14px; border-radius:999px; border:1px solid rgba(255,255,255,.18); background:rgba(0,0,0,.28); color:#f6fff8; font-size:13px; font-weight:900; box-shadow:inset 0 0 18px rgba(255,255,255,.04); }
    .feature-pills span:first-child { border-color:rgba(0,255,102,.35); color:var(--neon); background:rgba(0,255,102,.08); }
    .led-board { display:grid; grid-template-columns:repeat(4, minmax(0, 1fr)); gap:0; max-width:610px; border:1px solid rgba(212,175,55,.26); border-radius:18px; background:linear-gradient(180deg, rgba(22,46,32,.94), rgba(6,18,11,.94)); box-shadow:inset 0 0 24px rgba(0,0,0,.75), 0 0 0 1px rgba(0,255,102,.08), 0 20px 48px rgba(0,0,0,.35); overflow:hidden; }
    .led-stat { min-height:122px; display:flex; flex-direction:column; align-items:center; justify-content:center; border-left:1px solid rgba(255,255,255,.08); position:relative; }
    .led-stat:first-child { border-left:0; }
    .led-stat strong { font-family:"SFMono-Regular", Consolas, "Liberation Mono", monospace; color:var(--neon); font-size:clamp(34px, 4vw, 48px); line-height:1; letter-spacing:1px; text-shadow:0 0 9px rgba(0,255,102,.5), 0 0 24px rgba(0,255,102,.20); }
    .led-stat span { margin-top:9px; color:#9eb2a4; font-size:13px; font-weight:800; }
    .led-icon { margin-top:8px; color:rgba(255,255,255,.56); font-size:18px; }
    .match-pass { position:relative; display:grid; align-content:start; gap:10px; max-width:520px; justify-self:center; width:100%; }
    .pass-art { position:relative; width:100%; aspect-ratio:4 / 3; background:url("/assets/img/blank-match-pass.png") center / contain no-repeat; filter:drop-shadow(0 28px 58px rgba(0,0,0,.62)); isolation:isolate; }
    .pass-title { position:absolute; top:18.2%; left:18.4%; width:22%; text-align:left; text-shadow:0 0 10px rgba(0,0,0,.8); }
    .pass-title p { margin:0 0 2px; color:rgba(245,218,142,.88); font-size:clamp(7px, 1vw, 10px); font-weight:1000; letter-spacing:.04em; line-height:1.1; }
    .pass-title h2 { margin:0; color:#fff7d8; font-size:clamp(12px, 2vw, 19px); font-weight:1000; line-height:.95; letter-spacing:0; }
    .pass-qr-slot { position:absolute; top:37.2%; left:35.7%; width:28.4%; aspect-ratio:1; display:flex; align-items:center; justify-content:center; }
    .qr { position:relative; width:82%; height:82%; padding:4%; border-radius:6px; background:#fff; box-shadow:0 0 18px rgba(0,255,102,.42), 0 0 0 1px rgba(255,255,255,.28); overflow:hidden; }
    .qr svg { width:100%; height:100%; display:block; }
    .qr-scan { position:absolute; inset:0; border:1px solid rgba(0,255,102,.45); border-radius:6px; pointer-events:none; animation:qrPulse 1.9s ease-in-out infinite; }
    .pass-badge { position:absolute; bottom:20.2%; left:15.2%; width:16.7%; height:15.2%; display:flex; flex-direction:column; align-items:center; justify-content:center; text-align:center; text-shadow:0 0 12px rgba(0,0,0,.85); }
    .pass-badge strong { color:#d4af37; font-size:clamp(14px, 2.4vw, 26px); font-weight:1000; line-height:.92; }
    .pass-badge span { margin-top:3px; color:#eaf6eb; font-size:clamp(8px, 1.2vw, 12px); font-weight:1000; line-height:1; }
    .pass-badge small { margin-top:3px; color:#91a89a; font-size:clamp(6px, .9vw, 9px); font-weight:900; line-height:1; }
    .pass-info { position:absolute; top:36%; right:12.6%; width:20.6%; min-height:22%; display:flex; flex-direction:column; justify-content:center; gap:3px; text-align:left; text-shadow:0 0 12px rgba(0,0,0,.9); }
    .pass-info strong { margin-bottom:2px; color:#d4af37; font-size:clamp(11px, 1.55vw, 18px); font-weight:1000; line-height:1; }
    .pass-info span { position:relative; color:#dce9dd; font-size:clamp(7px, 1.02vw, 11px); font-weight:900; line-height:1.25; padding-left:10px; }
    .pass-info span::before { content:""; position:absolute; left:0; top:.42em; width:4px; height:4px; border-radius:999px; background:var(--neon); box-shadow:0 0 8px rgba(0,255,102,.75); }
    .pass-live-tag { position:absolute; bottom:20.1%; right:12.5%; width:20.2%; height:7.3%; display:flex; align-items:center; justify-content:center; color:var(--neon); font:1000 clamp(8px, 1.15vw, 12px)/1 "SFMono-Regular", Consolas, monospace; letter-spacing:.12em; text-shadow:0 0 10px rgba(0,255,102,.7); animation:livePulse 1.8s ease-in-out infinite; }
    @keyframes qrPulse { 0%, 100% { opacity:.52; box-shadow:inset 0 0 0 rgba(0,255,102,0); } 50% { opacity:1; box-shadow:inset 0 0 18px rgba(0,255,102,.28); } }
    @keyframes livePulse { 0%, 100% { opacity:.72; } 50% { opacity:1; } }
    .copy-row { display:grid; grid-template-columns:minmax(0, 1fr) 74px; gap:8px; }
    .pass-copy { margin:0 6% 0; }
    .copy-row input { min-width:0; height:38px; border:1px solid rgba(255,255,255,.13); border-radius:10px; padding:0 10px; color:#cde4d3; background:rgba(0,0,0,.32); font:12px/1.2 "SFMono-Regular", Consolas, monospace; }
    .copy-row button { min-height:38px; border:1px solid rgba(0,255,102,.55); border-radius:10px; background:rgba(0,255,102,.12); color:var(--neon); font-weight:900; cursor:pointer; }
    .pass-note { margin:10px 0 0; color:#a9bbae; font-size:12px; line-height:1.5; }
    .pass-actions { display:grid; grid-template-columns:1.4fr 1fr 1fr; gap:8px; margin-top:12px; }
    .pass-actions a { min-height:36px; display:flex; align-items:center; justify-content:center; border:1px solid rgba(255,255,255,.13); border-radius:10px; background:rgba(255,255,255,.055); color:#fff; text-decoration:none; font-size:12px; font-weight:900; }
    .pass-actions .mobile-primary { border-color:transparent; background:linear-gradient(180deg, #00ff66, #00d957); color:#031007; box-shadow:0 0 16px rgba(0,255,102,.18); }
    .schedule-shell { margin-top:18px; }
    .schedule-tabs { display:grid; grid-template-columns:repeat(5, minmax(0, 1fr)); min-height:50px; margin-bottom:16px; border:1px solid rgba(255,255,255,.09); border-radius:16px; background:rgba(2,8,5,.72); backdrop-filter:blur(14px); overflow:hidden; box-shadow:0 16px 40px rgba(0,0,0,.34); }
    .schedule-tabs button { appearance:none; border:0; border-left:1px solid rgba(255,255,255,.08); background:transparent; display:flex; align-items:center; justify-content:center; color:#f5fff7; text-decoration:none; font:900 14px/1.2 inherit; cursor:pointer; }
    .schedule-tabs button:first-child { border-left:0; }
    .schedule-tabs button.active { color:#fff; box-shadow:inset 0 -2px 0 var(--gold); background:linear-gradient(180deg, rgba(255,255,255,.05), rgba(212,175,55,.12)); }
    .date-picker { margin:-4px 0 14px; padding:12px 4px; border-bottom:1px solid rgba(255,255,255,.05); overflow-x:auto; scrollbar-width:none; scroll-behavior:smooth; }
    .date-track { display:flex; align-items:center; gap:10px; min-width:max-content; }
    .date-item { flex:0 0 auto; width:66px; height:66px; border:1px solid rgba(255,255,255,.08); border-radius:14px; background:rgba(255,255,255,.05); color:#9bad9f; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:3px; font:800 12px/1 inherit; cursor:pointer; transition:background .2s ease, color .2s ease, border-color .2s ease; }
    .date-item:hover { color:#fff; background:rgba(255,255,255,.09); }
    .date-item.active { border-color:transparent; background:var(--neon); color:#031007; box-shadow:0 0 15px rgba(0,255,102,.30); }
    .date-item span:first-child { font-size:10px; opacity:.82; }
    .date-item strong { font:900 14px/1 "SFMono-Regular", Consolas, monospace; }
    .date-item small { min-height:13px; color:inherit; opacity:.72; font-size:9px; }
    .schedule-summary { display:flex; align-items:center; justify-content:space-between; gap:12px; min-height:42px; margin-bottom:10px; color:#a8b9ad; font-size:13px; }
    .schedule-summary strong { color:var(--gold-2); font-size:15px; }
    .day-group { display:grid; grid-template-columns:140px minmax(0, 1fr); gap:0; margin-bottom:10px; }
    .day-heading { padding:18px 16px; border:1px solid rgba(212,175,55,.30); border-right:0; border-radius:14px 0 0 14px; background:rgba(8,24,15,.82); color:var(--gold-2); font-weight:1000; line-height:1.35; }
    .day-heading span { display:block; margin-top:4px; color:#91a79a; font-size:12px; }
    .day-matches { display:grid; gap:8px; }
    #schedule-panel { display:grid; gap:8px; }
    .match-row { min-height:64px; display:grid; grid-template-columns:92px minmax(0, 1fr) 210px; align-items:center; gap:16px; padding:10px 12px 10px 18px; border:1px solid rgba(255,255,255,.10); border-radius:999px; background:rgba(8,24,15,.66); backdrop-filter:blur(10px); box-shadow:inset 0 0 22px rgba(0,0,0,.25); transition:border-color .2s ease, background .2s ease, transform .2s ease; }
    .match-row:hover { border-color:rgba(0,255,102,.34); background:rgba(10,31,19,.78); transform:translateY(-1px); }
    .match-time { color:#fff; font:900 17px/1 "SFMono-Regular", Consolas, monospace; }
    .match-no { margin-top:5px; color:#82978a; font-size:10px; font-weight:800; }
    .match-core { min-width:0; display:grid; grid-template-columns:minmax(120px, 1fr) 82px minmax(120px, 1fr); gap:14px; align-items:center; }
    .team { min-width:0; display:flex; align-items:center; gap:9px; color:#f8fff9; font-size:15px; font-weight:900; }
    .team.home { justify-content:flex-end; text-align:right; }
    .team.away { justify-content:flex-start; }
    .score-box { min-height:32px; display:flex; align-items:center; justify-content:center; border:1px solid rgba(255,255,255,.13); border-radius:999px; background:rgba(0,0,0,.38); color:var(--neon); font:1000 17px/1 "SFMono-Regular", Consolas, monospace; letter-spacing:.08em; text-shadow:0 0 8px rgba(0,255,102,.32); }
    .match-side { display:flex; justify-content:flex-end; align-items:center; gap:12px; min-width:0; }
    .venue { min-width:0; color:#93a99a; font-size:12px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
    .watch-links { display:flex; justify-content:flex-end; }
    .watch-links a { min-height:34px; display:inline-flex; align-items:center; justify-content:center; gap:5px; padding:0 14px; border:1px solid rgba(0,255,102,.36); border-radius:999px; background:rgba(0,255,102,.14); color:#031007; background-color:var(--neon); text-decoration:none; font-size:12px; font-weight:1000; box-shadow:0 0 12px rgba(0,255,102,.20); }
    .watch-links a::before { content:"▶"; font-size:10px; }
    .status { display:inline-flex; align-items:center; min-height:22px; padding:0 8px; border-radius:999px; font-size:11px; font-weight:900; border:1px solid rgba(255,255,255,.12); color:#b7c8bc; background:rgba(255,255,255,.06); }
    .status.live, .status.halftime { border-color:rgba(255,55,55,.65); background:#e33d3d; color:#fff; }
    .status.final { border-color:rgba(212,175,55,.24); background:rgba(0,0,0,.50); color:#e9d083; }
    .match-meta { margin-top:5px; color:#708579; font-size:10px; font-weight:800; }
    .bottom-grid { display:grid; grid-template-columns:360px minmax(0, 1fr); gap:16px; margin-top:22px; }
    .info-card, .subscribe-panel-view, .empty-state { border:1px solid rgba(255,255,255,.08); border-radius:16px; padding:18px; background:rgba(5,16,10,.74); backdrop-filter:blur(12px); box-shadow:0 18px 44px rgba(0,0,0,.24); }
    .empty-state { color:#9fb2a5; text-align:center; }
    .subscribe-panel-view { display:grid; gap:12px; }
    .subscribe-panel-view[hidden], .empty-state[hidden] { display:none; }
    .subscribe-panel-view button { min-height:38px; border:1px solid rgba(0,255,102,.40); border-radius:999px; background:rgba(0,255,102,.12); color:var(--neon); font-weight:900; cursor:pointer; }
    .group-grid, .team-grid { display:grid; grid-template-columns:repeat(3, minmax(0, 1fr)); gap:12px; }
    .group-card, .team-feed-card { border:1px solid rgba(255,255,255,.08); border-radius:16px; padding:14px; background:rgba(10,26,17,.58); }
    .group-card h3, .team-feed-card h3 { margin:0 0 10px; color:var(--gold-2); font-size:15px; }
    .group-card ul { margin:0; padding:0; list-style:none; display:grid; gap:7px; color:#eefcf1; font-size:13px; }
    .team-feed-card { display:flex; align-items:center; justify-content:space-between; gap:12px; color:#eefcf1; text-decoration:none; font-weight:900; }
    .team-feed-card span { color:#93a99a; font-size:12px; font-weight:800; }
    .eyebrow { margin:0 0 8px; color:var(--gold-2); text-transform:uppercase; font-size:12px; font-weight:1000; letter-spacing:.08em; }
    .info-card p:not(.eyebrow) { color:#9fb2a5; line-height:1.6; margin:10px 0 14px; }
    .neon-link { min-height:38px; display:inline-flex; align-items:center; padding:0 14px; border-radius:999px; background:rgba(0,255,102,.13); border:1px solid rgba(0,255,102,.36); color:var(--neon); text-decoration:none; font-weight:900; }
    .chips { display:flex; flex-wrap:wrap; gap:8px; max-height:176px; overflow:auto; padding-right:4px; }
    .chips a { display:inline-flex; align-items:center; min-height:32px; padding:0 10px; border:1px solid rgba(255,255,255,.11); border-radius:999px; text-decoration:none; color:#f6fff8; background:rgba(255,255,255,.06); font-size:13px; font-weight:900; }
    .grid { display:grid; grid-template-columns:repeat(2, minmax(0, 1fr)); gap:16px; margin-top:16px; }
    .panel { background:var(--panel); border:1px solid var(--line); border-radius:14px; padding:18px; overflow:auto; color:#eaffef; }
    code, pre { white-space:pre-wrap; overflow-wrap:anywhere; }
    a { color:var(--neon); }
    p { margin:8px 0; line-height:1.55; }
    @media (max-width:980px) {
      .topbar { grid-template-columns:1fr auto; margin:0 10px; }
      .topnav { grid-column:1 / -1; order:3; justify-content:flex-start; height:46px; }
      .topnav a { height:46px; min-width:82px; }
      .hero-grid, .bottom-grid { grid-template-columns:1fr; }
      .match-pass { max-width:620px; }
      .day-group { grid-template-columns:1fr; gap:8px; }
      .day-heading { border-right:1px solid rgba(212,175,55,.30); border-radius:14px; display:flex; justify-content:space-between; align-items:center; }
      .day-heading span { margin-top:0; }
    }
    @media (max-width:720px) {
      body::before { height:190px; }
      .shell { padding:26px 12px 46px; }
      .brand small, .login-pill { display:none; }
      .topbar { min-height:54px; }
      .topnav a { min-width:0; flex:1 0 auto; padding:0 8px; font-size:13px; }
      h1 { font-size:46px; }
      .feature-pills { gap:7px; }
      .feature-pills span { min-height:28px; padding:0 10px; font-size:12px; }
      .led-board { grid-template-columns:repeat(2, minmax(0, 1fr)); }
      .led-stat { min-height:98px; border-top:1px solid rgba(255,255,255,.08); }
      .led-stat:nth-child(-n+2) { border-top:0; }
      .led-stat:nth-child(odd) { border-left:0; }
      .match-pass { max-width:100%; }
      .pass-art { margin:0 -6px; width:calc(100% + 12px); }
      .pass-copy { margin:0; }
      .copy-row, .pass-actions { grid-template-columns:1fr; }
      .schedule-tabs { grid-template-columns:repeat(5, minmax(0, 1fr)); overflow:hidden; }
      .schedule-tabs button { min-width:0; min-height:46px; padding:0 6px; font-size:12px; }
      .match-row { grid-template-columns:1fr; border-radius:18px; padding:14px; gap:12px; }
      .match-core { grid-template-columns:1fr 78px 1fr; gap:8px; }
      .team { font-size:14px; align-items:flex-start; }
      .team.home { justify-content:flex-end; }
      .match-side { justify-content:space-between; }
      .venue { white-space:normal; }
      .watch-links a { min-height:38px; padding:0 16px; }
      .group-grid, .team-grid { grid-template-columns:1fr; }
      .grid { grid-template-columns:1fr; }
    }
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
        "<span>" + text(day?.label || "今日焦点") + "</span><strong>" + matches.length + " 场焦点赛程</strong>";
      schedulePanel.innerHTML = matches.map(renderMatch).join("");
      emptyState.hidden = matches.length > 0;
      return;
    }

    if (activeTab === "teams") {
      scheduleSummary.innerHTML = "<span>球队赛程</span><strong>选择球队专属订阅</strong>";
      schedulePanel.innerHTML = '<div class="team-grid">' + scheduleData.teams.map(renderTeamFeed).join("") + "</div>";
      emptyState.hidden = scheduleData.teams.length > 0;
      return;
    }

    if (activeTab === "groups") {
      const groups = groupTeams(scheduleData.matches);
      scheduleSummary.innerHTML = "<span>小组积分</span><strong>按小组查看球队</strong>";
      schedulePanel.innerHTML = '<div class="group-grid">' + groups.map(renderGroup).join("") + "</div>";
      emptyState.hidden = groups.length > 0;
      return;
    }

    if (activeTab === "knockout") {
      const matches = scheduleData.matches.filter((match) => match.stage !== "group");
      scheduleSummary.innerHTML = "<span>淘汰赛</span><strong>" + matches.length + " 场淘汰赛</strong>";
      schedulePanel.innerHTML = renderDayGroups(matches);
      emptyState.hidden = matches.length > 0;
      return;
    }

    if (activeTab === "subscribe") {
      scheduleSummary.innerHTML = "<span>日历订阅</span><strong>webcal 网络动态同步</strong>";
      datePicker.hidden = true;
      showSubscribePanel(true);
    }
  }

  function renderTeamFeed(feed) {
    return (
      '<a class="team-feed-card" href="' +
      text(feed.path) +
      '"><strong>' +
      text(feed.label) +
      "</strong><span>" +
      text(feed.matchCount) +
      " 场</span></a>"
    );
  }

  function groupTeams(matches) {
    const groups = new Map();
    for (const match of matches) {
      if (!match.group) continue;
      if (!groups.has(match.group)) groups.set(match.group, new Set());
      if (!match.homePlaceholder) groups.get(match.group).add(match.home.name);
      if (!match.awayPlaceholder) groups.get(match.group).add(match.away.name);
    }
    return Array.from(groups.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([group, teams]) => ({ group, teams: Array.from(teams).sort() }));
  }

  function renderGroup(group) {
    return (
      '<article class="group-card"><h3>' +
      text(group.group) +
      "</h3><ul>" +
      group.teams.map((team) => "<li>" + text(team) + "</li>").join("") +
      "</ul></article>"
    );
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

  function renderMatch(match) {
    return (
      '<article class="match-row"><div><div class="match-time">' +
      text(match.time) +
      '</div><div class="match-no">' +
      text(match.stageLabel) +
      " · " +
      text(match.groupRound) +
      '</div></div><div class="match-core"><div><div class="team home"><span>' +
      text(match.home.name) +
      "</span><span>" +
      text(match.home.flag) +
      '</span></div><div class="match-meta">第 ' +
      text(match.matchNo) +
      ' 场</div></div><div class="score-box">' +
      text(match.center) +
      '</div><div><div class="team away"><span>' +
      text(match.away.flag) +
      "</span><span>" +
      text(match.away.name) +
      '</span></div><div class="match-meta"><span class="status ' +
      text(match.status) +
      '">' +
      text(match.statusLabel) +
      '</span></div></div></div><div class="match-side"><span class="venue">' +
      text(match.venue) +
      '</span><div class="watch-links" aria-label="直播和回放链接"><a href="' +
      text(match.cctvUrl) +
      '" target="_blank" rel="noreferrer">CCTV 5 直播</a></div></div></article>'
    );
  }

  document.addEventListener("click", (event) => {
    if (!(event.target instanceof Element)) return;
    const tab = event.target.closest("[data-tab]");
    if (tab) {
      event.preventDefault();
      setTab(tab.dataset.tab);
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
          <div class="team home"><span>${escapeHtml(matchup.home.name)}</span><span>${escapeHtml(matchup.home.flag)}</span></div>
          <div class="match-meta">第 ${match.matchNo} 场</div>
        </div>
        <div class="score-box">${escapeHtml(matchup.center)}</div>
        <div>
          <div class="team away"><span>${escapeHtml(matchup.away.flag)}</span><span>${escapeHtml(matchup.away.name)}</span></div>
          <div class="match-meta"><span class="status ${escapeHtml(match.status)}">${escapeHtml(statusZh(match.status))}</span></div>
        </div>
      </div>
      <div class="match-side">
        <span class="venue">${escapeHtml(venueZh(match.venue))}</span>
        <div class="watch-links" aria-label="直播和回放链接">
          ${renderWatchLinks(match)}
        </div>
      </div>
    </article>
  `;
}

function renderWatchLinks(match: Match): string {
  const query = encodeURIComponent(
    `2026世界杯 ${teamNameZh(match.homeTeam)} ${teamNameZh(match.awayTeam)} 直播 回放`
  );
  return `<a href="${escapeHtml(`https://search.cctv.com/search.php?qtext=${query}`)}" target="_blank" rel="noreferrer">CCTV 5 直播</a>`;
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
  const query = encodeURIComponent(
    `2026世界杯 ${teamNameZh(match.homeTeam)} ${teamNameZh(match.awayTeam)} 直播 回放`
  );
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
    venue: venueZh(match.venue),
    home: display.home,
    away: display.away,
    homePlaceholder: isPlaceholderTeam(match.homeTeam),
    awayPlaceholder: isPlaceholderTeam(match.awayTeam),
    center: display.center,
    cctvUrl: `https://search.cctv.com/search.php?qtext=${query}`
  };
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

function escapeJsonForHtml(value: string): string {
  return value.replace(/</g, "\\u003c").replace(/>/g, "\\u003e").replace(/&/g, "\\u0026");
}
