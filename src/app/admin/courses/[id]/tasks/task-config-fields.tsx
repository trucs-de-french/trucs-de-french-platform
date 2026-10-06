"use client";

import { useRef, useState, type RefObject } from "react";
import { summarizeCriteriaForTeacher, type DelfLevel } from "@/lib/delf/evaluation-grids";
import { EXAM_SECTIONS, EXAM_SECTION_LABELS } from "@/lib/delf/exam-structure";
import type {
  MultipleChoiceConfig,
  WordChoiceConfig,
  WordSearchConfig,
  TrueFalseConfig,
  MatchingConfig,
  ListeningConfig,
  ReorderConfig,
  DragDropConfig,
  SortColumnsConfig,
  FlipCardsConfig,
  VocabQuizConfig,
  OpenAnswerConfig,
  CalloutConfig,
  PhoneticsConfig,
  TableFillConfig,
  ImageMatchConfig,
  CheckboxGridConfig,
  ChronologicalOrderConfig,
  LetterGapsConfig,
  LetterRearrangementConfig,
  CrosswordConfig,
  KaraokeConfig,
} from "@/lib/exercises/types";
import type { VocabItem } from "@/lib/vocab";
import type { EssayFormulaireConfig } from "@/lib/exercises/types";
import { MultipleChoiceFields } from "./multiple-choice-fields";
import { WordChoiceFields } from "./word-choice-fields";
import { WordSearchFields } from "./word-search-fields";
import { EssayFormulaireFields } from "./essay-formulaire-fields";
import { TrueFalseFields } from "./true-false-fields";
import { MatchingFields } from "./matching-fields";
import { ListeningFields } from "./listening-fields";
import { ReorderFields } from "./reorder-fields";
import { DragDropFields } from "./drag-drop-fields";
import { SortColumnsFields } from "./sort-columns-fields";
import { FlipCardsFields } from "./flip-cards-fields";
import { VocabQuizFields } from "./vocab-quiz-fields";
import { OpenAnswerFields } from "./open-answer-fields";
import { CalloutFields } from "./callout-fields";
import { PhoneticsFields } from "./phonetics-fields";
import { TableFillFields } from "./table-fill-fields";
import { ImageMatchFields } from "./image-match-fields";
import { CheckboxGridFields } from "./checkbox-grid-fields";
import { ChronologicalOrderFields } from "./chronological-order-fields";
import { LetterGapsFields } from "./letter-gaps-fields";
import { LetterRearrangementFields } from "./letter-rearrangement-fields";
import { CrosswordFields } from "./crossword-fields";
import { KaraokeFields } from "./karaoke-fields";
import { ImportVocabPanel } from "./import-vocab-panel";
import { TaskTypeCombobox } from "./task-type-combobox";
import { InstructionsRichTextField } from "./instructions-rich-text-field";
import type { ImportableFieldsHandle } from "./importable-fields";
import type { TypeSwitchHandle } from "./type-switch-handle";
import { getTypeTransform, type LinkEmbedFields } from "./type-compatibility";
import {
  TASK_TYPE_COLORS,
  CATEGORY_LABELS,
  getTaskTypeCategory,
  TASK_TYPE_LABELS,
  TASK_TYPES_WITH_VISIBLE_TITLE,
} from "@/lib/exercises/task-type-meta";
import { generateTaskTitle } from "@/lib/exercises/task-title";
import { buildTaskConfig } from "@/lib/exercises/task-config-builder";
import { validateTaskConfig, type ConfigProblem } from "@/lib/exercises/task-validation";
import {
  DEFAULT_INSTRUCTIONS,
  WORD_CHOICE_DEFAULT_INSTRUCTIONS,
  FILL_BLANK_WORD_BANK_SUBINSTRUCTION,
  type InstructionDefault,
} from "@/lib/exercises/default-instructions";
import { TaskTypeIconBadge } from "@/lib/exercises/task-type-icon-badge";
import { isPointsSupportedTaskType } from "@/lib/exercises/gradable-types";
import { FileOrLinkField } from "@/components/file-or-link-field";
import { FileUpload } from "@/components/file-upload";
import { INPUT_BORDER } from "@/lib/input-styles";
import { LABEL_TEXT, HINT_TEXT } from "@/lib/typography-styles";

// vocab_quiz виключений навмисно — має власний, архітектурно правильніший
// механізм вибору цілих сцен-джерел (VocabQuizFields), а не окремих слів.
const IMPORT_ENABLED_TYPES = [
  "matching",
  "flip_cards",
  "drag_drop",
  "sort_columns",
  "reorder",
  "table_fill",
  "image_match",
  "checkbox_grid",
  "chronological_order",
  "letter_gaps",
  "letter_rearrangement",
  "word_search",
  "crossword",
];

// Типи, де ціль імпорту очікує ПАРУ word+translation разом (не просто
// плаский список слів) — ImportVocabPanel дозволяє позначити фр/укр
// незалежно лише для цих трьох.
const PAIR_TYPES = ["matching", "table_fill", "flip_cards"];

// Типи, де в конфігурації ЕЛЕМЕНТА взагалі немає поля під переклад/підказку
// (на відміну від letter_gaps/letter_rearrangement — hintText, і word_search/
// crossword — translation/clue) — колонці "Переклад" в ImportVocabPanel
// нічого записувати, тож ховаємо її зовсім, щоб позначена галочка не
// створювала враження, ніби переклад кудись збережеться.
const NO_TRANSLATION_TYPES = [
  "drag_drop",
  "sort_columns",
  "reorder",
  "checkbox_grid",
  "chronological_order",
  "image_match",
];

// Префікс імені form-поля instructions/sub_instructions на кожен тип — той
// самий `name=` рядок, що й на InstructionsRichTextField усередині
// відповідного *-fields.tsx (чи прямо тут, для fill_blank). Типи, чия
// конфігурація не має цих двох полів узагалі (essay_check — має prompt/
// criteria замість generic-інструкції; vocab_quiz/callout/embed/link/
// error_correction/game/ai_examiner — своя форма чи немає форми взагалі),
// у мапі відсутні НАВМИСНО: без запису тут дефолт-автозаповнення (п.2) і
// перенесення при зміні типу просто не застосовуються до них, той самий
// список, що "без автоматичних інструкцій" у default-instructions.ts.
const INSTRUCTION_FIELD_PREFIX: Partial<Record<string, string>> = {
  fill_blank: "fill_blank",
  letter_gaps: "letter_gaps",
  letter_rearrangement: "letter_rearrangement",
  multiple_choice: "mc",
  word_choice: "word_choice",
  word_search: "word_search",
  crossword: "crossword",
  true_false: "tf",
  matching: "matching",
  listening: "listening",
  reorder: "reorder",
  drag_drop: "drag_drop",
  sort_columns: "sort_columns",
  flip_cards: "flip_cards",
  phonetics: "phonetics",
  open_answer: "open_answer",
  table_fill: "table_fill",
  image_match: "image_match",
  checkbox_grid: "checkbox_grid",
  chronological_order: "chronological_order",
  karaoke: "karaoke",
};

