// Зовнішня обгортка блоку ЗАВДАННЯ/ВПРАВИ на студентській сторінці
// (сцена/матеріал/тест) — той самий "піднятий" вигляд, що вже узгоджено
// використовується в картках блоків платформи в адмінці (rounded-lg,
// border-gray-100, shadow-sm). Фон — bg-neutral-50 (не bg-white): картки-
// відповіді (ANSWER_CARD_BASE) і клітинки/плитки (letter_gaps/
// letter_rearrangement) усередині лишаються bg-white, тож мають виразно
// виділятись на дещо темнішому тлі самого блока, а не зливатись із ним.
// dark:bg-neutral-900 (НЕ neutral-800) — усі картки/тогли/плитки всередині
// (ANSWER_CARD_DEFAULT, STUDENT_TOGGLE_HEADER_BUTTON, tile-styles.ts,
// letter-gaps.tsx/sortable-tile-row.tsx) уже стоять на dark:bg-neutral-800;
// якби контейнер лишався на тому самому відтінку, картки зливались би з
// тлом у темній темі так само, як white-on-white до недавнього фіксу
// letter_gaps у світлій.
// p-4 md:p-6 — внутрішній padding за узгодженою системою відступів
// (src/lib/spacing.ts): 16px на мобільних, 24px на десктопі. Раніше кожен
// з 5 місць виклику додавав власний "p-3" поруч із цією константою —
// тепер padding частина самої константи, єдине джерело правди.
export const EXERCISE_BLOCK_CLASS =
  "rounded-lg border border-gray-100 bg-neutral-50 shadow-sm p-4 md:p-6 dark:border-neutral-700 dark:bg-neutral-900";

// Той самий фон/падинг, що EXERCISE_BLOCK_CLASS, БЕЗ rounded-lg/border/
// shadow-sm — для тіла секції, яке вже сидить усередині JOINED-картки
// скляного бару (scene-header-bar.tsx, SCENE_CARD_CLASS): власне
// округлення/рамка/тінь тіла здвоювались би з тими, що вже на обгортці
// картки.
export const EXERCISE_BLOCK_SURFACE_CLASS = "bg-neutral-50 p-4 md:p-6 dark:bg-neutral-900";

// Картка-посилання на сцену на дошці курсу (courses/[productId]/page.tsx) —
// НЕ блок завдання (нема карток-відповідей усередині, які потребують
// контрастного тла), тож лишається на bg-white, як і решта карток блоків
// платформи в адмінці, а не на EXERCISE_BLOCK_CLASS вище.
export const SCENE_CARD_CLASS =
  "rounded-lg border border-gray-100 bg-white shadow-sm dark:border-neutral-700 dark:bg-neutral-800";

// "Підкладка" спільного контенту (текст/читацький уривок) усередині блоку
// задач (task_group) — відділяє текст, спільний для кількох вправ, від
// самих вправ нижче ФОНОМ+смугою зліва, не лінією-розділювачем. Клас
// .glass-reading-passage (globals.css) — токени --glass-item-*/
// --glass-accent-bar/--glass-text ЯВНО на собі (не успадкований від
// панелі): фон цієї картки відрізняється від фону панелі навколо неї,
// тож колір тексту для НЕЇ підбирається в тій самій парі "фон+текст", а
// не братиметься з іншого контексту. Використовується і в TaskGroupBlock
// (власний спільний контент групи), і на сторінці сцени — коли до
// content-блоку прикріплено групу, контент блоку й контент групи лежать
// РАЗОМ в ОДНІЙ такій підкладці, не в двох окремих.
export const SHARED_CONTENT_PANEL = "glass-reading-passage";
