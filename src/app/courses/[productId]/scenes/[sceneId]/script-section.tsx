"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import type { VocabItem } from "@/lib/vocab";
import { DialogueLine, TranslatedText, splitTranslationSpeaker } from "./dialogue-line";
import { STUDENT_TOGGLE_HEADER_BUTTON } from "@/lib/button-styles";
import { STUDENT_SECTION_HEADING } from "@/lib/typography-styles";

type DialogueEntry = {
  speaker: string;
  text: string;
  vocab: VocabItem[];
  start?: number | null;
  videoLink?: string | null;
  translationUk?: string | null;
};

const HIDE_DELAY_MS = 3500;

// Жирний спікер (розпізнаний усередині самого перекладеного тексту, не
// line.speaker з оригіналу — див. коментар у dialogue-line.tsx) + підсвітка
// слів словника, для яких заповнений translatedForm.
function TranslationCell({ text, vocab }: { text: string; vocab: VocabItem[] }) {
  const { speaker, rest } = splitTranslationSpeaker(text);
  return (
    <p>
      {speaker && <span className="font-semibold">{speaker}:</span>}
      {speaker && " "}
      <TranslatedText text={rest} vocab={vocab} />
    </p>
  );
}

// Стан "яке слово зараз відкрите" живе тут (не в кожному VocabWord окремо),
// щоб клік на інше слово одразу ховав попередній переклад — на весь скрипт
// одночасно відкрите не більше одного перекладу.
//
// title — опційний: переданий лише фіксованим блоком "Скрипт" (сторінка
// сцени), де заголовок стає клікабельним тоглом, згорнутим за замовчуванням.
// Додаткові script-блоки (scene-content-block.tsx) title не передають —
// там і сьогодні немає заголовка студенту, поведінка без змін (завжди
// розгорнуто, без кнопки згортання).
export function ScriptSection({ dialogue, title }: { dialogue: DialogueEntry[]; title?: string }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [showTranslation, setShowTranslation] = useState(false);
  const [collapsed, setCollapsed] = useState(true);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasTranslation = dialogue.some((line) => line.translationUk);
  const isOpen = !title || !collapsed;

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
      {title && (
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          className={STUDENT_TOGGLE_HEADER_BUTTON}
        >
          <ChevronDown
            size={18}
            className={`shrink-0 text-neutral-500 transition-transform dark:text-neutral-400 ${
              collapsed ? "" : "rotate-180"
            }`}
          />
          <h2 className={STUDENT_SECTION_HEADING}>{title}</h2>
        </button>
      )}

      {isOpen && (
        <>
          {hasTranslation && (
            <button
              type="button"
              onClick={() => setShowTranslation((v) => !v)}
              className={`mb-1 self-start rounded-md border border-brand px-3 py-1.5 text-sm shadow-sm transition-colors ${
                showTranslation
                  ? "bg-brand/10 text-brand"
                  : "text-neutral-600 hover:bg-neutral-50 dark:text-neutral-400 dark:hover:bg-neutral-700"
              }`}
            >
              {showTranslation ? "Сховати переклад" : "Показати переклад"}
            </button>
          )}

          {showTranslation ? (
            // Grid, не таблиця: 2 grid-елементи на репліку поспіль (без
            // спільної обгортки-div — вона зламала б авторозкладку по
            // колонках) — grid сам розкладає їх по рядках. sm:grid-cols-2 і
            // ширше — колонки пліч-о-пліч; на вузькому екрані (grid-cols-1)
            // те саме розмічення автоматично складає все послідовно в один
            // стовпець, без окремої мобільної гілки логіки.
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
                  <div className="text-neutral-600 sm:border-l sm:border-gray-100 sm:pl-6 dark:text-neutral-400 sm:dark:border-neutral-700">
                    {line.translationUk ? (
                      <TranslationCell text={line.translationUk} vocab={line.vocab ?? []} />
                    ) : (
                      <span className="italic text-neutral-400 dark:text-neutral-600">—</span>
                    )}
                  </div>
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
        </>
      )}
    </div>
  );
}
