import { describe, expect, it } from "vitest";
import { generateKeyPairSync } from "node:crypto";
import type { AppConfig } from "../config.js";
import { createAlipayOrder, inferPrivateKeyType, normalizePem, normalizeSponsorAmount } from "./alipay.js";

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

describe("inferPrivateKeyType", () => {
  it("detects key type from PEM headers and otherwise uses fallback", () => {
    expect(inferPrivateKeyType("-----BEGIN PRIVATE KEY-----\nabc")).toBe("PKCS8");
    expect(inferPrivateKeyType("-----BEGIN RSA PRIVATE KEY-----\nabc")).toBe("PKCS1");
    expect(inferPrivateKeyType("abc", "PKCS8")).toBe("PKCS8");
    expect(inferPrivateKeyType("abc", "PKCS1")).toBe("PKCS1");
  });
});

describe("createAlipayOrder", () => {
  it("requests QR-first page payment on desktop and success return anchoring", () => {
    const { privateKey, publicKey } = generateKeyPairSync("rsa", {
      modulusLength: 2048,
      privateKeyEncoding: { type: "pkcs8", format: "pem" },
      publicKeyEncoding: { type: "spki", format: "pem" }
    });

    const order = createAlipayOrder(
      ({
        ALIPAY_APP_ID: "2021000000000000",
        ALIPAY_PRIVATE_KEY: privateKey,
        ALIPAY_PRIVATE_KEY_TYPE: "PKCS8",
        ALIPAY_PUBLIC_KEY: publicKey,
        ALIPAY_GATEWAY: "https://openapi.alipay.com/gateway.do",
        PUBLIC_BASE_URL: "https://wc2026.example.com"
      } as unknown as AppConfig),
      { amount: 5, userAgent: "Mozilla/5.0" }
    );

    expect(order.method).toBe("page");
    expect(order.formHtml).toContain("qr_pay_mode");
    expect(order.formHtml).toContain("qrcode_width");
    expect(order.formHtml).toContain("payment%3Dsuccess%23honor-wall");
  });
});
