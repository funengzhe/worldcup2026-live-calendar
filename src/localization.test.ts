import { describe, expect, it } from "vitest";
import {
  formatBeijingDateTime,
  formatBeijingIcsLocal,
  teamDisplayNameZh,
  teamFlag,
  teamNameZh,
  venueZh
} from "./localization.js";

describe("localization", () => {
  it("translates teams and venues", () => {
    expect(teamNameZh("Mexico")).toBe("墨西哥");
    expect(teamNameZh("DR Congo")).toBe("刚果（金）");
    expect(teamNameZh("W101")).toBe("第 101 场胜者");
    expect(venueZh("New York/New Jersey (East Rutherford)")).toBe(
      "纽约/新泽西 · 纽约新泽西体育场（东卢瑟福）"
    );
  });

  it("adds flags to real teams but not placeholders", () => {
    expect(teamFlag("Mexico")).toBe("🇲🇽");
    expect(teamDisplayNameZh("Mexico")).toBe("🇲🇽 墨西哥");
    expect(teamDisplayNameZh("W101")).toBe("第 101 场胜者");
  });

  it("formats Beijing time for display and ICS", () => {
    expect(formatBeijingIcsLocal("2026-06-11T19:00:00.000Z")).toBe("20260612T030000");
    expect(formatBeijingDateTime("2026-06-11T19:00:00.000Z")).toContain("2026年06月12日");
    expect(formatBeijingDateTime("2026-06-11T19:00:00.000Z")).toContain("03:00");
  });
});
