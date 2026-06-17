import { afterEach, describe, expect, it, vi } from "vitest";
import { formatError } from "./errors.js";
import { fetchOpenFootballMatches } from "./openfootball.js";

const source = {
  name: "World Cup 2026",
  matches: [
    {
      round: "Matchday 1",
      date: "2026-06-11",
      time: "19:00",
      team1: "Mexico",
      team2: "South Africa",
      group: "Group A",
      ground: "Mexico City"
    }
  ]
};

describe("fetchOpenFootballMatches", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("retries transient fetch failures", async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(
        new TypeError("fetch failed", {
          cause: Object.assign(new Error("connect timeout"), {
            code: "UND_ERR_CONNECT_TIMEOUT"
          })
        })
      )
      .mockResolvedValueOnce(new Response(JSON.stringify(source), { status: 200 }));

    vi.stubGlobal("fetch", fetchMock);

    await expect(
      fetchOpenFootballMatches("https://example.com/worldcup.json", {
        attempts: 2,
        retryDelayMs: 0
      })
    ).resolves.toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe("formatError", () => {
  it("includes network error cause details", () => {
    const error = new TypeError("fetch failed", {
      cause: Object.assign(new Error("getaddrinfo ENOTFOUND raw.githubusercontent.com"), {
        code: "ENOTFOUND",
        syscall: "getaddrinfo",
        hostname: "raw.githubusercontent.com"
      })
    });

    expect(formatError(error)).toBe("fetch failed (cause: getaddrinfo ENOTFOUND raw.githubusercontent.com)");
  });
});
