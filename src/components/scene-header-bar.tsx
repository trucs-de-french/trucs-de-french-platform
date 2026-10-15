import type { Ref } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

// Обгортка JOINED-картки (бар+тіло одним блоком, globals.css) — videoNode/
// ScriptSection/VocabSection (сторінка сцени) підставляють напряму в
// className=, коли секція і розгорнута, і на фоні курсу.
export const SCENE_CARD_CLASS = "scene-card";

// Невеликий "запас" на майбутній зафіксований (position: fixed/sticky) бар
// нагорі сторінки — сьогодні такого бару немає (перевірено — ніде в
// layout.tsx/компонентах немає sticky/fixed top), тож це лише кушон, щоб
// заголовок-тогл не впирався точно в межу вікна після scrollIntoView.
const HEADER_SCROLL_MARGIN_PX = 12;

// Спільна поведінка кнопки "Згорнути..." під вмістом секції (script-
// section.tsx/vocab-section.tsx) — викликається ПІСЛЯ setCollapsed(true):
// якщо заголовок-тогл уже поза видимою областю зверху (довгий скрипт,
// далеко проскрольований), підводить його у видиму зону; якщо він і так
// видимий — не скролить взагалі. Фокус клавіатури переноситься на тогл
// завжди, незалежно від скролу.
export function scrollToHeaderAndFocus(header: HTMLButtonElement | null) {
  if (!header) return;
  const rect = header.getBoundingClientRect();
  if (rect.top < 0) {
    header.style.scrollMarginTop = `${HEADER_SCROLL_MARGIN_PX}px`;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    header.scrollIntoView({ block: "start", behavior: reduceMotion ? "auto" : "smooth" });
  }
  header.focus();
}

// Скляний заголовок-бар секції студентської сторінки сцени, коли активний
// фон курсу (onBackground) — замінює student-on-bg h2/тогл-кнопку (видно
// лише на самому фоні) там, де текст інакше лежить прямо на фоновій
// картинці. attached — бар безпосередньо над тілом картки (JOINED,
// розгорнуто): верхні кути округлені, нижньої межі нема, тінь на обгортці
// (SCENE_CARD_CLASS). !attached — бар сам по собі (JOINED згорнуто, або
// STANDALONE секція): повне округлення/рамка/власна тінь. collapsible —
// рендериться як <button aria-expanded>, увесь бар лишається зоною кліку
// (великий тач-таргет); інакше — звичайний div без тоглу (напр. "Відео",
// не згортається).
export function SectionHeaderBar({
  title,
  attached,
  collapsible = false,
  expanded,
  onToggle,
  toggleRef,
}: {
  title: string;
  attached: boolean;
  collapsible?: boolean;
  expanded?: boolean;
  onToggle?: () => void;
  // Для кнопки "Згорнути..." під вмістом секції (script-section.tsx/
  // vocab-section.tsx) — щоб після кліку могти підвести ЦЕЙ тогл у видиму
  // область і перенести на нього фокус (scrollToHeaderAndFocus вище).
  // Передається в ОБИДВА рендери (attached-розгорнутий і detached-
  // згорнутий варіант нижче) — після згортання React монтує інший button,
  // ref має вказувати саме на нього.
  toggleRef?: Ref<HTMLButtonElement>;
}) {
  const barClass = `scene-bar ${attached ? "scene-bar--attached" : "scene-bar--detached"}`;

  if (!collapsible) {
    return (
      <div className={barClass}>
        <h2 className="scene-bar-title">{title}</h2>
      </div>
    );
  }

  const Chevron = expanded ? ChevronUp : ChevronDown;

  return (
    <button ref={toggleRef} type="button" onClick={onToggle} aria-expanded={expanded} className={barClass}>
      <h2 className="scene-bar-title">{title}</h2>
      <span className="scene-bar-toggle" aria-hidden>
        <Chevron size={18} strokeWidth={2.8} className="text-[#f6dc8e]" />
      </span>
    </button>
  );
}
