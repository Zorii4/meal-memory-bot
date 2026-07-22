import type { Update } from "grammy/types";
import { describe, expect, it } from "vitest";
import { handleWebhookUpdate } from "../../src/bot/handle-webhook-update";

describe("handleWebhookUpdate", () => {
  it("initializes the bot before handling the update", async () => {
    const calls: string[] = [];
    const update = { update_id: 1 } as Update;

    await handleWebhookUpdate(
      {
        init: async () => {
          calls.push("init");
        },
        handleUpdate: async (receivedUpdate) => {
          calls.push("handleUpdate");
          expect(receivedUpdate).toBe(update);
        }
      },
      update
    );

    expect(calls).toEqual(["init", "handleUpdate"]);
  });
});
