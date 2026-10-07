"use client";

import { useState, useEffect } from "react";
import { Check, ChevronDown } from "lucide-react";
import type { MultipleChoicePublic, MultipleChoiceDetail, GradeResult } from "@/lib/exercises/types";
import { useExerciseCheck } from "./use-exercise-check";
import { DEFAULT_INSTRUCTIONS } from "@/lib/exercises/default-instructions";
import { pluralizePoints } from "@/lib/pluralize-points";
import { InstructionsText } from "./instructions-text";
import { ImageOrPlaceholder } from "@/components/image-or-placeholder";
import { ImageZoomBadge } from "./image-zoom-badge";
import { ImageLightbox } from "./image-lightbox";
import {
  ANSWER_CARD_DEFAULT,
  COMPACT_IMAGE_FILL,
  ITEM_NUMBER_BADGE,
  ITEM_CARD_WRAP as CARD_WRAP,
} from "./answer-card-style";
import { STUDENT_BUTTON_PRIMARY } from "@/lib/button-styles";
import { EXERCISE_STACK } from "@/lib/spacing";
import { RESULT_MESSAGE_CLASS, SCORE_LABEL_CLASS } from "./score-style";
import { frenchNbsp } from "@/lib/text/french-typography";

type MultipleChoicePublicItem = MultipleChoicePublic["items"][number];
type ItemDetail = MultipleChoiceDetail["items"][number];

// Картка питання для звичайного (без картинок, не select) режиму: шапка
// (номер+текст питання) + підкладка-пул з плитками-відповідями нижче, той
// самий принцип картка+підкладка, що вже в task-type-meta.ts/0b80d3a.
// CARD_WRAP — тепер ITEM_CARD_WRAP з answer-card-style.ts (той самий рядок
// класів, перенесено, щоб word_choice міг перевикористати без зміни
// вигляду тут).

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

