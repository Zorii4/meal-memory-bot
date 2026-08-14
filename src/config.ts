import { z } from "zod";

const DEFAULT_AI_TIMEOUT_MS = 20_000;
const MAX_AI_TIMEOUT_MS = 25_000;
const DEFAULT_AI_RESPONSE_FORMAT = "json_object";
const DEFAULT_AI_TEMPERATURE = 0.2;

const requiredString = z.string().trim().min(1);

const configSchema = z.object({
  TELEGRAM_BOT_TOKEN: requiredString,
  TELEGRAM_WEBHOOK_SECRET: requiredString,
  TELEGRAM_ALLOWED_USER_IDS: requiredString,
  AI_API_KEY: requiredString,
  AI_BASE_URL: requiredString.url(),
  AI_MODEL: requiredString,
  AI_TIMEOUT_MS: z
    .string()
    .trim()
    .min(1)
    .optional()
    .transform((value) => (value === undefined ? DEFAULT_AI_TIMEOUT_MS : Number(value)))
    .pipe(z.number().finite().int().min(1).max(MAX_AI_TIMEOUT_MS)),
  AI_RESPONSE_FORMAT: z
    .enum(["json_schema", "json_object"])
    .default(DEFAULT_AI_RESPONSE_FORMAT),
  AI_TEMPERATURE: z
    .string()
    .trim()
    .min(1)
    .optional()
    .transform((value) => (value === undefined ? DEFAULT_AI_TEMPERATURE : Number(value)))
    .pipe(z.number().finite().min(0).max(2)),
  AI_REASONING_EFFORT: z.enum(["low"]).optional(),
  APP_ENV: z.enum(["development", "production"]).default("development")
});

export interface AppConfig {
  telegram: {
    botToken: string;
    webhookSecret: string;
    allowedUserIds: ReadonlySet<string>;
  };
  ai: {
    apiKey: string;
    baseUrl: string;
    model: string;
    timeoutMs: number;
    responseFormat: "json_schema" | "json_object";
    temperature: number;
    reasoningEffort: "low" | undefined;
  };
  appEnv: "development" | "production";
}

export class ConfigurationError extends Error {
  public readonly code = "CONFIG_INVALID";

  public constructor() {
    super("Invalid application configuration");
    this.name = "ConfigurationError";
  }
}

export function parseAllowedUserIds(value: string): ReadonlySet<string> {
  const userIds = value.split(",").map((userId) => userId.trim());

  if (userIds.length === 0 || userIds.some((userId) => userId.length === 0)) {
    throw new ConfigurationError();
  }

  return new Set(userIds);
}

export function parseConfig(value: unknown): AppConfig {
  const result = configSchema.safeParse(value);

  if (!result.success) {
    throw new ConfigurationError();
  }

  return {
    telegram: {
      botToken: result.data.TELEGRAM_BOT_TOKEN,
      webhookSecret: result.data.TELEGRAM_WEBHOOK_SECRET,
      allowedUserIds: parseAllowedUserIds(result.data.TELEGRAM_ALLOWED_USER_IDS)
    },
    ai: {
      apiKey: result.data.AI_API_KEY,
      baseUrl: result.data.AI_BASE_URL,
      model: result.data.AI_MODEL,
      timeoutMs: result.data.AI_TIMEOUT_MS,
      responseFormat: result.data.AI_RESPONSE_FORMAT,
      temperature: result.data.AI_TEMPERATURE,
      reasoningEffort: result.data.AI_REASONING_EFFORT
    },
    appEnv: result.data.APP_ENV
  };
}
