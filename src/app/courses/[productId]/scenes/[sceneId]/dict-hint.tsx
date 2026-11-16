"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { useT } from "@/lib/i18n/context";
import { useSavedWords } from "@/components/dictionary/saved-words-provider";

// Задача-виправлення "per-scene dismissible hints shown on every visit":
// вчителька НЕ хоче спільного/постійного приховування (попередня версія,
// commit d62f01c, ховала ОБИДВІ підказки НАЗАВЖДИ після закриття будь-якої
// чи після першого збереження слова, через localStorage + модульний
// зовнішній стор). Тепер кожен варіант — цілком НЕЗАЛЕЖНИЙ: свій
// sessionStorage-ключ (не localStorage — підказка має з'являтись знову в
// НОВІЙ вкладці/сесії і в КОЖНІЙ сцені), закриття одного варіанта не
// торкається іншого, і hasSavedAny більше НЕ ховає підказку. Без спільного
// стану між екземплярами більше не потрібен useSyncExternalStore — звичний
// useState+useEffect (ефект лише ЧИТАЄ sessionStorage після монтування,
// щоб SSR і перший клієнтський рендер лишались однаковими: підказка
// завжди "показана" в обох, доки ефект не перевірить реальне значення —
// той самий принцип, що localStorage-версія мала раніше для SSR).
function storageKey(variant: "video" | "script", sceneId: string): string {
  return `tdf.hint.${variant}.${sceneId}`;
}

export function DictHint({ variant, sceneId }: { variant: "video" | "script"; sceneId: string }) {
  const { t } = useT();
  const saved = useSavedWords();
  const [dismissed, setDismissed] = useState(false);
  const key = storageKey(variant, sceneId);

  useEffect(() => {
    try {
      if (sessionStorage.getItem(key) === "1") setDismissed(true);
    } catch {
      // sessionStorage недоступний (приватний режим тощо) — підказка
      // просто лишається показаною, як і вимагає задача ("keep it in React
      // state only" тут означає "не впало", не "сховати достроково").
    }
  }, [key]);

  function handleClose() {
    setDismissed(true);
    try {
      sessionStorage.setItem(key, "1");
    } catch {
      // Без sessionStorage дозакриття лишається лише в React-стані цього
      // монтування — React-розмонтування сторінки знову покаже підказку,
      // що й так узгоджується з "лише на поточну сесію".
    }
  }

  if (!saved || dismissed) return null;

  return (
    <div className="dict-hint">
      <span>{t(variant === "video" ? "dictionary.hintTextVideo" : "dictionary.hintTextScript")}</span>
      <button type="button" onClick={handleClose} aria-label={t("dictionary.hintCloseAria")} className="dict-hint-close">
        <X size={14} aria-hidden="true" />
      </button>
    </div>
  );
}
