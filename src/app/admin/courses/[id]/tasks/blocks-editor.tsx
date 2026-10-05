"use client";

// Спільний редактор блоків word_search/crossword у конструкторі (ЕТАП B/3)
// — єдиний компонент для обох типів (параметр kind), уся логіка складу
// блоків/слів живе в block-editing.ts (чисті функції), цей компонент лише
// рендерить стан і викликає їх. renderPreview/gridLabel — специфічні для
// kind рендери сітки (GridPreview/CrosswordPreview уже існують у
// word-search-fields.tsx/crossword-fields.tsx, передаються як проп, щоб
// цей файл не знав про форму грід-даних кожного типу).
import { useState, type ReactNode } from "react";
import { RefreshCw, ChevronUp, ChevronDown, Trash2 } from "lucide-react";
import {
  autoDistributeUnassigned,
  resetAndDistributeAll,
  moveWordToBlock,
  createBlockWithWord,
  deleteBlock,
  moveBlock,
  regenerateBlock,
  isBlockStale,
  computeBlockWarnings,
  type EditorState,
  type ClueMode,
  type BlockDisplayWarning,
  type WordSearchEditorGrid,
  type CrosswordEditorGrid,
} from "@/lib/exercises/block-editing";
import { type DistributeMode } from "@/lib/exercises/build-blocks-config";
import { hasAnyCategory, countCategories } from "@/lib/exercises/optimize-split";
import { BUTTON_SECONDARY_SM, BUTTON_DANGER_SM } from "@/lib/button-styles";
import { INPUT_BORDER } from "@/lib/input-styles";
import { LABEL_TEXT, HINT_TEXT } from "@/lib/typography-styles";

type Kind = "word_search" | "crossword";

const DISTRIBUTE_MODE_LABELS: Record<DistributeMode, string> = {
  optimize: "Перемішати (найкраща сітка)",
  order: "За порядком списку",
  category: "За категоріями зі скрипту",
};

function blockWarningText(w: BlockDisplayWarning): string {
  switch (w.type) {
    case "isolated-word":
      return `"${w.word}" — без перетинів`;
    case "wide-block":
      return `сітка ${w.width}× — більша за екран телефона (довге слово "${w.longestWord}")`;
    case "too-many-words":
      return `${w.count} слів — більше за рекомендовані 10`;
    case "too-few-words":
      return `${w.count} ${w.count === 1 ? "слово" : "слова"} — менше за рекомендовані 3`;
    case "long-word":
      return `"${w.word}" — ${w.length} літер, задовге`;
    case "unplaced-word":
      return `"${w.word}" — не вдалося розмістити`;
  }
}

const CLUE_MODE_OPTIONS: { value: ClueMode | ""; label: string; hint: string }[] = [
  { value: "", label: "За замовчуванням", hint: "кожне слово показує підказку за своїми власними налаштуваннями" },
  { value: "short", label: "Коротка", hint: "усі слова блоку — коротка однорядкова підказка" },
  { value: "long", label: "Довге речення", hint: "усі слова блоку — картка на всю ширину" },
  { value: "image", label: "Картинка", hint: "слово з картинкою — картка-картинка; без картинки — коротка підказка" },
];

// Компактний select "Блок" для рядка слова в списку (word-search-fields.tsx/
// crossword-fields.tsx) — touch-friendly (min-h-11 = 44px на телефоні).
export function BlockSelect({
  blockOrder,
  blockTitles,
  value,
  onChange,
  onCreateNew,
}: {
  blockOrder: string[];
  blockTitles: Record<string, string | undefined>;
  value: string | null;
  onChange: (blockId: string | null) => void;
  onCreateNew: () => void;
}) {
  return (
    <select
      value={value ?? ""}
      onChange={(e) => {
        if (e.target.value === "__new__") onCreateNew();
        else onChange(e.target.value || null);
      }}
      aria-label="Блок"
      className={`${INPUT_BORDER} min-h-11 w-40 max-w-full shrink-0 px-1.5 py-1.5 text-xs`}
    >
      <option value="">Нерозподілені</option>
      {blockOrder.map((id, i) => {
        const defaultTitle = `Блок ${i + 1}`;
        const title = blockTitles[id]?.trim();
        const truncatedTitle = title && title.length > 20 ? `${title.slice(0, 20)}…` : title;
        const label = title && title !== defaultTitle ? `${defaultTitle} · ${truncatedTitle}` : defaultTitle;
        return (
          <option key={id} value={id}>
            {label}
          </option>
        );
      })}
      <option value="__new__">+ Новий блок</option>
    </select>
  );
}

