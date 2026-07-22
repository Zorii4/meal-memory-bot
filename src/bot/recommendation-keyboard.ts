import { InlineKeyboard } from "grammy";
import { callbackActions, createRecommendationCallbackData } from "./callback-data";
import { messages } from "./messages";

export function createRecommendationKeyboard(
  recommendationId: string,
  hasNewIdea: boolean = false
): InlineKeyboard {
  const keyboard = new InlineKeyboard()
    .text(
      messages.confirmCookButton,
      createRecommendationCallbackData(callbackActions.confirmCook, recommendationId)
    )
    .row()
    .text(
      messages.anotherRecommendationButton,
      createRecommendationCallbackData(callbackActions.requestAnother, recommendationId)
    );

  if (hasNewIdea) {
    keyboard
      .row()
      .text(
        messages.confirmNewIdeaCookButton,
        createRecommendationCallbackData(callbackActions.confirmNewIdeaCook, recommendationId)
      )
      .text(
        messages.saveNewIdeaButton,
        createRecommendationCallbackData(callbackActions.saveNewIdea, recommendationId)
      );
  }

  return keyboard;
}
