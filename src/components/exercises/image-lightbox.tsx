"use client";

import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { parseImageFocus } from "@/lib/image-focus";

// Повноекранний перегляд картинки-підказки (клік по мініатюрі) — object-
// contain: тут показуємо ВСЮ картинку цілком, кадрування (фокус) свідомо
// ігнорується (той самий принцип, що ImageOrPlaceholder useFocus=false) —
// src рендериться БЕЗ фрагмента #focus=X,Y (parseImageFocus), фрагмент —
// суто клієнтська розмітка для object-cover мініатюр, тут зайва. Спільний
// компонент — будь-який тип із зображенням-підказкою (image_match,
// multiple_choice тощо) підключає його без дублювання розмітки/логіки
// закриття.
export function ImageLightbox({
  src,
  alt = "",
  onClose,
}: {
  src: string;
  alt?: string;
  onClose: () => void;
}) {
  // Клавіатурний фокус мав бути на елементі, що відкрив лайтбокс (мініатюра/
  // кнопка-лупа) ще ДО монтування цього компонента — той самий елемент
  // повертає собі фокус при закритті (Escape/фон/✕), щоб клавіатурна
  // навігація не губилась посеред сторінки.
  const previouslyFocused = useRef<HTMLElement | null>(null);
  useEffect(() => {
    previouslyFocused.current = document.activeElement as HTMLElement | null;
    return () => {
      previouslyFocused.current?.focus?.();
    };
  }, []);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const cleanSrc = parseImageFocus(src).src;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
      onClick={onClose}
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Закрити"
        className="absolute right-4 top-4 text-white/80 transition-colors hover:text-white"
      >
        <X size={28} />
      </button>
      {/* stopPropagation — клік по самій картинці не має закривати оверлей,
          лише клік по темному фону навколо. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={cleanSrc}
        alt={alt}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[90vh] max-w-[90vw] object-contain"
      />
    </div>
  );
}
