import { describe, expect, it } from "vitest";
import { renderHome } from "./render.js";
import type { AppState, Match } from "./types.js";

const match: Match = {
  id: "match-001",
  matchNo: 1,
  round: "Matchday 1",
  group: "Group A",
  stage: "group",
  kickoffAtUtc: "2026-06-11T19:00:00.000Z",
  homeTeam: "Mexico",
  awayTeam: "South Africa",
  venue: "Mexico City",
  status: "scheduled",
  goals: [],
  confidence: "none",
  source: "schedule",
  sequence: 0,
  updatedAt: "2026-06-01T00:00:00.000Z"
};

describe("renderHome", () => {
  it("renders a user-facing subscription and schedule page", async () => {
    const state: AppState = {
      matches: [match],
      providers: [],
      publication: {
        version: 1,
        publishedAt: "2026-06-01T00:00:00.000Z",
        matchCount: 1,
        finalCount: 0,
        path: "/worldcup2026.ics",
        sha256: "abc"
      }
    };

    const html = await renderHome(state, "https://example.com");

    expect(html).toContain("2026世界杯赛程");
    expect(html).toContain("MATCH PASS");
    expect(html).toContain("支球队");
    expect(html).toContain("场比赛");
    expect(html).toContain("<svg");
    expect(html).toContain('data-copy="webcal://example.com/worldcup2026.ics"');
    expect(html).toContain("墨西哥");
    expect(html).toContain("南非");
    expect(html).toContain("score-stack");
    expect(html).toContain("team-flag");
    expect(html).toContain("CCTV 5 直播");
    expect(html).toContain("支付宝通道准备中");
    expect(html).not.toContain("小组积分");
    expect(html).not.toContain("下载 ICS");
  });

  it("renders configured support links without hard-coded payment details", async () => {
    const state: AppState = {
      matches: [match],
      providers: [],
      publication: {
        version: 1,
        publishedAt: "2026-06-01T00:00:00.000Z",
        matchCount: 1,
        finalCount: 0,
        path: "/worldcup2026.ics",
        sha256: "abc"
      }
    };

    const html = await renderHome(state, "https://example.com", {
      alipayUrl: "https://example.com/alipay",
      alipayQrUrl: "https://example.com/alipay-qr.png",
      githubSponsorsUrl: "https://github.com/sponsors/funengzhe"
    });

    expect(html).toContain('href="https://example.com/alipay"');
    expect(html).toContain('src="https://example.com/alipay-qr.png"');
    expect(html).toContain("支付宝支持已开启");
    expect(html).not.toContain("支付宝通道准备中");
  });
});
