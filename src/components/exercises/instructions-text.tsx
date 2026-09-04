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

  // <div>, не <p> — санітизований HTML тепер сам може містити <p> (TipTap
  // завжди огортає вміст у <p>), а вкладений <p> усередині <p> — невалідний
  // HTML, який браузер розриває й ламає стилізацію. Той самий підхід, що
  // вже в callout.tsx.
  return (
    <>
      <div className={className} dangerouslySetInnerHTML={{ __html: safeText }} />
      {safeSub && (
        <div
          className="mt-0.5 text-sm text-neutral-500 dark:text-neutral-400"
          dangerouslySetInnerHTML={{ __html: safeSub }}
        />
      )}
    </>
  );
}
