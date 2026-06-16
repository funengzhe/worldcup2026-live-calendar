import { describe, expect, it } from "vitest";
import { normalizeSponsorAmount } from "./alipay.js";

describe("normalizeSponsorAmount", () => {
  it("normalizes valid sponsor amounts to two decimals", () => {
    expect(normalizeSponsorAmount(5)).toBe("5.00");
    expect(normalizeSponsorAmount("15.5")).toBe("15.50");
    expect(normalizeSponsorAmount("50.126")).toBe("50.13");
  });

  it("rejects invalid or unsafe sponsor amounts", () => {
    expect(() => normalizeSponsorAmount("abc")).toThrow("请输入有效赞助金额");
    expect(() => normalizeSponsorAmount(0.5)).toThrow("赞助金额需在 1-999 元之间");
    expect(() => normalizeSponsorAmount(1000)).toThrow("赞助金额需在 1-999 元之间");
  });
});
