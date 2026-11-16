"use client";

import { useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { Pencil } from "lucide-react";
import type { VocabItem } from "@/lib/vocab";
import { normalizePartOfSpeech, PART_OF_SPEECH_LABELS_FR, PART_OF_SPEECH_ORDER, type PartOfSpeech } from "@/lib/vocab-categories";
import { normalizeWordForMatch } from "@/lib/vocab-match";
import {
  extractPhrase,
  validatePhraseInput,
  toggleNeighborSelection,
  MAX_PHRASE_LENGTH,
  type PhraseSelection,
} from "@/lib/cabinet/saved-words";
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

// Токен-кандидат на сусідній chip (задача "save multi-word phrase..."):
// лише клікабельні word-токени тієї ж речення, в порядку появи в тексті —
// той самий набір, що вже рендериться як кнопки .plain-word-btn/
// .video-plain-word (dialogue-line.tsx/video-player.tsx), не довільна
// підмножина tokenizePlainText.
export type PhraseWordToken = { text: string; start: number };

// Type guard для фільтрації tokenizePlainText()-токенів до кандидатів-
// сусідів (dialogue-line.tsx/video-player.tsx) — без нього .filter(tok =>
// tok.type === "word" && tok.clickable) не вузить тип для .map() (звичайний
// boolean-callback, не предикат), і довелось би приводити тип вручну.
export function isClickableWordToken(tok: PlainToken): tok is { type: "word"; text: string; clickable: true; start: number } {
  return tok.type === "word" && tok.clickable;
}

// До 3 сусідів з КОЖНОГО боку (задача, п.1) — єдина константа, не магічне
// число в кількох місцях (вікно для рендеру чипів і межі toggleNeighborSelection
// нижче рахуються від неї).
const MAX_NEIGHBORS_EACH_SIDE = 3;

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
  defaultExpanded = false,
}: {
  value: PartOfSpeech | null;
  onChange: (pos: PartOfSpeech | null) => void;
  groupId: string;
  // true — лише коли "value" уже є дефолтним "phrase" (фраза з 2+ слів,
  // задача п.3), а не основним чипом (MAIN_POS): без цього вибраний
  // "phrase" лишався б ПРИХОВАНИМ за "Інше" до першого кліку — студент не
  // бачив би, що якась частина мови вже обрана.
  defaultExpanded?: boolean;
}) {
  const { t } = useT();
  const [showMore, setShowMore] = useState(defaultExpanded);
  // defaultExpanded стає true ПІЗНІШЕ за монтування (фраза виростає до 2+
  // слів лише після того, як студент тапнув сусідній chip, вже ПІСЛЯ
  // першого рендеру цієї групи з showMore=false) — useState-ініціалізатор
  // вище сам цього не підхопить, тож ефект розгортає "Інше" ОДНОРАЗОВО,
  // коли дефолт "phrase" з'являється (ніколи назад — студент сам міг уже
  // розгорнути список).
  useEffect(() => {
    if (defaultExpanded) setShowMore(true);
  }, [defaultExpanded]);
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
              tabIndex={isChecked || (index === 0 && !visible.includes(value as PartOfSpeech)) ? 0 : -1}
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
  phraseTokens,
  phraseCenterIndex,
  phraseSourceText,
  teacherVariantMap,
  inputId,
  onClose,
  compact = false,
  surface = "light",
  onLayoutChange,
}: {
  // Слово, по якому тапнули — завжди в підсумковій фразі, ніколи не
  // прибирається сусіднім chip-ом (воно й саме входить у phraseTokens на
  // позиції phraseCenterIndex).
  word: string;
  contextFr: string;
  contextUk: string | null;
  // Контекстне речення (contextFr/contextUk вище) рахується ОДИН раз при
  // відкритті панелі (той самий offset тапнутого слова, що й раніше) і НЕ
  // перерахунковується, коли студент додає/прибирає сусідів — усі
  // кандидати-сусіди за побудовою з того самого речення.
  phraseTokens: PhraseWordToken[];
  phraseCenterIndex: number;
  // Текст, офсети якого використовує phraseTokens (частина репліки між
  // вчительськими збігами — скрипт; нормалізована FR-кью — відео) —
  // extractPhrase рахує символьний слайс САМЕ в ньому.
  phraseSourceText: string;
  // Пріоритет "вчительських" даних (задача, п.4) тепер РЕАКТИВНИЙ до
  // поточної фрази (не фіксований на момент відкриття, як старий проп
  // teacherItem): якщо студент додає/прибирає сусідів так, що фраза
  // починає/перестає збігатися з якимось вчительським словом/виразом у
  // сцені — панель одразу перемикається між формою ручного перекладу й
  // вчительською карткою.
  teacherVariantMap: Map<string, VocabItem>;
  inputId: string;
  onClose: () => void;
  compact?: boolean;
  // "light" (за замовчуванням) — скрипт сцени (dialogue-line.tsx), та сама
  // світла/лавандова поверхня в обох темах сайту, що й раніше. "dark" —
  // лише video-player.tsx: задача-виправлення "unify plain-word panel with
  // teacher card on dark glass" — панель переходить на те саме темне скло,
  // що VideoWordCard (раніше лишалась світлою навмисно, тепер цю вимогу
  // скасовано на користь візуальної єдності двох карток слова над відео).
  // Сам проп лише додає/прибирає клас-модифікатор (.plain-word-panel--video,
  // globals.css) і forward-ить surface="dark" у спільні -on-dark варіанти
  // (SaveWordButton/save-word-pill/save-word-remove-link) — структура й
  // розмітка компонента не форкаються.
  surface?: "light" | "dark";
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

  // --- Вибір фрази (задача "save multi-word phrase...") ------------------
  // selection — суцільний діапазон ВІДНОСНО phraseCenterIndex (0 — лише
  // тапнуте слово, той самий стан, що й раніше для одного слова).
  // manualOverride — ручне редагування title-інпута ПЕРЕКРИВАЄ фразу,
  // побудовану з чипів, доти, доки студент знову не тапне чип (тоді
  // повертається на обчислену з виділення — "останній жест вирішує").
  const [selection, setSelection] = useState<PhraseSelection>({ min: 0, max: 0 });
  const [manualOverride, setManualOverride] = useState<string | null>(null);

  // Вікно чипів — до 3 кандидатів із кожного боку phraseCenterIndex, в
  // межах реально наявних токенів (caller уже обмежив phraseTokens тим
  // самим реченням, що й тапнуте слово).
  const neighborWindow = useMemo(() => {
    const lo = Math.max(0, phraseCenterIndex - MAX_NEIGHBORS_EACH_SIDE);
    const hi = Math.min(phraseTokens.length - 1, phraseCenterIndex + MAX_NEIGHBORS_EACH_SIDE);
    const list: { token: PhraseWordToken; rel: number }[] = [];
    for (let idx = lo; idx <= hi; idx++) {
      list.push({ token: phraseTokens[idx], rel: idx - phraseCenterIndex });
    }
    return list;
  }, [phraseTokens, phraseCenterIndex]);

  const selectedTokens = neighborWindow.filter((w) => w.rel >= selection.min && w.rel <= selection.max);
  const computedPhrase =
    selectedTokens.length > 0
      ? extractPhrase(
          phraseSourceText,
          selectedTokens[0].token.start,
          selectedTokens[selectedTokens.length - 1].token.start + selectedTokens[selectedTokens.length - 1].token.text.length
        )
      : word;
  const rawPhrase = manualOverride ?? computedPhrase;
  const phraseValidation = validatePhraseInput(rawPhrase);
  const phraseWordCount = rawPhrase.trim() ? rawPhrase.trim().split(/\s+/).length : 0;
  // effectiveWord — те, з чим реально працює решта компонента (дедуп/
  // збереження/вчительський пошук): валідована фраза, якщо валідна, інакше
  // тримний сирий текст (щоб getSaved/teacherVariantMap.get не впали на
  // порожньому рядку) — саме збереження нижче (handleSave) окремо
  // перевіряє phraseValidation.ok і НЕ відправляє невалідну фразу.
  const effectiveWord = phraseValidation.ok ? phraseValidation.phrase : rawPhrase.trim() || word;

  function handleNeighborClick(rel: number) {
    if (rel === 0) return;
    setSelection((cur) => toggleNeighborSelection(cur, rel));
    setManualOverride(null);
  }

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
  // Автозакриття компактного "уже збережено" стану (existing-гілка нижче,
  // НЕ justSaved/justRemoved — ті лишаються з власним 1с-таймером вище) —
  // задача-виправлення "saved card actions row and 3s auto-close".
  // interacting — наведення/фокус/дотик СТАВИТЬ таймер на паузу (ефект
  // нижче просто не стартує новий, поки interacting===true); щойно
  // взаємодія закінчується (pointerleave/blur/pointerup), ефект
  // перезапускається ПОВНИМИ 3с — не "продовжує" попередній відлік.
  const [interacting, setInteracting] = useState(false);
  // closing — короткий fade (150мс) ПЕРЕД самим onClose, лише для
  // автозакриття (ручний клік "Закрити" лишається миттєвим, як і раніше);
  // prefers-reduced-motion пропускає цей крок і закриває одразу.
  const [closing, setClosing] = useState(false);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fadeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Автофокус поля перекладу — ЛИШЕ форма ручного перекладу має цей інпут
  // (teacherItem/existing/justSaved/justRemoved — ні), тож ref.current тут
  // буде null у трьох з чотирьох гілок, ефект нижче просто нічого не
  // робить. pointer:fine (не "десктоп" за шириною екрана) — на телефоні/
  // планшеті з сенсорним вводом автофокус висмикнув би клавіатуру одразу
  // при відкритті панелі (задача-виправлення "ignore player shortcuts
  // while typing in word panel", п.5).
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    if (!window.matchMedia("(pointer: fine)").matches) return;
    inputRef.current?.focus();
  }, []);

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

  // Escape закриває (той самий onClose, що й документний слухач
  // video-player.tsx — панель лише дублює для фокусу всередині себе).
  // Будь-яка ІНША клавіша — stopPropagation, щоб клавіатурні скорочення
  // плеєра (Пробіл=play/pause, ←/→=перемотка — handleWrapperKeyDown,
  // video-player.tsx) НІКОЛИ не спрацьовували, поки фокус десь усередині
  // цієї панелі (поле вводу, чипи частини мови, кнопки Зберегти/
  // Скасувати) — задача-виправлення "ignore player shortcuts while
  // typing in word panel". isComposing — IME-композиція (напр. вибір
  // ієрогліфа) ще не завершена, не чіпаємо event.
  function handleKeyDown(e: ReactKeyboardEvent<HTMLDivElement>) {
    if (e.key === "Escape") {
      onClose();
      return;
    }
    if (!e.nativeEvent.isComposing) e.stopPropagation();
  }
  function handleKeyUp(e: ReactKeyboardEvent<HTMLDivElement>) {
    if (e.key !== "Escape" && !e.nativeEvent.isComposing) e.stopPropagation();
  }

  // existing/isSavedCompact рахуються ТУТ (до "if (!saved) return null"
  // нижче, з optional chaining) — react-hooks/rules-of-hooks забороняє
  // виклик хука (useEffect нижче) ПІСЛЯ умовного return, навіть якщо
  // saved===null на практиці ніколи не змінюється протягом життя цього
  // компонента.
  const existing = saved?.getSaved(effectiveWord) ?? null;
  // dynamicTeacherItem — пошук ПОТОЧНОЇ фрази (не фіксованого word), щоб
  // додавання/прибирання сусідів могло перемкнути панель у вчительську
  // картку чи назад (задача, п.4). !dynamicTeacherItem — та сама гілка-
  // пріоритет, що нижче (if (dynamicTeacherItem) рендериться ПЕРШИМ, перед
  // if (existing)): слово/фраза, яку вчителька позначила як vocab, завжди
  // показує повну вчительську форму, навіть якщо вже збережена студентом.
  // isPersistentCompact — САМЕ "existing" гілка нижче (не транзитні
  // justSaved/justRemoved, в яких уже є власний 1с-таймер вище) — за цим
  // прапорцем вирішує, коли стартувати 3с-таймер автозакриття нижче.
  const dynamicTeacherItem = teacherVariantMap.get(normalizeWordForMatch(effectiveWord)) ?? null;
  const isPersistentCompact = Boolean(!dynamicTeacherItem && existing);
  const isSavedCompact = Boolean(justSaved || justRemoved || isPersistentCompact);
  useEffect(() => {
    onLayoutChange?.(isSavedCompact ? "compact" : "form");
    // eslint-disable-next-line react-hooks/exhaustive-deps -- onLayoutChange з викликача стабільний лише за формою виклику, не за ідентичністю; залежність від isSavedCompact навмисно єдина, що має перевикликати ефект
  }, [isSavedCompact]);

  // 3с автозакриття компактного "уже збережено" стану — лише коли
  // isPersistentCompact і студент зараз НЕ взаємодіє (interacting===false).
  // Залежність від interacting — саме той механізм, що "ставить на паузу"
  // (ефект виходить одразу, без запуску таймера) і "перезапускає ПОВНИМИ
  // 3с" (зміна interacting false->true->false відмонтовує/монтовує цей
  // ефект заново через cleanup/повторний виклик, новий setTimeout(3000)
  // щоразу з нуля, а не "залишок" попереднього відліку).
  useEffect(() => {
    if (!isPersistentCompact || interacting) return;
    closeTimerRef.current = setTimeout(() => {
      const prefersReducedMotion =
        typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
      if (prefersReducedMotion) {
        onClose();
        return;
      }
      setClosing(true);
      fadeTimerRef.current = setTimeout(onClose, 150);
    }, 3000);
    return () => {
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- onClose з викликача стабільний лише за формою виклику; залежність навмисно лише isPersistentCompact/interacting
  }, [isPersistentCompact, interacting]);

  // Таймер fade-перед-закриттям (150мс) живе довше за сам 3с-ефект вище
  // (стартує ВСЕРЕДИНІ його колбека, не в ефекті з власним cleanup) —
  // чистимо його окремо, лише на анмаунт.
  useEffect(() => {
    return () => {
      if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current);
    };
  }, []);

  if (!saved) return null;

  const error = saved.getError(effectiveWord);
  const pending = saved.isPending(effectiveWord);

  async function handleRemove() {
    const result = await saved!.remove(effectiveWord);
    if (result.ok) setJustRemoved(true);
  }

  // Частина мови за замовчуванням для фрази з 2+ слів — "phrase" (задача,
  // п.3), лише коли студент ще не вибрав ЩОСЬ сам (partOfSpeech !== null);
  // явний клік (у т.ч. деселект того самого чипа, PosChipGroup) завжди
  // перекриває цей дефолт.
  const effectivePartOfSpeech = partOfSpeech ?? (phraseWordCount >= 2 ? "phrase" : null);

  // Рядок-заголовок (редагований інпут "фрази" + олівець-підказка +
  // сусідні chip-и) — ОДНАКОВИЙ у всіх трьох гілках нижче (вчителька/
  // existing/форма): чипи мають лишатись тапабельними навіть коли панель
  // зараз показує вчительський переклад чи "уже збережено", інакше студент
  // не зміг би вийти назад із цього збігу, розширивши/звузивши фразу.
  function renderPhraseHeader() {
    return (
      <div className="plain-word-panel-header">
        <div className="plain-word-panel-title-row">
          <Pencil size={12} aria-hidden="true" className="plain-word-panel-title-pencil" />
          <input
            type="text"
            value={rawPhrase}
            size={Math.min(40, Math.max(rawPhrase.length, 3) + 1)}
            maxLength={MAX_PHRASE_LENGTH}
            onChange={(e) => setManualOverride(e.target.value)}
            onKeyDown={(e) => {
              if (e.key !== "Escape" && !e.nativeEvent.isComposing) e.stopPropagation();
            }}
            onKeyUp={(e) => {
              if (e.key !== "Escape" && !e.nativeEvent.isComposing) e.stopPropagation();
            }}
            aria-label={t("dictionary.phraseTitleAria")}
            className="plain-word-panel-word plain-word-panel-title-input"
          />
        </div>
        {!phraseValidation.ok && (
          <p className="save-word-error plain-word-panel-title-error">
            {t(phraseValidation.error === "tooManyWords" ? "dictionary.phraseTooManyWords" : "dictionary.phraseTooLong")}
          </p>
        )}
        {neighborWindow.length > 1 && (
          <div className="plain-word-neighbor-row" role="group" aria-label={t("dictionary.phraseNeighborsAria")}>
            {neighborWindow.map(({ token, rel }) => {
              const selected = rel >= selection.min && rel <= selection.max;
              return (
                <button
                  key={rel}
                  type="button"
                  onClick={() => handleNeighborClick(rel)}
                  aria-pressed={selected}
                  className={`plain-word-pos-chip plain-word-neighbor-chip${selected ? " plain-word-pos-chip--selected" : ""}`}
                >
                  {token.text}
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  const videoModifier = surface === "dark" ? " plain-word-panel--video" : "";
  // Той самий набір -on-dark модифікаторів, що вже використовує VideoWordCard
  // (save-word-pill.tsx CSS, globals.css) — тут лише дзеркально застосовані
  // до елементів, які PlainWordPanel малює сама (не через SaveWordButton).
  const savedPillOnDark = surface === "dark" ? " save-word-pill--saved-on-dark" : "";
  const primaryPillOnDark = surface === "dark" ? " save-word-pill--primary-on-dark" : "";
  const removeLinkOnDark = surface === "dark" ? " save-word-remove-link--on-dark" : "";
  const panelClassName = `plain-word-panel${compact ? " plain-word-panel--compact" : ""}${videoModifier}`;

  // justSaved/justRemoved/existing (уже збережене слово) — ОДИН компактний
  // рядок (слово · пілюля · дії), не header/scrollarea/footer-структура
  // форми нижче: тут майже нема чого показувати, а стара структура все
  // одно розтягувала панель на всю ширину/висоту форми (задача-виправлення
  // "compact panel in saved state"). .plain-word-panel--compact-saved
  // (globals.css) перемикає сам .plain-word-panel на flex-ряд із
  // wrap/width:max-content замість flex-колонки на всю висоту обгортки.
  if (justSaved || justRemoved) {
    return (
      <div className={`plain-word-panel plain-word-panel--compact-saved${videoModifier}`} role="region" ref={panelRef} onKeyDown={handleKeyDown} onKeyUp={handleKeyUp}>
        <p className="plain-word-panel-word">{effectiveWord}</p>
        <p className={`save-word-pill save-word-pill--saved save-word-pill--compact${savedPillOnDark}`}>
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

  if (dynamicTeacherItem) {
    const pos = normalizePartOfSpeech(dynamicTeacherItem.partOfSpeech);
    const posLabel = pos ? PART_OF_SPEECH_LABELS_FR[pos] : null;
    const note = dynamicTeacherItem.note?.trim() || null;
    const snapshot: SaveWordSnapshot = {
      word: effectiveWord,
      translation: dynamicTeacherItem.translation,
      translationSource: "teacher",
      partOfSpeech: dynamicTeacherItem.partOfSpeech ?? null,
      note,
      imageUrl: dynamicTeacherItem.image_url ?? null,
      vocabId: dynamicTeacherItem.id ?? null,
      contextFr,
      contextUk,
    };
    return (
      <div className={panelClassName} role="region" ref={panelRef} onKeyDown={handleKeyDown} onKeyUp={handleKeyUp}>
        {renderPhraseHeader()}
        <div className="plain-word-panel-scrollarea">
          <p className="plain-word-panel-translation">{dynamicTeacherItem.translation}</p>
          {posLabel && <p className="plain-word-panel-pos">{posLabel}</p>}
          {note && <p className="plain-word-panel-note">{note}</p>}
        </div>
        <div className="plain-word-panel-footer">
          <div className="flex flex-wrap items-center gap-2">
            <SaveWordButton snapshot={snapshot} variant="pill" surface={surface} />
            <button type="button" onClick={onClose} className="plain-word-panel-cancel">
              {t("dictionary.panelClose")}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (existing) {
    // Рядок 1 — слово + "✓ У словнику"; переклад (якщо студент його
    // вписав) — своїм рядком під ним; ОСТАННІЙ рядок — Прибрати/Закрити
    // РАЗОМ (gap 16px, НІКОЛИ не переноситься між собою — задача-
    // виправлення "saved card actions row and 3s auto-close": раніше всі
    // елементи були в ОДНОМУ flex-wrap рядку, і "Закрити" міг сам
    // зіскочити на другий рядок окремо від пілюлі/"Прибрати"). Частина
    // мови (existingPosLabel у попередній версії) свідомо не показуємо
    // тут — другорядна деталь, яка й так лишається видимою на
    // /cabinet/dictionary. onPointer*/onFocus/onBlur — ставлять 3с-таймер
    // автозакриття (ефект вище) на паузу, поки студент наводить/фокусує/
    // торкається картки.
    return (
      <div
        className={`plain-word-panel plain-word-panel--compact-saved${videoModifier}${closing ? " plain-word-panel--closing" : ""}`}
        role="region"
        ref={panelRef}
        onKeyDown={handleKeyDown}
        onKeyUp={handleKeyUp}
        onPointerEnter={() => setInteracting(true)}
        onPointerLeave={() => setInteracting(false)}
        onPointerDown={() => setInteracting(true)}
        onPointerUp={() => setInteracting(false)}
        onFocus={() => setInteracting(true)}
        onBlur={() => setInteracting(false)}
      >
        {renderPhraseHeader()}
        <div className="plain-word-panel-compact-row">
          <p className={`save-word-pill save-word-pill--saved save-word-pill--compact${savedPillOnDark}`}>{t("dictionary.savedState")}</p>
        </div>
        {existing.translation && (
          <span className="plain-word-panel-compact-translation">{existing.translation}</span>
        )}
        <div className="plain-word-panel-compact-actions">
          <button type="button" onClick={handleRemove} disabled={pending} className={`save-word-remove-link${removeLinkOnDark}`}>
            {t("dictionary.removeAction")}
          </button>
          <button type="button" onClick={onClose} className="plain-word-panel-cancel">
            {t("dictionary.panelClose")}
          </button>
        </div>
        {error && <p className="save-word-error plain-word-panel-compact-error">{t("dictionary.saveError")}</p>}
      </div>
    );
  }

  async function handleSave() {
    if (!phraseValidation.ok) return;
    setSaving(true);
    const result = await saved!.save({
      word: phraseValidation.phrase,
      translation: value.trim() || null,
      translationSource: value.trim() ? "own" : "none",
      contextFr,
      contextUk,
      ...(effectivePartOfSpeech ? { partOfSpeech: effectivePartOfSpeech } : {}),
    });
    setSaving(false);
    if (result.ok) setJustSaved(true);
  }

  return (
    <div className={panelClassName} role="region" ref={panelRef} onKeyDown={handleKeyDown} onKeyUp={handleKeyUp}>
      {renderPhraseHeader()}
      <div className="plain-word-panel-scrollarea">
        {contextUk && <p className="plain-word-panel-context">{t("dictionary.panelLineLabel", { line: contextUk })}</p>}
        <label className="plain-word-panel-label" htmlFor={inputId}>
          {t("dictionary.panelTranslationLabel")}
        </label>
        <input
          id={inputId}
          ref={inputRef}
          type="text"
          value={value}
          maxLength={200}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void handleSave();
            }
            // "Belt and braces" — та сама логіка, що panelRef-обгортки
            // handleKeyDown вище, продубльована прямо на самому полі:
            // клавіатурні скорочення плеєра НІКОЛИ не бачать жодної
            // клавіші, набраної тут (крім Escape — закриває панель через
            // bubbling до handleKeyDown вище).
            if (e.key !== "Escape" && !e.nativeEvent.isComposing) e.stopPropagation();
          }}
          onKeyUp={(e) => {
            if (e.key !== "Escape" && !e.nativeEvent.isComposing) e.stopPropagation();
          }}
          className="plain-word-panel-input"
        />
        <PosChipGroup
          value={effectivePartOfSpeech}
          onChange={setPartOfSpeech}
          groupId={`${inputId}-pos`}
          defaultExpanded={partOfSpeech === null && effectivePartOfSpeech === "phrase"}
        />
      </div>
      <div className="plain-word-panel-footer">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || !phraseValidation.ok}
            className={`save-word-pill save-word-pill--primary${primaryPillOnDark}`}
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
