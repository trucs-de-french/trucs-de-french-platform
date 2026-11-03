"use client";

import { useEffect, useRef, useState } from "react";
import { useT } from "@/lib/i18n/context";

const MIN_THUMB_PX = 56;

// matchMedia(max-width:640px) — той самий приймом, що
// use-working-tile-layout.ts/use-pinch-zoom.ts: власна копія (а не
// імпорт з use-pinch-zoom.ts) — той хук називається "pinch" заради
// власного застосування, тут інша річ (видимість слайдера), тож дрібний
// дубль 8 рядків чистіший за семантично чужу назву імпорту.
function useIsMobileSliderViewport(): boolean {
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

type Metrics = { trackWidth: number; clientWidth: number; scrollWidth: number; scrollLeft: number };
const EMPTY_METRICS: Metrics = { trackWidth: 0, clientWidth: 0, scrollWidth: 0, scrollLeft: 0 };

function thumbWidthFor(m: Metrics): number {
  if (m.trackWidth <= 0 || m.scrollWidth <= 0) return MIN_THUMB_PX;
  const proportional = (m.trackWidth * m.clientWidth) / m.scrollWidth;
  return Math.min(m.trackWidth, Math.max(MIN_THUMB_PX, proportional));
}

// Замінює тонкий нативний горизонтальний скролбар .crossword-scroll/
// .ws-scroll на мобільному (≤640px) — сітка там більше не панорамується
// одним пальцем (touch-action:pan-y, crossword.tsx/word-search.tsx),
// лише цим повзунком або клавіатурою (ArrowLeft/Right/Home/End). Один
// компонент, що приймає scrollRef самого скрол-контейнера (той самий
// ref, що keepViewAfterZoom/usePinchZoom) — crossword.tsx і word-search.tsx
// рендерять його ОДНАКОВО, одразу під .crossword-scroll/.ws-scroll,
// усередині .grid-zoom-wrap (щоб повзунок мав РІВНО ширину зони сітки,
// не розширеної заради тіні/запасу .crossword-scroll/.ws-scroll).
export function GridScrollSlider({
  scrollRef,
  controlsId,
}: {
  scrollRef: React.RefObject<HTMLElement | null>;
  controlsId: string;
}) {
  const { t } = useT();
  const isMobile = useIsMobileSliderViewport();
  const trackRef = useRef<HTMLDivElement>(null);
  const [metrics, setMetrics] = useState<Metrics>(EMPTY_METRICS);
  const metricsRef = useRef<Metrics>(EMPTY_METRICS);
  const [dragging, setDragging] = useState(false);
  const rafRef = useRef(0);
  const dragRef = useRef<{ startClientX: number; startScrollLeft: number; maxScroll: number; freeTrack: number } | null>(
    null
  );

  useEffect(() => {
    if (!isMobile) return;
    const container = scrollRef.current;
    const track = trackRef.current;
    if (!container || !track) return;

    function measure() {
      if (rafRef.current) return;
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = 0;
        const c = scrollRef.current;
        const tr = trackRef.current;
        if (!c || !tr) return;
        const next: Metrics = {
          trackWidth: tr.clientWidth,
          clientWidth: c.clientWidth,
          scrollWidth: c.scrollWidth,
          scrollLeft: c.scrollLeft,
        };
        metricsRef.current = next;
        setMetrics(next);
      });
    }

    measure();
    container.addEventListener("scroll", measure, { passive: true });
    const ro = new ResizeObserver(measure);
    ro.observe(container);
    ro.observe(track);
    // Зум міняє розмір ВМІСТУ (--zoom на grid-zoom-inner), не самого
    // scrollRef-контейнера — той самий прийом, що use-scroll-overflow-
    // hint.ts: спостерігаємо й за першим нащадком, саме його розмір росте
    // разом зі зумом.
    if (container.firstElementChild) ro.observe(container.firstElementChild);

    return () => {
      container.removeEventListener("scroll", measure);
      ro.disconnect();
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
    };
  }, [scrollRef, isMobile]);

  const maxScroll = Math.max(0, metrics.scrollWidth - metrics.clientWidth);
  const visible = isMobile && metrics.scrollWidth > metrics.clientWidth + 1;
  const thumbWidth = thumbWidthFor(metrics);
  const freeTrack = Math.max(1, metrics.trackWidth - thumbWidth);
  const thumbLeft = maxScroll > 0 ? (freeTrack * metrics.scrollLeft) / maxScroll : 0;
  const percent = maxScroll > 0 ? Math.round((metrics.scrollLeft / maxScroll) * 100) : 0;

  function scrollTo(next: number) {
    const container = scrollRef.current;
    if (!container) return;
    container.scrollLeft = Math.max(0, Math.min(next, maxScroll));
  }

  function onTrackPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    const container = scrollRef.current;
    const track = trackRef.current;
    if (!container || !track) return;
    e.preventDefault();
    const m = metricsRef.current;
    const curMaxScroll = Math.max(0, m.scrollWidth - m.clientWidth);
    const thumbW = thumbWidthFor(m);
    const curFreeTrack = Math.max(1, m.trackWidth - thumbW);
    let startScrollLeft = container.scrollLeft;
    // Тап по треку ПОЗА повзунком (не бульбашка від самого повзунка) —
    // одразу стрибок центром повзунка в точку тапу, тоді ж продовжити
    // як звичайний drag (п. "Interaction" задачі).
    if (e.target === track) {
      const rect = track.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const targetThumbLeft = Math.min(Math.max(0, clickX - thumbW / 2), curFreeTrack);
      startScrollLeft = curMaxScroll > 0 ? (targetThumbLeft / curFreeTrack) * curMaxScroll : 0;
      scrollTo(startScrollLeft);
    }
    dragRef.current = { startClientX: e.clientX, startScrollLeft, maxScroll: curMaxScroll, freeTrack: curFreeTrack };
    track.setPointerCapture(e.pointerId);
    setDragging(true);
  }

  function onTrackPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag) return;
    const dx = e.clientX - drag.startClientX;
    const next = drag.maxScroll > 0 ? drag.startScrollLeft + dx * (drag.maxScroll / drag.freeTrack) : 0;
    scrollTo(next);
  }

  function endDrag(e: React.PointerEvent<HTMLDivElement>) {
    dragRef.current = null;
    setDragging(false);
    const track = trackRef.current;
    if (track && track.hasPointerCapture(e.pointerId)) track.releasePointerCapture(e.pointerId);
  }

  function onThumbKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    const m = metricsRef.current;
    const curMaxScroll = Math.max(0, m.scrollWidth - m.clientWidth);
    if (curMaxScroll <= 0) return;
    const step = curMaxScroll * 0.1;
    if (e.key === "ArrowLeft") {
      scrollTo(m.scrollLeft - step);
      e.preventDefault();
    } else if (e.key === "ArrowRight") {
      scrollTo(m.scrollLeft + step);
      e.preventDefault();
    } else if (e.key === "Home") {
      scrollTo(0);
      e.preventDefault();
    } else if (e.key === "End") {
      scrollTo(curMaxScroll);
      e.preventDefault();
    }
  }

  if (!visible) return null;

  return (
    <div
      ref={trackRef}
      className="grid-scroll-slider-track"
      style={{ touchAction: "none" }}
      onPointerDown={onTrackPointerDown}
      onPointerMove={onTrackPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
    >
      <div
        className={`grid-scroll-slider-thumb ${dragging ? "grid-scroll-slider-thumb--active" : ""}`}
        style={{ width: thumbWidth, left: thumbLeft, touchAction: "none" }}
        role="scrollbar"
        aria-orientation="horizontal"
        aria-controls={controlsId}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        aria-label={t("ws.gridScrollSliderLabel")}
        tabIndex={0}
        onKeyDown={onThumbKeyDown}
      >
        <span className="grid-scroll-slider-grip" aria-hidden="true" />
        <span className="grid-scroll-slider-grip" aria-hidden="true" />
        <span className="grid-scroll-slider-grip" aria-hidden="true" />
      </div>
    </div>
  );
}
