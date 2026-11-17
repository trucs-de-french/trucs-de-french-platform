"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Search, Bookmark, Pencil, Download, ChevronDown, ChevronUp } from "lucide-react";
import { t } from "@/lib/i18n/t";
import type { MessageKey } from "@/lib/i18n/messages/uk";
import type { UiLang } from "@/lib/ui/product-lang";
import { PART_OF_SPEECH_ORDER, PART_OF_SPEECH_LABELS_FR, type PartOfSpeech } from "@/lib/vocab-categories";
import { filterSavedWords, type DictionaryPosFilter, type SavedWord } from "@/lib/cabinet/saved-words";
import { removeWord, saveWord, updateSavedWordDetails } from "@/app/cabinet/dictionary/actions";
import { CabinetSelect, type CabinetSelectOption } from "@/components/cabinet/cabinet-select";

// Чіпи фільтра — лише ці 4 частини мови (не весь PART_OF_SPEECH_ORDER
// vocab-categories.ts), за явним запитом задачі: чіп з'являється тільки
// якщо серед збережених слів студента є бодай одне з цією partOfSpeech.
// Існуючого паттерну для довільної кількості чіпів (решта 4 категорій) у
// коді немає — не додаємо їх; слова з цими категоріями лишаються видимими
// під "Усі" (дефолтний фільтр не звіряє partOfSpeech взагалі).
const FILTER_POS = ["nom", "verbe", "adjectif", "adverbe"] as const satisfies readonly PartOfSpeech[];

// Прихована (друга) група чіпів — решта PART_OF_SPEECH_ORDER, що не входить
// у FILTER_POS вище; обчислено з того самого канонічного масиву (не
// хардкод другого списку), щоб порядок/склад завжди лишався синхронним із
// vocab-categories.ts, навіть якщо туди додадуть ще категорію.
const EXTRA_POS = PART_OF_SPEECH_ORDER.filter(
  (p) => !(FILTER_POS as readonly PartOfSpeech[]).includes(p)
);

// Підписи для чіпів і для select-а категорії в WordEditor нижче — ОДНЕ
// джерело на весь PART_OF_SPEECH_ORDER (а не лише 4 чіпи), щоб студент міг
// обрати будь-яку категорію, що насправді існує на платформі (адмінський
// select vocab-item-row.tsx, групи на студентській сторінці vocab-
// section.tsx, і сама позначка на картці словника нижче — всі читають
// PART_OF_SPEECH_LABELS_FR). nom/verbe/adjectif/adverbe вже мають власний
// локалізований (uk/fr/en) підпис чіпа — лишаємо його й для select-а, щоб
// не було двох різних підписів для тієї самої категорії в одному
// інтерфейсі; решта 4 (без чіпа) отримують нові локалізовані ключі
// cabinet.dictionary.pos.*.
const POS_LABEL_KEY = {
  nom: "cabinet.dictionary.filter.nom",
  verbe: "cabinet.dictionary.filter.verbe",
  adjectif: "cabinet.dictionary.filter.adjectif",
  adverbe: "cabinet.dictionary.filter.adverbe",
  prepositions_conjonctions: "cabinet.dictionary.pos.prepositions_conjonctions",
  locutions: "cabinet.dictionary.pos.locutions",
  phrase: "cabinet.dictionary.pos.phrase",
  idiome: "cabinet.dictionary.pos.idiome",
} as const satisfies Record<PartOfSpeech, MessageKey>;

