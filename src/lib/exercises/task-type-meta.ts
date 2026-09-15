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
  { stripe: string; badge: string; dot: string; iconBorder: string; iconText: string; shadow: string }
> = {
  // border-l-{color} (не border-{color}) навмисно — щоб перефарбувати ЛИШЕ
  // ліву смужку, а не всі 4 сторони поверх наявного className="border" на
  // картці (border задає колір з дефолтної теми на решті сторін).
  // iconBorder/iconText — те саме кільце TaskTypeIconBadge, тепер за
  // категорією, а не завжди indigo; shadow — легка кольорова тінь на
  // рядку задачі (з shadow-sm), той самий тон, що й badge/stripe.
  auto_graded: {
    stripe: "border-l-4 border-l-blue-500",
    badge: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
    dot: "bg-blue-500",
    iconBorder: "border-blue-500",
    iconText: "text-blue-500",
    shadow: "shadow-blue-100/50",
  },
  reference: {
    stripe: "border-l-4 border-l-violet-500",
    badge: "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300",
    dot: "bg-violet-500",
    iconBorder: "border-violet-500",
    iconText: "text-violet-500",
    shadow: "shadow-violet-100/50",
  },
  delf: {
    stripe: "border-l-4 border-l-amber-500",
    badge: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
    dot: "bg-amber-500",
    iconBorder: "border-amber-500",
    iconText: "text-amber-500",
    shadow: "shadow-amber-100/50",
  },
  media: {
    stripe: "border-l-4 border-l-teal-500",
    badge: "bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300",
    dot: "bg-teal-500",
    iconBorder: "border-teal-500",
    iconText: "text-teal-500",
    shadow: "shadow-teal-100/50",
  },
};

// Колір НА КОЖЕН ТИП окремо (не на категорію, як CATEGORY_COLORS вище) —
// щоб типи в межах однієї категорії (13 у auto_graded) не зливались в один
// колір. CATEGORY_COLORS/CATEGORY_LABELS/TASK_TYPE_CATEGORY лишаються без
// змін — текстовий бейдж категорії й групування й далі на них, тут лише
// джерело кольору для іконки/смужки/бейджа/тіні/крапки скрізь по адмінці.
//
// Межа палітри: 23 типи, а придатних кольорових родин Tailwind (без red —
// зайнятий під видалення/небезпеку по всій адмінці, і без green/emerald
// поруч із тими самими типами, де є "правильна відповідь" підсвітка тим
// самим кольором) — 16. 7 типів неминуче ділять колір із іншим —
// підібрані так, щоб пари були з РІЗНИХ категорій і рідко траплялись
// поруч в одному списку (детальний список пар — у плані заходу).
export const TASK_TYPE_COLORS: Record<
  string,
  { stripe: string; badge: string; dot: string; iconBorder: string; iconText: string; shadow: string }
