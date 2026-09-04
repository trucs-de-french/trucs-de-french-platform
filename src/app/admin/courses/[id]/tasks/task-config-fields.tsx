"use client";

import { useEffect, useRef, useState } from "react";
import { summarizeCriteriaForTeacher, type DelfLevel } from "@/lib/delf/evaluation-grids";
import { EXAM_SECTIONS, EXAM_SECTION_LABELS } from "@/lib/delf/exam-structure";
import type {
  MultipleChoiceConfig,
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
} from "@/lib/exercises/types";
import type { VocabItem } from "@/lib/vocab";
import type { EssayFormulaireConfig } from "@/lib/exercises/types";
import { MultipleChoiceFields } from "./multiple-choice-fields";
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
import { ImportVocabPanel } from "./import-vocab-panel";
import { TaskTypeCombobox } from "./task-type-combobox";
import type { ImportableFieldsHandle } from "./importable-fields";
import {
  CATEGORY_COLORS,
  CATEGORY_LABELS,
  TASK_TYPE_ICON,
  getTaskTypeCategory,
} from "@/lib/exercises/task-type-meta";
import { isPointsSupportedTaskType } from "@/lib/exercises/gradable-types";

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
];

const TYPE_OPTIONS = [
  { value: "game", label: "Гра" },
  { value: "open_answer", label: "Відкрита відповідь (автоперевірка)" },
  { value: "essay_check", label: "Есе / DELF (AI-перевірка)" },
  { value: "listening", label: "Аудіювання" },
  { value: "error_correction", label: "Робота над помилками" },
  { value: "vocab_quiz", label: "Вікторина лексики" },
  { value: "embed", label: "Вбудований контент (iframe)" },
  { value: "link", label: "Посилання-кнопка" },
  { value: "fill_blank", label: "Заповніть пропуск" },
  { value: "multiple_choice", label: "Оберіть правильний варіант" },
  { value: "true_false", label: "Оберіть Vrai чи Faux" },
  { value: "matching", label: "З'єднайте елементи" },
  { value: "reorder", label: "Розкладіть у правильному порядку" },
  { value: "drag_drop", label: "Перетягніть слова" },
  { value: "sort_columns", label: "Розкладіть по колонках" },
  { value: "flip_cards", label: "Фліп-картки" },
  { value: "callout", label: "Текстовий блок (callout)" },
  { value: "phonetics", label: "Фонетика" },
  { value: "table_fill", label: "Заповніть таблицю" },
  { value: "image_match", label: "Перетягніть назви під картинки" },
];

type Props = {
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
  /** Пілот системи балів — лише для типів із POINTS_SUPPORTED_TASK_TYPES. */
  initialPointsVisible?: boolean;
};

