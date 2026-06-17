import path from "node:path";
import "dotenv/config";
import { z } from "zod";

const optionalUrl = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z.string().url().optional()
);
const optionalString = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z.string().optional()
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
    .default(6 * 60 * 60 * 1000),
  SCORE_SYNC_INTERVAL_MS: z.coerce
    .number()
    .int()
    .positive()
    .default(2 * 60 * 1000),
  HEALTH_WORKER_STALE_MS: z.coerce
    .number()
    .int()
    .positive()
    .default(3 * 60 * 1000),
  HEALTH_PUBLICATION_STALE_MS: z.coerce
    .number()
    .int()
    .positive()
    .default(10 * 60 * 1000),
  HEALTH_PROVIDER_STALE_MS: z.coerce
    .number()
    .int()
    .positive()
    .default(10 * 60 * 1000),
  STATUS_ACCESS_TOKEN: optionalString,
  PAYMENT_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(8),
  PAYMENT_RATE_LIMIT_WINDOW_MS: z.coerce
    .number()
    .int()
    .positive()
    .default(60 * 1000),
  FEEDBACK_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(5),
  FEEDBACK_RATE_LIMIT_WINDOW_MS: z.coerce
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
  CCTV_SCHEDULE_URL: z
    .string()
    .url()
    .default("https://cbs-i.sports.cctv.com/cache/f26a37123b56df9205cf3948f7a3e316"),
  CCTV_TEAMS_URL: z
    .string()
    .url()
    .default("https://cbs-i.sports.cctv.com/cache/b49c143bf8df1155842a51313a2e1e19"),
  SUPPORT_ALIPAY_URL: optionalUrl,
  SUPPORT_ALIPAY_QR_URL: optionalUrl,
  SUPPORT_GITHUB_SPONSORS_URL: optionalUrl,
  ALIPAY_APP_ID: optionalString,
  ALIPAY_PRIVATE_KEY: optionalString,
  ALIPAY_PRIVATE_KEY_TYPE: z.enum(["PKCS1", "PKCS8"]).default("PKCS8"),
  ALIPAY_PUBLIC_KEY: optionalString,
  ALIPAY_GATEWAY: z.string().url().default("https://openapi.alipay.com/gateway.do"),
  ALIPAY_RETURN_URL: optionalUrl,
  ALIPAY_NOTIFY_URL: optionalUrl,
  FEISHU_APP_ID: optionalString,
  FEISHU_APP_SECRET: optionalString,
  FEISHU_WEBHOOK_URL: optionalUrl,
  FEISHU_WEBHOOK_SECRET: optionalString,
  ALERT_WEBHOOK_URL: optionalUrl,
  ALERT_WEBHOOK_TYPE: z.enum(["generic", "feishu", "slack"]).default("generic")
});

export type AppConfig = ReturnType<typeof loadConfig>;

export function loadConfig() {
  const env = EnvSchema.parse(process.env);
  const root = process.cwd();
  const alertWebhookUrl = env.ALERT_WEBHOOK_URL ?? env.FEISHU_WEBHOOK_URL;
  const alertWebhookType = env.ALERT_WEBHOOK_URL ? env.ALERT_WEBHOOK_TYPE : env.FEISHU_WEBHOOK_URL ? "feishu" : env.ALERT_WEBHOOK_TYPE;

  return {
    ...env,
    ALERT_WEBHOOK_URL: alertWebhookUrl,
    ALERT_WEBHOOK_TYPE: alertWebhookType,
    dataDir: path.resolve(root, env.DATA_DIR),
    publicDir: path.resolve(root, env.PUBLIC_DIR),
    calendarPath: path.resolve(root, env.DATA_DIR, "worldcup2026.ics"),
    statePath: path.resolve(root, env.DATA_DIR, "state.json")
  };
}
