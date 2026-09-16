"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import type { VocabItem } from "@/lib/vocab";
import { DialogueLine } from "./dialogue-line";

type DialogueEntry = {
  speaker: string;
  text: string;
  vocab: VocabItem[];
  start?: number | null;
  videoLink?: string | null;
  translationUk?: string | null;
};

const HIDE_DELAY_MS = 3500;

// Стан "яке слово зараз відкрите" живе тут (не в кожному VocabWord окремо),
// щоб клік на інше слово одразу ховав попередній переклад — на весь скрипт
// одночасно відкрите не більше одного перекладу.
export function ScriptSection({ dialogue }: { dialogue: DialogueEntry[] }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [showTranslation, setShowTranslation] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasTranslation = dialogue.some((line) => line.translationUk);

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
      {hasTranslation && (
        <label className="mb-1 flex items-center gap-2 self-start text-sm text-neutral-600 dark:text-neutral-400">
          <input
            type="checkbox"
            checked={showTranslation}
            onChange={(e) => setShowTranslation(e.target.checked)}
          />
          Показати переклад
        </label>
      )}

      {showTranslation ? (
        // Grid, не таблиця: 2 grid-елементи на репліку поспіль (без
        // спільної обгортки-div — вона зламала б авторозкладку по колонках)
        // — grid сам розкладає їх по рядках. sm:grid-cols-2 і ширше — колонки
        // пліч-о-пліч; на вузькому екрані (grid-cols-1) те саме розмічення
        // автоматично складає все послідовно в один стовпець, без окремої
        // мобільної гілки логіки.
        <div className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
          {dialogue.map((line, i) => (
            <Fragment key={i}>
              <DialogueLine
                lineIndex={i}
                speaker={line.speaker}
                text={line.text}
                vocab={line.vocab ?? []}
                start={line.start}
                videoLink={line.videoLink}
                openId={openId}
                onWordClick={openWord}
              />
              <p className="text-neutral-600 sm:border-l sm:border-gray-100 sm:pl-6 dark:text-neutral-400 sm:dark:border-neutral-700">
                {line.translationUk || (
                  <span className="italic text-neutral-400 dark:text-neutral-600">—</span>
                )}
              </p>
            </Fragment>
          ))}
        </div>
      ) : (
        dialogue.map((line, i) => (
          <DialogueLine
            key={i}
            lineIndex={i}
            speaker={line.speaker}
            text={line.text}
            vocab={line.vocab ?? []}
            start={line.start}
            videoLink={line.videoLink}
            openId={openId}
            onWordClick={openWord}
          />
        ))
      )}
    </div>
  );
}
