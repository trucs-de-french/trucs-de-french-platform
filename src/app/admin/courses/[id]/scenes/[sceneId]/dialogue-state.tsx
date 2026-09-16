"use client";

import { createContext, useContext, useState, type Dispatch, type ReactNode, type SetStateAction } from "react";
import type { VocabItem } from "@/lib/vocab";

export type Line = {
  speaker: string;
  text: string;
  vocab: VocabItem[];
  start?: number | null;
  end?: number | null;
  videoLink?: string | null;
  translationUk?: string | null;
};

type DialogueState = {
  lines: Line[];
  setLines: Dispatch<SetStateAction<Line[]>>;
  updateVocab: (
    lineIndex: number,
    vocabIndex: number,
    field: "word" | "translation" | "image_url" | "translatedForm",
    value: string
  ) => void;
  removeVocab: (lineIndex: number, vocabIndex: number) => void;
};

const DialogueStateContext = createContext<DialogueState | null>(null);

// Один Provider = один незалежний dialogue у пам'яті. Навколо кожного
// DialogueEditor — свій власний Provider (та сама ізоляція, що раніше давав
// локальний useState), КРІМ головного "Скрипту" сцени — там Provider
// навмисно піднятий вище (обгортає SceneBlockList), щоб VocabTable, який
// рендериться в іншій картці/позиції, читав і писав той самий lines-стан
// (спільне збереження через форму "Скрипт", без окремої кнопки/race між
// двома незалежними знімками одного dialogue).
export function DialogueStateProvider({
  initialDialogue,
  children,
}: {
  initialDialogue: Line[];
  children: ReactNode;
}) {
  const [lines, setLines] = useState<Line[]>(initialDialogue);

  function updateVocab(
    lineIndex: number,
    vocabIndex: number,
    field: "word" | "translation" | "image_url" | "translatedForm",
    value: string
  ) {
    setLines((prev) =>
      prev.map((line, idx) =>
        idx === lineIndex
          ? {
              ...line,
              vocab: line.vocab.map((v, vidx) => (vidx === vocabIndex ? { ...v, [field]: value } : v)),
            }
          : line
      )
    );
  }

  function removeVocab(lineIndex: number, vocabIndex: number) {
    setLines((prev) =>
      prev.map((line, idx) =>
        idx === lineIndex ? { ...line, vocab: line.vocab.filter((_, vidx) => vidx !== vocabIndex) } : line
      )
    );
  }

  return (
    <DialogueStateContext.Provider value={{ lines, setLines, updateVocab, removeVocab }}>
      {children}
    </DialogueStateContext.Provider>
  );
}

export function useDialogueState(): DialogueState {
  const ctx = useContext(DialogueStateContext);
  if (!ctx) throw new Error("useDialogueState має викликатись усередині DialogueStateProvider");
  return ctx;
}
