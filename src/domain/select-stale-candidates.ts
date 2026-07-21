import type { DishStatistics } from "./dish";

const MAX_CANDIDATES = 5;
const RECENT_RECOMMENDATIONS_TO_EXCLUDE = 2;

export function selectStaleCandidates(
  dishes: readonly DishStatistics[],
  random: () => number
): DishStatistics[] {
  const activeDishes = dishes.filter((dish) => dish.isActive);
  const recentRecommendationIds = getRecentRecommendationIds(activeDishes);
  const withoutRecentRecommendations = activeDishes.filter(
    (dish) => !recentRecommendationIds.has(dish.id)
  );
  const eligibleDishes =
    withoutRecentRecommendations.length >= MAX_CANDIDATES
      ? withoutRecentRecommendations
      : activeDishes;

  return orderByStaleness(eligibleDishes, random).slice(0, MAX_CANDIDATES);
}

function getRecentRecommendationIds(dishes: readonly DishStatistics[]): Set<string> {
  return new Set(
    dishes
      .filter((dish) => dish.lastRecommendedAt !== null)
      .sort((left, right) => {
        const dateComparison = right.lastRecommendedAt!.localeCompare(left.lastRecommendedAt!);

        return dateComparison !== 0 ? dateComparison : left.id.localeCompare(right.id);
      })
      .slice(0, RECENT_RECOMMENDATIONS_TO_EXCLUDE)
      .map((dish) => dish.id)
  );
}

function orderByStaleness(
  dishes: readonly DishStatistics[],
  random: () => number
): DishStatistics[] {
  const neverCooked = dishes.filter((dish) => dish.lastCookedAt === null);
  const cooked = dishes.filter((dish) => dish.lastCookedAt !== null);

  return [
    ...shuffle(neverCooked, random),
    ...orderCookedDishes(cooked, random)
  ];
}

function orderCookedDishes(
  dishes: readonly DishStatistics[],
  random: () => number
): DishStatistics[] {
  const groupsByLastCookedAt = new Map<string, DishStatistics[]>();

  for (const dish of dishes) {
    const lastCookedAt = dish.lastCookedAt;

    if (lastCookedAt === null) {
      continue;
    }

    const group = groupsByLastCookedAt.get(lastCookedAt) ?? [];
    group.push(dish);
    groupsByLastCookedAt.set(lastCookedAt, group);
  }

  return [...groupsByLastCookedAt.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .flatMap(([, group]) => shuffle(group, random));
}

function shuffle<T>(items: readonly T[], random: () => number): T[] {
  const shuffled = [...items];

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    const current = shuffled[index];
    shuffled[index] = shuffled[swapIndex]!;
    shuffled[swapIndex] = current!;
  }

  return shuffled;
}
