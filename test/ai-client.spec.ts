import { describe, expect, it } from "vitest";
import { AIClient, AIHttpError, AITimeoutError } from "../src/infrastructure/ai/ai-client";

const config = {
  baseUrl: "https://ai.example.test/v1",
  apiKey: "test-api-key",
  model: "test-model",
  timeoutMs: 20
};

describe("AIClient", () => {
  it("sends one OpenAI-compatible chat completion request", async () => {
    const requests: Request[] = [];
    const client = new AIClient(config, async (input, init) => {
      requests.push(new Request(input, init));
      return Response.json({ choices: [{ message: { content: "{\"selectedDishId\":\"dish-1\"}" } }] });
    });

    const result = await client.complete({
      systemPrompt: "system prompt",
      input: { candidates: [{ id: "dish-1" }] }
    });

    expect(result).toBe('{"selectedDishId":"dish-1"}');
    expect(requests).toHaveLength(1);
    expect(requests[0]?.url).toBe("https://ai.example.test/v1/chat/completions");
    expect(requests[0]?.headers.get("Authorization")).toBe("Bearer test-api-key");
    expect(await requests[0]?.json()).toEqual({
      model: "test-model",
      max_tokens: 800,
      messages: [
        { role: "system", content: "system prompt" },
        { role: "user", content: JSON.stringify({ candidates: [{ id: "dish-1" }] }) }
      ]
    });
  });

  it("does not bind an injected fetch function to the AI client", async () => {
    const fetchFn: typeof fetch = function (this: unknown): Promise<Response> {
      if (this !== undefined) {
        return Promise.reject(new TypeError("Illegal invocation"));
      }

      return Promise.resolve(
        Response.json({ choices: [{ message: { content: "OK" } }] })
      );
    };
    const client = new AIClient(config, fetchFn);

    await expect(client.complete({ systemPrompt: "system", input: { ping: true } })).resolves.toBe("OK");
  });

  it("uses a request-specific completion token limit", async () => {
    let requestBody: unknown;
    const client = new AIClient(config, async (_input, init) => {
      requestBody = JSON.parse(String(init?.body)) as unknown;
      return Response.json({ choices: [{ message: { content: "OK" } }] });
    });

    await client.complete({ systemPrompt: "system", input: {}, maxTokens: 2_000 });

    expect(requestBody).toMatchObject({ max_tokens: 2_000 });
  });

  it("returns a stable error for an HTTP failure", async () => {
    const client = new AIClient(config, async () => new Response("unavailable", { status: 500 }));

    await expect(client.complete({ systemPrompt: "system prompt", input: {} })).rejects.toMatchObject({
      code: "AI_HTTP_ERROR",
      status: 500
    } satisfies Partial<AIHttpError>);
  });

  it("aborts the request when the timeout expires", async () => {
    const client = new AIClient(
      { ...config, timeoutMs: 1 },
      async (_input, init) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
        })
    );

    await expect(client.complete({ systemPrompt: "system prompt", input: {} })).rejects.toMatchObject({
      code: "AI_TIMEOUT"
    } satisfies Partial<AITimeoutError>);
  });
});
