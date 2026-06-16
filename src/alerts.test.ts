import { describe, expect, it } from "vitest";
import { formatAlertPayload } from "./alerts.js";

const event = {
  key: "test",
  title: "Calendar sync failed",
  message: "worker tick failed",
  severity: "critical" as const
};

const sentAt = new Date("2026-06-16T00:00:00.000Z");

describe("formatAlertPayload", () => {
  it("formats generic JSON alerts", () => {
    expect(formatAlertPayload("generic", event, sentAt)).toEqual({
      title: "Calendar sync failed",
      severity: "critical",
      message: "worker tick failed",
      service: "worldcup2026-live-calendar",
      sentAt: "2026-06-16T00:00:00.000Z"
    });
  });

  it("formats Feishu bot text alerts", () => {
    expect(formatAlertPayload("feishu", event, sentAt)).toEqual({
      msg_type: "text",
      content: {
        text: expect.stringContaining("[CRITICAL] Calendar sync failed")
      }
    });
  });

  it("formats Slack text alerts", () => {
    expect(formatAlertPayload("slack", event, sentAt)).toEqual({
      text: expect.stringContaining("worker tick failed")
    });
  });
});
