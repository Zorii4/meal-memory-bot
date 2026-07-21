import { Bot, type BotConfig, type Context } from "grammy";
import type { DishRepository } from "../application/add-dish";
import type { ConversationStateRepository } from "../application/conversation-state-repository";
import type { AppConfig } from "../config";
import { handleBeginAddDish } from "./handlers/begin-add-dish";
import { handleCancelCommand } from "./handlers/cancel";
import { handleIdCommand } from "./handlers/id";
import { handleStartCommand } from "./handlers/start";
import { handleAwaitingDishText } from "./handlers/save-awaiting-dish";
import { messages } from "./messages";
import { createAllowlistMiddleware } from "./middleware/allowlist";

export interface CreateBotDependencies {
  dishes: DishRepository;
  states: ConversationStateRepository;
  now?: () => Date;
  generateId?: () => string;
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
  bot.on("message:text", (context) =>
    handleAwaitingDishText(context, {
      dishes: dependencies.dishes,
      states: dependencies.states,
      now: (dependencies.now ?? (() => new Date()))(),
      generateId: dependencies.generateId ?? crypto.randomUUID
    })
  );

  return bot;
}
