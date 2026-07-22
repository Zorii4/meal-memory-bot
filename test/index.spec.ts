import { createExecutionContext, env, SELF, waitOnExecutionContext } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import worker from "../src/index";

const IncomingRequest = Request<unknown, IncomingRequestCfProperties>;
const webhookEnvironment = {
	DB: env.DB,
	TELEGRAM_BOT_TOKEN: "telegram-token",
	TELEGRAM_WEBHOOK_SECRET: "webhook-secret",
	TELEGRAM_ALLOWED_USER_IDS: "123",
	AI_API_KEY: "ai-key",
	AI_BASE_URL: "https://provider.example/v1",
	AI_MODEL: "deepseek-model"
};

describe("worker", () => {
	it("returns the health status", async () => {
		const request = new IncomingRequest("http://example.com/health");
		const ctx = createExecutionContext();
		const response = await worker.fetch!(request, webhookEnvironment, ctx);

		await waitOnExecutionContext(ctx);

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({ status: "ok" });
	});

	it("returns 404 for unknown routes", async () => {
		const response = await SELF.fetch("https://example.com/unknown");

		expect(response.status).toBe(404);
	});

	it("rejects a webhook request with an invalid secret", async () => {
		const request = new IncomingRequest("https://example.com/telegram/webhook", {
			method: "POST",
			headers: { "X-Telegram-Bot-Api-Secret-Token": "invalid-secret" }
		});
		const ctx = createExecutionContext();

		const response = await worker.fetch!(request, webhookEnvironment, ctx);

		await waitOnExecutionContext(ctx);

		expect(response.status).toBe(401);
	});

	it("returns 200 for an unknown update with the valid secret", async () => {
		const request = new IncomingRequest("https://example.com/telegram/webhook", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				"X-Telegram-Bot-Api-Secret-Token": "webhook-secret"
			},
			body: JSON.stringify({ update_id: 1 })
		});
		const ctx = createExecutionContext();

		const response = await worker.fetch!(request, webhookEnvironment, ctx);

		await waitOnExecutionContext(ctx);

		expect(response.status).toBe(200);
	});

	it("contains a malformed update error in background processing", async () => {
		const request = new IncomingRequest("https://example.com/telegram/webhook", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				"X-Telegram-Bot-Api-Secret-Token": "webhook-secret"
			},
			body: "not json"
		});
		const ctx = createExecutionContext();

		const response = await worker.fetch!(request, webhookEnvironment, ctx);

		expect(response.status).toBe(200);
		await expect(waitOnExecutionContext(ctx)).resolves.toBeUndefined();
	});
});
