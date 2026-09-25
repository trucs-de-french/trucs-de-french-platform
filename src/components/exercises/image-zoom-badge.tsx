"use client";

import { Search } from "lucide-react";

// Маленька іконка-лупа в кутку мініатюри — для місць, де клік по самій
// картинці вже є дією вправи (вибір варіанта в multiple_choice/listening,
// переворот у flip_cards тощо): звичайний <span onClick> (НЕ <button>,
// щоб лишатись легальним вкладенням у батьківський <button> — span без
// role/tabIndex не вважається "інтерактивним вмістом" за HTML-специфікацією,
// на відміну від button-у-button), stopPropagation — клік по лупі не має
// також спрацьовувати як дія вправи.
export function ImageZoomBadge({ onOpen }: { onOpen: () => void }) {
  return (
    <span
      onClick={(e) => {
        e.stopPropagation();
        onOpen();
      }}
      aria-hidden
      className="absolute right-1 top-1 z-10 flex cursor-zoom-in items-center justify-center rounded-full bg-black/60 p-1 text-white/90 hover:bg-black/80"
    >
      <Search size={12} />
    </span>
  );
}
