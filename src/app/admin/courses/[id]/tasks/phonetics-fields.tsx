"use client";

import { forwardRef, useImperativeHandle, useState } from "react";
import { Trash2 } from "lucide-react";
import type { PhoneticsConfig, PhoneticsItem } from "@/lib/exercises/types";
import { InstructionsRichTextField } from "./instructions-rich-text-field";
import type { TypeSwitchHandle } from "./type-switch-handle";
import { useFileOrLink } from "@/components/file-or-link-field";
import { INPUT_BORDER } from "@/lib/input-styles";

function emptyItem(): PhoneticsItem {
  return { text: "", transcription: "", mediaUrl: "", imageUrl: "" };
}

// Окремий компонент на репліку (не інлайн у .map()) — useFileOrLink це хук,
// викликати його всередині callback .map() було б порушенням правил хуків.
function PhoneticsItemRow({
  item,
  onUpdateField,
  onRemove,
}: {
  item: PhoneticsItem;
  onUpdateField: (field: keyof PhoneticsItem, value: string) => void;
  onRemove: () => void;
}) {
  const image = useFileOrLink({
    kind: "image",
    mode: "controlled",
    value: item.imageUrl ?? "",
    onChange: (url) => onUpdateField("imageUrl", url),
    placeholder: "Картинка (URL, необов'язково)",
    allowFocus: true,
  });
  const audio = useFileOrLink({
    kind: "audio",
    mode: "controlled",
    value: item.mediaUrl ?? "",
    onChange: (url) => onUpdateField("mediaUrl", url),
    placeholder: "Аудіо або відео (URL, необов'язково)",
  });

  return (
    <div className="flex flex-col gap-1 rounded-md border border-gray-100 p-2 dark:border-neutral-700">
      <div className="flex items-center gap-2">
        <input
          value={item.text}
          onChange={(e) => onUpdateField("text", e.target.value)}
          placeholder="Репліка (французькою)"
          className={`${INPUT_BORDER} flex-1 px-2 py-2 text-base font-medium font-content`}
        />
        <button
          type="button"
          onClick={onRemove}
          aria-label="Видалити репліку"
          title="Видалити"
          className="rounded p-1.5 text-neutral-400 hover:text-red-600 dark:text-neutral-500 dark:hover:text-red-400"
        >
          <Trash2 size={16} />
        </button>
      </div>
      <input
        value={item.transcription}
        onChange={(e) => onUpdateField("transcription", e.target.value)}
        placeholder="Транскрипція (напр. [ʒə vɛ bjɛ̃])"
        className={`${INPUT_BORDER} px-2 py-2 text-base font-medium font-content`}
      />
      <div className="flex items-center gap-2">
        {image.icons}
        {audio.icons}
      </div>
      {(image.input || audio.input) && (
        <div className="flex flex-wrap items-start gap-2">
          {image.input && <div className="flex-1">{image.input}</div>}
          {audio.input && <div className="flex-1">{audio.input}</div>}
        </div>
      )}
    </div>
  );
}

// Без ImportableFieldsHandle — навмисно без імпорту лексики: vocab дає лише
// {word, translation}, без транскрипції й медіа, а phonetics про фрази з
// транскрипцією, тож слово-в-слово імпорт більше плутав би, ніж допомагав.
// forwardRef тут лише для TypeSwitchHandle (перенос при зміні типу ↔
// flip_cards), не для імпорту.
export const PhoneticsFields = forwardRef<
  TypeSwitchHandle<PhoneticsConfig>,
  { initialConfig?: Partial<PhoneticsConfig> }
>(function PhoneticsFields({ initialConfig }, ref) {
  const [items, setItems] = useState<PhoneticsItem[]>(
    initialConfig?.items?.length ? initialConfig.items : [emptyItem()]
  );

  useImperativeHandle(ref, () => ({
    getValue: () => ({
      instructions: initialConfig?.instructions,
      subInstructions: initialConfig?.subInstructions,
      items,
    }),
  }));

  function addItem() {
    setItems((prev) => [...prev, emptyItem()]);
  }

  function removeItem(i: number) {
    setItems((prev) => prev.filter((_, idx) => idx !== i));
  }

  function updateItem(i: number, field: keyof PhoneticsItem, value: string) {
    setItems((prev) => prev.map((it, idx) => (idx === i ? { ...it, [field]: value } : it)));
  }

  return (
    <div className="flex flex-col gap-3 rounded-md bg-neutral-50 p-3 dark:bg-neutral-900">
      <input type="hidden" name="phonetics_items" value={JSON.stringify(items)} readOnly />

      <InstructionsRichTextField
        name="phonetics_instructions"
        label="Інструкція для студента"
        initialValue={initialConfig?.instructions ?? ""}
      />

      <InstructionsRichTextField
        name="phonetics_sub_instructions"
        label="Додаткові інструкції (опційно)"
        initialValue={initialConfig?.subInstructions ?? ""}
        compact
      />

      {items.map((item, i) => (
        <PhoneticsItemRow
          key={i}
          item={item}
          onUpdateField={(field, value) => updateItem(i, field, value)}
          onRemove={() => removeItem(i)}
        />
      ))}
      <button
        type="button"
        onClick={addItem}
        className="self-start text-xs text-blue-700 hover:underline dark:text-blue-400"
      >
        + додати репліку
      </button>
    </div>
  );
});
