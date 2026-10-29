"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronDown, X } from "lucide-react";
import type { MultipleChoicePublic, MultipleChoiceDetail, GradeResult } from "@/lib/exercises/types";
import { useExerciseCheck } from "./use-exercise-check";
import { DEFAULT_INSTRUCTIONS, DEFAULT_TRANSLATION_EN, taskTranslationLine } from "@/lib/exercises/default-instructions";
import { TaskPanelHeader } from "./task-panel-header";
import { ImageOrPlaceholder } from "@/components/image-or-placeholder";
import { ImageZoomBadge } from "./image-zoom-badge";
import { ImageLightbox } from "./image-lightbox";
import { COMPACT_IMAGE_FILL, ITEM_CARD_WRAP as CARD_WRAP } from "./answer-card-style";
import { ChoiceQuestionCard } from "./choice-question-card";
import { BUTTON_CHECK, STUDENT_BUTTON_SECONDARY_TOUCH } from "@/lib/button-styles";
import { EXERCISE_STACK, EXERCISE_BODY_ITEMS_GAP } from "@/lib/spacing";
import { TaskResult, RowPointsTab } from "./task-result";
import { unevenPointsFlags } from "@/lib/exercises/uneven-points";
import { headerPointsState } from "@/lib/exercises/header-points";
import { useT } from "@/lib/i18n/context";
import { plural } from "@/lib/i18n/plural";
import { frenchNbsp } from "@/lib/text/french-typography";
import { CARD_BLOCK_MAX, splitEvenly } from "@/lib/exercises/exercise-blocks";
import { BlockNavigation, BlockTabs } from "./block-navigation";
import { usePracticeCheck } from "./use-practice-check";
import { HintBulb } from "./hint-bulb";
import { hintExplanationText } from "./hint-explanation";
import { useCheckConfirm, CheckConfirmBar } from "./check-confirm";

type MultipleChoicePublicItem = MultipleChoicePublic["items"][number];
type ItemDetail = MultipleChoiceDetail["items"][number];
type MultipleChoiceResult = Extract<GradeResult, { detail: MultipleChoiceDetail }>;

// Картка питання для звичайного (без картинок, не select) режиму: шапка
// (номер+текст питання) + підкладка-пул з плитками-відповідями нижче, той
// самий принцип картка+підкладка, що вже в task-type-meta.ts/0b80d3a.
// CARD_WRAP — тепер ITEM_CARD_WRAP з answer-card-style.ts (той самий рядок
// класів, перенесено, щоб word_choice міг перевикористати без зміни
// вигляду тут).

// POOL_CLASS/TILE_BASE тепер в answer-card-style.ts (винесено туди, щоб
// listening.tsx міг узяти той самий клас через ChoiceQuestionCard, без
// копіювання рядків) — значення не змінені.

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

// Текст деяких варіантів у БД уже введений із власним префіксом літери
// ("A) L'éléphant" — зі старих часів, коли рендер сам літеру не додавав),
// а рендер тепер завжди додає свою (optionLetter) — без зняття виходить
// подвоєння "A) A) ...". Знімаємо лише цей шаблон з початку тексту перед
// показом; дані в БД не змінюємо, звірка відповіді йде по id/correct, не
// по цьому рядку, тож на грейдинг не впливає.
function stripOptionLetterPrefix(text: string): string {
  return text.replace(/^[A-Za-z]\)\s*/, "");
}

function optionDisplayText(text: string, index: number): string {
  return `${optionLetter(index)}) ${stripOptionLetterPrefix(text)}`;
}

// Режим практики "Робота над помилками" (пілот, частина 2) — лише
// неправильні ще не виправлені елементи (onlyItemIds, з серверної моделі
// errorReviewByTask.remainingItemIds), бали не показуються ніколи
// (хідpoints примусово true в error-review-block.tsx, failedAttempts —
// стартовий стан із тієї самої моделі, для коректного лічильника з
// першого рендеру, до першого practice/check у цій сесії).
export type MultipleChoicePracticeProps = {
  onlyItemIds: string[];
  failedAttempts: Record<string, number>;
};

