import type { Bot } from "grammy";
import type { Update } from "grammy/types";

export async function handleWebhookUpdate(
  bot: Pick<Bot, "init" | "handleUpdate">,
  update: Update
): Promise<void> {
  await bot.init();
  await bot.handleUpdate(update);
}
