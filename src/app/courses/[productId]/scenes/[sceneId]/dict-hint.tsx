"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { useT } from "@/lib/i18n/context";
import { useSavedWords } from "@/components/dictionary/saved-words-provider";

const DISMISS_KEY = "tdf.dictHint.v1";

// Одноразова підказка над скриптом ("Натисніть на будь-яке слово...") —
// лише для залогінених студентів (useSavedWords() !== null означає, що
// SavedWordsProvider змонтований, а він рендериться лише коли є user,
// page.tsx). dismissed стартує TRUE і на сервері, і на клієнті до
// useEffect — без цього перший клієнтський рендер (localStorage ще не
// прочитано) відрізнявся б від серверного (localStorage там узагалі
// немає), що дало б hydration mismatch.
export function DictHint() {
  const { t } = useT();
  const saved = useSavedWords();
  const [mounted, setMounted] = useState(false);
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    // SSR-safe localStorage hydration (один раз на mount, не в циклі
    // рендерів) — підказка не блимає при SSR/гідратації. Той самий
    // патерн, що full-achievements.tsx (банер "Колекцію зібрано").
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
    try {
      setDismissed(localStorage.getItem(DISMISS_KEY) === "1");
    } catch {
      setDismissed(false);
    }
  }, []);

  // Зникає одразу після першого успішного збереження за цю сесію —
  // saved.hasSavedAny (saved-words-provider.tsx) рахує лише save(), не
  // читання початкового списку.
  useEffect(() => {
    if (!saved?.hasSavedAny) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDismissed(true);
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      // localStorage недоступний (приватний режим тощо) — підказка просто
      // з'явиться знову при наступному завантаженні, не критично.
    }
  }, [saved?.hasSavedAny]);

  if (!saved || !mounted || dismissed) return null;

  function handleDismiss() {
    setDismissed(true);
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      // те саме, що вище — ігноруємо збій запису.
    }
  }

  return (
    <div className="dict-hint">
      <span>{t("dictionary.hintText")}</span>
      <button type="button" onClick={handleDismiss} aria-label={t("button.closeAria")} className="dict-hint-close">
        <X size={14} aria-hidden="true" />
      </button>
    </div>
  );
}
