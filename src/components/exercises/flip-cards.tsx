"use client";

import { useState, useRef, useEffect, useSyncExternalStore, type ReactNode } from "react";
import { Shuffle, ArrowRight, ChevronLeft, ChevronRight, RotateCw } from "lucide-react";
import type { FlipCard as FlipCardType, FlipCardsConfig } from "@/lib/exercises/types";
import { ImageOrPlaceholder } from "@/components/image-or-placeholder";
import { ImageZoomBadge } from "./image-zoom-badge";
import { ImageLightbox } from "./image-lightbox";
import { DEFAULT_INSTRUCTIONS, FLIP_CARDS_RANDOM_INSTRUCTIONS } from "@/lib/exercises/default-instructions";
import { SELECTED_OPTION_CLASS } from "./selection-style";
import { TaskPanelHeader } from "./task-panel-header";
import { ANSWER_CARD_BASE, ANSWER_CARD_DEFAULT } from "./answer-card-style";
import { frenchNbsp } from "@/lib/text/french-typography";
import { STUDENT_BUTTON_PRIMARY } from "@/lib/button-styles";
import { EXERCISE_STACK } from "@/lib/spacing";
import { BlockNavFooter, BlockTabs } from "./block-navigation";
import { AudioPill } from "@/components/audio-pill";

const PAGE_SIZE = 6;

// variant "normal" — звичайний manual-режим (клікабельна, front/back).
// "highlighted" — рулетка зараз "пробігає" через цю картку (лише бордюр,
// не клікабельна — картка ще не обрана). "selected" — приземлились саме
// тут: збільшена, яскрава рамка, клікабельна, показує initialSide/
// протилежну. "dimmed" — решта сітки після приземлення: та сама сітка, не
// прихована повністю, лише притлумлена й неклікабельна.
function FlipCardTile({
  card,
  variant = "normal",
  initialSide = "front",
}: {
  card: FlipCardType;
  variant?: "normal" | "highlighted" | "selected" | "dimmed";
  initialSide?: "front" | "back";
}) {
  const [flipped, setFlipped] = useState(false);
  const [zoomOpen, setZoomOpen] = useState(false);
  const clickable = variant === "normal" || variant === "selected";
  const shown = flipped ? oppositeSide(card, initialSide) : sideText(card, initialSide);

  const variantClass = {
    normal: ANSWER_CARD_DEFAULT,
    highlighted: SELECTED_OPTION_CLASS,
    selected: `${SELECTED_OPTION_CLASS} z-10 scale-105 shadow-lg`,
    dimmed: `${ANSWER_CARD_DEFAULT} opacity-30`,
  }[variant];

  // div[role=button], не <button> — усередині може бути аудіо-пілюля
  // (audio-pill.tsx) зі справжніми <button>, а вкладати button у button
  // недопустимо в HTML.
  function handleKeyDown(e: React.KeyboardEvent) {
    if (!clickable) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      setFlipped((f) => !f);
    }
  }

  return (
    <div
      role="button"
      tabIndex={clickable ? 0 : -1}
      aria-disabled={!clickable}
      onClick={clickable ? () => setFlipped((f) => !f) : undefined}
      onKeyDown={handleKeyDown}
      className={`flex min-w-0 flex-col items-center gap-2 text-base transition-all ${clickable ? "cursor-pointer" : "cursor-default"} ${ANSWER_CARD_BASE} ${variantClass}`}
    >
      {card.image_url && (
        <span className="relative w-full">
          <ImageZoomBadge onOpen={() => setZoomOpen(true)} />
          <ImageOrPlaceholder
            src={card.image_url}
            alt=""
            className="h-24 w-full rounded object-cover"
            useFocus
          />
        </span>
      )}
      {zoomOpen && card.image_url && (
        <ImageLightbox src={card.image_url} onClose={() => setZoomOpen(false)} />
      )}
      {card.audio_url && <AudioPill src={card.audio_url} compact />}
      <span className="min-w-0 max-w-full break-words [overflow-wrap:anywhere]">{frenchNbsp(shown)}</span>
      {clickable && (
        <span className="text-xs text-neutral-400 dark:text-neutral-500">
          {flipped ? "клік — назад" : "клік — перевернути"}
        </span>
      )}
    </div>
  );
}

