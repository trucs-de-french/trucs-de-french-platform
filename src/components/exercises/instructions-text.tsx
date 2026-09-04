import { sanitizeInstructionsHtml } from "@/lib/sanitize-instructions-html";

// Не "use client" — чистий, неінтерактивний текстовий блок, рендериться
// повністю на сервері (RSC), як і CalloutExercise. Санітизація ЩЕ РАЗ тут
// — на межі рендеру, незалежно від того, що вже мало бути санітизовано при
// збереженні (той самий принцип, що callout.tsx): захист і від майбутніх
// редакторів бази в обхід адмінки, і від зміни правил санітизації заднім
// числом для вже збереженого контенту.
export function InstructionsText({
  text,
  subText,
  className,
}: {
  text: string;
  subText?: string;
  className?: string;
}) {
  const safeText = sanitizeInstructionsHtml(text);
  const safeSub = subText ? sanitizeInstructionsHtml(subText) : null;

  return (
    <>
      <p className={className} dangerouslySetInnerHTML={{ __html: safeText }} />
      {safeSub && (
        <p
          className="mt-0.5 text-sm text-neutral-500 dark:text-neutral-400"
          dangerouslySetInnerHTML={{ __html: safeSub }}
        />
      )}
    </>
  );
}
