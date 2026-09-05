"use client";

import { useState } from "react";
import type { MultipleChoicePublic, MultipleChoiceDetail } from "@/lib/exercises/types";
import { useExerciseCheck } from "./use-exercise-check";
import { SELECTED_OPTION_CLASS } from "./selection-style";
import { DEFAULT_INSTRUCTIONS } from "@/lib/exercises/default-instructions";
import { pluralizePoints } from "@/lib/pluralize-points";
import { InstructionsText } from "./instructions-text";
import { ImageOrPlaceholder } from "@/components/image-or-placeholder";

type MultipleChoicePublicItem = MultipleChoicePublic["items"][number];
type ItemDetail = MultipleChoiceDetail["items"][number];

export function MultipleChoiceExercise({
  taskId,
  config,
  pointsVisible,
}: {
  taskId: string;
  config: MultipleChoicePublic;
  pointsVisible: boolean;
}) {
  const [selections, setSelections] = useState<Record<string, string[]>>({});
  const { submit, pending, result, error } = useExerciseCheck(taskId);
  const detail = result?.detail as MultipleChoiceDetail | undefined;

  function toggle(itemId: string, optionId: string, multiple: boolean) {
    if (result) return;
    setSelections((prev) => {
      const current = prev[itemId] ?? [];
      const next = multiple
        ? current.includes(optionId)
          ? current.filter((v) => v !== optionId)
          : [...current, optionId]
        : [optionId];
      return { ...prev, [itemId]: next };
    });
  }

  function optionClass(itemId: string, optionId: string, itemDetail?: ItemDetail) {
    if (!itemDetail) {
      const sel = selections[itemId] ?? [];
      return sel.includes(optionId)
        ? SELECTED_OPTION_CLASS
        : "hover:bg-neutral-50 dark:hover:bg-neutral-800";
    }
    const opt = itemDetail.options.find((o) => o.id === optionId);
    if (!opt) return "";
    // Той самий принцип, що в true-false.tsx: правильний варіант завжди
    // зелений (обраний він чи ні), а червоним — лише те, що студент обрав
    // помилково.
    if (opt.correct) return "border-green-500 bg-green-50 dark:bg-green-950/30";
    if (opt.selected) return "border-red-500 bg-red-50 dark:bg-red-950/30";
    return "opacity-60";
  }

  // Для варіантів із картинкою підсвічення переноситься з усієї кнопки
  // (як для текстових варіантів вище) на маленький квадратик-чекбокс поруч
  // із текстом — та сама інформація (обрано/правильно/неправильно), лише
  // менш нав'язливо на тлі картинки. Кнопка сама лишається нейтральною.
  function imageOptionIndicator(itemId: string, optionId: string, itemDetail?: ItemDetail) {
    if (!itemDetail) {
      const sel = selections[itemId] ?? [];
      const selected = sel.includes(optionId);
      return {
        mark: selected ? "✓" : "",
        className: selected
          ? "border-blue-600 bg-blue-600 text-white"
          : "border-neutral-300 dark:border-neutral-600",
      };
    }
    const opt = itemDetail.options.find((o) => o.id === optionId);
    if (opt?.correct) {
      return { mark: "✓", className: "border-green-600 bg-green-600 text-white" };
    }
    if (opt?.selected) {
      return { mark: "✕", className: "border-red-600 bg-red-600 text-white" };
    }
    return { mark: "", className: "border-neutral-300 opacity-60 dark:border-neutral-600" };
  }

  // До перевірки — лише якщо pointsVisible; після — завжди. Речення
  // зараховується цілком (atomic unit = item), тому 0/points — не часткове.
  function pointsBadge(item: MultipleChoicePublicItem, itemDetail?: ItemDetail) {
    if (!pointsVisible && !itemDetail) return null;
    if (itemDetail) {
      const isCorrect = itemDetail.options.every((o) => o.correct === o.selected);
      return (
        <span className="ml-2 text-xs italic text-neutral-500 dark:text-neutral-400">
          {isCorrect ? item.points : 0}/{item.points} {pluralizePoints(item.points)}
        </span>
      );
    }
    return (
      <span className="ml-2 text-xs italic text-neutral-500 dark:text-neutral-400">
        {item.points} {pluralizePoints(item.points)}
      </span>
    );
  }

  function renderItem(item: MultipleChoicePublicItem) {
    const itemDetail = detail?.items.find((d) => d.id === item.id);
    const sel = selections[item.id] ?? [];

    if (config.display === "buttons") {
      return (
        <div key={item.id}>
          <p className="font-medium">
            {item.sentence}
            {pointsBadge(item, itemDetail)}
          </p>
          {item.multiple && (
            <p className="text-xs italic text-neutral-500 dark:text-neutral-400">
              {item.correctCount} {item.correctCount >= 5 ? "варіантів" : "варіанти"}
            </p>
          )}
          {/* grid, не суворо один стовпчик — на вузькому екрані природно
              переходить в один стовпчик (вертикально), на широкому — кілька
              поруч (горизонтально). */}
          <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {item.options.map((o) =>
              o.imageUrl ? (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => toggle(item.id, o.id, item.multiple)}
                  disabled={!!result}
                  className="rounded-md border border-neutral-200 p-2 text-left text-sm transition-none hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-800"
                >
                  <ImageOrPlaceholder
                    src={o.imageUrl}
                    alt={o.text || ""}
                    className="mx-auto h-20 w-20 rounded object-contain"
                  />
                  <div className="mt-1 flex items-center justify-center gap-1.5">
                    <span
                      aria-hidden
                      className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border text-[10px] leading-none ${imageOptionIndicator(item.id, o.id, itemDetail).className}`}
                    >
                      {imageOptionIndicator(item.id, o.id, itemDetail).mark}
                    </span>
                    {o.text && <span>{o.text}</span>}
                  </div>
                </button>
              ) : (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => toggle(item.id, o.id, item.multiple)}
                  disabled={!!result}
                  className={`rounded-md border px-3 py-1.5 text-left text-sm transition-none ${optionClass(item.id, o.id, itemDetail)}`}
                >
                  {o.text}
                </button>
              )
            )}
          </div>
        </div>
      );
    }

    // dropdown — вбудований посередині речення через рівно один "{{}}"
    // (не BLANK_RE-цикл fill_blank на довільну кількість пропусків — тут
    // завжди рівно один вибір на речення).
    const [before, after] = item.sentence.split("{{}}");
    return (
      <div key={item.id}>
        <p className="leading-8">
          {before}
          <select
            multiple={item.multiple}
            value={item.multiple ? sel : (sel[0] ?? "")}
            onChange={(e) => {
              const next = item.multiple
                ? Array.from(e.target.selectedOptions).map((o) => o.value)
                : [e.target.value];
              setSelections((prev) => ({ ...prev, [item.id]: next }));
            }}
            disabled={!!result}
            className={`mx-1 rounded-md border px-2 py-1 text-sm align-middle ${
              sel.length > 0 && sel[0] !== "" ? SELECTED_OPTION_CLASS : ""
            }`}
          >
            {!item.multiple && <option value="">— Оберіть —</option>}
            {item.options.map((o) => (
              <option key={o.id} value={o.id}>
                {o.text}
              </option>
            ))}
          </select>
          {after ?? ""}
          {pointsBadge(item, itemDetail)}
        </p>
        {item.multiple && (
          <p className="mt-1 text-xs italic text-neutral-500 dark:text-neutral-400">
            {item.correctCount} {item.correctCount >= 5 ? "варіантів" : "варіанти"}
          </p>
        )}
      </div>
    );
  }

  const allAnswered = config.items.every((it) => (selections[it.id] ?? []).length > 0);

  return (
    <div>
      <InstructionsText
        text={config.instructions ?? DEFAULT_INSTRUCTIONS.multiple_choice}
        subText={config.subInstructions}
        className="mb-2 font-medium"
      />

      <div className="flex flex-col gap-4">{config.items.map(renderItem)}</div>

      {!result ? (
        <button
          type="button"
          onClick={() =>
            submit(config.items.map((it) => ({ itemId: it.id, selected: selections[it.id] ?? [] })))
          }
          disabled={pending || !allAnswered}
          className="mt-4 rounded-md bg-black px-3 py-1.5 text-sm text-white hover:bg-neutral-800 disabled:opacity-50 dark:bg-white dark:text-black dark:hover:bg-neutral-200"
        >
          {pending ? "Перевіряю..." : "Перевірити"}
        </button>
      ) : (
        <p
          className={`mt-3 text-sm font-medium ${
            result.correct ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
          }`}
        >
          {result.correct ? "Правильно! ✓" : `Результат: ${result.score}%`}
          {result.pointsPossible !== undefined && (
            <span className="ml-2 font-normal text-neutral-500 dark:text-neutral-400">
              ({result.pointsEarned} з {result.pointsPossible} {pluralizePoints(result.pointsPossible)})
            </span>
          )}
        </p>
      )}

      {error && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}
