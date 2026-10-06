import type { PartOfSpeech } from "@/lib/vocab-categories";

// Повні конфігурації (з правильними відповідями) — живуть тільки на сервері.

// points — пілот системи балів, Група B, останній тип. На відміну від усіх
// інших типів (де points на елементі — реченні/рядку/парі), тут ЦІЛА
// ВПРАЖА — один скаляр, без масиву елементів узагалі. Підтверджений
// компроміс: template — вільний текст без жодної структурної адресації
// пропусків (на відміну від drag_drop.sentences[], де кожне речення вже
// мало id), тож дрібніша прив'язка (масив points[] за позицією пропуску)
// була б крихкою — ламалась би мовчки при редагуванні тексту. Зараховується
// цілком, лише якщо ВСІ пропуски правильні (correct === true).
export type FillBlankConfig = {
  instructions?: string; // текст-інструкція над вправою, напр. "Заповніть пропуски"
  subInstructions?: string; // опційні додаткові інструкції (див. TrueFalseConfig)
  template: string; // "Je {{vais|vais bien}} au cinéma."
  points?: number;
  // Опційний банк слів-підказок (бульбашки) поруч зі вправою — суто
  // довідковий UI, студент і далі сам вписує відповідь в <input>. Не
  // тасується (той самий порядок, що вписав вчитель), не впливає на
  // gradeFillBlank жодним чином.
  wordBank?: string[];
  // Той самий принцип, що LetterGapsConfig.hintsReducePoints. Зараховується
  // на рівні ПРОПУСКУ (не всієї вправи, як points) — той самий елемент, що
  // hintedBlanks у FillBlankAnswer.
  hintsReducePoints?: boolean;
};

// Пропущені літери — вчителька вручну клікає окремі символи слова (будь-
// які, без обмежень: апостроф/дефіс так само можна ховати), студент вводить
// кожну приховану позицію в окреме однолітерне поле. hiddenIndices —
// позиції символів у word (як у string, 0-based), не обов'язково
// відсортовані при редагуванні, але порядок читання завжди зліва направо —
// забезпечується самим word.split(""), не hiddenIndices. Один бал на все
// завдання (як fill_blank) — усі слова мають бути повністю правильні.
export type LetterGapsWord = {
  word: string;
  hiddenIndices: number[];
  hintType: "definition" | "sentence";
  hintText: string;
  // Точка фокусу кадрування (object-cover) кодується прямо у фрагменті
  // самого imageUrl (`#focus=X,Y`, парситься src/lib/image-focus.ts) —
  // окремого поля свідомо нема, щоб фокус завжди подорожував разом з URL,
  // без ризику розсинхронізації при копіюванні/дублюванні картинки.
  imageUrl?: string;
  audioUrl?: string;
};
export type LetterGapsConfig = {
  instructions?: string;
  subInstructions?: string;
  words: LetterGapsWord[];
  points?: number;
  // За замовчуванням false (наявні вправи поводяться як і раніше — бали не
  // залежать від підказок) — увімкнено -> слово, для якого студент бодай
  // раз натиснув лампочку-підказку, дає 50% своєї частки балів замість
  // повної (grade.ts), навіть якщо саме слово зрештою правильне.
  hintsReducePoints?: boolean;
};

// Переставити ВСЕ слово (не лише приховані позиції, як LetterGaps) —
// hiddenIndices тут не потрібен. Перемішаний порядок для показу студенту
// живе лише в Public-формі (shuffledLetters), не в конфігу — конфіг завжди
// зберігає word у правильному порядку.
export type LetterRearrangementWord = {
  word: string;
  hintType: "definition" | "sentence";
  hintText: string;
  imageUrl?: string;
  audioUrl?: string;
};
export type LetterRearrangementConfig = {
  instructions?: string;
  subInstructions?: string;
  words: LetterRearrangementWord[];
  points?: number;
  // Той самий принцип, що LetterGapsConfig.hintsReducePoints.
  hintsReducePoints?: boolean;
};

// Звичайна відкрита відповідь з автоматичною текстовою перевіркою (без AI —
// це essay_check). Нормалізація/порівняння — той самий принцип, що для
// одного пропуску у fill_blank: правильно, якщо збігається з ОДНИМ з answers
// після trim+lowercase.
// Кілька питань під однією спільною instructions — той самий принцип, що
// listening.questions, з частковим заліком по кожному питанню. Стара пласка
// форма ({question, answers} без questions) — виродковий випадок нової,
// нормалізується на льоту в grade.ts/sanitize.ts, без міграції БД.
// points — пілот системи балів (див. TrueFalseStatement) — дефолт 1
// (resolveOpenAnswerPoints у sanitize.ts).
// imageUrl/audioUrl — опційні, біля тексту питання (той самий принцип, що
// LetterGapsWord). hint — текст підказки за лампочкою (НЕ reveal-механізм,
// як у letter_gaps/fill_blank/table_fill: тут лампочка просто показує/ховає
// цей текст, одноразово фіксуючи hintUsed для питання) — на відміну від
// answers, hint студенту показується напряму, тож він ЄСТЬ у
// OpenAnswerPublic (answers лишається прихованим).
export type OpenAnswerQuestion = {
  id: string;
  question: string;
  answers: string[];
  points?: number;
  imageUrl?: string;
  audioUrl?: string;
  hint?: string;
};
export type OpenAnswerConfig = {
  instructions?: string;
  subInstructions?: string; // опційні додаткові інструкції (див. TrueFalseConfig)
  questions: OpenAnswerQuestion[];
  // Той самий принцип, що LetterGapsConfig.hintsReducePoints — питання, де
  // студент хоч раз показав підказку, дає 50% своїх балів замість повної
  // (gradeOpenAnswer), навіть якщо відповідь зрештою правильна.
  hintsReducePoints?: boolean;
};

// essay_check — AI-перевірка есе за офіційною сіткою DELF (див.
// src/lib/delf/evaluation-grids.ts). level відсутній у config старих завдань
// (до цієї фічі) — читати як `config.level ?? "B1"`. exerciseNumber
// обов'язковий для A1/A2 (по одному task-запису на вправу — Ex.1/Ex.2 не
// об'єднуються в один запис), не використовується для B1/B2 (одна вправа).
// level "A1" + exerciseNumber 1 — особливий випадок: це не есе, а формуляр
// (див. EssayFormulaireConfig нижче), config цього task-запису має форму
// EssayFormulaireConfig, а не EssayCheckConfig.
export type EssayCheckConfig = {
  prompt: string;
  criteria: string;
  level: "A1" | "A2" | "B1" | "B2";
  exerciseNumber?: 1 | 2;
};

// A1 Exercice 1 (формуляр) — фактологічна перевірка полів консигни, без
// дескрипторів продуктивності. Кожне поле — один пункт консигни (напр.
// "Prénom", "Date de naissance").
export type EssayFormulaireField = { id: string; label: string };
export type EssayFormulaireConfig = {
  level: "A1";
  exerciseNumber: 1;
  instructions?: string;
  fields: EssayFormulaireField[];
};

// Кілька речень під однією спільною instructions і спільним display — той
// самий принцип, що listening.questions. sentence для dropdown містить
// РІВНО ОДИН "{{}}" (лише позиція вибору, без альтернатив-через-| — це не
// той механізм, що BLANK_RE/gradeFillBlank: правильність і всі варіанти,
// правильні й неправильні, лишаються в options, а не у вільному тексті).
// Стара пласка форма ({question, display, options}, без items) —
// виродковий випадок нової, нормалізується на льоту (getMultipleChoiceItems),
// без міграції БД.
// imageUrl — опційно, лише для display: "buttons" (dropdown рендерить
// нативний <option>, картинку показати не може). Без валідації/санітизації
// URL — той самий підхід, що ImageMatchItem.imageUrl/FlipCard.image_url:
// єдиний захист клієнтський (ImageOrPlaceholder), <img src> не виконує
// javascript:-URL у сучасних браузерах.
export type MultipleChoiceOption = { id: string; text: string; correct: boolean; imageUrl?: string };
// points — пілот системи балів (див. TrueFalseStatement) — дефолт 1
// (resolveMultipleChoicePoints у sanitize.ts).
export type MultipleChoiceItem = {
  id: string;
  sentence: string;
  options: MultipleChoiceOption[];
  points?: number;
};
export type MultipleChoiceConfig = {
  instructions?: string;
  subInstructions?: string; // опційні додаткові інструкції (див. TrueFalseConfig)
  display: "buttons" | "dropdown";
  items: MultipleChoiceItem[];
};