// Дефолт для типу — word_choice єдиний залежить ще й від режиму (окрема
// мапа WORD_CHOICE_DEFAULT_INSTRUCTIONS, default-instructions.ts). null —
// тип без цих полів узагалі (INSTRUCTION_FIELD_PREFIX не має запису).
function defaultInstructionsFor(
  targetType: string,
  wordChoiceMode: "select" | "cross_out"
): InstructionDefault | null {
  if (!INSTRUCTION_FIELD_PREFIX[targetType]) return null;
  if (targetType === "word_choice") return WORD_CHOICE_DEFAULT_INSTRUCTIONS[wordChoiceMode];
  return DEFAULT_INSTRUCTIONS[targetType] ?? null;
}

// fill_blank subInstruction має ДВА дефолти залежно від того, чи вправа
// матиме банк слів (default-instructions.ts) — на відміну від word_choice,
// це не окрема мапа в тому файлі (вирішується тут, лише для живого
// перемикання в конструкторі; студентський fill-blank.tsx рахує те саме
// незалежно, за config.wordBank).
function fillBlankSubInstructionFor(hasWordBank: boolean): string {
  return hasWordBank ? FILL_BLANK_WORD_BANK_SUBINSTRUCTION : DEFAULT_INSTRUCTIONS.fill_blank.subInstruction;
}

// TipTap (InstructionsRichTextField) завжди огортає вміст у <p>, щойно
// onUpdate хоч раз спрацював (навіть без реальної зміни тексту) — порівняння
// з "голим" дефолтом (без тегів) інакше не впізнало б уже раз відкритий і
// закритий без правок редактор. Знімає РІВНО один зовнішній <p>...</p>, не
// рекурсивно — підзаголовок завжди один абзац.
function unwrapSingleParagraph(html: string): string {
  const m = html.match(/^<p>([\s\S]*)<\/p>$/);
  return m ? m[1] : html;
}

// "game" свідомо ВІДСУТНІЙ тут — нові ігри цього типу більше не створюються
// (тип замінений на embed із можливістю вставити .html-гру), але вже наявні
// 3 задачі з type="game" і далі мусять відкриватись/редагуватись — див.
// typeOptions нижче, де запис повертається в список лише для them.
// Дефолтний тип нової задачі — явно, а не TYPE_OPTIONS[0] (той порядок
// тепер лише "порядок оголошення", реальний порядок у комбоксі задає
// TASK_TYPE_GROUPS/TaskTypeCombobox; був би випадковим, якби й далі залежав
// від позиції в цьому масиві). Лишила поточний фактичний дефолт (open_answer,
// раніше — перший елемент TYPE_OPTIONS), не змінюючи звичну поведінку.
const DEFAULT_TASK_TYPE = "open_answer";

// Порядок оголошення тут ні на що вже не впливає (реальний порядок у
// комбоксі задає TASK_TYPE_GROUPS/TaskTypeCombobox) — лишається лише як
// перелік доступних для вибору значень; label береться з TASK_TYPE_LABELS
// (task-type-meta.ts), єдиного джерела, спільного з generateTaskTitle.
const TYPE_OPTION_VALUES = [
  "open_answer",
  "essay_check",
  "listening",
  "error_correction",
  "vocab_quiz",
  "embed",
  "link",
  "fill_blank",
  "letter_gaps",
  "letter_rearrangement",
  "multiple_choice",
  "word_choice",
  "word_search",
  "crossword",
  "true_false",
  "matching",
  "reorder",
  "drag_drop",
  "sort_columns",
  "flip_cards",
  "callout",
  "phonetics",
  "table_fill",
  "image_match",
  "checkbox_grid",
  "chronological_order",
  "karaoke",
];
const TYPE_OPTIONS = TYPE_OPTION_VALUES.map((value) => ({ value, label: TASK_TYPE_LABELS[value] }));

type Props = {
  initialTitle?: string;
  initialType?: string;
  initialConfig?: Record<string, unknown>;
  initialGame?: { provider?: string; embed_url?: string | null; game_type?: string | null };
  initialImageUrl?: string | null;
  initialAudioUrl?: string | null;
  scenes?: { id: string; title: string }[];
  sceneVocab?: VocabItem[];
  /** Тип батьківського продукту — коли 'delf', показуємо секцію/номер тесту DELF. */
  productType?: string;
  initialDelfSection?: string | null;
  initialDelfTestNumber?: number | null;
  /**
   * Задача вбудована в матеріал (нова чи вже існуюча) — ховає секцію/номер
   * тесту DELF (вправа не належить конкретному CO/CE/PE/PO тесту).
   */
  materialId?: string | null;
  /**
   * Задача вбудована в блок (task_groups) — так само ховає секцію/номер
   * тесту DELF, той самий принцип, що materialId (успадковує їх від блоку,
   * не задає власних).
   */
  taskGroupId?: string | null;
  /** Пілот системи балів — лише для типів із POINTS_SUPPORTED_TASK_TYPES. */
  initialPointsVisible?: boolean;
};

