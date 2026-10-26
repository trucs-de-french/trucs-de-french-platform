import { sanitizeCalloutHtml } from "@/lib/sanitize-callout-html";
import { isBlankHtml } from "@/lib/html-text";
import { frenchNbspHtml } from "@/lib/text/french-typography";
import type { CalloutConfig, CalloutStyle } from "@/lib/exercises/types";

// Не "use client" — це чистий, неінтерактивний блок тексту, рендериться
// повністю на сервері (RSC), жодного JS студенту не надсилається.

export const STYLE_CLASSES: Record<CalloutStyle, string> = {
  none: "border-neutral-300 glass-inset-bg bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-900",
  info: "border-blue-300 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/40",
  tip: "border-yellow-300 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-950/40",
  warning: "border-red-300 bg-red-50 dark:border-red-800 dark:bg-red-950/40",
  success: "border-green-300 bg-green-50 dark:border-green-800 dark:bg-green-950/40",
  special: "border-purple-300 bg-purple-50 dark:border-purple-800 dark:bg-purple-950/40",
};

export const STYLE_ICONS: Record<CalloutStyle, string> = {
  none: "▪️",
  info: "ℹ️",
  tip: "💡",
  warning: "⚠️",
  success: "✅",
  special: "✨",
};

export function CalloutExercise({ config }: { config: CalloutConfig }) {
  // Друга (визначальна для показу) санітизація — на межі рендеру, незалежно
  // від того, що вже мало бути санітизовано при збереженні. Захист і від
  // майбутніх редакторів бази в обхід адмінки, і від зміни правил санітизації
  // заднім числом для вже збереженого контенту.
  const safeHtml = sanitizeCalloutHtml(config.content ?? "");
  // Порожній callout (лише <p></p>/<br>/<hr> без реального тексту) не має
  // сенсу показувати — на відміну від інших типів, callout не обгортається
  // в EXERCISE_BLOCK_CLASS зовні (свій власний кольоровий бокс), тож
  // taskHasRenderableContent (task-visibility.ts) не покриває цей рівень —
  // перевірка тут, у самому компоненті.
  if (isBlankHtml(safeHtml)) return null;

  return (
    // ЕТАП 3: border-2/padding — на цій зовнішній обгортці (рамка/фон
    // callout), не на .rich-text: щоб box-sizing:content-box у
    // .rich-text--article (globals.css) рахував 46rem рівно для
    // текстового контенту, незалежно від padding/border картки. Іконка —
    // звичайний flex-рядок НАД текстом (не колонка поруч із ним і не
    // absolute поверх першого рядка — абсолютне позиціювання з минулого
    // коміту перекривало перший рядок параграфа): висота рядка з
    // margin-bottom не зсуває текст по горизонталі, лише додає рядок
    // зверху, тож лівий/правий padding лишаються симетричними.
    // callout-box — хук для scoped-override плаваючої картинки
    // (globals.css), щоб не чіпати ту саму .rich-text--article картинку
    // в статті Матеріалу/редакторі.
    <div className={`callout-box rounded-md border-2 p-[16px_18px] sm:p-[24px_32px] ${STYLE_CLASSES[config.style] ?? STYLE_CLASSES.none}`}>
      <div className="mb-[10px] flex" aria-hidden>
        <span className="text-[24px] leading-none">{STYLE_ICONS[config.style] ?? STYLE_ICONS.none}</span>
      </div>
      <div className="rich-text rich-text--article" dangerouslySetInnerHTML={{ __html: frenchNbspHtml(safeHtml) }} />
    </div>
  );
}
