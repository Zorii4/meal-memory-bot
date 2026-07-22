import type { AIRecommendationResponse } from "../infrastructure/ai/ai-contract";
import { messages } from "./messages";

export function formatRecommendationText(
  dishName: string,
  aiResponse: AIRecommendationResponse | null
): string {
  if (aiResponse === null) {
    return messages.fallbackRecommendation(dishName);
  }

  const recommendation = messages.aiRecommendation(dishName, aiResponse.selectionReason);
  const newIdea = aiResponse.newIdea;

  return newIdea === null
    ? recommendation
    : `${recommendation}\n\n${messages.aiNewIdea(newIdea.name, newIdea.whyItFits)}`;
}
