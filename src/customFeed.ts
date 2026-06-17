import { matchesForTeam, slugify, teamFeeds } from "./feeds.js";
import { formatBeijingTime, teamDisplayNameZh } from "./localization.js";
import type { Match, MatchStatus } from "./types.js";

export interface CustomFeedOptions {
  packs: Array<"knockout" | "prime" | "lesslate" | "big">;
  teams: string[];
  stars: string[];
  stages: Array<"group" | "knockout">;
  statuses: Array<"scheduled" | "live" | "final">;
  timeStart?: string;
  timeEnd?: string;
  include: number[];
  exclude: number[];
}

export interface CustomFeedResult {
  options: CustomFeedOptions;
  matches: Match[];
  title: string;
  description: string;
  emptyReason?: string;
}

const validStatuses = new Set(["scheduled", "live", "final"]);
const validStages = new Set(["group", "knockout"]);
const validPacks = new Set(["knockout", "prime", "lesslate", "big"]);
const bigTeamSlugs = new Set(["argentina", "brazil", "france", "england", "spain", "germany", "portugal"]);

export interface StarPreset {
  slug: string;
  label: string;
  team: string;
  note: string;
}

export const STAR_PRESETS: StarPreset[] = [
  { slug: "messi", label: "梅西", team: "Argentina", note: "阿根廷" },
  { slug: "mbappe", label: "姆巴佩", team: "France", note: "法国" },
  { slug: "bellingham", label: "贝林厄姆", team: "England", note: "英格兰" },
  { slug: "vinicius", label: "维尼修斯", team: "Brazil", note: "巴西" },
  { slug: "haaland", label: "哈兰德", team: "Norway", note: "挪威" },
  { slug: "ronaldo", label: "C罗", team: "Portugal", note: "葡萄牙" },
  { slug: "yamal", label: "亚马尔", team: "Spain", note: "西班牙" },
  { slug: "musiala", label: "穆西亚拉", team: "Germany", note: "德国" }
];

const starBySlug = new Map(STAR_PRESETS.map((star) => [star.slug, star]));

export function parseCustomFeedOptions(matches: Match[], query: URLSearchParams): CustomFeedOptions {
  const feeds = teamFeeds(matches);
  const teamBySlug = new Map(feeds.map((feed) => [feed.slug, feed.team]));
  const teams = unique(
    splitParam(query.get("teams"))
      .map((slug) => teamBySlug.get(slugify(slug)))
      .filter((team): team is string => Boolean(team))
  ).slice(0, 12);
  const stars = unique(
    splitParam(query.get("stars"))
      .map((slug) => slugify(slug))
      .filter((slug) => starBySlug.has(slug))
  ).slice(0, 8);

  const stages = splitParam(query.get("stages")).filter((stage): stage is "group" | "knockout" =>
    validStages.has(stage)
  );
  const statuses = splitParam(query.get("statuses")).filter((status): status is "scheduled" | "live" | "final" =>
    validStatuses.has(status)
  );
  const packs = splitParam(query.get("packs")).filter((pack): pack is CustomFeedOptions["packs"][number] =>
    validPacks.has(pack)
  );
  if (!packs.length && stages.length === 1 && stages[0] === "knockout") packs.push("knockout");
  if (!packs.length && query.get("timeStart") === "08:00" && query.get("timeEnd") === "12:00") packs.push("prime");
  if (!packs.length && query.get("timeStart") === "06:00" && query.get("timeEnd") === "12:00") packs.push("lesslate");

  return {
    packs: unique(packs),
    teams,
    stars,
    stages: stages.length ? unique(stages) : ["group", "knockout"],
    statuses: statuses.length ? unique(statuses) : ["scheduled", "live"],
    timeStart: normalizeTime(query.get("timeStart")),
    timeEnd: normalizeTime(query.get("timeEnd")),
    include: matchNumbers(query.get("include")),
    exclude: matchNumbers(query.get("exclude"))
  };
}

export function buildCustomFeed(matches: Match[], options: CustomFeedOptions): CustomFeedResult {
  const selectedTeams = teamsForOptions(options);
  const recommended = customPackageMatches(matches, options, selectedTeams)
    .filter((match) => matchesStatus(match.status, options.statuses));
  const include = new Set(options.include);
  const exclude = new Set(options.exclude);
  const filtered = uniqueMatches([
    ...recommended.filter((match) => !exclude.has(match.matchNo)),
    ...matches.filter((match) => include.has(match.matchNo) && !exclude.has(match.matchNo))
  ])
    .sort((a, b) => a.kickoffAtUtc.localeCompare(b.kickoffAtUtc));

  const teamNames = selectedTeams.map(teamDisplayNameZh);
  const starNames = options.stars.map((slug) => starBySlug.get(slug)?.label).filter((name): name is string => Boolean(name));
  const title = customFeedTitle(options, teamNames);
  const description = [
    starNames.length ? `球星关注：${starNames.join("、")}（追踪其国家队赛程）` : undefined,
    teamNames.length ? `关注球队：${teamNames.join("、")}` : undefined,
    options.packs.length ? `赛程包：${packLabels(options.packs).join("、")}` : undefined,
    !teamNames.length && !starNames.length && !options.packs.length ? "关注范围：全部未来赛程" : undefined,
    `状态：${statusLabels(options.statuses).join("、")}`,
    options.include.length ? `手动添加：${options.include.length} 场` : undefined,
    options.exclude.length ? `已移除：${options.exclude.length} 场` : undefined
  ]
    .filter(Boolean)
    .join(" · ");

  return {
    options,
    matches: filtered,
    title,
    description,
    emptyReason: filtered.length === 0 ? "当前筛选条件下暂无比赛，可以减少球队、阶段或时间限制后再生成。" : undefined
  };
}

