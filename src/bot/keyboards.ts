import { Keyboard } from "grammy";
import { messages } from "./messages";

export const mainKeyboard = new Keyboard()
  .text(messages.addDishButton)
  .row()
  .text(messages.recommendDishButton)
  .row()
  .text(messages.catalogButton)
  .resized()
  .persistent();
