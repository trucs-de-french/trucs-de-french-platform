// Задача "card pairing in the 2-column grid" — pairPracticeItems парує
// картки практики (letter_gaps/letter_rearrangement, флет/інлайн-блок
// "Робота над помилками" БЕЗ openMode, і сцена-вигляд блоків openMode=
// "scene") короткі-з-короткими/довгі-з-довгими, щоб жоден рядок сітки не
// розтягував коротку картку (1 рядок плиток) до висоти довгого сусіда
// (2+ рядки) — залишаючи під коротким вмістом порожній простір.
//
// lines — КІЛЬКІСТЬ РЯДКІВ картки, рахована викликачем через той самий
// точний естіматор, що вже впорядковує картки РЕАЛЬНОЇ вправи
// (estimateLetterGapsCardRows/estimateLetterRearrangementCardRows,
// estimate-card-rows.ts) — НЕ через узагальнений "довжина символів понад
// фіксований порог" проксі (видалено, задача "pairing still mispairs
// cards 5/6, 7/8"): для letter_gaps довжина в символах/плитках НЕ
// пропорційна реальній кількості рядків — слово ділиться на одиниці
// переносу (пробіл/артикль), видимі літери вужчі за клітинку-пропуск
// (groupChars), і одиниці пакуються в рядок жадібним текстовим
// переносом (estimateLetterGapsCardRows), а не простим "N плиток на
// рядок" розрахунком — той самий простий проксі, що точний для
// letter_rearrangement (однакові плитки-літери без семантичних груп),
// систематично помилявся для letter_gaps, тож пара короткий/довгий
// вибиралась неправильно попри коректний алгоритм парування нижче.
// overflowsColumn (задача "a lone card must stay half-width, not stretch") —
// опційний, дефолт false: true лише коли сам контент картки НЕ влазить у
// ЖОДНУ колонку (навіть full-width, letterGapsOverflowsColumn,
// estimate-card-rows.ts — оновлено на FULL_ROW_WIDTH_PX цією задачею,
// задача "orphan card") — дуже довге нерозривне слово. letter_rearrangement
// (плитки-літери, завжди переносяться) ніколи не передає true.
//
// orphan (задача "orphan card in the last tile line") — опційний, дефолт
// false: true, коли half-width версія картки потребує 2+ рядки, і
// ОСТАННІЙ рядок тримає рівно 1 тайл (слово-одиницю/силабічний фрагмент
// letter_gaps, плитку-літеру letter_rearrangement), АЛЕ ПРИ full-width усе
// слово влазить в ОДИН рядок (letterGapsIsOrphan/letterRearrangementIsOrphan,
// estimate-card-rows.ts). pairPracticeItems виймає orphan/overflowsColumn
// картки з пулу парування ЦІЛКОМ (ніколи не парує їх із сусідом) і рендерить
// кожну окремим full-width рядком У КІНЦІ списку.
//
// lines сам по собі більше НЕ визначає full — картка з багатьма рядками,
// але контентом, що влазить у колонку (НЕ orphan/overflow), лишається
// half-width, просто вища за сусідню.
//
// wideWidthPx (задача "wide standalone card should be content-width, not
// full row width"; задача "width-by-content rule must ALSO apply to a
// lone card" — поширено на БУДЬ-ЯКУ одиноку картку) — готова ЗОВНІШНЯ
// ширина (px) картки, рахована викликачем (letterGapsWideCardWidthPx/
// letterRearrangementWideCardWidthPx, wide-card-width.ts) ДЛЯ КОЖНОГО
// елемента (не лише orphan/overflowsColumn — ЦЕЙ файл сам вирішує, хто
// саме лишиться одинокою карткою, викликач не може знати це наперед) —
// використовується тут для сортування "найширша спочатку" (крок 5 нижче)
// і передається НАСКРІЗНО в FlatPracticeLayoutItem без зміни, щоб
// викликач застосував те саме значення як CSS-ширину картки (jsx) без
// повторного рахування.
export type FlatPracticeItemInput<Id> = {
  id: Id;
  lines: number;
  overflowsColumn?: boolean;
  orphan?: boolean;
  wideWidthPx?: number;
};
export type FlatPracticeLayoutItem<Id> = { id: Id; displayNumber: number; full: boolean; wideWidthPx?: number };

