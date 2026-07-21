import type { Context } from "grammy";
import {
  beginDishCreation,
  type BeginDishCreationDependencies
} from "../../application/begin-dish-creation";
import { messages } from "../messages";

export async function handleBeginAddDish(
  context: Pick<Context, "from" | "reply">,
  dependencies: BeginDishCreationDependencies
): Promise<void> {
  const userId = context.from?.id;

  if (userId === undefined) {
    await context.reply(messages.userUnavailable);
    return;
  }

  await beginDishCreation(String(userId), dependencies);
  await context.reply(messages.enterDish);
}
