"use client";

import { forwardRef, useImperativeHandle, useState } from "react";
import { Trash2 } from "lucide-react";
import type { ReorderConfig, ReorderSequence } from "@/lib/exercises/types";
import type { ImportableFieldsHandle } from "./importable-fields";
import type { TypeSwitchHandle } from "./type-switch-handle";
import { InstructionsRichTextField } from "./instructions-rich-text-field";
import { useFileOrLink } from "@/components/file-or-link-field";
import { INPUT_BORDER } from "@/lib/input-styles";
import { HINT_TEXT } from "@/lib/typography-styles";

function emptySequence(): ReorderSequence {
  return { id: crypto.randomUUID(), items: ["", ""] };
}

// sentence.trim().split(/\s+/) — лише за пробілами, без обробки пунктуації:
// крапка лишається приклеєною до останнього слова, апострофи не розбивають
// слово (вони не пробіл). Свідомо просто, як і вимагає задача.
function splitIntoWords(sentence: string): string[] {
  const trimmed = sentence.trim();
  return trimmed ? trimmed.split(/\s+/) : [];
}

// Окремий компонент на послідовність (не інлайн у .map()) — useFileOrLink
// це хук, викликати його всередині callback .map() було б порушенням правил
// хуків. Textarea-чернетка речення живе лише тут (локальний стан, не
// частина sequences) — "Розбити на слова" переносить результат у items
// одноразово, сама чернетка нікуди не зберігається.
function ReorderSequenceBlock({
  seq,
  index,
  onUpdateItem,
  onAddItem,
  onRemoveItem,
  onMoveItem,
  onUpdatePoints,
  onRemoveSequence,
  onSplitIntoWords,
  onUpdateImageUrl,
  onUpdateAudioUrl,
}: {
  seq: ReorderSequence;
  index: number;
  onUpdateItem: (i: number, value: string) => void;
  onAddItem: () => void;
  onRemoveItem: (i: number) => void;
  onMoveItem: (i: number, dir: -1 | 1) => void;
  onUpdatePoints: (points: number) => void;
  onRemoveSequence: () => void;
  onSplitIntoWords: (words: string[]) => void;
  onUpdateImageUrl: (url: string) => void;
  onUpdateAudioUrl: (url: string) => void;
}) {
  const [draft, setDraft] = useState("");
  const image = useFileOrLink({
    kind: "image",
    mode: "controlled",
    value: seq.imageUrl ?? "",
    onChange: onUpdateImageUrl,
    placeholder: "Картинка (URL, необов'язково)",
    allowFocus: true,
  });
  const audio = useFileOrLink({
    kind: "audio",
    mode: "controlled",
    value: seq.audioUrl ?? "",
    onChange: onUpdateAudioUrl,
    placeholder: "Аудіо (URL, необов'язково)",
  });

  function handleSplit() {
    const words = splitIntoWords(draft);
    if (words.length === 0) return;
    const hasNonEmpty = seq.items.some((it) => it.trim());
    if (hasNonEmpty && !window.confirm("Перезаписати наявні слова цієї послідовності?")) return;
    onSplitIntoWords(words);
  }

  return (
    <div className="rounded-md border border-gray-100 p-2 dark:border-neutral-700">
      <div className="flex items-center justify-between">
        <span className={HINT_TEXT}>Послідовність {index + 1}</span>
        <div className="flex items-center gap-2">
          <span className={HINT_TEXT}>Бали</span>
          <input
            type="number"
            min={0}
            step={0.5}
            value={seq.points ?? 1}
            onChange={(e) => onUpdatePoints(Number(e.target.value))}
            title="Бали за всю послідовність (зараховуються, лише якщо вона повністю правильна)"
            className={`${INPUT_BORDER} w-16 px-2 py-2 text-sm`}
          />
          <button
            type="button"
            onClick={onRemoveSequence}
            aria-label="Видалити послідовність"
            title="Видалити послідовність"
            className="rounded p-1.5 text-neutral-400 hover:text-red-600 dark:text-neutral-500 dark:hover:text-red-400"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      <div className="mt-2 flex items-center gap-2">
        {image.icons}
        {audio.icons}
        <span className={HINT_TEXT}>Картинка/аудіо показуються один раз над усім реченням</span>
      </div>
      {(image.input || audio.input) && (
        <div className="mt-1 flex flex-wrap items-start gap-2">
          {image.input && <div className="flex-1">{image.input}</div>}
          {audio.input && <div className="flex-1">{audio.input}</div>}
        </div>
      )}

      <div className="mt-2 flex flex-col gap-1">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Або вставте ціле речення — слова розставляться в полях нижче"
          rows={2}
          className={`${INPUT_BORDER} px-2 py-2 text-sm`}
        />
        <button
          type="button"
          onClick={handleSplit}
          className="self-start text-xs text-blue-700 hover:underline dark:text-blue-400"
        >
          Розбити на слова
        </button>
      </div>

      <div className="mt-2 flex flex-col gap-1">
        {seq.items.map((item, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className={`w-5 ${HINT_TEXT}`}>{i + 1}.</span>
            <input
              value={item}
              onChange={(e) => onUpdateItem(i, e.target.value)}
              placeholder="Елемент"
              className={`${INPUT_BORDER} flex-1 px-2 py-2 text-base font-medium font-content`}
            />
            <button
              type="button"
              onClick={() => onMoveItem(i, -1)}
              disabled={i === 0}
              className="rounded border px-2 py-0.5 text-xs disabled:opacity-30"
            >
              ↑
            </button>
            <button
              type="button"
              onClick={() => onMoveItem(i, 1)}
              disabled={i === seq.items.length - 1}
              className="rounded border px-2 py-0.5 text-xs disabled:opacity-30"
            >
              ↓
            </button>
            <button
              type="button"
              onClick={() => onRemoveItem(i)}
              aria-label="Видалити елемент"
              title="Видалити"
              className="rounded p-1.5 text-neutral-400 hover:text-red-600 dark:text-neutral-500 dark:hover:text-red-400"
            >
              <Trash2 size={16} />
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={onAddItem}
          className="self-start text-xs text-blue-700 hover:underline dark:text-blue-400"
        >
          + елемент
        </button>
      </div>
    </div>
  );
}

// Єдиний ref віддає ОБИДВА контракти одночасно (importWords і getValue) —
// компонент може мати лише один forwardRef, тож handle-об'єкт поєднує їх,
// а не два окремі ref-и.
export const ReorderFields = forwardRef<
  ImportableFieldsHandle & TypeSwitchHandle<ReorderConfig>,
  { initialConfig?: Partial<ReorderConfig> }
>(function ReorderFields({ initialConfig }, ref) {
  const [sequences, setSequences] = useState<ReorderSequence[]>(
    initialConfig?.sequences?.length ? initialConfig.sequences : [emptySequence()]
  );

  useImperativeHandle(ref, () => ({
    // Слова додаються в кінець ОСТАННЬОЇ послідовності — щоб імпортувати в
    // нову, спершу натисніть "+ послідовність" (вона стане останньою).
    importWords(words) {
      setSequences((prev) => {
        if (prev.length === 0) return prev;
        const next = [...prev];
        const lastIdx = next.length - 1;
        const withoutEmpty = next[lastIdx].items.filter((w) => w.trim());
        next[lastIdx] = {
          ...next[lastIdx],
          items: [...withoutEmpty, ...words.map((w) => w.word)],
        };
        return next;
      });
    },
    getValue: () => ({
      instructions: initialConfig?.instructions,
      subInstructions: initialConfig?.subInstructions,
      sequences,
    }),
  }));

  function addSequence() {
    setSequences((prev) => [...prev, emptySequence()]);
  }

  function removeSequence(id: string) {
    setSequences((prev) => prev.filter((s) => s.id !== id));
  }

  function addItem(seqId: string) {
    setSequences((prev) =>
      prev.map((s) => (s.id === seqId ? { ...s, items: [...s.items, ""] } : s))
    );
  }

  function removeItem(seqId: string, i: number) {
    setSequences((prev) =>
      prev.map((s) =>
        s.id === seqId ? { ...s, items: s.items.filter((_, idx) => idx !== i) } : s
      )
    );
  }

  function updateItem(seqId: string, i: number, value: string) {
    setSequences((prev) =>
      prev.map((s) =>
        s.id === seqId ? { ...s, items: s.items.map((v, idx) => (idx === i ? value : v)) } : s
      )
    );
  }

  function updatePoints(seqId: string, points: number) {
    setSequences((prev) => prev.map((s) => (s.id === seqId ? { ...s, points } : s)));
  }

  function moveItem(seqId: string, i: number, dir: -1 | 1) {
    setSequences((prev) =>
      prev.map((s) => {
        if (s.id !== seqId) return s;
        const j = i + dir;
        if (j < 0 || j >= s.items.length) return s;
        const items = [...s.items];
        [items[i], items[j]] = [items[j], items[i]];
        return { ...s, items };
      })
    );
  }

  function splitIntoWordsFor(seqId: string, words: string[]) {
    setSequences((prev) => prev.map((s) => (s.id === seqId ? { ...s, items: words } : s)));
  }

  function updateImageUrl(seqId: string, url: string) {
    setSequences((prev) => prev.map((s) => (s.id === seqId ? { ...s, imageUrl: url } : s)));
  }

  function updateAudioUrl(seqId: string, url: string) {
    setSequences((prev) => prev.map((s) => (s.id === seqId ? { ...s, audioUrl: url } : s)));
  }

  return (
    <div className="flex flex-col gap-3 rounded-md bg-neutral-50 p-3 dark:bg-neutral-900">
      <input type="hidden" name="reorder_sequences" value={JSON.stringify(sequences)} readOnly />

      <InstructionsRichTextField
        name="reorder_instructions"
        label="Інструкція для студента"
        initialValue={initialConfig?.instructions ?? ""}
      />

      <InstructionsRichTextField
        name="reorder_sub_instructions"
        label="Додаткові інструкції (опційно)"
        initialValue={initialConfig?.subInstructions ?? ""}
        compact
      />

      <p className={HINT_TEXT}>
        Переставлення слів у РЕЧЕННІ — порядок слів, визначений нижче, і є правильною відповіддю,
        студенту вони покажуться перемішаними. (Не плутати з хронологічним порядком — там про
        послідовність ПОДІЙ, тут про порядок СЛІВ.)
      </p>

      <div className="flex flex-col gap-3">
        {sequences.map((seq, si) => (
          <ReorderSequenceBlock
            key={seq.id}
            seq={seq}
            index={si}
            onUpdateItem={(i, value) => updateItem(seq.id, i, value)}
            onAddItem={() => addItem(seq.id)}
            onRemoveItem={(i) => removeItem(seq.id, i)}
            onMoveItem={(i, dir) => moveItem(seq.id, i, dir)}
            onUpdatePoints={(points) => updatePoints(seq.id, points)}
            onRemoveSequence={() => removeSequence(seq.id)}
            onSplitIntoWords={(words) => splitIntoWordsFor(seq.id, words)}
            onUpdateImageUrl={(url) => updateImageUrl(seq.id, url)}
            onUpdateAudioUrl={(url) => updateAudioUrl(seq.id, url)}
          />
        ))}
        <button
          type="button"
          onClick={addSequence}
          className="self-start text-xs text-blue-700 hover:underline dark:text-blue-400"
        >
          + послідовність
        </button>
      </div>
    </div>
  );
});
