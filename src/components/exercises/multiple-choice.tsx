"use client";

import { useState, useEffect } from "react";
import type { MultipleChoicePublic, MultipleChoiceDetail, GradeResult } from "@/lib/exercises/types";
import { useExerciseCheck } from "./use-exercise-check";
import { SELECTED_OPTION_CLASS } from "./selection-style";
import { DEFAULT_INSTRUCTIONS } from "@/lib/exercises/default-instructions";
import { pluralizePoints } from "@/lib/pluralize-points";
import { InstructionsText } from "./instructions-text";
import { ImageOrPlaceholder } from "@/components/image-or-placeholder";
import { ImageZoomBadge } from "./image-zoom-badge";
import { ImageLightbox } from "./image-lightbox";
import {
  ANSWER_CARD_BASE,
  ANSWER_CARD_DEFAULT,
  COMPACT_IMAGE_CARD,
  COMPACT_IMAGE_FRAME,
  COMPACT_IMAGE_FILL,
} from "./answer-card-style";
import { STUDENT_BUTTON_PRIMARY } from "@/lib/button-styles";
import { EXERCISE_STACK, EXERCISE_BODY_ITEMS_GAP } from "@/lib/spacing";
import { RESULT_MESSAGE_CLASS, SCORE_LABEL_CLASS } from "./score-style";

type MultipleChoicePublicItem = MultipleChoicePublic["items"][number];
type ItemDetail = MultipleChoiceDetail["items"][number];