// Той самий "sentence з ОДНИМ {{}}" принцип, що MultipleChoiceConfig
// (dropdown), але варіанти рендеряться інлайн як кнопки в самому тексті
// (не <select>), і два режими взаємодії на ВЕСЬ Config (не на речення,
// як display у MultipleChoiceConfig): "select" — клік обирає варіант;
// "cross_out" — клік викреслює НЕправильні, відповідь — той, що лишився
// незакресленим (без окремого поля/підтвердження, див. grade.ts).
// points — на всю вправу (як LetterGapsConfig), не на речення — атомарний
// залік лише якщо ВСІ речення правильні (score лишається per-речення
// відсотком, ці два виміри незалежні, той самий принцип, що вже
// підтверджений для reorder/letter_gaps).
export type WordChoiceOption = { id: string; text: string; correct: boolean };
export type WordChoiceSentence = { id: string; sentence: string; options: WordChoiceOption[] };
export type WordChoiceConfig = {
  instructions?: string;
  subInstructions?: string;
  mode: "select" | "cross_out";
  sentences: WordChoiceSentence[];
  points?: number;
};

// Сітка й розміщення слів генеруються ОДИН РАЗ в адмінці (word-search-
// grid.ts), не на кожен рендер студентської сторінки, як shuffle() у
// reorder — провал розміщення слова має бути видимим вчительці одразу
// (попередження в адмінці), а не мовчки ламати вправу на випадковому показі
// студенту. grid і placements зберігаються в config як звичайний JSON,
// точно як їх згенерував генератор — sanitize лише прибирає placements.
// points — на всю вправу (як LetterGapsConfig), не на слово: зараховується
// цілком, лише якщо ВСІ слова знайдені правильно (той самий принцип, що
// letter_gaps/letter_rearrangement), не частковий залік по слову.
// translation/imageUrl/audioUrl — опційні підказки студенту в легенді, не
// секрет (на відміну від placements) — sanitize пропускає їх як є.
// category — ЕТАП C/3: назва категорії зі скрипту (VocabItem.partOfSpeech,
// vocab-categories.ts, французький підпис — PART_OF_SPEECH_LABELS_FR), для
// групування блоків у режимі "За категоріями" (optimize-split.ts,
// splitByCategory) і підказки назви блоку. ЛИШЕ для адмінки/конструктора —
// sanitizeWordSearch (sanitize.ts) явно НЕ копіює це поле в
// WordSearchPublic (студент його не бачить і не повинен). Слова без
// категорії (ручний ввід, старі вправи) — undefined.
export type WordSearchWord = {
  word: string;
  translation?: string;
  imageUrl?: string;
  audioUrl?: string;
  category?: string;
};
// direction — лише вперед (без реверсу/діагоналей), той самий принцип, що
// й в описі фічі; row/col — 0-based, верхній лівий кут сітки.
export type WordSearchPlacement = {
  word: string;
  row: number;
  col: number;
  direction: "horizontal" | "vertical";
};
// Поділ великої вправи на кілька менших сіток — "Блок 1/2/3" (мобільна
// причина: одна сітка з усіма словами не вміщується на екрані телефона).
// Генерація поділу — етап 2 (не тут); цей тип лише
// описує РЕЗУЛЬТАТ поділу, уже збережений у config, щоб не перераховувати
// його при кожному відкритті вправи (той самий принцип, що вже є для
// grid/placements самої вправи — генерація один раз, не на льоту).
// wordKeys — слова цього блоку в ТІЙ САМІЙ нормалізації, що
// placements/sanitizeWordForGrid+upper (НЕ config.words[].word напряму) —
// метадані слова (translation/imageUrl/audioUrl) лишаються виключно в
// config.words, блок лише посилається на слово його нормалізованим
// ключем. Дублікати нормалізованих слів (якщо вчителька ввела те саме
// слово двічі) зберігаються як повторювані елементи wordKeys (мультимножина,
// не Set) — grid-blocks.ts (selectWordsForBlock) розбирає їх по порядку
// появи в config.words, по одному входженню на ключ, тож навіть дублікат
// коректно дістається рівно одному блоку.
// title/clueMode — ЕТАП A/3: назва блоку (показується студенту замість
// "Блок N", BlockNavigation.labels) і режим показу підказок у ЦЬОМУ блоці
// (переозначає per-слівний clueStyle/наявність картинки на весь блок,
// resolveClueView, components/exercises/resolve-clue-view.ts) — дані самих
// слів (config.words) не чіпаються, лише як їх показати в цьому блоці.
// Обидва опційні: відсутні — блок виглядає й поводиться РІВНО як до
// ЕТАПУ A (конструктор поки не вміє їх заповнювати — ЕТАП B). title —
// звичайний текст (до 40 символів після санітизації, sanitize.ts), без
// жодного HTML.
export type WordSearchBlock = {
  wordKeys: string[];
  grid: string[][];
  placements: WordSearchPlacement[];
  gridSourceWords?: string[];
  title?: string;
  clueMode?: "short" | "long" | "image";
};

export type WordSearchConfig = {
  instructions?: string;
  subInstructions?: string;
  words: WordSearchWord[];
  // LEGACY — поле повної (нерозбитої на блоки) сітки. Нові вправи (і старі,
  // пропущені крізь normalizeWordSearchConfig, grid-blocks.ts) тримають той
  // самий зміст у blocks[0], це поле лишається опційним для зворотної
  // сумісності зі старими рядками БД і НЕ читається новим кодом напряму.
  grid?: string[][];
  // LEGACY — те саме, що grid вище.
  placements?: WordSearchPlacement[];
  points?: number;
  // LEGACY — те саме, що grid вище (знімок слів-джерел генерації, тепер
  // живе в blocks[i].gridSourceWords).
  // Нормалізований (sanitizeWordForGrid+upper) список слів, з яких grid/
  // placements БУЛИ згенеровані (generateWordSearchGrid.sourceWords,
  // word-search-grid.ts) — знімок на момент генерації, не похідне поточних
  // words. Опційне — вправи, збережені до появи цього поля, не мають його
  // взагалі; task-validation.ts тоді звіряє інакше (лише "чи зникло
  // розміщене слово"), не порівнюючи списки цілком.
  gridSourceWords?: string[];
  // Той самий принцип, що LetterGapsConfig.hintsReducePoints.
  hintsReducePoints?: boolean;
  // Відсутнє — старий формат (один "блок" без явного поля, еквівалентно
  // grid/placements вище); normalizeWordSearchConfig (grid-blocks.ts)
  // синтезує РІВНО ОДИН блок із цих legacy-полів на льоту, без міграції БД.
  // Порожній масив — вправа ще без згенерованої сітки взагалі (і новий, і
  // старий формат — той самий сенс, що grid.length===0 раніше).
  blocks?: WordSearchBlock[];
};

