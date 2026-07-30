# Meal Memory Bot

Личный Telegram-бот, который хранит знакомые блюда, помнит историю
приготовления и помогает выбрать, что приготовить, когда все привычные
варианты не удаётся вспомнить.

Проект разработан с использованием coding agents в рамках
specification-driven workflow. Требования, архитектурные ограничения и
критерии готовности задавались до реализации; изменения выполнялись
вертикальными срезами и проверялись автоматическими тестами.

Документы проекта:

- [SPEC.md](SPEC.md) — продуктовые и технические требования;
- [AGENTS.md](AGENTS.md) — правила работы coding agents;
- [ROADMAP.md](ROADMAP.md) — публичный план и текущее состояние реализации.

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
