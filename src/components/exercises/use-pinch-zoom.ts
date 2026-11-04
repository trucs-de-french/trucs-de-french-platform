"use client";

import { useEffect, useRef, useState } from "react";
import { MIN_ZOOM, MAX_ZOOM } from "./use-grid-zoom";

// matchMedia(max-width:640px) — той самий приймом, що
// use-working-tile-layout.ts (TWO_COLUMN_BREAKPOINT_PX): mq.matches
// одразу при монтуванні + addEventListener("change", ...) на зміну
// ширини/орієнтації. Спільний для crossword.tsx/word-search.tsx — pinch
// увімкнений лише тут, десктоп/таблет (>640px) нічого не підписує.
export function useIsMobilePinchViewport(): boolean {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 640px)");
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return isMobile;
}

type Point = { x: number; y: number };
type PointerLike = { pointerId: number; pointerType: string; clientX: number; clientY: number };

function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}
function midpoint(a: Point, b: Point): Point {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

const CLICK_SUPPRESS_MS = 300;

// Двопальцевий pinch-to-zoom, спільний для crossword.tsx і word-search.tsx
// (мобільний zoom, той самий стан useGridZoom, що й +/−/GridZoomControls) —
// хук НЕ сам вішає pointer-слухачі (word-search вже має власний
// pointerdown/move/up для виділення слова/панорамування, які мають
// скасовувати один одного), лише приймає вже відфільтровані touch-поінтери
// від викликача (feedDown/feedMove/feedUp) і рахує zoom + контентну
// фокус-точку під серединою пальців. Застосування результату до
// scrollLeft/Top лишається за компонентом (його ВЖЕ існуючий ефект,
// залежний від [zoom] — keepViewAfterZoom/applyPinchFocal, use-grid-zoom.ts
// — спрацьовує ПІСЛЯ того, як --zoom реально ліг у DOM).
export function usePinchZoom(
  containerRef: React.RefObject<HTMLElement | null>,
  zoom: number,
  onZoomChange: (zoom: number) => void,
  options: { enabled: boolean; onPinchStart?: () => void }
) {
  const zoomRef = useRef(zoom);
  useEffect(() => {
    zoomRef.current = zoom;
  }, [zoom]);
  const onZoomChangeRef = useRef(onZoomChange);
  useEffect(() => {
    onZoomChangeRef.current = onZoomChange;
  });
  const onPinchStartRef = useRef(options.onPinchStart);
  useEffect(() => {
    onPinchStartRef.current = options.onPinchStart;
  });
  const enabledRef = useRef(options.enabled);
  useEffect(() => {
    enabledRef.current = options.enabled;
  });

  const pointersRef = useRef<Map<number, Point>>(new Map());
  // startMidX/Y — ЗАФІКСОВАНА (не поточна) середина пальців у момент
  // початку жесту: застосування фокус-точки (applyPinchFocal нижче)
  // завжди повертає contentX/Y САМЕ під цю координату екрана, а не під
  // поточну середину пальців — інакше чисте горизонтальне розсування
  // пальців БЕЗ зміни відстані (ratio=1) усе одно зсувало б scrollLeft
  // (панорамування), а задача вимагає: 2 пальці = ЛИШЕ зум, ніяке
  // горизонтальне переміщення пальців саме по собі не панорамує.
  const gestureRef = useRef<{
    startDistance: number;
    startZoom: number;
    contentX: number;
    contentY: number;
    startMidX: number;
    startMidY: number;
  } | null>(null);
  // liveFocalRef — "одноразовий" слот: scheduleFlush записує його ПЕРЕД
  // кожним onZoomChange, компонентний ефект (reader) забирає значення
  // через getFocal()+clearFocal() одразу після використання — інакше
  // застаріла фокус-точка пінчу помилково застосувалась би й до зуму,
  // зміненого пізніше кнопками +/−.
  const liveFocalRef = useRef<{ contentX: number; contentY: number; startZoom: number; midX: number; midY: number } | null>(
    null
  );
  const rafRef = useRef(0);
  const pendingRef = useRef<number | null>(null);
  const suppressClickUntilRef = useRef(0);
  // Задача "Crossword: fix soft keyboard and letter input on Android" —
  // suppressClickUntilRef мусить лише гасити СИНТЕТИЧНИЙ клік/фокус, що
  // лишається від ДРУГОГО пальця після реального pinch (п.4 коментаря у
  // feedUp нижче), а не ЗВИЧАЙНИЙ одно-пальцевий тап. Раніше pointers.size
  // === 0 у feedUp спрацьовувало й для ЗВИЧАЙНОГО тапу (кожен тап рано чи
  // пізно теж доходить до size===0 при піднятті пальця) — тож click на
  // щойно відфокусованому <input> (включно з ПЕРШИМ тапом узагалі) завжди
  // гасився onClickCapture у crossword.tsx, і синхронний .focus() із
  // onClick (попередній фікс 892f86d) НІКОЛИ не встигав виконатись —
  // event.stopPropagation() на capture-фазі контейнера не пускав click до
  // самого input. hadPinchRef — true лише якщо pointers.size РЕАЛЬНО
  // досягав 2 протягом цього жесту (feedDown нижче); лише тоді feedUp
  // виставляє suppressClickUntilRef.
  const hadPinchRef = useRef(false);

  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  function scheduleFlush() {
    if (rafRef.current) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = 0;
      const pending = pendingRef.current;
      pendingRef.current = null;
      const gesture = gestureRef.current;
      if (pending == null || !gesture) return;
      liveFocalRef.current = {
        contentX: gesture.contentX,
        contentY: gesture.contentY,
        startZoom: gesture.startZoom,
        midX: gesture.startMidX,
        midY: gesture.startMidY,
      };
      onZoomChangeRef.current(pending);
    });
  }

  function feedDown(e: PointerLike): boolean {
    if (!enabledRef.current || e.pointerType !== "touch") return false;
    const pointers = pointersRef.current;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 2) {
      hadPinchRef.current = true;
      const container = containerRef.current;
      if (!container) return false;
      const pts = [...pointers.values()];
      const rect = container.getBoundingClientRect();
      const mid = midpoint(pts[0], pts[1]);
      gestureRef.current = {
        startDistance: Math.max(1, distance(pts[0], pts[1])),
        startZoom: zoomRef.current,
        contentX: container.scrollLeft + (mid.x - rect.left),
        contentY: container.scrollTop + (mid.y - rect.top),
        startMidX: mid.x,
        startMidY: mid.y,
      };
      onPinchStartRef.current?.();
    }
    return pointers.size >= 2;
  }

  function feedMove(e: PointerLike): boolean {
    if (!enabledRef.current || e.pointerType !== "touch") return false;
    const pointers = pointersRef.current;
    if (!pointers.has(e.pointerId)) return false;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const gesture = gestureRef.current;
    if (!gesture || pointers.size < 2) return pointers.size >= 2;
    const pts = [...pointers.values()];
    // ЛИШЕ відстань між пальцями рахує зум (п.2 задачі) — поточна середина
    // (mid) тут НЕ читається взагалі: якщо пальці зсунулись горизонтально,
    // не змінивши відстані між собою, це взагалі не доходить до жодного
    // коригування scrollLeft (gestureRef.startMidX/Y у scheduleFlush —
    // ЗАФІКСОВАНІ на момент feedDown, не ці поточні координати).
    const d = distance(pts[0], pts[1]);
    const raw = gesture.startZoom * (d / gesture.startDistance);
    const clamped = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, raw));
    // Плавно під час самого жесту — округлення лише до 1% (п.2 задачі),
    // не до дискретних ZOOM_STEPS кнопок.
    const nextZoom = Math.round(clamped * 100) / 100;
    pendingRef.current = nextZoom;
    scheduleFlush();
    return true;
  }

  function feedUp(e: Pick<PointerLike, "pointerId" | "pointerType">) {
    if (e.pointerType !== "touch") return;
    const pointers = pointersRef.current;
    pointers.delete(e.pointerId);
    if (pointers.size < 2) {
      gestureRef.current = null;
    }
    if (pointers.size === 0) {
      if (hadPinchRef.current) {
        suppressClickUntilRef.current = Date.now() + CLICK_SUPPRESS_MS;
      }
      hadPinchRef.current = false;
    }
  }

  function getFocal() {
    return liveFocalRef.current;
  }
  function clearFocal() {
    liveFocalRef.current = null;
  }
  function isPinching() {
    return pointersRef.current.size >= 2;
  }
  function isSuppressingClick() {
    return Date.now() < suppressClickUntilRef.current;
  }

  return { feedDown, feedMove, feedUp, getFocal, clearFocal, isPinching, isSuppressingClick };
}
