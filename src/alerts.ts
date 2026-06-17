import { createHmac } from "node:crypto";
import type { AppConfig } from "./config.js";

const lastSentAt = new Map<string, number>();

interface AlertEvent {
  key: string;
  title: string;
  message: string;
  severity?: "warning" | "critical";
  cooldownMs?: number;
}

export async function sendAlert(
  config: AppConfig,
  event: AlertEvent
): Promise<void> {
  if (!config.ALERT_WEBHOOK_URL) return;

  const now = Date.now();
  const last = lastSentAt.get(event.key) ?? 0;
  if (now - last < (event.cooldownMs ?? 5 * 60 * 1000)) return;
  lastSentAt.set(event.key, now);

  const payload = formatAlertPayload(config.ALERT_WEBHOOK_TYPE, event, new Date(now), {
    feishuSecret: config.FEISHU_WEBHOOK_SECRET
  });

  try {
    await fetch(config.ALERT_WEBHOOK_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload)
    });
  } catch (error) {
    console.error("alert delivery failed", error);
  }
}

export function formatAlertPayload(
  type: AppConfig["ALERT_WEBHOOK_TYPE"],
  event: AlertEvent,
  sentAt: Date,
  options: { feishuSecret?: string } = {}
) {
  const severity = event.severity ?? "warning";
  const text = formatAlertText(event, sentAt);

  if (type === "feishu") {
    const timestamp = Math.floor(sentAt.getTime() / 1000).toString();
    return {
      msg_type: "text",
      ...(options.feishuSecret ? { timestamp, sign: createFeishuSign(timestamp, options.feishuSecret) } : {}),
      content: {
        text
      }
    };
  }

  if (type === "slack") {
    return {
      text
    };
  }

  return {
    title: event.title,
    severity: severityZh(severity),
    message: event.message,
    service: "2026 世界杯赛程日历",
    sentAt: formatBeijingTime(sentAt)
  };
}

function formatAlertText(event: AlertEvent, sentAt: Date): string {
  const severity = event.severity ?? "warning";
  return [
    `【2026 世界杯日历通知】${event.title}`,
    `级别：${severityZh(severity)}`,
    event.message,
    "服务：2026 世界杯赛程日历",
    `时间：${formatBeijingTime(sentAt)}`
  ].join("\n");
}

function severityZh(severity: NonNullable<AlertEvent["severity"]>): string {
  return severity === "critical" ? "严重" : "提醒";
}

function formatBeijingTime(date: Date): string {
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  }).format(date);
}

export function createFeishuSign(timestamp: string, secret: string): string {
  return createHmac("sha256", `${timestamp}\n${secret}`).update("").digest("base64");
}

export async function sendTestAlert(config: AppConfig): Promise<void> {
  if (!config.ALERT_WEBHOOK_URL) {
    throw new Error("ALERT_WEBHOOK_URL is not configured");
  }

  await sendAlert(config, {
    key: `test-${Date.now()}`,
    title: "飞书通知测试",
    message: "这是一条来自 2026 世界杯赛程日历服务的测试通知。收到这条消息，说明飞书通知通道已经打通。",
    severity: "warning"
  });
}
