import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

// Уніфікована "скляна" обгортка контент-/вправ-блоків студентської
// сторінки й прев'ю конструктора (дизайн-варіант 2/4 "Glass cards") —
// заголовок-бар (якщо є title) + 14px відступ + панель із вмістом.
// Токени --glass-* (globals.css) перемикаються СВІТЛИЙ/ТЕМНИЙ перемикачем
// теми сайту (.dark/.light на <html>, theme-toggle.tsx) — цей компонент
// сам нічого не знає про тему. icon — ГОТОВИЙ lucide-компонент від
// викликача (block-icons.ts, resolveBlockIcon — ОДНА точка правди для
// підбору за типом), НЕ підбирається тут усередині рендеру: React
// Compiler (react-hooks/static-components) забороняє викликати функцію,
// що повертає компонент, і зберігати результат у PascalCase-змінну прямо
// в тілі рендеру — лише прийняти вже готовий компонент як props, той
// самий підхід, що вже в SectionHeaderBar (scene-header-bar.tsx).
// Без title — лише панель (callout/link/embed тощо, де заголовок уже
// показаний інакше або не потрібен); icon тоді не рендериться.
export function GlassBlock({
  title,
  icon: Icon,
  headerExtra,
  children,
  className = "",
}: {
  title?: string;
  icon?: LucideIcon;
  headerExtra?: ReactNode;
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
          <span className="glass-bar-left">
            {Icon && (
              <span className="glass-bar-badge" aria-hidden="true">
                <Icon size={16} strokeWidth={2.5} />
              </span>
            )}
            <h2 className="glass-block-title">{title}</h2>
          </span>
          {headerExtra}
        </div>
      )}
      <div className="glass-block-panel">{children}</div>
    </div>
  );
}
