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
import { generateTaskTitle, buildTitlePreviewConfig } from "@/lib/exercises/task-title";
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

  // rAF, не одразу — дочекатись, поки React застосує onChange дочірнього
  // поля (те, що й спричинило подію) і синхронізує його прихований
  // JSON-інпут з новим станом, перш ніж читати FormData цієї форми;
  // синхронне читання в тому самому обробнику бачило б ще СТАРЕ значення
  // (React застосовує стан після завершення поточного обробника).
  function scheduleTitlePreviewUpdate(currentType: string) {
    requestAnimationFrame(() => {
      const form = rootRef.current?.closest("form");
      if (!form) return;
      const liveConfig = buildTitlePreviewConfig(currentType, new FormData(form));
      setPreviewTitle(generateTaskTitle(currentType, liveConfig));
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
  // essay_check за визначенням завжди PE — розумний дефолт, який лишається
  // редагованим.
  const [delfSection, setDelfSection] = useState(
    initialDelfSection ?? (initialType === "essay_check" || initialType === "ai_examiner" ? "PE" : "")
  );
  const [delfTestNumber, setDelfTestNumber] = useState(
    initialDelfTestNumber ? String(initialDelfTestNumber) : ""
  );
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

  function addFillBlankWord() {
    setFillBlankWordBank((prev) => [...prev, ""]);
  }

  function removeFillBlankWord(i: number) {
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

  function handleTypeChange(newType: string) {
    const transform = getTypeTransform(type, newType);
    const currentValue = transform ? getCurrentValueForTransform() : undefined;
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
        setFillBlankWordBank(config.wordBank as string[]);
      }
    } else {
      setPendingSeed(null);
      setTransferWarning(null);
    }
    setType(newType);
    // Новий тип -> інший набір полів у DOM (інші імена, інший config) —
    // прев'ю рахуємо для НОВОГО типу, не старого.
    scheduleTitlePreviewUpdate(newType);
  }

  const taskTypeCategory = getTaskTypeCategory(type);
  const titleIsVisibleToStudent = TASK_TYPES_WITH_VISIBLE_TITLE.includes(type);

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
        <OpenAnswerFields initialConfig={initialConfig as Partial<OpenAnswerConfig>} />
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
            initialValue={(initialConfig?.instructions as string) ?? ""}
          />

          <InstructionsRichTextField
            name="fill_blank_sub_instructions"
            label="Додаткові інструкції (опційно)"
            initialValue={(initialConfig?.subInstructions as string) ?? ""}
            compact
          />

          <div className="flex flex-col gap-1">
            <label className={LABEL_TEXT}>
              Текст із пропусками — правильні варіанти пишіть прямо у {"{{ }}"} через
              &quot;|&quot;, напр. Je {"{{vais|vais bien}}"} au cinéma.
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
            (pendingSeed?.forType === "letter_gaps" ? pendingSeed.config : initialConfig) as Partial<LetterGapsConfig>
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
          initialConfig={
            (pendingSeed?.forType === "letter_rearrangement"
              ? pendingSeed.config
              : initialConfig) as Partial<LetterRearrangementConfig>
          }
        />
      )}

      {type === "multiple_choice" && (
        <MultipleChoiceFields
          ref={typeSwitchRef as RefObject<TypeSwitchHandle<MultipleChoiceConfig> | null>}
          initialConfig={
            (pendingSeed?.forType === "multiple_choice" ? pendingSeed.config : initialConfig) as Partial<MultipleChoiceConfig>
          }
        />
      )}

      {type === "word_choice" && (
        <WordChoiceFields
          ref={typeSwitchRef as RefObject<TypeSwitchHandle<WordChoiceConfig> | null>}
          initialConfig={
            (pendingSeed?.forType === "word_choice" ? pendingSeed.config : initialConfig) as Partial<WordChoiceConfig>
          }
        />
      )}

      {type === "word_search" && (
        <WordSearchFields
          ref={
            importRef as RefObject<(ImportableFieldsHandle & TypeSwitchHandle<WordSearchConfig>) | null>
          }
          initialConfig={
            (pendingSeed?.forType === "word_search" ? pendingSeed.config : initialConfig) as Partial<WordSearchConfig>
          }
        />
      )}

      {type === "crossword" && (
        <CrosswordFields
          ref={
            importRef as RefObject<(ImportableFieldsHandle & TypeSwitchHandle<CrosswordConfig>) | null>
          }
          initialConfig={
            (pendingSeed?.forType === "crossword" ? pendingSeed.config : initialConfig) as Partial<CrosswordConfig>
          }
        />
      )}

      {type === "true_false" && (
        <TrueFalseFields initialConfig={initialConfig as Partial<TrueFalseConfig>} />
      )}

      {IMPORT_ENABLED_TYPES.includes(type) && (
        <ImportVocabPanel
          // Для image_match показуємо лише слова з уже заповненим image_url
          // (у dialogue-editor.tsx) — без картинки слово тут однаково
          // непридатне.
          sceneVocab={
            type === "image_match"
              ? (sceneVocab ?? []).filter((v) => v.image_url)
              : (sceneVocab ?? [])
          }
          onImport={(words) => importRef.current?.importWords(words)}
          pairMode={PAIR_TYPES.includes(type)}
          showTranslationColumn={!NO_TRANSLATION_TYPES.includes(type)}
        />
      )}

      {type === "matching" && (
        <MatchingFields
          ref={importRef as RefObject<(ImportableFieldsHandle & TypeSwitchHandle<MatchingConfig>) | null>}
          initialConfig={
            (pendingSeed?.forType === "matching" ? pendingSeed.config : initialConfig) as Partial<MatchingConfig>
          }
        />
      )}

      {type === "listening" && (
        <ListeningFields
          ref={typeSwitchRef as RefObject<TypeSwitchHandle<ListeningConfig> | null>}
          initialConfig={
            (pendingSeed?.forType === "listening" ? pendingSeed.config : initialConfig) as Partial<ListeningConfig>
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
            (pendingSeed?.forType === "reorder" ? pendingSeed.config : initialConfig) as Partial<ReorderConfig>
          }
        />
      )}

      {type === "drag_drop" && (
        <DragDropFields
          ref={importRef as RefObject<(ImportableFieldsHandle & TypeSwitchHandle<DragDropConfig>) | null>}
          initialConfig={
            (pendingSeed?.forType === "drag_drop" ? pendingSeed.config : initialConfig) as Partial<DragDropConfig>
          }
        />
      )}

      {type === "sort_columns" && (
        <SortColumnsFields
          ref={importRef as RefObject<(ImportableFieldsHandle & TypeSwitchHandle<SortColumnsConfig>) | null>}
          initialConfig={
            (pendingSeed?.forType === "sort_columns" ? pendingSeed.config : initialConfig) as Partial<SortColumnsConfig>
          }
        />
      )}

      {type === "flip_cards" && (
        <FlipCardsFields
          ref={importRef as RefObject<(ImportableFieldsHandle & TypeSwitchHandle<FlipCardsConfig>) | null>}
          initialConfig={
            (pendingSeed?.forType === "flip_cards" ? pendingSeed.config : initialConfig) as Partial<FlipCardsConfig>
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
            (pendingSeed?.forType === "phonetics" ? pendingSeed.config : initialConfig) as Partial<PhoneticsConfig>
          }
        />
      )}

      {type === "table_fill" && (
        <TableFillFields
          ref={importRef as RefObject<(ImportableFieldsHandle & TypeSwitchHandle<TableFillConfig>) | null>}
          initialConfig={
            (pendingSeed?.forType === "table_fill" ? pendingSeed.config : initialConfig) as Partial<TableFillConfig>
          }
        />
      )}

      {type === "image_match" && (
        <ImageMatchFields ref={importRef} initialConfig={initialConfig as Partial<ImageMatchConfig>} />
      )}

      {type === "checkbox_grid" && (
        <CheckboxGridFields
          ref={importRef as RefObject<(ImportableFieldsHandle & TypeSwitchHandle<CheckboxGridConfig>) | null>}
          initialConfig={
            (pendingSeed?.forType === "checkbox_grid" ? pendingSeed.config : initialConfig) as Partial<CheckboxGridConfig>
          }
        />
      )}

      {type === "chronological_order" && (
        <ChronologicalOrderFields
          ref={importRef as RefObject<(ImportableFieldsHandle & TypeSwitchHandle<ChronologicalOrderConfig>) | null>}
          initialConfig={
            (pendingSeed?.forType === "chronological_order"
              ? pendingSeed.config
              : initialConfig) as Partial<ChronologicalOrderConfig>
          }
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