// Задача "card pairing in the 2-column grid" — раніше (layoutFlatPracticeItems,
// видалено) короткі й довгі просто йшли одним списком (короткі-спочатку,
// довгі-в-кінці) БЕЗ жодної пари/рядка-спану, тож непарна кількість
// коротких просто "перетікала" в один рядок сітки з ПЕРШИМ довгим —
// рівно той самий баг, що скріншот задачі показує (нерівні висоти рядка,
// великий порожній простір під короткою карткою, яку grid розтягнув до
// висоти довгого сусіда). Тепер — явне парування РЯДКАМИ:
// 0. (задача "orphan card") картки orphan:true чи overflowsColumn:true
//    ВИЙМАЮТЬСЯ з пулу парування ПЕРШИМИ, ще до класифікації
//    короткі/довгі — вони НІКОЛИ не паруються з сусідом;
// 1. з решти — короткі з короткими (у вихідному порядку кожної групи,
//    стабільно);
// 2. довгі з довгими;
// 3. непарна коротка в кінці групи коротких ПАРУЄТЬСЯ з першим довгим
//    ЛИШЕ якщо різниця рядків <= 1 (1 рядок проти 2) — інакше йде в той
//    самий "одинокий" пул, що картки з кроку 0 (задача "width-by-content
//    rule must ALSO apply to a lone card" — звичайний непарний залишок
//    більше НЕ отримує окремого "half-width за замовчуванням" шляху,
//    він ОДНАКОВО одинока картка, що й orphan/overflow, лише з content-
//    шириною, яка (за визначенням — інакше він БУВ БИ orphan/overflow)
//    і так НЕ перевищує half-колонку, тож візуально нічого не змінюється
//    для цього випадку, крім того, що тепер він ТАКОЖ бере участь у
//    сортуванні "найширша перша" разом з усіма іншими одинокими);
// 4. непарна довга в кінці групи довгих — у той самий одинокий пул.
// 5. (задача "order wide cards widest-to-narrowest") УСІ одинокі картки
//    (крок 0 + непарні залишки 3/4) сортуються РАЗОМ за wideWidthPx ЗА
//    ЗМЕНШЕННЯМ (найширша перша), стабільно для рівних значень (тай-брейк
//    за позицією ПОПАДАННЯ в одинокий пул — orphan/overflow спочатку (у
//    вихідному порядку), потім непарний короткий, потім непарний довгий —
//    не лише надія на стабільність Array.sort) — акуратний "сходовий"
//    вигляд зліва (картки left-aligned, вужчі внизу), кожна рендериться
//    ОКРЕМИМ рядком У КІНЦІ списку (після усіх звичайних парних рядків).
// displayNumber — наскрізна нумерація В ЦЬОМУ новому порядку рядків,
// 1-based; id (перевірка/збереження/API) лишається незмінним — порядок
// рендеру й видимі номери міняються, нічого більше. Мобільний (1-колонковий)
// вигляд не парує картки взагалі (CSS-брейкпоінт, не цей файл) — та сама
// послідовність рядків (короткі → довгі → одинокі) просто стає
// вертикальним списком, без додаткової логіки.
export function pairPracticeItems<Id>(items: FlatPracticeItemInput<Id>[]): FlatPracticeLayoutItem<Id>[] {
  type Item = FlatPracticeItemInput<Id>;
  const isMustBeStandalone = (item: Item) => item.orphan === true || item.overflowsColumn === true;
  const isShort = (item: Item) => item.lines <= 1;

  const standaloneItems: Item[] = [];
  const shorts: Item[] = [];
  const longs: Item[] = [];
  for (const item of items) {
    if (isMustBeStandalone(item)) {
      standaloneItems.push(item);
    } else {
      (isShort(item) ? shorts : longs).push(item);
    }
  }

  const rows: { items: Item[]; full: boolean }[] = [];

  for (let i = 0; i + 1 < shorts.length; i += 2) {
    rows.push({ items: [shorts[i], shorts[i + 1]], full: false });
  }

  let remainingLongs = longs;
  if (shorts.length % 2 === 1) {
    const oddShort = shorts[shorts.length - 1];
    const firstLong = remainingLongs[0];
    if (firstLong && firstLong.lines - 1 <= 1) {
      rows.push({ items: [oddShort, firstLong], full: false });
      remainingLongs = remainingLongs.slice(1);
    } else {
      standaloneItems.push(oddShort);
    }
  }

  for (let i = 0; i + 1 < remainingLongs.length; i += 2) {
    rows.push({ items: [remainingLongs[i], remainingLongs[i + 1]], full: false });
  }
  if (remainingLongs.length % 2 === 1) {
    standaloneItems.push(remainingLongs[remainingLongs.length - 1]);
  }

  const sortedStandaloneItems = standaloneItems
    .map((item, i) => ({ item, i }))
    .sort((a, b) => (b.item.wideWidthPx ?? 0) - (a.item.wideWidthPx ?? 0) || a.i - b.i)
    .map(({ item }) => item);
  for (const sw of sortedStandaloneItems) {
    rows.push({ items: [sw], full: true });
  }

  const ordered: FlatPracticeLayoutItem<Id>[] = [];
  let n = 1;
  for (const row of rows) {
    for (const item of row.items) {
      ordered.push({ id: item.id, displayNumber: n++, full: row.full, wideWidthPx: item.wideWidthPx });
    }
  }
  return ordered;
}