// Слово + підказка (означення) — на відміну від WordSearchWord, тут немає
// translation/imageUrl/audioUrl: підказка ЗАВЖДИ текстова (clue), той самий
// принцип, що LetterGapsWord.hintText, лише без варіанту "definition"/
// "sentence" (кросворд-підказка — завжди коротке означення).
// clueStyle — вчителька сама вирішує для КОЖНОГО слова, чи підказка
// коротка (плаский текст у студентському рендері) чи довга/речення (стиль
// картки) — незалежно від картинки/аудіо (ті завжди в картці). Дефолт
// "short", якщо не вказано — зберігає сумісність із уже наявними
// завданнями, збереженими до появи цього поля.
// category — той самий принцип, що WordSearchWord.category вище (ЕТАП C/3)
// — НЕ денормалізується в CrosswordPlacement (crossword-grid.ts) і тому не
// потрапляє в CrosswordPublic за конструкцією (sanitizeCrossword будує
// across/down з placements, не з config.words).
export type CrosswordWord = {
  word: string;
  clue: string;
  clueStyle?: "short" | "long";
  imageUrl?: string;
  audioUrl?: string;
  category?: string;
};
// clue/clueStyle денормалізовано просто в placement (не шукається окремо в
// CrosswordConfig.words за збігом word) — уникає крихкого JOIN, якщо
// раптом у списку опиняться два однакові слова з різними підказками.
// number — номер клітинки-початку слова (стандартна конвенція кросвордів:
// одна нумерація на клітинку, спільна для гор./верт. слів, що починаються
// в тій самій клітинці) — пораховано ОДИН РАЗ у generateCrosswordGrid(),
// той самий принцип "генерація не на льоту", що вже є для word_search.
export type CrosswordPlacement = {
  word: string;
  clue: string;
  clueStyle?: "short" | "long";
  imageUrl?: string;
  audioUrl?: string;
  row: number;
  col: number;
  direction: "horizontal" | "vertical";
  number: number;
};
// gridWidth/gridHeight — похідний bounding-box розмір (не задається
// вчителькою вручну) — природний побічний продукт generateCrosswordGrid():
// алгоритм працює в розрідженій мапі координат (без наперед відомого
// розміру), розмір обчислюється лише в кінці, після розміщення всіх слів.
// На відміну від WordSearchConfig, тут немає окремого поля grid (масиву
// літер) — заблоковані/відкриті клітинки й самі літери відновлюються з
// placements там, де вони потрібні (санітизація, оцінювання, прев'ю в
// адмінці), а не зберігаються повторно.
// Той самий принцип поділу на блоки, що WordSearchBlock (types.ts вище) —
// одне застереження: на відміну від word_search (де грід — суцільний
// прямокутник), тут gridWidth/gridHeight — ВЛАСНИЙ bounding-box ЦЬОГО
// блоку (не всієї вправи), number у placements — локальна нумерація в
// межах блоку (рахується generateCrosswordGrid при генерації САМЕ цього
// блоку, етап 2) — той самий сенс, що вже є для одноблочної вправи, просто
// тепер по одному bounding-box+нумерації на блок, а не на всю вправу.
// title/clueMode — той самий принцип, що WordSearchBlock вище (ЕТАП A/3).
export type CrosswordBlock = {
  wordKeys: string[];
  placements: CrosswordPlacement[];
  gridWidth: number;
  gridHeight: number;
  gridSourceWords?: string[];
  title?: string;
  clueMode?: "short" | "long" | "image";
};

export type CrosswordConfig = {
  instructions?: string;
  subInstructions?: string;
  words: CrosswordWord[];
  // LEGACY — те саме, що WordSearchConfig.grid: зміст живе в blocks[0]
  // після normalizeCrosswordConfig (grid-blocks.ts), поле лишається лише
  // для зворотної сумісності зі старими рядками БД.
  placements?: CrosswordPlacement[];
  // LEGACY — те саме.
  gridWidth?: number;
  // LEGACY — те саме.
  gridHeight?: number;
  points?: number;
  // LEGACY — те саме, що WordSearchConfig.gridSourceWords.
  // Той самий принцип, що WordSearchConfig.gridSourceWords — знімок
  // нормалізованих слів на момент генерації (generateCrosswordGrid.sourceWords,
  // crossword-grid.ts), опційний для сумісності зі старими вправами.
  gridSourceWords?: string[];
  // Той самий принцип, що LetterGapsConfig.hintsReducePoints.
  hintsReducePoints?: boolean;
  // Той самий принцип, що WordSearchConfig.blocks — відсутнє означає
  // старий формат, normalizeCrosswordConfig синтезує один блок із legacy
  // полів вище без міграції БД.
  blocks?: CrosswordBlock[];
};

// points — необов'язкове, дефолт 1 бал (resolveTrueFalsePoints у
// sanitize.ts) для тверджень без явного значення, щоб наявні задачі й далі
// мали сенс без ретроактивного заповнення. Це пілот системи балів
// (points_visible на tasks) — score/percentage у grade.ts лишається
// незмінним джерелом правди для прогресу/pass-fail, points — окремий шар
// лише для показу студенту.
export type TrueFalseStatement = { id: string; text: string; answer: boolean; points?: number };
export type TrueFalseConfig = {
  instructions?: string;
  // Опційні додаткові інструкції — окреме поле, не частина instructions,
  // щоб коротка головна інструкція лишалась короткою, а довші пояснення
  // (за потреби) не змушували її розтягуватись. Форматований HTML (жирний/
  // курсив/підсвітка) — санітизується і при збереженні, і при рендері
  // (sanitizeInstructionsHtml), той самий double-sanitize принцип, що callout.
  subInstructions?: string;
  statements: TrueFalseStatement[];
};

// id/points — пілот системи балів, Група B. На відміну від інших типів,
// пари ніколи не мали id взагалі (адресація й правильність — за змістом
// left/right, не за id). Стара форма (без id) — виродковий випадок нової,
// нормалізується на льоту (getMatchingPairs, стабільний синтетичний
// `pair-${index}`), без міграції БД. Бали — на рівні ПАРИ (уже атомарна
// одиниця, без під-структури).
export type MatchingPair = { id?: string; left: string; right: string; points?: number };
export type MatchingConfig = {
  instructions?: string;
  subInstructions?: string; // опційні додаткові інструкції (див. TrueFalseConfig)
  pairs: MatchingPair[];
};

// imageUrl — опційно (див. MultipleChoiceOption — той самий принцип).
export type ListeningOption = { id: string; text: string; correct: boolean; imageUrl?: string };
// points — пілот системи балів (див. TrueFalseStatement) — дефолт 1
// (resolveListeningPoints у sanitize.ts).
export type ListeningQuestion = {
  id: string;
  question: string;
  options: ListeningOption[];
  points?: number;
};
export type ListeningConfig = {
  instructions?: string;
  subInstructions?: string; // опційні додаткові інструкції (див. TrueFalseConfig)
  audioUrl: string;
  questions: ListeningQuestion[];
};

// Кілька окремих послідовностей для впорядкування під однією спільною
// instructions — той самий принцип, що listening.questions/
// open_answer.questions. Стара пласка форма ({instructions?, items}, без
// sequences) — виродковий випадок нової, нормалізується на льоту в
// grade.ts/sanitize.ts (getReorderSequences), без міграції БД.
// points — пілот системи балів (дефолт 1, resolveReorderPoints у
// sanitize.ts) — свідомо на рівні ПОСЛІДОВНОСТІ, не окремої плитки:
// зараховується цілком, лише якщо ВСЯ послідовність зібрана правильно.
// Це відрізняється гранулярністю від score (атомарний по плитках через усі
// послідовності) — свідоме рішення, score і points незалежні виміри, і не
// вимагає id для кожного елемента items: string[] (що перевело б reorder у
// складність Групи B).
// imageUrl/audioUrl — опційні, на рівні ПОСЛІДОВНОСТІ (не елемента, як у
// LetterRearrangementWord) — показуються один раз над усім рядком плиток,
// слово в items лишається плоским string.
export type ReorderSequence = {
  id: string;
  items: string[]; // items — правильний порядок
  points?: number;
  imageUrl?: string;
  audioUrl?: string;
};
export type ReorderConfig = {
  instructions?: string;
  subInstructions?: string; // опційні додаткові інструкції (див. TrueFalseConfig)
  sequences: ReorderSequence[];
};

// Кілька окремих речень із пропусками під однією спільною instructions —
// той самий принцип, що reorder.sequences. Банк слів СПІЛЬНИЙ на всю
// вправу (свідоме рішення, не per-речення) — слово, використане в одному
// реченні, недоступне для решти. Стара пласка форма ({instructions?,
// template, bank}, без sentences) — виродковий випадок нової,
// нормалізується на льоту (getDragDropSentences), без міграції БД; bank
// лишається пласким полем в обох формах, нормалізації не потребує.
// points — пілот системи балів, Група B (див. TrueFalseStatement/
// ReorderSequence) — дефолт 1 (resolveDragDropPoints у sanitize.ts).
// Свідомо на рівні РЕЧЕННЯ, не окремого пропуску — зараховується цілком,
// лише якщо ВСІ пропуски цього речення правильні. Той самий принцип, що
// вже підтверджений для reorder.sequences: score і points незалежні
// виміри різної гранулярності.
export type DragDropSentence = { id: string; template: string; points?: number }; // "Je {{vais}} au cinéma."
export type DragDropConfig = {
  instructions?: string;
  subInstructions?: string; // опційні додаткові інструкції (див. TrueFalseConfig)
  sentences: DragDropSentence[];
  bank: string[]; // слова для банку (правильні +, за бажанням, дистрактори)
  // Той самий принцип, що LetterGapsConfig.hintsReducePoints — "елемент"
  // тут РЕЧЕННЯ (та сама гранулярність, що points).
  hintsReducePoints?: boolean;
};

