"use client";

import { forwardRef, useImperativeHandle, useState } from "react";
import type { ReorderConfig, ReorderSequence } from "@/lib/exercises/types";
import type { ImportableFieldsHandle } from "./importable-fields";

function emptySequence(): ReorderSequence {
  return { id: crypto.randomUUID(), items: ["", ""] };
}

export const ReorderFields = forwardRef<
  ImportableFieldsHandle,
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

  return (
    <div className="flex flex-col gap-3 rounded-md bg-neutral-50 p-3 dark:bg-neutral-900">
      <input type="hidden" name="reorder_sequences" value={JSON.stringify(sequences)} readOnly />

      <div className="flex flex-col gap-1">
        <label className="text-xs text-neutral-500 dark:text-neutral-400">
          Інструкція для студента
        </label>
        <input
          name="reorder_instructions"
          defaultValue={initialConfig?.instructions ?? ""}
          placeholder="напр. Розкладіть речення у правильному порядку"
          className="rounded-md border px-2 py-1.5 text-sm"
        />
      </div>

      <p className="text-xs text-neutral-500 dark:text-neutral-400">
        Порядок елементів у кожній послідовності нижче — це і є правильна відповідь. Студенту
        список покажеться перемішаним.
      </p>

      <div className="flex flex-col gap-3">
        {sequences.map((seq, si) => (
          <div key={seq.id} className="rounded-md border p-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-neutral-500 dark:text-neutral-400">
                Послідовність {si + 1}
              </span>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={0}
                  step={0.5}
                  value={seq.points ?? 1}
                  onChange={(e) => updatePoints(seq.id, Number(e.target.value))}
                  title="Бали за всю послідовність (зараховуються, лише якщо вона повністю правильна)"
                  className="w-16 rounded-md border px-2 py-1 text-sm"
                />
                <button
                  type="button"
                  onClick={() => removeSequence(seq.id)}
                  className="text-xs text-red-600 hover:underline dark:text-red-400"
                >
                  видалити послідовність
                </button>
              </div>
            </div>
            <div className="mt-2 flex flex-col gap-1">
              {seq.items.map((item, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="w-5 text-xs text-neutral-400 dark:text-neutral-500">
                    {i + 1}.
                  </span>
                  <input
                    value={item}
                    onChange={(e) => updateItem(seq.id, i, e.target.value)}
                    placeholder="Елемент"
                    className="flex-1 rounded-md border px-2 py-1 text-base font-medium"
                  />
                  <button
                    type="button"
                    onClick={() => moveItem(seq.id, i, -1)}
                    disabled={i === 0}
                    className="rounded border px-2 py-0.5 text-xs disabled:opacity-30"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    onClick={() => moveItem(seq.id, i, 1)}
                    disabled={i === seq.items.length - 1}
                    className="rounded border px-2 py-0.5 text-xs disabled:opacity-30"
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    onClick={() => removeItem(seq.id, i)}
                    className="text-xs text-red-600 hover:underline dark:text-red-400"
                  >
                    видалити
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => addItem(seq.id)}
                className="self-start text-xs text-blue-700 hover:underline dark:text-blue-400"
              >
                + елемент
              </button>
            </div>
          </div>
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
