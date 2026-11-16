"use client";

import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import type { VocabItem } from "@/lib/vocab";
import { normalizePartOfSpeech, PART_OF_SPEECH_LABELS_FR, PART_OF_SPEECH_ORDER, type PartOfSpeech } from "@/lib/vocab-categories";
import { useT } from "@/lib/i18n/context";
import type { MessageKey } from "@/lib/i18n/messages/uk";
import { SaveWordButton } from "@/components/dictionary/save-word-button";
import { useSavedWords, type SaveWordSnapshot } from "@/components/dictionary/saved-words-provider";

// Спільний модуль для панелі "звичайного" (не підсвіченого вчителькою)
// слова — раніше жив лише в dialogue-line.tsx (скрипт сцени), тепер і
// video-player.tsx (клікабельні звичайні слова в субтитрах) користується
// тим самим компонентом/токенізацією, щоб word_key/дедуп лишались
// ідентичними між обома поверхнями.

const MAIN_POS = PART_OF_SPEECH_ORDER.slice(0, 4);

const POS_CHIP_LABEL_KEY: Record<PartOfSpeech, MessageKey> = {
  nom: "dictionary.pos.nom",
  verbe: "dictionary.pos.verbe",
  adjectif: "dictionary.pos.adjectif",
  adverbe: "dictionary.pos.adverbe",
  prepositions_conjonctions: "dictionary.pos.prepositions_conjonctions",
  locutions: "dictionary.pos.locutions",
  phrase: "dictionary.pos.phrase",
  idiome: "dictionary.pos.idiome",
};

export type PlainToken =
  | { type: "literal"; text: string }
  | { type: "word"; text: string; clickable: boolean; start: number };

// Токенізація на літерні групи /[\p{L}\p{M}]+/gu — усе решта (пробіли,
// розділові знаки, апострофи, дефіси, цифри) лишається "literal" (не
// клікабельне за визначенням — дефіс/апостроф самі НЕ входять у
// \p{L}\p{M}, тож "peut-être"/"qu'il" вже природно розпадаються на окремі
// літерні групи навколо них, без додаткової логіки). Токен, за яким ОДРАЗУ
// йде апостроф (l'/d'/j'/qu'/jusqu'...), навмисно позначається
// неклікабельним — це службова частка, не самостійне слово для словника.
const APOSTROPHE_CHARS = new Set(["'", "’", "‘", "ʼ"]);

export function tokenizePlainText(text: string): PlainToken[] {
  const regex = /[\p{L}\p{M}]+/gu;
  const tokens: PlainToken[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text))) {
    if (match.index > lastIndex) {
      tokens.push({ type: "literal", text: text.slice(lastIndex, match.index) });
    }
    const word = match[0];
    const endIndex = match.index + word.length;
    const nextChar = text[endIndex];
    const clickable = !APOSTROPHE_CHARS.has(nextChar);
    tokens.push({ type: "word", text: word, clickable, start: match.index });
    lastIndex = endIndex;
  }
  if (lastIndex < text.length) {
    tokens.push({ type: "literal", text: text.slice(lastIndex) });
  }
  return tokens;
}

// Група чипів "Частина мови" у формі ЩЕ не збереженого звичайного слова —
// 4 основні завжди видимі + чип "Інше", що розгортає решту INLINE (без
// popover). role="radiogroup"/role="radio" + роблячий tabindex (стрілки
// рухають ФОКУС між чипами, Enter/Space — як клік; сам клік на вже
// вибраному чипі знімає вибір, що не є чистою native-radio поведінкою,
// тож tabIndex керується вручну, а не native input[type=radio]).
function PosChipGroup({
  value,
  onChange,
  groupId,
}: {
  value: PartOfSpeech | null;
  onChange: (pos: PartOfSpeech | null) => void;
  groupId: string;
}) {
  const { t } = useT();
  const [showMore, setShowMore] = useState(false);
  const visible = showMore ? PART_OF_SPEECH_ORDER : MAIN_POS;

  function handleKeyDown(e: ReactKeyboardEvent<HTMLButtonElement>, index: number) {
    if (!["ArrowRight", "ArrowLeft", "ArrowDown", "ArrowUp"].includes(e.key)) return;
    e.preventDefault();
    const dir = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : -1;
    const nextIndex = (index + dir + visible.length) % visible.length;
    document.getElementById(`${groupId}-${visible[nextIndex]}`)?.focus();
  }

  return (
    <div className="plain-word-pos-field">
      <span id={`${groupId}-label`} className="plain-word-panel-label">
        {t("dictionary.posLabel")}
      </span>
      <div role="radiogroup" aria-labelledby={`${groupId}-label`} className="plain-word-pos-chips">
        {visible.map((pos, index) => {
          const isChecked = value === pos;
          return (
            <button
              key={pos}
              id={`${groupId}-${pos}`}
              type="button"
              role="radio"
              aria-checked={isChecked}
              tabIndex={isChecked || (!value && index === 0) ? 0 : -1}
              onKeyDown={(e) => handleKeyDown(e, index)}
              onClick={() => onChange(isChecked ? null : pos)}
              className={`plain-word-pos-chip${isChecked ? " plain-word-pos-chip--selected" : ""}`}
            >
              {t(POS_CHIP_LABEL_KEY[pos])}
            </button>
          );
        })}
        {!showMore && (
          <button
            type="button"
            onClick={() => setShowMore(true)}
            aria-label={t("dictionary.posOtherAria")}
            className="plain-word-pos-chip plain-word-pos-chip--more"
          >
            {t("dictionary.posOther")}
          </button>
        )}
      </div>
    </div>
  );
}

