import type { Context } from "grammy";
import {
  confirmRecommendationCooked,
  type ConfirmRecommendationCookedDependencies,
  type ConfirmRecommendationCookedResult
} from "../../application/confirm-recommendation-cooked";
import {
  getAIAssistedRecommendationForUser,
  type GetAIAssistedRecommendationDependencies
} from "../../application/get-ai-assisted-recommendation";
import {
  cookAIRecommendationIdea,
  saveAIRecommendationIdea,
  type CookAIRecommendationIdeaResult,
  type SaveAIRecommendationIdeaDependencies,
  type SaveAIRecommendationIdeaResult
} from "../../application/save-ai-recommendation-idea";
import { callbackActions, parseRecommendationCallbackData } from "../callback-data";
import { messages } from "../messages";
import { createRecommendationKeyboard } from "../recommendation-keyboard";
import { formatRecommendationText } from "../recommendation-text";
import { finishProgressMessage, sendProgressMessage } from "../progress-message";

type RecommendationCallbackDependencies = ConfirmRecommendationCookedDependencies &
  GetAIAssistedRecommendationDependencies &
  SaveAIRecommendationIdeaDependencies;

export async function handleRecommendationCallback(
  context: Pick<Context, "api" | "callbackQuery" | "answerCallbackQuery" | "reply">,
  dependencies: RecommendationCallbackDependencies
): Promise<void> {
  const callbackQuery = context.callbackQuery;
  const callbackData = parseRecommendationCallbackData(callbackQuery?.data);

  if (callbackQuery === undefined || callbackData === null) {
    await context.answerCallbackQuery({ text: messages.callbackUnavailable });
    return;
  }

  if (callbackData.action === callbackActions.requestAnother) {
    await answerCallbackQuerySafely(context);
    await handleAnotherRecommendation(context, callbackQuery.from.id, dependencies);
    return;
  }

  if (callbackData.action === callbackActions.saveNewIdea) {
    const result = await saveAIRecommendationIdea(
      callbackData.recommendationId,
      String(callbackQuery.from.id),
      dependencies
    );

    await context.answerCallbackQuery({ text: getSaveNewIdeaReply(result) });
    return;
  }

  if (callbackData.action === callbackActions.confirmNewIdeaCook) {
    const result = await cookAIRecommendationIdea(
      callbackData.recommendationId,
      String(callbackQuery.from.id),
      callbackQuery.id,
      dependencies
    );

    await context.answerCallbackQuery({ text: getCookNewIdeaReply(result) });
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
  context: Pick<Context, "api" | "reply">,
  userId: number,
  dependencies: GetAIAssistedRecommendationDependencies
): Promise<void> {
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

async function answerCallbackQuerySafely(
  context: Pick<Context, "answerCallbackQuery">
): Promise<void> {
  try {
    await context.answerCallbackQuery();
  } catch (error: unknown) {
    console.error(
      JSON.stringify({
        event: "telegram_callback_answer_failed",
        errorName: error instanceof Error ? error.name : "UnknownError"
      })
    );
  }
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

function getSaveNewIdeaReply(result: SaveAIRecommendationIdeaResult): string {
  switch (result.kind) {
    case "created":
      return messages.newIdeaSaved;
    case "existing":
      return messages.newIdeaAlreadySaved;
    case "recommendation-not-found":
      return messages.recommendationUnavailable;
    case "new-idea-unavailable":
      return messages.newIdeaUnavailable;
  }
}

function getCookNewIdeaReply(result: CookAIRecommendationIdeaResult): string {
  switch (result.kind) {
    case "created":
      return messages.newIdeaSavedAndCooked;
    case "existing":
      return messages.newIdeaCooked;
    case "cook-duplicate":
      return messages.cookAlreadyRecorded;
    case "recommendation-not-found":
      return messages.recommendationUnavailable;
    case "new-idea-unavailable":
      return messages.newIdeaUnavailable;
  }
}
