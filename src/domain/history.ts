export interface CookEvent {
  id: string;
  dishId: string;
  cookedByUserId: string;
  cookedAt: string;
  telegramCallbackQueryId: string | null;
}

export interface RecentCookedDish {
  name: string;
  cookedAt: string;
}

export interface RecommendationEvent {
  id: string;
  primaryDishId: string;
  newIdeaJson: string | null;
  requestedByUserId: string;
  createdAt: string;
}