function DeleteBlockMenu({ wordCount, onDeleteWithWords, onDissolve }: { wordCount: number; onDeleteWithWords: () => void; onDissolve: () => void }) {
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="text-xs text-red-600 hover:underline dark:text-red-400">
        Видалити…
      </button>
    );
  }
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={() => {
          if (window.confirm(`Видалити блок і ${wordCount} ${wordCount === 1 ? "слово" : "слів"}? Зміни збережуться після натискання «Зберегти».`)) {
            onDeleteWithWords();
          }
          setOpen(false);
        }}
        className={`inline-flex items-center gap-1 ${BUTTON_DANGER_SM}`}
      >
        <Trash2 size={12} /> Видалити блок і слова
      </button>
      <button
        type="button"
        onClick={() => {
          onDissolve();
          setOpen(false);
        }}
        className="text-xs text-blue-700 hover:underline dark:text-blue-400"
      >
        Розформувати (слова → Нерозподілені)
      </button>
      <button type="button" onClick={() => setOpen(false)} className="text-xs text-neutral-500 hover:underline">
        Скасувати
      </button>
    </div>
  );
}

export function BlocksEditor<TWord extends { word: string; category?: string }, TGrid extends { gridSourceWords: string[] }>({
  kind,
  state,
  onChange,
  renderPreview,
  gridLabel,
}: {
  kind: Kind;
  state: EditorState<TWord, TGrid>;
  onChange: (next: EditorState<TWord, TGrid>) => void;
  renderPreview: (grid: TGrid) => ReactNode;
  gridLabel: (grid: TGrid) => string;
}) {
  const unassigned = state.words.filter((w) => w.blockId === null);
  const [mode, setMode] = useState<DistributeMode>("optimize");
  // Статус лише для mode "optimize" (attempts/score/baseScore з
  // distributeWords, build-blocks-config.ts) — скидається перед кожним
  // новим викликом, щоб не показувати застарілий статус після "order"/
  // "category" чи після ручного редагування.
  const [status, setStatus] = useState<{ attempts: number; score: number; baseScore: number } | null>(null);
  const categoryAvailable = hasAnyCategory(state.words);

  function handleAutoDistribute() {
    const { state: next, attempts, score, baseScore } = autoDistributeUnassigned(state as never, kind as never, mode, {
      seed: Date.now(),
    });
    onChange(next as unknown as EditorState<TWord, TGrid>);
    setStatus(mode === "optimize" && attempts !== undefined && score !== undefined && baseScore !== undefined ? { attempts, score, baseScore } : null);
  }

  function handleResetAll() {
    if (
      !window.confirm(
        "Скинути розподіл і розподілити всі слова заново? Назви блоків і режими підказок будуть втрачені."
      )
    ) {
      return;
    }
    const { state: next, attempts, score, baseScore } = resetAndDistributeAll(state as never, kind as never, mode, {
      seed: Date.now(),
    });
    onChange(next as unknown as EditorState<TWord, TGrid>);
    setStatus(mode === "optimize" && attempts !== undefined && score !== undefined && baseScore !== undefined ? { attempts, score, baseScore } : null);
  }

  function updateBlockField(blockId: string, patch: { title?: string; clueMode?: ClueMode }) {
    onChange({ ...state, blocks: { ...state.blocks, [blockId]: { ...state.blocks[blockId], ...patch } } });
  }

  return (
    <div className="flex flex-col gap-3">
      {unassigned.length > 0 && (
        <div className="rounded-md border border-amber-300 bg-amber-50 p-2 dark:border-amber-700 dark:bg-amber-950">
          <p className={`${LABEL_TEXT} text-amber-800 dark:text-amber-300`}>Нерозподілені слова ({unassigned.length})</p>
          <div className="mt-1 flex flex-wrap gap-1">
            {unassigned.map((w) => (
              <span key={w.editorId} className="rounded bg-amber-200 px-1.5 py-0.5 text-xs dark:bg-amber-800">
                {w.word}
              </span>
            ))}
          </div>
        </div>
      )}

      {state.words.length > 0 && (
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={mode}
              onChange={(e) => setMode(e.target.value as DistributeMode)}
              aria-label="Спосіб розподілу"
              className={`${INPUT_BORDER} min-h-11 px-2 py-1.5 text-xs`}
            >
              {(Object.keys(DISTRIBUTE_MODE_LABELS) as DistributeMode[]).map((m) => (
                <option key={m} value={m} disabled={m === "category" && !categoryAvailable}>
                  {m === "category"
                    ? categoryAvailable
                      ? `${DISTRIBUTE_MODE_LABELS[m]} (${countCategories(state.words)} категорій)`
                      : `${DISTRIBUTE_MODE_LABELS[m]} — немає категорій`
                    : DISTRIBUTE_MODE_LABELS[m]}
                </option>
              ))}
            </select>
            {unassigned.length > 0 && (
              <button type="button" onClick={handleAutoDistribute} className={`inline-flex items-center gap-1.5 ${BUTTON_SECONDARY_SM}`}>
                <RefreshCw size={14} /> Розподілити автоматично
              </button>
            )}
            <button type="button" onClick={handleResetAll} className="text-xs text-neutral-500 hover:underline dark:text-neutral-400">
              Скинути й розподілити всі слова заново
            </button>
          </div>
          {status && (
            <p className={HINT_TEXT}>
              Перебрано {status.attempts} {status.attempts === 1 ? "варіант" : "варіантів"}, обрано найкращий
              (штраф {status.score} замість {status.baseScore}). Натисніть ще раз для іншого варіанту.
            </p>
          )}
        </div>
      )}

      {state.words.length === 0 && (
        <p className={HINT_TEXT}>Додайте слова й натисніть «Розподілити автоматично».</p>
      )}

      {state.blockOrder.map((blockId, i) => {
        const block = state.blocks[blockId];
        if (!block) return null;
        const wordsInBlock = state.words.filter((w) => w.blockId === blockId);
        const wordKeys = wordsInBlock.map((w) =>
          kind === "word_search" || kind === "crossword" ? w.word.toUpperCase() : w.word
        );
        const stale = isBlockStale(state, blockId);
        const warnings = wordsInBlock.length > 0 ? computeBlockWarnings(kind, wordKeys, block.grid as unknown as WordSearchEditorGrid | CrosswordEditorGrid | null) : [];

        return (
          <div key={blockId} className="rounded-md border border-gray-200 p-2 dark:border-neutral-700">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className={HINT_TEXT}>
                Блок {i + 1} · {wordsInBlock.length} {wordsInBlock.length === 1 ? "слово" : "слів"}
                {block.grid ? ` · ${gridLabel(block.grid)}` : ""}
              </p>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => onChange(moveBlock(state, blockId, "up"))}
                  disabled={i === 0}
                  aria-label="Перемістити блок вище"
                  className="rounded p-1 text-neutral-500 hover:text-blue-700 disabled:opacity-30 dark:text-neutral-400"
                >
                  <ChevronUp size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => onChange(moveBlock(state, blockId, "down"))}
                  disabled={i === state.blockOrder.length - 1}
                  aria-label="Перемістити блок нижче"
                  className="rounded p-1 text-neutral-500 hover:text-blue-700 disabled:opacity-30 dark:text-neutral-400"
                >
                  <ChevronDown size={14} />
                </button>
              </div>
            </div>

            <div className="mt-2 flex flex-wrap items-start gap-2">
              <input
                value={block.title ?? ""}
                onChange={(e) => updateBlockField(blockId, { title: e.target.value.slice(0, 40) })}
                placeholder={`Блок ${i + 1}`}
                maxLength={40}
                className={`${INPUT_BORDER} min-h-11 flex-1 px-2 py-2 text-sm`}
              />
              <div className="flex flex-col gap-0.5">
                <select
                  value={block.clueMode ?? ""}
                  onChange={(e) => updateBlockField(blockId, { clueMode: (e.target.value || undefined) as ClueMode | undefined })}
                  className={`${INPUT_BORDER} min-h-11 px-2 py-2 text-sm`}
                  aria-label="Підказки"
                >
                  {CLUE_MODE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
                <p className={HINT_TEXT}>{CLUE_MODE_OPTIONS.find((o) => o.value === (block.clueMode ?? ""))?.hint}</p>
              </div>
            </div>

            <div className="mt-2 flex flex-wrap gap-1">
              {wordsInBlock.map((w) => (
                <span key={w.editorId} className="rounded bg-neutral-200 px-1.5 py-0.5 text-xs dark:bg-neutral-700">
                  {w.word}
                </span>
              ))}
            </div>

            {wordsInBlock.length === 0 && (
              <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">
                Блок порожній — буде прибраний при збереженні.
              </p>
            )}

            {block.grid && renderPreview(block.grid)}

            {stale && wordsInBlock.length > 0 && (
              <p className="mt-1 text-sm text-amber-700 dark:text-amber-400">
                Склад слів блоку змінився — перегенеруйте.
              </p>
            )}

            {warnings.map((w, wi) => (
              <p key={wi} className="mt-1 text-xs text-amber-700 dark:text-amber-400">
                ⚠ {blockWarningText(w)}
              </p>
            ))}

            <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => onChange(regenerateBlock(state as never, kind as never, blockId) as unknown as EditorState<TWord, TGrid>)}
                disabled={wordsInBlock.length === 0}
                className="text-xs text-blue-700 hover:underline disabled:opacity-40 dark:text-blue-400"
              >
                Перегенерувати блок
              </button>
              <DeleteBlockMenu
                wordCount={wordsInBlock.length}
                onDeleteWithWords={() => onChange(deleteBlock(state, blockId, "with-words"))}
                onDissolve={() => onChange(deleteBlock(state, blockId, "dissolve"))}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// Експортовано для word-search-fields.tsx/crossword-fields.tsx — обгортки
// над block-editing.ts під конкретний TWord/TGrid (уникає as never на
// кожному місці виклику в полях форми).
export function moveWordToBlockChange<TWord extends { word: string }, TGrid>(
  state: EditorState<TWord, TGrid>,
  kind: Kind,
  wordEditorId: string,
  targetBlockId: string | null
): EditorState<TWord, TGrid> {
  return moveWordToBlock(state as never, kind as never, wordEditorId, targetBlockId) as unknown as EditorState<TWord, TGrid>;
}

export function createBlockWithWordChange<TWord extends { word: string }, TGrid>(
  state: EditorState<TWord, TGrid>,
  kind: Kind,
  wordEditorId: string
): EditorState<TWord, TGrid> {
  return createBlockWithWord(state as never, kind as never, wordEditorId) as unknown as EditorState<TWord, TGrid>;
}
