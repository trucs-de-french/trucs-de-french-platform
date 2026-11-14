"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Search, Bookmark } from "lucide-react";
import { t } from "@/lib/i18n/t";
import type { MessageKey } from "@/lib/i18n/messages/uk";
import type { UiLang } from "@/lib/ui/product-lang";
import { PART_OF_SPEECH_LABELS_FR, type PartOfSpeech } from "@/lib/vocab-categories";
import type { SavedWord } from "@/lib/cabinet/saved-words";
import { removeWord, saveWord, updateWordTranslation } from "@/app/cabinet/dictionary/actions";

// Чіпи фільтра — лише ці 4 частини мови (не весь PART_OF_SPEECH_ORDER
// vocab-categories.ts), за явним запитом задачі; чіп з'являється тільки
// якщо серед збережених слів студента є бодай одне з цією partOfSpeech.
const FILTER_POS = ["nom", "verbe", "adjectif", "adverbe"] as const satisfies readonly PartOfSpeech[];

const FILTER_POS_LABEL_KEY = {
  nom: "cabinet.dictionary.filter.nom",
  verbe: "cabinet.dictionary.filter.verbe",
  adjectif: "cabinet.dictionary.filter.adjectif",
  adverbe: "cabinet.dictionary.filter.adverbe",
} as const satisfies Record<(typeof FILTER_POS)[number], MessageKey>;

function normalizeForSearch(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

export function DictionaryView({ lang, initialWords }: { lang: UiLang; initialWords: SavedWord[] }) {
  const [words, setWords] = useState(initialWords);
  const [search, setSearch] = useState("");
  const [posFilter, setPosFilter] = useState<PartOfSpeech | "all">("all");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ word: SavedWord } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const presentPos = useMemo(() => {
    const present = new Set(words.map((w) => w.partOfSpeech).filter((p): p is PartOfSpeech => !!p));
    return FILTER_POS.filter((p) => present.has(p));
  }, [words]);

  const filtered = useMemo(() => {
    const q = normalizeForSearch(search.trim());
    return words.filter((w) => {
      if (posFilter !== "all" && w.partOfSpeech !== posFilter) return false;
      if (!q) return true;
      return (
        normalizeForSearch(w.word).includes(q) || (!!w.translation && normalizeForSearch(w.translation).includes(q))
      );
    });
  }, [words, search, posFilter]);

  function showUndoToast(snapshot: SavedWord) {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ word: snapshot });
    toastTimer.current = setTimeout(() => setToast(null), 4000);
  }

  async function handleRemove(word: SavedWord) {
    setWords((prev) => prev.filter((w) => w.id !== word.id));
    const result = await removeWord(word.id);
    if (!result.ok) {
      // Не вдалось видалити на сервері — повертаємо слово назад, без тосту.
      setWords((prev) => [word, ...prev]);
      return;
    }
    showUndoToast(result.snapshot ?? word);
  }

  async function handleUndo() {
    const snapshot = toast?.word;
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast(null);
    if (!snapshot) return;
    const result = await saveWord({
      sourceType: snapshot.sourceType,
      sourceId: snapshot.sourceId,
      productId: snapshot.productId,
      sourceTitle: snapshot.sourceTitle,
      vocabId: snapshot.vocabId,
      word: snapshot.word,
      translation: snapshot.translation,
      translationSource: snapshot.translationSource,
      partOfSpeech: snapshot.partOfSpeech,
      note: snapshot.note,
      imageUrl: snapshot.imageUrl,
      contextFr: snapshot.contextFr,
      contextUk: snapshot.contextUk,
    });
    if (result.ok && result.id) {
      setWords((prev) => [{ ...snapshot, id: result.id as string }, ...prev]);
    }
  }

  function handleTranslationSaved(id: string, translation: string | null) {
    setWords((prev) =>
      prev.map((w) =>
        w.id === id ? { ...w, translation, translationSource: translation === null ? "none" : "own" } : w
      )
    );
    setEditingId(null);
  }

  if (words.length === 0) {
    return (
      <div className="dictionary-empty">
        <Bookmark size={40} aria-hidden="true" style={{ color: "var(--cabinet-gold)" }} />
        <p className="font-body text-lg font-semibold text-[var(--cabinet-ink)]">
          {t(lang, "cabinet.dictionary.empty.title")}
        </p>
        <p className="font-body text-sm text-[var(--cabinet-muted)]">{t(lang, "cabinet.dictionary.empty.text")}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="font-body text-sm text-[var(--cabinet-muted)]">
        {t(lang, "cabinet.dictionary.count", { count: words.length })}
      </p>

      <div className="flex flex-wrap items-center gap-3">
        <label className="relative flex min-h-11 w-full min-w-0 flex-1 basis-[220px] items-center sm:max-w-[320px]">
          <span className="sr-only">{t(lang, "cabinet.dictionary.search")}</span>
          <Search
            size={16}
            className="pointer-events-none absolute left-3 text-[var(--cabinet-muted)]"
            aria-hidden="true"
          />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t(lang, "cabinet.dictionary.search")}
            className="min-h-11 w-full rounded-full border border-[var(--cabinet-line)] bg-[var(--cabinet-surface-2)] py-2 pl-9 pr-3 text-sm text-[var(--cabinet-ink)] placeholder:text-[var(--cabinet-muted)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--cabinet-gold)] dark:focus:border-[var(--cabinet-btn-border)] dark:focus:ring-2 dark:focus:ring-[var(--cabinet-focus-ring)]"
          />
        </label>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            aria-pressed={posFilter === "all"}
            onClick={() => setPosFilter("all")}
            className={`min-h-11 shrink-0 rounded-full px-4 text-sm font-bold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--cabinet-gold)] dark:focus-visible:outline-[var(--cabinet-focus-ring)] ${
              posFilter === "all"
                ? "cabinet-chip--selected"
                : "border border-[var(--cabinet-line)] text-[var(--cabinet-ink)] dark:bg-[var(--cabinet-surface-2)]"
            }`}
          >
            {t(lang, "cabinet.dictionary.filter.all")}
          </button>
          {presentPos.map((pos) => (
            <button
              key={pos}
              type="button"
              aria-pressed={posFilter === pos}
              onClick={() => setPosFilter(pos)}
              className={`min-h-11 shrink-0 rounded-full px-4 text-sm font-bold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--cabinet-gold)] dark:focus-visible:outline-[var(--cabinet-focus-ring)] ${
                posFilter === pos
                  ? "cabinet-chip--selected"
                  : "border border-[var(--cabinet-line)] text-[var(--cabinet-ink)] dark:bg-[var(--cabinet-surface-2)]"
              }`}
            >
              {t(lang, FILTER_POS_LABEL_KEY[pos])}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="dictionary-empty">
          <p className="font-body text-base text-[var(--cabinet-muted)]">{t(lang, "cabinet.dictionary.noResults")}</p>
        </div>
      ) : (
        <div className="dictionary-grid">
          {filtered.map((word) => (
            <WordCard
              key={word.id}
              lang={lang}
              word={word}
              isEditing={editingId === word.id}
              onStartEdit={() => setEditingId(word.id)}
              onCancelEdit={() => setEditingId(null)}
              onSaved={(translation) => handleTranslationSaved(word.id, translation)}
              onRemove={() => handleRemove(word)}
            />
          ))}
        </div>
      )}

      {toast && (
        <div className="dictionary-toast" role="status">
          <span>{t(lang, "cabinet.dictionary.removedToast", { word: toast.word.word })}</span>
          <button type="button" className="dictionary-toast-undo" onClick={handleUndo}>
            {t(lang, "cabinet.dictionary.undo")}
          </button>
        </div>
      )}
    </div>
  );
}

