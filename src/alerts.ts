import type { AppConfig } from "./config.js";

const lastSentAt = new Map<string, number>();

export async function sendAlert(
  config: AppConfig,
  event: { key: string; title: string; message: string; severity?: "warning" | "critical" }
): Promise<void> {
  if (!config.ALERT_WEBHOOK_URL) return;

  const now = Date.now();
  const last = lastSentAt.get(event.key) ?? 0;
  if (now - last < 5 * 60 * 1000) return;
  lastSentAt.set(event.key, now);

  const payload = {
    title: event.title,
    severity: event.severity ?? "warning",
    message: event.message,
    service: "worldcup2026-live-calendar",
    sentAt: new Date(now).toISOString()
  };

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
