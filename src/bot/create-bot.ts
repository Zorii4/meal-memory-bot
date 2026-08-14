import { Bot, type BotConfig, type Context } from "grammy";
import type { DishRepository } from "../application/add-dish";
import type { ConversationStateRepository } from "../application/conversation-state-repository";
import type { UserGuideRepository } from "../application/user-guide-repository";
import type { CatalogDishRepository } from "../application/get-dish-catalog-page";
import type { CatalogCookDishRepository } from "../application/record-catalog-dish-cooked";
import type { CatalogDeleteDishRepository } from "../application/delete-catalog-dish";
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
import {
  handleCatalogPageCallback,
  handleCatalogCookCallback,
  handleCatalogDeleteCancelCallback,
  handleCatalogDeleteConfirmationCallback,
  handleCatalogDeleteRequestCallback,
  handleCatalogSimilarRecommendationCallback,
  handleShowDishCatalog
} from "./handlers/show-dish-catalog";
import { parseCatalogCallbackData } from "./catalog-callback-data";
import { messages } from "./messages";
import { createAllowlistMiddleware } from "./middleware/allowlist";

export interface CreateBotDependencies {
  dishes: DishRepository &
    RecommendationDishRepository &
    AIAssistedRecommendationDishRepository &
    CatalogDishRepository &
    CatalogCookDishRepository &
    CatalogDeleteDishRepository;
  history: RecommendationHistoryRepository &
    ConfirmationHistoryRepository &
    AIAssistedRecommendationHistoryRepository &
    NewIdeaHistoryRepository;
  ai: AIRecommendationClient;
  systemPrompt: string;
  similarSystemPrompt: string;
  states: ConversationStateRepository;
  userGuides?: UserGuideRepository;
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
  bot.command("start", (context) => handleStartCommand(context, {
    states: dependencies.states,
    userGuides: dependencies.userGuides ?? noUserGuideRepository
  }));
  bot.command("cancel", (context) => handleCancelCommand(context, { states: dependencies.states }));
  bot.hears(messages.addDishButton, (context) =>
    handleBeginAddDish(context, {
      states: dependencies.states,
      now: (dependencies.now ?? (() => new Date()))()
    })
  );
  bot.hears(messages.recommendDishButton, async (context) => {
    if (context.from !== undefined) {
      await dependencies.states.clear(String(context.from.id));
    }

    await handleRecommendDish(context, {
      dishes: dependencies.dishes,
      history: dependencies.history,
      ai: dependencies.ai,
      systemPrompt: dependencies.systemPrompt,
      similarSystemPrompt: dependencies.similarSystemPrompt,
      now: (dependencies.now ?? (() => new Date()))(),
      generateId: dependencies.generateId ?? (() => crypto.randomUUID()),
      random: dependencies.random ?? Math.random,
      onAIFallback: dependencies.onAIFallback
    });
  });
  bot.hears(messages.catalogButton, async (context) => {
    if (context.from !== undefined) {
      await dependencies.states.clear(String(context.from.id));
    }

    await handleShowDishCatalog(context, { dishes: dependencies.dishes });
  });
  bot.on("callback_query", async (context) => {
    const catalogCallback = parseCatalogCallbackData(context.callbackQuery.data);

    if (catalogCallback !== null) {
      if (catalogCallback.kind === "page") {
        await handleCatalogPageCallback(context, catalogCallback.value.page, { dishes: dependencies.dishes });
        return;
      }

      if (catalogCallback.kind === "cook") {
        await handleCatalogCookCallback(context, catalogCallback.value.dishId, catalogCallback.value.page, {
          dishes: dependencies.dishes,
          history: dependencies.history,
          now: (dependencies.now ?? (() => new Date()))(),
          generateId: dependencies.generateId ?? (() => crypto.randomUUID())
        });
        return;
      }

      if (catalogCallback.kind === "request-delete") {
        await handleCatalogDeleteRequestCallback(context, catalogCallback.value.dishId, catalogCallback.value.page, {
          dishes: dependencies.dishes
        });
        return;
      }

      if (catalogCallback.kind === "confirm-delete") {
        await handleCatalogDeleteConfirmationCallback(context, catalogCallback.value.dishId, catalogCallback.value.page, {
          dishes: dependencies.dishes
        });
        return;
      }

      if (catalogCallback.kind === "similar-recommendation") {
        await handleCatalogSimilarRecommendationCallback(context, catalogCallback.value.dishId, {
          dishes: dependencies.dishes,
          history: dependencies.history,
          ai: dependencies.ai,
          systemPrompt: dependencies.systemPrompt,
          similarSystemPrompt: dependencies.similarSystemPrompt,
          now: (dependencies.now ?? (() => new Date()))(),
          generateId: dependencies.generateId ?? (() => crypto.randomUUID()),
          random: dependencies.random ?? Math.random,
          onAIFallback: dependencies.onAIFallback
        });
        return;
      }

      await handleCatalogDeleteCancelCallback(context, catalogCallback.value.page, {
        dishes: dependencies.dishes
      });
      return;
    }

    await handleRecommendationCallback(context, {
      dishes: dependencies.dishes,
      history: dependencies.history,
      ai: dependencies.ai,
      systemPrompt: dependencies.systemPrompt,
      similarSystemPrompt: dependencies.similarSystemPrompt,
      now: (dependencies.now ?? (() => new Date()))(),
      generateId: dependencies.generateId ?? (() => crypto.randomUUID()),
      random: dependencies.random ?? Math.random,
      onAIFallback: dependencies.onAIFallback
    });
  });
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

const noUserGuideRepository: UserGuideRepository = {
  async findByUserId(): Promise<null> {
    return null;
  },
  async save(): Promise<void> {}
};
