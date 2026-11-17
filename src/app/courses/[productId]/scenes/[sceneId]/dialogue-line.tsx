"use client";

import { useLayoutEffect, useMemo, useRef, useState } from "react";
import type { VocabItem } from "@/lib/vocab";
import { matchVocabInText, matchTranslatedFormInText, buildVariantMap } from "@/lib/vocab-match";
import { formatTimecode } from "@/lib/format-timecode";
import { normalizePartOfSpeech, PART_OF_SPEECH_LABELS_FR } from "@/lib/vocab-categories";
import { extractAlignedContext, findSentenceBounds } from "@/lib/cabinet/saved-words";
import { SaveWordButton } from "@/components/dictionary/save-word-button";
import { useSavedWords, type SaveWordSnapshot } from "@/components/dictionary/saved-words-provider";
import { tokenizePlainText, PlainWordPanel, isClickableWordToken, type PhraseWordToken } from "@/components/dictionary/plain-word-panel";

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
  const wrapperRef = useRef<HTMLSpanElement>(null);
  const tooltipRef = useRef<HTMLSpanElement>(null);
  // Координати кліку (viewport) — щоб вибрати ТОЙ рядок слова, по якому
  // тапнули, коли підсвічена фраза ("mange toujours sur le pouce") сама
  // розбита на 2+ рядки: getBoundingClientRect() wrapperRef дав би union-
  // бокс (ширину ОБОХ рядків), і центр по ньому був би хибним.
  const lastClickPointRef = useRef<{ x: number; y: number } | null>(null);
  // null — ще не виміряно (перший кадр, тултіп невидимий); після
  // useLayoutEffect — реальна локальна left-координата (px, від
  // wrapperRef — того самого .relative, що лишається containing block:
  // жоден предок тут не має overflow:hidden/transform, портал не
  // потрібен) + above/below. top — ЛИШЕ для above (задача-виправлення
  // "render long vocabulary expressions inline": потрібен явний
  // числовий зсув від firstRect, коли фраза сама розбита на 2+ рядки,
  // CSS bottom:100% (globals.css) недостатньо — див. коментар там же);
  // null для below, де декларативний CSS top:100% і далі коректний.
  const [placement, setPlacement] = useState<{ left: number; top: number | null; above: boolean } | null>(null);

  useLayoutEffect(() => {
    if (!isOpen) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPlacement(null);
      return;
    }

    const wrapper = wrapperRef.current;
    const tooltip = tooltipRef.current;
    if (!wrapper || !tooltip) return;

    function reposition() {
      if (!wrapper || !tooltip) return;

      // getClientRects() — один рядок-рект на кожен фрагмент інлайн-
      // елемента, якщо слово/фраза сама розбита на кілька рядків; рект, що
      // містить точку кліку, — анкер для ЦЕНТРУВАННЯ (якщо точка невідома
      // чи не потрапила в жоден рект — перший рядок, той самий дефолт, що
      // просить задача). Для above/below — весь діапазон: below = низ
      // ОСТАННЬОГО рядка, above = верх ПЕРШОГО (тултіп не має перекривати
      // жоден рядок слова).
      const rectList = wrapper.getClientRects();
      const rects = rectList.length > 0 ? Array.from(rectList) : [wrapper.getBoundingClientRect()];
      const point = lastClickPointRef.current;
      const anchorRect =
        (point &&
          rects.find((r) => point.x >= r.left && point.x <= r.right && point.y >= r.top && point.y <= r.bottom)) ??
        rects[0];
      const firstRect = rects[0];
      const lastRect = rects[rects.length - 1];

      const tooltipRect = tooltip.getBoundingClientRect();
      // documentElement.clientWidth (не window.innerWidth) — ігнорує
      // смугу скролу/pinch-zoom, тож clamp не дає хибний запас праворуч
      // на деяких мобільних браузерах.
      const viewportWidth = document.documentElement.clientWidth;
      const viewportHeight = window.visualViewport?.height ?? window.innerHeight;
      const GAP = 8;

      // Центр слова (viewport-координати) -> бажаний лівий край картки,
      // потім clamp так, щоб з обох боків лишалось ≥8px до краю
      // viewport. tooltipRect.width — РЕАЛЬНА поточна ширина після
      // рендеру (ефект перераховує її й при зміні вмісту тултіпа —
      // ResizeObserver нижче — не лише при відкритті), тож clamp не
      // спирається на застарілий, вузькіший за фактичний, вимір. maxLeft
      // може вийти меншим за minLeft лише коли сама картка ширша за
      // viewport-16px — max-width у CSS це вже не допускає, Math.max тут
      // лише захист від'ємного проміжку.
      const wordCenterX = anchorRect.left + anchorRect.width / 2;
      const desiredLeft = wordCenterX - tooltipRect.width / 2;
      const minLeft = GAP;
      const maxLeft = Math.max(GAP, viewportWidth - tooltipRect.width - GAP);
      const clampedViewportLeft = Math.min(Math.max(desiredLeft, minLeft), maxLeft);
      // lastRect (не union-рамка wrapper.getBoundingClientRect()) — задача-
      // виправлення "render long vocabulary expressions inline": тепер, коли
      // wrapper сам може перенестись на 2+ рядки (display:inline, globals.css
      // .vocab-chip), containing block для position:absolute-тултіпа браузер
      // формує за ОСТАННІМ рядком-фрагментом обгортки (той, де тултіп
      // реально йде в потоці), не за union-рамкою getBoundingClientRect()
      // усієї фрази — детальніше в коментарі при .vocab-chip-tooltip.
      const localLeft = clampedViewportLeft - lastRect.left;

      // Сторінка сцени не має жодного fixed-бару знизу (на відміну від
      // мобільного таббара кабінету) — просте порівняння доступного
      // простору знизу/зверху, без додаткового офсету.
      const spaceBelow = viewportHeight - lastRect.bottom;
      const spaceAbove = firstRect.top;
      const above = spaceBelow < tooltipRect.height + GAP && spaceAbove > spaceBelow;
      // below лишається декларативним (CSS top:100%, globals.css — вже
      // збігається з lastRect-containing-block); лише above потребує
      // явного числового top від firstRect — на фразі з 2+ рядків CSS
      // bottom:100% дав би верх ОСТАННЬОГО рядка, а картка має стояти над
      // ПЕРШИМ. Для однорядкового слова firstRect===lastRect, localTop тут
      // виходить тим самим, що й CSS дав би сам — без візуальної різниці.
      const localTop = above ? firstRect.top - tooltipRect.height - GAP - lastRect.top : null;

      setPlacement({ left: localLeft, top: localTop, above });
    }

    reposition();
    window.addEventListener("resize", reposition);
    window.addEventListener("orientationchange", reposition);
    // Вміст тултіпа може змінити РОЗМІР після першого вимірювання (напр.
    // SaveWordButton переходить у стан "✓ У словнику" після збереження) —
    // без цього clamp лишався б рахований проти старої, вужчої ширини.
    const resizeObserver = new ResizeObserver(reposition);
    resizeObserver.observe(tooltip);
    return () => {
      window.removeEventListener("resize", reposition);
      window.removeEventListener("orientationchange", reposition);
      resizeObserver.disconnect();
    };
  }, [isOpen]);

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
    <span className="relative inline" ref={wrapperRef}>
      {/* Задача-виправлення "really render long vocabulary phrases inline":
          БУВ <button> — Chromium-репродукція (поза цим кодом) показала, що
          <button> лишається АТОМАРНИМ інлайн-боксом для розбиття РЯДКА
          (getClientRects() завжди 1 рект, незалежно від display/appearance
          у CSS: text-wrap усередині кнопки працює, але сусідній текст
          ніколи не стає на той самий рядок, що перший/останній рядок самої
          кнопки) — звідси довга фраза йшла ОКРЕМИМ блоком, розриваючи
          речення, навіть після display:inline (46b11b1). <a role="button">
          — СПРАВЖНІЙ інлайновий елемент (getClientRects() повертає N
          ректів, по одному на рядок-фрагмент, перевірено тією ж
          репродукцією) — без href (не навігація), tabIndex={0} —
          фокусується по Tab (href не потрібен для цього), onKeyDown нижче
          дублює Enter/Space, які <button> обробляв нативно. */}
      <a
        role="button"
        tabIndex={0}
        onClick={(e) => {
          lastClickPointRef.current = { x: e.clientX, y: e.clientY };
          onClick(id);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            lastClickPointRef.current = null;
            onClick(id);
          }
        }}
        className="vocab-chip vocab-chip--interactive rounded px-1"
      >
        {displayWord}
      </a>
      {isOpen && (
        <span
          ref={tooltipRef}
          className={`vocab-chip-tooltip ${placement?.above ? "vocab-chip-tooltip--above" : "vocab-chip-tooltip--below"}`}
          style={
            placement
              ? {
                  left: `${placement.left}px`,
                  visibility: "visible",
                  ...(placement.above && placement.top != null ? { top: `${placement.top}px`, bottom: "auto" } : {}),
                }
              : { visibility: "hidden" }
          }
        >
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

  // Абсолютний офсет початку кожної частини (parts) у повному тексті
  // репліки — потрібен, щоб extractAlignedContext знав, у якому РЕЧЕННІ
  // саме лежить клікнуте слово (суцільний прохід, бо parts = text.split()
  // у тому самому порядку, що й у вхідному рядку).
  const partOffsets = useMemo(() => {
    const offsets: number[] = [];
    let acc = 0;
    for (const part of parts) {
      offsets.push(acc);
      acc += part.text.length;
    }
    return offsets;
  }, [parts]);

  // Не useMemo: прохід по невеликому масиву токенів однієї репліки —
  // дешевий на кожен рендер, а повернення об'єкта (text+offset) із useMemo
  // тут не узгоджується з ручною мемоізацією React Compiler (той самий
  // клас хибного зрацювання евристики, що вже описано в
  // task-type-combobox.tsx) — простіше рахувати напряму.
  function findOpenPlainWord(): { text: string; offset: number; partIndex: number } | null {
    if (!openPlainKey || !openPlainKey.startsWith(plainKeyPrefix)) return null;
    for (let i = 0; i < tokenizedTextParts.length; i++) {
      const tokens = tokenizedTextParts[i];
      if (!tokens) continue;
      for (let j = 0; j < tokens.length; j++) {
        const token = tokens[j];
        if (token.type === "word" && token.clickable && `${plainKeyPrefix}${i}-${j}` === openPlainKey) {
          return { text: token.text, offset: partOffsets[i] + token.start, partIndex: i };
        }
      }
    }
    return null;
  }
  const openPlainWord = findOpenPlainWord();

  // Кандидати-сусіди для PlainWordPanel (задача "save multi-word phrase
  // from script and video subtitles") — лише клікабельні word-токени ТІЄЇ
  // Ж PART (між вчительськими збігами) і ТОГО Ж речення, що тапнуте слово
  // (findSentenceBounds — межі речення в межах саме цієї part.text, не
  // всієї репліки: фраза не має перетинати вчительську підсвітку).
  const phrasePlainWord = openPlainWord
    ? (() => {
        const tokens = tokenizedTextParts[openPlainWord.partIndex];
        const partText = parts[openPlainWord.partIndex].text;
        if (!tokens) return null;
        const localOffset = openPlainWord.offset - partOffsets[openPlainWord.partIndex];
        const bounds = findSentenceBounds(partText, localOffset);
        const sentenceTokens: PhraseWordToken[] = tokens
          .filter(isClickableWordToken)
          .filter((tok) => tok.start >= bounds.start && tok.start < bounds.end)
          .map((tok) => ({ text: tok.text, start: tok.start }));
        const centerIndex = sentenceTokens.findIndex((tok) => tok.start === localOffset);
        return { tokens: sentenceTokens, centerIndex, sourceText: partText };
      })()
    : null;

  const content = parts.map((part, i) => {
    if (part.type === "match") {
      const id = `${lineIndex}-${i}`;
      const { contextFr, contextUk } = extractAlignedContext(text, partOffsets[i], translationUk ?? null, part.text);
      return (
        <VocabWord
          key={i}
          id={id}
          displayWord={part.text}
          item={part.item}
          contextFr={contextFr}
          contextUk={contextUk}
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
      {openPlainWord &&
        phrasePlainWord &&
        (() => {
          const { contextFr, contextUk } = extractAlignedContext(
            text,
            openPlainWord.offset,
            translationUk ?? null,
            openPlainWord.text
          );
          return (
            <PlainWordPanel
              key={openPlainKey}
              word={openPlainWord.text}
              contextFr={contextFr}
              contextUk={contextUk}
              phraseTokens={phrasePlainWord.tokens}
              phraseCenterIndex={phrasePlainWord.centerIndex}
              phraseSourceText={phrasePlainWord.sourceText}
              teacherVariantMap={teacherVariantMap}
              inputId={`plain-word-translation-${lineIndex}`}
              onClose={closePlainPanel}
            />
          );
        })()}
    </div>
  );
}
