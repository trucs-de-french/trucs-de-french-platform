"use client";

import { useState, useEffect, useRef } from "react";
import { Lightbulb } from "lucide-react";
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
export function DiacriticsPopup({
  rect,
  onPick,
  onHint,
  hintDisabled,
}: {
  rect: DOMRect;
  onPick: (ch: string) => void;
  // Опційно — лише fill_blank/table_fill (єдине місце, де підказка
  // "перша літера" живе саме тут, а не окремою кнопкою біля поля, як в
  // інших 4 типах): якщо передано, лампочка рендериться ПЕРЕД символами
  // діакритики. Відсутній пропс — жодних змін для решти викликів
  // (letter_gaps/crossword/open_answer/essay_check тощо).
  onHint?: () => void;
  hintDisabled?: boolean;
}) {
  // visualViewport — на мобільному відкрита клавіатура зменшує саме ЙОГО
  // (window.innerHeight/innerWidth лишаються розміром шару layout-вьюпорту,
  // частина якого ховається під клавіатурою); offsetTop/offsetLeft — бо
  // position:fixed рахується від layout-вьюпорту, а видима область при
  // скролі/клавіатурі може бути зсунута відносно нього. На десктопі
  // visualViewport збігається з window — поведінка не змінюється.
  const vv = window.visualViewport;
  const viewportHeight = vv?.height ?? window.innerHeight;
  const viewportWidth = vv?.width ?? window.innerWidth;
  const offsetTop = vv?.offsetTop ?? 0;
  const offsetLeft = vv?.offsetLeft ?? 0;

  const spaceBelow = offsetTop + viewportHeight - rect.bottom;
  const spaceAbove = rect.top - offsetTop;
  const showBelow = spaceBelow >= POPUP_HEIGHT || spaceBelow >= spaceAbove;
  const rawTop = showBelow ? rect.bottom + POPUP_GAP : rect.top - POPUP_HEIGHT - POPUP_GAP;
  const top = Math.max(
    offsetTop + VIEWPORT_MARGIN,
    Math.min(rawTop, offsetTop + viewportHeight - POPUP_HEIGHT - VIEWPORT_MARGIN)
  );
  const left = Math.max(
    offsetLeft + VIEWPORT_MARGIN,
    Math.min(rect.left + rect.width / 2 - POPUP_WIDTH / 2, offsetLeft + viewportWidth - POPUP_WIDTH - VIEWPORT_MARGIN)
  );

  return (
    <div
      className={`fixed ${Z_MODAL} flex flex-wrap gap-1 rounded-md border border-gray-200 bg-white p-1.5 shadow-lg dark:border-neutral-700 dark:bg-neutral-800`}
      style={{ top, left, width: POPUP_WIDTH }}
    >
      {onHint && (
        <button
          type="button"
          title="Підказка: відкрити першу літеру"
          aria-label="Підказка: відкрити першу літеру"
          disabled={hintDisabled}
          // preventDefault — той самий прийом, що діакритик-кнопки нижче:
          // клік не забирає фокус з поля (онBlur не встигає спрацювати
          // раніше onClick).
          onMouseDown={(e) => e.preventDefault()}
          onClick={onHint}
          className={`flex items-center justify-center rounded border border-blue-300 bg-blue-50 px-2 text-blue-600 hover:bg-blue-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-blue-50 dark:border-blue-700 dark:bg-blue-950/40 dark:text-blue-400 dark:hover:bg-blue-950/60`}
        >
          <Lightbulb size={16} />
        </button>
      )}
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
  // ЕТАП I (crossword.tsx) — зміна зуму сітки змінює розмір/позицію
  // клітинки БЕЗ події resize/scroll вікна (саме на них зав'язаний ефект
  // нижче), тож викликач мусить попросити перерахунок явно. updateRectRef
  // (не прямий виклик setRect тут) — той самий замикання, що й усередині
  // ефекту нижче, лишається актуальним між рендерами того самого
  // activeKey, бо переприсвоюється щоразу, коли ефект нижче перезапускається.
  const updateRectRef = useRef<() => void>(() => {});

  useEffect(() => {
    if (activeKey === null) return;
    function updateRect() {
      const el = elements.current.get(activeKey!);
      setRect(el ? el.getBoundingClientRect() : null);
    }
    updateRectRef.current = updateRect;
    // requestAnimationFrame, не прямий виклик у тілі ефекту — щоб setRect
    // викликався з КОЛБЕКА (react-hooks/set-state-in-effect не дозволяє
    // синхронний setState прямо в тілі ефекту), не одразу при монтуванні.
    const raf = requestAnimationFrame(updateRect);
    // capture: true — щоб ловити й скрол усередині будь-якого
    // overflow-контейнера навколо поля, не лише скрол сторінки.
    window.addEventListener("scroll", updateRect, true);
    window.addEventListener("resize", updateRect);
    // visualViewport resize/scroll — клавіатура з'являється вже ПІСЛЯ
    // фокусу (rect поля сам може не змінитись), тож без цих слухачів
    // DiacriticsPopup не дізнається, що видима область стала меншою, і
    // позиція попапу лишиться розрахованою ще "до клавіатури". getBoundingClientRect()
    // завжди повертає новий об'єкт — навіть однакові координати тригерять
    // перерендер popup-а з уже актуальним visualViewport у його розрахунку.
    window.visualViewport?.addEventListener("resize", updateRect);
    window.visualViewport?.addEventListener("scroll", updateRect);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", updateRect, true);
      window.removeEventListener("resize", updateRect);
      window.visualViewport?.removeEventListener("resize", updateRect);
      window.visualViewport?.removeEventListener("scroll", updateRect);
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
    // Явний перерахунок rect активного поля — crossword.tsx викликає це
    // після зміни зуму сітки (клітинка змінила розмір/позицію без жодної
    // події resize/scroll, на які зав'язаний ефект вище). No-op, якщо
    // немає активного поля.
    refresh: () => updateRectRef.current(),
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
    // preventScroll — поле вже видиме (студент щойно сам у нього тапнув чи
    // клікнув символ діакритики над ним), автоскрол-на-фокус браузера тут
    // лише зайвий стрибок (той самий принцип, що в karaoke.tsx навколо
    // triggerPauseForLine).
    el?.focus({ preventScroll: true });
    el?.setSelectionRange(pos, pos);
  });
}