export type SortColumn = { id: string; label: string };
// points — пілот системи балів (див. TrueFalseStatement) — дефолт 1
// (resolveSortColumnsPoints у sanitize.ts).
export type SortColumnsItem = { id: string; text: string; columnId: string; points?: number };
export type SortColumnsConfig = {
  instructions?: string;
  subInstructions?: string; // опційні додаткові інструкції (див. TrueFalseConfig)
  columns: SortColumn[];
  items: SortColumnsItem[];
  // На відміну від LetterGapsConfig.hintsReducePoints (там лампочка й так
  // завжди доступна, прапор лише вирішує ціну) — тут лампочка й сама
  // підказка-колонка показуються ЛИШЕ коли hintsEnabled=true: без цього
  // поля (наявні вправи до появи фічі) лампочки взагалі немає, а не просто
  // "безкоштовної". /api/exercises/sort-columns-hint теж звіряє цей прапор
  // на сервері — без нього не віддає колонку, навіть якщо хтось обійде UI.
  hintsEnabled?: boolean;
};

// table_fill — таблиця з 2 колонками (довільні назви); для кожної клітинки
// в рядку вчитель окремо вирішує, чи вона показана текстом, чи прихована
// (поле для введення). Якщо hidden — value може містити кілька допустимих
// варіантів через "|" (той самий синтаксис, що в fill_blank).
// points — пілот системи балів, Група B (див. DragDropSentence) — дефолт 1
// (resolveTableFillPoints у sanitize.ts). На рівні РЯДКА (не клітинки):
// зараховується цілком, лише якщо ВСІ приховані клітинки цього рядка (1
// чи 2 — leftHidden/rightHidden незалежні) правильні. Рядки без жодної
// прихованої клітинки не мають чого оцінювати й не впливають ні на
// pointsEarned, ні на pointsPossible.
export type TableFillRow = {
  id: string;
  left: string;
  right: string;
  leftHidden: boolean;
  rightHidden: boolean;
  points?: number;
  // Опційна частина мови (vocab-categories.ts) — для групування рядків на
  // студентській сторінці (table-fill.tsx); порожньо для рядків, доданих
  // вручну, і для вправ, збережених до появи цього поля.
  partOfSpeech?: PartOfSpeech | null;
};
export type TableFillConfig = {
  instructions?: string;
  subInstructions?: string; // опційні додаткові інструкції (див. TrueFalseConfig)
  columnLabels: [string, string];
  rows: TableFillRow[];
  // Той самий принцип, що LetterGapsConfig.hintsReducePoints — тут
  // застосовується на рівні РЯДКА (не клітинки, як і points): рядок, де
  // підказку брали хоч для однієї з його прихованих клітинок, дає 50% балів
  // рядка, якщо в підсумку весь рядок правильний.
  hintsReducePoints?: boolean;
};

// checkbox_grid — довільна кількість рядків (тверджень/питань) і колонок
// (не жорстко "Так"/"Ні" — вчитель редагує підписи, той самий редактор
// колонок, що вже в SortColumnsConfig). Студент може позначити КІЛЬКА
// клітинок в одному рядку (не radio, вільний мультивибір) — тому
// correctColumnIds масив, а не одне columnId. Не тримаємо cells[] у
// кожному рядку (як обговорювалось) — лише список ID правильних колонок,
// той самий принцип, що SortColumnsItem.columnId, лише множинний.
export type CheckboxGridColumn = { id: string; label: string };
// points — той самий пілот, що інших типів (дефолт 1,
// resolveCheckboxGridPoints у sanitize.ts). На рівні РЯДКА (не клітинки,
// той самий компроміс, що вже підтверджений для TableFillRow): рядок
// зараховується цілком, лише якщо ВСІ його клітинки (позначені й
// непозначені) збігаються з очікуваним станом. Score, на відміну від
// points, атомарний по клітинках — незалежний, дрібніший вимір.
export type CheckboxGridRow = {
  id: string;
  label: string;
  correctColumnIds: string[];
  points?: number;
};
export type CheckboxGridConfig = {
  instructions?: string;
  subInstructions?: string;
  columns: CheckboxGridColumn[];
  rows: CheckboxGridRow[];
};

// image_match — кілька зображень, під кожним слот для перетягування назви;
// рівно одна правильна назва на зображення (без pipe-альтернатив — назва
// береться з фіксованого банку, а не вільним текстом, тож альтернативи не
// мають сенсу, як і в drag_drop).
// points — пілот системи балів (див. TrueFalseStatement) — дефолт 1
// (resolveImageMatchPoints у sanitize.ts).
export type ImageMatchItem = { id: string; imageUrl: string; name: string; points?: number };
export type ImageMatchConfig = {
  instructions?: string;
  subInstructions?: string; // опційні додаткові інструкції (див. TrueFalseConfig)
  items: ImageMatchItem[];
};

// chronological_order — набір елементів (картинки АБО текстові твердження,
// перемикається одним mode на всю вправу, той самий принцип, що
// MultipleChoiceConfig.display), студент вписує число-позицію для кожного.
// ПОРЯДОК МАСИВУ items = правильний хронологічний порядок — окремого поля
// correctPosition свідомо нема (той самий принцип, що ReorderSequence.items:
// string[]): дублювати індекс окремим полем означало б тримати їх
// синхронними вручну. В адмінці тому потрібні кнопки ↑/↓ для зміни порядку
// (єдиний тип, де порядок елементів у списку має змістовне значення).
// mode "mixed" — картинка (content, як у "image") + підпис знизу (text,
// нове поле, використовується ЛИШЕ в mode "mixed"). content не змінює
// семантику для "image"/"text" — лише mixed додає друге поле поруч.
export type ChronologicalOrderItem = { id: string; content: string; text?: string; points?: number };
export type ChronologicalOrderConfig = {
  instructions?: string;
  subInstructions?: string;
  mode: "image" | "text" | "mixed";
  items: ChronologicalOrderItem[];
};

// Караоке — відео (поки лише YouTube, своя URL на кожну вправу) + текст
// пісні/скрипту, синхронізований за часом. tokens — ВСЯ послідовність
// токенів рядка (і слова, і роздільники — пробіли/розділові знаки — як
// окремі елементи, в оригінальному порядку) — так само, як gapTokenIndices
// нижче адресує лише "словесні" токени (пунктуація ніколи не є пропуском),
// той самий принцип, що LetterGapsWord.hiddenIndices, лише на рівні слова,
// не символу. Бали — ЧАСТКОВІ, pointsPerGap за кожен пропуск, підсумок —
// сума (на відміну від fill_blank/letter_gaps, де один бал на все
// завдання) — той самий принцип, що MatchingPair.points, лише один спільний
// коефіцієнт на всі пропуски вправи, а не окремий на кожен.
export type KaraokeLine = {
  start: number; // секунди від початку відео (дробові дозволені)
  // Кінець рядка (секунди) — момент паузи-на-пропуску, karaoke.tsx.
  // Опційний для зворотної сумісності: якщо не задано, кінцем вважається
  // start наступного рядка (для останнього — старий фолбек-запас).
  end?: number;
  tokens: string[];
  gapTokenIndices: number[];
};
export type KaraokeConfig = {
  instructions?: string;
  subInstructions?: string;
  videoUrl: string;
  answerMode: "choice" | "typing";
  pauseOnGap: boolean;
  pointsPerGap?: number;
  lines: KaraokeLine[];
};

// flip_cards — самостійний тип без правильної відповіді (не оцінюється),
// тому повна конфігурація й публічна — одне й те саме, sanitize не потрібен.
export type FlipCard = { front: string; back: string; image_url?: string; audio_url?: string };
// mode/revealSide — опційні (дефолт "manual"/"front" на рівні студентського
// компонента, не тут) — наявні збережені завдання без цих полів лишаються
// в manual-режимі без міграції. random_reveal — Wordwall Flip Tiles-стиль:
// студент крутить "рулетку", яка випадково зупиняється на невиказаній
// картці, показує лише revealSide, клік відкриває іншу сторону.
export type FlipCardsConfig = {
  instructions?: string;
  subInstructions?: string; // опційні додаткові інструкції (див. TrueFalseConfig)
  cards: FlipCard[];
  mode?: "manual" | "random_reveal";
  revealSide?: "front" | "back";
};