export function MultipleChoiceExercise({
  taskId,
  config,
  pointsVisible,
  onResult,
  hidePoints,
}: {
  taskId: string;
  config: MultipleChoicePublic;
  pointsVisible: boolean;
  onResult?: (result: GradeResult) => void;
  hidePoints?: boolean;
}) {
  const [selections, setSelections] = useState<Record<string, string[]>>({});
  const { submit, pending, result, error } = useExerciseCheck(taskId);
  const detail = result?.detail as MultipleChoiceDetail | undefined;
  // Клік по картинці варіанта — вже дія вправи (вибір), тому збільшення
  // винесене в окрему іконку-лупу в кутку (ImageZoomBadge), а не на весь
  // клік по мініатюрі.
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);

  useEffect(() => {
    if (result) onResult?.(result);
  }, [result, onResult]);

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
      return sel.includes(optionId) ? SELECTED_OPTION_CLASS : ANSWER_CARD_DEFAULT;
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
  // (як для текстових варіантів вище) на маленький індикатор-чекбокс
  // оверлеєм у кутку картинки — та сама інформація (обрано/правильно/
  // неправильно), лише менш нав'язливо на тлі картинки. Кнопка сама
  // лишається нейтральною. Білий/нейтральний фон + явна рамка — щоб
  // індикатор читався на будь-якому фото, а не лише на темному.
  function imageOptionIndicator(itemId: string, optionId: string, itemDetail?: ItemDetail) {
    if (!itemDetail) {
      const sel = selections[itemId] ?? [];
      const selected = sel.includes(optionId);
      return {
        mark: selected ? "✓" : "",
        selected,
        className: selected
          ? "border-brand bg-brand text-white"
          : "border-neutral-400 bg-white/90 dark:border-neutral-300 dark:bg-neutral-900/80",
      };
    }
    const opt = itemDetail.options.find((o) => o.id === optionId);
    if (opt?.correct) {
      return { mark: "✓", selected: true, className: "border-green-600 bg-green-600 text-white" };
    }
    if (opt?.selected) {
      return { mark: "✕", selected: true, className: "border-red-600 bg-red-600 text-white" };
    }
    return {
      mark: "",
      selected: false,
      className: "border-neutral-300 bg-white/70 opacity-70 dark:border-neutral-600 dark:bg-neutral-900/50",
    };
  }

  // До перевірки — лише якщо pointsVisible; після — завжди. Речення
  // зараховується цілком (atomic unit = item), тому 0/points — не часткове.
  function pointsBadge(item: MultipleChoicePublicItem, itemDetail?: ItemDetail) {
    if (hidePoints) return null;
    if (!pointsVisible && !itemDetail) return null;
    if (itemDetail) {
      const isCorrect = itemDetail.options.every((o) => o.correct === o.selected);
      return (
        <span className={`ml-2 ${SCORE_LABEL_CLASS}`}>
          {isCorrect ? item.points : 0}/{item.points} {pluralizePoints(item.points)}
        </span>
      );
    }
    return (
      <span className={`ml-2 ${SCORE_LABEL_CLASS}`}>
        {item.points} {pluralizePoints(item.points)}
      </span>
    );
  }

  function renderItem(item: MultipleChoicePublicItem) {
    const itemDetail = detail?.items.find((d) => d.id === item.id);
    const sel = selections[item.id] ?? [];

    if (config.display === "buttons") {
      const hasImages = item.options.some((o) => !!o.imageUrl);
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
          {/* Якщо хоч один варіант має картинку — на мобільній/sm та сама
              сітка, що в chronological_order (3/4 колонки, gap-2) — не
              використовую COMPACT_IMAGE_GRID напряму, бо на md потрібно
              перевизначити ту саму CSS-властивість (grid-template-columns/
              gap) на ТОМУ САМОМУ брейкпоінті — накладання двох класів з
              однаковою специфічністю (constant.md:grid-cols-5 проти
              локального md:grid-cols-4) залежало б від порядку в
              згенерованому Tailwind-шарі, а не від порядку в рядку
              className. Тому база/sm — буквальна копія COMPACT_IMAGE_GRID
              (мобільна й так НЕ міняється за умовою задачі), а md:/lg: —
              повністю локальні, без конфліктів. На md колонок 4, не 5:
              при gap-4+p-3 5 колонок у контейнері max-w-2xl/3xl звужували
              би картинку нижче 104px (капа з COMPACT_IMAGE_FRAME) — 4
              колонки зберігають той самий видимий розмір картинки. Інакше
              (текстові варіанти) — попередня розкладка без змін. */}
          <div
            className={
              hasImages
                ? "mt-2 grid grid-cols-3 gap-2 sm:grid-cols-4 md:mt-4 md:gap-4 lg:gap-5"
                : "mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2"
            }
          >
            {item.options.map((o) => {
              if (!o.imageUrl) {
                // Текстовий варіант у сітці картинок (частина варіантів без
                // картинки) — та сама картка, що й у чисто текстовому
                // питанні (ANSWER_CARD_BASE): grid-cols фіксованої кількості
                // колонок (а не auto-fill) сам підрівнює ширину до картинкових
                // карток у рядку.
                return (
                  <button
                    key={o.id}
                    type="button"
                    onClick={() => toggle(item.id, o.id, item.multiple)}
                    disabled={!!result}
                    className={`${ANSWER_CARD_BASE} ${optionClass(item.id, o.id, itemDetail)}`}
                  >
                    {o.text}
                  </button>
                );
              }
              const indicator = imageOptionIndicator(item.id, o.id, itemDetail);
              return (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => toggle(item.id, o.id, item.multiple)}
                  disabled={!!result}
                  role={item.multiple ? "checkbox" : "radio"}
                  aria-checked={indicator.selected}
                  aria-label={o.text || undefined}
                  className={`${COMPACT_IMAGE_CARD} ${ANSWER_CARD_DEFAULT} md:p-3`}
                >
                  <div className={COMPACT_IMAGE_FRAME}>
                    <ImageOrPlaceholder src={o.imageUrl} alt="" className={COMPACT_IMAGE_FILL} useFocus />
                    <span
                      aria-hidden
                      className={`absolute left-1 top-1 z-10 flex h-5 w-5 items-center justify-center rounded-full border-2 text-xs font-bold leading-none ${indicator.className}`}
                    >
                      {indicator.mark}
                    </span>
                    <ImageZoomBadge
                      onOpen={() => setLightboxSrc(o.imageUrl!)}
                      boxClass="h-6 w-6 before:absolute before:-inset-2 before:content-['']"
                      iconSize={12}
                    />
                  </div>
                  {o.text && (
                    <p
                      className="line-clamp-2 w-full text-center text-[13px] leading-tight sm:line-clamp-3 sm:text-sm md:mt-2.5"
                      title={o.text}
                    >
                      {o.text}
                    </p>
                  )}
                </button>
              );
            })}
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
            className={`mx-1 rounded-md border px-2 py-0.5 text-base align-middle ${
              sel.length > 0 && sel[0] !== "" ? SELECTED_OPTION_CLASS : "border-gray-300 dark:border-neutral-600"
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
    <div className={EXERCISE_STACK}>
      <InstructionsText
        text={config.instructions ?? DEFAULT_INSTRUCTIONS.multiple_choice.instruction}
        subText={config.subInstructions ?? DEFAULT_INSTRUCTIONS.multiple_choice.subInstruction}
      />

      {/* md:gap-10 — локальне розширення EXERCISE_BODY_ITEMS_GAP (сам
          константа лишається "gap-4" для інших вправ): на десктопі
          сусідні питання мають чітко розділятись, на мобільній — без змін.
          Застосовується рівномірно до ВСІХ питань (з картинками й без) —
          той самий ритм між питаннями на десктопі незалежно від вмісту. */}
      <div className={`flex flex-col ${EXERCISE_BODY_ITEMS_GAP} md:gap-10`}>
        {config.items.map(renderItem)}
      </div>

      <div className="flex flex-col gap-3">
        {!result ? (
          <button
            type="button"
            onClick={() =>
              submit(config.items.map((it) => ({ itemId: it.id, selected: selections[it.id] ?? [] })))
            }
            disabled={pending || !allAnswered}
            className={`self-start ${STUDENT_BUTTON_PRIMARY}`}
          >
            {pending ? "Перевіряю..." : "Перевірити"}
          </button>
        ) : (
          <p
            className={`${RESULT_MESSAGE_CLASS} ${
              result.correct ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
            }`}
          >
            {result.correct ? "Правильно! ✓" : `Результат: ${result.score}%`}
            {result.pointsPossible !== undefined && (
              <span className={`ml-2 ${SCORE_LABEL_CLASS}`}>
                ({result.pointsEarned} з {result.pointsPossible} {pluralizePoints(result.pointsPossible)})
              </span>
            )}
          </p>
        )}
        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      </div>

      {lightboxSrc && <ImageLightbox src={lightboxSrc} onClose={() => setLightboxSrc(null)} />}
    </div>
  );
}