export function MultipleChoiceExercise({
  taskId,
  config,
  plaqueText,
  pointsVisible,
  onResult,
  hidePoints,
  isDelf,
  practice,
}: {
  taskId: string;
  config: MultipleChoicePublic;
  plaqueText?: string;
  pointsVisible: boolean;
  onResult?: (result: GradeResult) => void;
  hidePoints?: boolean;
  // Пілюля балів питання (RowPointsTab) — лише в DELF (showItemPoints);
  // поза DELF лишається видимою лише на питаннях, чиї бали відрізняються
  // від типових у цій вправі (unevenPointsFlags нижче).
  isDelf?: boolean;
  practice?: MultipleChoicePracticeProps;
}) {
  const { t, lang } = useT();
  function optionsCountWord(n: number): string {
    if (lang === "uk") return n >= 5 ? "варіантів" : "варіанти";
    return plural(lang, n, { one: lang === "fr" ? "option" : "option", other: lang === "fr" ? "options" : "options" });
  }
  // Поза DELF пілюля балів ховається, КРІМ питань із нетиповими балами
  // (п.4 задачі) — рахується по всій вправі, не лише видимому блоку.
  const unevenFlags = useMemo(() => unevenPointsFlags(config.items.map((it) => it.points)), [config.items]);
  const unevenById = useMemo(() => {
    const m = new Map<string, boolean>();
    config.items.forEach((it, i) => m.set(it.id, unevenFlags[i]));
    return m;
  }, [config.items, unevenFlags]);
  const anyItemPointsShown = isDelf || unevenFlags.some(Boolean);
  const itemsGapClass = anyItemPointsShown ? "gap-[22px]" : EXERCISE_BODY_ITEMS_GAP;

  const [selections, setSelections] = useState<Record<string, string[]>>({});
  // Клік по картинці варіанта — вже дія вправи (вибір), тому збільшення
  // винесене в окрему іконку-лупу в кутку (ImageZoomBadge), а не на весь
  // клік по мініатюрі.
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);

  // Підказка (лампочка) до КОЖНОГО питання — той самий принцип, що
  // word-choice.tsx: hintShown (перманентний, іде в answer як hintUsed) і
  // hintVisible (лише розкрито/згорнуто зараз) — окремі стани. Практика
  // (showHintBulb=false нижче) не рендерить лампочку взагалі, тож ці стани
  // лишаються порожніми, і submitPractice() і так ніколи не додає hintUsed.
  const [hintShown, setHintShown] = useState<Set<string>>(new Set());
  const [hintVisible, setHintVisible] = useState<Set<string>>(new Set());
  function toggleHintVisible(itemId: string) {
    setHintShown((prev) => (prev.has(itemId) ? prev : new Set(prev).add(itemId)));
    setHintVisible((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
  }

  // Картки (питання) — поріг блоку CARD_BLOCK_MAX=5, той самий принцип, що
  // word-choice.tsx (exercise-blocks.ts, перша хвиля card-блоків). ≤5
  // питань — itemBlocks матиме РІВНО один чанк, useBlocks===false, нижче
  // рендериться ТОЧНО той самий код, що й до розбиття на блоки.
  const itemBlocks = useMemo(() => splitEvenly(config.items, CARD_BLOCK_MAX), [config.items]);
  const blockCount = itemBlocks.length;
  const useBlocks = blockCount > 1;

  // ==== Гілка ≤5 питань (незмінна поведінка) ====
  const router = useRouter();
  const single = useExerciseCheck(taskId);
  const detail = single.result?.detail as MultipleChoiceDetail | undefined;
  const singleCheckConfirm = useCheckConfirm();
  function submitSingle() {
    single.submit(
      config.items.map((it) => ({
        itemId: it.id,
        selected: selections[it.id] ?? [],
        hintUsed: hintShown.has(it.id),
      }))
    );
  }

  // ==== Гілка практики (onlyItemIds) — незалежна від useBlocks/single
  // вище: завжди плаский список, без BlockNavigation, навіть якщо
  // onlyItemIds випадково довший за CARD_BLOCK_MAX (на практиці
  // remainingItemIds — залишок помилок, рідко великий).
  const isPractice = !!practice;
  const practiceItems = isPractice
    ? config.items.filter((it) => practice!.onlyItemIds.includes(it.id))
    : [];
  // originalIndexOf — щоб .item-number-badge/aria-label лишались
  // ОРИГІНАЛЬНИМИ номерами питань вправи, а не позицією у звуженому
  // практичному підсписку.
  const originalIndexOf = new Map(config.items.map((it, i) => [it.id, i]));
  const practiceCheck = usePracticeCheck(taskId);
  const [practiceResults, setPracticeResults] = useState<Record<string, boolean>>({});
  const [practiceFailedAttempts, setPracticeFailedAttempts] = useState<Record<string, number>>(
    practice?.failedAttempts ?? {}
  );
  const onlyItemIdsKey = practice?.onlyItemIds.join(",") ?? "";
  // Коли remainingItemIds змінюється (елемент виправлено й зник після
  // router.refresh()) — скидаємо локальні результати попередньої спроби,
  // щоб застарілий "✓"/"✕" не лишався на екрані для вже інших елементів.
  useEffect(() => {
    if (isPractice) setPracticeResults({});
  }, [isPractice, onlyItemIdsKey]);

  async function submitPractice() {
    const answer = practiceItems.map((it) => ({ itemId: it.id, selected: selections[it.id] ?? [] }));
    const result = await practiceCheck.check(practiceItems.map((it) => it.id), answer);
    if (!result) return;
    setPracticeResults((prev) => {
      const next = { ...prev };
      for (const r of result.results) next[r.itemId] = r.correct;
      return next;
    });
    setPracticeFailedAttempts(result.failedAttempts);
    for (const r of result.results) {
      if (!r.correct && (result.failedAttempts[r.itemId] ?? 0) >= 2 && !practiceCheck.revealed[r.itemId]) {
        practiceCheck.reveal(r.itemId, false);
      }
    }
  }

  const practiceAllAnswered = practiceItems.every((it) => (selections[it.id] ?? []).length > 0);

  function renderPracticeList() {
    return (
      <div className="flex flex-col gap-3">
        {practiceItems.map((item) => {
          const idx = originalIndexOf.get(item.id)!;
          const isCorrect = practiceResults[item.id];
          const attempts = practiceFailedAttempts[item.id] ?? 0;
          const itemRevealed = practiceCheck.revealed[item.id];
          return (
            <div key={item.id} className="flex flex-col gap-1.5">
              {config.display === "dropdown"
                ? renderDropdownRow(item, idx, undefined, false)
                : renderItem(item, idx, undefined, false)}
              {isCorrect === true && (
                <p className="pl-1 text-xs font-medium text-green-600 dark:text-green-400">{t("status.correct")}</p>
              )}
              {isCorrect === false && (
                <div className="flex flex-wrap items-center gap-2 pl-1 text-xs">
                  <span className="text-red-600 dark:text-red-400">
                    {t("status.incorrectRetryCount", { n: attempts })}
                  </span>
                  {!itemRevealed && (
                    <button
                      type="button"
                      onClick={() => practiceCheck.reveal(item.id, true)}
                      disabled={!!practiceCheck.revealPending[item.id]}
                      className={STUDENT_BUTTON_SECONDARY_TOUCH}
                    >
                      {t("button.showAnswer")}
                    </button>
                  )}
                </div>
              )}
              {itemRevealed && (
                <p className="pl-1 text-xs italic text-amber-700 dark:text-amber-400">
                  {t("answer.correctAnswerLabel")} {itemRevealed.join(", ")}
                </p>
              )}
            </div>
          );
        })}
      </div>
    );
  }

  useEffect(() => {
    if (!useBlocks && single.result) onResult?.(single.result);
  }, [useBlocks, single.result, onResult]);

  // Гейт від повторного клацання — на самій кнопці (disabled={!!itemDetail},
  // renderItem/renderDropdownRow), не тут: toggle спільний для обох гілок
  // (зі станом вибору на всю вправу), і "заблоковано" означає РІЗНЕ —
  // single.result для ≤5 items, itemDetail КОНКРЕТНОГО блоку для >5.
  function toggle(itemId: string, optionId: string, multiple: boolean) {
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
      // Той самий темно-наvy .pool-tile-dark, що картки з картинкою вище
      // (imageCardClass) і плитки listening.tsx — текстовий і картинковий
      // варіант multiple_choice тепер на одному токені фону/hover, щоб не
      // розійшлись знову (ANSWER_CHIP_DEFAULT лишається незмінним для
      // vocab_quiz/sort_columns/image_match/chronological_order — ті не
      // мають цієї ж "рамка+смужка пулу" розкладки).
      return sel.includes(optionId)
        ? "border-indigo-500 bg-indigo-100 text-indigo-700 dark:border-indigo-500 dark:bg-indigo-900/40 dark:text-indigo-300"
        : "glass-chip glass-chip-hover bg-white hover:bg-neutral-50 dark:border-[var(--card-border)] pool-tile-dark";
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
        : "glass-gap-shadow border-[rgba(217,183,101,0.55)] bg-white dark:border-[var(--card-field-border)] dark:bg-[var(--card-field-bg)]";
    }
    const opt = itemDetail.options.find((o) => o.id === optionId);
    if (opt?.correct) return "border-green-500 bg-green-500";
    if (opt?.selected) return "border-red-500 bg-red-500";
    return "glass-gap-shadow border-[rgba(217,183,101,0.55)] bg-white opacity-60 dark:border-[var(--card-field-border)] dark:bg-[var(--card-field-bg)]";
  }

  // Колір рамки+фону всієї картки-відповіді в сітці картинок (режими
  // "тільки картинки"/"картинка+текст") — та сама логіка станів, що
  // chipClass() вище (indigo до перевірки, зелений/червоний після), але з
  // border-neutral-200 (не border-gray-100 з ANSWER_CARD_DEFAULT) за явною
  // вимогою задачі; без shadow — тінь картки більше НЕ додається (задача:
  // "БЕЗ box-shadow"), лишається лише з CARD_WRAP ззовні.
  function imageCardClass(itemId: string, optionId: string, itemDetail?: ItemDetail, hasImage = false) {
    if (!itemDetail) {
      const sel = selections[itemId] ?? [];
      // hasImage — лише картки з картинкою отримують темно-навy підкладку
      // (.pool-tile-dark, той самий токен, що пул слів "СЛОВА" і текстові
      // плитки chipClass/tileClass нижче/в listening.tsx), замість звичної
      // періwinkle --card-bg; текстові картки в тій самій сітці (мішаний
      // режим) лишаються на --card-bg без змін.
      const defaultDarkBg = hasImage ? "pool-tile-dark" : "dark:bg-[var(--card-bg)]";
      return sel.includes(optionId)
        ? "border-indigo-500 bg-indigo-50 dark:border-indigo-500 dark:bg-indigo-950/30"
        : `glass-gold-edge bg-white hover:bg-neutral-50 dark:border-[var(--card-border)] ${defaultDarkBg} ${hasImage ? "" : "dark:hover:bg-[var(--card-hover-bg)] dark:hover:border-[var(--card-hover-border)]"}`;
    }
    const opt = itemDetail.options.find((o) => o.id === optionId);
    if (!opt) return "";
    if (opt.correct) return "border-green-500 bg-green-50 dark:bg-green-950/30";
    if (opt.selected) return "border-red-500 bg-red-50 dark:bg-red-950/30";
    return "glass-gold-edge bg-white opacity-60 dark:border-[var(--card-border)] dark:bg-[var(--card-bg)]";
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
          : "border-neutral-400 bg-white/90 dark:border-[var(--card-field-border)] dark:bg-[var(--card-field-bg)]",
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
      className: "border-neutral-300 bg-white/70 opacity-70 dark:border-[var(--card-field-border)] dark:bg-[var(--card-field-bg)]",
    };
  }

  // До перевірки — лише якщо pointsVisible; після — завжди. Речення
  // зараховується цілком (atomic unit = item), тому 0/points — не часткове.
  // Вкладка (RowPointsTab) рендериться як сусід картки (у .row-points-tab-
  // -wrap на викликачі), не тут — pointsTab лише вирішує, чи й яку.
  function pointsTab(item: MultipleChoicePublicItem, itemDetail?: ItemDetail) {
    if (hidePoints) return null;
    if (!isDelf && !unevenById.get(item.id)) return null;
    if (!pointsVisible && !itemDetail) return null;
    if (itemDetail) {
      const isCorrect = itemDetail.options.every((o) => o.correct === o.selected);
      return <RowPointsTab earned={isCorrect ? item.points : 0} possible={item.points} />;
    }
    return <RowPointsTab possible={item.points} />;
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
    extraClassName = "",
    showHintBulb = true
  ) {
    const hasHintBulb = showHintBulb && !!item.hint;
    return (
      <div className={`flex items-start gap-2.5 pt-[18px] px-3 pb-3 ${extraClassName}`}>
        {config.items.length > 1 && (
          <span className="item-number-badge" aria-label={t("aria.question", { n: index + 1 })}>
            {index + 1}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-1.5">
            <p id={questionId} className="min-w-0 flex-1 break-words font-medium [overflow-wrap:anywhere]">
              {frenchNbsp(item.sentence)}
            </p>
            {hasHintBulb && (
              <HintBulb
                state={hintShown.has(item.id) ? "used" : "available"}
                onClick={() => toggleHintVisible(item.id)}
                label={hintVisible.has(item.id) ? t("button.collapseHint") : t("button.showHint")}
                className="mt-0.5 shrink-0"
              />
            )}
          </div>
          {item.multiple && (
            <p className="text-xs italic text-[var(--text-muted-caption)] dark:text-[var(--text-muted-caption)]">
              {item.correctCount} {optionsCountWord(item.correctCount)}
            </p>
          )}
          {hasHintBulb && hintVisible.has(item.id) && (
            <div className="mt-2 rounded-md border border-amber-200 bg-amber-50 p-2 text-sm break-words text-neutral-700 dark:border-amber-800 dark:bg-amber-950/40 dark:text-neutral-200">
              {item.hint}
            </div>
          )}
        </div>
      </div>
    );
  }

  function renderItem(
    item: MultipleChoicePublicItem,
    index: number,
    itemDetail: ItemDetail | undefined,
    showHintBulb = true
  ) {
    const sel = selections[item.id] ?? [];
    const hasImages = item.options.some((o) => !!o.imageUrl);
    const questionId = `mc-q-${item.id}`;

    // Без картинок — картка (шапка+підкладка-пул), не низка окремих чипів.
    // questionId — для aria-labelledby групи плиток на текст питання,
    // замість дублювання тексту в кожній плитці aria-label.
    if (!hasImages) {
      return (
        <div key={item.id} className="row-points-tab-wrap">
          {pointsTab(item, itemDetail)}
          <ChoiceQuestionCard
          header={renderQuestionHeader(item, index, itemDetail, questionId, "", showHintBulb)}
          role={item.multiple ? "group" : "radiogroup"}
          ariaLabelledBy={questionId}
          options={item.options.map((o, idx) => {
            const opt = itemDetail?.options.find((x) => x.id === o.id);
            const chosen = itemDetail ? !!opt?.selected : sel.includes(o.id);
            return {
              id: o.id,
              role: item.multiple ? "checkbox" : "radio",
              selected: chosen,
              disabled: !!itemDetail,
              onClick: () => toggle(item.id, o.id, item.multiple),
              tileClassName: chipClass(item.id, o.id, itemDetail),
              indicatorClassName: tileIndicatorClass(item.id, o.id, itemDetail),
              indicatorContent: chosen ? <Check size={12} className="text-white" aria-hidden /> : null,
              label: optionDisplayText(o.text, idx),
            };
          })}
          />
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
      <div key={item.id} className="row-points-tab-wrap">
        {pointsTab(item, itemDetail)}
        <div className={CARD_WRAP}>
        {renderQuestionHeader(item, index, itemDetail, questionId, "md:pt-[22px] md:px-4 md:pb-4", showHintBulb)}
        <div
          role={item.multiple ? "group" : "radiogroup"}
          aria-labelledby={questionId}
          className="border-t border-[#e6e6f0] glass-inset-bg bg-neutral-50 p-2.5 dark:border-[var(--card-border)] pool-dark-bg"
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
                    disabled={!!itemDetail}
                    className={`flex h-full min-w-0 items-center justify-center rounded-lg border p-1.5 text-center text-sm leading-snug break-words [overflow-wrap:anywhere] transition-colors sm:p-2 ${imageCardClass(item.id, o.id, itemDetail, false)}`}
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
                  disabled={!!itemDetail}
                  role={item.multiple ? "checkbox" : "radio"}
                  aria-checked={indicator.selected}
                  aria-label={o.text || undefined}
                  className={`flex h-full min-w-0 flex-col items-center gap-1 rounded-lg border p-1.5 text-center transition-colors sm:p-2 ${imageCardClass(item.id, o.id, itemDetail, true)}`}
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
  function renderDropdownRow(
    item: MultipleChoicePublicItem,
    index: number,
    itemDetail: ItemDetail | undefined,
    showHintBulb = true
  ) {
    const sel = selections[item.id] ?? [];
    const hasHintBulb = showHintBulb && !!item.hint;
    const selectedOptions = item.options.filter((o) => sel.includes(o.id));
    const isCorrect = itemDetail ? itemDetail.options.every((o) => o.correct === o.selected) : null;
    const pillState: "correct" | "incorrect" | "selected" | "empty" =
      isCorrect === true ? "correct" : isCorrect === false ? "incorrect" : selectedOptions.length > 0 ? "selected" : "empty";
    // Темна — обидва стани ДО перевірки (вибрано/порожньо) тепер на одному
    // періwinkle полі (select-field-pill, globals.css) замість сіро-чорного
    // (dark:bg-neutral-800) чи індиго-підсвітки: лише колір тексту різний
    // (--chosen кремовий / --placeholder блідо-лавандовий). Світла тема —
    // ті самі класи, що раніше, без змін.
    const pillClass =
      pillState === "correct"
        ? "border-green-500 bg-green-50 text-green-700 dark:border-green-600 dark:bg-green-950/30 dark:text-green-300"
        : pillState === "incorrect"
          ? "border-red-500 bg-red-50 text-red-700 dark:border-red-600 dark:bg-red-950/30 dark:text-red-300"
          : pillState === "selected"
            ? "border-indigo-500 bg-indigo-100 text-indigo-700 select-field-pill select-field-pill--chosen"
            : "glass-gap-shadow border-[rgba(217,183,101,0.55)] bg-white text-neutral-500 select-field-pill select-field-pill--placeholder";
    const label =
      selectedOptions.length === 0
        ? t("status.chooseOption")
        : item.multiple
          ? selectedOptions.map((o) => stripOptionLetterPrefix(o.text)).join(", ")
          : optionDisplayText(
              selectedOptions[0].text,
              item.options.findIndex((o) => o.id === selectedOptions[0].id)
            );

    // Речення для dropdown могло містити рівно один маркер "{{}}" (адмінка:
    // "Je {{}} au cinéma.") — раніше він позначав місце вбудованого
    // <select> прямо в тексті. У новому рядковому вигляді відповідь вибирають
    // у пілюлі праворуч, а не інлайн у тексті, тому маркер просто прибираю
    // з відображення (без заміни на видимий штрих) — зайвий пропуск після
    // цього згортаю в один пробіл, щоб речення читалось природно.
    const questionText = frenchNbsp(item.sentence.replace("{{}}", " ").replace(/\s{2,}/g, " ").trim());

    const resultStateClass =
      isCorrect === true ? "chrono-phrase-row--correct" : isCorrect === false ? "chrono-phrase-row--incorrect" : "";

    return (
      <div key={item.id} className="row-points-tab-wrap">
        {pointsTab(item, itemDetail)}
        <div
          className={`glass-item-card flex flex-col gap-2 px-3 pt-4 pb-2.5 transition-colors md:flex-row md:items-center md:gap-3 md:pt-[18px] ${resultStateClass}`}
        >
        <div className="flex min-w-0 flex-1 items-start gap-2.5">
          {config.items.length > 1 && (
            <span className="item-number-badge" aria-label={t("aria.question", { n: index + 1 })}>
              {index + 1}
            </span>
          )}
          <div className="min-w-0 flex-1">
            <div className="flex items-start gap-1.5">
              <p className="min-w-0 flex-1 break-words leading-snug [overflow-wrap:anywhere]">
                {questionText}
              </p>
              {hasHintBulb && (
                <HintBulb
                  state={hintShown.has(item.id) ? "used" : "available"}
                  onClick={() => toggleHintVisible(item.id)}
                  label={hintVisible.has(item.id) ? t("button.collapseHint") : t("button.showHint")}
                  className="mt-0.5 shrink-0"
                />
              )}
            </div>
            {item.multiple && (
              <p className="mt-0.5 text-xs italic text-[var(--text-muted-caption)] dark:text-[var(--text-muted-caption)]">
                {item.correctCount} {optionsCountWord(item.correctCount)}
              </p>
            )}
            {hasHintBulb && hintVisible.has(item.id) && (
              <div className="mt-2 rounded-md border border-amber-200 bg-amber-50 p-2 text-sm break-words text-neutral-700 dark:border-amber-800 dark:bg-amber-950/40 dark:text-neutral-200">
                {item.hint}
              </div>
            )}
          </div>
        </div>
        <div className="group relative w-full flex-none md:w-56">
          <div
            className={`flex h-10 w-full items-center justify-between gap-2 rounded-full border px-3 text-sm transition-colors md:h-9 group-focus-within:ring-2 group-focus-within:ring-brand dark:group-focus-within:ring-0 ${pillClass}`}
          >
            <span
              className="truncate"
              title={selectedOptions.map((o) => stripOptionLetterPrefix(o.text)).join(", ") || undefined}
            >
              {label}
            </span>
            <ChevronDown size={14} className="shrink-0 opacity-60 select-field-chevron" aria-hidden />
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
            disabled={!!itemDetail}
            aria-label={t("aria.answerToQuestion", { n: index + 1 })}
            className="absolute inset-0 h-full w-full cursor-pointer text-base opacity-0 disabled:cursor-not-allowed select-field-native"
          >
            {!item.multiple && <option value="">{t("status.chooseOptionDash")}</option>}
            {item.options.map((o, idx) => (
              <option key={o.id} value={o.id}>
                {optionDisplayText(o.text, idx)}
              </option>
            ))}
          </select>
        </div>
        </div>
      </div>
    );
  }

  const answeredCount = config.items.filter((it) => (selections[it.id] ?? []).length > 0).length;

  // startIndex — глобальна позиція ПЕРШОГО питання items (наскрізна
  // нумерація .item-number-badge, не локальна в межах блоку).
  function renderItems(items: MultipleChoicePublicItem[], startIndex: number, scopedDetail: MultipleChoiceDetail | undefined) {
    return config.display === "dropdown" ? (
      <div className={`flex flex-col ${itemsGapClass} pt-3`}>
        {items.map((item, i) =>
          renderDropdownRow(item, startIndex + i, scopedDetail?.items.find((d) => d.id === item.id))
        )}
      </div>
    ) : (
      <div className={`flex flex-col ${itemsGapClass} pt-3`}>
        {items.map((item, i) => renderItem(item, startIndex + i, scopedDetail?.items.find((d) => d.id === item.id)))}
      </div>
    );
  }

  // Контент toggle-картки "Правильні відповіді" (TaskResult children) —
  // одна картка (той самий glass-item-card + item-number-badge, що рядки
  // самої вправи) на питання поточного скоупу (блок чи вся вправа), у
  // порядку/нумерації items ("та сама нумерація, що в самій вправі" —
  // startIndex, як у renderItems/renderDropdownRow вище). detailItems
  // відсутній до першої перевірки скоупу — тоді toggle не рендериться
  // (TaskResult сам ховає його без children).
  function renderAnswersToggle(
    items: MultipleChoicePublicItem[],
    startIndex: number,
    detailItems: ItemDetail[] | undefined
  ) {
    if (!detailItems) return null;
    return (
      <div className="flex flex-col gap-2">
        {items.map((item, i) => {
          const d = detailItems.find((x) => x.id === item.id);
          if (!d) return null;
          const correctOpt = d.options.find((o) => o.correct);
          const selectedOpt = d.options.find((o) => o.selected);
          const itemCorrect = d.options.every((o) => o.correct === o.selected);
          const questionText = frenchNbsp(
            item.sentence.replace("{{}}", " ").replace(/\s{2,}/g, " ").trim()
          );
          return (
            <div key={item.id} className="glass-item-card flex items-start gap-2.5 px-3 py-2.5">
              <span className="item-number-badge shrink-0" aria-label={t("aria.question", { n: startIndex + i + 1 })}>
                {startIndex + i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <p className="min-w-0 break-words leading-snug [overflow-wrap:anywhere]">{questionText}</p>
                <p className="mt-1 flex items-start gap-1 text-base font-semibold text-[#1f7a3d] dark:text-[#bff0d0]">
                  <Check size={14} className="mt-0.5 shrink-0" aria-hidden />
                  <span>
                    <span
                      className="mr-1 text-[13px] font-bold text-[#55546b] dark:text-white"
                      style={{ fontFamily: "var(--font-heading)" }}
                    >
                      {t("answer.correctAnswerLabel")}
                    </span>
                    {correctOpt ? stripOptionLetterPrefix(correctOpt.text) : ""}
                  </span>
                </p>
                {!itemCorrect && (
                  <p className="mt-1 flex items-start gap-1 text-base font-semibold text-[#b42318] dark:text-[#f87171]">
                    <X size={14} className="mt-0.5 shrink-0" aria-hidden />
                    <span>
                      <span
                        className="mr-1 text-[13px] font-bold text-[#55546b] dark:text-white"
                        style={{ fontFamily: "var(--font-heading)" }}
                      >
                        {t("answer.yourAnswerLabel")}
                      </span>
                      {selectedOpt ? stripOptionLetterPrefix(selectedOpt.text) : t("status.notChosen")}
                    </span>
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  // ==== Гілка блоків (>5 питань) ====
  const [activeBlock, setActiveBlock] = useState(0);
  const blockCheckConfirm = useCheckConfirm();
  useEffect(() => {
    blockCheckConfirm.cancelCheck();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeBlock]);
  const [blockResults, setBlockResults] = useState<Record<number, MultipleChoiceResult>>({});
  const [blockPending, setBlockPending] = useState<Record<number, boolean>>({});
  const [blockError, setBlockError] = useState<Record<number, string | null>>({});

  const allBlocksChecked = useBlocks && blockCount > 0 && Object.keys(blockResults).length === blockCount;

  const aggregateResult: MultipleChoiceResult | null = useMemo(() => {
    if (!allBlocksChecked) return null;
    const results = Object.values(blockResults);
    const items = results.flatMap((r) => r.detail.items);
    const correctCount = items.filter((it) => it.options.every((o) => o.correct === o.selected)).length;
    return {
      correct: items.length > 0 && correctCount === items.length,
      score: items.length > 0 ? Math.round((correctCount / items.length) * 100) : 0,
      detail: { items },
      pointsEarned: results.reduce((sum, r) => sum + (r.pointsEarned ?? 0), 0),
      pointsPossible: results.reduce((sum, r) => sum + (r.pointsPossible ?? 0), 0),
    };
  }, [allBlocksChecked, blockResults]);

  useEffect(() => {
    if (aggregateResult) onResult?.(aggregateResult);
  }, [aggregateResult, onResult]);

  async function submitBlock(blockIndex: number) {
    const blockItems = itemBlocks[blockIndex];
    const answer = blockItems.map((it) => ({
      itemId: it.id,
      selected: selections[it.id] ?? [],
      hintUsed: hintShown.has(it.id),
    }));
    setBlockPending((prev) => ({ ...prev, [blockIndex]: true }));
    setBlockError((prev) => ({ ...prev, [blockIndex]: null }));
    try {
      const res = await fetch("/api/exercises/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId, answer, blockIndex }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? t("error.checkFailed"));
      }
      const result = (await res.json()) as MultipleChoiceResult;
      setBlockResults((prev) => ({ ...prev, [blockIndex]: result }));
      router.refresh();
    } catch (e) {
      setBlockError((prev) => ({
        ...prev,
        [blockIndex]: e instanceof Error ? e.message : t("error.checkFailed"),
      }));
    } finally {
      setBlockPending((prev) => ({ ...prev, [blockIndex]: false }));
    }
  }

  function renderBlock() {
    const blockItems = itemBlocks[activeBlock];
    const startIndex = itemBlocks.slice(0, activeBlock).reduce((sum, b) => sum + b.length, 0);
    const blockResult = blockResults[activeBlock];
    const blockDetail = blockResult?.detail;
    const errMsg = blockError[activeBlock];

    return (
      <div className="flex flex-col gap-3">
        {renderItems(blockItems, startIndex, blockDetail)}

        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-3">
            {blockResult && (
              <TaskResult
                correct={blockResult.correct}
                pointsEarned={blockResult.pointsEarned}
                pointsPossible={blockResult.pointsPossible}
                hideSummaryRow={!hidePoints}
                toggleTitle={t("panel.correctAnswers")}
                toggleCount={blockItems.length}
                hintSummary={{
                  hintCount: blockDetail?.items.filter((it) => it.hintUsed).length ?? 0,
                  reducesPoints: config.hintsReducePoints,
                }}
              >
                {renderAnswersToggle(blockItems, startIndex, blockDetail?.items)}
              </TaskResult>
            )}
          </div>
          {blockCheckConfirm.confirming && (
            <CheckConfirmBar
              unansweredCount={activeBlockUnanswered}
              onConfirm={() => blockCheckConfirm.confirmCheck(() => submitBlock(activeBlock))}
              onCancel={blockCheckConfirm.cancelCheck}
            />
          )}
          {errMsg && <p className="text-sm text-red-600 dark:text-red-400">{errMsg}</p>}
        </div>
      </div>
    );
  }

  if (isPractice) {
    return (
      <div className={EXERCISE_STACK}>
        {renderPracticeList()}
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={submitPractice}
            disabled={practiceCheck.pending || !practiceAllAnswered}
            className={`self-start ${BUTTON_CHECK}`}
          >
            {practiceCheck.pending ? t("button.checking") : t("button.check")}
          </button>
          {practiceCheck.error && <p className="text-sm text-red-600 dark:text-red-400">{practiceCheck.error}</p>}
        </div>
        {lightboxSrc && <ImageLightbox src={lightboxSrc} onClose={() => setLightboxSrc(null)} />}
      </div>
    );
  }

  // ЕТАП M — кнопка "Перевірити блок" для спільного рядка check+←/→
  // (BlockNavFooter) — ті самі значення, що читає renderBlock() вище.
  const activeBlockItems = itemBlocks[activeBlock];
  const activeBlockResult = blockResults[activeBlock];
  const activeBlockPending = !!blockPending[activeBlock];
  const activeBlockUnanswered =
    activeBlockItems?.filter((it) => (selections[it.id] ?? []).length === 0).length ?? 0;
  // Єдина пілюля балів (задача "єдина пілюля балів усюди"): до перевірки —
  // бали ПОТОЧНОГО блоку/вправи (сума items[].points); після перевірки
  // активного блоку/вправи — earned sur possible + статус-чіп.
  const currentBlockPoints = (useBlocks ? activeBlockItems ?? [] : config.items).reduce(
    (sum, it) => sum + it.points,
    0
  );
  const activeBlockOrSingleResult = useBlocks ? activeBlockResult : single.result;
  const headerPoints = hidePoints
    ? undefined
    : headerPointsState(
        activeBlockOrSingleResult?.pointsPossible ?? currentBlockPoints,
        activeBlockOrSingleResult?.pointsEarned,
        lang
      );
  const checkButtonEl = useBlocks && !activeBlockResult ? (
    <button
      type="button"
      onClick={() => blockCheckConfirm.attemptCheck(activeBlockUnanswered, () => submitBlock(activeBlock))}
      disabled={activeBlockPending}
      className="exercise-block-check-btn btn-check"
    >
      {activeBlockPending ? t("button.checking") : t("button.checkBlock")}
    </button>
  ) : null;

  return (
    <div className={EXERCISE_STACK}>
      <BlockTabs
        plaqueText={plaqueText}
        blockCount={blockCount}
        activeBlock={activeBlock}
        onChangeBlock={setActiveBlock}
        isBlockChecked={(i) => i in blockResults}
      />
      <TaskPanelHeader
        blockCount={blockCount}
        activeBlock={activeBlock}
        onChangeBlock={setActiveBlock}
        isBlockChecked={(i) => i in blockResults}
        {...(headerPoints ?? {})}
        instructionText={config.instructions ?? DEFAULT_INSTRUCTIONS.multiple_choice.instruction}
        subInstructionText={taskTranslationLine(config.subInstructions, lang, {
          uk: DEFAULT_INSTRUCTIONS.multiple_choice.subInstruction,
          en: DEFAULT_TRANSLATION_EN.multiple_choice,
        })}
        hintText={
          config.items.some((it) => it.hint) ? hintExplanationText("multiple_choice", lang) : null
        }
      />

      {!useBlocks ? (
        <>
          {/* Картинковий і текстовий режими мають однакову обгортку
              (CARD_WRAP), тож однаковий компактний gap-3 між картками на
              всіх екранах; dropdown — спільний контейнер-список (divide-y/
              rounded-xl/border, той самий прийом, що текстовий режим
              chronological_order). */}
          {renderItems(config.items, 0, detail)}

          <div className="flex flex-col gap-3">
            {!single.result ? (
              <div className="flex flex-col items-start gap-2">
                <button
                  type="button"
                  onClick={() =>
                    singleCheckConfirm.attemptCheck(config.items.length - answeredCount, submitSingle)
                  }
                  disabled={single.pending}
                  className={`self-start ${BUTTON_CHECK}`}
                >
                  {single.pending ? t("button.checking") : t("button.check")}
                </button>
                {singleCheckConfirm.confirming && (
                  <CheckConfirmBar
                    unansweredCount={config.items.length - answeredCount}
                    onConfirm={() => singleCheckConfirm.confirmCheck(submitSingle)}
                    onCancel={singleCheckConfirm.cancelCheck}
                  />
                )}
              </div>
            ) : (
              <TaskResult
                correct={single.result.correct}
                pointsEarned={single.result.pointsEarned}
                pointsPossible={single.result.pointsPossible}
                hideSummaryRow={!hidePoints}
                toggleTitle={t("panel.correctAnswers")}
                toggleCount={config.items.length}
                hintSummary={{
                  hintCount: detail?.items.filter((it) => it.hintUsed).length ?? 0,
                  reducesPoints: config.hintsReducePoints,
                }}
              >
                {renderAnswersToggle(config.items, 0, detail?.items)}
              </TaskResult>
            )}
            {single.error && <p className="text-sm text-red-600 dark:text-red-400">{single.error}</p>}
          </div>
        </>
      ) : (
        <BlockNavigation
          blockCount={blockCount}
          activeBlock={activeBlock}
          onChangeBlock={setActiveBlock}
          blockResults={blockResults}
          checkButton={checkButtonEl}
        >
          {renderBlock()}
        </BlockNavigation>
      )}

      {lightboxSrc && <ImageLightbox src={lightboxSrc} onClose={() => setLightboxSrc(null)} />}
    </div>
  );
}
