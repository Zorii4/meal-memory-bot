import { describe, expect, it } from "vitest";
import type { DishStatistics } from "../src/domain/dish";
import { selectStaleCandidates } from "../src/domain/select-stale-candidates";

describe("selectStaleCandidates", () => {
  it("prioritizes never-cooked dishes, then the oldest cooked dishes", () => {
    const candidates = selectStaleCandidates(
      [
        dish("recent", "2026-07-20T12:00:00.000Z"),
        dish("old", "2026-06-01T12:00:00.000Z"),
        dish("never-1", null),
        dish("never-2", null),
        dish("middle", "2026-07-01T12:00:00.000Z")
      ],
      () => 0.999
    );

    expect(candidates.map(({ id }) => id)).toEqual([
      "never-1",
      "never-2",
      "old",
      "middle",
      "recent"
    ]);
  });

  it("excludes the two most recent recommendations when five alternatives remain", () => {
    const candidates = selectStaleCandidates(
      [
        dish("recent-recommendation-1", null, "2026-07-21T12:00:00.000Z"),
        dish("recent-recommendation-2", null, "2026-07-20T12:00:00.000Z"),
        dish("alternative-1", null),
        dish("alternative-2", null),
        dish("alternative-3", null),
        dish("alternative-4", null),
        dish("alternative-5", null)
      ],
      () => 0.999
    );

    expect(candidates.map(({ id }) => id)).toEqual([
      "alternative-1",
      "alternative-2",
      "alternative-3",
      "alternative-4",
      "alternative-5"
    ]);
  });

  it("keeps recent recommendations when the pool is too small", () => {
    const candidates = selectStaleCandidates(
      [
        dish("recent-recommendation-1", null, "2026-07-21T12:00:00.000Z"),
        dish("recent-recommendation-2", null, "2026-07-20T12:00:00.000Z"),
        dish("alternative", null)
      ],
      () => 0.999
    );

    expect(candidates.map(({ id }) => id)).toEqual([
      "recent-recommendation-1",
      "recent-recommendation-2",
      "alternative"
    ]);
  });

  it("randomizes dishes with equal staleness", () => {
    const candidates = selectStaleCandidates(
      [dish("first", "2026-07-01T12:00:00.000Z"), dish("second", "2026-07-01T12:00:00.000Z")],
      () => 0
    );

    expect(candidates.map(({ id }) => id)).toEqual(["second", "first"]);
  });

  it("does not select inactive dishes", () => {
    const inactiveDish = { ...dish("inactive", null), isActive: false };
    const candidates = selectStaleCandidates([inactiveDish, dish("active", null)], () => 0.999);

    expect(candidates.map(({ id }) => id)).toEqual(["active"]);
  });
});

function dish(
  id: string,
  lastCookedAt: string | null,
  lastRecommendedAt: string | null = null
): DishStatistics {
  return {
    id,
    name: id,
    normalizedName: id,
    details: null,
    source: "user",
    isActive: true,
    createdByUserId: "user-1",
    createdAt: "2026-07-21T12:00:00.000Z",
    updatedAt: "2026-07-21T12:00:00.000Z",
    lastCookedAt,
    timesCooked: lastCookedAt === null ? 0 : 1,
    lastRecommendedAt
  };
}
