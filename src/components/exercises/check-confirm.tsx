"use client";

import { useEffect, useRef, useState } from "react";
import { STUDENT_BUTTON_PRIMARY, STUDENT_BUTTON_SECONDARY_TOUCH } from "@/lib/button-styles";

// Спільний хук "перевірити не все заповнено — підтвердити" для всіх
// авто-перевірюваних типів (ai_examiner/essay_check НЕ торкаються, бо
// взагалі не використовують цей файл): кнопка "Перевірити" тепер активна,
// щойно є хоч ОДНА відповідь (unansweredCount < total), а не лише коли
// заповнено все. Клік при частково заповненому — не викликає submit
// одразу, а ставить confirming=true; CheckConfirmBar нижче рендериться
// замість/під кнопкою; підтвердження викликає передану submit-функцію,
// скасування просто ховає бар. Один інстанс хука на один "активний" блок/
// одиночну вправу — для block-типів, де всі блоки змонтовані одночасно
// (word-search.tsx/crossword.tsx: кожен блок — окремий компонент із
// власним хуком, конфлікту немає) чи рендеряться через спільний
// renderBlock() в одному компоненті (multiple-choice.tsx тощо, де видно
// завжди лише АКТИВНИЙ блок) — стан тут один, бо підтвердження стосується
// завжди лише зараз видимої кнопки.
export function useCheckConfirm() {
  const [confirming, setConfirming] = useState(false);

  function attemptCheck(unansweredCount: number, submit: () => void) {
    if (unansweredCount > 0) {
      setConfirming(true);
    } else {
      submit();
    }
  }

  function confirmCheck(submit: () => void) {
    setConfirming(false);
    submit();
  }

  function cancelCheck() {
    setConfirming(false);
  }

  return { confirming, attemptCheck, confirmCheck, cancelCheck, dismiss: cancelCheck };
}

// Компактний inline-підтверджувач (мокап задачі) — не модалка/оверлей:
// рядок під кнопкою "Перевірити" з текстом і двома кнопками. Та сама
// світла/темна стилістика, що й решта студентських підказок-пілюль
// (.check-confirm-bar, globals.css) — fonts/кольори зі спільних токенів,
// жодних нових кольорів.
export function CheckConfirmBar({
  unansweredCount,
  onConfirm,
  onCancel,
}: {
  unansweredCount: number;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const confirmRef = useRef<HTMLButtonElement>(null);

  // Фокус на "Перевірити" одразу при відкритті (панель з'являється під
  // кнопкою, яку щойно клікнули, — фокус має йти на ПЕРШУ дію всередині
  // панелі, не лишатись на кнопці, якої вже немає в потоці уваги). Esc —
  // той самий шлях, що "Повернутися".
  useEffect(() => {
    confirmRef.current?.focus();
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onCancel();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="check-confirm-bar" role="alertdialog" aria-live="polite">
      <p className="check-confirm-text">Незаповнено: {unansweredCount}. Перевірити все одно?</p>
      <div className="check-confirm-actions">
        <button ref={confirmRef} type="button" onClick={onConfirm} className={STUDENT_BUTTON_PRIMARY}>
          Перевірити
        </button>
        <button type="button" onClick={onCancel} className={STUDENT_BUTTON_SECONDARY_TOUCH}>
          Повернутися
        </button>
      </div>
    </div>
  );
}
