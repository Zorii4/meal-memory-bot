# Meal Memory Bot

Личный Telegram-бот для сохранения знакомых блюд и рекомендаций.

## Локальная настройка

Скопируйте `.dev.vars.example` в `.dev.vars` и заполните значения. Не добавляйте `.dev.vars` в Git.

```powershell
Copy-Item .dev.vars.example .dev.vars
npm install
npm run dev
```

## Проверки

```powershell
npm run typecheck
npm run lint
npm test
```

## Production-деплой

Production secrets задаются только через Wrangler, а не через `.env` или `wrangler.jsonc`:

```powershell
npx wrangler secret put TELEGRAM_BOT_TOKEN
npx wrangler secret put TELEGRAM_WEBHOOK_SECRET
npx wrangler secret put TELEGRAM_ALLOWED_USER_IDS
npx wrangler secret put AI_API_KEY
```

После создания production D1 укажите её реальный `database_id` в `wrangler.jsonc`, примените миграции и разверните Worker:

```powershell
npx wrangler d1 migrations apply meal-memory --remote
npm run deploy
```
