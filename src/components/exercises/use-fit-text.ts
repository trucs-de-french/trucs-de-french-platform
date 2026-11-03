"use client";

import { useEffect, useRef, useState } from "react";

// Мобільний (≤640px) авто-зменшення font-size чипа, щоб довге нерозривне
// слово НІКОЛИ не обрізалось (overflow:hidden у .chip-text-fit — лише
// останній рубіж, не сам фікс): BASE_PX (13px, той самий розмір, що вже
// стоїть у .chip-text-fit-залежних мобільних правилах globals.css) →
// крок FONT_STEP_PX (0.5px) униз до FLOOR_PX (10px), доки
// scrollWidth > clientWidth самого чипа (чип — grid-item батьківського
// .task-result-pair-row/-answer-row, тож display:inline блокується у
// block, і clientWidth/scrollWidth коректно включають його padding —
// вимірюється саме ПІСЛЯ padding, inline-відступ лишається гарантованим).
// Якщо навіть на floor слово не влазить — класу FALLBACK_CLASS
// (chip-text-fit--overflow, globals.css) передається overflow-wrap:
// anywhere для ЦЬОГО чипа — ламане слово краще за обрізане.
const BASE_PX = 13;
const FLOOR_PX = 10;
const FONT_STEP_PX = 0.5;
export const FIT_TEXT_FALLBACK_CLASS = "chip-text-fit--overflow";

function measure(el: HTMLElement) {
  el.classList.remove(FIT_TEXT_FALLBACK_CLASS);
  let size = BASE_PX;
  el.style.fontSize = `${size}px`;
  while (el.scrollWidth > el.clientWidth && size > FLOOR_PX) {
    size = Math.max(FLOOR_PX, size - FONT_STEP_PX);
    el.style.fontSize = `${size}px`;
  }
  if (el.scrollWidth > el.clientWidth) {
    el.classList.add(FIT_TEXT_FALLBACK_CLASS);
  }
}

// matchMedia(max-width:640px) — той самий приймом, що
// use-working-tile-layout.ts: mq.matches одразу при монтуванні +
// addEventListener("change", ...). Десктоп/таблет (>640px) не чіпає
// inline font-size взагалі (й прибирає його, якщо вікно виросло з
// мобільного — рендер там лишається піксель-у-піксель незмінним).
function useIsMobileFitViewport(): boolean {
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

// Хук застосовується ПРЯМО на елементі чипа (ref) — text/lang у
// залежностях перераховують fit при зміні мови інтерфейсу чи самого
// слова; ResizeObserver — коли ширина колонки міняється (поворот
// екрана, зміна зуму в іншому місці сторінки); document.fonts.ready —
// метрики веб-шрифта (Nunito/Lora) можуть змінити реальну ширину тексту
// ПІСЛЯ першого вимірювання (шрифт ще не завантажився). rAF — throttle,
// щоб кілька одночасних тригерів (resize + fonts.ready одним кадром) не
// рахували вимірювання по двічі.
export function useFitText(ref: React.RefObject<HTMLElement | null>, text: string) {
  const isMobile = useIsMobileFitViewport();
  const rafRef = useRef(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    if (!isMobile) {
      el.style.fontSize = "";
      el.classList.remove(FIT_TEXT_FALLBACK_CLASS);
      return;
    }

    function schedule() {
      if (rafRef.current) return;
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = 0;
        if (el && el.isConnected) measure(el);
      });
    }

    schedule();
    const ro = new ResizeObserver(schedule);
    ro.observe(el);
    let cancelled = false;
    document.fonts?.ready?.then(() => {
      if (!cancelled) schedule();
    });

    return () => {
      cancelled = true;
      ro.disconnect();
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
    };
  }, [ref, isMobile, text]);
}
