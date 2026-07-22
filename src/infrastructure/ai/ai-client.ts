import { z } from "zod";

const chatCompletionResponseSchema = z.object({
  choices: z
    .array(
      z.object({
        message: z.object({
          content: z.string()
        })
      })
    )
    .min(1)
});

export interface AIClientConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
  timeoutMs: number;
}

export interface AICompletionRequest {
  systemPrompt: string;
  input: unknown;
}

export class AIClient {
  public constructor(
    private readonly config: AIClientConfig,
    private readonly fetchFn: typeof fetch = fetch
  ) {}

  public async complete(request: AICompletionRequest): Promise<string> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeoutMs);

    try {
      const response = await this.fetchFn(getChatCompletionsUrl(this.config.baseUrl), {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.config.apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: this.config.model,
          messages: [
            { role: "system", content: request.systemPrompt },
            { role: "user", content: JSON.stringify(request.input) }
          ]
        }),
        signal: controller.signal
      });

      if (!response.ok) {
        throw new AIHttpError(response.status);
      }

      const parsed: unknown = await response.json();
      const result = chatCompletionResponseSchema.safeParse(parsed);

      if (!result.success) {
        throw new AIInvalidResponseError();
      }

      return result.data.choices[0].message.content;
    } catch (error: unknown) {
      if (controller.signal.aborted) {
        throw new AITimeoutError(this.config.timeoutMs, error);
      }

      if (error instanceof AIHttpError || error instanceof AIInvalidResponseError) {
        throw error;
      }

      throw new AINetworkError(error);
    } finally {
      clearTimeout(timeoutId);
    }
  }
}

function getChatCompletionsUrl(baseUrl: string): string {
  return new URL("chat/completions", `${baseUrl}/`).toString();
}

export class AIHttpError extends Error {
  public readonly code = "AI_HTTP_ERROR";

  public constructor(public readonly status: number) {
    super(`AI provider returned HTTP ${status}`);
    this.name = "AIHttpError";
  }
}

export class AIInvalidResponseError extends Error {
  public readonly code = "AI_INVALID_RESPONSE";

  public constructor() {
    super("AI provider returned an invalid chat completion response");
    this.name = "AIInvalidResponseError";
  }
}

export class AITimeoutError extends Error {
  public readonly code = "AI_TIMEOUT";

  public constructor(timeoutMs: number, cause: unknown) {
    super(`AI request timed out after ${timeoutMs}ms`, { cause });
    this.name = "AITimeoutError";
  }
}

export class AINetworkError extends Error {
  public readonly code = "AI_NETWORK_ERROR";

  public constructor(cause: unknown) {
    super("AI request failed", { cause });
    this.name = "AINetworkError";
  }
}