// callout — текстовий інформаційний блок (Notion-подібний), не вправа:
// немає правильної відповіді, не оцінюється, повна конфігурація й публічна —
// одне й те саме (як flip_cards). content — HTML із TipTap-редактора,
// санітизований DOMPurify і при збереженні, і перед рендером.
export type CalloutStyle = "none" | "info" | "tip" | "warning" | "success" | "special";
export type CalloutConfig = {
  style: CalloutStyle;
  content: string;
};

// phonetics — довідковий список реплік/фраз із транскрипцією (IPA чи
// довільний запис) і опційним аудіо/відео на кожну; як flip_cards/callout —
// не оцінюється, повна конфігурація й публічна — одне й те саме.
export type PhoneticsItem = {
  text: string;
  transcription: string;
  mediaUrl?: string;
  imageUrl?: string;
};
export type PhoneticsConfig = {
  instructions?: string;
  subInstructions?: string; // опційні додаткові інструкції (див. TrueFalseConfig)
  items: PhoneticsItem[];
};

// vocab_quiz — так само самостійний тип без сервера: лексика (слово+переклад)
// і так повністю видима студенту, тож перевірка відповіді відбувається на
// клієнті. sceneIds — джерела лексики (dialogue.vocab обраних сцен курсу),
// не обов'язково та сама сцена, де лежить саме завдання.
export type VocabQuizConfig = {
  sceneIds: string[];
};

// "Очищені" версії — це і йде студенту, у них немає правильних відповідей.

export type FillBlankPublic = {
  instructions?: string;
  subInstructions?: string;
  template: string; // з {{}} замість {{вар1|вар2}}
  points: number; // на всю вправу, не на пропуск
  wordBank?: string[]; // довідкові бульбашки, не тасується
  // Лише для тексту-пояснення "Слово з підказкою дає половину балів"
  // (hint-explanation.tsx) — сама знижка рахується на сервері (grade.ts),
  // тут це суто інформаційний прапорець.
  hintsReducePoints: boolean;
  // Переклад на пропуск (за індексом, той самий порядок, що й самі
  // пропуски), з маркера {{відповідь::переклад}} — null, де "::" не було.
  // Відповіді сюди НІКОЛИ не потрапляють (parseBlankMarker, sanitize.ts).
  hints?: (string | null)[];
};

// chars — явна маска на рівні символів (null на прихованих позиціях, сам
// символ на видимих), а не word+hiddenIndices — інакше студент прочитав би
// приховані літери прямо з word.
//
// hiddenLetters — правильна літера на кожну ПРИХОВАНУ позицію, у тому
// самому порядку, що й gapIndex клієнта (зліва направо серед null-позицій
// chars) — той самий принцип, що CrosswordPublic.solution: рішення
// свідомо йде студенту одразу, щоб клієнт міг підсвічувати правильність
// наживо, без запиту на сервер. Технічно це не "новий" секрет — той самий
// student, хто вже читає chars/word структуру, при бажанні й так відновив
// би слово по довжині+контексту; crossword уже приймає цей компроміс.
export type LetterGapsPublicWord = {
  chars: (string | null)[];
  hiddenLetters: string[];
  hintType: "definition" | "sentence";
  hintText: string;
  imageUrl?: string;
  audioUrl?: string;
};
export type LetterGapsPublic = {
  instructions?: string;
  subInstructions?: string;
  words: LetterGapsPublicWord[];
  points: number;
  // Лише для тексту-пояснення (hint-explanation.tsx) — сама знижка
  // рахується на сервері.
  hintsReducePoints: boolean;
};

// shuffledLetters — word.split("") перемішаний на сервері (sanitize.ts),
// одне перемішування на показ. Порівняння при перевірці — позиційне за
// значенням (як ReorderAnswer), не за identity літери, тож дублікати літер
// (напр. "chocolat") коректно обробляються без додаткової розмітки.
// Підсвічування правильності — лише ПІСЛЯ "Перевірити" (LetterRearrangementDetail),
// той самий принцип, що reorder — жодного "рішення" клієнту заздалегідь не
// передається.
export type LetterRearrangementPublicWord = {
  shuffledLetters: string[];
  hintType: "definition" | "sentence";
  hintText: string;
  imageUrl?: string;
  audioUrl?: string;
};
export type LetterRearrangementPublic = {
  instructions?: string;
  subInstructions?: string;
  words: LetterRearrangementPublicWord[];
  points: number;
  // Лише для тексту-пояснення (hint-explanation.tsx) — сама знижка
  // рахується на сервері.
  hintsReducePoints: boolean;
};

export type MultipleChoicePublic = {
  instructions?: string;
  subInstructions?: string;
  display: "buttons" | "dropdown";
  items: {
    id: string;
    sentence: string;
    multiple: boolean; // чи більше однієї правильної відповіді (для radio/checkbox)
    correctCount: number; // скільки саме — для підказки студенту, напр. "2 варіанти"
    options: { id: string; text: string; imageUrl?: string }[];
    points: number;
  }[];
};

// correct-прапорці схованi (як у MultipleChoicePublic) — options лише
// {id, text}. multiple/correctCount — похідні з options.filter(correct),
// той самий принцип, що MultipleChoicePublic.items[].multiple/correctCount:
// у Config немає окремого поля-перемикача, кількість правильних на речення
// визначається просто тим, скільки options позначено correct:true.
// correctCount використовується лише в mode "select" (підказка студенту
// "Оберіть N варіантів") — у "cross_out" свідомо НЕ показується.
export type WordChoicePublic = {
  instructions?: string;
  subInstructions?: string;
  mode: "select" | "cross_out";
  sentences: {
    id: string;
    sentence: string;
    multiple: boolean;
    correctCount: number;
    options: { id: string; text: string }[];
  }[];
  points: number;
};

// grid — та сама сітка, що в Config, без змін (не секрет, студент і так
// бачить усю сітку цілком). words — та сама форма, що WordSearchWord
// (translation/imageUrl/audioUrl теж не секрет, це підказки). placements —
// ЄДИНЕ, що ховається (інакше перевірка була б тривіальною).
// hintStart — координата ПЕРШОЇ клітинки слова в сітці (для підказки-
// блимання, word-search.tsx), єдине, що виходить за межі "конфіг мінус
// placements": letters у grid і так усі видимі студенту (сама природа
// філворда — секрет лише ЯКІ клітинки утворюють слово, не самі літери), тож
// розкриття лише СТАРТОВОЇ клітинки ОДНОГО слова — значно менший компроміс,
// ніж CrosswordPublic.solution (там розкриваються самі значення літер,
// яких інакше не видно взагалі). null — слово не вмістилось у сітку
// (failedWords, word-search-grid.ts) — підказка для нього недоступна.
// title/clueMode — санітизовані копії WordSearchBlock (ЕТАП A/3,
// sanitize.ts) — title лише текст (до 40 символів, без переносів/керівних
// символів, обрізане в sanitizeWordSearch), clueMode лише одне з трьох
// валідних значень, інакше undefined.
export type WordSearchPublicBlock = {
  words: (WordSearchWord & { hintStart: { row: number; col: number } | null })[];
  grid: string[][];
  title?: string;
  clueMode?: "short" | "long" | "image";
};

export type WordSearchPublic = {
  instructions?: string;
  subInstructions?: string;
  // LEGACY — рівно те саме, що blocks[0] (words/grid), заповнюється
  // sanitizeWordSearch. Етап 3/4: word-search.tsx перейшов на blocks як
  // основне джерело — ці поля читаються лише В ОДНОМУ місці: власний
  // фолбек word-search.tsx на випадок blocks:[] (помилка даних), щоб
  // вправа не впала, а показалась як один блок. Не видаляти, доки цей
  // фолбек існує.
  words: (WordSearchWord & { hintStart: { row: number; col: number } | null })[];
  grid: string[][];
  // Порожній масив — вправа без жодного блоку (сітку ще не згенеровано,
  // той самий сенс, що раніше grid.length===0): legacy words/grid вище теж
  // порожні в цьому випадку.
  blocks: WordSearchPublicBlock[];
  points: number;
  // Лише для тексту-пояснення (hint-explanation.tsx) — сама знижка
  // рахується на сервері.
  hintsReducePoints: boolean;
};

