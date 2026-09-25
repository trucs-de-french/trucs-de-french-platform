"use client";

import { forwardRef, useImperativeHandle, useState } from "react";
import { Trash2 } from "lucide-react";
import type { ChronologicalOrderConfig, ChronologicalOrderItem } from "@/lib/exercises/types";
import { InstructionsRichTextField } from "./instructions-rich-text-field";
import type { ImportableFieldsHandle } from "./importable-fields";
import type { TypeSwitchHandle } from "./type-switch-handle";
import { useFileOrLink } from "@/components/file-or-link-field";
import { ImageOrPlaceholder } from "@/components/image-or-placeholder";
import { INPUT_BORDER } from "@/lib/input-styles";
import { LABEL_TEXT, HINT_TEXT } from "@/lib/typography-styles";

function emptyItem(): ChronologicalOrderItem {
  return { id: crypto.randomUUID(), content: "" };
}

// Окремий компонент (не інлайн у .map()) — useFileOrLink це хук, викликати
// його всередині callback .map() було б порушенням правил хуків. Хук
// викликається завжди, навіть у text-режимі (просто його вивід тоді не
// рендериться) — умовний виклик хука порушив би правила хуків.
function ChronologicalOrderItemRow({
  item,
  index,
  itemsCount,
  mode,
  onMove,
  onUpdateContent,
  onUpdatePoints,
  onRemove,
}: {
  item: ChronologicalOrderItem;
  index: number;
  itemsCount: number;
  mode: "image" | "text";
  onMove: (direction: 1 | -1) => void;
  onUpdateContent: (value: string) => void;
  onUpdatePoints: (points: number) => void;
  onRemove: () => void;
}) {
  const { icons, input } = useFileOrLink({
    kind: "image",
    mode: "controlled",
    value: item.content,
    onChange: onUpdateContent,
    placeholder: "URL зображення",
    allowFocus: true,
  });

  return (
    <div className="flex flex-col gap-1 rounded-md border border-gray-100 p-2 dark:border-neutral-700">
      <div className="flex items-center gap-2">
        <div className="flex flex-col">
          <button
            type="button"
            onClick={() => onMove(-1)}
            disabled={index === 0}
            className="px-1 text-xs text-neutral-500 hover:text-black disabled:opacity-30 dark:text-neutral-400 dark:hover:text-white"
            title="Перемістити вище"
          >
            ▲
          </button>
          <button
            type="button"
            onClick={() => onMove(1)}
            disabled={index === itemsCount - 1}
            className="px-1 text-xs text-neutral-500 hover:text-black disabled:opacity-30 dark:text-neutral-400 dark:hover:text-white"
            title="Перемістити нижче"
          >
            ▼
          </button>
        </div>
        <span className="w-6 text-center text-xs text-neutral-500 dark:text-neutral-400">
          {index + 1}
        </span>
        {mode === "text" && (
          <input
            value={item.content}
            onChange={(e) => onUpdateContent(e.target.value)}
            placeholder="Текст твердження"
            className={`${INPUT_BORDER} flex-1 px-2 py-2 text-base font-medium font-content`}
          />
        )}
        <span className={HINT_TEXT}>Бали</span>
        <input
          type="number"
          min={0}
          step={0.5}
          value={item.points ?? 1}
          onChange={(e) => onUpdatePoints(Number(e.target.value))}
          title="Бали за цей елемент"
          className={`${INPUT_BORDER} w-16 px-2 py-2 text-sm`}
        />
        {mode === "image" && icons}
        <button
          type="button"
          onClick={onRemove}
          aria-label="Видалити елемент"
          title="Видалити"
          className="rounded p-1.5 text-neutral-400 hover:text-red-600 dark:text-neutral-500 dark:hover:text-red-400"
        >
          <Trash2 size={16} />
        </button>
      </div>
      {mode === "image" && (
        <div className="flex items-start gap-1 pl-8">
          {input}
          <ImageOrPlaceholder
            src={item.content}
            alt="Прев'ю"
            className="h-12 w-12 shrink-0 rounded object-cover"
            useFocus
          />
        </div>
      )}
    </div>
  );
}