> = {
  fill_blank: {
    stripe: "border-l-4 border-l-blue-500",
    badge: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
    dot: "bg-blue-500",
    iconBorder: "border-blue-500",
    iconText: "text-blue-500",
    shadow: "shadow-blue-100/50",
  },
  multiple_choice: {
    stripe: "border-l-4 border-l-indigo-500",
    badge: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300",
    dot: "bg-indigo-500",
    iconBorder: "border-indigo-500",
    iconText: "text-indigo-500",
    shadow: "shadow-indigo-100/50",
  },
  true_false: {
    stripe: "border-l-4 border-l-sky-500",
    badge: "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300",
    dot: "bg-sky-500",
    iconBorder: "border-sky-500",
    iconText: "text-sky-500",
    shadow: "shadow-sky-100/50",
  },
  matching: {
    stripe: "border-l-4 border-l-violet-500",
    badge: "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300",
    dot: "bg-violet-500",
    iconBorder: "border-violet-500",
    iconText: "text-violet-500",
    shadow: "shadow-violet-100/50",
  },
  reorder: {
    stripe: "border-l-4 border-l-purple-500",
    badge: "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300",
    dot: "bg-purple-500",
    iconBorder: "border-purple-500",
    iconText: "text-purple-500",
    shadow: "shadow-purple-100/50",
  },
  drag_drop: {
    stripe: "border-l-4 border-l-fuchsia-500",
    badge: "bg-fuchsia-100 text-fuchsia-700 dark:bg-fuchsia-900/40 dark:text-fuchsia-300",
    dot: "bg-fuchsia-500",
    iconBorder: "border-fuchsia-500",
    iconText: "text-fuchsia-500",
    shadow: "shadow-fuchsia-100/50",
  },
  sort_columns: {
    stripe: "border-l-4 border-l-pink-500",
    badge: "bg-pink-100 text-pink-700 dark:bg-pink-900/40 dark:text-pink-300",
    dot: "bg-pink-500",
    iconBorder: "border-pink-500",
    iconText: "text-pink-500",
    shadow: "shadow-pink-100/50",
  },
  table_fill: {
    stripe: "border-l-4 border-l-rose-500",
    badge: "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300",
    dot: "bg-rose-500",
    iconBorder: "border-rose-500",
    iconText: "text-rose-500",
    shadow: "shadow-rose-100/50",
  },
  image_match: {
    stripe: "border-l-4 border-l-cyan-500",
    badge: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300",
    dot: "bg-cyan-500",
    iconBorder: "border-cyan-500",
    iconText: "text-cyan-500",
    shadow: "shadow-cyan-100/50",
  },
  checkbox_grid: {
    stripe: "border-l-4 border-l-teal-500",
    badge: "bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300",
    dot: "bg-teal-500",
    iconBorder: "border-teal-500",
    iconText: "text-teal-500",
    shadow: "shadow-teal-100/50",
  },
  chronological_order: {
    stripe: "border-l-4 border-l-amber-500",
    badge: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
    dot: "bg-amber-500",
    iconBorder: "border-amber-500",
    iconText: "text-amber-500",
    shadow: "shadow-amber-100/50",
  },
  vocab_quiz: {
    stripe: "border-l-4 border-l-yellow-500",
    badge: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300",
    dot: "bg-yellow-500",
    iconBorder: "border-yellow-500",
    iconText: "text-yellow-500",
    shadow: "shadow-yellow-100/50",
  },
  open_answer: {
    stripe: "border-l-4 border-l-orange-500",
    badge: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300",
    dot: "bg-orange-500",
    iconBorder: "border-orange-500",
    iconText: "text-orange-500",
    shadow: "shadow-orange-100/50",
  },
  callout: {
    stripe: "border-l-4 border-l-lime-500",
    badge: "bg-lime-100 text-lime-700 dark:bg-lime-900/40 dark:text-lime-300",
    dot: "bg-lime-500",
    iconBorder: "border-lime-500",
    iconText: "text-lime-500",
    shadow: "shadow-lime-100/50",
  },
  phonetics: {
    stripe: "border-l-4 border-l-green-500",
    badge: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
    dot: "bg-green-500",
    iconBorder: "border-green-500",
    iconText: "text-green-500",
    shadow: "shadow-green-100/50",
  },
  flip_cards: {
    stripe: "border-l-4 border-l-emerald-500",
    badge: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
    dot: "bg-emerald-500",
    iconBorder: "border-emerald-500",
    iconText: "text-emerald-500",
    shadow: "shadow-emerald-100/50",
  },
  // essay_check ділить колір з fill_blank (DELF-тести й звичайні сцени
  // рідко змішуються в одному списку).
  essay_check: {
    stripe: "border-l-4 border-l-blue-500",
    badge: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
    dot: "bg-blue-500",
    iconBorder: "border-blue-500",
    iconText: "text-blue-500",
    shadow: "shadow-blue-100/50",
  },
  // ai_examiner ділить колір з multiple_choice — рідкісний тип, ще не в
  // TYPE_OPTIONS.
  ai_examiner: {
    stripe: "border-l-4 border-l-indigo-500",
    badge: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300",
    dot: "bg-indigo-500",
    iconBorder: "border-indigo-500",
    iconText: "text-indigo-500",
    shadow: "shadow-indigo-100/50",
  },
  // listening ділить колір з true_false — різна природа контенту (аудіо
  // проти select), різні іконки рятують впізнаваність.
  listening: {
    stripe: "border-l-4 border-l-sky-500",
    badge: "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300",
    dot: "bg-sky-500",
    iconBorder: "border-sky-500",
    iconText: "text-sky-500",
    shadow: "shadow-sky-100/50",
  },
  // link ділить колір з matching.
  link: {
    stripe: "border-l-4 border-l-violet-500",
    badge: "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300",
    dot: "bg-violet-500",
    iconBorder: "border-violet-500",
    iconText: "text-violet-500",
    shadow: "shadow-violet-100/50",
  },
  // embed ділить колір з reorder.
  embed: {
    stripe: "border-l-4 border-l-purple-500",
    badge: "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300",
    dot: "bg-purple-500",
    iconBorder: "border-purple-500",
    iconText: "text-purple-500",
    shadow: "shadow-purple-100/50",
  },
  // game ділить колір з drag_drop.
  game: {
    stripe: "border-l-4 border-l-fuchsia-500",
    badge: "bg-fuchsia-100 text-fuchsia-700 dark:bg-fuchsia-900/40 dark:text-fuchsia-300",
    dot: "bg-fuchsia-500",
    iconBorder: "border-fuchsia-500",
    iconText: "text-fuchsia-500",
    shadow: "shadow-fuchsia-100/50",
  },
  // error_correction ділить колір з sort_columns — рідкісний тип.
  error_correction: {
    stripe: "border-l-4 border-l-pink-500",
    badge: "bg-pink-100 text-pink-700 dark:bg-pink-900/40 dark:text-pink-300",
    dot: "bg-pink-500",
    iconBorder: "border-pink-500",
    iconText: "text-pink-500",
    shadow: "shadow-pink-100/50",
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
  chronological_order: "auto_graded",
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
  ListOrdered,
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
  Video,
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
  chronological_order: ListOrdered,
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

// Окремий, третій домен кольорів — тип КОНТЕНТУ БЛОКУ ЗАДАЧ (task_group.
// content_type: 'text'|'audio'|'video'|'embed', обмеження 0031_task_groups.sql)
// — НЕ ті самі значення, що SceneBlockType (video/script/link/task) у
// scene-block-list.tsx, і не типи вправ вище. video навмисно той самий
// violet, що відео-блок сцени (BLOCK_COLORS у scene-block-list.tsx) — той
// самий принцип: це концептуально той самий вміст. Інші значення
// (text/audio/embed) відповідника серед блоків сцени не мають, кольори
// довільні. 3 споживачі (рядок блоку в task-drag-list/test-section-drag-
// list/materials-сторінці) — тому спільний файл, а не локальна мапа.
//
// border — колір верхньої лінії рядка (border-t-4); iconColor — той самий
// колір на іконці content_type. Рядок лишається білим/нейтральним, той
// самий патерн, що BLOCK_COLORS у scene-block-list.tsx.
export const TASK_GROUP_CONTENT_ICON: Record<string, LucideIcon> = {
  text: FileText,
  audio: Volume2,
  video: Video,
  embed: CodeXml,
};

export const TASK_GROUP_CONTENT_COLORS: Record<string, { border: string; iconColor: string }> = {
  text: {
    border: "border-t-amber-500",
    iconColor: "text-amber-500",
  },
  audio: {
    border: "border-t-teal-500",
    iconColor: "text-teal-500",
  },
  video: {
    border: "border-t-violet-500",
    iconColor: "text-violet-500",
  },
  embed: {
    border: "border-t-purple-500",
    iconColor: "text-purple-500",
  },
};

// Четвертий домен кольорів — тип ДОДАТКОВОГО БЛОКУ СЦЕНИ (scene_content_
// blocks.content_type: 'text'|'audio'|'video'|'embed'|'script'|'links',
// обмеження 0036/0038) — НЕ те саме, що TASK_GROUP_CONTENT_* вище (той
// домен суворо про task_groups.content_type, лише 4 значення, ніколи не
// матиме 'script'/'links' — звідси окрема мапа, не розширення наявної).
// text/audio/video/embed навмисно дублюють кольори TASK_GROUP_CONTENT_*
// (візуальна консистентність між двома схожими, але різними доменами).
// script/links — той самий колір, що їхні концептуальні "оригінали" серед
// фіксованих блоків сцени (BLOCK_COLORS у scene-block-list.tsx: script —
// teal, link — green), той самий принцип, що вже застосований до video.
export const SCENE_CONTENT_BLOCK_ICON: Record<string, LucideIcon> = {
  text: FileText,
  audio: Volume2,
  video: Video,
  embed: CodeXml,
  script: MessageSquare,
  links: Link2,
};

export const SCENE_CONTENT_BLOCK_COLORS: Record<string, { border: string; iconColor: string }> = {
  text: {
    border: "border-t-amber-500",
    iconColor: "text-amber-500",
  },
  audio: {
    border: "border-t-teal-500",
    iconColor: "text-teal-500",
  },
  video: {
    border: "border-t-violet-500",
    iconColor: "text-violet-500",
  },
  embed: {
    border: "border-t-purple-500",
    iconColor: "text-purple-500",
  },
  script: {
    border: "border-t-teal-500",
    iconColor: "text-teal-500",
  },
  links: {
    border: "border-t-green-500",
    iconColor: "text-green-500",
  },
};