// Не "конфіг мінус placements" — синтезована структура (sanitizeCrossword
// будує openCells/cellNumbers/solution/across/down з placements, самі
// placements студенту не йдуть, лише похідні від них форми).
// length — довжина слова, суто інформаційна (студент бачить, скільки
// клітинок відведено під слово, ще до першого вводу).
export type CrosswordCluePublic = {
  number: number;
  clue: string;
  clueStyle?: "short" | "long";
  length: number;
  imageUrl?: string;
  audioUrl?: string;
};
// title/clueMode — той самий принцип, що WordSearchPublicBlock вище.
export type CrosswordPublicBlock = {
  gridWidth: number;
  gridHeight: number;
  openCells: boolean[][];
  cellNumbers: (number | null)[][];
  solution: string[][];
  across: CrosswordCluePublic[];
  down: CrosswordCluePublic[];
  title?: string;
  clueMode?: "short" | "long" | "image";
};

export type CrosswordPublic = {
  instructions?: string;
  subInstructions?: string;
  // LEGACY — рівно те саме, що blocks[0], заповнюється sanitizeCrossword.
  // Етап 3/4: crossword.tsx перейшов на blocks як основне джерело — ці
  // поля читаються лише В ОДНОМУ місці: власний фолбек crossword.tsx на
  // випадок blocks:[] (помилка даних), щоб вправа не впала, а показалась
  // як один блок. Не видаляти, доки цей фолбек існує.
  gridWidth: number;
  gridHeight: number;
  openCells: boolean[][]; // true — клітинка для вводу, false — заблокована
  cellNumbers: (number | null)[][]; // номер у клітинці, що починає слово(а)
  // Правильна літера на кожній відкритій клітинці ("" на заблокованих) —
  // на відміну від WordSearchPublic/letter_gaps, тут СВІДОМО розкрито
  // студенту (прийнятий компроміс: простіше технічно за живу
  // серверну перевірку по кожній клітинці, ризик підглянути в мережі
  // визнано прийнятним для цього типу завдання) — потрібно для живого
  // клієнтського підсвічування без запиту на сервер. Кнопка "Перевірити" й
  // grade.ts як джерело балів на це не зважають — лишаються незалежним
  // фінальним кроком.
  solution: string[][];
  across: CrosswordCluePublic[];
  down: CrosswordCluePublic[];
  // Порожній масив — вправа без жодного блоку (сітку ще не згенеровано).
  blocks: CrosswordPublicBlock[];
  points: number;
  // Лише для тексту-пояснення (hint-explanation.tsx) — сама знижка
  // рахується на сервері.
  hintsReducePoints: boolean;
};

export type TrueFalsePublic = {
  instructions?: string;
  subInstructions?: string;
  statements: { id: string; text: string; points: number }[]; // points завжди присутні — не секрет, як answer
};

export type MatchingPublic = {
  instructions?: string;
  subInstructions?: string;
  left: string[];
  right: string[]; // перемішано, без зв'язку з left
  // ДОДАТКОВЕ поле лише для показу балів (не замінює left/right вище і не
  // чіпає взаємодію "клікнути ліве, клікнути праве") — left тут НЕ
  // перемішаний (той самий порядок, що в left[] вище), тож студент бачить
  // бали навпроти кожного лівого елемента.
  pairs: { id: string; left: string; points: number }[];
};

export type ListeningPublic = {
  instructions?: string;
  subInstructions?: string;
  audioUrl: string;
  questions: {
    id: string;
    question: string;
    options: { id: string; text: string; imageUrl?: string }[];
    points: number;
  }[];
};

export type ReorderPublic = {
  instructions?: string;
  subInstructions?: string;
  // items перемішано, окремо на кожну послідовність; imageUrl/audioUrl —
  // те саме, що в ReorderSequence, копіюється без змін (sanitizeReorder).
  sequences: { id: string; items: string[]; points: number; imageUrl?: string; audioUrl?: string }[];
};

export type DragDropPublic = {
  instructions?: string;
  subInstructions?: string;
  // hints — той самий принцип, що FillBlankPublic.hints, тут за ЛОКАЛЬНИМ
  // (у межах цього речення) індексом пропуску.
  sentences: { id: string; template: string; points: number; hints?: (string | null)[] }[]; // з {{}} замість {{слово}}
  bank: string[]; // перемішано, один спільний
  // Лише для тексту-пояснення — сама знижка рахується на сервері.
  hintsReducePoints: boolean;
};

export type SortColumnsPublic = {
  instructions?: string;
  subInstructions?: string;
  columns: SortColumn[];
  items: { id: string; text: string; points: number }[]; // без columnId, перемішано
  hintsEnabled: boolean;
};

export type OpenAnswerPublic = {
  instructions?: string;
  subInstructions?: string;
  questions: {
    id: string;
    question: string;
    points: number;
    imageUrl?: string;
    audioUrl?: string;
    hint?: string;
  }[];
};

export type TableFillPublic = {
  instructions?: string;
  subInstructions?: string;
  columnLabels: [string, string];
  // partOfSpeech — не відповідь (як gapOptions у karaoke), передається як є
  // для групування на студентській сторінці.
  rows: { id: string; left: string | null; right: string | null; points: number; partOfSpeech?: PartOfSpeech | null }[]; // null = прихована клітинка
  // Лише для тексту-пояснення (hint-explanation.tsx) — сама знижка
  // рахується на сервері.
  hintsReducePoints: boolean;
};

export type CheckboxGridPublic = {
  instructions?: string;
  subInstructions?: string;
  columns: CheckboxGridColumn[];
  rows: { id: string; label: string; points: number }[]; // correctColumnIds прихований
};

export type ImageMatchPublic = {
  instructions?: string;
  subInstructions?: string;
  items: { id: string; imageUrl: string; points: number }[];
  bank: string[]; // перемішані name з усіх items
};

export type ChronologicalOrderPublic = {
  instructions?: string;
  subInstructions?: string;
  mode: "image" | "text" | "mixed";
  // Перемішано (shuffle) — буква-мітка (A, B, C...) рахується на боці
  // студента з індексу в цьому вже перемішаному масиві, не зберігається тут.
  items: { id: string; content: string; text?: string; points: number }[];
};

// tokens — маска (null на позиціях пропуску), той самий принцип, що
// LetterGapsPublicWord.chars: не word+hiddenIndices, бо це віддало б
// студенту прихований токен прямо з конфігу. gapOptions — лише для
// answerMode "choice": на кожен пропуск рядка (за порядком зліва направо,
// паралельно до "дірок" у tokens) — варіанти для вибору (правильний +
// відволікачі з інших пропусків цієї ж пісні, перемішані, sanitize.ts) —
// відсутнє для "typing".
export type KaraokePublicLine = {
  start: number;
  // Не відповідь (на відміну від tokens) — передається студенту як є, для
  // точного моменту паузи-на-пропуску, karaoke.tsx.
  end?: number;
  tokens: (string | null)[];
  gapOptions?: string[][];
};
export type KaraokePublic = {
  instructions?: string;
  subInstructions?: string;
  videoUrl: string;
  answerMode: "choice" | "typing";
  pauseOnGap: boolean;
  pointsPerGap: number;
  lines: KaraokePublicLine[];
};

// Відповідь студента для кожного типу.

