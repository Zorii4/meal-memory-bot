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
      messages: [
        { role: "system", content: "system prompt" },
        { role: "user", content: JSON.stringify({ candidates: [{ id: "dish-1" }] }) }
      ]
    });
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
