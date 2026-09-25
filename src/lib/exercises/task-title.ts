import { TASK_TYPE_LABELS } from "./task-type-meta";

// "<Назва типу>: <перші 3 елементи через кому>…" — максимум ~60 символів
// сумарно (з назвою типу), щоб влазило в один рядок списку задач/вибору
// блоку. Використовується і на сервері (tasks/actions.ts, при збереженні),
// і на клієнті (task-config-fields.tsx, живий прев'ю в полі "Назва") —
// звідси єдиний файл без "use server"/"use client".
const MAX_TITLE_LENGTH = 60;
const MAX_PREVIEW_ITEMS = 3;

function parseJsonArray(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (typeof value !== "string") return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

// Прибирає HTML-теги (той самий принцип, що isBlankHtml, html-text.ts —
// проста заміна тегів, без DOM-парсера) і маркери пропусків "{{вар1|вар2}}"
// (fill_blank/multiple_choice/word_choice/drag_drop) — замінені на "___",
// щоб структура речення лишалась читаною, а не сирим "{{...}}" синтаксисом.
function clean(value: unknown): string {
  if (typeof value !== "string") return "";
  return value
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/\{\{[^}]*\}\}/g, "___")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanList(values: unknown[], pick: (item: unknown) => unknown): string[] {
  return values.map((item) => clean(pick(item))).filter((text) => text.length > 0);
}

// Перші кілька змістовних елементів вправи, типоспецифічно — джерело для
// кожного типу підібране окремо (те, що найкоротше показує СУТЬ вправи):
// слова для типів "робота зі словом", ліва частина пари/рядка для
// зіставлення/таблиці, перше речення (без маркерів) для типів із шаблоном
// пропуску, перше питання/твердження для decision-based типів. Порожній
// масив — легітимний результат (немає що показати, крім назви типу), не
// помилка: vocab_quiz (лексика лежить у сценах, не в config), error_correction
// (без структурованого config) — завжди порожньо, за задумом.
function getPreviewElements(type: string, config: Record<string, unknown>): string[] {
  switch (type) {
    case "letter_gaps":
    case "letter_rearrangement":
    case "word_search":
    case "crossword":
      return cleanList(parseJsonArray(config.words), (w) => (w as { word?: string })?.word);
    case "flip_cards":
      return cleanList(parseJsonArray(config.cards), (c) => (c as { front?: string })?.front);
    case "matching":
      return cleanList(parseJsonArray(config.pairs), (p) => (p as { left?: string })?.left);
    case "table_fill":
      return cleanList(parseJsonArray(config.rows), (r) => (r as { left?: string })?.left);
    case "fill_blank":
      return [clean(config.template)].filter((t) => t.length > 0);
    case "multiple_choice":
      return cleanList(parseJsonArray(config.items), (i) => (i as { sentence?: string })?.sentence);
    case "word_choice":
      return cleanList(parseJsonArray(config.sentences), (s) => (s as { sentence?: string })?.sentence);
    case "drag_drop": {
      const sentences = parseJsonArray(config.sentences);
      if (sentences.length > 0) {
        return cleanList(sentences, (s) => (s as { template?: string })?.template);
      }
      return cleanList(parseJsonArray(config.bank), (word) => word);
    }
    case "listening":
    case "open_answer":
      return cleanList(parseJsonArray(config.questions), (q) => (q as { question?: string })?.question);
    case "true_false":
      return cleanList(parseJsonArray(config.statements), (s) => (s as { text?: string })?.text);
    case "reorder": {
      const sequences = parseJsonArray(config.sequences) as { items?: string[] }[];
      return cleanList(sequences[0]?.items ?? [], (item) => item);
    }
    case "chronological_order":
      return cleanList(parseJsonArray(config.items), (i) => (i as { content?: string })?.content);
    case "sort_columns":
      return cleanList(parseJsonArray(config.items), (i) => (i as { text?: string })?.text);
    case "checkbox_grid":
      return cleanList(parseJsonArray(config.rows), (r) => (r as { label?: string })?.label);
    case "image_match":
      return cleanList(parseJsonArray(config.items), (i) => (i as { name?: string })?.name);
    case "phonetics":
      return cleanList(parseJsonArray(config.items), (i) => (i as { text?: string })?.text);
    case "essay_check":
      return [clean(config.prompt)].filter((t) => t.length > 0);
    case "callout":
      return [clean(config.content)].filter((t) => t.length > 0);
    // vocab_quiz — лексика лежить у сценах (sceneIds — лише посилання, без
    // тексту в самому config); error_correction — без структурованого
    // config узагалі. Обидва навмисно завжди "лише назва типу".
    case "vocab_quiz":
    case "error_correction":
      return [];
    default:
      return [];
  }
}

