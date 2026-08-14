import type { Context } from "grammy";
import { mainKeyboard } from "../keyboards";
import { messages } from "../messages";

export async function handleStartCommand(context: Pick<Context, "api" | "reply">): Promise<void> {
  const instruction = await context.reply(messages.userGuide, { reply_markup: mainKeyboard });

  try {
    await context.api.pinChatMessage(instruction.chat.id, instruction.message_id, {
      disable_notification: true
    });
  } catch (error: unknown) {
    console.error(
      JSON.stringify({
        event: "telegram_user_guide_pin_failed",
        errorName: error instanceof Error ? error.name : "UnknownError"
      })
    );
  }
}
