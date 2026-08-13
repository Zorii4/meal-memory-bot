import { describe, expect, it } from "vitest";
import {
  AIResponseContractError,
  AIResponseJsonError,
  parseAIRecommendationResponse
} from "../src/infrastructure/ai/ai-contract";

const validResponse = JSON.stringify({
  selectedDishId: "dish-1",
  selectionReason: "Это блюдо давно не готовили.",
  newIdea: {
    name: "Суп с чечевицей",
    similarToDishIds: ["dish-1"],
    whyItFits: "Это простой похожий вариант из доступных продуктов.",
    ingredients: ["чечевица", "морковь", "лук"],
    prepMinutes: 35,
    nutritionFocus: ["protein", "fiber"]
  },
  warnings: []
});

describe("parseAIRecommendationResponse", () => {
  it("parses a response that matches the prompt contract", () => {
    expect(parseAIRecommendationResponse(validResponse)).toMatchObject({
      selectedDishId: "dish-1",
      newIdea: { name: "Суп с чечевицей", prepMinutes: 35 }
    });
  });

  it("accepts a valid JSON object wrapped in provider-added text", () => {
    expect(parseAIRecommendationResponse(`Вот JSON:\n\n\`\`\`json\n${validResponse}\n\`\`\``)).toMatchObject({
      selectedDishId: "dish-1",
      newIdea: { name: "Суп с чечевицей" }
    });
  });

  it("rejects malformed JSON", () => {
    expect(() => parseAIRecommendationResponse("{not-json")).toThrow(AIResponseJsonError);
  });

  it("rejects extra fields, invalid lengths, and duplicate IDs", () => {
    const invalidResponse = JSON.stringify({
      selectedDishId: "dish-1",
      selectionReason: "valid",
      newIdea: {
        name: "Суп",
        similarToDishIds: ["dish-1", "dish-1"],
        whyItFits: "valid",
        ingredients: [],
        prepMinutes: 20,
        nutritionFocus: []
      },
      warnings: [],
      unexpected: true
    });

    expect(() => parseAIRecommendationResponse(invalidResponse)).toThrow(AIResponseContractError);
  });
});