export const ChronologicalOrderFields = forwardRef<
  ImportableFieldsHandle & TypeSwitchHandle<ChronologicalOrderConfig>,
  { initialConfig?: Partial<ChronologicalOrderConfig> }
>(function ChronologicalOrderFields({ initialConfig }, ref) {
  const [mode, setMode] = useState<"image" | "text">(initialConfig?.mode ?? "image");
  const [items, setItems] = useState<ChronologicalOrderItem[]>(
    initialConfig?.items?.length ? initialConfig.items : [emptyItem(), emptyItem()]
  );

  useImperativeHandle(ref, () => ({
    // Розраховано на текстовий режим (mode==="text") — той самий плоский
    // патерн, що вже reorder/sort_columns. У режимі "Зображення" імпорт
    // так само технічно спрацює, лише підставить слово як текст у поле URL
    // (не варте, окремої перевірки для одного крайнього випадку).
    importWords(words) {
      setItems((prev) => {
        const withoutEmpty = prev.filter((it) => it.content.trim());
        return [...withoutEmpty, ...words.map((w) => ({ id: crypto.randomUUID(), content: w.word }))];
      });
    },
    getValue: () => ({
      instructions: initialConfig?.instructions,
      subInstructions: initialConfig?.subInstructions,
      mode,
      items,
    }),
  }));

  function addItem() {
    setItems((prev) => [...prev, emptyItem()]);
  }

  function removeItem(id: string) {
    setItems((prev) => prev.filter((it) => it.id !== id));
  }

  function updateContent(id: string, content: string) {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, content } : it)));
  }

  function updatePoints(id: string, points: number) {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, points } : it)));
  }

  // Порядок масиву — правильна хронологія (див. коментар у types.ts), тож
  // тут, на відміну від інших білдерів, переміщення елемента вгору/вниз —
  // це не косметика, а єдиний спосіб задати/виправити правильну відповідь.
  function moveItem(index: number, direction: -1 | 1) {
    setItems((prev) => {
      const target = index + direction;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  return (
    <div className="flex flex-col gap-3 rounded-md bg-neutral-50 p-3 dark:bg-neutral-900">
      <input type="hidden" name="chronological_order_mode" value={mode} readOnly />
      <input
        type="hidden"
        name="chronological_order_items"
        value={JSON.stringify(items)}
        readOnly
      />

      <InstructionsRichTextField
        name="chronological_order_instructions"
        label="Інструкція для студента"
        initialValue={initialConfig?.instructions ?? ""}
      />

      <InstructionsRichTextField
        name="chronological_order_sub_instructions"
        label="Додаткові інструкції (опційно)"
        initialValue={initialConfig?.subInstructions ?? ""}
        compact
      />

      <div className="flex flex-col gap-1">
        <label className={LABEL_TEXT}>Тип елементів</label>
        <select
          value={mode}
          onChange={(e) => setMode(e.target.value as "image" | "text")}
          className={`${INPUT_BORDER} w-fit px-2 py-2 text-sm`}
        >
          <option value="image">Зображення (URL)</option>
          <option value="text">Текстові твердження</option>
        </select>
      </div>

      <p className={HINT_TEXT}>
        Додайте елементи у ПРАВИЛЬНОМУ хронологічному порядку — саме цей порядок і є правильною
        відповіддю. Студент побачить їх перемішаними, позначеними літерами (A, B, C...), і впише
        число-позицію для кожного. Кнопками ↑/↓ можна виправити порядок, не видаляючи елементи.
      </p>

      {items.map((item, index) => (
        <ChronologicalOrderItemRow
          key={item.id}
          item={item}
          index={index}
          itemsCount={items.length}
          mode={mode}
          onMove={(direction) => moveItem(index, direction)}
          onUpdateContent={(value) => updateContent(item.id, value)}
          onUpdatePoints={(points) => updatePoints(item.id, points)}
          onRemove={() => removeItem(item.id)}
        />
      ))}
      <button
        type="button"
        onClick={addItem}
        className="self-start text-xs text-blue-700 hover:underline dark:text-blue-400"
      >
        + елемент
      </button>
    </div>
  );
});
