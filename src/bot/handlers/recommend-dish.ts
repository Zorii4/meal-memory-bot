import type { Context } from "grammy";
import {
  getFallbackRecommendationForUser,
  type GetFallbackRecommendationDependencies
} from "../../application/get-fallback-recommendation";
import { messages } from "../messages";
import { createRecommendationKeyboard } from "../recommendation-keyboard";

export async function handleRecommendDish(
  context: Pick<Context, "from" | "reply">,
  dependencies: GetFallbackRecommendationDependencies
): Promise<void> {
  const userId = context.from?.id;

  if (userId === undefined) {
    await context.reply(messages.userUnavailable);
    return;
  }

  const result = await getFallbackRecommendationForUser(String(userId), dependencies);

  if (result.kind === "empty") {
    await context.reply(messages.recommendationEmpty);
    return;
  }

  await context.reply(messages.fallbackRecommendation(result.dish.name), {
    reply_markup: createRecommendationKeyboard(result.recommendation.id)
  });
}