// Снімок/панель звичайного слова. Пріоритет "вчительських" даних: якщо це
// слово десь позначене вчителькою як vocab (teacherItem !== null), показуємо
// її переклад/частину мови/примітку й SaveWordButton з ТІЄЮ ж логікою, що
// бульбашка VocabWord, замість форми ручного перекладу.
//
// compact — ОДНА колонка завжди (задача-виправлення "single-column
// plain-word panel with vertical scroll only" — попередній двоколонковий
// режим прибрано: горизонтальний скрол/обрізані чипи були гіршими за
// просто довшу вертикальну панель); проп лише стискає відступи/розміри
// (менші падінги, example в 2 рядки, менші чипи) для малого вільного
// місця. Сам викликач вирішує, коли передавати true (video-player.tsx —
// рахує з вимірюваного вільного місця), тут немає власної медіа-логіки.
export function PlainWordPanel({
  word,
  contextFr,
  contextUk,
  teacherItem,
  inputId,
  onClose,
  compact = false,
  onLayoutChange,
}: {
  word: string;
  contextFr: string;
  contextUk: string | null;
  teacherItem: VocabItem | null;
  inputId: string;
  onClose: () => void;
  compact?: boolean;
  // Повідомляє викликача, яка розмітка зараз рендериться — "compact"
  // (вже збережено / щойно збережено-прибрано) чи "form" (форма ручного
  // перекладу/вчительська картка) — лише video-player.tsx слухає, щоб
  // підігнати РОЗМІР власної позиційної обгортки (.video-plain-word-
  // panel-wrap) під цей самий стан: обгортка сама не знає, яка гілка
  // зараз відмальована всередині. Задача-виправлення "compact panel in
  // saved state".
  onLayoutChange?: (mode: "form" | "compact") => void;
}) {
  const { t } = useT();
  const saved = useSavedWords();
  const [value, setValue] = useState("");
  // Нічого не вибрано за замовчуванням; absent (не null) у снепшоті, якщо
  // студент нічого не обрав — та сама поведінка, що й до цього чипа.
  const [partOfSpeech, setPartOfSpeech] = useState<PartOfSpeech | null>(null);
  // justSaved/justRemoved — лише короткий підпис ПЕРЕД автозакриттям
  // (onClose викликає відповідну секцію, яка прибирає відкритий ключ й
  // анмаунтить цю панель — не animation/transition, тож нема що вимикати
  // під prefers-reduced-motion, лише сам факт "зачекати 1с і закритись").
  const [justSaved, setJustSaved] = useState(false);
  const [justRemoved, setJustRemoved] = useState(false);
  const [saving, setSaving] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  // Автозакриття через 1с після успіху — той самий ефект і для save, і
  // для remove (лише інший прапорець/лейбл). Таймер чиститься, якщо
  // панель закриють вручну (ще один рендер із justSaved/justRemoved=false
  // не трапиться — компонент до того часу вже анмаунтиться) АБО якщо
  // компонент анмаунтиться сам (клік на інше слово/інша панель відкрилась) —
  // саме unmount і викликає cleanup нижче в обох випадках.
  useEffect(() => {
    if (!justSaved && !justRemoved) return;
    const timer = setTimeout(onClose, 1000);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- onClose з викликача стабільний між рендерами лише за формою викликання, не за ідентичністю; залежність від justSaved/justRemoved навмисно єдина, що має перезапускати таймер
  }, [justSaved, justRemoved]);

  // Клік/тап ПОЗА панеллю закриває її — mousedown/touchstart (не click),
  // той самий принцип, що VocabWord-тултіп (script-section.tsx) і
  // category-dropdown.tsx: спрацьовує РАНІШЕ за click, тож клік на інше
  // звичайне слово (.plain-word-btn/.video-plain-word) тут навмисно
  // пропускається — його ВЛАСНИЙ onClick сам відкриє нову панель/закриє
  // цю, без подвійного перемикання.
  useEffect(() => {
    function handlePointerDown(e: Event) {
      const target = e.target as Element | null;
      if (panelRef.current?.contains(target)) return;
      if (target?.closest(".plain-word-btn, .video-plain-word, [data-plain-word-trigger]")) return;
      onClose();
    }
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- onClose з викликача стабільний за формою викликання; переприв'язка на кожен рендер непотрібна
  }, []);

  function handleKeyDown(e: ReactKeyboardEvent<HTMLDivElement>) {
    if (e.key === "Escape") onClose();
  }

  // existing/isSavedCompact рахуються ТУТ (до "if (!saved) return null"
  // нижче, з optional chaining) — react-hooks/rules-of-hooks забороняє
  // виклик хука (useEffect нижче) ПІСЛЯ умовного return, навіть якщо
  // saved===null на практиці ніколи не змінюється протягом життя цього
  // компонента.
  const existing = saved?.getSaved(word) ?? null;
  // !teacherItem — та сама гілка-пріоритет, що нижче (if (teacherItem)
  // рендериться ПЕРШИМ, перед if (existing)): слово, яке вчителька
  // позначила як vocab, завжди показує повну вчительську форму, навіть
  // якщо воно вже збережене студентом — isSavedCompact мусить повторювати
  // цю ж умову пріоритету, інакше повідомляв би "compact" для гілки, що
  // насправді рендерить повну форму.
  const isSavedCompact = Boolean(justSaved || justRemoved || (!teacherItem && existing));
  useEffect(() => {
    onLayoutChange?.(isSavedCompact ? "compact" : "form");
    // eslint-disable-next-line react-hooks/exhaustive-deps -- onLayoutChange з викликача стабільний лише за формою виклику, не за ідентичністю; залежність від isSavedCompact навмисно єдина, що має перевикликати ефект
  }, [isSavedCompact]);

  if (!saved) return null;

  const error = saved.getError(word);
  const pending = saved.isPending(word);

  async function handleRemove() {
    const result = await saved!.remove(word);
    if (result.ok) setJustRemoved(true);
  }

  const panelClassName = `plain-word-panel${compact ? " plain-word-panel--compact" : ""}`;

  // justSaved/justRemoved/existing (уже збережене слово) — ОДИН компактний
  // рядок (слово · пілюля · дії), не header/scrollarea/footer-структура
  // форми нижче: тут майже нема чого показувати, а стара структура все
  // одно розтягувала панель на всю ширину/висоту форми (задача-виправлення
  // "compact panel in saved state"). .plain-word-panel--compact-saved
  // (globals.css) перемикає сам .plain-word-panel на flex-ряд із
  // wrap/width:max-content замість flex-колонки на всю висоту обгортки.
  if (justSaved || justRemoved) {
    return (
      <div className="plain-word-panel plain-word-panel--compact-saved" role="region" ref={panelRef} onKeyDown={handleKeyDown}>
        <p className="plain-word-panel-word">{word}</p>
        <p className="save-word-pill save-word-pill--saved save-word-pill--compact">
          {justSaved ? t("dictionary.panelSavedConfirm") : t("dictionary.panelRemovedConfirm")}
        </p>
      </div>
    );
  }

  // Структура ОДНАКОВА в обох гілках нижче (вчителька/форма) — header
  // (слово, завжди видиме, НІКОЛИ не скролиться) / scrollarea (змінний
  // вміст, скролиться, коли бракує місця — задача-виправлення "bounded
  // scroll area and sticky actions in word panels") / footer (кнопки дій —
  // "липкий", теж поза скролом, тож Зберегти/Скасувати завжди доступні).
  // Коли компонент рендериться БЕЗ обмеженої висоти (скрипт, не відео) —
  // flex-колонка просто розтягується під вміст, scrollarea ніколи не
  // скролить (overflow:auto без max-height не дає скролбару) — та сама
  // поведінка, що й до цього рефакторингу.

  if (teacherItem) {
    const pos = normalizePartOfSpeech(teacherItem.partOfSpeech);
    const posLabel = pos ? PART_OF_SPEECH_LABELS_FR[pos] : null;
    const note = teacherItem.note?.trim() || null;
    const snapshot: SaveWordSnapshot = {
      word,
      translation: teacherItem.translation,
      translationSource: "teacher",
      partOfSpeech: teacherItem.partOfSpeech ?? null,
      note,
      imageUrl: teacherItem.image_url ?? null,
      vocabId: teacherItem.id ?? null,
      contextFr,
      contextUk,
    };
    return (
      <div className={panelClassName} role="region" ref={panelRef} onKeyDown={handleKeyDown}>
        <div className="plain-word-panel-header">
          <p className="plain-word-panel-word">{word}</p>
        </div>
        <div className="plain-word-panel-scrollarea">
          <p className="plain-word-panel-translation">{teacherItem.translation}</p>
          {posLabel && <p className="plain-word-panel-pos">{posLabel}</p>}
          {note && <p className="plain-word-panel-note">{note}</p>}
        </div>
        <div className="plain-word-panel-footer">
          <div className="flex flex-wrap items-center gap-2">
            <SaveWordButton snapshot={snapshot} variant="pill" />
            <button type="button" onClick={onClose} className="plain-word-panel-cancel">
              {t("dictionary.panelClose")}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (existing) {
    // Один компактний рядок — слово · (переклад, якщо студент його вписав)
    // · "✓ У словнику" · Прибрати · Закрити. Частина мови (existingPosLabel
    // у попередній версії) свідомо не показуємо тут — другорядна деталь,
    // яка й так лишається видимою на /cabinet/dictionary; у компактному
    // рядку лише те, що потрібно для швидкого погляду/дії.
    return (
      <div className="plain-word-panel plain-word-panel--compact-saved" role="region" ref={panelRef} onKeyDown={handleKeyDown}>
        <p className="plain-word-panel-word">{word}</p>
        {existing.translation && (
          <span className="plain-word-panel-compact-translation">{existing.translation}</span>
        )}
        <p className="save-word-pill save-word-pill--saved save-word-pill--compact">{t("dictionary.savedState")}</p>
        <button type="button" onClick={handleRemove} disabled={pending} className="save-word-remove-link">
          {t("dictionary.removeAction")}
        </button>
        <button type="button" onClick={onClose} className="plain-word-panel-cancel">
          {t("dictionary.panelClose")}
        </button>
        {error && <p className="save-word-error plain-word-panel-compact-error">{t("dictionary.saveError")}</p>}
      </div>
    );
  }

  async function handleSave() {
    setSaving(true);
    const result = await saved!.save({
      word,
      translation: value.trim() || null,
      translationSource: value.trim() ? "own" : "none",
      contextFr,
      contextUk,
      ...(partOfSpeech ? { partOfSpeech } : {}),
    });
    setSaving(false);
    if (result.ok) setJustSaved(true);
  }

  return (
    <div className={panelClassName} role="region" ref={panelRef} onKeyDown={handleKeyDown}>
      <div className="plain-word-panel-header">
        <p className="plain-word-panel-word">{word}</p>
      </div>
      <div className="plain-word-panel-scrollarea">
        {contextUk && <p className="plain-word-panel-context">{t("dictionary.panelLineLabel", { line: contextUk })}</p>}
        <label className="plain-word-panel-label" htmlFor={inputId}>
          {t("dictionary.panelTranslationLabel")}
        </label>
        <input
          id={inputId}
          type="text"
          value={value}
          maxLength={200}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void handleSave();
            }
          }}
          className="plain-word-panel-input"
        />
        <PosChipGroup value={partOfSpeech} onChange={setPartOfSpeech} groupId={`${inputId}-pos`} />
      </div>
      <div className="plain-word-panel-footer">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="save-word-pill save-word-pill--primary"
          >
            {t("dictionary.panelSave")}
          </button>
          <button type="button" onClick={onClose} className="plain-word-panel-cancel">
            {t("dictionary.panelCancel")}
          </button>
        </div>
        {error && <p className="save-word-error">{t("dictionary.saveError")}</p>}
      </div>
    </div>
  );
}
