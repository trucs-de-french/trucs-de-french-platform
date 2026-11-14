"use client";

import { Bookmark } from "lucide-react";
import { useT } from "@/lib/i18n/context";
import { useSavedWords, type SaveWordSnapshot } from "./saved-words-provider";

// Єдиний компонент кнопки збереження слова — використовується в бульбашці
// вокабуляру (dialogue-line.tsx), картці відео (video-player.tsx), рядку
// таблиці "Вокабуляр" (vocab-section.tsx) і панелі звичайного слова
// (dialogue-line.tsx, Етап 2 частина 2). Повертає null, якщо немає
// SavedWordsProvider (сторінки матеріалів/DELF без контексту сцени) АБО
// студент не залогінений (page.tsx тоді провайдер не рендерить взагалі) —
// в обох випадках UI збереження просто не показується, нічого не ламаючи.
export function SaveWordButton({
  snapshot,
  variant = "pill",
  className = "",
}: {
  snapshot: SaveWordSnapshot;
  // "pill" — повна кнопка з текстом (бульбашка/картка відео/панель
  // звичайного слова). "icon" — кругла 36px іконка-закладка (рядок
  // таблиці "Вокабуляр" — там немає місця під текстову кнопку).
  variant?: "pill" | "icon";
  className?: string;
}) {
  const { t } = useT();
  const saved = useSavedWords();
  if (!saved) return null;

  const isSaved = saved.isSaved(snapshot.word);
  const pending = saved.isPending(snapshot.word);
  const error = saved.getError(snapshot.word);

  async function handleSave() {
    await saved!.save(snapshot);
  }
  async function handleRemove() {
    await saved!.remove(snapshot.word);
  }

  if (variant === "icon") {
    return (
      <div className={`flex flex-col items-end gap-1 ${className}`}>
        <button
          type="button"
          aria-pressed={isSaved}
          aria-label={
            isSaved
              ? t("dictionary.removeWordAria", { word: snapshot.word })
              : t("dictionary.saveWordAria", { word: snapshot.word })
          }
          disabled={pending}
          onClick={isSaved ? handleRemove : handleSave}
          className={`save-word-icon-btn ${isSaved ? "save-word-icon-btn--saved" : ""}`}
        >
          <Bookmark size={16} fill={isSaved ? "currentColor" : "none"} aria-hidden="true" />
        </button>
        {error && <span className="save-word-error">{t("dictionary.saveError")}</span>}
      </div>
    );
  }

  return (
    <div className={`flex flex-col items-start gap-1 ${className}`}>
      {isSaved ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="save-word-pill save-word-pill--saved">
            <Bookmark size={14} fill="currentColor" aria-hidden="true" />
            {t("dictionary.savedState")}
          </span>
          <button type="button" onClick={handleRemove} disabled={pending} className="save-word-remove-link">
            {t("dictionary.removeAction")}
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={handleSave}
          disabled={pending}
          aria-label={t("dictionary.saveWordAria", { word: snapshot.word })}
          className="save-word-pill save-word-pill--primary"
        >
          <Bookmark size={14} aria-hidden="true" />
          {t("dictionary.saveAction")}
        </button>
      )}
      {error && <span className="save-word-error">{t("dictionary.saveError")}</span>}
    </div>
  );
}
