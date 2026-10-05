"use client";

import { Search } from "lucide-react";

// Маленька іконка-лупа в кутку мініатюри — для місць, де клік по самій
// картинці вже є дією вправи (вибір варіанта в multiple_choice/listening,
// переворот у flip_cards тощо): звичайний <span onClick> (НЕ <button>,
// щоб лишатись легальним вкладенням у батьківський <button> — span без
// role/tabIndex не вважається "інтерактивним вмістом" за HTML-специфікацією,
// на відміну від button-у-button), stopPropagation — клік по лупі не має
// також спрацьовувати як дія вправи.
// position/boxClass/iconSize — усі з дефолтами, що відтворюють ПОПЕРЕДНІй
// (до ЕТАПУ G) єдиний вигляд байтово: решта викликів (listening,
// flip-cards, multiple-choice, chronological-order, crossword — старі
// картки) їх не передають і лишаються без змін. ЕТАП G додав лише
// crossword-картку з картинкою (ImageClueCard): лупа йде в ПРОТИЛЕЖНИЙ
// кут від лампочки-підказки (right-1 bottom-1) і менша — фіксований
// 28px-квадрат (boxClass), а не p-1 навколо іконки.
export function ImageZoomBadge({
  onOpen,
  position = "right-1 top-1",
  boxClass = "p-1",
  iconSize = 12,
}: {
  onOpen: () => void;
  position?: string;
  boxClass?: string;
  iconSize?: number;
}) {
  return (
    <span
      onClick={(e) => {
        e.stopPropagation();
        onOpen();
      }}
      aria-hidden
      className={`absolute ${position} z-10 flex cursor-zoom-in items-center justify-center rounded-full bg-black/60 ${boxClass} text-white/90 hover:bg-black/80`}
    >
      <Search size={iconSize} />
    </span>
  );
}
