import type { ReactNode } from "react";

// Уніфікована "скляна" обгортка контент-/вправ-блоків студентської
// сторінки й прев'ю конструктора (дизайн-варіант 2/4 "Glass cards") —
// заголовок-бар (якщо є title) + 14px відступ + панель із вмістом.
// Токени --glass-* (globals.css) самі перемикаються світлий/темний через
// [data-scene-bg] на .student-bg-wrapper — цей компонент сам нічого не
// знає про тему/фон курсу. Без title — лише панель (callout/link/embed
// тощо, де заголовок уже показаний інакше або не потрібен).
export function GlassBlock({
  title,
  headerExtra,
  children,
  className = "",
}: {
  title?: string;
  headerExtra?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  // "glass-block" завжди на самому собі (не лише те, що передав викликач)
  // — токени --glass-* (globals.css) для [data-scene-bg="dark"] скоуплені
  // саме на цей клас, тож будь-який GlassBlock сам себе ідентифікує як
  // "справжня скляна панель", незалежно від того, чи викликач додав
  // власний клас зверху.
  return (
    <div className={`glass-block ${className}`.trim()}>
      {title && (
        <div className="glass-block-header">
          <h2 className="glass-block-title">{title}</h2>
          {headerExtra}
        </div>
      )}
      <div className="glass-block-panel">{children}</div>
    </div>
  );
}
