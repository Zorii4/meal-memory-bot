import { describe, expect, it } from "vitest";
import { parseDishMessage } from "../src/domain/parse-dish-message";

describe("parseDishMessage", () => {
  it("uses the first line as the dish name", () => {
    expect(parseDishMessage("Гречка с курицей")).toEqual({
      name: "Гречка с курицей",
      details: null
    });
  });

  it("joins remaining non-empty lines as details", () => {
    expect(parseDishMessage("Гречка с курицей\n\nгречка, куриное филе\n  \nлук")).toEqual({
      name: "Гречка с курицей",
      details: "гречка, куриное филе\nлук"
    });
  });
});
