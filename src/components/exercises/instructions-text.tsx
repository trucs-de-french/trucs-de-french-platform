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
}: {
  text: string;
  subText?: string;
}) {
  const safeText = sanitizeInstructionsHtml(text);
  const safeSub = subText ? sanitizeInstructionsHtml(subText) : null;

  // <div>, не <p> — санітизований HTML тепер сам може містити <p> (TipTap
  // завжди огортає вміст у <p>), а вкладений <p> усередині <p> — невалідний
  // HTML, який браузер розриває й ламає стилізацію. Той самий підхід, що
  // вже в callout.tsx.
  //
  // ОДИН зовнішній <div>, БЕЗ власного className (не фрагмент із двома
  // сиблінгами) — інакше в батьківському EXERCISE_STACK (spacing.ts, "flex
  // flex-col gap-4 md:gap-6" на корені кожної вправи) title і subInstructions
  // ставали б окремими flex-елементами й отримували ОДНАКОВИЙ відступ від
  // сусідів, як і тіло вправи — підзаголовок не був би "ближче" до
  // заголовку. Відступ ПІСЛЯ всього блоку (перед тілом вправи) тепер задає
  // ВИКЛИКАЧ через EXERCISE_STACK на своєму корені (раніше — власний margin
  // тут, INSTRUCTION_TO_BODY) — компонент сам більше жодного зовнішнього
  // відступу не додає, лише внутрішній mt-1 між title/subText. Сам вигляд
  // тексту (рівні 2/3 ієрархії, typography-styles.ts) — ЗАВЖДИ
  // EXERCISE_INSTRUCTION/EXERCISE_SUBINSTRUCTION, не приходить від
  // викликача. "instruction-text" — гачок для CSS-правила <strong>/<b> →
  // font-extrabold (globals.css) усередині WYSIWYG-контенту основної
  // інструкції (dangerouslySetInnerHTML, класи Tailwind не дотягнуться до
  // вкладених тегів) — навмисно лише на основній інструкції, не на
  // підінструкції.
  return (
    <div>
      <div className={`instruction-text ${EXERCISE_INSTRUCTION}`} dangerouslySetInnerHTML={{ __html: safeText }} />
      {safeSub && (
        <div
          className={`mt-1 ${EXERCISE_SUBINSTRUCTION}`}
          dangerouslySetInnerHTML={{ __html: safeSub }}
        />
      )}
    </div>
  );
}
