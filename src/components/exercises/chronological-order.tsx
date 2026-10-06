"use client";

import { useState, useEffect } from "react";
import type {
  ChronologicalOrderPublic,
  ChronologicalOrderDetail,
  ChronologicalOrderAnswer,
  GradeResult,
} from "@/lib/exercises/types";
import { ImageOrPlaceholder } from "@/components/image-or-placeholder";
import { ImageZoomBadge } from "./image-zoom-badge";
import { ImageLightbox } from "./image-lightbox";
import { useExerciseCheck } from "./use-exercise-check";
import { DEFAULT_INSTRUCTIONS } from "@/lib/exercises/default-instructions";
import { pluralizePoints } from "@/lib/pluralize-points";
import { InstructionsText } from "./instructions-text";
import { ANSWER_CARD_BASE, ANSWER_CARD_DEFAULT, ITEM_LETTER_BADGE } from "./answer-card-style";
import { STUDENT_BUTTON_PRIMARY } from "@/lib/button-styles";
import { EXERCISE_STACK, EXERCISE_BODY_ITEMS_GAP } from "@/lib/spacing";
import { RESULT_MESSAGE_CLASS, SCORE_LABEL_CLASS } from "./score-style";

// Мітка показу (A, B, C...) рахується на льоту з індексу вже перемішаного
// config.items — публічний тип свідомо не зберігає її окремо (див.
// ChronologicalOrderPublic у types.ts). Після Z переходить на AA, AB... —
// той самий принцип, що назви колонок у таблиці, про всяк випадок для
// вправ з >26 елементами (малоймовірно, але дешево покрити).
function indexToLabel(index: number): string {
  let n = index;
  let label = "";
  do {
    label = String.fromCharCode(65 + (n % 26)) + label;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return label;
}

export function ChronologicalOrderExercise({
  taskId,
  config,
  pointsVisible,
  onResult,
  hidePoints,
}: {
  taskId: string;
  config: ChronologicalOrderPublic;
  pointsVisible: boolean;
  onResult?: (result: GradeResult) => void;
  hidePoints?: boolean;
}) {
  const [positions, setPositions] = useState<Record<string, string>>({});
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
  const { submit, pending, result, error } = useExerciseCheck(taskId);
  const detail = result?.detail as ChronologicalOrderDetail | undefined;

  useEffect(() => {
    if (result) onResult?.(result);
  }, [result, onResult]);

  function updatePosition(itemId: string, value: string) {
    setPositions((prev) => ({ ...prev, [itemId]: value }));
  }

  function itemDetail(itemId: string) {
    return detail?.items.find((i) => i.id === itemId);
  }

  function inputClass(itemId: string) {
    const d = itemDetail(itemId);
    if (!d) return "border-gray-300 dark:border-neutral-600";
    return d.isCorrect
      ? "border-green-500 bg-green-50 dark:bg-green-950/30"
      : "border-red-500 bg-red-50 dark:bg-red-950/30";
  }

  function pointsLabel(itemId: string, points: number) {
    if (hidePoints) return null;
    const d = itemDetail(itemId);
    if (!pointsVisible && !d) return null;
    if (d) {
      return `${d.isCorrect ? points : 0}/${points} ${pluralizePoints(points)}`;
    }
    return `${points} ${pluralizePoints(points)}`;
  }

  function handleSubmit() {
    const answer: ChronologicalOrderAnswer = config.items.map((item) => ({
      itemId: item.id,
      position: Number(positions[item.id] ?? ""),
    }));
    submit(answer);
  }

  function numberInput(itemId: string, variant: "wide" | "square" = "wide") {
    const sizeClass = variant === "square" ? "h-11 w-11 px-1 text-center" : "w-16 px-2";
    return (
      <input
        type="number"
        min={1}
        max={config.items.length}
        value={positions[itemId] ?? ""}
        onChange={(e) => updatePosition(itemId, e.target.value)}
        disabled={!!result}
        placeholder="№"
        className={`${sizeClass} rounded border py-1 text-sm ${inputClass(itemId)}`}
      />
    );
  }

  return (
    <div className={EXERCISE_STACK}>
      <InstructionsText
        text={config.instructions ?? DEFAULT_INSTRUCTIONS.chronological_order.instruction}
        subText={config.subInstructions ?? DEFAULT_INSTRUCTIONS.chronological_order.subInstruction}
      />

      {config.mode === "image" || config.mode === "mixed" ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {config.items.map((item, i) => (
            <div key={item.id} className={`flex flex-col items-center gap-1 ${ANSWER_CARD_BASE} ${ANSWER_CARD_DEFAULT}`}>
              {/* self-stretch — картка (items-center) інакше не дає дочірньому
                  div визначеної ширини: без неї w-full картинки не може
                  розв'язатись (resolve) проти "auto" батька і браузер falls
                  back на ПРИРОДНУ ширину фото (звідси індик/курка різної
                  ширини при однаковій h-24). self-stretch розтягує div на
                  всю ширину картки (визначена гридом), aspect-square тоді
                  рахує висоту від цієї вже певної ширини — однаковий квадрат
                  незалежно від пропорцій фото; max-w-48+mx-auto — лише
                  обмеження й центрування на десктопі (на вузькій мобільній
                  картці max-w-48 не спрацьовує, вигляд як був). */}
              <div className="relative mx-auto aspect-square w-full max-w-48 self-stretch">
                <ImageZoomBadge onOpen={() => setLightboxSrc(item.content)} />
                <ImageOrPlaceholder
                  src={item.content}
                  alt=""
                  className="h-full w-full rounded-md object-cover"
                  useFocus
                />
                <span className={`absolute left-1 top-1 ${ITEM_LETTER_BADGE}`}>
                  {indexToLabel(i)}
                </span>
              </div>
              {config.mode === "mixed" && (
                <p className="text-center text-sm font-medium">{item.text}</p>
              )}
              <div className="flex items-center justify-center gap-2">
                <span className="text-xs text-neutral-500 dark:text-neutral-400">
                  Situation n°
                </span>
                {numberInput(item.id)}
              </div>
              {!hidePoints && (pointsVisible || itemDetail(item.id)) ? (
                <p className={`text-center ${SCORE_LABEL_CLASS}`}>
                  {pointsLabel(item.id, item.points)}
                </p>
              ) : null}
            </div>
          ))}
        </div>
      ) : (
        <div className={`flex flex-col ${EXERCISE_BODY_ITEMS_GAP}`}>
          {config.items.map((item, i) => (
            <div key={item.id} className={`flex items-start gap-3 ${ANSWER_CARD_BASE} ${ANSWER_CARD_DEFAULT}`}>
              <span className={ITEM_LETTER_BADGE}>{indexToLabel(i)}</span>
              <span className="flex-1 pt-1 text-left">{item.content}</span>
              {numberInput(item.id, "square")}
              {!hidePoints && (pointsVisible || itemDetail(item.id)) && (
                <span className={`w-16 text-right ${SCORE_LABEL_CLASS}`}>
                  {pointsLabel(item.id, item.points)}
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-col gap-3">
        {!result ? (
          <button
            type="button"
            onClick={handleSubmit}
            disabled={pending}
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
