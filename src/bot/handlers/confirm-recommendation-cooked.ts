import type { Context } from "grammy";
import {
  confirmRecommendationCooked,
  type ConfirmRecommendationCookedDependencies,
  type ConfirmRecommendationCookedResult
} from "../../application/confirm-recommendation-cooked";
import {
  getFallbackRecommendationForUser,
  type GetFallbackRecommendationDependencies
} from "../../application/get-fallback-recommendation";
import { callbackActions, parseRecommendationCallbackData } from "../callback-data";
import { messages } from "../messages";
import { createRecommendationKeyboard } from "../recommendation-keyboard";

type RecommendationCallbackDependencies = ConfirmRecommendationCookedDependencies &
  GetFallbackRecommendationDependencies;

export async function handleRecommendationCallback(
  context: Pick<Context, "callbackQuery" | "answerCallbackQuery" | "reply">,
  dependencies: RecommendationCallbackDependencies
): Promise<void> {
  const callbackQuery = context.callbackQuery;
  const callbackData = parseRecommendationCallbackData(callbackQuery?.data);

  if (callbackQuery === undefined || callbackData === null) {
    await context.answerCallbackQuery({ text: messages.callbackUnavailable });
    return;
  }

  if (callbackData.action === callbackActions.requestAnother) {
    await handleAnotherRecommendation(context, callbackQuery.from.id, dependencies);
    return;
  }

  const result = await confirmRecommendationCooked(
    callbackData.recommendationId,
    String(callbackQuery.from.id),
    callbackQuery.id,
    dependencies
  );

  await context.answerCallbackQuery({ text: getCallbackReply(result) });
}

async function handleAnotherRecommendation(
  context: Pick<Context, "answerCallbackQuery" | "reply">,
  userId: number,
  dependencies: GetFallbackRecommendationDependencies
): Promise<void> {
  const result = await getFallbackRecommendationForUser(String(userId), dependencies);

  await context.answerCallbackQuery({ text: messages.anotherRecommendationReady });

  if (result.kind === "empty") {
    await context.reply(messages.recommendationEmpty);
    return;
  }

  await context.reply(messages.fallbackRecommendation(result.dish.name), {
    reply_markup: createRecommendationKeyboard(result.recommendation.id)
  });
}

function getCallbackReply(result: ConfirmRecommendationCookedResult): string {
  switch (result.kind) {
    case "created":
      return messages.cookRecorded;
    case "duplicate":
      return messages.cookAlreadyRecorded;
    case "recommendation-not-found":
      return messages.recommendationUnavailable;
  }
}
