import { createBot } from "./bot/create-bot";
import { handleWebhookUpdate } from "./bot/handle-webhook-update";
import { parseConfig } from "./config";
import { AIClient } from "./infrastructure/ai/ai-client";
import {
  recommendationSystemPrompt,
  similarRecommendationSystemPrompt
} from "./infrastructure/ai/prompts/recommendation.local";
import { D1DishRepository } from "./infrastructure/d1/dish-repository";
import { D1HistoryRepository } from "./infrastructure/d1/history-repository";
import { D1StateRepository } from "./infrastructure/d1/state-repository";

interface WorkerEnv {
  DB: D1Database;
  TELEGRAM_BOT_TOKEN: string;
  TELEGRAM_WEBHOOK_SECRET: string;
  TELEGRAM_ALLOWED_USER_IDS: string;
  AI_API_KEY: string;
  AI_BASE_URL: string;
  AI_MODEL: string;
  AI_TIMEOUT_MS?: string;
  APP_ENV?: "development" | "production";
}

const worker: ExportedHandler<WorkerEnv> = {
  async fetch(request, env, ctx): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "GET" && url.pathname === "/health") {
      return Response.json({ status: "ok" });
    }

    if (request.method === "POST" && url.pathname === "/telegram/webhook") {
      const secret = request.headers.get("X-Telegram-Bot-Api-Secret-Token");

      if (secret !== env.TELEGRAM_WEBHOOK_SECRET) {
        return new Response("Unauthorized", { status: 401 });
      }

      let update: unknown;

      try {
        update = await request.json();
      } catch (error: unknown) {
        logWebhookProcessingError(error);
        return new Response(null, { status: 200 });
      }

      ctx.waitUntil(
        processTelegramUpdate(update, env).catch(logWebhookProcessingError)
      );

      return new Response(null, { status: 200 });
    }

    return new Response("Not found", { status: 404 });
  }
};

export default worker;

async function processTelegramUpdate(update: unknown, env: WorkerEnv): Promise<void> {
  const config = parseConfig(env);
  const dishes = new D1DishRepository(env.DB);
  const history = new D1HistoryRepository(env.DB);
  const states = new D1StateRepository(env.DB);
  const ai = new AIClient(config.ai);
  const bot = createBot(config, {
    dishes,
    history,
    states,
    ai,
    systemPrompt: recommendationSystemPrompt,
    similarSystemPrompt: similarRecommendationSystemPrompt,
    onAIFallback: logAIFallback
  });

  await handleWebhookUpdate(bot, update as Parameters<typeof handleWebhookUpdate>[1]);
}

function logWebhookProcessingError(error: unknown): void {
  console.error(
    JSON.stringify({
      event: "telegram_webhook_processing_failed",
      errorCode: getErrorCode(error),
      errorName: error instanceof Error ? error.name : "UnknownError"
    })
  );
}

function logAIFallback(error: unknown): void {
  console.error(
    JSON.stringify({
      event: "ai_recommendation_fallback",
      errorCode: getErrorCode(error),
      errorName: error instanceof Error ? error.name : "UnknownError",
      validationReason: getStringProperty(error, "validationReason"),
      causeName: error instanceof Error && error.cause instanceof Error ? error.cause.name : null,
      durationMs: getNumericProperty(error, "durationMs"),
      payloadBytes: getNumericProperty(error, "payloadBytes")
    })
  );
}

function getNumericProperty(value: unknown, key: string): number | null {
  if (typeof value !== "object" || value === null || !(key in value)) {
    return null;
  }

  const property = (value as Record<string, unknown>)[key];

  return typeof property === "number" ? property : null;
}

function getStringProperty(value: unknown, key: string): string | null {
  if (typeof value !== "object" || value === null || !(key in value)) {
    return null;
  }

  const property = (value as Record<string, unknown>)[key];

  return typeof property === "string" ? property : null;
}

function getErrorCode(error: unknown): string {
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof error.code === "string"
  ) {
    return error.code;
  }

  return "WEBHOOK_PROCESSING_FAILED";
}
