"use client";

import type { VocabItem } from "@/lib/vocab";
import { matchVocabInText, matchTranslatedFormInText } from "@/lib/vocab-match";
import { formatTimecode } from "@/lib/format-timecode";
import { normalizePartOfSpeech, PART_OF_SPEECH_LABELS_FR } from "@/lib/vocab-categories";
import { SaveWordButton } from "@/components/dictionary/save-word-button";
import type { SaveWordSnapshot } from "@/components/dictionary/saved-words-provider";

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

export function DialogueLine({
  lineIndex,
  speaker,
  text,
  vocab,
  start,
  videoLink,
  translationUk,
  openId,
  onWordClick,
  showSpeaker = true,
}: {
  lineIndex: number;
  speaker: string;
  text: string;
  vocab: VocabItem[];
  start?: number | null;
  videoLink?: string | null;
  // Переклад репліки (translationUk з scenes.dialogue) — потрібен лише як
  // контекст для снімка збереженого слова (contextUk), саму репліку й без
  // цього пропу вже показує окрема колонка/TranslationCell у
  // script-section.tsx, коли студент тогглить "Показати переклад".
  translationUk?: string | null;
  openId: string | null;
  onWordClick: (id: string) => void;
  // false — та сама репліка спікера, що й на попередньому рядку: ім'я не
  // повторюємо і НЕ лишаємо місця під нього (ні invisible-підпису, ні
  // відступу) — текст починається з лівого краю колонки, як рядок без
  // спікера. Якщо speaker.trim() взагалі порожній — так само нема ні
  // імені, ні двокрапки, ні відступу, незалежно від цього прапорця.
  showSpeaker?: boolean;
}) {
  const parts = matchVocabInText(text, vocab);
  const label = speaker.trim();

  return (
    <p>
      <TimecodeBadge start={start} videoLink={videoLink} />
      {showSpeaker && label && (
        <>
          <span className="font-semibold">{label}:</span>{" "}
        </>
      )}
      {parts.map((part, i) => {
        const id = `${lineIndex}-${i}`;
        return part.type === "match" ? (
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
        ) : (
          <span key={i}>{part.text}</span>
        );
      })}
    </p>
  );
}