export function TaskConfigFields({
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
  initialPointsVisible,
}: Props) {
  const [type, setType] = useState(initialType ?? "game");
  // Контрольований (не defaultChecked) — React 19 скидає неконтрольовані
  // поля форми до значення на момент монтування одразу після успішного
  // form action (SaveForm/useActionState), тож defaultChecked показував би
  // щойно збережене значення як "знятий" чекбокс. Синхронізація з пропом —
  // не через useEffect (react-hooks/set-state-in-effect), а через
  // "adjust state during render" (react.dev/learn/you-might-not-need-an-effect).
  const [pointsVisible, setPointsVisible] = useState(initialPointsVisible ?? false);
  const [prevInitialPointsVisible, setPrevInitialPointsVisible] = useState(initialPointsVisible);
  if (initialPointsVisible !== prevInitialPointsVisible) {
    setPrevInitialPointsVisible(initialPointsVisible);
    setPointsVisible(initialPointsVisible ?? false);
  }
  // React 19 викликає нативний form.reset() при КОЖНОМУ сабміті useActionState-форми
  // (SaveForm), синхронно, ще до відповіді сервера — це повертає чекбокс до
  // defaultChecked, зафіксованого один раз при монтуванні сторінки. Який саме
  // рендер (цей reset чи наш власний, з pointsVisible) закомітиться в DOM
  // останнім — перегони, що не гарантовано виграються (звідси видима
  // асиметрія true->false проти false->true після сабміту). 'reset' —
  // нативна подія, яка за специфікацією спрацьовує СТРОГО після того, як
  // браузер уже застосував reset до всіх полів, тож тут завжди останнє
  // слово, незалежно від напрямку.
  const pointsVisibleRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const form = pointsVisibleRef.current?.form;
    if (!form) return;
    function handleReset() {
      if (pointsVisibleRef.current) pointsVisibleRef.current.checked = pointsVisible;
    }
    form.addEventListener("reset", handleReset);
    return () => form.removeEventListener("reset", handleReset);
  }, [pointsVisible]);
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
  // Лише ОДНА з 5 форм нижче реально змонтована одночасно (залежно від
  // type), тож один спільний ref завжди вказує саме на активну.
  const importRef = useRef<ImportableFieldsHandle>(null);
  const taskTypeCategory = getTaskTypeCategory(type);
  // TASK_TYPE_ICON[type] напряму (не через функцію getTaskTypeIcon) — react
  // hooks eslint-плагін помилково трактує "змінна = виклик функції, потім
  // <Змінна/> у JSX" як "компонент створюється під час рендеру", навіть
  // якщо функція — чистий пошук у мапі; пряме звернення до об'єкта цю
  // евристику не зачіпає (перевірено в вихідному коді плагіна).
  const TypeIcon = TASK_TYPE_ICON[type];

  return (
    <>
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <label className="text-xs text-neutral-500 dark:text-neutral-400">Тип завдання</label>
          {taskTypeCategory && (
            <span
              className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs ${CATEGORY_COLORS[taskTypeCategory].badge}`}
            >
              {TypeIcon && <TypeIcon className="h-3 w-3" aria-hidden />}
              {CATEGORY_LABELS[taskTypeCategory]}
            </span>
          )}
        </div>
        <input type="hidden" name="type" value={type} readOnly />
        <TaskTypeCombobox options={TYPE_OPTIONS} value={type} onChange={setType} />
      </div>

      {productType === "delf" && !materialId && (
        <div className="flex gap-4">
          <div className="flex flex-1 flex-col gap-1">
            <label className="text-xs text-neutral-500 dark:text-neutral-400">Секція іспиту</label>
            <select
              name="delf_section"
              required
              value={delfSection}
              onChange={(e) => setDelfSection(e.target.value)}
              className="rounded-md border px-2 py-1.5 text-sm"
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
            <label className="text-xs text-neutral-500 dark:text-neutral-400">
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
              className="rounded-md border px-2 py-1.5 text-sm"
            />
          </div>
        </div>
      )}

      <div className="flex gap-4">
        <div className="flex flex-1 flex-col gap-1">
          <label className="text-xs text-neutral-500 dark:text-neutral-400">
            Картинка (URL, необов&apos;язково)
          </label>
          <input
            name="task_image_url"
            defaultValue={initialImageUrl ?? ""}
            placeholder="показується над завданням, якщо заповнено"
            className="rounded-md border px-2 py-1.5 text-sm"
          />
        </div>
        <div className="flex flex-1 flex-col gap-1">
          <label className="text-xs text-neutral-500 dark:text-neutral-400">
            Аудіо (URL, необов&apos;язково)
          </label>
          <input
            name="task_audio_url"
            defaultValue={initialAudioUrl ?? ""}
            placeholder="показується над завданням, якщо заповнено"
            className="rounded-md border px-2 py-1.5 text-sm"
          />
        </div>
      </div>

      {type === "game" && (
        <div className="flex flex-col gap-3 rounded-md bg-neutral-50 p-3 dark:bg-neutral-900">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-neutral-500 dark:text-neutral-400">Платформа гри</label>
            <select
              name="game_provider"
              defaultValue={initialGame?.provider ?? "wordwall"}
              className="rounded-md border px-2 py-1.5 text-sm"
            >
              <option value="wordwall">Wordwall</option>
              <option value="quizlet">Quizlet</option>
              <option value="internal">Власна</option>
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-neutral-500 dark:text-neutral-400">Посилання на гру</label>
            <input
              name="game_embed_url"
              defaultValue={initialGame?.embed_url ?? ""}
              className="rounded-md border px-2 py-1.5 text-sm"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-neutral-500 dark:text-neutral-400">Тип гри (довільно)</label>
            <input
              name="game_type"
              defaultValue={initialGame?.game_type ?? ""}
              className="rounded-md border px-2 py-1.5 text-sm"
            />
          </div>
        </div>
      )}

      {type === "essay_check" && (
        <div className="flex flex-col gap-3 rounded-md bg-neutral-50 p-3 dark:bg-neutral-900">
          <div className="flex gap-4">
            <div className="flex flex-1 flex-col gap-1">
              <label className="text-xs text-neutral-500 dark:text-neutral-400">
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
                className="rounded-md border px-2 py-1.5 text-sm"
              >
                <option value="A1">A1</option>
                <option value="A2">A2</option>
                <option value="B1">B1</option>
                <option value="B2">B2</option>
              </select>
            </div>
            {(essayLevel === "A1" || essayLevel === "A2") && (
              <div className="flex flex-1 flex-col gap-1">
                <label className="text-xs text-neutral-500 dark:text-neutral-400">Вправа</label>
                <select
                  name="essay_exercise_number"
                  value={essayExerciseNumber}
                  onChange={(e) => {
                    setEssayExerciseNumber(e.target.value);
                    maybeAutofillCriteria(essayLevel, e.target.value);
                  }}
                  className="rounded-md border px-2 py-1.5 text-sm"
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
                <label className="text-xs text-neutral-500 dark:text-neutral-400">
                  Завдання (prompt)
                </label>
                <textarea
                  name="prompt"
                  rows={3}
                  defaultValue={(initialConfig?.prompt as string) ?? ""}
                  className="rounded-md border px-2 py-1.5 text-base font-medium"
                />
              </div>
              <div className="flex flex-col gap-1">
                <div className="flex items-center justify-between gap-2">
                  <label className="text-xs text-neutral-500 dark:text-neutral-400">
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
                  className="rounded-md border px-2 py-1.5 text-base font-medium"
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
            <label className="text-xs text-neutral-500 dark:text-neutral-400">URL для вбудовування (iframe)</label>
            <input
              name="embed_url"
              defaultValue={(initialConfig?.url as string) ?? ""}
              className="rounded-md border px-2 py-1.5 text-sm"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-neutral-500 dark:text-neutral-400">Висота (px)</label>
            <input
              name="embed_height"
              type="number"
              defaultValue={(initialConfig?.height as number) ?? 480}
              className="rounded-md border px-2 py-1.5 text-sm"
            />
          </div>
        </div>
      )}

      {type === "link" && (
        <div className="flex flex-col gap-3 rounded-md bg-neutral-50 p-3 dark:bg-neutral-900">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-neutral-500 dark:text-neutral-400">URL</label>
            <input
              name="link_url"
              defaultValue={(initialConfig?.url as string) ?? ""}
              className="rounded-md border px-2 py-1.5 text-sm"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-neutral-500 dark:text-neutral-400">Текст кнопки</label>
            <input
              name="link_label"
              defaultValue={(initialConfig?.label as string) ?? ""}
              className="rounded-md border px-2 py-1.5 text-base font-medium"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-neutral-500 dark:text-neutral-400">Платформа (іконка)</label>
            <select
              name="link_platform"
              defaultValue={(initialConfig?.platform as string) ?? "auto"}
              className="rounded-md border px-2 py-1.5 text-sm"
            >
              <option value="auto">Визначити автоматично по URL</option>
              <option value="youtube">YouTube</option>
              <option value="wordwall">Wordwall</option>
              <option value="genially">Genially</option>
              <option value="custom">Інше</option>
            </select>
          </div>
          <label className="flex items-center gap-2 text-xs text-neutral-500 dark:text-neutral-400">
            <input
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
          <div className="flex flex-col gap-1">
            <label className="text-xs text-neutral-500 dark:text-neutral-400">
              Інструкція для студента
            </label>
            <input
              name="fill_blank_instructions"
              defaultValue={(initialConfig?.instructions as string) ?? ""}
              placeholder="напр. Заповніть пропуски"
              className="rounded-md border px-2 py-1.5 text-sm"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-neutral-500 dark:text-neutral-400">
              Текст із пропусками — правильні варіанти пишіть прямо у {"{{ }}"} через
              &quot;|&quot;, напр. Je {"{{vais|vais bien}}"} au cinéma.
            </label>
            <textarea
              name="fill_blank_template"
              rows={3}
              defaultValue={(initialConfig?.template as string) ?? ""}
              className="rounded-md border px-2 py-1.5 text-base font-medium"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-neutral-500 dark:text-neutral-400">
              Бали за всю вправу (зараховуються, лише якщо всі пропуски правильні)
            </label>
            <input
              type="number"
              name="fill_blank_points"
              min={0}
              step={0.5}
              defaultValue={(initialConfig?.points as number) ?? 1}
              className="w-24 rounded-md border px-2 py-1.5 text-sm"
            />
          </div>
          <div className="flex flex-col gap-1">
            <input
              type="hidden"
              name="fill_blank_word_bank"
              value={JSON.stringify(fillBlankWordBank)}
              readOnly
            />
            <label className="text-xs text-neutral-500 dark:text-neutral-400">
              Банк слів-підказок (необов&apos;язково — якщо порожній, студент не побачить
              жодних бульбашок; студент і так сам вписує відповідь, це лише підказка)
            </label>
            {fillBlankWordBank.map((word, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  value={word}
                  onChange={(e) => updateFillBlankWord(i, e.target.value)}
                  placeholder="Слово"
                  className="flex-1 rounded-md border px-2 py-1 text-sm"
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

      {type === "multiple_choice" && (
        <MultipleChoiceFields initialConfig={initialConfig as Partial<MultipleChoiceConfig>} />
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
        />
      )}

      {type === "matching" && (
        <MatchingFields ref={importRef} initialConfig={initialConfig as Partial<MatchingConfig>} />
      )}

      {type === "listening" && (
        <ListeningFields initialConfig={initialConfig as Partial<ListeningConfig>} />
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
        <ReorderFields ref={importRef} initialConfig={initialConfig as Partial<ReorderConfig>} />
      )}

      {type === "drag_drop" && (
        <DragDropFields ref={importRef} initialConfig={initialConfig as Partial<DragDropConfig>} />
      )}

      {type === "sort_columns" && (
        <SortColumnsFields
          ref={importRef}
          initialConfig={initialConfig as Partial<SortColumnsConfig>}
        />
      )}

      {type === "flip_cards" && (
        <FlipCardsFields ref={importRef} initialConfig={initialConfig as Partial<FlipCardsConfig>} />
      )}

      {type === "callout" && (
        <CalloutFields initialConfig={initialConfig as Partial<CalloutConfig>} />
      )}

      {type === "phonetics" && (
        <PhoneticsFields initialConfig={initialConfig as Partial<PhoneticsConfig>} />
      )}

      {type === "table_fill" && (
        <TableFillFields ref={importRef} initialConfig={initialConfig as Partial<TableFillConfig>} />
      )}

      {type === "image_match" && (
        <ImageMatchFields ref={importRef} initialConfig={initialConfig as Partial<ImageMatchConfig>} />
      )}

      {/* Пілот системи балів — один спільний чекбокс для всіх типів, що вже
          рахують pointsEarned/pointsPossible (POINTS_SUPPORTED_TASK_TYPES),
          а не окремий блок на кожен тип. */}
      {isPointsSupportedTaskType(type) && (
        <div className="flex items-center gap-2">
          <input
            ref={pointsVisibleRef}
            type="checkbox"
            name="points_visible"
            value="true"
            id="points_visible"
            checked={pointsVisible}
            onChange={(e) => setPointsVisible(e.target.checked)}
          />
          <label htmlFor="points_visible" className="text-xs text-neutral-500 dark:text-neutral-400">
            Показувати бали студенту заздалегідь (до виконання)
          </label>
        </div>
      )}
    </>
  );
}