// Автоназва вправи з типу й перших елементів конфігурації — викликається і
// при збереженні (tasks/actions.ts, коли назва порожня чи ще дорівнює
// попередній автоназві), і для живого прев'ю в полі "Назва"
// (task-config-fields.tsx). Для типів, чия назва видима студенту
// (TASK_TYPES_WITH_VISIBLE_TITLE — link/embed/game), не викликається
// (виклик пропускається на рівні actions.ts) — там назва лишається ручною.
export function generateTaskTitle(type: string, config: Record<string, unknown> | null | undefined): string {
  const typeLabel = TASK_TYPE_LABELS[type] ?? type;
  const elements = getPreviewElements(type, config ?? {});
  if (elements.length === 0) return typeLabel;

  const preview = elements.slice(0, MAX_PREVIEW_ITEMS).join(", ");
  const hasMore = elements.length > MAX_PREVIEW_ITEMS;
  const full = `${typeLabel}: ${preview}`;

  if (full.length <= MAX_TITLE_LENGTH) {
    return hasMore ? `${full}…` : full;
  }
  return `${full.slice(0, MAX_TITLE_LENGTH - 1).trimEnd()}…`;
}

// Клієнтський "псевдо-config" з живих значень форми — та сама розкладка
// formData-полів по ключах config, що buildConfig (tasks/actions.ts,
// сервер), але звужена ЛИШЕ до полів, які getPreviewElements вище реально
// читає (без sanitizeInstructionsHtml/зайвих полів — для живого прев'ю
// назви це не потрібно, clean() у цьому файлі й так прибирає HTML/маркери).
// Навмисний дубль імен полів, не імпорт buildConfig — той живе у файлі
// "use server" (tasks/actions.ts), звідти в клієнтський компонент
// імпортувати не можна.
export function buildTitlePreviewConfig(type: string, formData: FormData): Record<string, unknown> {
  const get = (name: string) => (formData.get(name) as string) || "";
  switch (type) {
    case "letter_gaps":
      return { words: parseJsonArray(get("letter_gaps_words")) };
    case "letter_rearrangement":
      return { words: parseJsonArray(get("letter_rearrangement_words")) };
    case "word_search":
      return { words: parseJsonArray(get("word_search_words")) };
    case "crossword":
      return { words: parseJsonArray(get("crossword_words")) };
    case "flip_cards":
      return { cards: parseJsonArray(get("flip_cards_cards")) };
    case "matching":
      return { pairs: parseJsonArray(get("matching_pairs")) };
    case "table_fill":
      return { rows: parseJsonArray(get("table_fill_rows")) };
    case "fill_blank":
      return { template: get("fill_blank_template") };
    case "multiple_choice":
      return { items: parseJsonArray(get("mc_items")) };
    case "word_choice":
      return { sentences: parseJsonArray(get("word_choice_sentences")) };
    case "drag_drop":
      return {
        sentences: parseJsonArray(get("drag_drop_sentences")),
        bank: parseJsonArray(get("drag_drop_bank")),
      };
    case "listening":
      return { questions: parseJsonArray(get("listening_questions")) };
    case "open_answer":
      return { questions: parseJsonArray(get("open_answer_questions")) };
    case "true_false":
      return { statements: parseJsonArray(get("tf_statements")) };
    case "reorder":
      return { sequences: parseJsonArray(get("reorder_sequences")) };
    case "chronological_order":
      return { items: parseJsonArray(get("chronological_order_items")) };
    case "sort_columns":
      return { items: parseJsonArray(get("sort_columns_items")) };
    case "checkbox_grid":
      return { rows: parseJsonArray(get("checkbox_grid_rows")) };
    case "image_match":
      return { items: parseJsonArray(get("image_match_items")) };
    case "phonetics":
      return { items: parseJsonArray(get("phonetics_items")) };
    case "essay_check":
      return { prompt: get("prompt") };
    case "callout":
      return { content: get("callout_content") };
    default:
      return {};
  }
}
