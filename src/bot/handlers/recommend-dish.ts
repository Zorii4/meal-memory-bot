import type { Context } from "grammy";
import {
  getAIAssistedRecommendationForUser,
  type GetAIAssistedRecommendationDependencies
} from "../../application/get-ai-assisted-recommendation";
import { messages } from "../messages";
import { createRecommendationKeyboard } from "../recommendation-keyboard";
import { formatRecommendationText } from "../recommendation-text";

export async function handleRecommendDish(
  context: Pick<Context, "from" | "reply">,
  dependencies: GetAIAssistedRecommendationDependencies
): Promise<void> {
  const userId = context.from?.id;

  if (userId === undefined) {
    await context.reply(messages.userUnavailable);
    return;
  }

  const result = await getAIAssistedRecommendationForUser(String(userId), dependencies);

  if (result.kind === "empty") {
    await context.reply(messages.recommendationEmpty);
    return;
  }

  await context.reply(formatRecommendationText(result.dish.name, result.aiResponse), {
    reply_markup: createRecommendationKeyboard(
      result.recommendation.id,
      result.aiResponse !== null && result.aiResponse.newIdea !== null
    )
  });
}
