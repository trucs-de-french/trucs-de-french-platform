"use client";

import { forwardRef, useImperativeHandle, useState } from "react";
import { Trash2 } from "lucide-react";
import type { MultipleChoiceConfig, MultipleChoiceItem, MultipleChoiceOption } from "@/lib/exercises/types";
import { InstructionsRichTextField } from "./instructions-rich-text-field";
import type { TypeSwitchHandle } from "./type-switch-handle";
import { useFileOrLink } from "@/components/file-or-link-field";
import { ImageOrPlaceholder } from "@/components/image-or-placeholder";
import { INPUT_BORDER } from "@/lib/input-styles";
import { LABEL_TEXT, HINT_TEXT } from "@/lib/typography-styles";

// Окремий компонент (не інлайн у .map()) — useFileOrLink це хук, викликати
// його всередині callback .map() було б порушенням правил хуків.
function MultipleChoiceOptionRow({
  option,
  onToggleCorrect,
  onUpdateText,
  onUpdateImageUrl,
  onRemove,
}: {
  option: MultipleChoiceOption;
  onToggleCorrect: () => void;
  onUpdateText: (value: string) => void;
  onUpdateImageUrl: (url: string) => void;
  onRemove: () => void;
}) {
  const { icons, input } = useFileOrLink({
    kind: "image",
    mode: "controlled",
    value: option.imageUrl ?? "",
    onChange: onUpdateImageUrl,
    placeholder: "URL картинки (опційно)",
    allowFocus: true,
  });

  return (
    <div
      className={`flex flex-col gap-1 rounded-md p-1 ${
        option.correct ? "bg-emerald-50 dark:bg-emerald-950/20" : ""
      }`}
    >
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={option.correct}
          onChange={onToggleCorrect}
          title="Правильний варіант"
        />
        <input
          value={option.text}
          onChange={(e) => onUpdateText(e.target.value)}
          placeholder="Текст варіанту"
          className={`${INPUT_BORDER} flex-1 px-2 py-2 text-base font-medium font-content`}
        />
        {icons}
        <button
          type="button"
          onClick={onRemove}
          aria-label="Видалити варіант"
          title="Видалити"
          className="rounded p-1.5 text-neutral-400 hover:text-red-600 dark:text-neutral-500 dark:hover:text-red-400"
        >
          <Trash2 size={16} />
        </button>
      </div>
      <div className="flex items-start gap-1 pl-6">
        {input}
        <ImageOrPlaceholder
          src={option.imageUrl}
          alt="Прев'ю"
          className="h-12 w-12 shrink-0 rounded object-cover"
          useFocus
        />
      </div>
    </div>
  );
}

function emptyItem(): MultipleChoiceItem {
  return {
    id: crypto.randomUUID(),
    sentence: "",
    options: [
      { id: crypto.randomUUID(), text: "", correct: true },
      { id: crypto.randomUUID(), text: "", correct: false },
    ],
  };
}

export const MultipleChoiceFields = forwardRef<
  TypeSwitchHandle<MultipleChoiceConfig>,
  { initialConfig?: Partial<MultipleChoiceConfig> }