// answers — по одному рядку на пропуск, за порядком (як і раніше).
// hintedBlanks — індекси пропусків (0-based, той самий порядок), де брали
// підказку "перша літера" — "елемент" для балів/позначки "з підказкою" тут
// САМЕ пропуск (кнопка підказки в попапі — на конкретне активне поле).
export type FillBlankAnswer = { answers: string[]; hintedBlanks: number[] };
// letters — зовнішній масив по слову, у порядку config.words; внутрішній —
// по одній літері на кожну приховану позицію, зліва направо. hintedWordIndices
// — індекси слів (той самий порядок), де студент бодай раз натиснув
// лампочку-підказку — "елемент" для балів/позначки "з підказкою" тут САМЕ
// слово (кнопка підказки одна на всю картку слова, не на окрему літеру).
export type LetterGapsAnswer = {
  letters: string[][];
  hintedWordIndices: number[];
};
// Той самий принцип, що LetterGapsAnswer — words: поточне (переставлене
// студентом) розташування ВСІХ літер слова (не лише прихованих, тут таких
// нема), за індексом слова, не id; hintedWordIndices — той самий сенс.
export type LetterRearrangementAnswer = {
  words: string[][];
  hintedWordIndices: number[];
};
export type MultipleChoiceAnswer = { itemId: string; selected: string[] }[]; // вибрані option.id на кожне речення
// Множина optionId на речення (не одне значення) — підтримує кілька
// правильних варіантів, незалежно від mode (select/cross_out); студентський
// компонент сам зводить обидва режими до цієї форми перед сабмітом (у
// cross_out — усе, що лишилось незакресленим).
export type WordChoiceAnswer = { sentenceId: string; selected: string[] }[];
// Сирі координати клітинок, які студент виділив на кожне ЗНАЙДЕНЕ (на його
// думку) слово — не клієнтський вердикт "знайдено/ні". Слова, яких студент
// не знайшов, просто відсутні в масиві. Сервер (gradeWordSearch) сам звіряє
// координати з placements — той самий принцип, що всюди в grade.ts
// (ніколи не довіряти клієнтському boolean).
// found — той самий формат, що раніше (масив, лише СЛОВА, які студент
// фізично виділив і вони збіглись клієнтським фідбеком); hintedWords —
// слова, для яких клікали лампочку-підказку в легенді (блимання першої
// літери, word-search.tsx) — підказка НЕ позначає слово знайденим сама по
// собі, лише інформує, студент і далі мусить виділити його вручну.
// blockIndex — відсутнє (undefined) означає "перевірити ВСЮ вправу" (усі
// блоки разом, той самий результат, що й до появи блоків, для вправи з
// ОДНИМ блоком — тотожний); присутнє — перевіряється ЛИШЕ склад САМЕ цього
// блоку (config визначає склад за block.wordKeys/placements, не сама
// відповідь — слово блоку, якого немає у found, зараховується
// неправильним і лишається в знаменнику, той самий принцип, що вже
// підтверджений для table_fill/letter_gaps). Етап 3 (студентський UI з
// BlockNavigation) надсилатиме його з активного блоку; без етапу 3 поле
// просто не передається, і поведінка лишається точно тією, що й раніше.
export type WordSearchAnswer = {
  found: { word: string; cells: { row: number; col: number }[] }[];
  hintedWords: string[];
  blockIndex?: number;
};
// Єдина 2D-мапа клітинка→літера (row-major, ті самі виміри, що gridWidth×
// gridHeight) — НЕ по слову, як LetterGapsAnswer: клітинки спільні між
// словами, що перетинаються, тож ввід в одну клітинку одразу впливає на
// обидва слова. Порожній рядок "" — клітинка ще не заповнена (або
// заблокована, звідти студент і не міг нічого ввести).
// grid — той самий формат, що раніше; hintedWords — слова (за number+
// direction, однозначний ідентифікатор — той самий принцип, що
// CrosswordDetail.words), у яких натискали лампочку-підказку хоч раз.
// blockIndex — той самий сенс, що WordSearchAnswer.blockIndex вище.
export type CrosswordAnswer = {
  grid: string[][];
  hintedWords: { number: number; direction: "horizontal" | "vertical" }[];
  blockIndex?: number;
};
export type TrueFalseAnswer = { id: string; value: boolean }[];
export type MatchingAnswer = { left: string; right: string }[];
export type ListeningAnswer = { questionId: string; optionId: string }[];
export type ReorderAnswer = { sequenceId: string; order: string[] }[]; // порядок на кожну послідовність
// hintedWords — ЛОКАЛЬНІ (у межах цього речення) індекси пропусків, де
// брали підказку-переклад — той самий принцип, що FillBlankAnswer.hintedBlanks.
export type DragDropAnswer = { sentenceId: string; words: string[]; hintedWords?: number[] }[]; // слова на кожен пропуск, за реченням
// hintUsed — той самий сенс, що OpenAnswerAnswer.hintUsed: студентка клікала
// лампочку для цього елемента (sort-columns-hint/route.ts).
export type SortColumnsAnswer = { itemId: string; columnId: string; hintUsed?: boolean }[];
export type OpenAnswerAnswer = { questionId: string; value: string; hintUsed?: boolean }[];
// cells — той самий плаский список, що раніше (тепер поле обʼєкта).
// hintedCells — клітинки (rowId+side), де брали підказку "перша літера" —
// "елемент" для балів тут — РЯДОК (як points), клітинка лише позначає, що
// підказку брали хоч для однієї з його прихованих клітинок (gradeTableFill).
export type TableFillAnswer = {
  cells: { rowId: string; side: "left" | "right"; value: string }[];
  hintedCells: { rowId: string; side: "left" | "right" }[];
};
export type CheckboxGridAnswer = { rowId: string; columnIds: string[] }[]; // позначені колонки на кожен рядок
export type ImageMatchAnswer = { itemId: string; name: string }[];
export type ChronologicalOrderAnswer = { itemId: string; position: number }[];
// Рядок -> k-й пропуск у цьому рядку (за порядком зліва направо) -> текст
// відповіді студента (уведений з клавіатури або обраний варіант — просте
// string в обох режимах), той самий шейп, що LetterGapsAnswer.
export type KaraokeAnswer = string[][];

// Детальний результат перевірки — саме він показує "де помилка".

export type FillBlankDetail = {
  blanks: { studentAnswer: string; correctAnswers: string[]; isCorrect: boolean; hintUsed: boolean }[];
};

// hintUsed — чи натискали лампочку-підказку на цьому слові (незалежно від
// isCorrect: підказка могла заповнити не всі позиції) — для позначки "з
// підказкою" в студентському рендері й для info, чи застосовано 50%-знижку
// балів (сама знижка — окремо, у пораховних pointsEarned).
export type LetterGapsDetail = {
  words: { studentLetters: string[]; correctLetters: string[]; isCorrect: boolean; hintUsed: boolean }[];
};

// letters[i].correctIndex === i завжди (масив побудований по позиції, як
// ReorderDetail.items) — SortableTileRow індексує напряму, без пошуку.
// hintUsed — той самий сенс, що LetterGapsDetail.
export type LetterRearrangementDetail = {
  words: {
    letters: { text: string; correctIndex: number; isCorrect: boolean }[];
    isCorrect: boolean;
    hintUsed: boolean;
  }[];
};

export type MultipleChoiceDetail = {
  items: {
    id: string;
    options: { id: string; text: string; correct: boolean; selected: boolean }[];
    points: number;
  }[];
};

// Без points на речення (points — на всю вправу, WordChoiceConfig.points) —
// isCorrect тут лише для score (per-речення відсоток) і підсвітки, не для
// заліку балів.
export type WordChoiceDetail = {
  sentences: {
    id: string;
    options: { id: string; text: string; correct: boolean; selected: boolean }[];
    isCorrect: boolean;
  }[];
};

// points — на кожне слово (не на всю вправу), як ReorderDetail.
// points тут НЕ на слово (points — на всю вправу, WordSearchConfig.points)
// — found лише для візуального фідбека/закреслення в легенді, не для
// заліку балів.
// hintUsed — той самий сенс, що LetterGapsDetail.
// blockIndex — ехо WordSearchAnswer.blockIndex (той самий, що прийшов у
// запиті) — лише для клієнта (word-search.tsx, етап 3) розрізнити, якому
// блоку належить цей результат; відсутнє — результат за всю вправу.
export type WordSearchDetail = {
  words: { word: string; found: boolean; hintUsed: boolean }[];
  blockIndex?: number;
};

// per-слово (не per-клітинка) — той самий рівень деталізації, що
// WordSearchDetail: isCorrect лише для score/підсвітки підказки в списку,
// не для заліку балів (points — на всю вправу, CrosswordConfig.points).
// number+direction ідентифікують слово однозначно (пара може повторюватись
// лише в межах одного напрямку, номер унікальний у своєму напрямку).
// blockIndex — той самий сенс, що WordSearchDetail.blockIndex вище.
export type CrosswordDetail = {
  words: {
    number: number;
    direction: "horizontal" | "vertical";
    word: string;
    isCorrect: boolean;
    hintUsed: boolean;
  }[];
  blockIndex?: number;
};

