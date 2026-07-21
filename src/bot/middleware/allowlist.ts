import type { Context, Middleware } from "grammy";
import { messages } from "../messages";

export function createAllowlistMiddleware(allowedUserIds: ReadonlySet<string>): Middleware<Context> {
  return async (context, next): Promise<void> => {
    if (isAllowedUser(context.from?.id, allowedUserIds)) {
      await next();
      return;
    }

    if (context.callbackQuery !== undefined) {
      await context.answerCallbackQuery({ text: messages.accessDenied });
      return;
    }

    if (context.chat !== undefined) {
      await context.reply(messages.accessDenied);
    }
  };
}

export function isAllowedUser(userId: number | undefined, allowedUserIds: ReadonlySet<string>): boolean {
  return userId !== undefined && allowedUserIds.has(String(userId));
}
