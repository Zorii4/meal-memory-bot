import type { Context } from "grammy";
import type { InlineKeyboardMarkup } from "grammy/types";
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
import { finishProgressMessage, sendProgressMessage } from "../progress-message";

export async function handleShowDishCatalog(
  context: Pick<Context, "reply">,
  dependencies: GetDishCatalogPageDependencies
): Promise<void> {
  await replyWithCatalogPage(context, 0, dependencies);
}

export async function handleCatalogPageCallback(
  context: Pick<Context, "answerCallbackQuery" | "editMessageText" | "reply">,
  page: number,
  dependencies: GetDishCatalogPageDependencies
): Promise<void> {
  await context.answerCallbackQuery({ text: messages.catalogUpdating });
  await editCatalogPage(context, page, dependencies);
}

export async function handleCatalogCookCallback(
  context: Pick<Context, "callbackQuery" | "answerCallbackQuery" | "editMessageText" | "reply">,
  dishId: string,
  page: number,
  dependencies: RecordCatalogDishCookedDependencies & GetDishCatalogPageDependencies
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
  if (callbackQuery.message !== undefined) {
    await editCatalogPage(context, page, dependencies);
  }
}

export async function handleCatalogDeleteRequestCallback(
  context: Pick<Context, "answerCallbackQuery" | "editMessageText" | "reply">,
  dishId: string,
  page: number,
  dependencies: BeginCatalogDishDeletionDependencies
): Promise<void> {
  const result = await beginCatalogDishDeletion(dishId, dependencies);

  if (result.kind === "dish-not-found") {
    await context.answerCallbackQuery({ text: messages.catalogDishUnavailable });
    return;
  }

  await context.answerCallbackQuery({ text: messages.deletionPreparing });
  await editMessageWithFallback(
    context,
    messages.catalogDeletePrompt(result.dish.name),
    createCatalogDeletionKeyboard(result.dish.id, page)
  );
}

export async function handleCatalogDeleteConfirmationCallback(
  context: Pick<Context, "callbackQuery" | "answerCallbackQuery" | "editMessageText" | "reply">,
  dishId: string,
  page: number,
  dependencies: ConfirmCatalogDishDeletionDependencies & GetDishCatalogPageDependencies
): Promise<void> {
  const result = await confirmCatalogDishDeletion(dishId, dependencies);

  await context.answerCallbackQuery({
    text: result.kind === "deleted" ? messages.catalogDeleteConfirmed : messages.catalogDishUnavailable
  });
  if (context.callbackQuery?.message !== undefined) {
    await editCatalogPage(context, page, dependencies);
  }
}

export async function handleCatalogDeleteCancelCallback(
  context: Pick<Context, "callbackQuery" | "answerCallbackQuery" | "editMessageText" | "reply">,
  page: number,
  dependencies: GetDishCatalogPageDependencies
): Promise<void> {
  await context.answerCallbackQuery({ text: messages.catalogDeleteCancelled });

  if (context.callbackQuery?.message !== undefined) {
    await editCatalogPage(context, page, dependencies);
  }
}

export async function handleCatalogSimilarRecommendationCallback(
  context: Pick<Context, "api" | "callbackQuery" | "answerCallbackQuery" | "reply">,
  dishId: string,
  dependencies: GetAIAssistedRecommendationDependencies
): Promise<void> {
  const callbackQuery = context.callbackQuery;

  if (callbackQuery === undefined) {
    await context.answerCallbackQuery({ text: messages.catalogDishUnavailable });
    return;
  }

  await answerCallbackQuerySafely(context);
  const progress = await sendProgressMessage(context, messages.similarRecommendationLoading);
  const result = await getAIAssistedRecommendationForDish(
    dishId,
    String(callbackQuery.from.id),
    dependencies
  );

  if (result.kind === "dish-not-found") {
    await finishProgressMessage(context, progress, messages.catalogDishUnavailable);
    return;
  }

  if (result.kind === "new-idea-unavailable") {
    await finishProgressMessage(context, progress, messages.similarRecommendationUnavailable);
    return;
  }

  await finishProgressMessage(
    context,
    progress,
    formatSimilarRecommendationText(result.newIdea),
    createSimilarRecommendationKeyboard(result.recommendation.id)
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

async function replyWithCatalogPage(
  context: Pick<Context, "reply">,
  page: number,
  dependencies: GetDishCatalogPageDependencies
): Promise<void> {
  const catalogPage = await loadCatalogPage(page, dependencies);
  await context.reply(formatCatalogText(catalogPage), {
    reply_markup: getCatalogKeyboard(catalogPage)
  });
}

async function editCatalogPage(
  context: Pick<Context, "editMessageText" | "reply">,
  page: number,
  dependencies: GetDishCatalogPageDependencies
): Promise<void> {
  const catalogPage = await loadCatalogPage(page, dependencies);

  await editMessageWithFallback(
    context,
    formatCatalogText(catalogPage),
    getCatalogKeyboard(catalogPage)
  );
}

async function editMessageWithFallback(
  context: Pick<Context, "editMessageText" | "reply">,
  text: string,
  replyMarkup: InlineKeyboardMarkup
): Promise<void> {
  try {
    await context.editMessageText(text, { reply_markup: replyMarkup });
  } catch (error: unknown) {
    console.error(
      JSON.stringify({
        event: "telegram_catalog_edit_failed",
        errorName: error instanceof Error ? error.name : "UnknownError"
      })
    );
    await context.reply(text, { reply_markup: replyMarkup });
  }
}

function getCatalogKeyboard(catalogPage: Awaited<ReturnType<typeof getDishCatalogPage>>): InlineKeyboardMarkup {
  return catalogPage.dishes.length === 0
    ? { inline_keyboard: [] }
    : createCatalogKeyboard(catalogPage);
}

async function loadCatalogPage(
  page: number,
  dependencies: GetDishCatalogPageDependencies
) {
  const catalogPage = await getDishCatalogPage(page, dependencies);

  return catalogPage.dishes.length === 0 && catalogPage.page > 0
    ? getDishCatalogPage(catalogPage.page - 1, dependencies)
    : catalogPage;
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
