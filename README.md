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

Параметры структурированного ответа уже заданы в шаблоне: `AI_TIMEOUT_MS=25000`,
`AI_RESPONSE_FORMAT=json_object` и `AI_TEMPERATURE=0.2`. Для production проверена
модель `gpt-4o-mini`: два полных обычных запроса и один похожий прошли контракт
за 3.7–4.9 секунды. Строгая JSON Schema на настроенном endpoint возвращает HTTP
400, поэтому используется JSON Mode с обязательной Zod- и прикладной валидацией.

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

Несекретные параметры генерации задаются в `wrangler.jsonc`: `AI_TIMEOUT_MS=25000`,
`AI_RESPONSE_FORMAT=json_object` и `AI_TEMPERATURE=0.2`. Zod и прикладная
валидация остаются обязательными. При смене модели снова проверьте полный
обычный и похожий сценарии с реальным размером payload.

После создания production D1 укажите её реальный `database_id` в `wrangler.jsonc`, примените миграции и разверните Worker:

```powershell
npx wrangler d1 migrations apply meal-memory --remote
npm run deploy
```
