import { Bot, type BotConfig, type Context } from "grammy";
import type { DishRepository } from "../application/add-dish";
import type { ConversationStateRepository } from "../application/conversation-state-repository";
import type { ConfirmationHistoryRepository } from "../application/confirm-recommendation-cooked";
import type { NewIdeaHistoryRepository } from "../application/save-ai-recommendation-idea";
import type {
  AIAssistedRecommendationDishRepository,
  AIAssistedRecommendationHistoryRepository,
  AIRecommendationClient
} from "../application/get-ai-assisted-recommendation";
import type {
  RecommendationDishRepository,
  RecommendationHistoryRepository
} from "../application/get-fallback-recommendation";
import type { AppConfig } from "../config";
import { handleBeginAddDish } from "./handlers/begin-add-dish";
import { handleCancelCommand } from "./handlers/cancel";
import { handleRecommendationCallback } from "./handlers/confirm-recommendation-cooked";
import { handleIdCommand } from "./handlers/id";
import { handleRecommendDish } from "./handlers/recommend-dish";
import { handleStartCommand } from "./handlers/start";
import { handleAwaitingDishText } from "./handlers/save-awaiting-dish";
import { messages } from "./messages";
import { createAllowlistMiddleware } from "./middleware/allowlist";

export interface CreateBotDependencies {
  dishes: DishRepository & RecommendationDishRepository & AIAssistedRecommendationDishRepository;
  history: RecommendationHistoryRepository &
    ConfirmationHistoryRepository &
    AIAssistedRecommendationHistoryRepository &
    NewIdeaHistoryRepository;
  ai: AIRecommendationClient;
  systemPrompt: string;
  states: ConversationStateRepository;
  now?: () => Date;
  generateId?: () => string;
  random?: () => number;
  onAIFallback?: (error: unknown) => void;
  client?: BotConfig<Context>["client"];
  botInfo?: BotConfig<Context>["botInfo"];
}

export function createBot(
  config: Pick<AppConfig, "telegram">,
  dependencies: CreateBotDependencies
): Bot {
  const bot = new Bot(config.telegram.botToken, {
    client: dependencies.client,
    botInfo: dependencies.botInfo
  });

  bot.command("id", handleIdCommand);
  bot.use(createAllowlistMiddleware(config.telegram.allowedUserIds));
  bot.command("start", handleStartCommand);
  bot.command("cancel", (context) => handleCancelCommand(context, { states: dependencies.states }));
  bot.hears(messages.addDishButton, (context) =>
    handleBeginAddDish(context, {
      states: dependencies.states,
      now: (dependencies.now ?? (() => new Date()))()
    })
  );
  bot.hears(messages.recommendDishButton, (context) =>
    handleRecommendDish(context, {
      dishes: dependencies.dishes,
      history: dependencies.history,
      ai: dependencies.ai,
      systemPrompt: dependencies.systemPrompt,
      now: (dependencies.now ?? (() => new Date()))(),
      generateId: dependencies.generateId ?? (() => crypto.randomUUID()),
      random: dependencies.random ?? Math.random,
      onAIFallback: dependencies.onAIFallback
    })
  );
  bot.on("callback_query", (context) =>
    handleRecommendationCallback(context, {
      dishes: dependencies.dishes,
      history: dependencies.history,
      ai: dependencies.ai,
      systemPrompt: dependencies.systemPrompt,
      now: (dependencies.now ?? (() => new Date()))(),
      generateId: dependencies.generateId ?? (() => crypto.randomUUID()),
      random: dependencies.random ?? Math.random,
      onAIFallback: dependencies.onAIFallback
    })
  );
  bot.on("message:text", (context) =>
    handleAwaitingDishText(context, {
      dishes: dependencies.dishes,
      states: dependencies.states,
      now: (dependencies.now ?? (() => new Date()))(),
      generateId: dependencies.generateId ?? (() => crypto.randomUUID())
    })
  );

  return bot;
}
