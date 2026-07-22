export const messages = {
  accessDenied: "У вас нет доступа к этому боту.",
  addDishExpired: "Время добавления истекло. Нажмите «➕ Добавить блюдо», чтобы начать заново.",
  addDishButton: "➕ Добавить блюдо",
  cancelled: "Текущий ввод отменён.",
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
  recommendDishButton: "🍽 Посоветовать блюдо",
  confirmCookButton: "✅ Приготовили основное",
  anotherRecommendationButton: "🔄 Другой совет",
  confirmNewIdeaCookButton: "✅ Приготовили новинку",
  saveNewIdeaButton: "💾 Сохранить новинку",
  anotherRecommendationReady: "Вот другой вариант.",
  callbackUnavailable: "Это действие пока недоступно.",
  cookAlreadyRecorded: "Приготовление уже отмечено.",
  cookRecorded: "Отметил приготовление.",
  newIdeaSaved: "Новинка добавлена в список.",
  newIdeaAlreadySaved: "Новинка уже есть в списке.",
  newIdeaSavedAndCooked: "Новинка добавлена и отмечена приготовленной.",
  newIdeaCooked: "Новинка отмечена приготовленной.",
  newIdeaUnavailable: "У этой рекомендации нет доступной новинки.",
  recommendationEmpty: "В списке пока нет блюд. Сначала добавьте несколько знакомых вариантов.",
  recommendationUnavailable: "Не удалось найти эту рекомендацию.",
  fallbackRecommendation: (name: string): string => `🍽 Сегодня: ${name}`,
  aiRecommendation: (name: string, selectionReason: string): string =>
    `🍽 Сегодня: ${name}\n\n${selectionReason}`,
  aiNewIdea: (name: string, whyItFits: string): string =>
    `✨ Похожая новинка: ${name}\n${whyItFits}`,
  userUnavailable: "Не удалось определить отправителя.",
  welcome: "Привет! Добавьте знакомое блюдо или попросите совет на сегодня.",
  yourTelegramId: (userId: string): string => `Ваш Telegram ID: ${userId}`
} as const;
