import { describe, expect, it } from "vitest";
import {
  createCatalogCookCallbackData,
  createCatalogPageCallbackData,
  parseCatalogCallbackData
} from "../src/bot/catalog-callback-data";

describe("catalog callback data", () => {
  it("round-trips a non-negative catalog page", () => {
    expect(parseCatalogCallbackData(createCatalogPageCallbackData(12))).toEqual({
      kind: "page",
      value: { page: 12 }
    });
  });

  it("round-trips a catalog dish identifier for manual cooking", () => {
    expect(parseCatalogCallbackData(createCatalogCookCallbackData("dish-1"))).toEqual({
      kind: "cook",
      value: { dishId: "dish-1" }
    });
  });

  it("parses the explicit deletion confirmation callback", () => {
    expect(parseCatalogCallbackData("x:dish-1")).toEqual({
      kind: "confirm-delete",
      value: { dishId: "dish-1" }
    });
  });

  it.each([undefined, "p:-1", "p:01", "p:1:extra", "q:1", "p:9007199254740992"])(
    "rejects an invalid callback value: %j",
    (value) => {
      expect(parseCatalogCallbackData(value)).toBeNull();
    }
  );
});
