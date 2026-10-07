"use client";

import { useState, useEffect } from "react";
import { Check, ChevronDown } from "lucide-react";
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
  ITEM_NUMBER_BADGE,
} from "./answer-card-style";
import { STUDENT_BUTTON_PRIMARY } from "@/lib/button-styles";
import { EXERCISE_STACK, EXERCISE_BODY_ITEMS_GAP } from "@/lib/spacing";
import { RESULT_MESSAGE_CLASS, SCORE_LABEL_CLASS } from "./score-style";
import { frenchNbsp } from "@/lib/text/french-typography";

type MultipleChoicePublicItem = MultipleChoicePublic["items"][number];
type ItemDetail = MultipleChoiceDetail["items"][number];

// Картка питання для звичайного (без картинок, не select) режиму: шапка
// (номер+текст питання) + підкладка-пул з плитками-відповідями нижче, той
// самий принцип картка+підкладка, що вже в task-type-meta.ts/0b80d3a
// (border з ЯВНИМ токеном кольору — не currentColor, баг Tailwind v4).
const CARD_WRAP =
  "overflow-hidden rounded-xl border border-gray-100 bg-white dark:border-neutral-700 dark:bg-neutral-800";

// Підкладка з плитками: один стовпець на мобільній (grid-cols-1), на sm+ —
// стільки колонок auto-fit влізе (мінімум 11rem на плитку). items-stretch —
// однакова висота плиток у ряду навіть якщо текст різної довжини.
const POOL_CLASS =
  "grid grid-cols-1 items-stretch gap-2 border-t border-gray-100 bg-neutral-50 p-2.5 dark:border-neutral-700 dark:bg-neutral-900/50 sm:grid-cols-[repeat(auto-fit,minmax(11rem,1fr))]";

// Плитка-відповідь: min-h-12 (48px) — зона дотику на touch. Колір стану
// додається викликачем через chipClass() (нижче) — та сама функція, що й
// раніше визначала колір чипа, лишена без змін.
const TILE_BASE =
  "flex min-h-12 items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand";

