import { InlineKeyboard } from "grammy";
import type { DishCatalogPage } from "../application/get-dish-catalog-page";
import {
  createCatalogCancelDeleteCallbackData,
  createCatalogConfirmDeleteCallbackData,
  createCatalogCookCallbackData,
  createCatalogDeleteCallbackData,
  createCatalogPageCallbackData,
  createCatalogSimilarRecommendationCallbackData
} from "./catalog-callback-data";
import { messages } from "./messages";

export function createCatalogKeyboard(page: DishCatalogPage): InlineKeyboard {
  const keyboard = new InlineKeyboard();

  for (const [index, dish] of page.dishes.entries()) {
    keyboard
      .text(`✅ Приготовили №${index + 1}`, createCatalogCookCallbackData(dish.id, page.page))
      .text(`🗑 Удалить №${index + 1}`, createCatalogDeleteCallbackData(dish.id, page.page))
      .row();
    keyboard.text(`✨ Похожее на №${index + 1} от ИИ`, createCatalogSimilarRecommendationCallbackData(dish.id)).row();
  }

  if (page.hasPreviousPage) {
    keyboard.text("◀️", createCatalogPageCallbackData(page.page - 1));
  }

  if (page.hasNextPage) {
    keyboard.text("▶️", createCatalogPageCallbackData(page.page + 1));
  }

  return keyboard;
}

export function createCatalogDeletionKeyboard(dishId: string, page: number): InlineKeyboard {
  return new InlineKeyboard()
    .text(messages.confirmCatalogDeleteButton, createCatalogConfirmDeleteCallbackData(dishId, page))
    .text(messages.cancelCatalogDeleteButton, createCatalogCancelDeleteCallbackData(dishId, page));
}
