"use client";

import { useState } from "react";
import { SubmitButton } from "@/components/submit-button";
import { ImportVocabPanel } from "../../../../tasks/import-vocab-panel";
import {
  BULK_VOCAB_TASK_TYPES,
  STRIP_ARTICLES_DEFAULT,
  type BulkVocabTaskType,
} from "@/lib/exercises/task-config-builder";
import { TASK_TYPE_LABELS, TASK_TYPE_DESCRIPTIONS } from "@/lib/exercises/task-type-meta";
import { TaskTypeIconBadge } from "@/lib/exercises/task-type-icon-badge";
import { StripArticlesToggle } from "../../../../tasks/strip-articles-toggle";
import type { LetterHideMode } from "@/lib/exercises/letter-hide";
import { WORD_SEARCH_MAX_WORDS, CROSSWORD_MAX_WORDS, splitIntoChunks } from "@/lib/exercises/grid-limits";
import type { VocabItem } from "@/lib/vocab";
import { pluralizeExercisesAccusative } from "@/lib/pluralize-exercises";
import { BUTTON_PRIMARY_LG } from "@/lib/button-styles";
import { INPUT_BORDER } from "@/lib/input-styles";
import { LABEL_TEXT, HINT_TEXT } from "@/lib/typography-styles";
import { Z_ACTION_BAR } from "@/lib/z-layers";

type ImportedWord = { word: string; translation: string; image_url?: string };

// Сітка на 1-2 слова технічно згенерується (генератор не падає), але
// виглядає як завдання заради завдання — лише попередження, не блокування.
const MIN_WORDS_FOR_GRID = 3;

// flip_cards — самостійний тип без правильної відповіді (не оцінюється,
// той самий принцип, що вже в types.ts) — єдиний із 7 без поля "Бали".
const NO_POINTS_TYPES = new Set<BulkVocabTaskType>(["flip_cards"]);

type TypeState = {
  checked: boolean;
  points: number;
  letterHideMode: LetterHideMode;
  crosswordClueStyle: "short" | "long";
  stripArticles: boolean;
};

function defaultTypeState(type: BulkVocabTaskType): TypeState {
  return {
    checked: false,
    points: 1,
    letterHideMode: "default",
    crosswordClueStyle: "short",
    stripArticles: STRIP_ARTICLES_DEFAULT[type] ?? false,
  };
}

const LETTER_HIDE_OPTIONS: { mode: LetterHideMode; label: string }[] = [
  { mode: "default", label: "~40%" },
  { mode: "vowels", label: "Голосні" },
  { mode: "every_second", label: "Кожну другу" },
];

const CROSSWORD_CLUE_STYLES = [
  { style: "short" as const, label: "Коротка" },
  { style: "long" as const, label: "Довга (речення)" },
];

