import { randomUUID } from "node:crypto";
import { AlipaySdk } from "alipay-sdk";
import type { AppConfig } from "../config.js";

export interface CreateAlipayOrderInput {
  amount: unknown;
  userAgent?: string;
}

export interface AlipayOrderResult {
  amount: string;
  formHtml: string;
  method: "page" | "wap";
  orderNo: string;
}

const MIN_AMOUNT = 1;
const MAX_AMOUNT = 999;

export function isAlipayConfigured(config: AppConfig): boolean {
  return Boolean(config.ALIPAY_APP_ID && config.ALIPAY_PRIVATE_KEY && config.ALIPAY_PUBLIC_KEY);
}

export function normalizeSponsorAmount(value: unknown): string {
  const amount = typeof value === "number" ? value : Number(String(value ?? "").trim());
  if (!Number.isFinite(amount)) {
    throw new Error("请输入有效赞助金额");
  }
  const normalized = Math.round(amount * 100) / 100;
  if (normalized < MIN_AMOUNT || normalized > MAX_AMOUNT) {
    throw new Error(`赞助金额需在 ${MIN_AMOUNT}-${MAX_AMOUNT} 元之间`);
  }
  return normalized.toFixed(2);
}

export function createSponsorOrderNo(): string {
  const stamp = new Date().toISOString().replace(/\D/g, "").slice(0, 14);
  return `WC2026SP${stamp}${randomUUID().replace(/-/g, "").slice(0, 10).toUpperCase()}`;
}

export function createAlipayOrder(
  config: AppConfig,
  input: CreateAlipayOrderInput
): AlipayOrderResult {
  if (!isAlipayConfigured(config)) {
    throw new Error("支付宝支付通道配置中");
  }

  const amount = normalizeSponsorAmount(input.amount);
  const orderNo = createSponsorOrderNo();
  const method = isMobileUserAgent(input.userAgent) ? "wap" : "page";
  const alipay = createAlipaySdk(config);
  const paymentMethod = method === "wap" ? "alipay.trade.wap.pay" : "alipay.trade.page.pay";
  const productCode = method === "wap" ? "QUICK_WAP_WAY" : "FAST_INSTANT_TRADE_PAY";
  const baseUrl = config.PUBLIC_BASE_URL.replace(/\/$/, "");

  const formHtml = alipay.pageExecute(paymentMethod, "POST", {
    bizContent: {
      out_trade_no: orderNo,
      product_code: productCode,
      subject: "2026 世界杯赛程日历开源赞助",
      body: "支持 worldcup2026-live-calendar 免费开源维护",
      total_amount: amount
    },
    returnUrl: config.ALIPAY_RETURN_URL ?? `${baseUrl}/?payment=return`,
    notifyUrl: config.ALIPAY_NOTIFY_URL ?? `${baseUrl}/api/v1/alipay/notify`
  });

  return { amount, formHtml, method, orderNo };
}

export function verifyAlipayNotify(config: AppConfig, payload: Record<string, unknown>): boolean {
  if (!isAlipayConfigured(config)) return false;
  const alipay = createAlipaySdk(config);
  return alipay.checkNotifySign(payload, true);
}

function createAlipaySdk(config: AppConfig): AlipaySdk {
  return new AlipaySdk({
    appId: config.ALIPAY_APP_ID ?? "",
    privateKey: normalizePem(config.ALIPAY_PRIVATE_KEY ?? ""),
    alipayPublicKey: normalizePem(config.ALIPAY_PUBLIC_KEY ?? ""),
    gateway: config.ALIPAY_GATEWAY,
    signType: "RSA2",
    camelcase: true
  });
}

function normalizePem(value: string): string {
  return value.replace(/\\n/g, "\n").trim();
}

function isMobileUserAgent(userAgent = ""): boolean {
  return /Android|iPhone|iPad|iPod|Mobile|MicroMessenger/i.test(userAgent);
}
