// Єдине джерело правди для категорій типів завдань і їхніх кольорів —
// використовується і в TaskDragList (смужка зліва на рядку), і в
// task-config-fields.tsx (бейдж біля вибору типу), і згодом у Stage 4
// (кастомний searchable combobox типів) та Stage 3 (іконки).
//
// Кольори підібрані так, щоб НЕ перетинатись із уже вживаною семантикою
// зелений/червоний = правильно/неправильно (у вправах) і синій = обрано/hover
// (SELECTED_OPTION_CLASS) — див. src/components/exercises/selection-style.ts.
// Синій тут використовується в іншому контексті (статична категорійна
// позначка на списку, а не інтерактивний стан), тож конфлікту немає.
//
// Класи прописані ПОВНИМИ ЛІТЕРАЛЬНИМИ рядками (а не зібрані з `color`
// напряму в className), бо Tailwind сканує вихідний код на предмет точних
// рядків класів — динамічно побудований `bg-${color}-100` просто не
// потрапив би у фінальний CSS.
export type TaskTypeCategory = "auto_graded" | "reference" | "delf" | "media";

export const CATEGORY_LABELS: Record<TaskTypeCategory, string> = {
  auto_graded: "Автоперевірка",
  reference: "Довідкові",
  delf: "DELF",
  media: "Медіа/посилання",
};

export const CATEGORY_COLORS: Record<
  TaskTypeCategory,
  { stripe: string; badge: string; dot: string }
> = {
  // border-l-{color} (не border-{color}) навмисно — щоб перефарбувати ЛИШЕ
  // ліву смужку, а не всі 4 сторони поверх наявного className="border" на
  // картці (border задає колір з дефолтної теми на решті сторін).
  auto_graded: {
    stripe: "border-l-4 border-l-blue-500",
    badge: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
    dot: "bg-blue-500",
  },
  reference: {
    stripe: "border-l-4 border-l-violet-500",
    badge: "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300",
    dot: "bg-violet-500",
  },
  delf: {
    stripe: "border-l-4 border-l-amber-500",
    badge: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
    dot: "bg-amber-500",
  },
  media: {
    stripe: "border-l-4 border-l-teal-500",
    badge: "bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300",
    dot: "bg-teal-500",
  },
};

// ai_examiner — у DB-обмеженні є, у TYPE_OPTIONS (вибір типу) поки немає,
// але додана тут заздалегідь, щоб не забути, коли/якщо стане вибірною.
export const TASK_TYPE_CATEGORY: Record<string, TaskTypeCategory> = {
  fill_blank: "auto_graded",
  multiple_choice: "auto_graded",
  true_false: "auto_graded",
  matching: "auto_graded",
  reorder: "auto_graded",
  drag_drop: "auto_graded",
  sort_columns: "auto_graded",
  table_fill: "auto_graded",
  image_match: "auto_graded",
  checkbox_grid: "auto_graded",
  vocab_quiz: "auto_graded",
  open_answer: "auto_graded",
  callout: "reference",
  phonetics: "reference",
  flip_cards: "reference",
  essay_check: "delf",
  ai_examiner: "delf",
  game: "media",
  link: "media",
  embed: "media",
  listening: "media",
  error_correction: "media",
};

export function getTaskTypeCategory(type: string): TaskTypeCategory | null {
  return TASK_TYPE_CATEGORY[type] ?? null;
}

// Іконка на ТИП (не на категорію, на відміну від кольорів вище) — усі назви
// перевірені напряму в node_modules/lucide-react/dist/lucide-react.d.ts
// (кілька очікуваних імен виявились перейменованими бібліотекою: HelpCircle
// -> CircleQuestionMark, AlertCircle -> CircleAlert, Code2 -> CodeXml).
import {
  PenLine,
  ListChecks,
  SquareCheck,
  ArrowLeftRight,
  ArrowUpDown,
  Move,
  Columns3,
  Table,
  Table2,
  Images,
  CircleQuestionMark,
  MessageSquare,
  Info,
  Volume2,
  Layers,
  FileText,
  Sparkles,
  Gamepad2,
  Link2,
  CodeXml,
  Headphones,
  CircleAlert,
  type LucideIcon,
} from "lucide-react";

export const TASK_TYPE_ICON: Record<string, LucideIcon> = {
  fill_blank: PenLine,
  multiple_choice: ListChecks,
  true_false: SquareCheck,
  matching: ArrowLeftRight,
  reorder: ArrowUpDown,
  drag_drop: Move,
  sort_columns: Columns3,
  table_fill: Table,
  image_match: Images,
  checkbox_grid: Table2,
  vocab_quiz: CircleQuestionMark,
  open_answer: MessageSquare,
  callout: Info,
  phonetics: Volume2,
  flip_cards: Layers,
  essay_check: FileText,
  ai_examiner: Sparkles,
  game: Gamepad2,
  link: Link2,
  embed: CodeXml,
  listening: Headphones,
  error_correction: CircleAlert,
};

export function getTaskTypeIcon(type: string): LucideIcon | null {
  return TASK_TYPE_ICON[type] ?? null;
}
