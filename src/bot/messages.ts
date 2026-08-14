import { userGuideMessage } from "./user-guide";

export const messages = {
  accessDenied: "У вас нет доступа к этому боту.",
  addDishExpired: "Время добавления истекло. Нажмите «➕ Добавить блюдо в базу», чтобы начать заново.",
  addDishButton: "➕ Добавить блюдо в базу",
  cancelled: "Текущий ввод отменён.",
  catalogButton: "📚 Посмотреть все мои блюда",
  catalogEmpty: "В списке пока нет блюд.",
  catalogPage: (page: number, dishNames: readonly string[]): string =>
    `📚 Мои блюда — страница ${page}\n\n${dishNames
      .map((name, index) => `${index + 1}. ${name}`)
      .join("\n")}`,
  dishCreated: (name: string): string => `Блюдо «${name}» добавлено.`,
  dishDuplicate: "Такое блюдо уже есть в списке. Пришлите другое название или используйте /cancel.",
  enterDish:
    "Пришлите блюдо одним сообщением: первая строка — название, остальные — ингредиенты или комментарий (необязательно). Для отмены используйте /cancel.",
  idUnavailable: "Не удалось определить ваш Telegram ID.",
  invalidDish: {
    EMPTY_MESSAGE: "Пришлите название блюда или используйте /cancel.",
    MESSAGE_TOO_LONG: "Сообщение слишком длинное: максимум 1500 символов.",
    NAME_TOO_SHORT: "Название блюда должно содержать минимум 2 символа.",
    NAME_TOO_LONG: "Название блюда должно содержать максимум 100 символов."
  },
  recommendDishButton: "🍽 Посоветовать что приготовить",
  confirmCookButton: "✅ Приготовили основное",
  anotherRecommendationButton: "🔄 Хочу другой совет",
  confirmNewIdeaCookButton: "✅ Приготовили новинку",
  saveNewIdeaButton: "💾 Сохранить новинку",
  anotherRecommendationReady: "Вот другой вариант.",
  recommendationLoading: "⏳ Подбираю вариант…",
  similarRecommendationLoading: "⏳ Ищу похожее блюдо…",
  catalogUpdating: "Обновляю каталог…",
  deletionPreparing: "Открываю подтверждение…",
  callbackUnavailable: "Это действие пока недоступно.",
  cookAlreadyRecorded: "Приготовление уже отмечено.",
  cookRecorded: "Отметил приготовление.",
  catalogDishUnavailable: "Это блюдо больше не доступно в каталоге.",
  catalogDeleteCancelled: "Удаление отменено.",
  catalogDeleteConfirmed: "Блюдо и связанные с ним записи истории удалены.",
  catalogDeletePrompt: (name: string): string =>
    `Удалить блюдо «${name}» навсегда? Вместе с ним будут удалены связанные отметки приготовления и рекомендации.`,
  confirmCatalogDeleteButton: "🗑 Удалить навсегда",
  cancelCatalogDeleteButton: "Отмена",
  newIdeaSaved: "Новинка добавлена в список.",
  newIdeaAlreadySaved: "Новинка уже есть в списке.",
  newIdeaSavedAndCooked: "Новинка добавлена и отмечена приготовленной.",
  newIdeaCooked: "Новинка отмечена приготовленной.",
  newIdeaUnavailable: "У этого блюда нет доступного нового варианта.",
  recommendationEmpty: "В списке пока нет блюд. Сначала добавьте несколько знакомых вариантов.",
  recommendationUnavailable: "Не удалось найти эту рекомендацию.",
  fallbackRecommendation: (name: string): string => `🍽 Сегодня предлагаю приготовить: ${name}`,
  aiRecommendation: (name: string, selectionReason: string): string =>
    `🍽 Сегодня предлагаю приготовить: ${name}\n\n${selectionReason}`,
  aiNewIdea: (name: string, whyItFits: string): string =>
    `✨ Похожее от ИИ: ${name}\n${whyItFits}`,
  similarRecommendation: (name: string, whyItFits: string): string =>
    `✨ Похожее блюдо: ${name}\n\n${whyItFits}`,
  similarRecommendationUnavailable: "Не удалось подобрать похожее блюдо. Попробуйте ещё раз позже.",
  userUnavailable: "Не удалось определить отправителя.",
  userGuide: userGuideMessage,
  yourTelegramId: (userId: string): string => `Ваш Telegram ID: ${userId}`
} as const;
