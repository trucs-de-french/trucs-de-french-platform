"use client";

import { useState, useEffect, useRef } from "react";
import { STUDENT_BUTTON_SECONDARY_IDLE } from "@/lib/button-styles";
import { Z_MODAL } from "@/lib/z-layers";

// Спільна панель символів з діакритикою — раніше жила лише в crossword.tsx,
// тепер спільна для будь-якого текстового поля студентської сторінки
// (fill_blank/letter_gaps/table_fill/open_answer/essay_check тощо).
export const DIACRITICS = ["é", "è", "ê", "î", "ï", "à", "â", "ô", "ö", "ç"];

const POPUP_WIDTH = 216;
const POPUP_HEIGHT = 76;
const POPUP_GAP = 6;
const VIEWPORT_MARGIN = 8;

// Контекстний попап поруч із полем, що зараз у фокусі — position: fixed за
// координатами rect (getBoundingClientRect поля), тож не залежить від
// overflow-x-auto чи будь-якого іншого контейнера навколо. Знизу за
// замовчуванням; згори — лише якщо знизу справді бракує місця, а згори
// його більше. Горизонтально — по центру поля, з клемпінгом у межі вікна.
export function DiacriticsPopup({ rect, onPick }: { rect: DOMRect; onPick: (ch: string) => void }) {
  const spaceBelow = window.innerHeight - rect.bottom;
  const spaceAbove = rect.top;
  const showBelow = spaceBelow >= POPUP_HEIGHT || spaceBelow >= spaceAbove;
  const top = showBelow ? rect.bottom + POPUP_GAP : rect.top - POPUP_HEIGHT - POPUP_GAP;
  const left = Math.max(
    VIEWPORT_MARGIN,
    Math.min(rect.left + rect.width / 2 - POPUP_WIDTH / 2, window.innerWidth - POPUP_WIDTH - VIEWPORT_MARGIN)
  );

  return (
    <div
      className={`fixed ${Z_MODAL} flex flex-wrap gap-1 rounded-md border border-gray-200 bg-white p-1.5 shadow-lg dark:border-neutral-700 dark:bg-neutral-800`}
      style={{ top, left, width: POPUP_WIDTH }}
    >
      {DIACRITICS.map((ch) => (
        <button
          key={ch}
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => onPick(ch)}
          className={STUDENT_BUTTON_SECONDARY_IDLE}
        >
          {ch}
        </button>
      ))}
    </div>
  );
}

type FieldElement = HTMLInputElement | HTMLTextAreaElement;

// Узагальнений хук — один інстанс на КОМПОНЕНТ (не на поле), з ключем на
// кожне окреме поле. Покриває і "одне поле на весь компонент" (essay-check
// textarea — фіксований ключ), і "багато однакових полів у циклі"
// (fill-blank/table-fill/open-answer/letter-gaps/crossword) — рівно ОДИН
// ключ активний одночасно, той самий принцип, що вже мав crossword.tsx
// (activeCell), тепер спільний для всіх.
export function useDiacriticsPopup<K extends string>() {
  const [activeKey, setActiveKey] = useState<K | null>(null);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const elements = useRef(new Map<K, FieldElement>());

  useEffect(() => {
    if (activeKey === null) return;
    function updateRect() {
      const el = elements.current.get(activeKey!);
      setRect(el ? el.getBoundingClientRect() : null);
    }
    // requestAnimationFrame, не прямий виклик у тілі ефекту — щоб setRect
    // викликався з КОЛБЕКА (react-hooks/set-state-in-effect не дозволяє
    // синхронний setState прямо в тілі ефекту), не одразу при монтуванні.
    const raf = requestAnimationFrame(updateRect);
    // capture: true — щоб ловити й скрол усередині будь-якого
    // overflow-контейнера навколо поля, не лише скрол сторінки.
    window.addEventListener("scroll", updateRect, true);
    window.addEventListener("resize", updateRect);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", updateRect, true);
      window.removeEventListener("resize", updateRect);
    };
  }, [activeKey]);

  function fieldRef(key: K) {
    return (el: FieldElement | null) => {
      if (el) elements.current.set(key, el);
      else elements.current.delete(key);
    };
  }

  function getElement(key: K): FieldElement | null {
    return elements.current.get(key) ?? null;
  }

  return {
    activeKey,
    rect: activeKey !== null ? rect : null,
    fieldRef,
    getElement,
    onFocus: (key: K) => setActiveKey(key),
    onBlur: () => setActiveKey(null),
  };
}

// Вставка символу в позицію КУРСОРА (не завжди в кінець рядка) — читає
// selectionStart/End напряму з DOM-елемента. Викликна сторона сама
// застосовує повернене value через свій onChange/setState і (за бажанням)
// відновлює позицію курсора через focusAndSetCursor нижче.
export function insertAtCursor(
  el: FieldElement | null,
  value: string,
  char: string
): { value: string; cursor: number } {
  const start = el?.selectionStart ?? value.length;
  const end = el?.selectionEnd ?? value.length;
  return { value: value.slice(0, start) + char + value.slice(end), cursor: start + char.length };
}

// Той самий rAF-прийом, що в useDiacriticsPopup — фокус/курсор виставляються
// ПІСЛЯ того, як React застосує нове value до DOM (контрольоване поле),
// інакше setSelectionRange цілився б у ще стару (коротшу) довжину рядка.
export function focusAndSetCursor(el: FieldElement | null, pos: number) {
  requestAnimationFrame(() => {
    el?.focus();
    el?.setSelectionRange(pos, pos);
  });
}
