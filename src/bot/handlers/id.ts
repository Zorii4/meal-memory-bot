import type { Context } from "grammy";
import { messages } from "../messages";

export async function handleIdCommand(context: Pick<Context, "from" | "reply">): Promise<void> {
  const userId = context.from?.id;

  if (userId === undefined) {
    await context.reply(messages.idUnavailable);
    return;
  }

  await context.reply(messages.yourTelegramId(String(userId)));
}
