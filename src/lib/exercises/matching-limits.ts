import { t } from "@/lib/i18n/t";

// Межі довжини тексту пари в Association (matching) — завдання "limit word
// and card length": на телефоні довге слово ("сентиментальний",
// "заслуговувати") вилазило за межі вузької картки, а власник вирішив НЕ
// чіпати розкладку для студента, лише обмежити, що вчителька може ввести в
// конструкторі. Одне місце для і конструктора (matching-fields.tsx), і
// будь-якого імпорту/генерації пар (buildConfigFromVocab, task-config-
// builder.ts) — ніхто інший не повинен тримати власну копію цих чисел.
export const MATCHING_MAX_WORD_LEN = 13;
export const MATCHING_MAX_ITEM_LEN = 30;

export type MatchingItemValidation = {
  ok: boolean;
  // Найдовше окреме слово (після розбиття на пробіл/дефіс), що перевищує
  // MATCHING_MAX_WORD_LEN — саме це слово, для повідомлення вчительці.
  tooLongWord?: string;
  // Увесь текст (разом із пробілами) перевищує MATCHING_MAX_ITEM_LEN.
  tooLong?: boolean;
  length: number;
};

// Чиста функція — без жодної залежності від React/DOM, щоб той самий код
// працював і в конструкторі (живий onChange), і в read-only аудиті вмісту
// (findMatchingLimitViolations нижче), і в майбутньому імпорті/AI-генерації.
export function validateMatchingItem(text: string): MatchingItemValidation {
  const value = text ?? "";
  const length = value.length;
  // Розбиття на пробіл/дефіс — teacher-facing елемент типово "слово" чи
  // "складне слово-через-дефіс" (напр. "по-французьки"): кожна ЧАСТИНА
  // такого слова не переноситься сама собою на вузькій картці, тож межа
  // застосовується до кожної частини окремо, а не лише до єдиного "слова
  // без пробілів" (що однаково трактувало б "merci beaucoup" як одне ціле).
  const words = value.split(/[\s-]+/).filter(Boolean);
  const tooLongWord = words.find((w) => w.length > MATCHING_MAX_WORD_LEN);
  const tooLong = length > MATCHING_MAX_ITEM_LEN;
  return {
    ok: !tooLongWord && !tooLong,
    tooLongWord: tooLongWord,
    tooLong: tooLong || undefined,
    length,
  };
}

export type MatchingLimitViolation = {
  pairIndex: number;
  side: "left" | "right";
  text: string;
  validation: MatchingItemValidation;
};

// Переобхід усіх пар — спільний для конструктора (яким саме полям
// підсвітити рамку) і для read-only аудиту вмісту (список порушень без
// жодного рендеру UI). pairs приймає як MatchingPair[], так і будь-який
// сирий {left?, right?}[] (напр. щойно розпарсений JSON із БД/FormData).
export function findMatchingLimitViolations(
  pairs: { left?: string | null; right?: string | null }[]
): MatchingLimitViolation[] {
  const violations: MatchingLimitViolation[] = [];
  pairs.forEach((p, pairIndex) => {
    (["left", "right"] as const).forEach((side) => {
      const text = p[side] ?? "";
      const validation = validateMatchingItem(text);
      if (!validation.ok) violations.push({ pairIndex, side, text, validation });
    });
  });
  return violations;
}

// Жорсткий блок збереження форми задачі (на відміну від м'якого
// confirmMessageForTaskConfig, task-validation.ts, що завжди дозволяє
// "Зберегти все одно?") — викликається з FormData конструктора завдання
// (SaveForm/TaskCreateForm) ПЕРЕД відправкою: null — нема за що блокувати
// (не matching або всі пари в межах лімітів), інакше — готовий текст
// повідомлення (window.alert). Адмінка завжди українська (без
// LangProvider, useT() сам падає на "uk") — lang фіксований тут, а не
// параметр, бо цей код виконується поза React-деревом компонента
// (onSubmit-обробник, не можна викликати хук).
export function matchingLimitsBlockMessage(formData: FormData): string | null {
  if (formData.get("type") !== "matching") return null;
  const raw = formData.get("matching_pairs");
  if (typeof raw !== "string") return null;
  let pairs: { left?: string; right?: string }[];
  try {
    pairs = JSON.parse(raw);
  } catch {
    return null;
  }
  if (findMatchingLimitViolations(pairs).length === 0) return null;
  return t("uk", "matching.limitsBlocked", { wordMax: MATCHING_MAX_WORD_LEN, itemMax: MATCHING_MAX_ITEM_LEN });
}
