import type { Context } from "grammy";
import { cancelConversation, type CancelConversationDependencies } from "../../application/cancel-conversation";
import { messages } from "../messages";

export async function handleCancelCommand(
  context: Pick<Context, "from" | "reply">,
  dependencies: CancelConversationDependencies
): Promise<void> {
  const userId = context.from?.id;

  if (userId === undefined) {
    await context.reply(messages.userUnavailable);
    return;
  }

  await cancelConversation(String(userId), dependencies);
  await context.reply(messages.cancelled);
}
