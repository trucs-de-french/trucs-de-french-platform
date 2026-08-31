"use client";

import type { VocabItem } from "@/lib/vocab";

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

export function DialogueLine({
  lineIndex,
  speaker,
  text,
  vocab,
  openId,
  onWordClick,
}: {
  lineIndex: number;
  speaker: string;
  text: string;
  vocab: VocabItem[];
  openId: string | null;
  onWordClick: (id: string) => void;
}) {
  if (vocab.length === 0) {
    return (
      <p>
        <span className="font-semibold">{speaker}:</span> {text}
      </p>
    );
  }

  const parts = text.split(buildVocabRegex(vocab));

  return (
    <p>
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
