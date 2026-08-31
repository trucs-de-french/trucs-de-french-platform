"use client";

import { useRef, useState } from "react";
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
import { MultipleChoiceFields } from "./multiple-choice-fields";
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
import type { ImportableFieldsHandle } from "./importable-fields";

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
  { value: "true_false", label: "Оберіть True чи False" },
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
};

export function TaskConfigFields({
  initialType,
  initialConfig,
  initialGame,
  initialImageUrl,
  initialAudioUrl,
  scenes,
  sceneVocab,
}: Props) {
  const [type, setType] = useState(initialType ?? "game");
  // Лише ОДНА з 5 форм нижче реально змонтована одночасно (залежно від
  // type), тож один спільний ref завжди вказує саме на активну.
  const importRef = useRef<ImportableFieldsHandle>(null);

  return (
    <>
      <div className="flex flex-col gap-1">
        <label className="text-xs text-neutral-500 dark:text-neutral-400">Тип завдання</label>
        <select
          name="type"
          value={type}
          onChange={(e) => setType(e.target.value)}
          className="rounded-md border px-3 py-2"
        >
          {TYPE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

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
          <div className="flex flex-col gap-1">
            <label className="text-xs text-neutral-500 dark:text-neutral-400">Завдання (prompt)</label>
            <textarea
              name="prompt"
              rows={3}
              defaultValue={(initialConfig?.prompt as string) ?? ""}
              className="rounded-md border px-2 py-1.5 text-base font-medium"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-neutral-500 dark:text-neutral-400">Критерії перевірки</label>
            <textarea
              name="criteria"
              rows={2}
              defaultValue={(initialConfig?.criteria as string) ?? ""}
              className="rounded-md border px-2 py-1.5 text-base font-medium"
            />
          </div>
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
    </>
  );
}
