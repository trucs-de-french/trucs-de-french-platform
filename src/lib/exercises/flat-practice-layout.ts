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
// full row width") — опційна готова ЗОВНІШНЯ ширина (px) full-width
// картки, рахована викликачем (letterGapsWideCardWidthPx/
// letterRearrangementWideCardWidthPx, wide-card-width.ts) ЛИШЕ для
// orphan/overflowsColumn елементів — використовується тут ТІЛЬКИ для
// сортування "найширша спочатку" (крок 5 нижче), і передається НАСКРІЗНО
// в FlatPracticeLayoutItem без зміни, щоб викликач застосував те саме
// значення як CSS-ширину картки (jsx) без повторного рахування.
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
//    короткі/довгі — вони НІКОЛИ не паруються з сусідом, кожна рендериться
//    ОКРЕМИМ full-width рядком, у ВИХІДНОМУ порядку, У КІНЦІ списку (після
//    усіх звичайних коротких/довгих пар);
// 1. з решти — короткі з короткими (у вихідному порядку кожної групи,
//    стабільно);
// 2. довгі з довгими;
// 3. непарна коротка в кінці групи коротких ПАРУЄТЬСЯ з першим довгим
//    ЛИШЕ якщо різниця рядків <= 1 (1 рядок проти 2) — інакше йде сама,
//    half-width (full:false — full:true більше НЕ можливий тут, бо
//    orphan/overflow картки вже вийняті на кроці 0), а довгі парується
//    між собою як завжди;
// 4. непарна довга в кінці групи довгих — сама, half-width (той самий
//    принцип).
// 5. (задача "order wide cards widest-to-narrowest") full-width рядки
//    (крок 0) сортуються за wideWidthPx ЗА ЗМЕНШЕННЯМ (найширша перша),
//    стабільно для рівних значень (тай-брейк за вихідним індексом, не
//    лише надія на стабільність Array.sort) — акуратний "сходовий" вигляд
//    зліва (картки left-aligned, вужчі внизу).
// displayNumber — наскрізна нумерація В ЦЬОМУ новому порядку рядків,
// 1-based; id (перевірка/збереження/API) лишається незмінним — порядок
// рендеру й видимі номери міняються, нічого більше. Мобільний (1-колонковий)
// вигляд не парує картки взагалі (CSS-брейкпоінт, не цей файл) — та сама
// послідовність рядків (короткі → довгі → orphan/full-width) просто стає
// вертикальним списком, без додаткової логіки.
export function pairPracticeItems<Id>(items: FlatPracticeItemInput<Id>[]): FlatPracticeLayoutItem<Id>[] {
  type Item = FlatPracticeItemInput<Id>;
  const isMustBeFull = (item: Item) => item.orphan === true || item.overflowsColumn === true;
  const isShort = (item: Item) => item.lines <= 1;

  const fullWidthItems: Item[] = [];
  const shorts: Item[] = [];
  const longs: Item[] = [];
  for (const item of items) {
    if (isMustBeFull(item)) {
      fullWidthItems.push(item);
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
      rows.push({ items: [oddShort], full: false });
    }
  }

  for (let i = 0; i + 1 < remainingLongs.length; i += 2) {
    rows.push({ items: [remainingLongs[i], remainingLongs[i + 1]], full: false });
  }
  if (remainingLongs.length % 2 === 1) {
    rows.push({ items: [remainingLongs[remainingLongs.length - 1]], full: false });
  }

  const sortedFullWidthItems = fullWidthItems
    .map((item, i) => ({ item, i }))
    .sort((a, b) => (b.item.wideWidthPx ?? 0) - (a.item.wideWidthPx ?? 0) || a.i - b.i)
    .map(({ item }) => item);
  for (const fw of sortedFullWidthItems) {
    rows.push({ items: [fw], full: true });
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
