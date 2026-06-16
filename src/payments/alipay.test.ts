import { describe, expect, it } from "vitest";
import { normalizePem, normalizeSponsorAmount } from "./alipay.js";

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

describe("normalizePem", () => {
  it("wraps bare Alipay keys with PEM headers", () => {
    const privateKey = normalizePem("a".repeat(70), "PRIVATE KEY");
    expect(privateKey).toContain("-----BEGIN PRIVATE KEY-----");
    expect(privateKey).toContain("-----END PRIVATE KEY-----");
    expect(privateKey).toContain(`${"a".repeat(64)}\n${"a".repeat(6)}`);

    const publicKey = normalizePem("b".repeat(65), "PUBLIC KEY");
    expect(publicKey).toContain("-----BEGIN PUBLIC KEY-----");
    expect(publicKey).toContain("-----END PUBLIC KEY-----");
  });

  it("keeps existing PEM content intact except escaped newlines", () => {
    const pem = "-----BEGIN PUBLIC KEY-----\\nabc\\n-----END PUBLIC KEY-----";
    expect(normalizePem(pem, "PUBLIC KEY")).toBe(
      "-----BEGIN PUBLIC KEY-----\nabc\n-----END PUBLIC KEY-----"
    );
  });
});
