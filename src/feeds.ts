import type { Match } from "./types.js";

export interface TeamFeed {
  team: string;
  slug: string;
  matchCount: number;
}

export function teamFeeds(matches: Match[]): TeamFeed[] {
  const counts = new Map<string, number>();
  for (const match of matches) {
    if (!isPlaceholderTeam(match.homeTeam)) {
      counts.set(match.homeTeam, (counts.get(match.homeTeam) ?? 0) + 1);
    }
    if (!isPlaceholderTeam(match.awayTeam)) {
      counts.set(match.awayTeam, (counts.get(match.awayTeam) ?? 0) + 1);
    }
  }

  return Array.from(counts.entries())
    .map(([team, matchCount]) => ({ team, slug: slugify(team), matchCount }))
    .sort((a, b) => a.team.localeCompare(b.team));
}

export function findTeamFeed(matches: Match[], slug: string): TeamFeed | undefined {
  return teamFeeds(matches).find((feed) => feed.slug === slug);
}

export function matchesForTeam(matches: Match[], team: string): Match[] {
  return matches.filter((match) => match.homeTeam === team || match.awayTeam === team);
}

export function knockoutMatches(matches: Match[]): Match[] {
  return matches.filter((match) => match.stage !== "group");
}

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function isPlaceholderTeam(value: string): boolean {
  return /^[123][A-L](?:\/[A-L])*$/.test(value) || /^[WL]\d+$/.test(value);
}