export type TrueFalseDetail = {
  statements: {
    id: string;
    text: string;
    correctAnswer: boolean;
    studentAnswer: boolean | null;
    isCorrect: boolean;
    points: number;
  }[];
};

export type MatchingDetail = {
  correctPairs: MatchingPair[];
  studentPairs: { left: string; right: string; isCorrect: boolean }[];
  // ДОДАТКОВЕ поле лише для підрахунку/показу балів — незалежне від
  // correctPairs/studentPairs вище (їх рендер не змінюється).
  pairPoints: { id: string; left: string; points: number; isCorrect: boolean }[];
};

export type ListeningDetail = {
  questions: {
    id: string;
    question: string;
    options: { id: string; text: string; correct: boolean; selected: boolean }[];
    points: number;
  }[];
};

export type ReorderDetail = {
  sequences: {
    id: string;
    items: { text: string; correctIndex: number; studentIndex: number; isCorrect: boolean }[];
    points: number;
  }[];
};

// drag_drop — по суті fill_blank з одним варіантом на пропуск і словами з
// фіксованого банку замість вільного вводу (звідси й перевикористання
// gradeFillBlank у grade.ts, по одному разу на речення), але з кількома
// реченнями форма деталізації вже не та сама пласка, що FillBlankDetail.
export type DragDropDetail = {
  sentences: {
    id: string;
    // hintUsed — той самий сенс, що FillBlankDetail.blanks (підказка-переклад).
    blanks: { studentAnswer: string; correctAnswers: string[]; isCorrect: boolean; hintUsed: boolean }[];
    points: number;
  }[];
};

export type SortColumnsDetail = {
  items: {
    id: string;
    text: string;
    correctColumnId: string;
    correctColumnLabel: string;
    studentColumnId: string | null;
    isCorrect: boolean;
    points: number;
    // Той самий сенс, що DragDropDetail.blanks.hintUsed — лампочка
    // підказала колонку (sort-columns-hint/route.ts) для цього елемента.
    hintUsed: boolean;
  }[];
};

export type OpenAnswerDetail = {
  questions: {
    id: string;
    question: string;
    studentAnswer: string;
    correctAnswers: string[];
    isCorrect: boolean;
    points: number;
    hintUsed: boolean;
  }[];
};

export type TableFillDetail = {
  blanks: {
    rowId: string;
    side: "left" | "right";
    studentAnswer: string;
    correctAnswers: string[];
    isCorrect: boolean;
    points: number; // однакове для обох клітинок одного рядка — бали на рядок, не на клітинку
    hintUsed: boolean;
  }[];
};

// Плаский список cells (по одному на кожну клітинку рядок×колонка) — той
// самий принцип, що TableFillDetail.blanks. isCorrect === (studentChecked
// === correctChecked): і хибний позитив (позначив зайве), і хибний
// негатив (не позначив потрібне) — обидва неправильні.
export type CheckboxGridDetail = {
  cells: {
    rowId: string;
    columnId: string;
    studentChecked: boolean;
    correctChecked: boolean;
    isCorrect: boolean;
    points: number; // однакове для всіх клітинок одного рядка — бали на рядок, не на клітинку
  }[];
};

export type ImageMatchDetail = {
  items: {
    id: string;
    imageUrl: string;
    correctName: string;
    studentName: string;
    isCorrect: boolean;
    points: number;
  }[];
};

export type ChronologicalOrderDetail = {
  items: {
    id: string;
    content: string;
    correctPosition: number;
    studentPosition: number | null;
    isCorrect: boolean;
    points: number;
  }[];
};

// text — рядок ІЗ ПРОПУСКАМИ, показаними як "___" (для контексту в "Роботі
// над помилками" — там задача рендериться поза власним студентським
// компонентом, самих tokens/gapTokenIndices під рукою нема). points — на
// кожен пропуск (не на рядок і не на всю вправу) — часткові бали,
// підсумовуються, той самий принцип, що ImageMatchDetail/ChronologicalOrderDetail.
export type KaraokeDetail = {
  lines: {
    text: string;
    gaps: { studentAnswer: string; correctAnswer: string; isCorrect: boolean; points: number }[];
  }[];
};

// pointsEarned/pointsPossible — опційний шар балів ПОРЯД зі score (не
// заміна): score/percentage лишається джерелом правди для прогресу/
// pass-fail (напр. DelfTestGrid уже рахує pass/fail як middle 0-100 score),
// points — лише для показу студенту. Спільні на весь union, щоб додавання
// підтримки балів для наступного типу не вимагало знову чіпати цей тип —
// поки що їх заповнює лише gradeTrueFalse (пілот), решта лишають undefined.
// totalPointsPossible — ЗАВЖДИ повний pointsPossible вправи (а не блоку/
// скоупу відповіді, на відміну від pointsPossible вище) — лише для типів із
// підтримкою поблочної перевірки (word_search/crossword/matching/
// table_fill/letter_gaps/letter_rearrangement, grade.ts), де сервер мусить
// знати знаменник ВСІЄЇ вправи, щоб коректно підсумувати прогрес кількох
// окремих запитів на блок (progress.ts/record_block_task_attempt). undefined
// для решти типів — сигнал route.ts, що тип не поблочний.
export type GradeResult =
  | { correct: boolean; score: number; detail: FillBlankDetail; pointsEarned?: number; pointsPossible?: number; totalPointsPossible?: number }
  | { correct: boolean; score: number; detail: LetterGapsDetail; pointsEarned?: number; pointsPossible?: number; totalPointsPossible?: number }
  | { correct: boolean; score: number; detail: LetterRearrangementDetail; pointsEarned?: number; pointsPossible?: number; totalPointsPossible?: number }
  | { correct: boolean; score: number; detail: MultipleChoiceDetail; pointsEarned?: number; pointsPossible?: number; totalPointsPossible?: number }
  | { correct: boolean; score: number; detail: WordChoiceDetail; pointsEarned?: number; pointsPossible?: number; totalPointsPossible?: number }
  | { correct: boolean; score: number; detail: WordSearchDetail; pointsEarned?: number; pointsPossible?: number; totalPointsPossible?: number }
  | { correct: boolean; score: number; detail: CrosswordDetail; pointsEarned?: number; pointsPossible?: number; totalPointsPossible?: number }
  | { correct: boolean; score: number; detail: TrueFalseDetail; pointsEarned?: number; pointsPossible?: number; totalPointsPossible?: number }
  | { correct: boolean; score: number; detail: MatchingDetail; pointsEarned?: number; pointsPossible?: number; totalPointsPossible?: number }
  | { correct: boolean; score: number; detail: ListeningDetail; pointsEarned?: number; pointsPossible?: number; totalPointsPossible?: number }
  | { correct: boolean; score: number; detail: ReorderDetail; pointsEarned?: number; pointsPossible?: number; totalPointsPossible?: number }
  | { correct: boolean; score: number; detail: DragDropDetail; pointsEarned?: number; pointsPossible?: number; totalPointsPossible?: number }
  | { correct: boolean; score: number; detail: SortColumnsDetail; pointsEarned?: number; pointsPossible?: number; totalPointsPossible?: number }
  | { correct: boolean; score: number; detail: OpenAnswerDetail; pointsEarned?: number; pointsPossible?: number; totalPointsPossible?: number }
  | { correct: boolean; score: number; detail: TableFillDetail; pointsEarned?: number; pointsPossible?: number; totalPointsPossible?: number }
  | { correct: boolean; score: number; detail: ImageMatchDetail; pointsEarned?: number; pointsPossible?: number; totalPointsPossible?: number }
  | { correct: boolean; score: number; detail: CheckboxGridDetail; pointsEarned?: number; pointsPossible?: number; totalPointsPossible?: number }
  | { correct: boolean; score: number; detail: ChronologicalOrderDetail; pointsEarned?: number; pointsPossible?: number; totalPointsPossible?: number }
  | { correct: boolean; score: number; detail: KaraokeDetail; pointsEarned?: number; pointsPossible?: number; totalPointsPossible?: number };
