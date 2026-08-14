import { z } from "zod";

const nutritionFocusSchema = z.enum([
  "protein",
  "fiber",
  "vegetables",
  "complex_carbs",
  "legumes",
  "fish",
  "omega3",
  "iron",
  "calcium",
  "fermented",
  "lighter_meal"
]);

const nonEmptyStringSchema = z.string().trim().min(1);

export const aiNewIdeaSchema = z
  .object({
    name: z.string().trim().min(2).max(100),
    similarToDishIds: z.array(nonEmptyStringSchema).min(1).max(5).refine(hasOnlyUniqueValues),
    whyItFits: z.string().trim().min(1).max(280),
    ingredients: z.array(nonEmptyStringSchema).max(8),
    prepMinutes: z.number().int().min(5).max(180).nullable(),
    nutritionFocus: z.array(nutritionFocusSchema).refine(hasOnlyUniqueValues)
  })
  .strict();

export const aiRecommendationResponseSchema = z
  .object({
    selectedDishId: nonEmptyStringSchema,
    selectionReason: z.string().trim().min(1).max(280),
    newIdea: aiNewIdeaSchema.nullable(),
    warnings: z.array(nonEmptyStringSchema).max(3)
  })
  .strict();

export type AIRecommendationResponse = z.infer<typeof aiRecommendationResponseSchema>;
export type AINewIdea = z.infer<typeof aiNewIdeaSchema>;

export const aiRecommendationJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["selectedDishId", "selectionReason", "newIdea", "warnings"],
  properties: {
    selectedDishId: { type: "string", minLength: 1 },
    selectionReason: { type: "string", minLength: 1, maxLength: 280 },
    newIdea: {
      anyOf: [
        { type: "null" },
        {
          type: "object",
          additionalProperties: false,
          required: [
            "name",
            "similarToDishIds",
            "whyItFits",
            "ingredients",
            "prepMinutes",
            "nutritionFocus"
          ],
          properties: {
            name: { type: "string", minLength: 2, maxLength: 100 },
            similarToDishIds: {
              type: "array",
              minItems: 1,
              maxItems: 5,
              uniqueItems: true,
              items: { type: "string", minLength: 1 }
            },
            whyItFits: { type: "string", minLength: 1, maxLength: 280 },
            ingredients: {
              type: "array",
              maxItems: 8,
              items: { type: "string", minLength: 1 }
            },
            prepMinutes: {
              anyOf: [
                { type: "null" },
                { type: "integer", minimum: 5, maximum: 180 }
              ]
            },
            nutritionFocus: {
              type: "array",
              uniqueItems: true,
              items: {
                type: "string",
                enum: [
                  "protein",
                  "fiber",
                  "vegetables",
                  "complex_carbs",
                  "legumes",
                  "fish",
                  "omega3",
                  "iron",
                  "calcium",
                  "fermented",
                  "lighter_meal"
                ]
              }
            }
          }
        }
      ]
    },
    warnings: {
      type: "array",
      maxItems: 3,
      items: { type: "string", minLength: 1 }
    }
  }
} as const;

export function parseAIRecommendationResponse(value: string): AIRecommendationResponse {
  const parsed = parseJson(value);

  const result = aiRecommendationResponseSchema.safeParse(parsed);

  if (!result.success) {
    throw new AIResponseContractError(result.error);
  }

  return result.data;
}

export function parseAINewIdea(value: string): AINewIdea {
  const parsed = parseJson(value);
  const result = aiNewIdeaSchema.safeParse(parsed);

  if (!result.success) {
    throw new AIResponseContractError(result.error);
  }

  return result.data;
}

function parseJson(value: string): unknown {
  try {
    return JSON.parse(value) as unknown;
  } catch (cause: unknown) {
    const embeddedJson = extractEmbeddedJsonObject(value);

    if (embeddedJson === null) {
      throw new AIResponseJsonError(cause);
    }

    try {
      return JSON.parse(embeddedJson) as unknown;
    } catch {
      throw new AIResponseJsonError(cause);
    }
  }
}

function extractEmbeddedJsonObject(value: string): string | null {
  let depth = 0;
  let start = -1;
  let inString = false;
  let escaped = false;

  for (let index = 0; index < value.length; index += 1) {
    const character = value[index];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (character === "\\") {
        escaped = true;
      } else if (character === '"') {
        inString = false;
      }

      continue;
    }

    if (character === '"') {
      inString = true;
      continue;
    }

    if (character === "{") {
      if (depth === 0) {
        start = index;
      }

      depth += 1;
      continue;
    }

    if (character === "}" && depth > 0) {
      depth -= 1;

      if (depth === 0 && start !== -1) {
        return value.slice(start, index + 1);
      }
    }
  }

  return null;
}

function hasOnlyUniqueValues(values: readonly string[]): boolean {
  return new Set(values).size === values.length;
}

export class AIResponseJsonError extends Error {
  public readonly code = "AI_RESPONSE_INVALID_JSON";

  public constructor(cause: unknown) {
    super("AI provider returned malformed JSON", { cause });
    this.name = "AIResponseJsonError";
  }
}

export class AIResponseContractError extends Error {
  public readonly code = "AI_RESPONSE_CONTRACT_INVALID";

  public constructor(cause: unknown) {
    super("AI provider response does not match the recommendation contract", { cause });
    this.name = "AIResponseContractError";
  }
}
