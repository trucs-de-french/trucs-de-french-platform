"use client";

import type { VocabItem } from "@/lib/vocab";
import { formatTimecode } from "@/lib/format-timecode";

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildVocabRegex(vocab: VocabItem[]) {
  const alternatives = [...vocab]
    .sort((a, b) => b.word.length - a.word.length)
    .map((v) => escapeRegExp(v.word));
  return new RegExp(`(${alternatives.join("|")})`, "giu");
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
  if (vocab.length === 0) {
    return (
      <p>
        <TimecodeBadge start={start} videoLink={videoLink} />
        <span className="font-semibold">{speaker}:</span> {text}
      </p>
    );
  }

  const parts = text.split(buildVocabRegex(vocab));

  return (
    <p>
      <TimecodeBadge start={start} videoLink={videoLink} />
      <span className="font-semibold">{speaker}:</span>{" "}
      {parts.map((part, i) => {
        const match = vocab.find(
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
