// Спільний контракт для форм полів завдання, які підтримують імпорт
// лексики зі скрипту сцени (ImportVocabPanel викликає importWords через
// ref, а не через пропси — кожна форма сама вирішує, куди саме в своєму
// масиві додати нові слова).
export type ImportableFieldsHandle = {
  importWords: (words: { word: string; translation: string; image_url?: string }[]) => void;
};
