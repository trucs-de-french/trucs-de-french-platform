"use client";

import type { VocabItem } from "@/lib/vocab";
import { formatTimecode } from "@/lib/format-timecode";

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Спільний будівник для обох напрямків підсвітки — оригінал (за word) і
// переклад (за translatedForm, нижче) — той самий принцип "найдовший
// варіант першим" (щоб довша фраза не "з'їдалась" коротшим словом, що є
// її частиною).
//
// Порожні/пробільні слова відфільтровуються ТУТ, а не покладаються на
// виклик уже відфільтрувати — порожній рядок у альтернативах регулярки
// (напр. vocab-запис {word: ""}, залишений ненавмисно) дає ПОРОЖНЮ групу
// захоплення (new RegExp("()")), яка матчить нульової довжини рядок УСЮДИ
// (між кожною парою символів) — text.split на такому regex розбиває
// репліку по одній літері, і кожен проміжок після цього хибно "знаходить"
// той самий порожній vocab-запис і рендериться як окремий підсвічений
// елемент — саме так репліка "Lumos Maxima" рендерилась літера-за-літерою.
// null — сигнал викликачу, що підсвічувати нічого (замість регулярки, що
// матчить порожній рядок скрізь).
function buildHighlightRegex(words: string[]): RegExp | null {
  const meaningful = words.map((w) => w.trim()).filter((w) => w.length > 0);
  if (meaningful.length === 0) return null;
  const alternatives = [...meaningful].sort((a, b) => b.length - a.length).map(escapeRegExp);
  return new RegExp(`(${alternatives.join("|")})`, "giu");
}

function buildVocabRegex(vocab: VocabItem[]): RegExp | null {
  return buildHighlightRegex(vocab.map((v) => v.word));
}

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
  const withForm = vocab.filter((v) => v.translatedForm?.trim());
  const regex = buildHighlightRegex(withForm.map((v) => v.translatedForm as string));
  if (!regex) return <>{text}</>;

  const parts = text.split(regex);

  return (
    <>
      {parts.map((part, i) => {
        const match = withForm.find((v) => v.translatedForm?.trim().toLowerCase() === part.toLowerCase());
        return match ? (
          <span
            key={i}
            className="mx-0.5 rounded bg-blue-100 px-1 font-medium text-blue-900 dark:bg-blue-900/40 dark:text-blue-200"
          >
            {part}
          </span>
        ) : (
          <span key={i}>{part}</span>
        );
      })}
    </>
  );
}

// Контрольований ззовні (ScriptSection) — сам не тримає стан "показано чи
// ні", щоб клік на інше слово десь-інде на сторінці міг миттєво закрити цей
// переклад (лише одне слово відкрите одночасно на весь скрипт).
function VocabWord({
  id,
  word,
  translation,
  isOpen,
  onClick,
}: {
  id: string;
  word: string;
  translation: string;
  isOpen: boolean;
  onClick: (id: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onClick(id)}
      className="relative mx-0.5 rounded bg-blue-100 px-1 font-medium text-blue-900 hover:bg-blue-200 dark:bg-blue-900/40 dark:text-blue-200 dark:hover:bg-blue-900/60"
    >
      {word}
      {isOpen && (
        <span className="absolute left-1/2 top-full z-10 mt-1 w-max max-w-56 -translate-x-1/2 rounded bg-neutral-900 px-2 py-1 text-xs font-normal text-white shadow dark:bg-neutral-100 dark:text-neutral-900">
          {translation}
        </span>
      )}
    </button>
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
  return <span className="mr-1.5 text-xs font-normal text-neutral-400 dark:text-neutral-500">{label}</span>;
}

export function DialogueLine({
  lineIndex,
  speaker,
  text,
  vocab,
  start,
  videoLink,
  openId,
  onWordClick,
}: {
  lineIndex: number;
  speaker: string;
  text: string;
  vocab: VocabItem[];
  start?: number | null;
  videoLink?: string | null;
  openId: string | null;
  onWordClick: (id: string) => void;
}) {
  const meaningfulVocab = vocab.filter((v) => v.word.trim());
  const regex = buildVocabRegex(meaningfulVocab);

  if (!regex) {
    return (
      <p>
        <TimecodeBadge start={start} videoLink={videoLink} />
        <span className="font-semibold">{speaker}:</span> {text}
      </p>
    );
  }

  const parts = text.split(regex);

  return (
    <p>
      <TimecodeBadge start={start} videoLink={videoLink} />
      <span className="font-semibold">{speaker}:</span>{" "}
      {parts.map((part, i) => {
        const match = meaningfulVocab.find(
          (v) => v.word.toLowerCase() === part.toLowerCase()
        );
        const id = `${lineIndex}-${i}`;
        return match ? (
          <VocabWord
            key={i}
            id={id}
            word={part}
            translation={match.translation}
            isOpen={openId === id}
            onClick={onWordClick}
          />
        ) : (
          <span key={i}>{part}</span>
        );
      })}
    </p>
  );
}