function WordCard({
  lang,
  word,
  isEditing,
  onStartEdit,
  onCancelEdit,
  onSaved,
  onRemove,
}: {
  lang: UiLang;
  word: SavedWord;
  isEditing: boolean;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onSaved: (translation: string | null) => void;
  onRemove: () => void;
}) {
  const posLabel = word.partOfSpeech ? PART_OF_SPEECH_LABELS_FR[word.partOfSpeech] : null;
  const sourceLink = word.productId && word.sourceId ? `/courses/${word.productId}/scenes/${word.sourceId}` : null;

  return (
    <div className="dictionary-word-card">
      <div className="flex items-start justify-between gap-2">
        {posLabel ? <span className="dictionary-pos-label">{posLabel}</span> : <span />}
        <button
          type="button"
          aria-label={t(lang, "cabinet.dictionary.remove")}
          onClick={onRemove}
          className="dictionary-bookmark-btn"
        >
          <Bookmark size={16} fill="currentColor" aria-hidden="true" />
        </button>
      </div>

      <p className="dictionary-word">{word.word}</p>

      {word.translation ? (
        <>
          <p className="dictionary-translation">{word.translation}</p>
          {word.translationSource === "own" && (
            <span className="dictionary-mine-tag">{t(lang, "cabinet.dictionary.myTranslation")}</span>
          )}
        </>
      ) : isEditing ? (
        <TranslationEditor lang={lang} wordId={word.id} onSaved={onSaved} onCancel={onCancelEdit} />
      ) : (
        <>
          {word.contextUk && <p className="dictionary-context">{word.contextUk}</p>}
          <button type="button" className="dictionary-add-translation-btn" onClick={onStartEdit}>
            {t(lang, "cabinet.dictionary.addTranslation")}
          </button>
        </>
      )}

      {word.contextFr && word.translation && <p className="dictionary-context">{word.contextFr}</p>}

      {word.sourceTitle &&
        (sourceLink ? (
          <Link href={sourceLink} className="dictionary-source-chip">
            {word.sourceTitle}
          </Link>
        ) : (
          <span className="dictionary-source-chip">{word.sourceTitle}</span>
        ))}
    </div>
  );
}

function TranslationEditor({
  lang,
  wordId,
  onSaved,
  onCancel,
}: {
  lang: UiLang;
  wordId: string;
  onSaved: (translation: string | null) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    const result = await updateWordTranslation(wordId, value);
    setSaving(false);
    if (result.ok) {
      onSaved(result.translation ?? null);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <label className="sr-only" htmlFor={`translation-${wordId}`}>
        {t(lang, "cabinet.dictionary.translationLabel")}
      </label>
      <input
        id={`translation-${wordId}`}
        type="text"
        value={value}
        maxLength={200}
        autoFocus
        onChange={(e) => setValue(e.target.value)}
        placeholder={t(lang, "cabinet.dictionary.translationPlaceholder")}
        className="dictionary-translation-input"
      />
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving || value.trim().length === 0}
          className="cabinet-btn-primary min-h-9 rounded-full px-4 text-xs disabled:opacity-50"
        >
          {t(lang, "cabinet.dictionary.save")}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="min-h-9 rounded-full border border-[var(--cabinet-line)] px-4 text-xs font-bold text-[var(--cabinet-ink)]"
        >
          {t(lang, "cabinet.dictionary.cancel")}
        </button>
      </div>
    </div>
  );
}