export function DictionaryView({ lang, initialWords }: { lang: UiLang; initialWords: SavedWord[] }) {
  const [words, setWords] = useState(initialWords);
  const [search, setSearch] = useState("");
  const [posFilter, setPosFilter] = useState<DictionaryPosFilter>("all");
  const [moreExpanded, setMoreExpanded] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ word: SavedWord } | null>(null);
  const [pdfStatus, setPdfStatus] = useState<"idle" | "loading" | "error">("idle");
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const presentPos = useMemo(() => {
    const present = new Set(words.map((w) => w.partOfSpeech).filter((p): p is PartOfSpeech => !!p));
    return FILTER_POS.filter((p) => present.has(p));
  }, [words]);

  // Друга група чіпів — лише категорії, що справді мають бодай одне
  // збережене слово (той самий принцип, що presentPos вище), плюс окремий
  // прапорець для "Без категорії" (не PartOfSpeech, тож рахується окремо).
  const presentExtraPos = useMemo(() => {
    const present = new Set(words.map((w) => w.partOfSpeech).filter((p): p is PartOfSpeech => !!p));
    return EXTRA_POS.filter((p) => present.has(p));
  }, [words]);
  const hasUncategorized = useMemo(() => words.some((w) => w.partOfSpeech === null), [words]);
  const hasExtraGroup = presentExtraPos.length > 0 || hasUncategorized;

  // Активний фільтр у ПРИХОВАНІЙ групі — тоггл примусово лишається
  // розгорнутим (students never see a hidden active filter), а сам тоггл
  // отримує вигляд "вибрано", той самий клас, що й активний чіп.
  const isExtraActive =
    posFilter === "none" || (posFilter !== "all" && (EXTRA_POS as readonly string[]).includes(posFilter));
  const moreVisible = moreExpanded || isExtraActive;

  const filtered = useMemo(() => filterSavedWords(words, { search, pos: posFilter }), [words, search, posFilter]);

  // Завантаження PDF — fetch+blob (не простий <a href>, як у vocab-pdf
  // сцени): кнопці тут потрібні disabled/завантаження/помилка станів, які
  // звичайна навігація по посиланню не дає JS перехопити. Експортує РІВНО
  // filtered (поточний пошук+чіп) — та сама filterSavedWords, що й список
  // нижче, застосована СЕРВЕРОМ (query-параметри q/pos) до ТИХ САМИХ
  // saved_words, а не список client-side id, щоб не передавати переклади/
  // слова через URL.
  async function handleDownloadPdf() {
    if (filtered.length === 0 || pdfStatus === "loading") return;
    setPdfStatus("loading");
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set("q", search.trim());
      if (posFilter !== "all") params.set("pos", posFilter);
      const res = await fetch(`/api/cabinet/dictionary/pdf?${params.toString()}`);
      if (!res.ok) throw new Error("pdf fetch failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const date = new Date().toISOString().slice(0, 10);
      const a = document.createElement("a");
      a.href = url;
      a.download = `trucs-de-french-dictionary-${date}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setPdfStatus("idle");
    } catch {
      setPdfStatus("error");
    }
  }

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

  function handleDetailsSaved(id: string, translation: string, partOfSpeech: PartOfSpeech | null) {
    setWords((prev) =>
      prev.map((w) => (w.id === id ? { ...w, translation, translationSource: "own", partOfSpeech } : w))
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
              {t(lang, POS_LABEL_KEY[pos])}
            </button>
          ))}
          {hasExtraGroup && (
            <button
              type="button"
              aria-expanded={moreVisible}
              aria-controls="dictionary-extra-categories"
              onClick={() => setMoreExpanded((e) => !e)}
              className={`flex min-h-11 shrink-0 items-center gap-1 rounded-full px-4 text-sm font-bold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--cabinet-gold)] dark:focus-visible:outline-[var(--cabinet-focus-ring)] ${
                isExtraActive
                  ? "cabinet-chip--selected"
                  : "border border-[var(--cabinet-line)] text-[var(--cabinet-ink)] dark:bg-[var(--cabinet-surface-2)]"
              }`}
            >
              {t(lang, moreVisible ? "cabinet.dictionary.filter.less" : "cabinet.dictionary.filter.more")}
              {moreVisible ? (
                <ChevronUp size={14} aria-hidden="true" />
              ) : (
                <ChevronDown size={14} aria-hidden="true" />
              )}
            </button>
          )}
        </div>

        {hasExtraGroup && moreVisible && (
          <div id="dictionary-extra-categories" className="flex w-full flex-wrap items-center gap-2">
            {presentExtraPos.map((pos) => (
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
                {t(lang, POS_LABEL_KEY[pos])}
              </button>
            ))}
            {hasUncategorized && (
              <button
                type="button"
                aria-pressed={posFilter === "none"}
                onClick={() => setPosFilter("none")}
                className={`min-h-11 shrink-0 rounded-full px-4 text-sm font-bold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--cabinet-gold)] dark:focus-visible:outline-[var(--cabinet-focus-ring)] ${
                  posFilter === "none"
                    ? "cabinet-chip--selected"
                    : "border border-[var(--cabinet-line)] text-[var(--cabinet-ink)] dark:bg-[var(--cabinet-surface-2)]"
                }`}
              >
                {t(lang, "cabinet.dictionary.category.none")}
              </button>
            )}
          </div>
        )}

        <button
          type="button"
          onClick={handleDownloadPdf}
          disabled={filtered.length === 0 || pdfStatus === "loading"}
          aria-busy={pdfStatus === "loading"}
          aria-label={t(lang, "cabinet.dictionary.pdf.button")}
          className="cabinet-btn-primary flex min-h-11 shrink-0 items-center gap-2 rounded-full px-4 text-sm disabled:opacity-50"
        >
          <Download size={16} aria-hidden="true" />
          {t(lang, pdfStatus === "loading" ? "cabinet.dictionary.pdf.loading" : "cabinet.dictionary.pdf.button")}
        </button>
      </div>

      {pdfStatus === "error" && <p className="dictionary-edit-error">{t(lang, "cabinet.dictionary.error")}</p>}

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
              onSaved={(translation, partOfSpeech) => handleDetailsSaved(word.id, translation, partOfSpeech)}
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
  onSaved: (translation: string, partOfSpeech: PartOfSpeech | null) => void;
  onRemove: () => void;
}) {
  const posLabel = word.partOfSpeech ? PART_OF_SPEECH_LABELS_FR[word.partOfSpeech] : null;
  const sourceLink = word.productId && word.sourceId ? `/courses/${word.productId}/scenes/${word.sourceId}` : null;

  return (
    <div className="dictionary-word-card">
      <div className="flex items-start justify-between gap-2">
        {!isEditing && posLabel ? <span className="dictionary-pos-label">{posLabel}</span> : <span />}
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            aria-label={t(lang, "cabinet.dictionary.edit")}
            onClick={onStartEdit}
            className="dictionary-edit-btn"
          >
            <Pencil size={14} aria-hidden="true" />
          </button>
          <button
            type="button"
            aria-label={t(lang, "cabinet.dictionary.remove")}
            onClick={onRemove}
            className="dictionary-bookmark-btn"
          >
            <Bookmark size={16} fill="currentColor" aria-hidden="true" />
          </button>
        </div>
      </div>

      <p className="dictionary-word">{word.word}</p>

      {isEditing ? (
        <WordEditor lang={lang} word={word} onSaved={onSaved} onCancel={onCancelEdit} />
      ) : word.translation ? (
        <>
          <p className="dictionary-translation">{word.translation}</p>
          {word.translationSource === "own" && (
            <span className="dictionary-mine-tag">{t(lang, "cabinet.dictionary.myTranslation")}</span>
          )}
        </>
      ) : (
        <>
          {word.contextUk && <p className="dictionary-context">{word.contextUk}</p>}
          <button type="button" className="dictionary-add-translation-btn" onClick={onStartEdit}>
            {t(lang, "cabinet.dictionary.addTranslation")}
          </button>
        </>
      )}

      {word.contextFr && word.translation && !isEditing && <p className="dictionary-context">{word.contextFr}</p>}

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

// Інлайн-редактор категорії+перекладу прямо на картці ("пензлик" у WordCard
// вище, завжди доступний, і "додайте переклад" для ще не перекладеного
// слова — обидва ведуть у ТОЙ САМИЙ редактор) — "студент сам вирішує
// категорію" (задача): select пропонує ВЕСЬ PART_OF_SPEECH_ORDER (ту саму
// повну множину й порядок, що й адмінський select vocab-item-row.tsx і
// групи на студентській сторінці vocab-section.tsx), не лише 4 чіпи
// фільтра вище, плюс варіант "без категорії". Кастомний CabinetSelect
// (замінює нативний OS-попап) — той самий компонент, що вже рендерить усі
// select-и /cabinet (тип іспиту, тижнева ціль): клавіатура/ARIA/portal/
// outside-click уже готові, нічого дублювати не треба. Escape скасовує,
// Enter у текстовому полі зберігає — обробник на зовнішньому div ловить
// Escape, що випливає з самого CabinetSelect (closePanel на Escape),
// подальший keydown bubbed сюди закриває весь редактор; Enter — лише з
// input нижче.
function WordEditor({
  lang,
  word,
  onSaved,
  onCancel,
}: {
  lang: UiLang;
  word: SavedWord;
  onSaved: (translation: string, partOfSpeech: PartOfSpeech | null) => void;
  onCancel: () => void;
}) {
  const [translation, setTranslation] = useState(word.translation ?? "");
  const [partOfSpeech, setPartOfSpeech] = useState<string>(word.partOfSpeech ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Якщо збережене значення не входить у PART_OF_SPEECH_ORDER (не повинно
  // траплятись — normalizePartOfSpeech у saveWord/updateSavedWordDetails
  // завжди пише лише канонічне значення чи null — але якщо раптом
  // трапиться легасі/чуже значення), додаємо його як окрему опцію замість
  // того, щоб select мовчки показав порожнє "без категорії": студент
  // бачить/лишає СВОЄ значення, поки сам явно не обере інше (вимога
  // задачі — ніколи не затирати мовчки, коли редагується лише переклад).
  const categoryOptions: CabinetSelectOption[] = useMemo(() => {
    const known = PART_OF_SPEECH_ORDER.map((pos) => ({ value: pos, label: t(lang, POS_LABEL_KEY[pos]) }));
    const extra =
      word.partOfSpeech && !(PART_OF_SPEECH_ORDER as readonly string[]).includes(word.partOfSpeech)
        ? [{ value: word.partOfSpeech, label: word.partOfSpeech }]
        : [];
    return [...extra, { value: "", label: t(lang, "cabinet.dictionary.category.none") }, ...known];
  }, [lang, word.partOfSpeech]);

  async function handleSave() {
    if (translation.trim().length === 0) {
      setError(true);
      return;
    }
    setSaving(true);
    const result = await updateSavedWordDetails(word.id, { translation, partOfSpeech });
    setSaving(false);
    if (result.ok) {
      onSaved(result.translation ?? translation.trim(), result.partOfSpeech ?? null);
    } else {
      setError(true);
    }
  }

  return (
    <div
      className="flex flex-col gap-2"
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.preventDefault();
          onCancel();
        }
      }}
    >
      <label className="sr-only" htmlFor={`category-${word.id}`}>
        {t(lang, "cabinet.dictionary.categoryLabel")}
      </label>
      <CabinetSelect
        id={`category-${word.id}`}
        aria-label={t(lang, "cabinet.dictionary.categoryLabel")}
        value={partOfSpeech}
        onChange={setPartOfSpeech}
        options={categoryOptions}
      />

      <label className="sr-only" htmlFor={`translation-${word.id}`}>
        {t(lang, "cabinet.dictionary.translationLabel")}
      </label>
      <input
        ref={inputRef}
        id={`translation-${word.id}`}
        type="text"
        value={translation}
        maxLength={200}
        onChange={(e) => {
          setTranslation(e.target.value);
          setError(false);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            handleSave();
          }
        }}
        placeholder={t(lang, "cabinet.dictionary.translationPlaceholder")}
        className="dictionary-translation-input"
      />
      {error && <p className="dictionary-edit-error">{t(lang, "cabinet.dictionary.error")}</p>}

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving || translation.trim().length === 0}
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
