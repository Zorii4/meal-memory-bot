import type { Context } from "grammy";
import {
  getAIAssistedRecommendationForUser,
  type GetAIAssistedRecommendationDependencies
} from "../../application/get-ai-assisted-recommendation";
import { messages } from "../messages";
import { createRecommendationKeyboard } from "../recommendation-keyboard";
import { formatRecommendationText } from "../recommendation-text";
import { finishProgressMessage, sendProgressMessage } from "../progress-message";

export async function handleRecommendDish(
  context: Pick<Context, "api" | "from" | "reply">,
  dependencies: GetAIAssistedRecommendationDependencies
): Promise<void> {
  const userId = context.from?.id;

  if (userId === undefined) {
    await context.reply(messages.userUnavailable);
    return;
  }

  const progress = await sendProgressMessage(context, messages.recommendationLoading);
  const result = await getAIAssistedRecommendationForUser(String(userId), dependencies);

  if (result.kind === "empty") {
    await finishProgressMessage(context, progress, messages.recommendationEmpty);
    return;
  }

  await finishProgressMessage(
    context,
    progress,
    formatRecommendationText(result.dish.name, result.aiResponse),
    createRecommendationKeyboard(
      result.recommendation.id,
      result.aiResponse !== null && result.aiResponse.newIdea !== null
    )
  );
}