export function customFeedQuery(options: CustomFeedOptions): string {
  const params = new URLSearchParams();
  if (options.packs.length) params.set("packs", options.packs.join(","));
  if (options.teams.length) params.set("teams", options.teams.map(slugify).join(","));
  if (options.stars.length) params.set("stars", options.stars.join(","));
  if (!isDefaultStatuses(options.statuses)) params.set("statuses", options.statuses.join(","));
  if (options.include.length) params.set("include", options.include.join(","));
  if (options.exclude.length) params.set("exclude", options.exclude.join(","));
  return params.toString();
}

export function matchesForCustomFeed(matches: Match[], options: CustomFeedOptions): Match[] {
  return buildCustomFeed(matches, options).matches;
}

function customFeedTitle(options: CustomFeedOptions, teamNames: string[]): string {
  const starNames = options.stars.map((slug) => starBySlug.get(slug)?.label).filter(Boolean);
  if (starNames.length) {
    return `2026 世界杯：${starNames.slice(0, 3).join("、")}${starNames.length > 3 ? "等" : ""}关注赛程`;
  }
  if (teamNames.length === 1) return `2026 世界杯：${teamNames[0]}专属赛程`;
  if (teamNames.length > 1) return `2026 世界杯：${teamNames.slice(0, 3).join("、")}${teamNames.length > 3 ? "等" : ""}专属赛程`;
  if (options.packs.length === 1 && options.packs[0] === "knockout") return "2026 世界杯淘汰赛订阅";
  if (options.packs.length === 1 && options.packs[0] === "prime") return "2026 世界杯黄金时间赛程";
  return "2026 世界杯定制赛程";
}

function teamsForOptions(options: CustomFeedOptions): string[] {
  return unique([
    ...options.teams,
    ...options.stars.map((slug) => starBySlug.get(slug)?.team).filter((team): team is string => Boolean(team))
  ]).slice(0, 20);
}

function matchesTeams(match: Match, teams: string[]): boolean {
  if (teams.length === 0) return true;
  return teams.some((team) => matchesForTeam([match], team).length > 0);
}

function matchesStage(match: Match, stages: CustomFeedOptions["stages"]): boolean {
  if (stages.length === 0) return true;
  const stage = match.stage === "group" ? "group" : "knockout";
  return stages.includes(stage);
}

function customPackageMatches(matches: Match[], options: CustomFeedOptions, selectedTeams: string[]): Match[] {
  const selected: Match[] = [];
  if (!options.packs.length && !selectedTeams.length) {
    selected.push(...matches);
  }
  if (selectedTeams.length) {
    selected.push(...matches.filter((match) => matchesTeams(match, selectedTeams)));
  }
  for (const pack of options.packs) {
    selected.push(...matches.filter((match) => matchesPack(match, pack)));
  }
  return uniqueMatches(selected);
}

function matchesPack(match: Match, pack: CustomFeedOptions["packs"][number]): boolean {
  if (pack === "knockout") return matchesStage(match, ["knockout"]);
  if (pack === "prime") return matchesTimeWindow(match, "08:00", "12:00");
  if (pack === "lesslate") return matchesTimeWindow(match, "06:00", "12:00");
  return bigTeamSlugs.has(slugify(match.homeTeam)) || bigTeamSlugs.has(slugify(match.awayTeam));
}

function packLabels(packs: CustomFeedOptions["packs"]): string[] {
  return packs.map((pack) => {
    if (pack === "knockout") return "淘汰赛";
    if (pack === "prime") return "黄金时间比赛";
    if (pack === "lesslate") return "少熬夜精选";
    return "强强对话";
  });
}

function matchesStatus(status: MatchStatus, statuses: CustomFeedOptions["statuses"]): boolean {
  if (statuses.length === 0) return true;
  if ((status === "live" || status === "halftime") && statuses.includes("live")) return true;
  return statuses.includes(status as "scheduled" | "final");
}

function matchesTimeWindow(match: Match, start?: string, end?: string): boolean {
  if (!start || !end) return true;
  const time = formatBeijingTime(match.kickoffAtUtc);
  if (start <= end) return time >= start && time <= end;
  return time >= start || time <= end;
}

function statusLabels(statuses: CustomFeedOptions["statuses"]): string[] {
  return statuses.map((status) => {
    if (status === "scheduled") return "未开赛";
    if (status === "live") return "进行中";
    return "已完场";
  });
}

function isDefaultStatuses(statuses: CustomFeedOptions["statuses"]): boolean {
  return statuses.length === 2 && statuses.includes("scheduled") && statuses.includes("live");
}

function splitParam(value: string | null): string[] {
  return (value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeTime(value: string | null): string | undefined {
  if (!value) return undefined;
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value);
  return match ? value : undefined;
}

function matchNumbers(value: string | null): number[] {
  return unique(
    splitParam(value)
      .map((item) => Number(item))
      .filter((number) => Number.isInteger(number) && number >= 1 && number <= 104)
  ).slice(0, 104);
}

function unique<T>(items: T[]): T[] {
  return Array.from(new Set(items));
}

function uniqueMatches(matches: Match[]): Match[] {
  const byMatchNo = new Map<number, Match>();
  for (const match of matches) {
    byMatchNo.set(match.matchNo, match);
  }
  return Array.from(byMatchNo.values());
}