const TICK_MS = 90;
const TOTAL_TICKS = 18;

// Wordwall Flip Tiles-стиль: "рулетка" крутиться по картках, зупиняється на
// заздалегідь обраній НЕВИКАЗАНІЙ картці, показує лише config.revealSide,
// клік відкриває іншу сторону. Пул для вибору — лише картки ПОТОЧНОЇ
// сторінки (pageIndices, глобальні індекси в cards): просто уникаємо
// негайного повтору останньої обраної картки (не трекаємо весь пройдений
// пул сторінки — спрощена вимога задачі "пагінація", на відміну від
// колишньої shownIndices-логіки на весь список карток).
function RandomRevealFlipCards({
  cards,
  revealSide,
  pageIndices,
  footer,
}: {
  cards: FlipCardType[];
  revealSide: "front" | "back";
  pageIndices: number[];
  // Нижній рядок ←/→ (BlockNavFooter, block-navigation.tsx) — рендериться
  // тут, не в FlipCardsExercise, бо має сидіти ПІД сіткою САМЕ цього
  // режиму (плашка/вкладки блоків тепер над усією вправою, не тут —
  // BlockTabs, FlipCardsExercise нижче). Загорнутий разом із сіткою в
  // один div БЕЗ власного flex/gap (коментар у block-navigation.tsx,
  // BlockNavigation): інакше gap-3 цієї обгортки додавався б поверх
  // margin-top самого футера.
  footer: ReactNode;
}) {
  const [spinning, setSpinning] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState<number | null>(null);
  const [revealedIndex, setRevealedIndex] = useState<number | null>(null);
  // Зростає щоразу на новому спіні — частина key кожної плитки нижче, щоб
  // React перемонтовував їх на кожен раунд: без цього internal flipped-стан
  // конкретної плитки міг би "протекти" в наступний раунд, якщо рулетка
  // випадково знову зупиниться на тій самій картці після повного циклу.
  const [roundId, setRoundId] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  function spin() {
    if (spinning || pageIndices.length === 0) return;

    const candidates =
      pageIndices.length > 1 && revealedIndex !== null && pageIndices.includes(revealedIndex)
        ? pageIndices.filter((i) => i !== revealedIndex)
        : pageIndices;
    const target = candidates[Math.floor(Math.random() * candidates.length)];

    setSpinning(true);
    setRevealedIndex(null);
    setRoundId((r) => r + 1);

    let tick = 0;
    let pos = Math.max(0, pageIndices.indexOf(highlightIndex ?? pageIndices[0]));
    intervalRef.current = setInterval(() => {
      tick++;
      if (tick >= TOTAL_TICKS) {
        if (intervalRef.current) clearInterval(intervalRef.current);
        setHighlightIndex(target);
        setRevealedIndex(target);
        setSpinning(false);
        return;
      }
      pos = (pos + 1) % pageIndices.length;
      setHighlightIndex(pageIndices[pos]);
    }, TICK_MS);
  }

  function variantFor(i: number): "normal" | "highlighted" | "selected" | "dimmed" {
    if (revealedIndex === null) return spinning && highlightIndex === i ? "highlighted" : "normal";
    return revealedIndex === i ? "selected" : "dimmed";
  }

  return (
    <div className="flex flex-col gap-3">
      <button
        type="button"
        onClick={spin}
        disabled={spinning}
        className={`self-start ${STUDENT_BUTTON_PRIMARY}`}
      >
        {spinning ? "Крутимо..." : "Випадковий вибір"}
      </button>

      <div>
        {/* Усі картки лишаються в DOM на весь час вправи (не лише
            сторінки) — це й зберігає "клік — перевернути" стан кожної
            плитки при перемиканні сторінок (немонтування/монтування
            щоразу скидало б внутрішній useState плитки). Поза поточною
            сторінкою — просто hidden, не видалено з розмітки. */}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {cards.map((card, i) => (
            <div key={`${roundId}-${i}`} className={pageIndices.includes(i) ? "contents" : "hidden"}>
              <FlipCardTile card={card} variant={variantFor(i)} initialSide={revealSide} />
            </div>
          ))}
        </div>
        {footer}
      </div>
    </div>
  );
}

