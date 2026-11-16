"use client";

import { useEffect, useSyncExternalStore } from "react";
import { X } from "lucide-react";
import { useT } from "@/lib/i18n/context";
import { useSavedWords } from "@/components/dictionary/saved-words-provider";

const DISMISS_KEY = "tdf.dictHint.v1";

// Задача-виправлення "split dictionary hint into video and script hints":
// раніше ОДНА підказка (page.tsx, над заголовком "ВІДЕО") мала текст, що
// згадував і скрипт, і відео одразу. Тепер два окремих монтування —
// <DictHint variant="video"/> під баром "ВІДЕО", <DictHint
// variant="script"/> під баром "Скрипт" (ScriptSection) — АЛЕ з однією
// СПІЛЬНОЮ "закрито"-подією: закриття БУДЬ-ЯКОЇ з двох миттєво ховає
// ОБИДВІ (і будь-які інші екземпляри на сторінці), без перезавантаження.
// useState+useEffect (як було раніше) дає КОЖНОМУ екземпляру власний,
// незалежний стан — закриття одного не зачепило б інший, поки сторінку не
// перезавантажити. Замість цього — крихітний модульний "зовнішній стор"
// (той самий патерн, що useSyncExternalStore очікує): один кеш і один набір
// підписників НА ВЕСЬ МОДУЛЬ (не на компонент), localStorage лишається
// джерелом правди між завантаженнями сторінки, підписники — між
// екземплярами в ПОТОЧНОМУ завантаженні. useSyncExternalStore сам вирішує
// проблему гідратації (getServerSnapshot нижче), яку раніше розв'язував
// окремий mounted-стан + queueMicrotask.
type Listener = () => void;
let dismissedCache: boolean | null = null;
const listeners = new Set<Listener>();

function readDismissed(): boolean {
  try {
    return localStorage.getItem(DISMISS_KEY) === "1";
  } catch {
    return false;
  }
}

function getSnapshot(): boolean {
  if (dismissedCache === null) dismissedCache = readDismissed();
  return dismissedCache;
}

// SSR/перший клієнтський рендер (до гідратації) — завжди "закрито" (як і
// раніше), щоб підказка не блимнула, поки localStorage ще не прочитано.
function getServerSnapshot(): boolean {
  return true;
}

function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function dismiss(): void {
  if (dismissedCache === true) return;
  dismissedCache = true;
  try {
    localStorage.setItem(DISMISS_KEY, "1");
  } catch {
    // localStorage недоступний (приватний режим тощо) — підказка(и) просто
    // з'являться знову при наступному завантаженні, не критично.
  }
  listeners.forEach((l) => l());
}

// Одноразова підказка над відео/скриптом — лише для залогінених студентів
// (useSavedWords() !== null означає, що SavedWordsProvider змонтований, а
// він рендериться лише коли є user, page.tsx). Зникає одразу після першого
// успішного збереження слова ЗА ЦЮ СЕСІЮ, з БУДЬ-ЯКОГО джерела (відео чи
// скрипт — saved.hasSavedAny спільний на всю сторінку) — saved.hasSavedAny
// рахує лише save(), не читання початкового списку.
export function DictHint({ variant }: { variant: "video" | "script" }) {
  const { t } = useT();
  const saved = useSavedWords();
  const dismissed = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  useEffect(() => {
    if (saved?.hasSavedAny) dismiss();
  }, [saved?.hasSavedAny]);

  if (!saved || dismissed) return null;

  return (
    <div className="dict-hint">
      <span>{t(variant === "video" ? "dictionary.hintTextVideo" : "dictionary.hintTextScript")}</span>
      <button type="button" onClick={dismiss} aria-label={t("button.closeAria")} className="dict-hint-close">
        <X size={14} aria-hidden="true" />
      </button>
    </div>
  );
}
