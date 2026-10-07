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
import {
  ANSWER_CARD_DEFAULT,
  COMPACT_IMAGE_GRID,
  COMPACT_IMAGE_CARD,
  COMPACT_IMAGE_FRAME,
  COMPACT_IMAGE_FILL,
} from "./answer-card-style";
import { STUDENT_BUTTON_PRIMARY } from "@/lib/button-styles";
import { EXERCISE_STACK } from "@/lib/spacing";
import { RESULT_MESSAGE_CLASS, SCORE_LABEL_CLASS } from "./score-style";

// Менший за ITEM_LETTER_BADGE (answer-card-style.ts) варіант — лише для
// щільної сітки image/mixed нижче. ITEM_LETTER_BADGE лишається незмінним:
// його ще використовують vocab-quiz.tsx і режим text цього ж компонента.
const ITEM_LETTER_BADGE_SM =
  "flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand text-[11px] font-medium text-white";

// Бейдж для компактних рядків режиму text — трохи більший за SM (бо тут
// немає сусідньої лупи, яка б з ним конкурувала за місце), але все одно
// менший за спільний ITEM_LETTER_BADGE (28px): той лишається незмінним,
// бо його й досі використовує vocab-quiz.tsx.
const ITEM_LETTER_BADGE_TEXT =
  "flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand text-xs font-medium text-white";

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

  // Фон рядка (режим text) після перевірки — той самий м'який відтінок, що
  // й на полі (inputClass), лише без рамки: рядки без власних карток, тому
  // підсвічування рамкою тут недоцільне (злилося б із роздільником).
  function rowStateClass(itemId: string) {
    const d = itemDetail(itemId);
    if (!d) return "";
    return d.isCorrect ? "bg-green-50 dark:bg-green-950/30" : "bg-red-50 dark:bg-red-950/30";
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

  function numberInput(
    itemId: string,
    variant: "wide" | "square" | "compact" | "line" = "wide",
    label?: string,
  ) {
    // "compact" — лише щільна сітка image/mixed: h-10 (40px) за замовчуванням
    // покриває і дотик, і вузький екран; sm:pointer-fine:h-8 (32px) звужує
    // лише на реальному десктопі з мишкою (sm+ ширина ТА pointer:fine) —
    // на touch-екрані будь-якої ширини лишається 40px. text-base (16px)
    // завжди, щоб Safari не зумив сторінку при фокусі на дотику (вимагає
    // ≥16px), на десктопі це теж ≥14px з запасом.
    if (variant === "compact" || variant === "line") {
      // "line" (компактні рядки режиму text) — та сама логіка touch/desktop,
      // лише десктопна висота трохи більша (h-9=36px, не h-8=32px): тут
      // немає сусіднього квадрата-картинки, що диктує мінімальний розмір,
      // тож можна лишити поле трохи вищим і легше читаним у рядку.
      const desktopHeight = variant === "line" ? "sm:pointer-fine:h-9" : "sm:pointer-fine:h-8";
      return (
        <input
          type="number"
          min={1}
          max={config.items.length}
          value={positions[itemId] ?? ""}
          onChange={(e) => updatePosition(itemId, e.target.value)}
          disabled={!!result}
          placeholder="№"
          aria-label={label ? `Номер події ${label}` : "Номер події"}
          className={`h-10 w-12 rounded border text-center text-base ${desktopHeight} ${inputClass(itemId)}`}
        />
      );
    }
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
        // Щільна сітка: 3/4/5 колонок за брейкпоінтами, gap-2 — щоб 10+
        // картинок вміщались на екран майже без прокрутки (попередня
        // версія — 2/3 колонки з великим квадратом (до 12rem) — і 10
        // елементів розтягувались на кілька екранів прокрутки).
        <div className={COMPACT_IMAGE_GRID}>
          {config.items.map((item, i) => {
            const label = indexToLabel(i);
            return (
              <div
                key={item.id}
                className={`${COMPACT_IMAGE_CARD} ${ANSWER_CARD_DEFAULT}`}
              >
                {/* overflow-hidden + img absolute inset-0 — <img> більше не
                    задає власну висоту через проценти (h-full проти
                    батька, чия висота похідна від aspect-square, давало
                    нестабільний розрахунок і картинка "наповзала" на
                    рядок номера нижче). inset-0 завжди прилягає рівно до
                    країв найближчого position:relative предка — без
                    відсоткового розв'язання, тому немає залежності від
                    self-stretch (видалено — він нічого корисного не
                    додавав: width тут і так "100%", не "auto", align-self
                    на явний відсоток не впливає, а в парі з aspect-square
                    саме він і провокував непослідовний розрахунок хіпотетичного
                    cross-size ДО застосування max-width, звідки квадрат
                    ~208px замість затиснутого max-w-[6.5rem]=104px). */}
                <div className={COMPACT_IMAGE_FRAME}>
                  <ImageOrPlaceholder
                    src={item.content}
                    alt=""
                    className={COMPACT_IMAGE_FILL}
                    useFocus
                  />
                  <span className={`absolute left-1 top-1 z-10 ${ITEM_LETTER_BADGE_SM}`}>{label}</span>
                  {/* boxClass без "relative": span уже absolute (своя база
                      класів компонента) — зайвий "relative" поруч з
                      "absolute" в ОДНОМУ className — та сама CSS-властивість
                      position двічі, переміг "relative" (пізніший у
                      згенерованому Tailwind-шарі) і кнопка стала звичайним
                      "relative" (в потоці) flex-блоком, який авто-розтягся
                      на всю ширину батька — звідси суцільна смуга; w-6/h-6
                      тепер явно, без purge-залежного p-1+iconSize підбору. */}
                  <ImageZoomBadge
                    onOpen={() => setLightboxSrc(item.content)}
                    boxClass="h-6 w-6 before:absolute before:-inset-2 before:content-['']"
                    iconSize={12}
                  />
                </div>
                {config.mode === "mixed" && (
                  <p className="line-clamp-2 text-center text-xs font-medium" title={item.text}>
                    {item.text}
                  </p>
                )}
                <div className="mt-1.5 flex items-center justify-center gap-1.5">
                  <span className="text-xs text-neutral-500 dark:text-neutral-400">n°</span>
                  {numberInput(item.id, "compact", label)}
                </div>
                {!hidePoints && (pointsVisible || itemDetail(item.id)) ? (
                  <p className={`text-center ${SCORE_LABEL_CLASS}`}>
                    {pointsLabel(item.id, item.points)}
                  </p>
                ) : null}
              </div>
            );
          })}
        </div>
      ) : (
        // Компактні рядки: ОДИН контейнер-картка (рамка/тло/закруглення —
        // те саме ANSWER_CARD_DEFAULT, що й раніше на кожній картці
        // окремо), рядки всередині — без власних карток, розділені тонкою
        // лінією (divide-y з явним кольором рамки — не border/currentColor,
        // щоб уникнути відомого Tailwind v4 бага). Висота рядка — за
        // вмістом (py-2 px-2.5, без фіксованої min-height), тож довге
        // (дворядкове) речення просто займає трохи більше місця, а не
        // обрізається.
        <div className={`divide-y divide-gray-100 overflow-hidden rounded-xl border dark:divide-neutral-700 ${ANSWER_CARD_DEFAULT}`}>
          {config.items.map((item, i) => {
            const label = indexToLabel(i);
            return (
              <div
                key={item.id}
                className={`flex items-center gap-2.5 px-2.5 py-2 transition-colors ${rowStateClass(item.id)}`}
              >
                <span className={ITEM_LETTER_BADGE_TEXT}>{label}</span>
                <span className="min-w-0 flex-1 text-left leading-snug">{item.content}</span>
                {numberInput(item.id, "line", label)}
                {!hidePoints && (pointsVisible || itemDetail(item.id)) && (
                  <span className={`flex-none text-right ${SCORE_LABEL_CLASS}`}>
                    {pointsLabel(item.id, item.points)}
                  </span>
                )}
              </div>
            );
          })}
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
