// Зовнішня обгортка блоку ЗАВДАННЯ/ВПРАВИ на студентській сторінці
// (сцена/матеріал/тест) — той самий "піднятий" вигляд, що вже узгоджено
// використовується в картках блоків платформи в адмінці (rounded-lg,
// border-gray-100, shadow-sm). Фон — bg-neutral-50 (не bg-white): картки-
// відповіді (ANSWER_CARD_BASE) і клітинки/плитки (letter_gaps/
// letter_rearrangement) усередині лишаються bg-white, тож мають виразно
// виділятись на дещо темнішому тлі самого блока, а не зливатись із ним.
// dark:bg-neutral-900 (НЕ neutral-800) — усі картки/тогли/плитки всередині
// (ANSWER_CARD_DEFAULT, STUDENT_TOGGLE_HEADER_BUTTON, tile-styles.ts,
// letter-gaps.tsx/swappable-tile-row.tsx) уже стоять на dark:bg-neutral-800;
// якби контейнер лишався на тому самому відтінку, картки зливались би з
// тлом у темній темі так само, як white-on-white до недавнього фіксу
// letter_gaps у світлій.
// p-4 md:p-6 — внутрішній padding за узгодженою системою відступів
// (src/lib/spacing.ts): 16px на мобільних, 24px на десктопі. Раніше кожен
// з 5 місць виклику додавав власний "p-3" поруч із цією константою —
// тепер padding частина самої константи, єдине джерело правди.
export const EXERCISE_BLOCK_CLASS =
  "rounded-lg border border-gray-100 bg-neutral-50 shadow-sm p-4 md:p-6 dark:border-neutral-700 dark:bg-neutral-900";

// Картка-посилання на сцену на дошці курсу (courses/[productId]/page.tsx) —
// НЕ блок завдання (нема карток-відповідей усередині, які потребують
// контрастного тла), тож лишається на bg-white, як і решта карток блоків
// платформи в адмінці, а не на EXERCISE_BLOCK_CLASS вище.
export const SCENE_CARD_CLASS =
  "rounded-lg border border-gray-100 bg-white shadow-sm dark:border-neutral-700 dark:bg-neutral-800";
