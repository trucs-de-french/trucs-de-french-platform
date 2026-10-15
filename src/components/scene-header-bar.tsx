import type { Ref } from "react";
import { ChevronDown, ChevronUp, type LucideIcon } from "lucide-react";

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

// Скляний заголовок-бар секції студентської сторінки сцени ("Відео"/
// "Скрипт"/"Вокабуляр") — завжди власна картка (повне округлення/рамка/
// тінь, margin-bottom 14px до панелі під ним — той самий відступ, що й у
// GlassBlock.glass-block-header, одна й та сама "скляна" мова). icon —
// золотий бейдж зліва від назви (block-icons.ts, підбирається
// викликачем). collapsible — рендериться як <button aria-expanded>, увесь
// бар лишається зоною кліку (великий тач-таргет); інакше — звичайний div
// без тоглу (напр. "Відео", не згортається).
export function SectionHeaderBar({
  title,
  icon: Icon,
  collapsible = false,
  expanded,
  onToggle,
  toggleRef,
}: {
  title: string;
  icon: LucideIcon;
  collapsible?: boolean;
  expanded?: boolean;
  onToggle?: () => void;
  // Для кнопки "Згорнути..." під вмістом секції (script-section.tsx/
  // vocab-section.tsx) — щоб після кліку могти підвести ЦЕЙ тогл у видиму
  // область і перенести на нього фокус (scrollToHeaderAndFocus вище).
  toggleRef?: Ref<HTMLButtonElement>;
}) {
  const left = (
    <span className="glass-bar-left">
      <span className="glass-bar-badge" aria-hidden="true">
        <Icon size={16} strokeWidth={2.5} />
      </span>
      <h2 className="scene-bar-title">{title}</h2>
    </span>
  );

  if (!collapsible) {
    return <div className="scene-bar">{left}</div>;
  }

  const Chevron = expanded ? ChevronUp : ChevronDown;

  return (
    <button ref={toggleRef} type="button" onClick={onToggle} aria-expanded={expanded} className="scene-bar">
      {left}
      <span className="scene-bar-toggle" aria-hidden>
        <Chevron size={18} strokeWidth={2.8} />
      </span>
    </button>
  );
}
