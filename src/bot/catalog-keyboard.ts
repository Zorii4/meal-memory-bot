import { InlineKeyboard } from "grammy";
import type { DishCatalogPage } from "../application/get-dish-catalog-page";
import {
  createCatalogCancelDeleteCallbackData,
  createCatalogConfirmDeleteCallbackData,
  createCatalogCookCallbackData,
  createCatalogDeleteCallbackData,
  createCatalogPageCallbackData
} from "./catalog-callback-data";
import { messages } from "./messages";

export function createCatalogKeyboard(page: DishCatalogPage): InlineKeyboard {
  const keyboard = new InlineKeyboard();

  for (const [index, dish] of page.dishes.entries()) {
    keyboard
      .text(`✅ Приготовили №${index + 1}`, createCatalogCookCallbackData(dish.id))
      .text(`🗑 Удалить №${index + 1}`, createCatalogDeleteCallbackData(dish.id))
      .row();
  }

  if (page.hasPreviousPage) {
    keyboard.text("◀️", createCatalogPageCallbackData(page.page - 1));
  }

  if (page.hasNextPage) {
    keyboard.text("▶️", createCatalogPageCallbackData(page.page + 1));
  }

  return keyboard;
}

export function createCatalogDeletionKeyboard(dishId: string): InlineKeyboard {
  return new InlineKeyboard()
    .text(messages.confirmCatalogDeleteButton, createCatalogConfirmDeleteCallbackData(dishId))
    .text(messages.cancelCatalogDeleteButton, createCatalogCancelDeleteCallbackData(dishId));
}
