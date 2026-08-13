import type { Context } from "grammy";
import {
  getDishCatalogPage,
  type GetDishCatalogPageDependencies
} from "../../application/get-dish-catalog-page";
import {
  recordCatalogDishCooked,
  type RecordCatalogDishCookedDependencies,
  type RecordCatalogDishCookedResult
} from "../../application/record-catalog-dish-cooked";
import {
  beginCatalogDishDeletion,
  confirmCatalogDishDeletion,
  type BeginCatalogDishDeletionDependencies,
  type ConfirmCatalogDishDeletionDependencies
} from "../../application/delete-catalog-dish";
import { createCatalogDeletionKeyboard, createCatalogKeyboard } from "../catalog-keyboard";
import { formatCatalogText } from "../catalog-text";
import { messages } from "../messages";
import {
  getAIAssistedRecommendationForDish,
  type GetAIAssistedRecommendationDependencies
} from "../../application/get-ai-assisted-recommendation";
import { createSimilarRecommendationKeyboard } from "../recommendation-keyboard";
import { formatSimilarRecommendationText } from "../recommendation-text";

export async function handleShowDishCatalog(
  context: Pick<Context, "reply">,
  dependencies: GetDishCatalogPageDependencies
): Promise<void> {
  await replyWithCatalogPage(context, 0, dependencies);
}

export async function handleCatalogPageCallback(
  context: Pick<Context, "answerCallbackQuery" | "reply">,
  page: number,
  dependencies: GetDishCatalogPageDependencies
): Promise<void> {
  await context.answerCallbackQuery();
  await replyWithCatalogPage(context, page, dependencies);
}

export async function handleCatalogCookCallback(
  context: Pick<Context, "callbackQuery" | "answerCallbackQuery">,
  dishId: string,
  dependencies: RecordCatalogDishCookedDependencies
): Promise<void> {
  const callbackQuery = context.callbackQuery;

  if (callbackQuery === undefined) {
    await context.answerCallbackQuery({ text: messages.catalogDishUnavailable });
    return;
  }

  const result = await recordCatalogDishCooked(
    dishId,
    String(callbackQuery.from.id),
    callbackQuery.id,
    dependencies
  );

  await context.answerCallbackQuery({ text: getCatalogCookReply(result) });
}

export async function handleCatalogDeleteRequestCallback(
  context: Pick<Context, "answerCallbackQuery" | "reply">,
  dishId: string,
  dependencies: BeginCatalogDishDeletionDependencies
): Promise<void> {
  const result = await beginCatalogDishDeletion(dishId, dependencies);

  if (result.kind === "dish-not-found") {
    await context.answerCallbackQuery({ text: messages.catalogDishUnavailable });
    return;
  }

  await context.answerCallbackQuery();
  await context.reply(messages.catalogDeletePrompt(result.dish.name), {
    reply_markup: createCatalogDeletionKeyboard(result.dish.id)
  });
}

export async function handleCatalogDeleteConfirmationCallback(
  context: Pick<Context, "answerCallbackQuery">,
  dishId: string,
  dependencies: ConfirmCatalogDishDeletionDependencies
): Promise<void> {
  const result = await confirmCatalogDishDeletion(dishId, dependencies);

  await context.answerCallbackQuery({
    text: result.kind === "deleted" ? messages.catalogDeleteConfirmed : messages.catalogDishUnavailable
  });
}

export async function handleCatalogDeleteCancelCallback(
  context: Pick<Context, "answerCallbackQuery">
): Promise<void> {
  await context.answerCallbackQuery({ text: messages.catalogDeleteCancelled });
}

export async function handleCatalogSimilarRecommendationCallback(
  context: Pick<Context, "callbackQuery" | "answerCallbackQuery" | "reply">,
  dishId: string,
  dependencies: GetAIAssistedRecommendationDependencies
): Promise<void> {
  const callbackQuery = context.callbackQuery;

  if (callbackQuery === undefined) {
    await context.answerCallbackQuery({ text: messages.catalogDishUnavailable });
    return;
  }

  const result = await getAIAssistedRecommendationForDish(
    dishId,
    String(callbackQuery.from.id),
    dependencies
  );

  if (result.kind === "dish-not-found") {
    await context.answerCallbackQuery({ text: messages.catalogDishUnavailable });
    return;
  }

  if (result.kind === "new-idea-unavailable") {
    await context.reply(messages.similarRecommendationUnavailable);
    await answerCallbackQuerySafely(context);
    return;
  }

  await context.reply(formatSimilarRecommendationText(result.newIdea), {
    reply_markup: createSimilarRecommendationKeyboard(result.recommendation.id)
  });
  await answerCallbackQuerySafely(context);
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

async function replyWithCatalogPage(
  context: Pick<Context, "reply">,
  page: number,
  dependencies: GetDishCatalogPageDependencies
): Promise<void> {
  const catalogPage = await getDishCatalogPage(page, dependencies);
  await context.reply(formatCatalogText(catalogPage), {
    reply_markup: createCatalogKeyboard(catalogPage)
  });
}

function getCatalogCookReply(result: RecordCatalogDishCookedResult): string {
  switch (result.kind) {
    case "created":
      return messages.cookRecorded;
    case "duplicate":
      return messages.cookAlreadyRecorded;
    case "dish-not-found":
      return messages.catalogDishUnavailable;
  }
}
