import type { ReactNode } from "react";

// Уніфікована "скляна" обгортка вправ/задач студентської сторінки й
// прев'ю конструктора (дизайн-варіант 2/4 "Glass cards") — компактний
// заголовок-бар (якщо є title) + 10px відступ + панель із вмістом. Бар
// тут — ЗАВЖДИ компактний варіант задачі (без іконки-бейджа, без
// uppercase): великі секційні бари (Відео/Скрипт/Вокабуляр/Практика/
// Завдання) рендерить ІНШИЙ компонент (SectionHeaderBar, scene-header-
// bar.tsx), GlassBlock для них не використовується взагалі. Токени
// --glass-* (globals.css) перемикаються СВІТЛИЙ/ТЕМНИЙ перемикачем теми
// сайту (.dark/.light на <html>, theme-toggle.tsx) — цей компонент сам
// нічого не знає про тему.
// Без title — лише панель (callout/link/embed тощо, де заголовок уже
// показаний інакше або не потрібен, чи кілька задач в групі без єдиної
// "головної" назви).
export function GlassBlock({
  title,
  headerExtra,
  hideInstructionInPanel = false,
  children,
  className = "",
}: {
  title?: string;
  headerExtra?: ReactNode;
  // true — title узято з інструкції вправи (getTaskBarText,
  // task-bar-text.ts), яку та сама вправа вже малює вдруге всередині
  // панелі (InstructionsText/.instruction-text) — приховує цей дублікат
  // CSS-правилом (globals.css), не торкаючись ~25 файлів-вправ.
  hideInstructionInPanel?: boolean;
  children: ReactNode;
  className?: string;
}) {
  // "glass-block" завжди на самому собі (не лише те, що передав викликач)
  // — токени --glass-* (globals.css) для .dark скоуплені саме на цей
  // клас, тож будь-який GlassBlock сам себе ідентифікує як "справжня
  // скляна панель", незалежно від того, чи викликач додав власний клас
  // зверху.
  return (
    <div className={`glass-block ${className}`.trim()}>
      {title && (
        <div className="glass-block-header">
          <h2 className="glass-block-title">{title}</h2>
          {headerExtra}
        </div>
      )}
      <div
        className={`glass-block-panel${hideInstructionInPanel ? " glass-block-panel--instruction-in-bar" : ""}`}
      >
        {children}
      </div>
    </div>
  );
}
