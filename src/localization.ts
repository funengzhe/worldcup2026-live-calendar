import type { Match, MatchStatus } from "./types.js";

const TEAM_ZH: Record<string, string> = {
  Algeria: "阿尔及利亚",
  Argentina: "阿根廷",
  Australia: "澳大利亚",
  Austria: "奥地利",
  Belgium: "比利时",
  "Bosnia & Herzegovina": "波黑",
  Brazil: "巴西",
  Canada: "加拿大",
  "Cape Verde": "佛得角",
  Colombia: "哥伦比亚",
  Croatia: "克罗地亚",
  Curaçao: "库拉索",
  "Czech Republic": "捷克",
  "DR Congo": "刚果（金）",
  Ecuador: "厄瓜多尔",
  Egypt: "埃及",
  England: "英格兰",
  France: "法国",
  Germany: "德国",
  Ghana: "加纳",
  Haiti: "海地",
  Iran: "伊朗",
  Iraq: "伊拉克",
  "Ivory Coast": "科特迪瓦",
  Japan: "日本",
  Jordan: "约旦",
  Mexico: "墨西哥",
  Morocco: "摩洛哥",
  Netherlands: "荷兰",
  "New Zealand": "新西兰",
  Norway: "挪威",
  Panama: "巴拿马",
  Paraguay: "巴拉圭",
  Portugal: "葡萄牙",
  Qatar: "卡塔尔",
  "Saudi Arabia": "沙特阿拉伯",
  Scotland: "苏格兰",
  Senegal: "塞内加尔",
  "South Africa": "南非",
  "South Korea": "韩国",
  Spain: "西班牙",
  Sweden: "瑞典",
  Switzerland: "瑞士",
  Tunisia: "突尼斯",
  Turkey: "土耳其",
  USA: "美国",
  Uruguay: "乌拉圭",
  Uzbekistan: "乌兹别克斯坦"
};

const TEAM_COUNTRY_CODE: Record<string, string> = {
  Algeria: "DZ",
  Argentina: "AR",
  Australia: "AU",
  Austria: "AT",
  Belgium: "BE",
  "Bosnia & Herzegovina": "BA",
  Brazil: "BR",
  Canada: "CA",
  "Cape Verde": "CV",
  Colombia: "CO",
  Croatia: "HR",
  Curaçao: "CW",
  "Czech Republic": "CZ",
  "DR Congo": "CD",
  Ecuador: "EC",
  Egypt: "EG",
  France: "FR",
  Germany: "DE",
  Ghana: "GH",
  Haiti: "HT",
  Iran: "IR",
  Iraq: "IQ",
  "Ivory Coast": "CI",
  Japan: "JP",
  Jordan: "JO",
  Mexico: "MX",
  Morocco: "MA",
  Netherlands: "NL",
  "New Zealand": "NZ",
  Norway: "NO",
  Panama: "PA",
  Paraguay: "PY",
  Portugal: "PT",
  Qatar: "QA",
  "Saudi Arabia": "SA",
  Senegal: "SN",
  "South Africa": "ZA",
  "South Korea": "KR",
  Spain: "ES",
  Sweden: "SE",
  Switzerland: "CH",
  Tunisia: "TN",
  Turkey: "TR",
  USA: "US",
  Uruguay: "UY",
  Uzbekistan: "UZ"
};

const VENUE_ZH: Record<string, string> = {
  Atlanta: "亚特兰大 · 亚特兰大体育场",
  "Boston (Foxborough)": "波士顿 · 波士顿体育场（福克斯堡）",
  "Dallas (Arlington)": "达拉斯 · 达拉斯体育场（阿灵顿）",
  Houston: "休斯敦 · 休斯敦体育场",
  "Kansas City": "堪萨斯城 · 堪萨斯城体育场",
  "Los Angeles (Inglewood)": "洛杉矶 · 洛杉矶体育场（英格尔伍德）",
  "Mexico City": "墨西哥城 · 墨西哥城体育场",
  "Miami (Miami Gardens)": "迈阿密 · 迈阿密体育场（迈阿密花园）",
  "Monterrey (Guadalupe)": "蒙特雷 · 蒙特雷体育场（瓜达卢佩）",
  "New York/New Jersey (East Rutherford)": "纽约/新泽西 · 纽约新泽西体育场（东卢瑟福）",
  Philadelphia: "费城 · 费城体育场",
  "San Francisco Bay Area (Santa Clara)": "旧金山湾区 · 旧金山湾区体育场（圣克拉拉）",
  Seattle: "西雅图 · 西雅图体育场",
  Toronto: "多伦多 · 多伦多体育场",
  Vancouver: "温哥华 · 温哥华体育场",
  "Guadalajara (Zapopan)": "瓜达拉哈拉 · 瓜达拉哈拉体育场（萨波潘）"
};

