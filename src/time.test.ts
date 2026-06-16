import { describe, expect, it } from "vitest";
import { parseOpenFootballDateTime } from "./time.js";

describe("parseOpenFootballDateTime", () => {
  it("converts negative UTC offsets to absolute UTC", () => {
    expect(parseOpenFootballDateTime("2026-06-11", "13:00 UTC-6")).toBe(
      "2026-06-11T19:00:00.000Z"
    );
  });

  it("converts positive UTC offsets to absolute UTC", () => {
    expect(parseOpenFootballDateTime("2026-06-11", "20:00 UTC+2")).toBe(
      "2026-06-11T18:00:00.000Z"
    );
  });
});