// Один майстер на одній сторінці (не справжній покроковий wizard із
// навігацією між кроками) — "Крок 1"/"Крок 2" тут лише заголовки секцій:
// увесь вибір (слова + типи + налаштування) живе в ОДНІЙ формі й сабмітиться
// одним кліком наприкінці, той самий принцип, що вже TaskConfigFields
// (довга одна форма, не багатосторінковий процес).
export function BulkFromVocabForm({
  action,
  productId,
  sceneId,
  taskGroupId,
  anchor,
  sceneVocab,
}: {
  action: (formData: FormData) => void;
  productId: string;
  sceneId: string;
  taskGroupId: string | null;
  anchor: string | null;
  sceneVocab: VocabItem[];
}) {
  const [selectedWords, setSelectedWords] = useState<ImportedWord[]>([]);
  const [typeState, setTypeState] = useState<Record<BulkVocabTaskType, TypeState>>(
    () =>
      Object.fromEntries(BULK_VOCAB_TASK_TYPES.map((t) => [t, defaultTypeState(t)])) as Record<
        BulkVocabTaskType,
        TypeState
      >
  );

  function updateType(type: BulkVocabTaskType, patch: Partial<TypeState>) {
    setTypeState((prev) => ({ ...prev, [type]: { ...prev[type], ...patch } }));
  }

  const selectedTypes = BULK_VOCAB_TASK_TYPES.filter((t) => typeState[t].checked);
  // word_search/crossword діляться на кілька вправ, коли слів більше за
  // максимум для типу (той самий MAX_WORDS_BY_TYPE, що в bulkCreateTasksFromVocab) —
  // кнопка має показувати реальну кількість вправ, що створяться, а не 1 на тип.
  const MAX_WORDS_BY_TYPE: Partial<Record<BulkVocabTaskType, number>> = {
    word_search: WORD_SEARCH_MAX_WORDS,
    crossword: CROSSWORD_MAX_WORDS,
  };
  const taskCount = selectedTypes.reduce((sum, type) => {
    const max = MAX_WORDS_BY_TYPE[type];
    const parts = max ? splitIntoChunks(selectedWords, max).length : 1;
    return sum + parts;
  }, 0);
  const canSubmit = selectedWords.length > 0 && taskCount > 0;

  // Форма для server action — та сама розкладка полів, що VocabWordInput/
  // BulkTypeSelection у tasks/actions.ts (bulkCreateTasksFromVocab).
  const selectedWordsForServer = selectedWords.map((w) => ({
    word: w.word,
    translation: w.translation,
    imageUrl: w.image_url,
  }));
  const selections = selectedTypes.map((type) => ({
    type,
    points: NO_POINTS_TYPES.has(type) ? undefined : typeState[type].points,
    letterHideMode: type === "letter_gaps" ? typeState[type].letterHideMode : undefined,
    crosswordClueStyle: type === "crossword" ? typeState[type].crosswordClueStyle : undefined,
    // letter_gaps не прибирає артикль узагалі (він завжди лишається видимим,
    // лише захищений від приховування) — buildConfigFromVocab однаково
    // ігнорує stripArticles для цього типу, але не надсилаємо його явно, щоб
    // не створювати враження, ніби перемикач для letter_gaps щось важить.
    stripArticles: type === "letter_gaps" ? undefined : typeState[type].stripArticles,
  }));

  return (
    <form
      action={action}
      className="mt-4 flex flex-col gap-6 rounded-lg border border-gray-100 bg-white p-4 shadow-sm dark:border-neutral-700 dark:bg-neutral-800"
    >
      <input type="hidden" name="product_id" value={productId} />
      <input type="hidden" name="scene_id" value={sceneId} />
      {taskGroupId && <input type="hidden" name="task_group_id" value={taskGroupId} />}
      {anchor && <input type="hidden" name="anchor" value={anchor} />}
      <input type="hidden" name="selected_words" value={JSON.stringify(selectedWordsForServer)} readOnly />
      <input type="hidden" name="selections" value={JSON.stringify(selections)} readOnly />

      <div className="flex flex-col gap-2">
        <h2 className={LABEL_TEXT}>Крок 1: слова</h2>
        <ImportVocabPanel sceneVocab={sceneVocab} onSelectionChange={setSelectedWords} />
      </div>

      <div className="flex flex-col gap-3">
        <h2 className={LABEL_TEXT}>Крок 2: типи</h2>
        {BULK_VOCAB_TASK_TYPES.map((type) => {
          const s = typeState[type];
          const isGridType = type === "word_search" || type === "crossword";
          const showGridWarning = s.checked && isGridType && selectedWords.length > 0 && selectedWords.length < MIN_WORDS_FOR_GRID;

          return (
            <div
              key={type}
              className={`rounded-md border p-3 ${
                s.checked
                  ? "border-brand bg-brand/5 dark:border-brand dark:bg-neutral-800"
                  : "border-gray-100 dark:border-neutral-700"
              }`}
            >
              <label className="flex cursor-pointer items-start gap-2">
                <input
                  type="checkbox"
                  checked={s.checked}
                  onChange={(e) => updateType(type, { checked: e.target.checked })}
                  className="mt-1"
                />
                <span className="flex flex-1 items-start gap-2">
                  <TaskTypeIconBadge type={type} size="xs" />
                  <span className="flex flex-col">
                    <span className="text-sm font-medium">{TASK_TYPE_LABELS[type]}</span>
                    <span className={HINT_TEXT}>{TASK_TYPE_DESCRIPTIONS[type]}</span>
                  </span>
                </span>
              </label>

              {s.checked && (
                <div className="mt-2 flex flex-wrap items-end gap-3 pl-6">
                  {!NO_POINTS_TYPES.has(type) && (
                    <div className="flex flex-col gap-1">
                      <label className={LABEL_TEXT}>Бали</label>
                      <input
                        type="number"
                        min={0}
                        step={0.5}
                        value={s.points}
                        onChange={(e) => updateType(type, { points: Number(e.target.value) || 0 })}
                        className={`${INPUT_BORDER} w-20 px-2 py-1 text-sm`}
                      />
                    </div>
                  )}

                  {type === "letter_gaps" && (
                    <div className="flex flex-col gap-1">
                      <label className={LABEL_TEXT}>Приховати літери</label>
                      <div className="flex gap-1">
                        {LETTER_HIDE_OPTIONS.map(({ mode, label }) => (
                          <button
                            key={mode}
                            type="button"
                            onClick={() => updateType("letter_gaps", { letterHideMode: mode })}
                            className={`rounded border px-2 py-1 text-xs ${
                              s.letterHideMode === mode
                                ? "border-brand bg-brand/10 text-brand"
                                : "border-gray-200 text-neutral-600 dark:border-neutral-700 dark:text-neutral-400"
                            }`}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {type === "crossword" && (
                    <div className="flex flex-col gap-1">
                      <label className={LABEL_TEXT}>Стиль підказки</label>
                      <div className="flex gap-1">
                        {CROSSWORD_CLUE_STYLES.map(({ style, label }) => (
                          <button
                            key={style}
                            type="button"
                            onClick={() => updateType("crossword", { crosswordClueStyle: style })}
                            className={`rounded border px-2 py-1 text-xs ${
                              s.crosswordClueStyle === style
                                ? "border-brand bg-brand/10 text-brand"
                                : "border-gray-200 text-neutral-600 dark:border-neutral-700 dark:text-neutral-400"
                            }`}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {type !== "letter_gaps" && (
                    <StripArticlesToggle
                      checked={s.stripArticles}
                      onChange={(value) => updateType(type, { stripArticles: value })}
                    />
                  )}

                  {type === "letter_gaps" && (
                    <p className={HINT_TEXT}>Артикль лишається видимим і ніколи не приховується.</p>
                  )}
                </div>
              )}

              {showGridWarning && (
                <p className="mt-2 pl-6 text-xs text-amber-600 dark:text-amber-400">
                  ⚠ Обрано менше {MIN_WORDS_FOR_GRID} слів — {type === "word_search" ? "філворд" : "кросворд"} матиме
                  сенс лише за більшої кількості.
                </p>
              )}
            </div>
          );
        })}
      </div>

      <div
        className={`sticky bottom-0 ${Z_ACTION_BAR} -mx-4 border-t border-gray-200 bg-white px-4 py-3 shadow-[0_-1px_3px_rgba(0,0,0,0.1)] dark:border-neutral-800 dark:bg-neutral-950`}
      >
        <SubmitButton pendingChildren="Створюю..." disabled={!canSubmit} className={`self-start ${BUTTON_PRIMARY_LG}`}>
          {`Створити ${taskCount} ${pluralizeExercisesAccusative(taskCount)}`}
        </SubmitButton>
      </div>
    </form>
  );
}
