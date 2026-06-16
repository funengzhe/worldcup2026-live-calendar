import { createHash } from "node:crypto";
import { mkdir, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Match, Publication } from "./types.js";
import { addHours, formatUtcStamp } from "./time.js";
import {
  formatBeijingDateTime,
  formatBeijingIcsLocal,
  groupOrRoundZh,
  stageZh,
  statusZh,
  teamNameZh,
  venueZh
} from "./localization.js";

export function generateIcs(
  matches: Match[],
  options: {
    calendarDomain: string;
    baseUrl: string;
    calendarName?: string;
    calendarDescription?: string;
  }
): string {
  const now = formatUtcStamp();
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//worldcup2026-live-calendar//CN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeText(options.calendarName ?? "2026 世界杯赛程")}`,
    `X-WR-CALDESC:${escapeText(options.calendarDescription ?? "2026 世界杯赛程与赛果（北京时间）")}`,
    "X-WR-TIMEZONE:Asia/Shanghai",
    "REFRESH-INTERVAL;VALUE=DURATION:PT15M",
    "X-PUBLISHED-TTL:PT15M",
    "BEGIN:VTIMEZONE",
    "TZID:Asia/Shanghai",
    "X-LIC-LOCATION:Asia/Shanghai",
    "BEGIN:STANDARD",
    "TZOFFSETFROM:+0800",
    "TZOFFSETTO:+0800",
    "TZNAME:CST",
    "DTSTART:19700101T000000",
    "END:STANDARD",
    "END:VTIMEZONE"
  ];

  for (const match of matches) {
    lines.push(...eventLines(match, options.calendarDomain, options.baseUrl, now));
  }

  lines.push("END:VCALENDAR");
  return `${lines.map(foldLine).join("\r\n")}\r\n`;
}

export async function publishIcs(
  matches: Match[],
  options: { calendarDomain: string; baseUrl: string; calendarPath: string }
): Promise<Publication> {
  const ics = generateIcs(matches, options);
  validateIcs(ics);
  await mkdir(path.dirname(options.calendarPath), { recursive: true });
  const tmpPath = `${options.calendarPath}.${process.pid}.${Date.now()}.${Math.random().toString(16).slice(2)}.tmp`;
  await writeFile(tmpPath, ics);
  await rename(tmpPath, options.calendarPath);

  return {
    version: Date.now(),
    publishedAt: new Date().toISOString(),
    matchCount: matches.length,
    finalCount: matches.filter((match) => match.status === "final").length,
    path: "/worldcup2026.ics",
    sha256: createHash("sha256").update(ics).digest("hex")
  };
}

export function validateIcs(ics: string): void {
  for (const required of ["BEGIN:VCALENDAR", "VERSION:2.0", "END:VCALENDAR"]) {
    if (!ics.includes(required)) {
      throw new Error(`Invalid ICS: missing ${required}`);
    }
  }
  if (!ics.includes("BEGIN:VEVENT")) {
    throw new Error("Invalid ICS: no events");
  }
}

function eventLines(match: Match, calendarDomain: string, baseUrl: string, dtstamp: string): string[] {
  const startBeijing = formatBeijingIcsLocal(match.kickoffAtUtc);
  const endBeijing = formatBeijingIcsLocal(addHours(match.kickoffAtUtc, 2));
  const lastModified = formatUtcStamp(new Date(match.updatedAt));
  const matchUrl = `${baseUrl.replace(/\/$/, "")}/matches/${match.id}`;

  return [
    "BEGIN:VEVENT",
    `UID:worldcup2026-match-${String(match.matchNo).padStart(3, "0")}@${calendarDomain}`,
    `SEQUENCE:${match.sequence}`,
    `DTSTAMP:${dtstamp}`,
    `CREATED:${dtstamp}`,
    `LAST-MODIFIED:${lastModified}`,
    `DTSTART;TZID=Asia/Shanghai:${startBeijing}`,
    `DTEND;TZID=Asia/Shanghai:${endBeijing}`,
    `SUMMARY:${escapeText(summary(match))}`,
    `LOCATION:${escapeText(venueZh(match.venue))}`,
    `DESCRIPTION:${escapeText(description(match))}`,
    `URL:${escapeText(matchUrl)}`,
    "BEGIN:VALARM",
    "TRIGGER:-PT30M",
    "ACTION:DISPLAY",
    `DESCRIPTION:${escapeText(`${summary(match)} 将在 30 分钟后开始`)}`,
    "END:VALARM",
    "END:VEVENT"
  ];
}

export function summary(match: Match): string {
  const home = teamNameZh(match.homeTeam);
  const away = teamNameZh(match.awayTeam);
  if (match.status === "final" && match.score) {
    const base = `${home} ${match.score.home}-${match.score.away} ${away}`;
    if (match.score.penaltyHome !== undefined && match.score.penaltyAway !== undefined) {
      return `${base}（点球 ${match.score.penaltyHome}-${match.score.penaltyAway}）`;
    }
    return base;
  }

  return `${home} vs ${away}`;
}

export function description(match: Match): string {
  const parts = [
    `2026 世界杯 · 第 ${match.matchNo} 场`,
    groupOrRoundZh(match),
    stageZh(match.stage),
    `${teamNameZh(match.homeTeam)} vs ${teamNameZh(match.awayTeam)}`,
    `北京时间：${formatBeijingDateTime(match.kickoffAtUtc)}`,
    `地点：${venueZh(match.venue)}`,
    `状态：${statusZh(match.status)}`
  ];

  if (match.score) {
    parts.push(`比分：${match.score.home}-${match.score.away}`);
    if (match.score.halftimeHome !== undefined && match.score.halftimeAway !== undefined) {
      parts.push(`半场：${match.score.halftimeHome}-${match.score.halftimeAway}`);
    }
  }

  if (match.goals.length > 0) {
    parts.push(
      `进球：${match.goals
        .map((goal) => `${goal.minute}' ${goal.name}${goal.penalty ? "（点球）" : ""}`)
        .join("; ")}`
    );
  }

  return parts.join("\n");
}

function escapeText(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");
}

function foldLine(line: string): string {
  const limit = 75;
  if (Buffer.byteLength(line, "utf8") <= limit) return line;

  const chunks: string[] = [];
  let current = "";
  for (const char of line) {
    if (Buffer.byteLength(`${current}${char}`, "utf8") > limit) {
      chunks.push(current);
      current = ` ${char}`;
    } else {
      current += char;
    }
  }
  chunks.push(current);
  return chunks.join("\r\n");
}
