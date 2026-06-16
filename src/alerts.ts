import type { AppConfig } from "./config.js";

const lastSentAt = new Map<string, number>();

interface AlertEvent {
  key: string;
  title: string;
  message: string;
  severity?: "warning" | "critical";
}

export async function sendAlert(
  config: AppConfig,
  event: AlertEvent
): Promise<void> {
  if (!config.ALERT_WEBHOOK_URL) return;

  const now = Date.now();
  const last = lastSentAt.get(event.key) ?? 0;
  if (now - last < 5 * 60 * 1000) return;
  lastSentAt.set(event.key, now);

  const payload = formatAlertPayload(config.ALERT_WEBHOOK_TYPE, event, new Date(now));

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

export function formatAlertPayload(type: AppConfig["ALERT_WEBHOOK_TYPE"], event: AlertEvent, sentAt: Date) {
  const severity = event.severity ?? "warning";
  const text = `[${severity.toUpperCase()}] ${event.title}\n${event.message}\nservice: worldcup2026-live-calendar\nsentAt: ${sentAt.toISOString()}`;

  if (type === "feishu") {
    return {
      msg_type: "text",
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
    severity,
    message: event.message,
    service: "worldcup2026-live-calendar",
    sentAt: sentAt.toISOString()
  };
}

export async function sendTestAlert(config: AppConfig): Promise<void> {
  if (!config.ALERT_WEBHOOK_URL) {
    throw new Error("ALERT_WEBHOOK_URL is not configured");
  }

  await sendAlert(config, {
    key: `test-${Date.now()}`,
    title: "World Cup 2026 calendar alert test",
    message: "This is a test alert from worldcup2026-live-calendar.",
    severity: "warning"
  });
}
