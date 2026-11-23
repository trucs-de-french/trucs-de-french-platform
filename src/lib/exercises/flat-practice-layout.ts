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
export type FlatPracticeItemInput<Id> = { id: Id; lines: number };
export type FlatPracticeLayoutItem<Id> = { id: Id; displayNumber: number; full: boolean };

// Задача "card pairing in the 2-column grid" — раніше (layoutFlatPracticeItems,
// видалено) короткі й довгі просто йшли одним списком (короткі-спочатку,
// довгі-в-кінці) БЕЗ жодної пари/рядка-спану, тож непарна кількість
// коротких просто "перетікала" в один рядок сітки з ПЕРШИМ довгим —
// рівно той самий баг, що скріншот задачі показує (нерівні висоти рядка,
// великий порожній простір під короткою карткою, яку grid розтягнув до
// висоти довгого сусіда). Тепер — явне парування РЯДКАМИ:
// 1. короткі з короткими (у вихідному порядку кожної групи, стабільно);
// 2. довгі з довгими;
// 3. непарна коротка в кінці групи коротких ПАРУЄТЬСЯ з першим довгим
//    ЛИШЕ якщо різниця рядків <= 1 (1 рядок проти 2) — інакше йде сама,
//    на весь рядок (full:true), а довгі парується між собою як завжди;
// 4. непарна довга в кінці групи довгих — сама, на весь рядок.
// displayNumber — наскрізна нумерація В ЦЬОМУ новому порядку рядків,
// 1-based; id (перевірка/збереження/API) лишається незмінним — порядок
// рендеру й видимі номери міняються, нічого більше.
export function pairPracticeItems<Id>(items: FlatPracticeItemInput<Id>[]): FlatPracticeLayoutItem<Id>[] {
  type Item = FlatPracticeItemInput<Id>;
  const isShort = (item: Item) => item.lines <= 1;
  const shorts: Item[] = [];
  const longs: Item[] = [];
  for (const item of items) {
    (isShort(item) ? shorts : longs).push(item);
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
      rows.push({ items: [oddShort], full: true });
    }
  }

  for (let i = 0; i + 1 < remainingLongs.length; i += 2) {
    rows.push({ items: [remainingLongs[i], remainingLongs[i + 1]], full: false });
  }
  if (remainingLongs.length % 2 === 1) {
    rows.push({ items: [remainingLongs[remainingLongs.length - 1]], full: true });
  }

  const ordered: FlatPracticeLayoutItem<Id>[] = [];
  let n = 1;
  for (const row of rows) {
    for (const item of row.items) {
      ordered.push({ id: item.id, displayNumber: n++, full: row.full });
    }
  }
  return ordered;
}
