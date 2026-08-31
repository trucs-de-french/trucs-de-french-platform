import DOMPurify from "isomorphic-dompurify";
import type { CalloutConfig, CalloutStyle } from "@/lib/exercises/types";

// Не "use client" — це чистий, неінтерактивний блок тексту, рендериться
// повністю на сервері (RSC), жодного JS студенту не надсилається.

const STYLE_CLASSES: Record<CalloutStyle, string> = {
  none: "border-neutral-300 bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-900",
  info: "border-blue-300 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/40",
  tip: "border-yellow-300 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-950/40",
  warning: "border-red-300 bg-red-50 dark:border-red-800 dark:bg-red-950/40",
  success: "border-green-300 bg-green-50 dark:border-green-800 dark:bg-green-950/40",
  special: "border-purple-300 bg-purple-50 dark:border-purple-800 dark:bg-purple-950/40",
};

const STYLE_ICONS: Record<CalloutStyle, string> = {
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
  const safeHtml = DOMPurify.sanitize(config.content ?? "");

  return (
    <div className={`flex gap-2 rounded-md border-2 p-3 ${STYLE_CLASSES[config.style] ?? STYLE_CLASSES.none}`}>
      <span aria-hidden className="shrink-0">
        {STYLE_ICONS[config.style] ?? STYLE_ICONS.none}
      </span>
      <div className="rich-text" dangerouslySetInnerHTML={{ __html: safeHtml }} />
    </div>
  );
}
