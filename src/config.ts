import path from "node:path";
import { z } from "zod";

const optionalUrl = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z.string().url().optional()
);

const EnvSchema = z.object({
  PUBLIC_BASE_URL: z.string().url().default("http://localhost:3000"),
  CALENDAR_DOMAIN: z.string().default("localhost"),
  PORT: z.coerce.number().int().positive().default(3000),
  HOST: z.string().default("0.0.0.0"),
  DATA_DIR: z.string().default("data/runtime"),
  PUBLIC_DIR: z.string().default("public"),
  OPENFOOTBALL_URL: z
    .string()
    .url()
    .default(
      "https://raw.githubusercontent.com/openfootball/worldcup.json/master/2026/worldcup.json"
    ),
  SCHEDULE_SYNC_INTERVAL_MS: z.coerce
    .number()
    .int()
    .positive()
    .default(30 * 60 * 1000),
  SCORE_SYNC_INTERVAL_MS: z.coerce
    .number()
    .int()
    .positive()
    .default(60 * 1000),
  HEALTH_WORKER_STALE_MS: z.coerce
    .number()
    .int()
    .positive()
    .default(3 * 60 * 1000),
  HEALTH_PUBLICATION_STALE_MS: z.coerce
    .number()
    .int()
    .positive()
    .default(15 * 60 * 1000),
  HEALTH_PROVIDER_STALE_MS: z.coerce
    .number()
    .int()
    .positive()
    .default(10 * 60 * 1000),
  PRIMARY_SCORE_PROVIDER: z.string().default("openfootball"),
  PRIMARY_SCORE_PROVIDER_API_KEY: z.string().optional(),
  SECONDARY_SCORE_PROVIDER: z.string().default("mock"),
  SECONDARY_SCORE_PROVIDER_API_KEY: z.string().optional(),
  API_FOOTBALL_BASE_URL: z.string().url().default("https://v3.football.api-sports.io"),
  API_FOOTBALL_API_KEY: z.string().optional(),
  API_FOOTBALL_LEAGUE_ID: z.coerce.number().int().positive().default(1),
  API_FOOTBALL_SEASON: z.coerce.number().int().positive().default(2026),
  SUPPORT_ALIPAY_URL: optionalUrl,
  SUPPORT_ALIPAY_QR_URL: optionalUrl,
  SUPPORT_GITHUB_SPONSORS_URL: optionalUrl,
  ALERT_WEBHOOK_URL: z.string().optional(),
  ALERT_WEBHOOK_TYPE: z.enum(["generic", "feishu", "slack"]).default("generic")
});

export type AppConfig = ReturnType<typeof loadConfig>;

export function loadConfig() {
  const env = EnvSchema.parse(process.env);
  const root = process.cwd();

  return {
    ...env,
    dataDir: path.resolve(root, env.DATA_DIR),
    publicDir: path.resolve(root, env.PUBLIC_DIR),
    calendarPath: path.resolve(root, env.PUBLIC_DIR, "worldcup2026.ics"),
    statePath: path.resolve(root, env.DATA_DIR, "state.json")
  };
}
