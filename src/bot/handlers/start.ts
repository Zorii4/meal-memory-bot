import type { Context } from "grammy";
import { mainKeyboard } from "../keyboards";
import { messages } from "../messages";

export async function handleStartCommand(context: Pick<Context, "reply">): Promise<void> {
  await context.reply(messages.welcome, { reply_markup: mainKeyboard });
}
