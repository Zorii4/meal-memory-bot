export const callbackActions = {
  confirmCook: "c",
  requestAnother: "a",
  confirmNewIdeaCook: "n",
  saveNewIdea: "s"
} as const;

export function createRecommendationCallbackData(
  action: (typeof callbackActions)[keyof typeof callbackActions],
  recommendationId: string
): string {
  return `${action}:${recommendationId}`;
}

export type RecommendationCallbackData = {
  action: (typeof callbackActions)[keyof typeof callbackActions];
  recommendationId: string;
};

export function parseRecommendationCallbackData(value: string | undefined): RecommendationCallbackData | null {
  if (value === undefined) {
    return null;
  }

  const [action, recommendationId, extra] = value.split(":");

  if (recommendationId === undefined || recommendationId.length === 0 || extra !== undefined) {
    return null;
  }

  if (
    action === callbackActions.confirmCook ||
    action === callbackActions.requestAnother ||
    action === callbackActions.confirmNewIdeaCook ||
    action === callbackActions.saveNewIdea
  ) {
    return { action, recommendationId };
  }

  return null;
}
