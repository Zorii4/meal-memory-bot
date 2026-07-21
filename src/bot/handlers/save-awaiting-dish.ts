import type { Context } from "grammy";
import {
  addDishFromConversation,
  type AddDishFromConversationDependencies,
  type AddDishFromConversationResult
} from "../../application/add-dish-from-conversation";
import { messages } from "../messages";

export async function handleAwaitingDishText(
  context: Pick<Context, "from" | "message" | "reply">,
  dependencies: AddDishFromConversationDependencies
): Promise<void> {
  const userId = context.from?.id;
  const text = context.message?.text;

  if (userId === undefined || text === undefined) {
    return;
  }

  const result = await addDishFromConversation(String(userId), text, dependencies);
  const reply = getAddDishReply(result);

  if (reply !== null) {
    await context.reply(reply);
  }
}

function getAddDishReply(result: AddDishFromConversationResult): string | null {
  switch (result.kind) {
    case "created":
      return messages.dishCreated(result.dish.name);
    case "duplicate":
      return messages.dishDuplicate;
    case "expired":
      return messages.addDishExpired;
    case "invalid":
      return messages.invalidDish[result.code];
    case "not-awaiting-dish":
      return null;
  }
}
