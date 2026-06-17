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
      severity: "严重",
      message: "worker tick failed",
      service: "2026 世界杯赛程日历",
      sentAt: "2026/06/16 08:00:00"
    });
  });

  it("formats Feishu bot text alerts", () => {
    expect(formatAlertPayload("feishu", event, sentAt)).toEqual({
      msg_type: "text",
      content: {
        text: expect.stringContaining("【2026 世界杯日历通知】Calendar sync failed")
      }
    });
    expect(formatAlertPayload("feishu", event, sentAt)).toMatchObject({
      content: {
        text: expect.stringContaining("级别：严重")
      }
    });
  });

  it("formats Slack text alerts", () => {
    expect(formatAlertPayload("slack", event, sentAt)).toEqual({
      text: expect.stringContaining("worker tick failed")
    });
  });
});
