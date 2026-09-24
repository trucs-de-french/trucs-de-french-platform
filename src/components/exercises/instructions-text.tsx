import { sanitizeInstructionsHtml } from "@/lib/sanitize-instructions-html";
import { EXERCISE_INSTRUCTION, EXERCISE_SUBINSTRUCTION } from "@/lib/typography-styles";

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
  //
  // ОДИН зовнішній <div> (не фрагмент із двома сиблінгами) — інакше в
  // батьківському flex-контейнері (напр. "flex flex-col gap-2") title і
  // subInstructions ставали б окремими flex-елементами й отримували
  // ОДНАКОВИЙ відступ від батьківського gap, як і від наступного елемента
  // (самого завдання) — підзаголовок не був би "ближче" до заголовку.
  // className (переданий кожним типом вправи, напр. просто "mb-2") — на
  // зовнішній обгортці, лише відступ ПІСЛЯ всього блоку (перед завданням);
  // сам вигляд тексту (рівні 2/3 ієрархії, typography-styles.ts) тепер
  // ЗАВЖДИ EXERCISE_INSTRUCTION/EXERCISE_SUBINSTRUCTION, не приходить від
  // викликача (раніше кожен передавав "font-medium" у className сам —
  // прибрано з усіх 15 місць виклику, тепер це частина компонента, не
  // дублюється). mt-0.5 між title/subText — фіксований, малий, незалежний
  // від батьківського gap. "instruction-text" — гачок для CSS-правила
  // <strong>/<b> → font-extrabold (globals.css) усередині WYSIWYG-контенту
  // основної інструкції (dangerouslySetInnerHTML, класи Tailwind не
  // дотягнуться до вкладених тегів) — навмисно лише на основній інструкції,
  // не на підінструкції.
  return (
    <div className={className}>
      <div className={`instruction-text ${EXERCISE_INSTRUCTION}`} dangerouslySetInnerHTML={{ __html: safeText }} />
      {safeSub && (
        <div
          className={`mt-0.5 ${EXERCISE_SUBINSTRUCTION}`}
          dangerouslySetInnerHTML={{ __html: safeSub }}
        />
      )}
    </div>
  );
}