function sideText(card: FlipCardType, side: "front" | "back"): string {
  return side === "front" ? card.front : card.back;
}

function oppositeSide(card: FlipCardType, side: "front" | "back"): string {
  return side === "front" ? card.back : card.front;
}

// Локальний Fisher-Yates — той самий принцип, що приватні копії в
// vocab-quiz-logic.ts/sanitize.ts/optimize-split.ts/crossword-grid.ts
// (немає спільного експортованого хелпера для цього в проєкті).
function shuffleArray<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

const DECK_SWIPE_THRESHOLD_PX = 100;
const DECK_SWIPE_VELOCITY_PX_MS = 0.5;
const DECK_FLY_OUT_MS = 200;
const DECK_TAP_THRESHOLD_PX = 6;
const DECK_FLIP_MS = 400;

// useSyncExternalStore, не useState+useEffect (той самий принцип, що
// video-frame.tsx PHONE_QUERY) — matchMedia недоступний під час SSR,
// getServerSnapshot повертає "безпечний" дефолт (анімація є, підказка
// показана), підписка на "change" синхронізує живу зміну системної
// настройки, не лише значення на монтуванні.
function subscribeMedia(query: string) {
  return (onStoreChange: () => void) => {
    const mql = window.matchMedia(query);
    mql.addEventListener("change", onStoreChange);
    return () => mql.removeEventListener("change", onStoreChange);
  };
}
const subscribeReducedMotion = subscribeMedia("(prefers-reduced-motion: reduce)");
function getReducedMotionSnapshot() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
function getReducedMotionServerSnapshot() {
  return false;
}
const subscribeTouchOnly = subscribeMedia("(hover: none) and (pointer: coarse)");
function getTouchOnlySnapshot() {
  return window.matchMedia("(hover: none) and (pointer: coarse)").matches;
}
function getTouchOnlyServerSnapshot() {
  return false;
}

