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

Скопируйте `.dev.vars.example` в `.dev.vars` и замените все плейсхолдеры своими значениями. Не добавляйте `.dev.vars` в Git.

`AI_BASE_URL` и `AI_MODEL` намеренно отсутствуют в шаблоне. Выберите совместимые с OpenAI API endpoint и модель и добавьте их только в свой настоящий `.dev.vars`:

```dotenv
AI_BASE_URL=https://api.example.com/v1
AI_MODEL=provider/model-name
```

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
npx wrangler secret put AI_BASE_URL
npx wrangler secret put AI_MODEL
```

`AI_BASE_URL` и `AI_MODEL` хранятся как secrets намеренно: это скрывает выбранные endpoint и модель из публичного `wrangler.jsonc`. При смене AI-провайдера или модели повторите соответствующую команду `wrangler secret put`, затем разверните Worker. Значения в `vars` не шифруются, поэтому не помещайте туда API-ключи или приватную конфигурацию.

После создания production D1 укажите её реальный `database_id` в `wrangler.jsonc`, примените миграции и разверните Worker:

```powershell
npx wrangler d1 migrations apply meal-memory --remote
npm run deploy
```
