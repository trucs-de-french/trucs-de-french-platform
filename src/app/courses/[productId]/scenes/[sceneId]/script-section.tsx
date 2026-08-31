"use client";

import { useEffect, useRef, useState } from "react";
import type { VocabItem } from "@/lib/vocab";
import { DialogueLine } from "./dialogue-line";

type DialogueEntry = {
  speaker: string;
  text: string;
  vocab: VocabItem[];
};

const HIDE_DELAY_MS = 3500;

// Стан "яке слово зараз відкрите" живе тут (не в кожному VocabWord окремо),
// щоб клік на інше слово одразу ховав попередній переклад — на весь скрипт
// одночасно відкрите не більше одного перекладу.
export function ScriptSection({ dialogue }: { dialogue: DialogueEntry[] }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  function openWord(id: string) {
    if (timerRef.current) clearTimeout(timerRef.current);
    setOpenId(id);
    // Той самий виклик і для нового слова, і для повторного кліку на вже
    // відкрите — таймер щоразу стартує заново (не через useEffect від
    // openId, бо React не переzапускає ефект, коли значення state не
    // змінюється, а повторний клік на те саме слово якраз такий випадок).
    timerRef.current = setTimeout(() => setOpenId(null), HIDE_DELAY_MS);
  }

  return (
    <div className="flex flex-col gap-2">
      {dialogue.map((line, i) => (
        <DialogueLine
          key={i}
          lineIndex={i}
          speaker={line.speaker}
          text={line.text}
          vocab={line.vocab ?? []}
          openId={openId}
          onWordClick={openWord}
        />
      ))}
    </div>
  );
}
