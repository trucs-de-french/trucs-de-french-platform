"use client";

import { useState, useRef, useEffect, useSyncExternalStore } from "react";
import { Shuffle, ArrowLeft, ArrowRight } from "lucide-react";
import type { FlipCard as FlipCardType, FlipCardsConfig } from "@/lib/exercises/types";
import { ImageOrPlaceholder } from "@/components/image-or-placeholder";
import { ImageZoomBadge } from "./image-zoom-badge";
import { ImageLightbox } from "./image-lightbox";
import { DEFAULT_INSTRUCTIONS } from "@/lib/exercises/default-instructions";
import { SELECTED_OPTION_CLASS } from "./selection-style";
import { InstructionsText } from "./instructions-text";
import { ANSWER_CARD_BASE, ANSWER_CARD_DEFAULT } from "./answer-card-style";
import { frenchNbsp } from "@/lib/text/french-typography";
import { STUDENT_BUTTON_PRIMARY, STUDENT_BUTTON_SECONDARY_TOUCH } from "@/lib/button-styles";
import { EXERCISE_STACK } from "@/lib/spacing";
import { CardPager } from "./card-pager";

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

  return (
    <button
      type="button"
      onClick={clickable ? () => setFlipped((f) => !f) : undefined}
      disabled={!clickable}
      className={`flex min-w-0 flex-col items-center gap-2 text-base transition-all disabled:cursor-default ${ANSWER_CARD_BASE} ${variantClass}`}
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
      {card.audio_url && (
        <audio
          controls
          src={card.audio_url}
          className="w-full"
          onClick={(e) => e.stopPropagation()}
        />
      )}
      <span className="min-w-0 max-w-full break-words [overflow-wrap:anywhere]">{frenchNbsp(shown)}</span>
      {clickable && (
        <span className="text-xs text-neutral-400 dark:text-neutral-500">
          {flipped ? "клік — назад" : "клік — перевернути"}
        </span>
      )}
    </button>
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
}: {
  cards: FlipCardType[];
  revealSide: "front" | "back";
  pageIndices: number[];
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

      {/* Усі картки лишаються в DOM на весь час вправи (не лише сторінки) —
          це й зберігає "клік — перевернути" стан кожної плитки при
          перемиканні сторінок (немонтування/монтування щоразу скидало б
          внутрішній useState плитки). Поза поточною сторінкою — просто
          hidden, не видалено з розмітки. */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {cards.map((card, i) => (
          <div key={`${roundId}-${i}`} className={pageIndices.includes(i) ? "contents" : "hidden"}>
            <FlipCardTile card={card} variant={variantFor(i)} initialSide={revealSide} />
          </div>
        ))}
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
// back (переклад) опціонально одразу під ним, БЕЗ перевороту (на відміну
// від manual/random_reveal: тут немає "лицьової/зворотної" семантики
// клацання, лише "прибрати картку зі стосу"). cards — уже відфільтровано
// по front.trim() (FlipCardsExercise), у автентичному порядку вчительки:
// саме цей порядок (не remaining) відновлюється "Почати знову".
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
  const reducedMotion = useSyncExternalStore(
    subscribeReducedMotion,
    getReducedMotionSnapshot,
    getReducedMotionServerSnapshot
  );
  const hideHintOnTouch = useSyncExternalStore(subscribeTouchOnly, getTouchOnlySnapshot, getTouchOnlyServerSnapshot);
  const startXRef = useRef(0);
  const startTimeRef = useRef(0);

  const total = cards.length;
  const finished = remaining.length === 0;
  const top = remaining[0];
  const peek1 = remaining[1];
  const peek2 = remaining[2];

  function removeTop() {
    setRemaining((prev) => prev.slice(1));
    setRoundKey((k) => k + 1);
    setDragX(0);
    setFlyDir(null);
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
    // клік, не перехоплений свайпом картки.
    if ((e.target as HTMLElement).closest("audio, button, a")) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    startXRef.current = e.clientX;
    startTimeRef.current = performance.now();
    setDragging(true);
  }

  function handlePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!dragging) return;
    setDragX(e.clientX - startXRef.current);
  }

  function endDrag() {
    if (!dragging) return;
    setDragging(false);
    const elapsed = Math.max(1, performance.now() - startTimeRef.current);
    const velocity = Math.abs(dragX) / elapsed;
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
  }

  function handleRestart() {
    setRemaining(cards);
    setRoundKey((k) => k + 1);
    setDragX(0);
    setFlyDir(null);
  }

  const topTransform = flyDir
    ? `translateX(${flyDir * 480}px) rotate(${flyDir * 24}deg)`
    : `translateX(${dragX}px) rotate(${dragX / 18}deg)`;
  const topTransition = dragging || reducedMotion ? "none" : `transform ${DECK_FLY_OUT_MS}ms ease-out`;

  return (
    <div className="flex flex-col gap-3">
      <p className="text-right text-sm text-neutral-500 dark:text-neutral-400">
        Залишилось {remaining.length} з {total}
      </p>

      <div className="relative mx-auto min-h-72 w-full max-w-xl sm:min-h-80">
        {finished ? (
          <div
            className={`absolute inset-0 flex flex-col items-center justify-center gap-3 ${ANSWER_CARD_BASE} ${ANSWER_CARD_DEFAULT}`}
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
                className={`absolute inset-0 z-0 rounded-lg border border-gray-100 bg-white shadow-sm dark:border-neutral-700 dark:bg-neutral-800`}
                style={{ transform: "translate(-6px, 10px) rotate(-2deg)" }}
              />
            )}
            {peek1 && (
              <div
                aria-hidden
                className={`absolute inset-0 z-10 rounded-lg border border-gray-100 bg-white shadow-sm dark:border-neutral-700 dark:bg-neutral-800`}
                style={{ transform: "translate(6px, 6px) rotate(3deg)" }}
              />
            )}
            <div
              key={roundKey}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={endDrag}
              onPointerCancel={handlePointerCancel}
              className={`absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 px-4 py-6 sm:px-8 ${ANSWER_CARD_BASE} ${ANSWER_CARD_DEFAULT} shadow-xl`}
              style={{ transform: topTransform, transition: topTransition, touchAction: "pan-y", cursor: dragging ? "grabbing" : "grab" }}
            >
              {top.image_url && (
                <span className="relative w-full">
                  <ImageZoomBadge onOpen={() => setZoomOpen(true)} />
                  <ImageOrPlaceholder
                    src={top.image_url}
                    alt=""
                    className="mx-auto max-h-40 w-auto rounded object-contain"
                  />
                </span>
              )}
              {zoomOpen && top.image_url && (
                <ImageLightbox src={top.image_url} onClose={() => setZoomOpen(false)} />
              )}
              <p className="max-w-full break-words text-center text-2xl font-semibold font-content [overflow-wrap:anywhere] sm:text-3xl">
                {frenchNbsp(top.front)}
              </p>
              {top.back.trim() && (
                <p className="max-w-full break-words text-center text-sm text-neutral-500 dark:text-neutral-400 [overflow-wrap:anywhere]">
                  {top.back}
                </p>
              )}
              {top.audio_url && (
                <audio
                  controls
                  src={top.audio_url}
                  className="w-full"
                  onClick={(e) => e.stopPropagation()}
                />
              )}
            </div>
          </>
        )}
      </div>

      {!finished && !hideHintOnTouch && (
        <p className="flex items-center justify-center gap-1.5 text-xs text-neutral-400 dark:text-neutral-500">
          <ArrowLeft size={14} /> перетягни картку або натисни кнопку <ArrowRight size={14} />
        </p>
      )}

      {!finished && (
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={handleShuffle}
            disabled={remaining.length <= 1}
            className={`flex items-center gap-1.5 ${STUDENT_BUTTON_SECONDARY_TOUCH}`}
          >
            <Shuffle size={14} /> Перемішати
          </button>
          <button
            type="button"
            onClick={removeTop}
            className={`flex items-center gap-1.5 ${STUDENT_BUTTON_PRIMARY}`}
          >
            Відповів(ла), далі <ArrowRight size={16} />
          </button>
        </div>
      )}
    </div>
  );
}

