import {
  Play,
  AlignLeft,
  BookOpen,
  Headphones,
  CheckCheck,
  PencilLine,
  TextCursorInput,
  ListChecks,
  Link2,
  Layers,
  FileText,
  MessagesSquare,
  Gamepad2,
  GraduationCap,
  Sparkles,
  type LucideIcon,
} from "lucide-react";

// Єдина точка правди "тип блоку/задачі → іконка золотого бейджа" (глянсові
// заголовки-бари GlassBlock/SectionHeaderBar, globals.css .glass-bar-badge)
// — підбір радше за СІМ'ЄЮ вправи (вибір/заповнення/зіставлення), ніж 1:1
// за кожним із ~25 технічних task.type: перелік нижче свідомо не покриває
// геть усі типи, невідомий/майбутній тип падає на DEFAULT_BLOCK_ICON.
const BLOCK_ICONS: Record<string, LucideIcon> = {
  video: Play,
  script: AlignLeft,
  dialogue: MessagesSquare,
  vocabulary: BookOpen,
  audio: Headphones,

  true_false: CheckCheck,

  open_answer: PencilLine,
  open_answer_check: PencilLine,
  essay_check: PencilLine,

  fill_blank: TextCursorInput,
  letter_gaps: TextCursorInput,
  letter_rearrangement: TextCursorInput,
  table_fill: TextCursorInput,
  crossword: TextCursorInput,

  multiple_choice: ListChecks,
  word_choice: ListChecks,
  listening: ListChecks,
  vocab_quiz: ListChecks,
  checkbox_grid: ListChecks,
  chronological_order: ListChecks,
  word_search: ListChecks,

  matching: Link2,
  image_match: Link2,
  sort_columns: Link2,
  reorder: Link2,
  drag_drop: Link2,

  flip_cards: Layers,
  karaoke: Layers,
  phonetics: Layers,

  text: FileText,
  reading: FileText,
  error_correction: FileText,

  game: Gamepad2,
  practice: Gamepad2,
  embed: Gamepad2,

  delf: GraduationCap,
  test: GraduationCap,
};

const DEFAULT_BLOCK_ICON: LucideIcon = Sparkles;

// type — task.type/content_type рядок, фіксований ключ ("video"/"script"/
// "vocabulary" для секцій сторінки сцени), чи undefined/null, коли бар
// немає чим підписати (невідомий/майбутній тип) — завжди повертає
// робочу іконку, ніколи не кидає.
export function resolveBlockIcon(type: string | undefined | null): LucideIcon {
  if (!type) return DEFAULT_BLOCK_ICON;
  return BLOCK_ICONS[type] ?? DEFAULT_BLOCK_ICON;
}