// Колода питань для усної відповіді — front (питання) завжди показаний,
// back (переклад) — на зворотній стороні, перевертається дотиком/кнопкою
// (на відміну від manual/random_reveal, де "сторона" задається revealSide
// на всю вправу, тут кожна картка перевертається окремо і скидається при
// переході до наступної). cards — уже відфільтровано по front.trim()
// (FlipCardsExercise), у автентичному порядку вчительки: саме цей порядок
// (не remaining) відновлюється "Почати знову".
function DeckFlipCards({ cards }: { cards: FlipCardType[] }) {
  const [remaining, setRemaining] = useState<FlipCardType[]>(cards);
  // Зростає на кожне "прибирання" картки (кнопкою чи свайпом) і на
  // "Почати знову" — ремонтує обгортку верхньої картки, щоб внутрішній
  // drag-стан (dragX/flyDir) не "протік" у наступну картку, яка займе
  // те саме місце в DOM. Той самий прийом, що roundId у
  // RandomRevealFlipCards вище.
  const [roundKey, setRoundKey] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [dragX, setDragX] = useState(0);
  const [flyDir, setFlyDir] = useState<1 | -1 | null>(null);
  const [zoomOpen, setZoomOpen] = useState(false);
  const [flipped, setFlipped] = useState(false);
  const reducedMotion = useSyncExternalStore(
    subscribeReducedMotion,
    getReducedMotionSnapshot,
    getReducedMotionServerSnapshot
  );
  const hideHintOnTouch = useSyncExternalStore(subscribeTouchOnly, getTouchOnlySnapshot, getTouchOnlyServerSnapshot);
  const startXRef = useRef(0);
  const startYRef = useRef(0);
  const startTimeRef = useRef(0);

  const total = cards.length;
  const finished = remaining.length === 0;
  const top = remaining[0];
  const peek1 = remaining[1];
  const peek2 = remaining[2];
  const canFlip = !finished && top.back.trim().length > 0;

  function removeTop() {
    setRemaining((prev) => prev.slice(1));
    setRoundKey((k) => k + 1);
    setDragX(0);
    setFlyDir(null);
    setFlipped(false);
  }

  function flyOut(direction: 1 | -1) {
    if (reducedMotion) {
      removeTop();
      return;
    }
    setFlyDir(direction);
    setTimeout(removeTop, DECK_FLY_OUT_MS);
  }

  function handlePointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (flyDir !== null) return;
    // Не починаємо драг, якщо натиск почався на аудіо-плеєрі, кнопці
    // (лупа картинки, тощо) чи посиланні — цим елементам потрібен власний
    // клік, не перехоплений свайпом/тапом картки (і setPointerCapture
    // нижче теж НЕ викликається, тож клік на <audio> лишається звичайним).
    if ((e.target as HTMLElement).closest("audio, button, a")) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    startXRef.current = e.clientX;
    startYRef.current = e.clientY;
    startTimeRef.current = performance.now();
    setDragging(true);
  }

  function handlePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!dragging) return;
    setDragX(e.clientX - startXRef.current);
  }

  // Теж вирізняє "тап" (руху менше DECK_TAP_THRESHOLD_PX по обох осях) —
  // такий реліз перевертає картку (якщо є переклад) замість свайпу/повернення
  // на місце; завершений драг (рух більший за порог) НІКОЛИ не перевертає.
  function handlePointerUp(e: React.PointerEvent<HTMLDivElement>) {
    if (!dragging) return;
    setDragging(false);
    const dy = e.clientY - startYRef.current;
    const elapsed = Math.max(1, performance.now() - startTimeRef.current);
    const velocity = Math.abs(dragX) / elapsed;
    if (Math.abs(dragX) < DECK_TAP_THRESHOLD_PX && Math.abs(dy) < DECK_TAP_THRESHOLD_PX) {
      setDragX(0);
      if (canFlip) setFlipped((f) => !f);
      return;
    }
    if (Math.abs(dragX) > DECK_SWIPE_THRESHOLD_PX || velocity > DECK_SWIPE_VELOCITY_PX_MS) {
      flyOut(dragX > 0 ? 1 : -1);
    } else {
      setDragX(0);
    }
  }

  function handlePointerCancel() {
    setDragging(false);
    setDragX(0);
  }

  function handleShuffle() {
    setRemaining((prev) => shuffleArray(prev));
    setFlipped(false);
  }

  function toggleFlip() {
    setFlipped((f) => !f);
  }

  function handleRestart() {
    setRemaining(cards);
    setRoundKey((k) => k + 1);
    setDragX(0);
    setFlyDir(null);
    setFlipped(false);
  }

  const topTransform = flyDir
    ? `translateX(${flyDir * 480}px) rotate(${flyDir * 24}deg)`
    : `translateX(${dragX}px) rotate(${dragX / 18}deg)`;
  const topTransition = dragging || reducedMotion ? "none" : `transform ${DECK_FLY_OUT_MS}ms ease-out`;
  const topCursor = dragging ? "grabbing" : canFlip ? "pointer" : "grab";
  // Платформова картка-грань: рамка/фон/тінь/radius/padding — ТУТ (на
  // самій грані, що обертається в 3D), не на зовнішній draggable-обгортці
  // нижче: рамка має "перевертатись" разом із вмістом граней, а не
  // лишатись статичним контуром. min-height — на draggable-обгортці
  // (height-карту), бо грані всередині absolute inset-0 і самі по собі не
  // задають висоту предка.
  const faceInnerClass =
    "flex flex-col items-center justify-between gap-2 rounded-[14px] border-[1.5px] border-[#dcbd6e] glass-gold-edge glass-card-shadow bg-white p-[18px_16px_14px] dark:rounded-lg dark:border dark:border-neutral-700 dark:bg-neutral-800 dark:shadow-sm sm:p-[26px_34px_20px]";
  const faceClass = `absolute inset-0 ${faceInnerClass}`;
  // backfaceVisibility — через inline style, не Tailwind arbitrary-клас:
  // надійніше для vendor-префіксу (-webkit-), той самий підхід, що вже
  // transform/transition нижче в цьому компоненті.
  const backfaceHiddenStyle: React.CSSProperties = {
    backfaceVisibility: "hidden",
    WebkitBackfaceVisibility: "hidden",
  };
  const canGoNext = !finished && flyDir === null && !dragging;

  return (
    <div className="flex flex-col gap-5">
      {/* pb — місце під декоративні смужки-"картки позаду", щоб вони
          виглядали стопкою знизу стику, не перекриваючи ряд навігації під
          стеком (проблема 1 з завдання). */}
      <div className="relative mx-auto w-full max-w-[640px] pb-[14px] sm:pb-[20px]">
        {finished ? (
          <div
            className={`flex w-full min-h-[250px] flex-col items-center justify-center gap-3 sm:min-h-[270px] ${ANSWER_CARD_BASE} ${ANSWER_CARD_DEFAULT}`}
          >
            <p className="text-base text-neutral-600 dark:text-neutral-300">Усі питання пройдено</p>
            <button type="button" onClick={handleRestart} className={STUDENT_BUTTON_PRIMARY}>
              Почати знову
            </button>
          </div>
        ) : (
          <>
            {peek2 && (
              <div
                aria-hidden
                className="absolute inset-x-[26px] bottom-0 z-0 h-10 rounded-[14px] border-[1.5px] border-[#ead9a6] bg-white dark:border-[rgba(217,183,101,0.35)] dark:bg-[rgba(255,255,255,0.03)] sm:inset-x-[36px] sm:h-[60px]"
              />
            )}
            {peek1 && (
              <div
                aria-hidden
                className="absolute inset-x-[13px] bottom-[9px] z-10 h-10 rounded-[14px] border-[1.5px] border-[#ead9a6] bg-[#fffdf6] dark:border-[rgba(217,183,101,0.35)] dark:bg-[rgba(255,255,255,0.04)] sm:inset-x-[18px] sm:h-[60px]"
              />
            )}
            <div
              key={roundKey}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerCancel}
              className="relative z-20 min-h-[250px] w-full sm:min-h-[270px]"
              style={{
                transform: topTransform,
                transition: topTransition,
                touchAction: "pan-y",
                cursor: topCursor,
                perspective: reducedMotion ? undefined : "1200px",
              }}
            >
              {reducedMotion ? (
                // Без ротації взагалі — миттєва заміна вмісту (не
                // visibility-трюк над обома гранями): найпростіший спосіб
                // "без анімації" і однаково коректний для читачів екрана.
                <div className={`h-full w-full ${faceInnerClass}`}>
                  {!flipped ? (
                    <DeckCardFront
                      card={top}
                      canFlip={canFlip && !hideHintOnTouch}
                      zoomOpen={zoomOpen}
                      onZoomOpen={() => setZoomOpen(true)}
                      onZoomClose={() => setZoomOpen(false)}
                    />
                  ) : (
                    <DeckCardBack translation={top.back} />
                  )}
                </div>
              ) : (
                <div
                  className="relative h-full w-full"
                  style={{
                    transformStyle: "preserve-3d",
                    transform: flipped ? "rotateY(180deg)" : "rotateY(0deg)",
                    transition: `transform ${DECK_FLIP_MS}ms ease`,
                  }}
                >
                  <div
                    className={faceClass}
                    style={backfaceHiddenStyle}
                    aria-hidden={flipped}
                    inert={flipped}
                  >
                    <DeckCardFront
                      card={top}
                      canFlip={canFlip && !hideHintOnTouch}
                      zoomOpen={zoomOpen}
                      onZoomOpen={() => setZoomOpen(true)}
                      onZoomClose={() => setZoomOpen(false)}
                    />
                  </div>
                  <div
                    className={faceClass}
                    style={{ ...backfaceHiddenStyle, transform: "rotateY(180deg)" }}
                    aria-hidden={!flipped}
                    inert={!flipped}
                  >
                    <DeckCardBack translation={top.back} />
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {!finished && (
        <div className="flex items-center justify-center gap-4">
          {/* Ліва стрілка — лише візуальна підказка напрямку свайпу: у
              компоненті немає механіки "повернутись до попередньої
              картки" (remaining лише зменшується), тож додавати нову дію
              тут не можна (умова задачі) — кнопка задизейблена навмисно. */}
          <button
            type="button"
            disabled
            aria-hidden
            tabIndex={-1}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-[1.5px] border-[#ead9a6] bg-white opacity-40 shadow-[0_2px_5px_-2px_rgba(120,90,20,0.3)] dark:border-[rgba(217,183,101,0.45)] dark:bg-[rgba(255,255,255,0.06)] sm:h-[46px] sm:w-[46px]"
          >
            <ChevronLeft size={20} strokeWidth={2.6} className="text-[#3b36c4] dark:text-[#8a88f5]" />
          </button>
          <span className="inline-flex h-8 shrink-0 items-center whitespace-nowrap rounded-full border-[1.5px] border-[#c9cdf5] bg-[#e0e4fb] px-4 text-[14px] font-extrabold text-[#3b36c4] dark:border-[#8a88f5] dark:bg-[rgba(75,70,218,0.3)] dark:text-[#dcdbf3]">
            Залишилось {remaining.length} з {total}
          </span>
          {/* Права стрілка — та сама дія, що свайп/"Відповів(ла), далі"
              (flyOut(1) → removeTop): дія вже існує в коді, кнопка лише
              дає їй другий видимий тригер. */}
          <button
            type="button"
            onClick={() => flyOut(1)}
            disabled={!canGoNext}
            aria-label="Наступна картка"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-[1.5px] border-[#ead9a6] bg-white shadow-[0_2px_5px_-2px_rgba(120,90,20,0.3)] transition-colors hover:border-[#d9b765] disabled:opacity-40 disabled:hover:border-[#ead9a6] dark:border-[rgba(217,183,101,0.45)] dark:bg-[rgba(255,255,255,0.06)] sm:h-[46px] sm:w-[46px]"
          >
            <ChevronRight size={20} strokeWidth={2.6} className="text-[#3b36c4] dark:text-[#8a88f5]" />
          </button>
        </div>
      )}

      {!finished && (
        <div className="flex flex-wrap items-center justify-center gap-3">
          <div className="order-2 flex w-full gap-3 sm:order-1 sm:w-auto">
            <button
              type="button"
              onClick={handleShuffle}
              disabled={remaining.length <= 1}
              className="flex h-11 flex-1 items-center justify-center gap-1.5 rounded-xl border-[1.5px] border-[#ead9a6] bg-white px-[18px] text-[15px] font-bold text-[#1a1640] shadow-[0_2px_5px_-2px_rgba(120,90,20,0.3)] disabled:opacity-50 dark:border-[rgba(217,183,101,0.45)] dark:bg-[rgba(255,255,255,0.06)] dark:text-neutral-100 sm:h-[46px] sm:flex-none sm:w-auto"
            >
              <Shuffle size={18} className="text-[#b8902f] dark:text-[#f6dc8e]" /> Перемішати
            </button>
            {canFlip && (
              <button
                type="button"
                onClick={toggleFlip}
                className="flex h-11 flex-1 items-center justify-center gap-1.5 rounded-xl border-[1.5px] border-[#ead9a6] bg-white px-[18px] text-[15px] font-bold text-[#1a1640] shadow-[0_2px_5px_-2px_rgba(120,90,20,0.3)] dark:border-[rgba(217,183,101,0.45)] dark:bg-[rgba(255,255,255,0.06)] dark:text-neutral-100 sm:h-[46px] sm:flex-none sm:w-auto"
              >
                {flipped ? "Показати питання" : "Показати переклад"}
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={removeTop}
            className="order-1 flex h-12 w-full items-center justify-center gap-1.5 rounded-xl bg-[linear-gradient(135deg,#5a55e6,#3b36c4)] px-[22px] text-[15px] font-extrabold text-white shadow-[0_8px_16px_-8px_rgba(59,54,196,0.6)] sm:order-2 sm:h-[46px] sm:w-auto"
          >
            Відповів(ла), далі <ArrowRight size={18} />
          </button>
        </div>
      )}
    </div>
  );
}

// Плашка "FR"/"UK" у верхньому лівому куті грані — яка сторона зараз
// показана (питання чи переклад). self-start на викликачі притискає її
// ліворуч, не по центру решти вмісту грані.
function DeckSideChip({ label }: { label: string }) {
  return (
    <span className="inline-flex h-[22px] items-center rounded-full border-[1.5px] border-[#c9cdf5] bg-[#e0e4fb] px-3 text-[12px] font-extrabold text-[#3b36c4] dark:border-[#8a88f5] dark:bg-[rgba(75,70,218,0.3)] dark:text-[#dcdbf3] sm:h-6">
      {label}
    </span>
  );
}

// front — питання (завжди велике, serif), опційні картинка/аудіо — та сама
// форма, що раніше жила прямо в DeckFlipCards, винесена в окремий компонент
// лише щоб не дублювати JSX між 3D-веткою (дві грані) і reduced-motion
// веткою (один елемент за раз). canFlip — чи є переклад: лише тоді внизу
// грані показана підказка "торкніться — переклад" (замінює колишній
// рядок-підказку під стеком, що перекривав стрілки, проблема 1 задачі).
function DeckCardFront({
  card,
  canFlip,
  zoomOpen,
  onZoomOpen,
  onZoomClose,
}: {
  card: FlipCardType;
  canFlip: boolean;
  zoomOpen: boolean;
  onZoomOpen: () => void;
  onZoomClose: () => void;
}) {
  return (
    <>
      <span className="self-start">
        <DeckSideChip label="FR" />
      </span>
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 px-2 text-center">
        {card.image_url && (
          <span className="relative w-full">
            <ImageZoomBadge onOpen={onZoomOpen} />
            <ImageOrPlaceholder src={card.image_url} alt="" className="mx-auto max-h-40 w-auto rounded object-contain" />
          </span>
        )}
        {zoomOpen && card.image_url && <ImageLightbox src={card.image_url} onClose={onZoomClose} />}
        <p className="max-w-full break-words text-[18px] font-semibold leading-[1.4] font-content text-[#1a1640] [overflow-wrap:anywhere] dark:text-neutral-100 sm:text-[24px]">
          {frenchNbsp(card.front)}
        </p>
        {card.audio_url && <AudioPill src={card.audio_url} compact />}
      </div>
      {canFlip ? (
        <span className="flex items-center gap-1.5 text-[12px] font-content text-[#8a7a4a] dark:text-neutral-400 sm:text-[14px]">
          <RotateCw size={16} className="hidden text-[#b8902f] dark:text-[#f6dc8e] sm:inline" />
          Торкніться картки, щоб побачити переклад
        </span>
      ) : (
        <span />
      )}
    </>
  );
}

// back — лише переклад (жодної картинки/аудіо, за умовою задачі). UK-чип
// замінює колишній текстовий лейбл "Переклад" — та сама роль, уже видно з
// контрасту "FR"/"UK" між двома гранями.
function DeckCardBack({ translation }: { translation: string }) {
  return (
    <>
      <span className="self-start">
        <DeckSideChip label="UK" />
      </span>
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-2 text-center">
        <p className="max-w-full break-words text-[17px] italic font-medium leading-[1.4] font-content text-[#55546b] [overflow-wrap:anywhere] dark:text-neutral-300 sm:text-[22px]">
          {translation}
        </p>
      </div>
      <span className="flex items-center gap-1.5 text-[12px] font-content text-[#8a7a4a] dark:text-neutral-400 sm:text-[14px]">
        <RotateCw size={16} className="hidden text-[#b8902f] dark:text-[#f6dc8e] sm:inline" />
        Торкніться картки, щоб сховати переклад
      </span>
    </>
  );
}

export function FlipCardsExercise({ config, plaqueText }: { config: FlipCardsConfig; plaqueText?: string }) {
  // flip_cards не має sanitize-межі (самостійний тип без правильної
  // відповіді — повна конфігурація йде студенту як є, types.ts), тож
  // фільтрація неповної картки (без лицьової чи зворотної сторони) — тут,
  // на рівні рендеру, не в sanitize.ts. deck — виняток: back (переклад)
  // опціональний (DeckFlipCards показує лише front завжди, back — якщо є),
  // тож картка без back усе одно валідна для цього режиму.
  const cards =
    config.mode === "deck"
      ? config.cards.filter((c) => c.front.trim())
      : config.cards.filter((c) => c.front.trim() && c.back.trim());
  const [page, setPage] = useState(0);
  const blockRef = useRef<HTMLDivElement>(null);

  const totalPages = Math.max(1, Math.ceil(cards.length / PAGE_SIZE));
  const pageStart = page * PAGE_SIZE;
  const pageIndices = cards
    .map((_, i) => i)
    .slice(pageStart, pageStart + PAGE_SIZE);

  function handlePageChange(p: number) {
    setPage(p);
    // М'яко довертаємо верх блоку в екран, лише якщо його справді
    // прогорнуло за межі (rect.top < 0) — без стрибка, якщо блок і так
    // повністю видно (requestAnimationFrame — чекаємо нову висоту сітки
    // після зміни сторінки, щоб rect.top був актуальний).
    requestAnimationFrame(() => {
      const rect = blockRef.current?.getBoundingClientRect();
      if (rect && rect.top < 0) {
        blockRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    });
  }

  if (cards.length === 0) {
    return (
      <p className="text-sm text-neutral-500 dark:text-neutral-400">
        У цій вправі ще немає карток.
      </p>
    );
  }

  // deck — одна колода з усіма картками, без розбиття на сторінки: смужка
  // нижче показує лише плашку (без вкладок), нижній рядок ←/→ для deck
  // не рендериться взагалі (BlockNavFooter сам повертає null при
  // blockCount<=1 — тут примусово isDeck, бо totalPages від cards.length
  // не має сенсу для суцільної колоди).
  const isDeck = config.mode === "deck";
  const pagerFooter = (
    <BlockNavFooter blockCount={isDeck ? 1 : totalPages} activeBlock={page} onChangeBlock={handlePageChange} />
  );

  return (
    <div ref={blockRef} className={EXERCISE_STACK}>
      <BlockTabs
        plaqueText={plaqueText}
        blockCount={isDeck ? undefined : totalPages}
        activeBlock={page}
        onChangeBlock={isDeck ? undefined : handlePageChange}
      />
      <TaskPanelHeader
        instructionText={
          config.instructions ??
          (config.mode === "random_reveal"
            ? FLIP_CARDS_RANDOM_INSTRUCTIONS.instruction
            : DEFAULT_INSTRUCTIONS.flip_cards.instruction)
        }
        subInstructionText={
          config.subInstructions ??
          (config.mode === "random_reveal"
            ? FLIP_CARDS_RANDOM_INSTRUCTIONS.subInstruction
            : DEFAULT_INSTRUCTIONS.flip_cards.subInstruction)
        }
      />
      {config.mode === "deck" ? (
        <DeckFlipCards cards={cards} />
      ) : config.mode === "random_reveal" ? (
        <RandomRevealFlipCards
          cards={cards}
          revealSide={config.revealSide ?? "front"}
          pageIndices={pageIndices}
          footer={pagerFooter}
        />
      ) : (
        // Сітка/футер — РАЗОМ в ОДНІЙ обгортці без власного flex/gap (той
        // самий прийом, що BlockNavigation, block-navigation.tsx): інакше
        // gap самого EXERCISE_STACK додавався б поверх margin-top футера.
        <div>
          {/* Усі картки лишаються в DOM на весь час вправи — та сама
              причина, що в RandomRevealFlipCards: немонтування плитки при
              зміні сторінки скинуло б її внутрішній "перевернуто/ні" стан. */}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {cards.map((card, i) => (
              <div key={i} className={pageIndices.includes(i) ? "contents" : "hidden"}>
                <FlipCardTile card={card} />
              </div>
            ))}
          </div>
          {pagerFooter}
        </div>
      )}
    </div>
  );
}
