import { describe, expect, it } from "vitest";
import { normalizeDishName } from "../src/domain/normalize-dish-name";

describe("normalizeDishName", () => {
  it("normalizes case, yo, and surrounding whitespace", () => {
    expect(normalizeDishName("  Ёжики С Курицей  ")).toBe("ежики с курицей");
  });

  it("collapses consecutive whitespace", () => {
    expect(normalizeDishName("Гречка\t\n  с   овощами")).toBe("гречка с овощами");
  });
});
