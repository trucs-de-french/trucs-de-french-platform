// Зовнішня обгортка блоку ЗАВДАННЯ/ВПРАВИ на студентській сторінці
// (сцена/матеріал/тест) — той самий "піднятий" вигляд, що вже узгоджено
// використовується в картках блоків платформи в адмінці (rounded-lg,
// border-gray-100, shadow-sm). Фон — bg-neutral-50 (не bg-white): картки-
// відповіді (ANSWER_CARD_BASE) і клітинки/плитки (letter_gaps/
// letter_rearrangement) усередині лишаються bg-white, тож мають виразно
// виділятись на дещо темнішому тлі самого блока, а не зливатись із ним.
export const EXERCISE_BLOCK_CLASS =
  "rounded-lg border border-gray-100 bg-neutral-50 shadow-sm dark:border-neutral-700 dark:bg-neutral-800";

// Картка-посилання на сцену на дошці курсу (courses/[productId]/page.tsx) —
// НЕ блок завдання (нема карток-відповідей усередині, які потребують
// контрастного тла), тож лишається на bg-white, як і решта карток блоків
// платформи в адмінці, а не на EXERCISE_BLOCK_CLASS вище.
export const SCENE_CARD_CLASS =
  "rounded-lg border border-gray-100 bg-white shadow-sm dark:border-neutral-700 dark:bg-neutral-800";
