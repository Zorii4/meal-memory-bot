import { describe, expect, it } from "vitest";
import {
  beginDishCreation
} from "../src/application/begin-dish-creation";
import type { ConversationStateRepository } from "../src/application/cancel-conversation";
import type { ConversationState } from "../src/domain/conversation-state";

describe("beginDishCreation", () => {
  it("saves an awaiting_dish state that expires after 15 minutes", async () => {
    const states = new StateRepositoryStub();

    const result = await beginDishCreation("123", {
      states,
      now: new Date("2026-07-21T12:00:00.000Z")
    });

    expect(result).toEqual({
      telegramUserId: "123",
      state: "awaiting_dish",
      expiresAt: "2026-07-21T12:15:00.000Z",
      updatedAt: "2026-07-21T12:00:00.000Z"
    });
    expect(states.savedStates).toEqual([result]);
  });
});

class StateRepositoryStub implements ConversationStateRepository {
  public readonly savedStates: ConversationState[] = [];

  public async save(state: ConversationState): Promise<ConversationState> {
    this.savedStates.push(state);
    return state;
  }

  public async findByUserId(): Promise<ConversationState | null> {
    return null;
  }

  public async clear(): Promise<boolean> {
    return false;
  }
}