const STATUS_ZH: Record<MatchStatus, string> = {
  scheduled: "未开始",
  live: "进行中",
  halftime: "中场",
  final: "已完场",
  postponed: "延期"
};

export function teamNameZh(team: string): string {
  return TEAM_ZH[team] ?? translatePlaceholder(team);
}

export function teamDisplayNameZh(team: string): string {
  const flag = teamFlag(team);
  const name = teamNameZh(team);
  return flag ? `${flag} ${name}` : name;
}

export function teamFlag(team: string): string | undefined {
  if (team === "England") return subdivisionFlag("gbeng");
  if (team === "Scotland") return subdivisionFlag("gbsct");

  const countryCode = TEAM_COUNTRY_CODE[team];
  return countryCode ? countryFlag(countryCode) : undefined;
}

export function venueZh(venue: string): string {
  return VENUE_ZH[venue] ?? venue;
}

export function statusZh(status: MatchStatus): string {
  return STATUS_ZH[status] ?? status;
}

export function groupOrRoundZh(match: Match): string {
  if (match.group) return match.group.replace(/^Group ([A-L])$/, "$1组");
  return roundZh(match.round);
}

export function stageZh(stage: string): string {
  const map: Record<string, string> = {
    group: "小组赛",
    "round-of-32": "32强",
    "round-of-16": "淘汰赛",
    "quarter-final": "四分之一决赛",
    "semi-final": "半决赛",
    "match-for-third-place": "三四名决赛",
    "third-place": "三四名决赛",
    final: "决赛"
  };
  return map[stage] ?? roundZh(stage);
}

export function formatBeijingDateTime(iso: string): string {
  const parts = new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).formatToParts(new Date(iso));
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  return `${get("year")}年${get("month")}月${get("day")}日 ${get("weekday")} ${get("hour")}:${get("minute")}`;
}

export function formatBeijingTime(iso: string): string {
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(new Date(iso));
}

export function formatBeijingIcsLocal(iso: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  }).formatToParts(new Date(iso));
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "00";
  return `${get("year")}${get("month")}${get("day")}T${get("hour")}${get("minute")}${get("second")}`;
}

function roundZh(round: string): string {
  return round
    .replace(/^Matchday (\d+)$/, "第 $1 比赛日")
    .replace(/^Round of 32$/, "32强赛")
    .replace(/^Round of 16$/, "16强赛")
    .replace(/^Quarter-finals?$/, "四分之一决赛")
    .replace(/^Semi-finals?$/, "半决赛")
    .replace(/^Final$/, "决赛");
}

function translatePlaceholder(team: string): string {
  if (/^[123][A-L](?:\/[A-L])*$/.test(team)) return team.replace("1", "第1名").replace("2", "第2名").replace("3", "第3名");
  if (/^W\d+$/.test(team)) return `第 ${team.slice(1)} 场胜者`;
  if (/^L\d+$/.test(team)) return `第 ${team.slice(1)} 场负者`;
  return team;
}

function countryFlag(countryCode: string): string {
  return [...countryCode.toUpperCase()]
    .map((letter) => String.fromCodePoint(0x1f1e6 + letter.charCodeAt(0) - 65))
    .join("");
}

function subdivisionFlag(tag: string): string {
  const tagChars = [...tag.toLowerCase()].map((char) => String.fromCodePoint(0xe0000 + char.charCodeAt(0)));
  return `${String.fromCodePoint(0x1f3f4)}${tagChars.join("")}${String.fromCodePoint(0xe007f)}`;
}
