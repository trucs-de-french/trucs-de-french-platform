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
  return (
    <div className={className}>
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
