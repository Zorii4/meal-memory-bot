export type DishSource = "user" | "ai";

export interface Dish {
  id: string;
  name: string;
  normalizedName: string;
  details: string | null;
  source: DishSource;
  isActive: boolean;
  createdByUserId: string;
  createdAt: string;
  updatedAt: string;
}

export interface NewDish {
  id: string;
  name: string;
  normalizedName: string;
  details: string | null;
  source: DishSource;
  createdByUserId: string;
  createdAt: string;
  updatedAt: string;
}

export interface DishStatistics extends Dish {
  lastCookedAt: string | null;
  timesCooked: number;
  lastRecommendedAt: string | null;
}
