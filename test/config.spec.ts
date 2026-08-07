import { describe, expect, it } from "vitest";
import { ConfigurationError, parseAllowedUserIds, parseConfig } from "../src/config";

const validEnvironment = {
  TELEGRAM_BOT_TOKEN: "telegram-token",
  TELEGRAM_WEBHOOK_SECRET: "webhook-secret",
  TELEGRAM_ALLOWED_USER_IDS: "123, 9007199254740993",
  AI_API_KEY: "ai-key",
  AI_BASE_URL: "https://provider.example/v1",
  AI_MODEL: "example-model"
};

describe("parseAllowedUserIds", () => {
  it("trims IDs and preserves them as strings", () => {
    const userIds = parseAllowedUserIds(" 123 , 9007199254740993 ");

    expect([...userIds]).toEqual(["123", "9007199254740993"]);
  });

  it.each(["", "   ", "123,", ",123", "123, ,456"])("rejects an empty allowlist entry: %j", (value) => {
    expect(() => parseAllowedUserIds(value)).toThrow(ConfigurationError);
  });
});

describe("parseConfig", () => {
  it("uses safe defaults for optional runtime settings", () => {
    expect(parseConfig(validEnvironment)).toMatchObject({
      telegram: {
        allowedUserIds: new Set(["123", "9007199254740993"])
      },
      ai: {
        timeoutMs: 20_000
      },
      appEnv: "development"
    });
  });

  it.each([
    [{ ...validEnvironment, TELEGRAM_BOT_TOKEN: "" }],
    [{ ...validEnvironment, AI_BASE_URL: "not a URL" }],
    [{ ...validEnvironment, AI_TIMEOUT_MS: "25001" }],
    [{ ...validEnvironment, APP_ENV: "test" }]
  ])("rejects an invalid environment", (environment) => {
    expect(() => parseConfig(environment)).toThrow(ConfigurationError);
  });
});
