"use client";

import { useEffect } from "react";
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
  // Яка поверхня під кнопкою — НЕ тема сайту: VocabWord/панель звичайного
  // слова/рядок таблиці завжди сидять на світлій/лавандовій поверхні
  // (vocab-chip-tooltip лишається світлим в обох темах сайту), а картка
  // відео — завжди темне напівпрозоре скло, незалежно від теми сайту.
  // Кольори "збережено"/текстових дій зав'язані на ЦЕ, а не на .dark —
  // інакше бліді dark-theme кольори опинялись на світлій поверхні
  // (нечитабельно) там, де сама поверхня не стала темнішою.
  surface = "light",
  className = "",
}: {
  snapshot: SaveWordSnapshot;
  // "pill" — повна кнопка з текстом (бульбашка/картка відео/панель
  // звичайного слова). "icon" — кругла 36px іконка-закладка (рядок
  // таблиці "Вокабуляр" — там немає місця під текстову кнопку).
  variant?: "pill" | "icon";
  surface?: "light" | "dark";
  className?: string;
}) {
  const { t } = useT();
  const saved = useSavedWords();
  const error = saved?.getError(snapshot.word) ?? null;

  // Токен-тост у 36px-колонці таблиці "Вокабуляр" (variant="icon") сам
  // ховається через ~4с, на відміну від pill-варіанта (бульбашка/картка
  // відео/панель звичайного слова) — там помилка лишається видимою, поки
  // студент сам не повторить спробу чи не закриє панель. Ефект (не хук
  // після умовного return — Rules of Hooks) мусить викликатись завжди,
  // навіть коли saved===null — тоді просто нічого не робить.
  useEffect(() => {
    if (variant !== "icon" || !error || !saved) return;
    const timer = setTimeout(() => saved.clearError(snapshot.word), 4000);
    return () => clearTimeout(timer);
  }, [variant, error, saved, snapshot.word]);

  if (!saved) return null;

  const isSaved = saved.isSaved(snapshot.word);
  const pending = saved.isPending(snapshot.word);

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
        {/* position:absolute (анкерується на .vocab-row, не на цю 36px-
            колонку — див. .save-word-error-toast у globals.css) — НЕ в
            потоці grid-колонки, тож рядок/колонки ніколи не змінюють
            розмір/не стискають переклад, коли з'являється помилка. */}
        {error && (
          <span className="save-word-error-toast" role="status" aria-live="polite">
            {t("dictionary.saveError")}
          </span>
        )}
      </div>
    );
  }

  const onDark = surface === "dark" ? " save-word-pill--saved-on-dark" : "";
  const removeOnDark = surface === "dark" ? " save-word-remove-link--on-dark" : "";
  const primaryOnDark = surface === "dark" ? " save-word-pill--primary-on-dark" : "";

  return (
    <div className={`flex flex-col items-start gap-1 ${className}`}>
      {isSaved ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className={`save-word-pill save-word-pill--saved${onDark}`}>
            <Bookmark size={14} fill="currentColor" aria-hidden="true" />
            {t("dictionary.savedState")}
          </span>
          <button
            type="button"
            onClick={handleRemove}
            disabled={pending}
            className={`save-word-remove-link${removeOnDark}`}
          >
            {t("dictionary.removeAction")}
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={handleSave}
          disabled={pending}
          aria-label={t("dictionary.saveWordAria", { word: snapshot.word })}
          className={`save-word-pill save-word-pill--primary${primaryOnDark}`}
        >
          <Bookmark size={14} aria-hidden="true" />
          {t("dictionary.saveAction")}
        </button>
      )}
      {error && <span className="save-word-error">{t("dictionary.saveError")}</span>}
    </div>
  );
}
