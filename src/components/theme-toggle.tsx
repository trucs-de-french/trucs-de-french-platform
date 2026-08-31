"use client";

import { useRef, useState, type PointerEvent as ReactPointerEvent } from "react";

const POSITION_STORAGE_KEY = "theme-toggle-position";
const BUTTON_SIZE = 40; // h-10 w-10
const DRAG_THRESHOLD = 5; // px — менше цього вважається кліком, не перетягуванням

function getInitialIsDark() {
  return typeof document !== "undefined" && document.documentElement.classList.contains("dark");
}

function clamp(value: number, max: number) {
  return Math.min(Math.max(value, 0), Math.max(max, 0));
}

// Читається СИНХРОННО в lazy useState-ініціалізаторі (не в useEffect) — той
// самий підхід, що вже є в getInitialIsDark() вище: eslint-правило проєкту
// react-hooks/set-state-in-effect забороняє прямий setState() у тілі
// ефекту, тож на сервері (де немає window/localStorage) повертається null
// (кнопка на дефолтній top-4 right-4 позиції), а на клієнті — при гідратації
// та ж функція одразу підхоплює збережену позицію. Можливий один кадр
// розбіжності сервер/клієнт зафіксовано suppressHydrationWarning на
// <button>, як і зі станом теми на <span> нижче.
function getInitialPosition(): { x: number; y: number } | null {
  if (typeof window === "undefined") return null;
  try {
    const saved = localStorage.getItem(POSITION_STORAGE_KEY);
    if (!saved) return null;
    const parsed = JSON.parse(saved);
    if (typeof parsed.x === "number" && typeof parsed.y === "number") {
      return {
        x: clamp(parsed.x, window.innerWidth - BUTTON_SIZE),
        y: clamp(parsed.y, window.innerHeight - BUTTON_SIZE),
      };
    }
  } catch {
    // localStorage недоступний чи зіпсовані дані — лишаємось на дефолтній позиції
  }
  return null;
}

export function ThemeToggle() {
  const [isDark, setIsDark] = useState(getInitialIsDark);
  const [position, setPosition] = useState(getInitialPosition);
  const dragState = useRef<{
    startX: number;
    startY: number;
    originX: number;
    originY: number;
    moved: boolean;
  } | null>(null);

  function toggle() {
    const next = !isDark;
    setIsDark(next);
    document.documentElement.classList.toggle("dark", next);
    document.documentElement.classList.toggle("light", !next);
    try {
      localStorage.setItem("theme", next ? "dark" : "light");
    } catch {
      // localStorage недоступний (приватний режим тощо) — тема просто не збережеться
    }
  }

  function handlePointerDown(e: ReactPointerEvent<HTMLButtonElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    dragState.current = {
      startX: e.clientX,
      startY: e.clientY,
      originX: rect.left,
      originY: rect.top,
      moved: false,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function handlePointerMove(e: ReactPointerEvent<HTMLButtonElement>) {
    const drag = dragState.current;
    if (!drag) return;

    const dx = e.clientX - drag.startX;
    const dy = e.clientY - drag.startY;
    if (!drag.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;

    drag.moved = true;
    setPosition({
      x: clamp(drag.originX + dx, window.innerWidth - BUTTON_SIZE),
      y: clamp(drag.originY + dy, window.innerHeight - BUTTON_SIZE),
    });
  }

  function handlePointerUp(e: ReactPointerEvent<HTMLButtonElement>) {
    const drag = dragState.current;
    dragState.current = null;
    e.currentTarget.releasePointerCapture(e.pointerId);
    if (!drag) return;

    if (drag.moved) {
      // Перетягування, а не клік — зберігаємо позицію, тему НЕ перемикаємо.
      setPosition((current) => {
        if (current) {
          try {
            localStorage.setItem(POSITION_STORAGE_KEY, JSON.stringify(current));
          } catch {
            // localStorage недоступний — позиція просто не збережеться між сесіями
          }
        }
        return current;
      });
    } else {
      toggle();
    }
  }

  return (
    <button
      type="button"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      aria-label="Перемкнути тему (утримуйте й тягніть, щоб перемістити)"
      suppressHydrationWarning
      style={position ? { left: position.x, top: position.y, right: "auto" } : undefined}
      className={`fixed z-50 flex h-10 w-10 touch-none items-center justify-center rounded-full border bg-white text-lg shadow-md hover:bg-neutral-50 dark:bg-neutral-900 dark:hover:bg-neutral-800 ${
        position ? "" : "top-4 right-4"
      }`}
    >
      <span suppressHydrationWarning>{isDark ? "☀️" : "🌙"}</span>
    </button>
  );
}