export function TaskConfigFields({
  initialTitle,
  initialType,
  initialConfig,
  initialGame,
  initialImageUrl,
  initialAudioUrl,
  scenes,
  sceneVocab,
  productType,
  initialDelfSection,
  initialDelfTestNumber,
  materialId,
  taskGroupId,
  initialPointsVisible,
}: Props) {
  const [type, setType] = useState(initialType ?? DEFAULT_TASK_TYPE);
  // "game" прибрано з TYPE_OPTIONS (нові ігри цього типу більше не
  // створюються), але вже наявну задачу з type="game" мусимо і далі
  // показувати коректно вибраною в комбобоксі (не "Оберіть тип") — додаємо
  // пункт назад лише для цього єдиного випадку.
  const typeOptions =
    initialType === "game" ? [{ value: "game", label: TASK_TYPE_LABELS.game }, ...TYPE_OPTIONS] : TYPE_OPTIONS;

  // Той самий критерій "справді нова задача", що й instructionsSeed нижче —
  // лише для нього дефолт чекбокса "Дозволити підказки" у SortColumnsFields
  // увімкнений; наявну задачу (навіть без цього поля) не чіпаємо.
  const isNewTask = !initialConfig && !initialType;

  // Автозаповнення інструкцій (instruction FR + subInstruction UA) дефолтом
  // типу — instructionsSeed підставляється замість initialConfig.instructions/
  // subInstructions ЛИШЕ для типу, у який щойно перемкнулись (forType), той
  // самий принцип, що pendingSeed нижче (structural-переноси). Початкове
  // значення — ЛИШЕ для справді НОВОЇ задачі (немає ні initialConfig, ні
  // initialType): існуючу задачу при відкритті на редагування не чіпаємо,
  // навіть якщо instructions порожнє (п.4) — дефолт з'являється лише як
  // результат ЖИВОЇ дії в цій сесії (зміна типу/режиму), не сам по собі при
  // завантаженні сторінки.
  const [instructionsSeed, setInstructionsSeed] = useState<{
    forType: string;
    instruction: string;
    subInstruction: string;
  } | null>(() => {
    if (initialConfig || initialType) return null;
    const def = defaultInstructionsFor(DEFAULT_TASK_TYPE, "select");
    return def ? { forType: DEFAULT_TASK_TYPE, instruction: def.instruction, subInstruction: def.subInstruction } : null;
  });

  // Конфіг для конкретного XFields — pendingSeed (structural-перенос при
  // сумісній парі типів) АБО initialConfig, з накладеним зверху
  // instructionsSeed (якщо він саме для targetType) — єдина точка, звідки
  // всі ~20 підкомпонентів типів читають свій initialConfig.instructions/
  // subInstructions.
  function configForType(targetType: string): Record<string, unknown> {
    const base = ((pendingSeed?.forType === targetType ? pendingSeed.config : initialConfig) ?? {}) as Record<
      string,
      unknown
    >;
    const withInstructionsSeed =
      instructionsSeed?.forType === targetType
        ? { ...base, instructions: instructionsSeed.instruction, subInstructions: instructionsSeed.subInstruction }
        : base;
    // Override — ЗАВЖДИ останній (вище за instructionsSeed), бо
    // відображає подію, що сталась ПІЗНІШЕ за будь-яке перемикання типу:
    // додавання/прибирання слова з банку вже ПІСЛЯ того, як тип fill_blank
    // був обраний (і, можливо, instructionsSeed для нього вже встановлено).
    if (targetType === "fill_blank" && fillBlankSubInstructionOverride) {
      return { ...withInstructionsSeed, subInstructions: fillBlankSubInstructionOverride.value };
    }
    return withInstructionsSeed;
  }

  // Поле "Назва" живе тут (не в батьківській сторінці), бо лише тут відомий
  // type — потрібен і для авто-плейсхолдера (яка автоназва вийшла б), і щоб
  // сховати сам плейсхолдер/кнопку "Згенерувати" для типів, чия назва видна
  // студенту (TASK_TYPES_WITH_VISIBLE_TITLE — там назва лишається
  // обов'язковим полем без автогенерації, як і раніше).
  const titleInputRef = useRef<HTMLInputElement>(null);
  // display:contents — обгортка потрібна лише як DOM-вузол для делегованого
  // onChange/onInput (рахує ЖИВИЙ прев'ю автоназви, поки вчителька заповнює
  // конкретний тип), сама по собі в розкладку не втручається.
  const rootRef = useRef<HTMLDivElement>(null);
  const [previewTitle, setPreviewTitle] = useState(() =>
    generateTaskTitle(initialType ?? DEFAULT_TASK_TYPE, initialConfig ?? {})
  );
  // Список неповних елементів вправи — рахується з тієї самої ЖИВОЇ
  // FormData, що й previewTitle нижче (одна rAF-затримка на обидва),
  // показується жовтою панеллю над полями вправи. Ніколи не блокує
  // збереження тут — лише підтвердження при сабміті (SaveForm/
  // TaskCreateForm, validateBeforeSubmit="task-config").
  const [problems, setProblems] = useState<ConfigProblem[]>(() =>
    validateTaskConfig(initialType ?? DEFAULT_TASK_TYPE, initialConfig ?? {})
  );

  // rAF, не одразу — дочекатись, поки React застосує onChange дочірнього
  // поля (те, що й спричинило подію) і синхронізує його прихований
  // JSON-інпут з новим станом, перш ніж читати FormData цієї форми;
  // синхронне читання в тому самому обробнику бачило б ще СТАРЕ значення
  // (React застосовує стан після завершення поточного обробника).
  function scheduleTitlePreviewUpdate(currentType: string) {
    requestAnimationFrame(() => {
      const form = rootRef.current?.closest("form");
      if (!form) return;
      const liveConfig = buildTaskConfig(currentType, new FormData(form));
      setPreviewTitle(generateTaskTitle(currentType, liveConfig));
      setProblems(validateTaskConfig(currentType, liveConfig));
    });
  }
  // Контрольований чекбокс, синхронізований з пропом від сервера
  // (points_visible оновлюється через revalidatePath в updateTask) — не
  // через useEffect (react-hooks/set-state-in-effect), а через "adjust
  // state during render" (react.dev/learn/you-might-not-need-an-effect).
  // SaveForm сабмітить через onSubmit (не <form action>), тож React 19 тут
  // ніколи не викликає нативний form.reset() — жодного reset-listener на
  // цьому чи будь-якому іншому полі форми не потрібно.
  const [pointsVisible, setPointsVisible] = useState(initialPointsVisible ?? false);
  const [prevInitialPointsVisible, setPrevInitialPointsVisible] = useState(initialPointsVisible);
  if (initialPointsVisible !== prevInitialPointsVisible) {
    setPrevInitialPointsVisible(initialPointsVisible);
    setPointsVisible(initialPointsVisible ?? false);
  }
  // Опційний банк слів-підказок для fill_blank — суто довідковий UI,
  // жодного зв'язку з gradeFillBlank. Порожній за замовчуванням (не
  // "[""]") — банк не показується студенту взагалі, поки вчитель не додав
  // хоч одне слово.
  const [fillBlankWordBank, setFillBlankWordBank] = useState<string[]>(
    (initialConfig?.wordBank as string[] | undefined) ?? []
  );
  // Живе перемикання дефолту subInstruction, коли банк слів увімкнули/
  // вимкнули (addFillBlankWord/removeFillBlankWord нижче), а текст у полі
  // все ще дорівнює одному з двох дефолтів (не редагований вручну) —
  // InstructionsRichTextField не підхоплює новий initialValue сам (той
  // самий принцип, що pendingSeed/instructionsSeed для зміни типу), тож
  // ремонтуємо його через key. version — лише щоб key міняв значення й
  // гарантовано перемонтовував навіть якщо value випадково збігся з
  // попереднім (теоретично неможливо тут, але дешевше, ніж думати, чи
  // можливо).
  const [fillBlankSubInstructionOverride, setFillBlankSubInstructionOverride] = useState<{
    version: number;
    value: string;
  } | null>(null);
  // essay_check за визначенням завжди PE — розумний дефолт, який лишається
  // редагованим.
  const [delfSection, setDelfSection] = useState(
    initialDelfSection ?? (initialType === "essay_check" || initialType === "ai_examiner" ? "PE" : "")
  );
  const [delfTestNumber, setDelfTestNumber] = useState(
    initialDelfTestNumber ? String(initialDelfTestNumber) : ""
  );
  // Єдине місце, де в конструкторі визначається "ця задача належить
  // DELF-тесту" — звідси прокидається в *-fields.tsx для приховування
  // "Підказки зменшують бали" (задача підказок, п.6): DELF-тести самі не
  // мають підказок узагалі. delfSection/delfTestNumber тут коректні і для
  // прямої DELF-задачі (обирається вище), і для задачі-члена блоку
  // (initialDelfSection/initialDelfTestNumber підставляються сторінкою-
  // викликачем із самої групи — new/page.tsx, [taskId]/page.tsx).
  const isDelfTask = Boolean(delfSection) && Boolean(delfTestNumber);
  const [essayLevel, setEssayLevel] = useState((initialConfig?.level as string) ?? "B1");
  const [essayExerciseNumber, setEssayExerciseNumber] = useState(
    initialConfig?.exerciseNumber ? String(initialConfig.exerciseNumber) : ""
  );
  const initialCriteria = (initialConfig?.criteria as string) ?? "";
  const [criteria, setCriteria] = useState(() => {
    if (initialCriteria) return initialCriteria;
    // Нове завдання (нічого не збережено) — одразу підставляємо шаблон для
    // вже обраного дефолтного рівня, якщо він не формуляр/неоднозначний.
    if (essayLevel === "A1" && essayExerciseNumber === "1") return "";
    if (essayLevel === "A2" && essayExerciseNumber === "") return "";
    const exerciseNumber = essayExerciseNumber ? (Number(essayExerciseNumber) as 1 | 2) : undefined;
    return summarizeCriteriaForTeacher(essayLevel as DelfLevel, exerciseNumber);
  });
  // true, якщо збережений текст НЕ збігається з шаблоном для поточного
  // рівня/вправи — захищає вже існуючі essay_check-завдання зі своїм
  // текстом критеріїв від мовчазного перезапису (без потреби в міграції:
  // якщо текст ніколи не був автопідставленим шаблоном, він завжди
  // вважається "кастомним").
  const [criteriaDirty, setCriteriaDirty] = useState(() => {
    if (!initialCriteria) return false;
    const exerciseNumber = essayExerciseNumber ? (Number(essayExerciseNumber) as 1 | 2) : undefined;
    return initialCriteria !== summarizeCriteriaForTeacher(essayLevel as DelfLevel, exerciseNumber);
  });
  // A2 з ще не обраною вправою — шаблон неоднозначний (Ex.1 і Ex.2 мають
  // різні дескриптори "Réalisation de la tâche"), тож чекаємо на вибір.
  const criteriaTemplateAmbiguous = essayLevel === "A2" && essayExerciseNumber === "";

  // Викликається з onChange селекторів рівня/вправи (не з ефекту — та сама
  // подія, що й міняє essayLevel/essayExerciseNumber), щоб не чіпати
  // криитерії, які вчитель уже відредагував вручну (criteriaDirty).
  function maybeAutofillCriteria(level: string, exerciseNumberStr: string) {
    if (level === "A1" && exerciseNumberStr === "1") return; // формуляр, поля критеріїв нема
    if (level === "A2" && exerciseNumberStr === "") return; // неоднозначно, чекаємо на вибір вправи
    if (criteriaDirty) return;
    const exerciseNumber = exerciseNumberStr ? (Number(exerciseNumberStr) as 1 | 2) : undefined;
    setCriteria(summarizeCriteriaForTeacher(level as DelfLevel, exerciseNumber));
  }

  function applyCriteriaTemplate() {
    const exerciseNumber = essayExerciseNumber ? (Number(essayExerciseNumber) as 1 | 2) : undefined;
    setCriteria(summarizeCriteriaForTeacher(essayLevel as DelfLevel, exerciseNumber));
    setCriteriaDirty(false);
  }

  // Перемикає дефолт subInstruction на протилежний, ЛИШЕ якщо живий текст у
  // полі зараз порожній або дорівнює (після знятого <p>) одному з двох
  // дефолтів — власний текст вчительки (що б вона туди не написала) не
  // чіпаємо. toHasWordBank — стан банку ПІСЛЯ зміни, що викликала перемикання.
  function maybeSwitchFillBlankSubInstruction(toHasWordBank: boolean) {
    const live = readLiveInstructionsFor("fill_blank")?.subInstruction ?? "";
    const current = unwrapSingleParagraph(live).trim();
    if (
      current !== "" &&
      current !== DEFAULT_INSTRUCTIONS.fill_blank.subInstruction &&
      current !== FILL_BLANK_WORD_BANK_SUBINSTRUCTION
    ) {
      return;
    }
    setFillBlankSubInstructionOverride((prev) => ({
      version: (prev?.version ?? 0) + 1,
      value: fillBlankSubInstructionFor(toHasWordBank),
    }));
  }

  function addFillBlankWord() {
    if (fillBlankWordBank.length === 0) maybeSwitchFillBlankSubInstruction(true);
    setFillBlankWordBank((prev) => [...prev, ""]);
  }

  function removeFillBlankWord(i: number) {
    if (fillBlankWordBank.length === 1) maybeSwitchFillBlankSubInstruction(false);
    setFillBlankWordBank((prev) => prev.filter((_, idx) => idx !== i));
  }

  function updateFillBlankWord(i: number, value: string) {
    setFillBlankWordBank((prev) => prev.map((w, idx) => (idx === i ? value : w)));
  }
  // Лише ОДНА з форм нижче реально змонтована одночасно (залежно від type),
  // тож один спільний ref завжди вказує саме на активну. getValue —
  // опційний (Partial), бо не всі типи, що ділять цей ref, задіяні в
  // переносі даних при зміні типу (лише ті, що мають пару в
  // type-compatibility.ts: reorder, sort_columns, matching, table_fill,
  // drag_drop, flip_cards — image_match лишається без пари).
  const importRef = useRef<ImportableFieldsHandle & Partial<TypeSwitchHandle<unknown>>>(null);
  // Окремий ref для типів без імпорту лексики, задіяних у переносі даних
  // при зміні типу (multiple_choice, listening, chronological_order,
  // checkbox_grid, phonetics) — той самий принцип поділу ОДНОГО ref між
  // кількома взаємовиключними типами, що вже importRef.
  const typeSwitchRef = useRef<TypeSwitchHandle<unknown>>(null);
  // link/embed/fill_blank — неконтрольовані поля прямо в цьому файлі (не
  // окремий *-fields.tsx компонент), тож для переносу даних при зміні типу
  // читаємо їх напряму з DOM через звичайні DOM-ref-и, а не через getValue().
  // fill_blank_word_bank — виняток: це вже стан батька (fillBlankWordBank),
  // ref для нього не потрібен.
  const linkUrlRef = useRef<HTMLInputElement>(null);
  const linkLabelRef = useRef<HTMLInputElement>(null);
  const linkPlatformRef = useRef<HTMLSelectElement>(null);
  const linkDownloadRef = useRef<HTMLInputElement>(null);
  const embedUrlRef = useRef<HTMLInputElement>(null);
  const embedHeightRef = useRef<HTMLInputElement>(null);
  const fillBlankTemplateRef = useRef<HTMLTextAreaElement>(null);
  const fillBlankPointsRef = useRef<HTMLInputElement>(null);

  // Перенос сумісних даних при зміні типу (усі 7 пар — див.
  // type-compatibility.ts) — pendingSeed підставляється замість initialConfig
  // ЛИШЕ для типу, у який щойно перемкнулись (forType), і лише один раз:
  // наступна зміна типу або перезаписує його заново, або скидає в null,
  // якщо пари нема — жодного "залипання" застарілого seed між кількома
  // перемиканнями.
  const [pendingSeed, setPendingSeed] = useState<{ forType: string; config: Record<string, unknown> } | null>(
    null
  );
  const [transferWarning, setTransferWarning] = useState<string | null>(null);

  function getCurrentValueForTransform(): unknown {
    if (
      type === "reorder" ||
      type === "sort_columns" ||
      type === "matching" ||
      type === "table_fill" ||
      type === "drag_drop" ||
      type === "flip_cards" ||
      type === "checkbox_grid" ||
      type === "chronological_order"
    ) {
      return importRef.current?.getValue?.();
    }
    if (
      type === "multiple_choice" ||
      type === "listening" ||
      type === "phonetics"
    ) {
      return typeSwitchRef.current?.getValue?.();
    }
    if (type === "link") {
      const value: LinkEmbedFields = {
        url: linkUrlRef.current?.value,
        label: linkLabelRef.current?.value,
        platform: linkPlatformRef.current?.value,
        download: linkDownloadRef.current?.checked,
      };
      return value;
    }
    if (type === "embed") {
      const value: LinkEmbedFields = {
        url: embedUrlRef.current?.value,
        height: embedHeightRef.current?.value ? Number(embedHeightRef.current.value) : undefined,
      };
      return value;
    }
    if (type === "fill_blank") {
      return {
        template: fillBlankTemplateRef.current?.value ?? "",
        points: fillBlankPointsRef.current?.value ? Number(fillBlankPointsRef.current.value) : undefined,
        wordBank: fillBlankWordBank,
      };
    }
    return undefined;
  }

  // Живе значення instructions/subInstructions поточного (ще ДО зміни) типу
  // — читається напряму з DOM (прихований input, куди InstructionsRichTextField
  // пише через onUpdate), бо React-стан цих полів живе ВСЕРЕДИНІ дочірнього
  // *Fields-компонента, недоступний тут напряму. null — тип без цих полів
  // узагалі (INSTRUCTION_FIELD_PREFIX).
  function readLiveInstructionsFor(t: string): { instruction: string; subInstruction: string } | null {
    const prefix = INSTRUCTION_FIELD_PREFIX[t];
    if (!prefix) return null;
    const form = rootRef.current?.closest("form");
    if (!form) return null;
    const instrEl = form.elements.namedItem(`${prefix}_instructions`) as HTMLInputElement | null;
    const subEl = form.elements.namedItem(`${prefix}_sub_instructions`) as HTMLInputElement | null;
    return { instruction: instrEl?.value ?? "", subInstruction: subEl?.value ?? "" };
  }

  // word_choice_mode — звичайний <select>, не прихований input, але той
  // самий принцип читання напряму з DOM (mode — внутрішній стан WordChoiceFields).
  function readCurrentWordChoiceMode(): "select" | "cross_out" {
    const form = rootRef.current?.closest("form");
    const el = form?.elements.namedItem("word_choice_mode") as HTMLSelectElement | null;
    return el?.value === "cross_out" ? "cross_out" : "select";
  }

  function handleTypeChange(newType: string) {
    const transform = getTypeTransform(type, newType);
    const currentValue = transform ? getCurrentValueForTransform() : undefined;
    // Банк слів НОВОГО fill_blank — з результату трансформації (напр.
    // drag_drop -> fill_blank: type-compatibility.ts переносить bank
    // РЕАЛЬНИМ банком), а якщо трансформації не було (перемикання з
    // типу без пари) — поточний fillBlankWordBank, той самий стан, що й
    // так лишається між перемиканнями типу (нічого тут не змінюється).
    let newFillBlankWordBank = fillBlankWordBank;
    if (transform && currentValue !== undefined) {
      const result = transform(currentValue as never);
      const config = result.config as Record<string, unknown>;
      setPendingSeed({ forType: newType, config });
      setTransferWarning(result.warning ?? null);
      // fillBlankWordBank — стан САМОГО цього батьківського компонента (не
      // дочірнього, що перемонтовується), тож на відміну від template/points
      // (неконтрольовані defaultValue, підхоплюють pendingSeed автоматично
      // при перемонтуванні fill_blank-блоку) його потрібно оновити явно.
      if (newType === "fill_blank" && Array.isArray(config.wordBank)) {
        newFillBlankWordBank = config.wordBank as string[];
        setFillBlankWordBank(newFillBlankWordBank);
      }
    } else {
      setPendingSeed(null);
      setTransferWarning(null);
    }
    // Нова подія (зміна типу) скасовує попереднє живе перемикання — інакше
    // застарілий override (з попередньої сесії редагування fill_blank)
    // міг би перебити щойно обчислений нижче instructionsSeed.
    setFillBlankSubInstructionOverride(null);

    // Автозаповнення інструкцій дефолтом НОВОГО типу — лише якщо поле (FR
    // instruction чи UA subInstruction, НЕЗАЛЕЖНО одне від одного) ще НЕ
    // редагували вручну: дорівнює дефолту СТАРОГО типу (звідки щойно
    // перемкнулись) або порожнє. Якщо редагували — переносимо ЖИВИЙ
    // введений текст у новий тип (не втрачаємо, не перезаписуємо дефолтом),
    // той самий принцип "не чіпати", що й для структурних pendingSeed-полів
    // вище, лише на рівні кожного з двох полів окремо.
    // newType word_choice завжди монтується зі свіжим mode="select" (немає
    // жодного type-compatibility transform, що переносив би mode) — дефолт
    // рахуємо саме для нього, не для поточного mode СТАРОГО типу.
    const oldDefault = defaultInstructionsFor(type, type === "word_choice" ? readCurrentWordChoiceMode() : "select");
    const rawNewDefault = defaultInstructionsFor(newType, "select");
    // fill_blank — єдиний тип, де субінструкція залежить ще й від банку
    // слів (не лише від типу/режиму): якщо перемикання принесло з собою
    // непорожній банк (drag_drop -> fill_blank) чи він уже був — підставляємо
    // варіант "з банком", а не загальний дефолт типу.
    const newDefault =
      newType === "fill_blank" && rawNewDefault
        ? { ...rawNewDefault, subInstruction: fillBlankSubInstructionFor(newFillBlankWordBank.length > 0) }
        : rawNewDefault;
    if (newDefault) {
      const live = readLiveInstructionsFor(type);
      const instruction =
        live && live.instruction !== "" && live.instruction !== oldDefault?.instruction
          ? live.instruction
          : newDefault.instruction;
      const subInstruction =
        live && live.subInstruction !== "" && live.subInstruction !== oldDefault?.subInstruction
          ? live.subInstruction
          : newDefault.subInstruction;
      setInstructionsSeed({ forType: newType, instruction, subInstruction });
    } else {
      setInstructionsSeed(null);
    }

    setType(newType);
    // Новий тип -> інший набір полів у DOM (інші імена, інший config) —
    // прев'ю рахуємо для НОВОГО типу, не старого.
    scheduleTitlePreviewUpdate(newType);
  }

  const taskTypeCategory = getTaskTypeCategory(type);
  const titleIsVisibleToStudent = TASK_TYPES_WITH_VISIBLE_TITLE.includes(type);
  const errorProblems = problems.filter((p) => p.severity === "error");
  const hintProblems = problems.filter((p) => p.severity === "hint");

  return (
    <div
      ref={rootRef}
      className="contents"
      onChange={() => scheduleTitlePreviewUpdate(type)}
      onInput={() => scheduleTitlePreviewUpdate(type)}
    >
      <div className="flex flex-col gap-1">
        <label className={LABEL_TEXT}>Назва</label>
        <input
          ref={titleInputRef}
          name="title"
          defaultValue={initialTitle ?? ""}
          required={titleIsVisibleToStudent}
          placeholder={titleIsVisibleToStudent ? undefined : previewTitle}
          className={`${INPUT_BORDER} px-3 py-2 text-base font-medium`}
        />
        {!titleIsVisibleToStudent && (
          <div className="flex items-center gap-2">
            <p className={HINT_TEXT}>Якщо лишити порожнім — назва створиться автоматично.</p>
            <button
              type="button"
              onClick={() => {
                if (titleInputRef.current) titleInputRef.current.value = previewTitle;
              }}
              className="shrink-0 text-xs text-brand hover:underline"
            >
              Згенерувати
            </button>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <label className={LABEL_TEXT}>Тип завдання</label>
          <TaskTypeIconBadge type={type} size="xs" />
          {taskTypeCategory && (
            <span
              className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs ${TASK_TYPE_COLORS[type]?.badge ?? ""}`}
            >
              {CATEGORY_LABELS[taskTypeCategory]}
            </span>
          )}
        </div>
        <input type="hidden" name="type" value={type} readOnly />
        <TaskTypeCombobox options={typeOptions} value={type} onChange={handleTypeChange} />
      </div>

      {transferWarning && (
        <p className="rounded-md bg-amber-50 p-2 text-xs text-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
          ⚠ {transferWarning}
        </p>
      )}

      {/* Жива панель неповноти вправи (task-validation.ts) — оновлюється тим
          самим механізмом, що previewTitle вище (delegated onChange/onInput
          на кореневому div + rAF-читання FormData). Ніколи не блокує саме
          редагування, лише інформує — підтвердження при спробі зберегти
          окремо (SaveForm/TaskCreateForm), і лише для severity "error".
          "hint" (порожня інструкція, рекомендована кількість слів тощо) —
          окремий, тихий сірий блок нижче: без жовтого фону, без іконки, не
          впливає на підтвердження чи ⚠ у списках задач. */}
      {errorProblems.length > 0 && (
        <div className="rounded-md bg-amber-50 p-2 text-xs text-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
          <p className="font-medium">Не заповнено ({errorProblems.length}):</p>
          <ul className="mt-1 list-disc pl-4">
            {errorProblems.map((p, i) => (
              <li key={`${p.path}-${i}`}>{p.message}</li>
            ))}
          </ul>
        </div>
      )}

      {hintProblems.length > 0 && (
        <ul className={`flex flex-col gap-0.5 ${HINT_TEXT}`}>
          {hintProblems.map((p, i) => (
            <li key={`${p.path}-${i}`}>{p.message}</li>
          ))}
        </ul>
      )}

      {productType === "delf" && !materialId && !taskGroupId && (
        <div className="flex gap-4">
          <div className="flex flex-1 flex-col gap-1">
            <label className={LABEL_TEXT}>Секція іспиту</label>
            <select
              name="delf_section"
              required
              value={delfSection}
              onChange={(e) => setDelfSection(e.target.value)}
              className={`${INPUT_BORDER} px-2 py-2 text-sm`}
            >
              <option value="">—</option>
              {EXAM_SECTIONS.map((s) => (
                <option key={s} value={s}>
                  {s} — {EXAM_SECTION_LABELS[s]}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-1 flex-col gap-1">
            <label className={LABEL_TEXT}>
              № тесту (1-30)
            </label>
            <input
              name="delf_test_number"
              type="number"
              min={1}
              max={30}
              required
              value={delfTestNumber}
              onChange={(e) => setDelfTestNumber(e.target.value)}
              className={`${INPUT_BORDER} px-2 py-2 text-sm`}
            />
          </div>
        </div>
      )}

      <div className="flex gap-4">
        <div className="flex flex-1 flex-col gap-1">
          <label className={LABEL_TEXT}>
            Картинка (необов&apos;язково)
          </label>
          <FileOrLinkField
            kind="image"
            mode="name"
            urlName="task_image_url"
            uploadName="task_image_file_url"
            defaultValue={initialImageUrl ?? ""}
            placeholder="показується над завданням, якщо заповнено"
          />
        </div>
        <div className="flex flex-1 flex-col gap-1">
          <label className={LABEL_TEXT}>
            Аудіо (необов&apos;язково)
          </label>
          <FileOrLinkField
            kind="audio"
            mode="name"
            urlName="task_audio_url"
            uploadName="task_audio_file_url"
            defaultValue={initialAudioUrl ?? ""}
            placeholder="показується над завданням, якщо заповнено"
          />
        </div>
      </div>

      {type === "game" && (
        <div className="flex flex-col gap-3 rounded-md bg-neutral-50 p-3 dark:bg-neutral-900">
          <div className="flex flex-col gap-1">
            <label className={LABEL_TEXT}>Платформа гри</label>
            <select
              name="game_provider"
              defaultValue={initialGame?.provider ?? "wordwall"}
              className={`${INPUT_BORDER} px-2 py-2 text-sm`}
            >
              <option value="wordwall">Wordwall</option>
              <option value="quizlet">Quizlet</option>
              <option value="internal">Власна</option>
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className={LABEL_TEXT}>Посилання на гру</label>
            <input
              name="game_embed_url"
              defaultValue={initialGame?.embed_url ?? ""}
              className={`${INPUT_BORDER} px-2 py-2 text-sm`}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className={LABEL_TEXT}>Тип гри (довільно)</label>
            <input
              name="game_type"
              defaultValue={initialGame?.game_type ?? ""}
              className={`${INPUT_BORDER} px-2 py-2 text-sm`}
            />
          </div>
        </div>
      )}

      {type === "essay_check" && (
        <div className="flex flex-col gap-3 rounded-md bg-neutral-50 p-3 dark:bg-neutral-900">
          <div className="flex gap-4">
            <div className="flex flex-1 flex-col gap-1">
              <label className={LABEL_TEXT}>
                Рівень DELF (сітка оцінювання)
              </label>
              <select
                name="essay_level"
                value={essayLevel}
                onChange={(e) => {
                  setEssayLevel(e.target.value);
                  setEssayExerciseNumber("");
                  maybeAutofillCriteria(e.target.value, "");
                }}
                className={`${INPUT_BORDER} px-2 py-2 text-sm`}
              >
                <option value="A1">A1</option>
                <option value="A2">A2</option>
                <option value="B1">B1</option>
                <option value="B2">B2</option>
              </select>
            </div>
            {(essayLevel === "A1" || essayLevel === "A2") && (
              <div className="flex flex-1 flex-col gap-1">
                <label className={LABEL_TEXT}>Вправа</label>
                <select
                  name="essay_exercise_number"
                  value={essayExerciseNumber}
                  onChange={(e) => {
                    setEssayExerciseNumber(e.target.value);
                    maybeAutofillCriteria(essayLevel, e.target.value);
                  }}
                  className={`${INPUT_BORDER} px-2 py-2 text-sm`}
                >
                  <option value="">—</option>
                  {essayLevel === "A1" ? (
                    <>
                      <option value="1">Ex.1 — Формуляр</option>
                      <option value="2">Ex.2 — Особисте повідомлення</option>
                    </>
                  ) : (
                    <>
                      <option value="1">Ex.1 — Розповідь про подію</option>
                      <option value="2">Ex.2 — Лист-відповідь</option>
                    </>
                  )}
                </select>
              </div>
            )}
          </div>

          {essayLevel === "A1" && essayExerciseNumber === "1" ? (
            <EssayFormulaireFields
              initialConfig={initialConfig as Partial<EssayFormulaireConfig>}
            />
          ) : (
            <>
              <div className="flex flex-col gap-1">
                <label className={LABEL_TEXT}>
                  Завдання (prompt)
                </label>
                <textarea
                  name="prompt"
                  rows={3}
                  defaultValue={(initialConfig?.prompt as string) ?? ""}
                  className={`${INPUT_BORDER} px-2 py-1.5 text-base font-medium`}
                />
              </div>
              <div className="flex flex-col gap-1">
                <div className="flex items-center justify-between gap-2">
                  <label className={LABEL_TEXT}>
                    Критерії перевірки
                  </label>
                  {criteriaDirty && !criteriaTemplateAmbiguous && (
                    <button
                      type="button"
                      onClick={applyCriteriaTemplate}
                      className="text-xs text-blue-700 hover:underline dark:text-blue-400"
                    >
                      Оновити з шаблону критеріїв
                    </button>
                  )}
                </div>
                <textarea
                  name="criteria"
                  rows={16}
                  value={criteria}
                  onChange={(e) => {
                    setCriteria(e.target.value);
                    setCriteriaDirty(true);
                  }}
                  className={`${INPUT_BORDER} px-2 py-1.5 text-base font-medium`}
                />
              </div>
            </>
          )}
        </div>
      )}

      {type === "open_answer" && (
        <OpenAnswerFields initialConfig={configForType("open_answer") as Partial<OpenAnswerConfig>} />
      )}

      {type === "embed" && (
        <div className="flex flex-col gap-3 rounded-md bg-neutral-50 p-3 dark:bg-neutral-900">
          <div className="flex flex-col gap-1">
            <label className={LABEL_TEXT}>
              Посилання на гру або контент (Wordwall, Quizlet, YouTube…) або завантажте HTML-файл
            </label>
            <div className="flex items-center gap-1">
              <input
                ref={embedUrlRef}
                name="embed_url"
                defaultValue={
                  (pendingSeed?.forType === "embed"
                    ? (pendingSeed.config as LinkEmbedFields).url
                    : (initialConfig?.url as string)) ?? ""
                }
                className={`${INPUT_BORDER} flex-1 px-2 py-2 text-sm`}
              />
              <FileUpload
                kind="html"
                variant="icon"
                onUploaded={(url) => {
                  if (embedUrlRef.current) embedUrlRef.current.value = url;
                }}
              />
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <label className={LABEL_TEXT}>Висота (px)</label>
            <input
              ref={embedHeightRef}
              name="embed_height"
              type="number"
              defaultValue={(initialConfig?.height as number) ?? 480}
              className={`${INPUT_BORDER} px-2 py-2 text-sm`}
            />
          </div>
        </div>
      )}

      {type === "link" && (
        <div className="flex flex-col gap-3 rounded-md bg-neutral-50 p-3 dark:bg-neutral-900">
          <div className="flex flex-col gap-1">
            <label className={LABEL_TEXT}>URL</label>
            <input
              ref={linkUrlRef}
              name="link_url"
              defaultValue={
                (pendingSeed?.forType === "link"
                  ? (pendingSeed.config as LinkEmbedFields).url
                  : (initialConfig?.url as string)) ?? ""
              }
              className={`${INPUT_BORDER} px-2 py-2 text-sm`}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className={LABEL_TEXT}>Текст кнопки</label>
            <input
              ref={linkLabelRef}
              name="link_label"
              defaultValue={(initialConfig?.label as string) ?? ""}
              className={`${INPUT_BORDER} px-2 py-2 text-base font-medium`}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className={LABEL_TEXT}>Платформа (іконка)</label>
            <select
              ref={linkPlatformRef}
              name="link_platform"
              defaultValue={(initialConfig?.platform as string) ?? "auto"}
              className={`${INPUT_BORDER} px-2 py-2 text-sm`}
            >
              <option value="auto">Визначити автоматично по URL</option>
              <option value="youtube">YouTube</option>
              <option value="wordwall">Wordwall</option>
              <option value="genially">Genially</option>
              <option value="custom">Інше</option>
            </select>
          </div>
          <label className={`flex items-center gap-2 ${LABEL_TEXT}`}>
            <input
              ref={linkDownloadRef}
              type="checkbox"
              name="link_download"
              value="true"
              defaultChecked={Boolean(initialConfig?.download)}
            />
            Завантажити файл (замість відкриття в новій вкладці)
          </label>
        </div>
      )}

      {type === "fill_blank" && (
        <div className="flex flex-col gap-3 rounded-md bg-neutral-50 p-3 dark:bg-neutral-900">
          <InstructionsRichTextField
            name="fill_blank_instructions"
            label="Інструкція для студента"
            initialValue={(configForType("fill_blank").instructions as string) ?? ""}
          />

          <InstructionsRichTextField
            // key — лише щоб ремонтувати редактор при живому перемиканні
            // дефолту (maybeSwitchFillBlankSubInstruction/fillBlankSubInstructionOverride
            // вище): InstructionsRichTextField — неконтрольований (TipTap),
            // не підхоплює новий initialValue без цього.
            key={`fill_blank_sub_instructions-${fillBlankSubInstructionOverride?.version ?? 0}`}
            name="fill_blank_sub_instructions"
            label="Додаткові інструкції (опційно)"
            initialValue={(configForType("fill_blank").subInstructions as string) ?? ""}
            compact
          />

          <div className="flex flex-col gap-1">
            <label className={LABEL_TEXT}>
              Текст із пропусками — правильні варіанти пишіть прямо у {"{{ }}"} через
              &quot;|&quot;, напр. Je {"{{vais|vais bien}}"} au cinéma. Підказка-переклад
              (опційно): {"{{chien|chiot::собака}}"}.
            </label>
            <textarea
              ref={fillBlankTemplateRef}
              name="fill_blank_template"
              rows={3}
              defaultValue={
                (pendingSeed?.forType === "fill_blank"
                  ? (pendingSeed.config as { template?: string }).template
                  : (initialConfig?.template as string)) ?? ""
              }
              className={`${INPUT_BORDER} px-2 py-1.5 text-base font-medium`}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className={LABEL_TEXT}>
              Бали за всю вправу (зараховуються, лише якщо всі пропуски правильні)
            </label>
            <input
              ref={fillBlankPointsRef}
              type="number"
              name="fill_blank_points"
              min={0}
              step={0.5}
              defaultValue={
                (pendingSeed?.forType === "fill_blank"
                  ? (pendingSeed.config as { points?: number }).points
                  : (initialConfig?.points as number)) ?? 1
              }
              className={`${INPUT_BORDER} w-24 px-2 py-2 text-sm`}
            />
          </div>
          {!isDelfTask && (
            <label className={`flex items-center gap-2 ${LABEL_TEXT}`}>
              <input
                type="checkbox"
                name="fill_blank_hints_reduce_points"
                value="true"
                defaultChecked={Boolean(initialConfig?.hintsReducePoints)}
              />
              Підказки зменшують бали (50% за елемент, де використана підказка)
            </label>
          )}
          <div className="flex flex-col gap-1">
            <input
              type="hidden"
              name="fill_blank_word_bank"
              value={JSON.stringify(fillBlankWordBank)}
              readOnly
            />
            <label className={LABEL_TEXT}>
              Банк слів-підказок (необов&apos;язково — якщо порожній, студент не побачить
              жодних бульбашок; студент і так сам вписує відповідь, це лише підказка)
            </label>
            {fillBlankWordBank.map((word, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  value={word}
                  onChange={(e) => updateFillBlankWord(i, e.target.value)}
                  placeholder="Слово"
                  className={`${INPUT_BORDER} flex-1 px-2 py-2 text-sm`}
                />
                <button
                  type="button"
                  onClick={() => removeFillBlankWord(i)}
                  className="text-xs text-red-600 hover:underline dark:text-red-400"
                >
                  видалити
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={addFillBlankWord}
              className="self-start text-xs text-blue-700 hover:underline dark:text-blue-400"
            >
              + слово
            </button>
          </div>
          {/* Довідковий режим (без onImport) — тут не можна автоматично
              вписати слово в шаблон, тож просто показуємо список для
              копіювання вручну. */}
          <ImportVocabPanel sceneVocab={sceneVocab ?? []} />
        </div>
      )}

      {type === "letter_gaps" && (
        <LetterGapsFields
          ref={importRef as RefObject<(ImportableFieldsHandle & TypeSwitchHandle<LetterGapsConfig>) | null>}
          initialConfig={
            configForType("letter_gaps") as Partial<LetterGapsConfig>
          }
        />
      )}

      {type === "letter_rearrangement" && (
        <LetterRearrangementFields
          ref={
            importRef as RefObject<
              (ImportableFieldsHandle & TypeSwitchHandle<LetterRearrangementConfig>) | null
            >
          }
          initialConfig={configForType("letter_rearrangement") as Partial<LetterRearrangementConfig>}
        />
      )}

      {type === "multiple_choice" && (
        <MultipleChoiceFields
          ref={typeSwitchRef as RefObject<TypeSwitchHandle<MultipleChoiceConfig> | null>}
          initialConfig={
            configForType("multiple_choice") as Partial<MultipleChoiceConfig>
          }
        />
      )}

      {type === "word_choice" && (
        <WordChoiceFields
          ref={typeSwitchRef as RefObject<TypeSwitchHandle<WordChoiceConfig> | null>}
          initialConfig={
            configForType("word_choice") as Partial<WordChoiceConfig>
          }
        />
      )}

      {type === "word_search" && (
        <WordSearchFields
          ref={
            importRef as RefObject<(ImportableFieldsHandle & TypeSwitchHandle<WordSearchConfig>) | null>
          }
          initialConfig={
            configForType("word_search") as Partial<WordSearchConfig>
          }
        />
      )}

      {type === "crossword" && (
        <CrosswordFields
          ref={
            importRef as RefObject<(ImportableFieldsHandle & TypeSwitchHandle<CrosswordConfig>) | null>
          }
          initialConfig={
            configForType("crossword") as Partial<CrosswordConfig>
          }
        />
      )}

      {type === "karaoke" && (
        <KaraokeFields
          ref={typeSwitchRef as RefObject<TypeSwitchHandle<KaraokeConfig> | null>}
          initialConfig={configForType("karaoke") as Partial<KaraokeConfig>}
        />
      )}

      {type === "true_false" && (
        <TrueFalseFields initialConfig={configForType("true_false") as Partial<TrueFalseConfig>} />
      )}

      {IMPORT_ENABLED_TYPES.includes(type) && (
        <ImportVocabPanel
          // image_match раніше звужував sceneVocab до слів із уже заповненим
          // image_url — відфільтровувало ВСЮ позначену лексику, якщо
          // картинки ще не додані в скрипті (звичний робочий стан: картинку
          // зручніше додавати тут, в ImageMatchFields, після імпорту, а не
          // заздалегідь у скрипті). Імпорт тепер підтягує всі позначені
          // слова, як і для решти типів — image_url кожного елемента
          // лишається порожнім, доки вчителька не додасть його вручну
          // (ImageMatchFields/FileOrLinkField нижче).
          sceneVocab={sceneVocab ?? []}
          onImport={(words) => importRef.current?.importWords(words)}
          pairMode={PAIR_TYPES.includes(type)}
          showTranslationColumn={!NO_TRANSLATION_TYPES.includes(type)}
        />
      )}

      {type === "matching" && (
        <MatchingFields
          ref={importRef as RefObject<(ImportableFieldsHandle & TypeSwitchHandle<MatchingConfig>) | null>}
          initialConfig={
            configForType("matching") as Partial<MatchingConfig>
          }
        />
      )}

      {type === "listening" && (
        <ListeningFields
          ref={typeSwitchRef as RefObject<TypeSwitchHandle<ListeningConfig> | null>}
          initialConfig={
            configForType("listening") as Partial<ListeningConfig>
          }
        />
      )}

      {type === "vocab_quiz" && (
        <VocabQuizFields
          initialConfig={initialConfig as Partial<VocabQuizConfig>}
          scenes={scenes ?? []}
        />
      )}

      {type === "error_correction" && (
        <p className="rounded-md bg-neutral-50 p-3 text-sm text-neutral-600 dark:bg-neutral-900 dark:text-neutral-400">
          Нічого заповнювати не треба: студенту автоматично покажуться його неправильні
          відповіді на інші вправи цієї сцени.
        </p>
      )}

      {type === "reorder" && (
        <ReorderFields
          ref={importRef as RefObject<(ImportableFieldsHandle & TypeSwitchHandle<ReorderConfig>) | null>}
          initialConfig={
            configForType("reorder") as Partial<ReorderConfig>
          }
        />
      )}

      {type === "drag_drop" && (
        <DragDropFields
          ref={importRef as RefObject<(ImportableFieldsHandle & TypeSwitchHandle<DragDropConfig>) | null>}
          initialConfig={
            configForType("drag_drop") as Partial<DragDropConfig>
          }
        />
      )}

      {type === "sort_columns" && (
        <SortColumnsFields
          ref={importRef as RefObject<(ImportableFieldsHandle & TypeSwitchHandle<SortColumnsConfig>) | null>}
          initialConfig={
            configForType("sort_columns") as Partial<SortColumnsConfig>
          }
          defaultHintsEnabled={isNewTask}
        />
      )}

      {type === "flip_cards" && (
        <FlipCardsFields
          ref={importRef as RefObject<(ImportableFieldsHandle & TypeSwitchHandle<FlipCardsConfig>) | null>}
          initialConfig={
            configForType("flip_cards") as Partial<FlipCardsConfig>
          }
        />
      )}

      {type === "callout" && (
        <CalloutFields initialConfig={initialConfig as Partial<CalloutConfig>} />
      )}

      {type === "phonetics" && (
        <PhoneticsFields
          ref={typeSwitchRef as RefObject<TypeSwitchHandle<PhoneticsConfig> | null>}
          initialConfig={
            configForType("phonetics") as Partial<PhoneticsConfig>
          }
        />
      )}

      {type === "table_fill" && (
        <TableFillFields
          ref={importRef as RefObject<(ImportableFieldsHandle & TypeSwitchHandle<TableFillConfig>) | null>}
          initialConfig={
            configForType("table_fill") as Partial<TableFillConfig>
          }
          isDelf={isDelfTask}
        />
      )}

      {type === "image_match" && (
        <ImageMatchFields ref={importRef} initialConfig={configForType("image_match") as Partial<ImageMatchConfig>} />
      )}

      {type === "checkbox_grid" && (
        <CheckboxGridFields
          ref={importRef as RefObject<(ImportableFieldsHandle & TypeSwitchHandle<CheckboxGridConfig>) | null>}
          initialConfig={
            configForType("checkbox_grid") as Partial<CheckboxGridConfig>
          }
        />
      )}

      {type === "chronological_order" && (
        <ChronologicalOrderFields
          ref={importRef as RefObject<(ImportableFieldsHandle & TypeSwitchHandle<ChronologicalOrderConfig>) | null>}
          initialConfig={configForType("chronological_order") as Partial<ChronologicalOrderConfig>}
        />
      )}

      {/* Пілот системи балів — один спільний чекбокс для всіх типів, що вже
          рахують pointsEarned/pointsPossible (POINTS_SUPPORTED_TASK_TYPES),
          а не окремий блок на кожен тип. */}
      {isPointsSupportedTaskType(type) && (
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            name="points_visible"
            value="true"
            id="points_visible"
            checked={pointsVisible}
            onChange={(e) => setPointsVisible(e.target.checked)}
          />
          <label htmlFor="points_visible" className={LABEL_TEXT}>
            Показувати бали студенту заздалегідь (до виконання)
          </label>
        </div>
      )}
    </div>
  );
}
