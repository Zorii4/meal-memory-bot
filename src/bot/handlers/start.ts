import type { Context } from "grammy";
import type { ConversationStateRepository } from "../../application/conversation-state-repository";
import type { UserGuideRepository } from "../../application/user-guide-repository";
import { mainKeyboard } from "../keyboards";
import { messages } from "../messages";

export async function handleStartCommand(
  context: Pick<Context, "api" | "from" | "reply">,
  dependencies: { states: ConversationStateRepository; userGuides: UserGuideRepository }
): Promise<void> {
  const userId = context.from === undefined ? null : String(context.from.id);

  if (userId !== null) {
    await dependencies.states.clear(userId);
    const previous = await dependencies.userGuides.findByUserId(userId);

    if (previous !== null) {
      try {
        await context.api.pinChatMessage(previous.chatId, previous.messageId, {
          disable_notification: true
        });
        return;
      } catch (error: unknown) {
        logGuideUpdateFailure(error);
      }
    }
  }

  const instruction = await context.reply(messages.userGuide, { reply_markup: mainKeyboard });

  if (userId !== null) {
    await dependencies.userGuides.save({
      telegramUserId: userId,
      chatId: String(instruction.chat.id),
      messageId: instruction.message_id
    });
  }

  await pinGuideMessage(context, instruction.chat.id, instruction.message_id);
}

async function pinGuideMessage(
  context: Pick<Context, "api">,
  chatId: string | number,
  messageId: number
): Promise<void> {
  try {
    await context.api.pinChatMessage(chatId, messageId, { disable_notification: true });
  } catch (error: unknown) {
    console.error(JSON.stringify({ event: "telegram_user_guide_pin_failed", errorName: error instanceof Error ? error.name : "UnknownError" }));
  }
}

function logGuideUpdateFailure(error: unknown): void {
  console.error(JSON.stringify({ event: "telegram_user_guide_update_failed", errorName: error instanceof Error ? error.name : "UnknownError" }));
}
