"use client";

import { forwardRef, useImperativeHandle, useState, type ReactNode } from "react";
import { Trash2 } from "lucide-react";
import type { ImageMatchConfig, ImageMatchItem } from "@/lib/exercises/types";
import type { ImportableFieldsHandle } from "./importable-fields";
import { InstructionsRichTextField } from "./instructions-rich-text-field";
import { useFileOrLink } from "@/components/file-or-link-field";
import { ImageOrPlaceholder } from "@/components/image-or-placeholder";
import { INPUT_BORDER } from "@/lib/input-styles";
import { HINT_TEXT } from "@/lib/typography-styles";
import { ConstructorBlock, CONSTRUCTOR_ITEM_CARD } from "./constructor-block";

function emptyItem(): ImageMatchItem {
  return { id: crypto.randomUUID(), imageUrl: "", name: "" };
}

// Окремий компонент (не інлайн у .map()) — useFileOrLink це хук, викликати
// його всередині callback .map() було б порушенням правил хуків.
function ImageMatchItemRow({
  item,
  onUpdate,
  onUpdatePoints,
  onRemove,
}: {
  item: ImageMatchItem;
  onUpdate: (field: "imageUrl" | "name", value: string) => void;
  onUpdatePoints: (points: number) => void;
  onRemove: () => void;
}) {
  const { icons, input } = useFileOrLink({
    kind: "image",
    mode: "controlled",
    value: item.imageUrl,
    onChange: (url) => onUpdate("imageUrl", url),
    placeholder: "URL зображення",
    allowFocus: true,
  });

  return (
    <div className={`flex flex-col gap-1 p-2 ${CONSTRUCTOR_ITEM_CARD}`}>
      <div className="flex items-center gap-2">
        <input
          value={item.name}
          onChange={(e) => onUpdate("name", e.target.value)}
          placeholder="Правильна назва"
          className={`${INPUT_BORDER} flex-1 px-2 py-2 text-base font-medium font-content`}
        />
        <span className={HINT_TEXT}>Бали</span>
        <input
          type="number"
          min={0}
          step={0.5}
          value={item.points ?? 1}
          onChange={(e) => onUpdatePoints(Number(e.target.value))}
          title="Бали за це зображення"
          className={`${INPUT_BORDER} w-16 px-2 py-2 text-sm`}
        />
        {icons}
        <button
          type="button"
          onClick={onRemove}
          aria-label="Видалити зображення"
          title="Видалити"
          className="rounded p-1.5 text-neutral-400 hover:text-red-600 dark:text-neutral-500 dark:hover:text-red-400"
        >
          <Trash2 size={16} />
        </button>
      </div>
      <div className="flex items-start gap-1">
        {input}
        <ImageOrPlaceholder
          src={item.imageUrl}
          alt="Прев'ю"
          className="h-12 w-12 shrink-0 rounded object-cover"
          useFocus
        />
      </div>
    </div>
  );
}

export const ImageMatchFields = forwardRef<
  ImportableFieldsHandle,
  { initialConfig?: Partial<ImageMatchConfig>; pointsVisibilityCheckbox?: ReactNode; importVocabPanel?: ReactNode }
>(function ImageMatchFields({ initialConfig, pointsVisibilityCheckbox, importVocabPanel }, ref) {
  const [items, setItems] = useState<ImageMatchItem[]>(
    initialConfig?.items?.length ? initialConfig.items : [emptyItem()]
  );

  useImperativeHandle(ref, () => ({
    // image_url з імпортованого слова (якщо було заповнене в скрипті сцени)
    // одразу підставляється; якщо порожнє (custom-термін) — вчитель дописує
    // URL вручну в самому рядку.
    importWords(words) {
      setItems((prev) => {
        const withoutEmpty = prev.filter((it) => it.imageUrl.trim() || it.name.trim());
        return [
          ...withoutEmpty,
          ...words.map((w) => ({
            id: crypto.randomUUID(),
            imageUrl: w.image_url ?? "",
            name: w.word,
          })),
        ];
      });
    },
  }));

  function addItem() {
    setItems((prev) => [...prev, emptyItem()]);
  }

  function removeItem(id: string) {
    setItems((prev) => prev.filter((it) => it.id !== id));
  }

  function updateItem(id: string, field: "imageUrl" | "name", value: string) {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, [field]: value } : it)));
  }

  function updatePoints(id: string, points: number) {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, points } : it)));
  }

  return (
    <>
      <input type="hidden" name="image_match_items" value={JSON.stringify(items)} readOnly />

      <ConstructorBlock
        n={2}
        title="Інструкція для студента"
        description="Французькою, українською та англійською"
        tone="instruction"
      >
        <InstructionsRichTextField
          name="image_match_instructions"
          label="Інструкція для студента"
          initialValue={initialConfig?.instructions ?? ""}
        />

        <InstructionsRichTextField
          name="image_match_sub_instructions"
          label="Додаткові інструкції (опційно)"
          initialValue={initialConfig?.subInstructions ?? ""}
          compact
        />

        <InstructionsRichTextField
          name="image_match_sub_instructions_en"
          label="Переклад завдання англійською (для англомовного інтерфейсу)"
          initialValue={initialConfig?.subInstructionsEn ?? ""}
          compact
        />
      </ConstructorBlock>

      {pointsVisibilityCheckbox && (
        <ConstructorBlock n={3} title="Бали та підказки" description="Оцінювання" tone="points">
          {pointsVisibilityCheckbox}
        </ConstructorBlock>
      )}

      {importVocabPanel}

      <ConstructorBlock
        n={4}
        title="Варіанти вправи"
        description="Зображення та правильні назви"
        tone="content"
      >
      {items.map((item) => (
        <ImageMatchItemRow
          key={item.id}
          item={item}
          onUpdate={(field, value) => updateItem(item.id, field, value)}
          onUpdatePoints={(points) => updatePoints(item.id, points)}
          onRemove={() => removeItem(item.id)}
        />
      ))}
      <button
        type="button"
        onClick={addItem}
        className="self-start text-xs text-blue-700 hover:underline dark:text-blue-400"
      >
        + зображення
      </button>
      </ConstructorBlock>
    </>
  );
});
