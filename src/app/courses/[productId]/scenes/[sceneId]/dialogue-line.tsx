"use client";

import { useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import type { VocabItem } from "@/lib/vocab";
import { matchVocabInText, matchTranslatedFormInText, buildVariantMap, normalizeWordForMatch } from "@/lib/vocab-match";
import { formatTimecode } from "@/lib/format-timecode";
import { normalizePartOfSpeech, PART_OF_SPEECH_LABELS_FR, PART_OF_SPEECH_ORDER, type PartOfSpeech } from "@/lib/vocab-categories";
import { useT } from "@/lib/i18n/context";
import type { MessageKey } from "@/lib/i18n/messages/uk";
import { SaveWordButton } from "@/components/dictionary/save-word-button";
import { useSavedWords, type SaveWordSnapshot } from "@/components/dictionary/saved-words-provider";

// Ті самі 8 категорій/порядок, що вчительський конструктор
// (vocab-item-row.tsx) і студентська сторінка "Вокабуляр" — канонічне
// джерело лишається ТІЛЬКИ vocab-categories.ts, тут лише розбиття на
// "4 основні" (видно завжди) і "решта" (під чипом "Інше") для панелі
// звичайного слова.
const MAIN_POS = PART_OF_SPEECH_ORDER.slice(0, 4);

// Короткі українські підписи чипів (не ті самі, що cabinet.dictionary.
// filter.* на /cabinet/dictionary — ті множинні "Іменники"/"Дієслова" для
// фільтра списку, тут однина "іменник" для вибору ОДНІЄЇ частини мови
// одного слова).
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

// "Ім'я:" на початку перекладеного тексту репліки — самостійний дублікат
// тієї самої евристики, що вже в script-import/parse.ts (там — для
// парсингу файлів сценарію, тут — для рендеру: translationUk вільний
// рядок, який учителька пише сама, і перекладене ім'я спікера в ньому НЕ
// збігається з line.speaker з оригіналу, тож жирний спікер перекладу можна
// отримати лише розпізнаванням усередині самого тексту).
const TRANSLATION_SPEAKER_PREFIX = /^\s*([A-ZÀ-ÖØ-ÞА-ЯІЇҐ][\w' -]{0,39}):\s*(.*)$/u;

export function splitTranslationSpeaker(text: string): { speaker: string | null; rest: string } {
  const match = text.match(TRANSLATION_SPEAKER_PREFIX);
  if (!match) return { speaker: null, rest: text };
  return { speaker: match[1].trim(), rest: match[2].trim() };
}

// Підсвітка translatedForm у перекладеному тексті — та сама механіка
// спліт-і-підсвітка, що DialogueLine нижче для оригіналу, але БЕЗ
// клікабельності/спливаючого перекладу (однобічний візуальний натяк, не
// інтерактивний елемент — переклад слова вже показаний ліворуч).
export function TranslatedText({ text, vocab }: { text: string; vocab: VocabItem[] }) {
  const parts = matchTranslatedFormInText(text, vocab);

  return (
    <>
      {parts.map((part, i) =>
        part.type === "match" ? (
          <span
            key={i}
            className="vocab-chip rounded px-1"
          >
            {part.text}
          </span>
        ) : (
          <span key={i}>{part.text}</span>
        )
      )}
    </>
  );
}

// Контрольований ззовні (ScriptSection) — сам не тримає стан "показано чи
// ні", щоб клік на інше слово десь-інде на сторінці міг миттєво закрити цей
// переклад (лише одне слово відкрите одночасно на весь скрипт).
//
// Тултип тепер СИБЛІНГ кнопки слова, не її дитина: усередині з'явилась
// SaveWordButton (теж <button>), а HTML не дозволяє вкладати interactive-
// елемент в <button> — обгортка .relative перенесена на зовнішній span,
// саму кнопку-слово лишає без relative (їй воно більше не потрібне).
function VocabWord({
  id,
  displayWord,
  item,
  contextFr,
  contextUk,
  isOpen,
  onClick,
}: {
  id: string;
  displayWord: string;
  item: VocabItem;
  contextFr: string;
  contextUk: string | null;
  isOpen: boolean;
  onClick: (id: string) => void;
}) {
  const pos = normalizePartOfSpeech(item.partOfSpeech);
  const posLabel = pos ? PART_OF_SPEECH_LABELS_FR[pos] : null;
  const note = item.note?.trim() || null;

  const snapshot: SaveWordSnapshot = {
    word: displayWord,
    translation: item.translation,
    translationSource: "teacher",
    partOfSpeech: item.partOfSpeech ?? null,
    note,
    imageUrl: item.image_url ?? null,
    vocabId: item.id ?? null,
    contextFr,
    contextUk,
  };

  return (
    <span className="relative inline-block">
      <button
        type="button"
        onClick={() => onClick(id)}
        className="vocab-chip vocab-chip--interactive rounded px-1"
      >
        {displayWord}
      </button>
      {isOpen && (
        <span className="vocab-chip-tooltip absolute left-1/2 top-full z-10 mt-1 w-max max-w-56 -translate-x-1/2 rounded px-2 py-1 text-xs">
          <span className="block">{item.translation}</span>
          {posLabel && <span className="vocab-chip-tooltip-pos mt-0.5 block">{posLabel}</span>}
          {note && <span className="mt-0.5 block italic">{note}</span>}
          <span className="mt-1.5 block">
            <SaveWordButton snapshot={snapshot} variant="pill" />
          </span>
        </span>
      )}
    </span>
  );
}

// Бейдж часу — окремий елемент ПЕРЕД спікером, не обгортка над усією
// реплікою: текст репліки вже має власну клік-взаємодію (VocabWord вище),
// обгортання всього рядка в <a> конфліктувало б із нею. Клікабельний лише
// коли є videoLink; сам по собі start без videoLink — звичайний нейтральний
// текст. Немає жодного з двох — нічого не рендериться (без "0:00"-заглушки).
function TimecodeBadge({ start, videoLink }: { start: number | null | undefined; videoLink: string | null | undefined }) {
  if (start == null && !videoLink) return null;
  const label = start != null ? formatTimecode(start) : "▶";

  if (videoLink) {
    return (
      <a
        href={videoLink}
        target="_blank"
        rel="noopener noreferrer"
        className="mr-1.5 text-xs font-normal text-blue-600 hover:underline dark:text-blue-400"
      >
        {label}
      </a>
    );
  }
  return <span className="mr-1.5 text-xs font-normal text-neutral-400 dark:text-[#5d5b78]">{label}</span>;
}

// Для порівняння "той самий спікер, що на попередній репліці" — регістр і
// пробіли з початку/кінця не мають значення.
export function normalizeSpeakerForCompare(speaker: string): string {
  return speaker.trim().toLowerCase();
}

type PlainToken =
  | { type: "literal"; text: string }
  | { type: "word"; text: string; clickable: boolean };

// Токенізація ЗВИЧАЙНОГО (не підсвіченого вчителькою) тексту репліки — на
// літерні групи /[\p{L}\p{M}]+/gu, усе решта (пробіли, розділові знаки,
// апострофи, дефіси, цифри) лишається "literal" (не клікабельне за
// визначенням — дефіс/апостроф самі НЕ входять у \p{L}\p{M}, тож "peut-
// être"/"qu'il" вже природно розпадаються на окремі літерні групи навколо
// них, без додаткової логіки). Токен, за яким ОДРАЗУ йде апостроф
// (l'/d'/j'/qu'/jusqu'...), навмисно позначається неклікабельним — це
// службова частка, не самостійне слово для словника.
const APOSTROPHE_CHARS = new Set(["'", "’", "‘", "ʼ"]);

function tokenizePlainText(text: string): PlainToken[] {
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
    tokens.push({ type: "word", text: word, clickable });
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

// Снімок/панель звичайного слова, відкрита під реплікою (ПІД <p>, не
// floating-тултіп — щоб на телефоні не перекривала текст скрипту).
// Пріоритет "вчительських" даних: якщо це слово десь у сцені позначене
// вчителькою як vocab (teacherItem !== null), показуємо її переклад/
// частину мови/примітку й SaveWordButton з ТІЄЮ ж логікою, що бульбашка
// VocabWord, замість форми ручного перекладу.
function PlainWordPanel({
  word,
  contextFr,
  contextUk,
  teacherItem,
  inputId,
  onClose,
}: {
  word: string;
  contextFr: string;
  contextUk: string | null;
  teacherItem: VocabItem | null;
  inputId: string;
  onClose: () => void;
}) {
  const { t } = useT();
  const saved = useSavedWords();
  const [value, setValue] = useState("");
  // Нічого не вибрано за замовчуванням; absent (не null) у снепшоті, якщо
  // студент нічого не обрав — та сама поведінка, що й до цього чипа.
  const [partOfSpeech, setPartOfSpeech] = useState<PartOfSpeech | null>(null);
  // justSaved/justRemoved — лише короткий підпис ПЕРЕД автозакриттям
  // (onClose викликає ScriptSection, яка прибирає openPlainKey й
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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- onClose зі ScriptSection стабільний між рендерами лише за формою виклику, не за ідентичністю; залежність від justSaved/justRemoved навмисно єдина, що має перезапускати таймер
  }, [justSaved, justRemoved]);

  // Клік/тап ПОЗА панеллю закриває її — mousedown/touchstart (не click),
  // той самий принцип, що VocabWord-тултіп (script-section.tsx) і
  // category-dropdown.tsx: спрацьовує РАНІШЕ за click, тож клік на інше
  // звичайне слово (.plain-word-btn) тут навмисно пропускається — його
  // ВЛАСНИЙ onClick (DialogueLine) сам відкриє нову панель/закриє цю,
  // без подвійного перемикання.
  useEffect(() => {
    function handlePointerDown(e: Event) {
      const target = e.target as Element | null;
      if (panelRef.current?.contains(target)) return;
      if (target?.closest(".plain-word-btn")) return;
      onClose();
    }
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- onClose зі ScriptSection стабільний за формою виклику; переприв'язка на кожен рендер непотрібна
  }, []);

  function handleKeyDown(e: ReactKeyboardEvent<HTMLDivElement>) {
    if (e.key === "Escape") onClose();
  }

  if (!saved) return null;

  const existing = saved.getSaved(word);
  const error = saved.getError(word);
  const pending = saved.isPending(word);

  async function handleRemove() {
    const result = await saved!.remove(word);
    if (result.ok) setJustRemoved(true);
  }

  if (justSaved || justRemoved) {
    return (
      <div className="plain-word-panel" role="region" ref={panelRef} onKeyDown={handleKeyDown}>
        <p className="plain-word-panel-word">{word}</p>
        <p className="save-word-pill save-word-pill--saved inline-flex">
          {justSaved ? t("dictionary.panelSavedConfirm") : t("dictionary.panelRemovedConfirm")}
        </p>
      </div>
    );
  }

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
      <div className="plain-word-panel" role="region" ref={panelRef} onKeyDown={handleKeyDown}>
        <p className="plain-word-panel-word">{word}</p>
        <p className="plain-word-panel-translation">{teacherItem.translation}</p>
        {posLabel && <p className="plain-word-panel-pos">{posLabel}</p>}
        {note && <p className="plain-word-panel-note">{note}</p>}
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <SaveWordButton snapshot={snapshot} variant="pill" />
          <button type="button" onClick={onClose} className="plain-word-panel-cancel">
            {t("dictionary.panelClose")}
          </button>
        </div>
      </div>
    );
  }

  if (existing) {
    // Та сама FR-назва, що читає /cabinet/dictionary (PART_OF_SPEECH_LABELS_FR,
    // dictionary-view.tsx) — read-only лейбл, без чипів/редагування тут.
    const existingPosLabel = existing.partOfSpeech ? PART_OF_SPEECH_LABELS_FR[existing.partOfSpeech] : null;
    return (
      <div className="plain-word-panel" role="region" ref={panelRef} onKeyDown={handleKeyDown}>
        <p className="plain-word-panel-word">{word}</p>
        <p className="save-word-pill save-word-pill--saved inline-flex">{t("dictionary.savedState")}</p>
        {existing.translation && <p className="plain-word-panel-translation">{existing.translation}</p>}
        {existingPosLabel && <p className="plain-word-panel-pos">{existingPosLabel}</p>}
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <button type="button" onClick={handleRemove} disabled={pending} className="save-word-remove-link">
            {t("dictionary.removeAction")}
          </button>
          <button type="button" onClick={onClose} className="plain-word-panel-cancel">
            {t("dictionary.panelClose")}
          </button>
        </div>
        {error && <p className="save-word-error">{t("dictionary.saveError")}</p>}
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
    <div className="plain-word-panel" role="region" ref={panelRef} onKeyDown={handleKeyDown}>
      <p className="plain-word-panel-word">{word}</p>
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
      <div className="mt-2 flex flex-wrap items-center gap-2">
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
  );
}

export function DialogueLine({
  lineIndex,
  speaker,
  text,
  vocab,
  sceneVocab,
  start,
  videoLink,
  translationUk,
  openId,
  onWordClick,
  openPlainKey,
  onPlainWordClick,
  showSpeaker = true,
}: {
  lineIndex: number;
  speaker: string;
  text: string;
  vocab: VocabItem[];
  // Повна лексика СЦЕНИ (не лише цієї репліки) — для пріоритету
  // "вчительських" даних у панелі звичайного слова: те саме слово могло
  // бути позначене вчителькою в ІНШІЙ репліці сцени.
  sceneVocab?: VocabItem[];
  start?: number | null;
  videoLink?: string | null;
  // Переклад репліки (translationUk з scenes.dialogue) — потрібен лише як
  // контекст для снімка збереженого слова (contextUk), саму репліку й без
  // цього пропу вже показує окрема колонка/TranslationCell у
  // script-section.tsx, коли студент тогглить "Показати переклад".
  translationUk?: string | null;
  openId: string | null;
  onWordClick: (id: string) => void;
  // Окремий від openId/onWordClick стан — панель звичайного слова НЕ
  // закриває/не закривається тултіпом VocabWord і навпаки (свідомо: не
  // чіпаємо поведінку підсвічених слів).
  openPlainKey?: string | null;
  onPlainWordClick?: (key: string) => void;
  // false — та сама репліка спікера, що й на попередньому рядку: ім'я не
  // повторюємо і НЕ лишаємо місця під нього (ні invisible-підпису, ні
  // відступу) — текст починається з лівого краю колонки, як рядок без
  // спікера. Якщо speaker.trim() взагалі порожній — так само нема ні
  // імені, ні двокрапки, ні відступу, незалежно від цього прапорця.
  showSpeaker?: boolean;
}) {
  const parts = matchVocabInText(text, vocab);
  const label = speaker.trim();
  const saved = useSavedWords();
  const teacherVariantMap = useMemo(() => buildVariantMap(sceneVocab ?? []), [sceneVocab]);
  const plainKeyPrefix = `${lineIndex}-plain-`;
  // Щоб повернути фокус на кнопку слова, яка відкрила панель, коли та
  // закривається (Esc/автозакриття/Скасувати/клік поза) — ключ той самий
  // формат, що openPlainKey.
  const wordButtonRefs = useRef<Map<string, HTMLButtonElement>>(new Map());

  // Токенізація "text"-частин ОКРЕМО від рендеру (чиста функція, без
  // мутації зовнішньої змінної зсередини .map()) — нижче і визначення
  // openPlainWord, і сам рендер читають з цього самого масиву, щоб не
  // токенізувати двічі.
  const tokenizedTextParts = useMemo(
    () => parts.map((part) => (part.type === "text" ? tokenizePlainText(part.text) : null)),
    [parts]
  );

  const openPlainWord = useMemo(() => {
    if (!openPlainKey || !openPlainKey.startsWith(plainKeyPrefix)) return null;
    for (let i = 0; i < tokenizedTextParts.length; i++) {
      const tokens = tokenizedTextParts[i];
      if (!tokens) continue;
      for (let j = 0; j < tokens.length; j++) {
        const token = tokens[j];
        if (token.type === "word" && token.clickable && `${plainKeyPrefix}${i}-${j}` === openPlainKey) {
          return token.text;
        }
      }
    }
    return null;
  }, [tokenizedTextParts, openPlainKey, plainKeyPrefix]);

  const content = parts.map((part, i) => {
    if (part.type === "match") {
      const id = `${lineIndex}-${i}`;
      return (
        <VocabWord
          key={i}
          id={id}
          displayWord={part.text}
          item={part.item}
          contextFr={text}
          contextUk={translationUk ?? null}
          isOpen={openId === id}
          onClick={onWordClick}
        />
      );
    }

    // Без SavedWordsProvider (сторінка без контексту сцени/незалогінений
    // студент) звичайні слова лишаються звичайним текстом — без кнопок,
    // точно як до Етапу 2.
    const tokens = tokenizedTextParts[i];
    if (!saved || !tokens) {
      return <span key={i}>{part.text}</span>;
    }

    return (
      <span key={i}>
        {tokens.map((token, j) => {
          if (token.type === "literal" || !token.clickable) {
            return <span key={j}>{token.text}</span>;
          }
          const key = `${plainKeyPrefix}${i}-${j}`;
          const isOpen = openPlainKey === key;
          return (
            <button
              key={j}
              ref={(el) => {
                if (el) wordButtonRefs.current.set(key, el);
                else wordButtonRefs.current.delete(key);
              }}
              type="button"
              onClick={() => onPlainWordClick?.(isOpen ? "" : key)}
              aria-expanded={isOpen}
              className="plain-word-btn"
            >
              {token.text}
            </button>
          );
        })}
      </span>
    );
  });

  const teacherItem = openPlainWord ? teacherVariantMap.get(normalizeWordForMatch(openPlainWord)) ?? null : null;

  // Закриває панель і повертає фокус на кнопку слова, яка її відкрила —
  // rAF, бо сама кнопка все ще в DOM у момент виклику (панель
  // анмаунтиться лише на НАСТУПНОМУ рендері ScriptSection, після
  // onPlainWordClick), фокусити її одразу безпечно й без затримки для ока.
  function closePlainPanel() {
    const key = openPlainKey;
    onPlainWordClick?.("");
    if (key) {
      requestAnimationFrame(() => wordButtonRefs.current.get(key)?.focus());
    }
  }

  return (
    <div>
      <p>
        <TimecodeBadge start={start} videoLink={videoLink} />
        {showSpeaker && label && (
          <>
            <span className="font-semibold">{label}:</span>{" "}
          </>
        )}
        {content}
      </p>
      {openPlainWord && (
        <PlainWordPanel
          word={openPlainWord}
          contextFr={text}
          contextUk={translationUk ?? null}
          teacherItem={teacherItem ?? null}
          inputId={`plain-word-translation-${lineIndex}`}
          onClose={closePlainPanel}
        />
      )}
    </div>
  );
}
