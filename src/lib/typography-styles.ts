// Централізовані типографічні ролі — той самий принцип, що button-styles.ts
// і input-styles.ts: рядок класів, не компонент, підставляється напряму в
// className= будь-де. Мета та сама — наступна правка розміру/кольору ролі
// це правка в ОДНОМУ файлі, а не в десятках.

// Заголовок сторінки адмінки (h1: "Новий курс", "Редагування сцени" тощо)
// — той самий розмір/вага, що STUDENT_PAGE_TITLE (рівень 0 нижче), той
// самий шрифт (font-heading, Nunito) — навмисно БЕЗ uppercase/tracking-wide
// STUDENT_SECTION_HEADING: адмінка лишається у звичайному регістрі, це
// робочий інтерфейс, не студентська сторінка з "кричущими" заголовками
// секцій. Свідоме рішення користувачки — порівнювали варіант з uppercase.
export const ADMIN_PAGE_TITLE = "font-heading text-2xl font-bold md:text-3xl";

// Заголовок секції сторінки (напр. "Сцени", "Тести", "Матеріали") —
// розмір/вага вирівняні з рівнем 1 студентської ієрархії
// (STUDENT_SECTION_HEADING: text-xl font-bold, було text-lg font-semibold)
// — той самий крок, БЕЗ uppercase/tracking-wide (те саме рішення, що вище,
// для ADMIN_PAGE_TITLE). Колір (text-gray-800) лишився свій, адмінський —
// про це не просили.
export const H2_TEXT = "font-heading text-xl font-bold text-gray-800 dark:text-neutral-200";

// ============================================================================
// Типографічна ієрархія студентських сторінок (рівні 0-4) — п'ять ролей,
// кожна на свій рівень вкладеності. Нижчі рівні (2-4) стосуються ВСЕРЕДИНИ
// однієї вправи, вищі (0-1) — структури сторінки.
//
//   Рівень | Роль                    | Приклад
//   -------|-------------------------|---------------------------------
//   0      | STUDENT_PAGE_TITLE      | h1: назва сцени/тесту/матеріалу/курсу
//   1      | STUDENT_SECTION_HEADING | h2/тогл-заголовок: "Скрипт", "Завдання"
//   2      | EXERCISE_INSTRUCTION    | основна інструкція вправи
//   3      | EXERCISE_SUBINSTRUCTION | підінструкція вправи (дрібніше, сіре)
//   4      | EXERCISE_BODY           | сам контент вправи (твердження, варіанти)
//
// Усі — font-heading (Nunito) для 0-2 (структура/заголовки), font-body
// (Lora) для 3-4 (текст, який студент читає уважно) — той самий поділ
// ролей, що вже встановлений globals.css (h1-h6 → --font-heading, body →
// --font-body). font-heading/font-body тут — Tailwind-утиліти, згенеровані
// з @theme-змінних --font-heading/--font-body (globals.css) автоматично.
// ============================================================================

// Рівень 0 — h1 сторінки (назва сцени/тесту DELF/матеріалу/курсу).
export const STUDENT_PAGE_TITLE = "font-heading text-2xl font-bold md:text-3xl";

// Рівень 1 — підзаголовок розділу студентської сторінки (h2 "Відео"/
// "Скрипт"/"Практика"/"Вокабуляр"/"Завдання" на сцені, секції CO/CE/PE/PO
// на тесті DELF, "Вправи" в матеріалі, і тогл-заголовки блоків типу
// STUDENT_TOGGLE_HEADER_BUTTON) — uppercase+tracking-wide відрізняє це від
// h1 (звичайний регістр) сильніше, ніж просто розмір/вага.
export const STUDENT_SECTION_HEADING = "font-heading text-xl font-bold uppercase tracking-wide";

// Рівень 2 — основна інструкція вправи (InstructionsText, і 5 типів, що
// поки дублюють розмітку вручну — crossword/letter-rearrangement/
// letter-gaps/word-choice/word-search).
export const EXERCISE_INSTRUCTION = "font-heading text-lg font-bold";

// Рівень 3 — підінструкція вправи (додаткове уточнення під основною
// інструкцією, дрібніше й сірим — той самий контраст, що вже був). text-sm
// (не text-base) — свідомо менша за основну інструкцію (EXERCISE_INSTRUCTION,
// text-lg) І за тіло вправи (EXERCISE_BODY, text-base), щоб рівень 3 читався
// як найдрібніший текст вправи, а не як абзац нарівні з контентом.
export const EXERCISE_SUBINSTRUCTION = "font-body text-sm text-neutral-600 dark:text-neutral-400";

// Рівень 4 — сам контент вправи (твердження, варіанти відповідей, слова
// підказок тощо) — Lora, там де контент ще не на text-base з інших причин.
export const EXERCISE_BODY = "font-body text-base";

// Текст підказки філворда/кросворда (легенда word-search, короткий/картковий
// список підказок crossword) — свідомо менший за EXERCISE_BODY (text-sm, не
// text-base): підказка завжди коротка (слово/переклад/один рядок ключа), не
// абзац. font-body тут явний, а не лишений на успадкування — у crossword ці
// підказки лежать усередині <button>, а globals.css форсує font-heading на
// button НАПРЯМУ (бере тег, не успадкування), тож без явного класу текст
// підказки поїхав би на Nunito замість Lora.
export const CLUE_TEXT = "font-body text-sm";

// Посилання "назад" угорі сторінки (напр. "← До списку курсів") і "До
// кабінету" — без підкреслення, нейтральний сірий у спокої, колір бренду
// на hover замість підкреслення як єдиного сигналу інтерактивності.
export const BREADCRUMB_LINK =
  "text-sm text-slate-500 no-underline hover:text-brand dark:text-neutral-400 dark:hover:text-brand";

// Назва поля форми (напр. "Назва", "Тип завдання") — 14px/medium/gray-700,
// темніший і важчий за HINT_TEXT, щоб лейбл читався окремо від підказки під
// полем. Кожне місце виклику саме дописує свій layout-префікс (mt-1, flex
// items-center gap-N) поверх цього рядка — той самий принцип, що INPUT_BORDER
// свідомо без padding.
export const LABEL_TEXT = "text-sm font-medium text-gray-700 dark:text-neutral-300";

// Допоміжний текст/підказка під полем, і дрібні капшени в списках (напр.
// "Блок · {type}") — 12px/normal/gray-500, той самий вигляд, що вже був до
// централізації, просто іменована константа замість розкиданого рядка.
export const HINT_TEXT = "text-xs text-neutral-500 dark:text-neutral-400";

// Заголовок групи полів усередині форми (напр. "Основна інформація", "Ціна
// та обкладинка") — легкий орієнтир, не має конкурувати за увагу з LABEL_TEXT
// ("Назва", "Опис") у самій групі. Був text-neutral-500 font-medium (майже
// той самий колір, що тут, просто ще й жирний) — саме uppercase+font-medium
// разом робили напис "гучним" попри світлий колір; прибрала font-medium і
// трохи світліше за HINT_TEXT, щоб дійсно відступав на другий план.
export const CARD_GROUP_LABEL = "text-xs uppercase text-gray-400 dark:text-neutral-500";
