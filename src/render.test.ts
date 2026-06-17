import { describe, expect, it } from "vitest";
import { buildCustomFeed } from "./customFeed.js";
import { renderCustomSharePage, renderHome } from "./render.js";
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
      sponsors: [
        {
          outTradeNo: "WC2026SPLOW",
          tradeNo: "202606162159000000",
          amount: "5.00",
          displayName: "小额球迷",
          note: "先占座",
          status: "paid",
          createdAt: "2026-06-16T13:00:00.000Z",
          paidAt: "2026-06-16T13:05:00.000Z"
        },
        {
          outTradeNo: "WC2026SPTEST",
          tradeNo: "202606162200000000",
          amount: "50.00",
          displayName: "测试球迷",
          note: "一起看球",
          status: "paid",
          createdAt: "2026-06-16T14:00:00.000Z",
          paidAt: "2026-06-16T14:05:00.000Z"
        },
        {
          outTradeNo: "WC2026SPHIGH",
          tradeNo: "202606162201000000",
          amount: "100.00",
          displayName: "榜一球迷",
          note: "冲榜",
          status: "paid",
          createdAt: "2026-06-16T12:00:00.000Z",
          paidAt: "2026-06-16T12:05:00.000Z"
        }
      ],
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

    expect(html).toContain("2026 FIFA 世界杯赛程日历订阅");
    expect(html).toContain("极速订阅控制台");
    expect(html).toContain("worldcup-trophy-hero.webp");
    expect(html).toContain("日历订阅说明");
    expect(html).not.toContain("央视漏斗流");
    expect(html).not.toContain("赛事通行证");
    expect(html).not.toContain("日历订阅深度说明舱");
    expect(html).toContain("荣耀赞助英雄榜");
    expect(html).toContain("数据基于支付宝网关安全加密结算");
    expect(html).toContain("不打赏作者也完全支持你免费使用全部赛程订阅功能");
    expect(html).toContain("名字永久荣登荣耀榜");
    expect(html).toContain("前三名获得头号球迷 / 核心球迷 / 助攻球迷标记");
    expect(html.indexOf("榜一球迷")).toBeLessThan(html.indexOf("测试球迷"));
    expect(html.indexOf("测试球迷")).toBeLessThan(html.indexOf("小额球迷"));
    expect(html).toContain("头号球迷");
    expect(html).toContain("核心球迷");
    expect(html).toContain("助攻球迷");
    expect(html).not.toContain("冠军 / 亚军 / 季军");
    expect(html).toContain("测试球迷");
    expect(html).toContain("一起看球");
    expect(html).toContain("2026 绿茵星光等待点亮");
    expect(html).toContain("绿茵同路人");
    expect(html).toContain("免费也欢迎使用");
    expect(html).not.toContain("视觉打样");
    expect(html).not.toContain("打样");
    expect(html.indexOf("sponsor-checkout")).toBeLessThan(html.indexOf("2026 绿茵星光等待点亮"));
    expect(html.indexOf("2026 绿茵星光等待点亮")).toBeLessThan(html.indexOf("赞助支持 / 为爱发电"));
    expect(html).toContain("支球队");
    expect(html).toContain("场比赛");
    expect(html).toContain("<svg");
    expect(html).toContain('data-copy="webcal://example.com/worldcup2026.ics"');
    expect(html).toContain("微信内打开可能无法唤起手机日历");
    expect(html).toContain("赛果持续同步");
    expect(html).toContain("联系方式仅用于必要时回复反馈");
    expect(html).toContain('background-attachment:scroll');
    expect(html).toContain('background-attachment:fixed');
    expect(html).not.toContain("wechatTip.hidden = false;\n  }");
    expect(html).toContain("订阅链接已复制");
    expect(html).toContain("sponsor-checkout");
    expect(html).toContain("/api/v1/alipay/create_order");
    expect(html).toContain('paymentStatus === "success"');
    expect(html).toContain("赞助支付成功");
    expect(html).toContain("墨西哥");
    expect(html).toContain("南非");
    expect(html).toContain("score-stack");
    expect(html).toContain("team-flag");
    expect(html).toContain("CCTV 5 直播");
    expect(html).toContain("https://worldcup.cctv.com/2026/schedule/index.shtml");
    expect(html).not.toContain("search.cctv.com/search.php");
    expect(html).toContain("我的日历");
    expect(html).toContain("生成你的专属世界杯日历");
    expect(html).toContain("定制我的世界杯日历");
    expect(html).toContain("关心的球星");
    expect(html).toContain("全部赛程");
    expect(html).toContain("我的主队");
    expect(html).toContain("强强对话");
    expect(html).toContain("少熬夜精选");
    expect(html).not.toContain("当前日历包含");
    expect(html).not.toContain("高级筛选");
    expect(html).not.toContain("只看回放");
    expect(html).toContain("applyCustomPreset");
    expect(html).toContain("data-custom-team-search");
    expect(html).toContain("总计 ");
    expect(html).toContain("已选择 ");
    expect(html).toContain("未选择 ");
    expect(html).toContain("data-custom-chip");
    expect(html).toContain("添加到手机日历");
    expect(html).toContain("打开分享海报");
    expect(html).toContain("保存并添加到手机日历");
    expect(html).toContain("/api/v1/calendars/save");
    expect(html).toContain("我的赛程清单");
    expect(html).toContain("全部可选比赛");
    expect(html).toContain("data-custom-remove");
    expect(html).toContain("data-custom-add");
    expect(html).toContain("data-custom-restore");
    expect(html).toContain("custom-preview");
    expect(html).toContain("team-feed-card");
    expect(html).toContain("radial-gradient(circle at 18% 0%");
    expect(html).toContain("custom-builder");
    expect(html).toContain("renderKnockoutGroups");
    expect(html).toContain("knockout-bracket-frame.png");
    expect(html).toContain("knockout-canvas");
    expect(html).toContain("bracket-match-card");
    expect(html).toContain("/feeds/custom.ics");
    expect(html).toContain("/share/custom");
    expect(html).toContain("开源与免费");
    expect(html).not.toContain("支付入口已合并到荣耀榜收银台");
    expect(html).not.toContain("在上方荣耀榜里支持维护");
    const footerHtml = html.slice(html.indexOf('<footer class="site-footer">'));
    expect(footerHtml.indexOf("留言与反馈")).toBeLessThan(footerHtml.indexOf("免费使用"));
    expect(footerHtml.indexOf("免费使用")).toBeLessThan(footerHtml.indexOf("开源仓库"));
    expect(footerHtml.indexOf("开源仓库")).toBeLessThan(footerHtml.indexOf("开源与免费"));
    expect(html).not.toContain("页面内安全支付");
    expect(html).toContain("支付宝官方安全支付");
    expect(html).toContain("webcal://example.com/feeds/teams/mexico.ics");
    expect(html).not.toContain("小组积分");
    expect(html).not.toContain("下载 ICS");
    expect(html).not.toContain("pass-title");
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

    expect(html).not.toContain('href="https://example.com/alipay"');
    expect(html).not.toContain('src="https://example.com/alipay-qr.png"');
    expect(html).not.toContain("支付宝支持已开启");
    expect(html).not.toContain("支付入口已合并到荣耀榜收银台");
    expect(html).not.toContain("在上方荣耀榜里支持维护");
    expect(html).not.toContain("支付宝通道准备中");
    expect(html).not.toContain("页面内安全支付");
  });

  it("uses cached CCTV match URLs when available", async () => {
    const html = await renderHome(
      {
        matches: [
          {
            ...match,
            status: "final",
            score: { home: 2, away: 0 },
            cctvGameId: 22920296,
            cctvUrl: "https://worldcup.cctv.com/2026/match/22920296/index.shtml",
            cctvVenue: "阿兹台克人体育场",
            cctvChannel: "CCTV5"
          }
        ],
        providers: []
      },
      "https://example.com"
    );

    expect(html).toContain("https://worldcup.cctv.com/2026/match/22920296/index.shtml");
    expect(html).toContain("墨西哥城 · 阿兹台克人体育场");
    expect(html).toContain("CCTV 5 回放");
    expect(html).toContain('class="replay"');
  });

  it("renders custom subscription share pages", async () => {
    const feed = buildCustomFeed([match], {
      packs: [],
      teams: ["Mexico"],
      stars: [],
      stages: ["group", "knockout"],
      statuses: ["scheduled", "live", "final"],
      timeStart: undefined,
      timeEnd: undefined,
      include: [],
      exclude: []
    });

    const html = await renderCustomSharePage(feed, "https://example.com");

    expect(html).toContain("我的世界杯观赛日历");
    expect(html).toContain("2026 世界杯：🇲🇽 墨西哥专属赛程");
    expect(html).toContain("webcal://example.com/feeds/custom.ics?teams=mexico");
    expect(html).toContain("https://example.com/share/custom?teams=mexico");
    expect(html).toContain("share-poster");
    expect(html).toContain("扫码添加同款赛程日历");
    expect(html).toContain("wc2026.funengzhe.cn");
    expect(html).not.toContain('<section class="share-preview">');
    expect(html).not.toContain('<div id="schedule-panel">');
    expect(html).toContain("墨西哥");
  });
});