// Рамка під картинку лише для картинкових режимів multiple_choice: на
// відміну від спільного COMPACT_IMAGE_FRAME (answer-card-style.ts, капає
// ширину картинки на 6.5rem — потрібно для chronological_order, НЕ чіпати)
// тут картинка має займати всю внутрішню ширину картки (сама картка вже
// капована на ~14rem колонкою сітки нижче), тож локальна копія без
// max-w/mx-auto.
// Рамка картинки картинкових режимів — aspect залежить від кількості
// мобільних колонок (квадрат на 3, 4:3 на 2), на sm+ завжди 4:3 (щоб
// картка не ставала надто високою при однаковій ширині колонки). Тому
// базова форма без aspect, а сам aspect додається інлайн у місці виклику.
const IMAGE_OPTION_FRAME_BASE = "relative w-full overflow-hidden rounded-md";

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

  // Колір рамки+фону всієї картки-відповіді в сітці картинок (режими
  // "тільки картинки"/"картинка+текст") — та сама логіка станів, що
  // chipClass() вище (indigo до перевірки, зелений/червоний після), але з
  // border-neutral-200 (не border-gray-100 з ANSWER_CARD_DEFAULT) за явною
  // вимогою задачі; без shadow — тінь картки більше НЕ додається (задача:
  // "БЕЗ box-shadow"), лишається лише з CARD_WRAP ззовні.
  function imageCardClass(itemId: string, optionId: string, itemDetail?: ItemDetail) {
    if (!itemDetail) {
      const sel = selections[itemId] ?? [];
      return sel.includes(optionId)
        ? "border-indigo-500 bg-indigo-50 dark:border-indigo-500 dark:bg-indigo-950/30"
        : "border-neutral-200 bg-white hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-800 dark:hover:bg-neutral-800/70";
    }
    const opt = itemDetail.options.find((o) => o.id === optionId);
    if (!opt) return "";
    if (opt.correct) return "border-green-500 bg-green-50 dark:bg-green-950/30";
    if (opt.selected) return "border-red-500 bg-red-50 dark:bg-red-950/30";
    return "border-neutral-200 bg-white opacity-60 dark:border-neutral-700 dark:bg-neutral-800";
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

  // Шапка картки (бейдж номера + текст питання + підпис кількості
  // варіантів) — спільна для ВСІХ режимів buttons (текст/картинка/змішано),
  // щоб не дублювати цю розмітку в renderItem нижче. extraClassName
  // (порожній рядок за замовчуванням) — опційна добавка лише для
  // картинкових режимів (md:p-4); текстовий режим викликає без неї, тож
  // його шапка лишається байтово тим самим p-3, що й була (задача: "без
  // зміни вигляду" для текстового режиму).
  function renderQuestionHeader(
    item: MultipleChoicePublicItem,
    index: number,
    itemDetail: ItemDetail | undefined,
    questionId: string,
    extraClassName = ""
  ) {
    return (
      <div className={`flex items-start gap-2.5 p-3 ${extraClassName}`}>
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
    );
  }

  function renderItem(item: MultipleChoicePublicItem, index: number) {
    const itemDetail = detail?.items.find((d) => d.id === item.id);
    const sel = selections[item.id] ?? [];
    const hasImages = item.options.some((o) => !!o.imageUrl);
    const questionId = `mc-q-${item.id}`;

    // Без картинок — картка (шапка+підкладка-пул), не низка окремих чипів.
    // questionId — для aria-labelledby групи плиток на текст питання,
    // замість дублювання тексту в кожній плитці aria-label.
    if (!hasImages) {
      return (
        <div key={item.id} className={CARD_WRAP}>
          {renderQuestionHeader(item, index, itemDetail, questionId)}
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

    // Режими "тільки картинки"/"картинка+текст" — та сама обгортка
    // (CARD_WRAP + шапка), що й текстовий режим вище: бейдж+питання у
    // заголовку, роздільник (border-t нижче), тонована зона відповідей.
    // Колонок на мобільній (нижче sm) — 3, якщо найдовший підпис у питанні
    // короткий (≤12 символів після trim), інакше 2 (довгі підписи на 3
    // колонках ламались би). На sm+ кількість колонок = кількість відповідей
    // (не більше 4 на sm, не більше 5 на md+; 1-2 відповіді все одно дають 3
    // колонки, щоб картки не розтягувались на всю ширину) — усі колонки
    // minmax(0,1fr), тож ширина залежить ЛИШЕ від контейнера й кількості
    // колонок, а не від довжини підписів (той баг зі скріншота — mx-auto
    // w-fit робив ширину залежною від вмісту). max-w-[60rem] на самій сітці
    // — верхня межа на дуже широких екранах, вирівнювання зліва за
    // замовчуванням (без mx-auto).
    // Класи колонок — повні статичні рядки (не шаблонні вставки з числом):
    // Tailwind JIT сканує файл текстовим пошуком класів, тож динамічно
    // зібраний `sm:grid-cols-[repeat(${n},...)]` він НЕ розпізнає — лише
    // готові рядки, присутні в коді буквально.
    const maxLabelLen = Math.max(0, ...item.options.map((o) => o.text?.trim().length ?? 0));
    const mobileColsClass = maxLabelLen <= 12 ? "grid-cols-3" : "grid-cols-2";
    const mobileAspectClass = mobileColsClass === "grid-cols-3" ? "aspect-square" : "aspect-[4/3]";
    const optionsCount = item.options.length;
    const smColsClass =
      optionsCount >= 4 ? "sm:grid-cols-[repeat(4,minmax(0,1fr))]" : "sm:grid-cols-[repeat(3,minmax(0,1fr))]";
    const mdColsClass =
      optionsCount >= 5
        ? "md:grid-cols-[repeat(5,minmax(0,1fr))]"
        : optionsCount === 4
          ? "md:grid-cols-[repeat(4,minmax(0,1fr))]"
          : "md:grid-cols-[repeat(3,minmax(0,1fr))]";

    return (
      <div key={item.id} className={CARD_WRAP}>
        {renderQuestionHeader(item, index, itemDetail, questionId, "md:p-4")}
        <div
          role={item.multiple ? "group" : "radiogroup"}
          aria-labelledby={questionId}
          className="border-t border-gray-100 bg-neutral-50 p-2.5 dark:border-neutral-700 dark:bg-neutral-900/50"
        >
          <div
            className={`grid ${mobileColsClass} max-w-[60rem] items-stretch gap-2 ${smColsClass} sm:gap-3 ${mdColsClass}`}
          >
            {item.options.map((o) => {
              if (!o.imageUrl) {
                // Текстовий варіант у сітці картинок (частина варіантів без
                // картинки) — та сама рамка+фон, що й картинкові картки тут
                // (imageCardClass), щоб вигляд рядка був однорідним. h-full —
                // та сама висота, що й сусідні картинкові картки в рядку
                // (items-stretch на контейнері дає рядку спільну висоту).
                return (
                  <button
                    key={o.id}
                    type="button"
                    onClick={() => toggle(item.id, o.id, item.multiple)}
                    disabled={!!result}
                    className={`flex h-full min-w-0 items-center justify-center rounded-lg border p-1.5 text-center text-sm leading-snug break-words [overflow-wrap:anywhere] transition-colors sm:p-2 ${imageCardClass(item.id, o.id, itemDetail)}`}
                  >
                    {frenchNbsp(o.text)}
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
                  className={`flex h-full min-w-0 flex-col items-center gap-1 rounded-lg border p-1.5 text-center transition-colors sm:p-2 ${imageCardClass(item.id, o.id, itemDetail)}`}
                >
                  <div className={`${IMAGE_OPTION_FRAME_BASE} ${mobileAspectClass} sm:aspect-[4/3]`}>
                    <ImageOrPlaceholder src={o.imageUrl} alt="" className={COMPACT_IMAGE_FILL} useFocus />
                    <span
                      aria-hidden
                      className={`absolute left-1 top-1 z-10 flex h-4 w-4 items-center justify-center rounded-full border-2 text-[10px] font-bold leading-none sm:h-[22px] sm:w-[22px] sm:text-xs ${indicator.className}`}
                    >
                      {indicator.mark}
                    </span>
                    <ImageZoomBadge
                      onOpen={() => setLightboxSrc(o.imageUrl!)}
                      boxClass="h-[22px] w-[22px] before:absolute before:-inset-[11px] before:content-[''] sm:h-[26px] sm:w-[26px] sm:before:-inset-[9px]"
                      iconSize={12}
                    />
                  </div>
                  {o.text && (
                    // Зовнішній flex-1+flex items-center — підпис вертикально
                    // центрований у залишку висоти картки, тож довгий
                    // (двострічковий) підпис в одній картці не підіймає текст
                    // сусідньої картки нагору (рядок стає вищим для всіх
                    // через items-stretch на сітці, текст лишається
                    // центрованим); line-clamp-2 — на внутрішньому <p>
                    // (не на flex-контейнері: line-clamp вимагає
                    // display:-webkit-box, що конфліктує з display:flex).
                    <div className="flex w-full min-w-0 flex-1 items-center justify-center">
                      <p
                        className="line-clamp-2 text-center text-sm leading-snug break-words [overflow-wrap:anywhere]"
                        title={o.text}
                      >
                        {frenchNbsp(o.text)}
                      </p>
                    </div>
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
        // Картинковий і текстовий режими тепер мають однакову обгортку
        // (CARD_WRAP), тож однаковий компактний gap-3 між картками на всіх
        // екранах — великий md:gap-10 був потрібен раніше лише тому, що
        // картинкові картки не мали власної рамки/фону.
        <div className="flex flex-col gap-3">
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
