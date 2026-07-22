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
    throw new AIResponseJsonError(cause);
  }
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
