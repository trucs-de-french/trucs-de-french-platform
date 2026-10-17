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
// Мокап "варіант 4" прибрав окремий бар-заголовок — назва типу задачі
// тепер живе в плашці смужки над панеллю (.task-plaque, BlockTabs,
// block-navigation.tsx), яку малює САМА вправа (єдине місце, що знає її
// activeBlock/isBlockChecked для вкладок) усередині {children}, з
// escape-трюком негативних margin (.task-header-strip-anchor,
// globals.css), а не GlassBlock. GlassBlock відтепер — лише панель.
export function GlassBlock({
  children,
  className = "",
}: {
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
      <div className="glass-block-panel">{children}</div>
    </div>
  );
}
