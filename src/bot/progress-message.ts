import type { Context } from "grammy";
import type { InlineKeyboardMarkup } from "grammy/types";

export interface ProgressMessage {
  chatId: number;
  messageId: number;
}

export async function sendProgressMessage(
  context: Pick<Context, "reply">,
  text: string
): Promise<ProgressMessage> {
  const message = await context.reply(text);
  return { chatId: message.chat.id, messageId: message.message_id };
}

export async function finishProgressMessage(
  context: Pick<Context, "api" | "reply">,
  progress: ProgressMessage,
  text: string,
  replyMarkup?: InlineKeyboardMarkup
): Promise<void> {
  try {
    if (replyMarkup === undefined) {
      await context.api.editMessageText(progress.chatId, progress.messageId, text);
    } else {
      await context.api.editMessageText(progress.chatId, progress.messageId, text, {
        reply_markup: replyMarkup
      });
    }
  } catch (error: unknown) {
    console.error(
      JSON.stringify({
        event: "telegram_progress_message_edit_failed",
        errorName: error instanceof Error ? error.name : "UnknownError"
      })
    );
    await context.reply(
      text,
      replyMarkup === undefined ? undefined : { reply_markup: replyMarkup }
    );
  }
}
