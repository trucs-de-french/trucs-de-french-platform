"use client";

import { useState, useEffect, useRef } from "react";
import { Lightbulb } from "lucide-react";
import { STUDENT_BUTTON_SECONDARY_IDLE } from "@/lib/button-styles";
import { Z_MODAL } from "@/lib/z-layers";
import { useT } from "@/lib/i18n/context";

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
  hintUsed,
  hintLabel,
  hintPosition = "before",
}: {
  rect: DOMRect;
  onPick: (ch: string) => void;
  // Опційно — fill_blank (підказка "перша літера") і crossword (підказка
  // "відкрити цю клітинку"): якщо передано, лампочка рендериться поруч із
  // символами діакритики. Відсутній пропс — жодних змін для решти
  // викликів (letter_gaps/open_answer/essay_check/table_fill тощо).
  onHint?: () => void;
  hintDisabled?: boolean;
  hintUsed?: boolean;
  // Власний текст лампочки замість дефолтного "crossword.hintOpenFirstLetter"
  // (той лишається дефолтом для fill_blank, що не передає цей пропс).
  hintLabel?: string;
  // "before" (дефолт, fill_blank) — лампочка ПЕРШИМ елементом сітки;
  // "after" (crossword) — у ПРАВІЙ колонці останнього рядка (під "â",
  // колонка 7 з 7 — DIACRITICS.length===10 дає рівно рядки 7+3).
  hintPosition?: "before" | "after";
}) {
  // visualViewport — на мобільному відкрита клавіатура зменшує саме ЙОГО
  // (window.innerHeight/innerWidth лишаються розміром шару layout-вьюпорту,
  // частина якого ховається під клавіатурою); offsetTop/offsetLeft — бо
  // position:fixed рахується від layout-вьюпорту, а видима область при
  // скролі/клавіатурі може бути зсунута відносно нього. На десктопі
  // visualViewport збігається з window — поведінка не змінюється.
  const { t } = useT();
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
  // Світла тема — стрілочка попапу вказує на поле у фокусі: горизонтально
  // по центру поля, клемпована в межі самого попапу (той самий принцип
  // клемпінгу, що вже є для left вище, лише відносно popup, не вьюпорту).
  const arrowLeft = Math.max(10, Math.min(rect.left + rect.width / 2 - left, POPUP_WIDTH - 10));

  const resolvedHintLabel = hintLabel ?? t("crossword.hintOpenFirstLetter");
  // Той самий розмір/радіус/рамка, що diacritics-key-btn (сітка растягує
  // обидва на однакову ширину колонки, h-7 — та сама висота рядка) — лише
  // фон/колір інші (diacritics-hint-btn, globals.css: золотий градієнт
  // замість карткового фону ключів). col-start-7 — лише "after" (кросворд):
  // при DIACRITICS.length===10 перший рядок забирає рівно 7 колонок, тож
  // автопотік сітки сам ставить лампочку у РЯДОК 2 (колонка 7 рядка 1 уже
  // зайнята "â") без потреби явно вказувати рядок.
  const hintButton = onHint && (
    <button
      type="button"
      aria-label={resolvedHintLabel}
      title={resolvedHintLabel}
      disabled={hintDisabled}
      // preventDefault — той самий прийом, що діакритик-кнопки нижче: клік
      // не забирає фокус з поля (онBlur не встигає спрацювати раніше onClick).
      // onTouchStart поряд з onMouseDown — на мобільному Android саме
      // touchstart (не синтетичний mousedown) першим запускає нативний
      // перехід фокусу; без preventDefault тут клавіатура встигає
      // закритись (інпут розфокусовується), перш ніж onClick підхопить
      // вибір підказки.
      onMouseDown={(e) => e.preventDefault()}
      onTouchStart={(e) => e.preventDefault()}
      onClick={onHint}
      className={`diacritics-hint-btn flex h-7 items-center justify-center rounded border disabled:cursor-not-allowed ${
        hintUsed && !hintDisabled ? "opacity-60" : ""
      } ${hintPosition === "after" ? "col-start-7" : ""}`}
    >
      <Lightbulb size={16} strokeWidth={2} aria-hidden />
    </button>
  );

  return (
    <div
      className={`fixed ${Z_MODAL} grid grid-cols-7 gap-1 rounded-md border border-gray-200 bg-white p-1.5 shadow-lg diacritics-popup`}
      style={{ top, left, width: POPUP_WIDTH }}
    >
      <div
        className={`diacritics-popup-arrow ${showBelow ? "diacritics-popup-arrow--up" : "diacritics-popup-arrow--down"}`}
        style={{ left: arrowLeft }}
      />
      {hintPosition === "before" && hintButton}
      {DIACRITICS.map((ch) => (
        <button
          key={ch}
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onTouchStart={(e) => e.preventDefault()}
          onClick={() => onPick(ch)}
          className={`${STUDENT_BUTTON_SECONDARY_IDLE} diacritics-key-btn flex h-7 items-center justify-center`}
        >
          {ch}
        </button>
      ))}
      {hintPosition === "after" && hintButton}
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

  // Задача "Dismiss diacritics popup on outside tap, blur and scroll" —
  // onBlur (нижче) лишався ЄДИНИМ шляхом закриття: на Android клавіатура,
  // закрита системним жестом "назад", не завжди викликає blur поля, тож
  // activeKey/rect лишались застарілими — rect далі "стежив" за скролом
  // (слухачі нижче й так його перераховують), АЛЕ формули позиції попапу
  // (DiacriticsPopup, клемпінг top/left у межі вьюпорту) навмисно
  // тримають його ВСЕРЕДИНІ видимої області, навіть коли клітинка/поле
  // давно поза екраном — звідси "попап висить над чужою карткою" зі
  // скріншота. Третій шлях нижче (IntersectionObserver) — реальний фікс
  // ЦЬОГО симптому: ховає попап, щойно активне поле реально залишає
  // вьюпорт, незалежно від причини (скрол, display:none, зміна вкладки/
  // блоку, що не демонтує компонент).
  useEffect(() => {
    if (activeKey === null) return;
    function close() {
      setActiveKey(null);
    }
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
    function onViewportResize() {
      updateRect();
      // Клавіатура закрита (видима висота вьюпорту знову близька до
      // повної висоти вікна) — закриваємо попап разом із нею; порогу
      // 60px достатньо, щоб відрізнити "клавіатура зникла" від звичних
      // адресного/статус-барів (ті дають лише кілька px різниці).
      const vv = window.visualViewport;
      if (vv && window.innerHeight - vv.height < 60) close();
    }
    window.visualViewport?.addEventListener("resize", onViewportResize);
    window.visualViewport?.addEventListener("scroll", updateRect);
    // Escape — та сама клавіша, що решта попапів/модалок платформи.
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") close();
    }
    document.addEventListener("keydown", onKeyDown);
    // Клік/тап ПОЗА активним полем і поза самим попапом — document-
    // слухач у capture-фазі (document mousedown не завжди спрацьовує на
    // тач-скролі/неінтерактивних ділянках, pointerdown — надійніший).
    // .closest(".diacritics-popup") — попап рендериться лише ОДИН
    // екземпляр на весь документ одночасно (один activeKey глобально),
    // тож клас-перевірка тут безпечна без прямого ref на DOM-вузол
    // попапу (той живе в іншому компоненті/дереві, не тут). Кнопки
    // попапу й так не доходять сюди як "зовнішні" — вони або всередині
    // .diacritics-popup (ця перевірка), або onMouseDown/onTouchStart на
    // них уже preventDefault, тож ніколи не розфокусовують поле раніше.
    function onPointerDownOutside(e: PointerEvent) {
      const target = e.target as Node | null;
      if (!target) return;
      const activeEl = elements.current.get(activeKey!);
      if (activeEl && activeEl.contains(target)) return;
      if (target instanceof Element && target.closest(".diacritics-popup")) return;
      close();
    }
    document.addEventListener("pointerdown", onPointerDownOutside, true);
    // Скрол/зміна вкладки, що не демонтує компонент (CSS-приховування
    // неактивного блоку) — IntersectionObserver реагує на ОБИДВА випадки
    // однаково: активне поле, що реально зникло з вьюпорту (виїхало за
    // межі скролу або лежить у display:none-предку), завжди дає
    // isIntersecting:false.
    const activeEl = elements.current.get(activeKey);
    const observer = activeEl
      ? new IntersectionObserver(
          (entries) => {
            if (!entries[0]?.isIntersecting) close();
          },
          { threshold: 0 }
        )
      : null;
    if (activeEl && observer) observer.observe(activeEl);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", updateRect, true);
      window.removeEventListener("resize", updateRect);
      window.visualViewport?.removeEventListener("resize", onViewportResize);
      window.visualViewport?.removeEventListener("scroll", updateRect);
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDownOutside, true);
      observer?.disconnect();
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
