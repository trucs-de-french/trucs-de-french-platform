"use client";

import { forwardRef, useImperativeHandle, useState } from "react";
import { Trash2 } from "lucide-react";
import type { FlipCardsConfig, FlipCard } from "@/lib/exercises/types";
import { buildConfigFromVocab, STRIP_ARTICLES_DEFAULT } from "@/lib/exercises/task-config-builder";
import type { ImportableFieldsHandle } from "./importable-fields";
import type { TypeSwitchHandle } from "./type-switch-handle";
import { InstructionsRichTextField } from "./instructions-rich-text-field";
import { StripArticlesToggle } from "./strip-articles-toggle";
import { useFileOrLink } from "@/components/file-or-link-field";
import { ImageOrPlaceholder } from "@/components/image-or-placeholder";
import { INPUT_BORDER } from "@/lib/input-styles";
import { LABEL_TEXT } from "@/lib/typography-styles";

function emptyCard(): FlipCard {
  return { front: "", back: "", image_url: "", audio_url: "" };
}

// Окремий компонент (не інлайн у .map()) — useFileOrLink це хук, викликати
// його всередині callback .map() було б порушенням правил хуків.
function FlipCardRow({
  card,
  onUpdate,
  onRemove,
}: {
  card: FlipCard;
  onUpdate: (field: keyof FlipCard, value: string) => void;
  onRemove: () => void;
}) {
  const image = useFileOrLink({
    kind: "image",
    mode: "controlled",
    value: card.image_url ?? "",
    onChange: (url) => onUpdate("image_url", url),
    placeholder: "Картинка (URL, необов'язково)",
    allowFocus: true,
  });
  const audio = useFileOrLink({
    kind: "audio",
    mode: "controlled",
    value: card.audio_url ?? "",
    onChange: (url) => onUpdate("audio_url", url),
    placeholder: "Аудіо (URL, необов'язково)",
  });

  return (
    <div className="flex flex-col gap-1 rounded-md border border-gray-100 p-2 dark:border-neutral-700">
      <div className="flex items-center gap-2">
        <input
          value={card.front}
          onChange={(e) => onUpdate("front", e.target.value)}
          placeholder="Перед"
          className={`${INPUT_BORDER} flex-1 px-2 py-2 text-base font-medium font-content`}
        />
        <span className="text-neutral-400 dark:text-neutral-500">→</span>
        <input
          value={card.back}
          onChange={(e) => onUpdate("back", e.target.value)}
          placeholder="Зад"
          className={`${INPUT_BORDER} flex-1 px-2 py-2 text-base font-medium font-content`}
        />
        {image.icons}
        {audio.icons}
        <button
          type="button"
          onClick={onRemove}
          aria-label="Видалити картку"
          title="Видалити"
          className="rounded p-1.5 text-neutral-400 hover:text-red-600 dark:text-neutral-500 dark:hover:text-red-400"
        >
          <Trash2 size={16} />
        </button>
      </div>
      {(image.input || audio.input) && (
        <div className="flex flex-wrap items-start gap-2">
          {image.input && (
            <div className="flex items-start gap-1">
              {image.input}
              <ImageOrPlaceholder
                src={card.image_url}
                alt="Прев'ю"
                className="h-12 w-12 shrink-0 rounded object-cover"
                useFocus
              />
            </div>
          )}
          {audio.input && <div className="flex-1">{audio.input}</div>}
        </div>
      )}
    </div>
  );
}

export const FlipCardsFields = forwardRef<
  ImportableFieldsHandle & TypeSwitchHandle<FlipCardsConfig>,
  { initialConfig?: Partial<FlipCardsConfig> }
>(function FlipCardsFields({ initialConfig }, ref) {
  const [cards, setCards] = useState<FlipCard[]>(
    initialConfig?.cards?.length ? initialConfig.cards : [emptyCard()]
  );
  const [mode, setMode] = useState<"manual" | "random_reveal">(initialConfig?.mode ?? "manual");
  const [revealSide, setRevealSide] = useState<"front" | "back">(initialConfig?.revealSide ?? "front");
  const [stripArticles, setStripArticles] = useState(STRIP_ARTICLES_DEFAULT.flip_cards ?? false);

  useImperativeHandle(ref, () => ({
    // buildConfigFromVocab (task-config-builder.ts) — те саме мапування
    // word/translation->front/back, тепер ще й переносить image_url/
    // audio_url слова, якщо вони є у вокабуляру (FlipCard підтримує обидва
    // поля).
    importWords(words) {
      const { cards: newCards } = buildConfigFromVocab("flip_cards", words, { stripArticles }) as {
        cards: FlipCard[];
      };
      setCards((prev) => {
        const withoutEmpty = prev.filter((c) => c.front.trim() || c.back.trim());
        return [...withoutEmpty, ...newCards];
      });
    },
    getValue: () => ({
      instructions: initialConfig?.instructions,
      subInstructions: initialConfig?.subInstructions,
      cards,
      mode,
      revealSide,
    }),
  }));

  function addCard() {
    setCards((prev) => [...prev, emptyCard()]);
  }

  function removeCard(i: number) {
    setCards((prev) => prev.filter((_, idx) => idx !== i));
  }

  function updateCard(i: number, field: keyof FlipCard, value: string) {
    setCards((prev) => prev.map((c, idx) => (idx === i ? { ...c, [field]: value } : c)));
  }

  return (
    <div className="flex flex-col gap-3 rounded-md bg-neutral-50 p-3 dark:bg-neutral-900">
      <input type="hidden" name="flip_cards_cards" value={JSON.stringify(cards)} readOnly />

      <InstructionsRichTextField
        name="flip_cards_instructions"
        label="Інструкція для студента"
        initialValue={initialConfig?.instructions ?? ""}
      />

      <InstructionsRichTextField
        name="flip_cards_sub_instructions"
        label="Додаткові інструкції (опційно)"
        initialValue={initialConfig?.subInstructions ?? ""}
        compact
      />

      <div className="flex flex-wrap gap-3">
        <div className="flex flex-col gap-1">
          <label className={LABEL_TEXT}>Режим</label>
          <select
            name="flip_cards_mode"
            value={mode}
            onChange={(e) => setMode(e.target.value as "manual" | "random_reveal")}
            className={`${INPUT_BORDER} px-2 py-2 text-sm`}
          >
            <option value="manual">Ручне гортання</option>
            <option value="random_reveal">Випадковий вибір</option>
          </select>
        </div>
        {mode === "random_reveal" && (
          <div className="flex flex-col gap-1">
            <label className={LABEL_TEXT}>Яка сторона показується першою</label>
            <select
              name="flip_cards_reveal_side"
              value={revealSide}
              onChange={(e) => setRevealSide(e.target.value as "front" | "back")}
              className={`${INPUT_BORDER} px-2 py-2 text-sm`}
            >
              <option value="front">Французька (перед)</option>
              <option value="back">Переклад (зад)</option>
            </select>
          </div>
        )}
      </div>

      <StripArticlesToggle checked={stripArticles} onChange={setStripArticles} />

      {cards.map((card, i) => (
        <FlipCardRow
          key={i}
          card={card}
          onUpdate={(field, value) => updateCard(i, field, value)}
          onRemove={() => removeCard(i)}
        />
      ))}
      <button
        type="button"
        onClick={addCard}
        className="self-start text-xs text-blue-700 hover:underline dark:text-blue-400"
      >
        + картка
      </button>
    </div>
  );
});
