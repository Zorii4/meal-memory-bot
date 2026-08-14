CREATE TABLE user_guide_messages (
  telegram_user_id TEXT PRIMARY KEY,
  chat_id TEXT NOT NULL,
  message_id INTEGER NOT NULL
);
