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

const MAX_COMPLETION_TOKENS = 800;

export interface AIClientConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
  timeoutMs: number;
}

export interface AICompletionRequest {
  systemPrompt: string;
  input: unknown;
  maxTokens?: number;
}

export class AIClient {
  private readonly fetchFn: typeof fetch;

  public constructor(
    private readonly config: AIClientConfig,
    fetchFn?: typeof fetch
  ) {
    // Calling a runtime-provided fetch through `this.fetchFn(...)` changes its
    // receiver to the AIClient instance. Cloudflare Workers rejects that with
    // `TypeError: Illegal invocation`, so wrap the global function instead.
    this.fetchFn = fetchFn ?? ((input, init) => fetch(input, init));
  }

  public async complete(request: AICompletionRequest): Promise<string> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeoutMs);
    const startedAt = Date.now();
    const body = JSON.stringify({
      model: this.config.model,
      max_tokens: request.maxTokens ?? MAX_COMPLETION_TOKENS,
      messages: [
        { role: "system", content: request.systemPrompt },
        { role: "user", content: JSON.stringify(request.input) }
      ]
    });

    try {
      const fetchFn = this.fetchFn;
      const response = await fetchFn(getChatCompletionsUrl(this.config.baseUrl), {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.config.apiKey}`,
          "Content-Type": "application/json"
        },
        body,
        signal: controller.signal
      });

      if (!response.ok) {
        throw new AIHttpError(response.status);
      }

      const parsed: unknown = await response.json();
      const result = chatCompletionResponseSchema.safeParse(parsed);

      if (!result.success) {
        throw new AIInvalidResponseError(classifyInvalidChatCompletion(parsed));
      }

      return result.data.choices[0].message.content;
    } catch (error: unknown) {
      if (controller.signal.aborted) {
        throw new AITimeoutError(this.config.timeoutMs, error, body.length);
      }

      if (error instanceof AIHttpError || error instanceof AIInvalidResponseError) {
        throw error;
      }

      throw new AINetworkError(error, Date.now() - startedAt, body.length);
    } finally {
      clearTimeout(timeoutId);
    }
  }
}

function getChatCompletionsUrl(baseUrl: string): string {
  return new URL("chat/completions", `${baseUrl}/`).toString();
}

function classifyInvalidChatCompletion(value: unknown): string {
  if (typeof value !== "object" || value === null) {
    return "BODY_NOT_OBJECT";
  }

  const body = value as Record<string, unknown>;

  if ("error" in body) {
    return "PROVIDER_ERROR_BODY";
  }

  if (!Array.isArray(body.choices)) {
    return "CHOICES_NOT_ARRAY";
  }

  if (body.choices.length === 0) {
    return "CHOICES_EMPTY";
  }

  const firstChoice = body.choices[0];

  if (typeof firstChoice !== "object" || firstChoice === null) {
    return "CHOICE_NOT_OBJECT";
  }

  const message = (firstChoice as Record<string, unknown>).message;

  if (typeof message !== "object" || message === null) {
    return "MESSAGE_NOT_OBJECT";
  }

  const content = (message as Record<string, unknown>).content;

  if (content === null) {
    return "CONTENT_NULL";
  }

  return `CONTENT_${typeof content}`.toUpperCase();
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

  public constructor(public readonly validationReason: string) {
    super("AI provider returned an invalid chat completion response");
    this.name = "AIInvalidResponseError";
  }
}

export class AITimeoutError extends Error {
  public readonly code = "AI_TIMEOUT";

  public constructor(timeoutMs: number, cause: unknown, public readonly payloadBytes = 0) {
    super(`AI request timed out after ${timeoutMs}ms`, { cause });
    this.name = "AITimeoutError";
  }
}

export class AINetworkError extends Error {
  public readonly code = "AI_NETWORK_ERROR";

  public constructor(
    cause: unknown,
    public readonly durationMs = 0,
    public readonly payloadBytes = 0
  ) {
    super("AI request failed", { cause });
    this.name = "AINetworkError";
  }
}
