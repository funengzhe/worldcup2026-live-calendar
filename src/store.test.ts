import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { JsonStore, upsertSavedCalendar } from "./store.js";

describe("JsonStore", () => {
  it("serializes concurrent updates with a file lock", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "wc2026-store-"));
    const store = new JsonStore(path.join(dir, "state.json"));

    try {
      await Promise.all(
        Array.from({ length: 12 }, async (_, index) => {
          await store.update(async (state) => {
            await new Promise((resolve) => setTimeout(resolve, index % 3));
            return {
              ...state,
              sponsors: [
                ...(state.sponsors ?? []),
                {
                  outTradeNo: `ORDER-${index}`,
                  amount: "1.00",
                  displayName: `球迷${index}`,
                  status: "pending",
                  createdAt: new Date(0).toISOString()
                }
              ]
            };
          });
        })
      );

      const state = await store.read();
      expect(state.sponsors).toHaveLength(12);
      expect(new Set(state.sponsors?.map((sponsor) => sponsor.outTradeNo))).toHaveProperty("size", 12);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("upserts saved custom calendar links", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "wc2026-store-"));
    const store = new JsonStore(path.join(dir, "state.json"));

    try {
      await store.update((state) =>
        upsertSavedCalendar(state, {
          slug: "abc123",
          query: "packs=prime&include=3",
          title: "黄金时间赛程",
          matchCount: 30,
          createdAt: "2026-06-17T00:00:00.000Z",
          updatedAt: "2026-06-17T00:00:00.000Z"
        })
      );
      await store.update((state) =>
        upsertSavedCalendar(state, {
          slug: "abc123",
          query: "packs=prime&include=3",
          title: "黄金时间赛程",
          matchCount: 31,
          createdAt: "2026-06-17T00:00:00.000Z",
          updatedAt: "2026-06-17T01:00:00.000Z"
        })
      );

      const state = await store.read();
      expect(state.savedCalendars).toHaveLength(1);
      expect(state.savedCalendars?.[0]).toMatchObject({
        slug: "abc123",
        matchCount: 31,
        updatedAt: "2026-06-17T01:00:00.000Z"
      });
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