export function FlipCardsExercise({ config }: { config: FlipCardsConfig }) {
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

  return (
    <div ref={blockRef} className={EXERCISE_STACK}>
      <InstructionsText
        text={config.instructions ?? DEFAULT_INSTRUCTIONS.flip_cards.instruction}
        subText={config.subInstructions ?? DEFAULT_INSTRUCTIONS.flip_cards.subInstruction}
      />
      {config.mode === "deck" ? (
        <DeckFlipCards cards={cards} />
      ) : config.mode === "random_reveal" ? (
        <RandomRevealFlipCards
          cards={cards}
          revealSide={config.revealSide ?? "front"}
          pageIndices={pageIndices}
        />
      ) : (
        // Усі картки лишаються в DOM на весь час вправи — та сама причина,
        // що в RandomRevealFlipCards: немонтування плитки при зміні
        // сторінки скинуло б її внутрішній "перевернуто/ні" стан.
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {cards.map((card, i) => (
            <div key={i} className={pageIndices.includes(i) ? "contents" : "hidden"}>
              <FlipCardTile card={card} />
            </div>
          ))}
        </div>
      )}
      {/* deck — одна колода з усіма картками, без розбиття на сторінки
          (pageIndices/CardPager вище обчислені лише для manual/
          random_reveal, тут навмисно не рендеряться). */}
      {config.mode !== "deck" && (
        <CardPager page={page} totalPages={totalPages} onPageChange={handlePageChange} />
      )}
    </div>
  );
}