>(function MultipleChoiceFields({ initialConfig }, ref) {
  const [display, setDisplay] = useState<"buttons" | "dropdown">(
    initialConfig?.display ?? "buttons"
  );
  const [items, setItems] = useState<MultipleChoiceItem[]>(
    initialConfig?.items?.length ? initialConfig.items : [emptyItem()]
  );

  // Для переносу сумісних даних при зміні типу (напр. → listening) —
  // читається в task-config-fields.tsx ПЕРЕД розмонтуванням цього
  // компонента, той самий принцип, що ImportableFieldsHandle. instructions/
  // subInstructions беруться з initialConfig (не живий стан) —
  // InstructionsRichTextField не віддає своє поточне значення назовні, тож
  // тут переноситься те, що було в БД до відкриття форми, а не щойно
  // введені редагування — прийнятний компроміс, головна цінність цього
  // переносу — масив items/questions, не текст інструкції.
  useImperativeHandle(ref, () => ({
    getValue: () => ({
      instructions: initialConfig?.instructions,
      subInstructions: initialConfig?.subInstructions,
      display,
      items,
    }),
  }));

  function addItem() {
    setItems((prev) => [...prev, emptyItem()]);
  }

  function removeItem(id: string) {
    setItems((prev) => prev.filter((it) => it.id !== id));
  }

  function updateSentence(id: string, sentence: string) {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, sentence } : it)));
  }

  function addOption(itemId: string) {
    setItems((prev) =>
      prev.map((it) =>
        it.id === itemId
          ? { ...it, options: [...it.options, { id: crypto.randomUUID(), text: "", correct: false }] }
          : it
      )
    );
  }

  function removeOption(itemId: string, optId: string) {
    setItems((prev) =>
      prev.map((it) =>
        it.id === itemId ? { ...it, options: it.options.filter((o) => o.id !== optId) } : it
      )
    );
  }

  function updateOptionText(itemId: string, optId: string, text: string) {
    setItems((prev) =>
      prev.map((it) =>
        it.id === itemId
          ? { ...it, options: it.options.map((o) => (o.id === optId ? { ...o, text } : o)) }
          : it
      )
    );
  }

  function updateOptionImageUrl(itemId: string, optId: string, imageUrl: string) {
    setItems((prev) =>
      prev.map((it) =>
        it.id === itemId
          ? { ...it, options: it.options.map((o) => (o.id === optId ? { ...o, imageUrl } : o)) }
          : it
      )
    );
  }

  function updatePoints(itemId: string, points: number) {
    setItems((prev) => prev.map((it) => (it.id === itemId ? { ...it, points } : it)));
  }

  function toggleCorrect(itemId: string, optId: string) {
    setItems((prev) =>
      prev.map((it) =>
        it.id === itemId
          ? {
              ...it,
              options: it.options.map((o) => (o.id === optId ? { ...o, correct: !o.correct } : o)),
            }
          : it
      )
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded-md bg-neutral-50 p-3 dark:bg-neutral-900">
      <input type="hidden" name="mc_items" value={JSON.stringify(items)} readOnly />

      <InstructionsRichTextField
        name="mc_instructions"
        label="Інструкція для студента"
        initialValue={initialConfig?.instructions ?? ""}
      />

      <InstructionsRichTextField
        name="mc_sub_instructions"
        label="Додаткові інструкції (опційно)"
        initialValue={initialConfig?.subInstructions ?? ""}
        compact
      />

      <div className="flex flex-col gap-1">
        <label className={LABEL_TEXT}>Подання</label>
        <select
          name="mc_display"
          value={display}
          onChange={(e) => setDisplay(e.target.value as "buttons" | "dropdown")}
          className={`${INPUT_BORDER} px-2 py-2 text-sm`}
        >
          <option value="buttons">Варіанти видно одразу</option>
          <option value="dropdown">Випадаючий список</option>
        </select>
      </div>

      <div className="flex flex-col gap-3">
        {items.map((item, ii) => (
          <div key={item.id} className="rounded-md border border-gray-100 p-2 dark:border-neutral-700">
            <div className="flex items-center justify-between">
              <span className={HINT_TEXT}>
                Речення {ii + 1}
              </span>
              <div className="flex items-center gap-2">
                <span className={HINT_TEXT}>Бали</span>
                <input
                  type="number"
                  min={0}
                  step={0.5}
                  value={item.points ?? 1}
                  onChange={(e) => updatePoints(item.id, Number(e.target.value))}
                  title="Бали за це речення"
                  className={`${INPUT_BORDER} w-16 px-2 py-2 text-sm`}
                />
                <button
                  type="button"
                  onClick={() => removeItem(item.id)}
                  aria-label="Видалити речення"
                  title="Видалити речення"
                  className="rounded p-1.5 text-neutral-400 hover:text-red-600 dark:text-neutral-500 dark:hover:text-red-400"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
            <textarea
              value={item.sentence}
              onChange={(e) => updateSentence(item.id, e.target.value)}
              rows={2}
              placeholder={
                display === "dropdown"
                  ? "напр. Je {{}} au cinéma. — {{}} позначає, де буде випадаючий список"
                  : "Текст речення"
              }
              className={`${INPUT_BORDER} mt-2 w-full px-2 py-1 text-base font-medium font-content`}
            />
            <div className="mt-2 flex flex-col gap-1 pl-2">
              <label className={LABEL_TEXT}>
                Варіанти (позначте правильні)
              </label>
              {item.options.map((o) => (
                <MultipleChoiceOptionRow
                  key={o.id}
                  option={o}
                  onToggleCorrect={() => toggleCorrect(item.id, o.id)}
                  onUpdateText={(text) => updateOptionText(item.id, o.id, text)}
                  onUpdateImageUrl={(url) => updateOptionImageUrl(item.id, o.id, url)}
                  onRemove={() => removeOption(item.id, o.id)}
                />
              ))}
              <button
                type="button"
                onClick={() => addOption(item.id)}
                className="self-start text-xs text-blue-700 hover:underline dark:text-blue-400"
              >
                + варіант
              </button>
            </div>
          </div>
        ))}
        <button
          type="button"
          onClick={addItem}
          className="self-start text-xs text-blue-700 hover:underline dark:text-blue-400"
        >
          + речення
        </button>
      </div>
    </div>
  );
});