// Літера варіанта (A, B, C...) за позицією в item.options — та сама схема,
// що вже показує літерний префікс чипа/пілюлі вибраної відповіді.
function optionLetter(index: number): string {
  return String.fromCharCode(65 + index);
}

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

  // Та сама логіка станів, що optionClass() вище (correct/selected/
  // opacity-60 — літерально ті самі значення, свідомо продубльовані, а не
  // винесені в один виклик), ЛИШЕ з іншим кольором стану "обрано до
  // перевірки": замість спільного SELECTED_OPTION_CLASS (синій, selection-
  // style.ts — його не редагую, він ще потрібен іншим типам вправ у
  // блакитному) — брендовий indigo, як у пілюлі select-режиму нижче, щоб
  // нові компактні елементи (чип/пілюля) мали один акцентний колір.
  function chipClass(itemId: string, optionId: string, itemDetail?: ItemDetail) {
    if (!itemDetail) {
      const sel = selections[itemId] ?? [];
      return sel.includes(optionId)
        ? "border-indigo-500 bg-indigo-100 text-indigo-700 dark:border-indigo-500 dark:bg-indigo-900/40 dark:text-indigo-300"
        : ANSWER_CARD_DEFAULT;
    }
    const opt = itemDetail.options.find((o) => o.id === optionId);
    if (!opt) return "";
    if (opt.correct) return "border-green-500 bg-green-50 dark:bg-green-950/30";
    if (opt.selected) return "border-red-500 bg-red-50 dark:bg-red-950/30";
    return "opacity-60";
  }

  // Колір круглого/квадратного індикатора зліва в плитці — та сама логіка
  // станів, що chipClass() (вище сама плитка), але для ЗАЛИТОГО кольору
  // (bg, не лише border/text): обрано-до-перевірки → indigo, правильно →
  // green, вибрано-неправильно → red, інакше нейтральний незаповнений.
  function tileIndicatorClass(itemId: string, optionId: string, itemDetail?: ItemDetail) {
    if (!itemDetail) {
      const sel = selections[itemId] ?? [];
      return sel.includes(optionId)
        ? "border-indigo-500 bg-indigo-500"
        : "border-neutral-300 bg-white dark:border-neutral-600 dark:bg-neutral-800";
    }
    const opt = itemDetail.options.find((o) => o.id === optionId);
    if (opt?.correct) return "border-green-500 bg-green-500";
    if (opt?.selected) return "border-red-500 bg-red-500";
    return "border-neutral-300 bg-white opacity-60 dark:border-neutral-600 dark:bg-neutral-800";
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

  function renderItem(item: MultipleChoicePublicItem, index: number) {
    const itemDetail = detail?.items.find((d) => d.id === item.id);
    const sel = selections[item.id] ?? [];
    const hasImages = item.options.some((o) => !!o.imageUrl);

    // Без картинок — картка (шапка+підкладка-пул), не низка окремих чипів:
    // ІНШИЙ код-шлях від картинкового режиму нижче (той лишається буквально
    // незмінним). questionId — для aria-labelledby групи плиток на текст
    // питання, замість дублювання тексту в кожній плитці aria-label.
    if (!hasImages) {
      const questionId = `mc-q-${item.id}`;
      return (
        <div key={item.id} className={CARD_WRAP}>
          <div className="flex items-start gap-2.5 p-3">
            {config.items.length > 1 && (
              <span className={ITEM_NUMBER_BADGE} aria-hidden="true">
                {index + 1}
              </span>
            )}
            <div className="min-w-0 flex-1">
              <p id={questionId} className="break-words font-medium [overflow-wrap:anywhere]">
                {frenchNbsp(item.sentence)}
                {pointsBadge(item, itemDetail)}
              </p>
              {item.multiple && (
                <p className="text-xs italic text-neutral-500 dark:text-neutral-400">
                  {item.correctCount} {item.correctCount >= 5 ? "варіантів" : "варіанти"}
                </p>
              )}
            </div>
          </div>
          <div
            role={item.multiple ? "group" : "radiogroup"}
            aria-labelledby={questionId}
            className={POOL_CLASS}
          >
            {item.options.map((o, idx) => {
              const opt = itemDetail?.options.find((x) => x.id === o.id);
              const chosen = itemDetail ? !!opt?.selected : sel.includes(o.id);
              return (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => toggle(item.id, o.id, item.multiple)}
                  disabled={!!result}
                  role={item.multiple ? "checkbox" : "radio"}
                  aria-checked={chosen}
                  className={`${TILE_BASE} ${chipClass(item.id, o.id, itemDetail)}`}
                >
                  <span
                    aria-hidden
                    className={`flex h-5 w-5 shrink-0 items-center justify-center border-2 ${
                      item.multiple ? "rounded-[4px]" : "rounded-full"
                    } ${tileIndicatorClass(item.id, o.id, itemDetail)}`}
                  >
                    {chosen && <Check size={12} className="text-white" aria-hidden />}
                  </span>
                  <span className="min-w-0 flex-1 break-words">
                    {optionLetter(idx)}) {o.text}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      );
    }

    return (
      <div key={item.id} className="flex items-start gap-2.5">
        {config.items.length > 1 && (
          <span className={ITEM_NUMBER_BADGE} aria-hidden="true">
            {index + 1}
          </span>
        )}
        <div className="min-w-0 flex-1">
        <p className="break-words font-medium [overflow-wrap:anywhere]">
          {frenchNbsp(item.sentence)}
          {pointsBadge(item, itemDetail)}
        </p>
        {item.multiple && (
          <p className="text-xs italic text-neutral-500 dark:text-neutral-400">
            {item.correctCount} {item.correctCount >= 5 ? "варіантів" : "варіанти"}
          </p>
        )}
        {/* Сюди доходимо лише коли hasImages === true (інакше renderItem уже
            повернув картку-з-пулом вище) — на мобільній/sm та сама сітка,
            що в chronological_order (3/4 колонки, gap-2); не використовую
            COMPACT_IMAGE_GRID напряму, бо на md потрібно перевизначити ту
            саму CSS-властивість (grid-template-columns/gap) на ТОМУ САМОМУ
            брейкпоінті — накладання двох класів з однаковою специфічністю
            (constant.md:grid-cols-5 проти локального md:grid-cols-4)
            залежало б від порядку в згенерованому Tailwind-шарі, а не від
            порядку в рядку className. Тому база/sm — буквальна копія
            COMPACT_IMAGE_GRID (мобільна й так НЕ міняється за умовою
            задачі), а md:/lg: — повністю локальні, без конфліктів. На md
            колонок 4, не 5: при gap-4+p-3 5 колонок у контейнері
            max-w-2xl/3xl звужували би картинку нижче 104px (капа з
            COMPACT_IMAGE_FRAME) — 4 колонки зберігають той самий видимий
            розмір картинки. */}
        <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-4 md:mt-4 md:gap-4 lg:gap-5">
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
                  className={`${ANSWER_CARD_BASE} min-w-0 break-words [overflow-wrap:anywhere] ${optionClass(item.id, o.id, itemDetail)}`}
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
      </div>
    );
  }

  // Режим "dropdown" (випадаючий список) — компактний рядковий список, той
  // самий контейнерний стиль, що текстовий режим chronological_order
  // (divide-y/rounded-xl/border, без власної картки на рядок, без gap між
  // рядками). Пілюля праворуч (w-56 на десктопі, на всю ширину на мобільній)
  // — видимий стан-індикатор, а справжній <select> лежить прозорим шаром
  // поверх неї (нативна поведінка: клавіатура, системний вибір на телефоні,
  // aria). imageUrl у dropdown-варіантах неможливий (types.ts: imageUrl лише
  // для display "buttons") — картинок тут за визначенням немає.
  function renderDropdownRow(item: MultipleChoicePublicItem, index: number) {
    const itemDetail = detail?.items.find((d) => d.id === item.id);
    const sel = selections[item.id] ?? [];
    const selectedOptions = item.options.filter((o) => sel.includes(o.id));
    const isCorrect = itemDetail ? itemDetail.options.every((o) => o.correct === o.selected) : null;
    const pillState: "correct" | "incorrect" | "selected" | "empty" =
      isCorrect === true ? "correct" : isCorrect === false ? "incorrect" : selectedOptions.length > 0 ? "selected" : "empty";
    const pillClass =
      pillState === "correct"
        ? "border-green-500 bg-green-50 text-green-700 dark:border-green-600 dark:bg-green-950/30 dark:text-green-300"
        : pillState === "incorrect"
          ? "border-red-500 bg-red-50 text-red-700 dark:border-red-600 dark:bg-red-950/30 dark:text-red-300"
          : pillState === "selected"
            ? "border-indigo-500 bg-indigo-100 text-indigo-700 dark:border-indigo-500 dark:bg-indigo-900/40 dark:text-indigo-300"
            : "border-gray-300 bg-white text-neutral-500 dark:border-neutral-600 dark:bg-neutral-800 dark:text-neutral-400";
    const label =
      selectedOptions.length === 0
        ? "Оберіть"
        : item.multiple
          ? selectedOptions.map((o) => o.text).join(", ")
          : `${optionLetter(item.options.findIndex((o) => o.id === selectedOptions[0].id))}) ${selectedOptions[0].text}`;

    // Речення для dropdown могло містити рівно один маркер "{{}}" (адмінка:
    // "Je {{}} au cinéma.") — раніше він позначав місце вбудованого
    // <select> прямо в тексті. У новому рядковому вигляді відповідь вибирають
    // у пілюлі праворуч, а не інлайн у тексті, тому маркер просто прибираю
    // з відображення (без заміни на видимий штрих) — зайвий пропуск після
    // цього згортаю в один пробіл, щоб речення читалось природно.
    const questionText = frenchNbsp(item.sentence.replace("{{}}", " ").replace(/\s{2,}/g, " ").trim());

    return (
      <div key={item.id} className="flex flex-col gap-2 px-3 py-2.5 transition-colors md:flex-row md:items-center md:gap-3">
        <div className="flex min-w-0 flex-1 items-start gap-2.5">
          {config.items.length > 1 && (
            <span className={ITEM_NUMBER_BADGE} aria-hidden="true">
              {index + 1}
            </span>
          )}
          <div className="min-w-0 flex-1">
            <p className="break-words leading-snug [overflow-wrap:anywhere]">
              {questionText}
              {pointsBadge(item, itemDetail)}
            </p>
            {item.multiple && (
              <p className="mt-0.5 text-xs italic text-neutral-500 dark:text-neutral-400">
                {item.correctCount} {item.correctCount >= 5 ? "варіантів" : "варіанти"}
              </p>
            )}
          </div>
        </div>
        <div className="group relative w-full flex-none md:w-56">
          <div
            className={`flex h-10 w-full items-center justify-between gap-2 rounded-full border px-3 text-sm transition-colors md:h-9 group-focus-within:ring-2 group-focus-within:ring-brand ${pillClass}`}
          >
            <span className="truncate" title={selectedOptions.map((o) => o.text).join(", ") || undefined}>
              {label}
            </span>
            <ChevronDown size={14} className="shrink-0 opacity-60" aria-hidden />
          </div>
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
            aria-label={`Відповідь на питання ${index + 1}`}
            className="absolute inset-0 h-full w-full cursor-pointer text-base opacity-0 disabled:cursor-not-allowed"
          >
            {!item.multiple && <option value="">— Оберіть —</option>}
            {item.options.map((o) => (
              <option key={o.id} value={o.id}>
                {o.text}
              </option>
            ))}
          </select>
        </div>
      </div>
    );
  }

  const allAnswered = config.items.every((it) => (selections[it.id] ?? []).length > 0);
  // Велике md:-розширення гапу лишається ТІЛЬКИ для картинкового режиму
  // (hasAnyImages, картки renderItem лишились повністю незмінними); щойно
  // перероблені картки-з-пулом (без картинок) ідуть з компактним gap-3 на
  // всіх екранах — саме той "величезний проміжок", про який писала задача.
  const hasAnyImages = config.items.some((it) => it.options.some((o) => !!o.imageUrl));

  return (
    <div className={EXERCISE_STACK}>
      <InstructionsText
        text={config.instructions ?? DEFAULT_INSTRUCTIONS.multiple_choice.instruction}
        subText={config.subInstructions ?? DEFAULT_INSTRUCTIONS.multiple_choice.subInstruction}
      />

      {config.display === "dropdown" ? (
        // Один спільний контейнер-список (divide-y/rounded-xl/border — той
        // самий прийом, що текстовий режим chronological_order) замість
        // окремого gap між питаннями: рядки йдуть щільно, розділені лише
        // тонкою лінією, без "величезних проміжків" попереднього вигляду.
        <div className={`divide-y divide-gray-100 overflow-hidden rounded-xl border dark:divide-neutral-700 ${ANSWER_CARD_DEFAULT}`}>
          {config.items.map((item, i) => renderDropdownRow(item, i))}
        </div>
      ) : (
        // md:gap-10 — лишається ЛИШЕ для картинкового режиму (hasAnyImages),
        // та сама картка renderItem, що й була. Для карток-з-пулом (без
        // картинок) — компактний gap-3 на всіх екранах (gap-4/md:gap-10
        // були тим самим "величезним проміжком" зі скріншота задачі).
        <div className={`flex flex-col ${hasAnyImages ? `${EXERCISE_BODY_ITEMS_GAP} md:gap-10` : "gap-3"}`}>
          {config.items.map((item, i) => renderItem(item, i))}
        </div>
      )}

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
