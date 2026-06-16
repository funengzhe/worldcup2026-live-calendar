import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Match, Publication } from "./types.js";
import { addHours, formatUtcStamp } from "./time.js";

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
    `X-WR-CALNAME:${escapeText(options.calendarName ?? "World Cup 2026")}`,
    `X-WR-CALDESC:${escapeText(options.calendarDescription ?? "2026 World Cup fixtures and results")}`,
    "REFRESH-INTERVAL;VALUE=DURATION:PT15M",
    "X-PUBLISHED-TTL:PT15M"
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
  const tmpPath = `${options.calendarPath}.tmp`;
  await writeFile(tmpPath, ics);
  await writeFile(options.calendarPath, ics);

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
  const start = formatUtcStamp(new Date(match.kickoffAtUtc));
  const end = formatUtcStamp(new Date(addHours(match.kickoffAtUtc, 2)));
  const lastModified = formatUtcStamp(new Date(match.updatedAt));
  const matchUrl = `${baseUrl.replace(/\/$/, "")}/matches/${match.id}`;

  return [
    "BEGIN:VEVENT",
    `UID:worldcup2026-match-${String(match.matchNo).padStart(3, "0")}@${calendarDomain}`,
    `SEQUENCE:${match.sequence}`,
    `DTSTAMP:${dtstamp}`,
    `CREATED:${dtstamp}`,
    `LAST-MODIFIED:${lastModified}`,
    `DTSTART:${start}`,
    `DTEND:${end}`,
    `SUMMARY:${escapeText(summary(match))}`,
    `LOCATION:${escapeText(match.venue)}`,
    `DESCRIPTION:${escapeText(description(match))}`,
    `URL:${escapeText(matchUrl)}`,
    "BEGIN:VALARM",
    "TRIGGER:-PT30M",
    "ACTION:DISPLAY",
    `DESCRIPTION:${escapeText(`${summary(match)} will start in 30 minutes`)}`,
    "END:VALARM",
    "END:VEVENT"
  ];
}

export function summary(match: Match): string {
  if (match.status === "final" && match.score) {
    const base = `${match.homeTeam} ${match.score.home}-${match.score.away} ${match.awayTeam}`;
    if (match.score.penaltyHome !== undefined && match.score.penaltyAway !== undefined) {
      return `${base} (${match.score.penaltyHome}-${match.score.penaltyAway} pens)`;
    }
    return base;
  }

  return `World Cup 2026: ${match.homeTeam} vs ${match.awayTeam}`;
}

export function description(match: Match): string {
  const parts = [
    `Match ${match.matchNo}`,
    match.group ?? match.round,
    `Stage: ${match.stage}`,
    `Status: ${match.status}`,
    `Source: ${match.source}`,
    `Confidence: ${match.confidence}`
  ];

  if (match.score) {
    parts.push(`Score: ${match.score.home}-${match.score.away}`);
    if (match.score.halftimeHome !== undefined && match.score.halftimeAway !== undefined) {
      parts.push(`Half-time: ${match.score.halftimeHome}-${match.score.halftimeAway}`);
    }
  }

  if (match.goals.length > 0) {
    parts.push(
      `Goals: ${match.goals
        .map((goal) => `${goal.minute}' ${goal.name}${goal.penalty ? " (pen)" : ""}`)
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
