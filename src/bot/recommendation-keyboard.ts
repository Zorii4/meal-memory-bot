import { InlineKeyboard } from "grammy";
import { callbackActions, createRecommendationCallbackData } from "./callback-data";
import { messages } from "./messages";

export function createRecommendationKeyboard(recommendationId: string): InlineKeyboard {
  return new InlineKeyboard()
    .text(
      messages.confirmCookButton,
      createRecommendationCallbackData(callbackActions.confirmCook, recommendationId)
    )
    .row()
    .text(
      messages.anotherRecommendationButton,
      createRecommendationCallbackData(callbackActions.requestAnother, recommendationId)
    );
}
