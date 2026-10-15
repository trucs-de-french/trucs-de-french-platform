"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import type { VocabItem } from "@/lib/vocab";
import { DialogueLine, TranslatedText, splitTranslationSpeaker, normalizeSpeakerForCompare } from "./dialogue-line";
import { STUDENT_TOGGLE_HEADER_BUTTON, STUDENT_BUTTON_SECONDARY_TOUCH } from "@/lib/button-styles";
import { STUDENT_SECTION_HEADING } from "@/lib/typography-styles";
import { H2_TO_CONTENT } from "@/lib/spacing";
import { EXERCISE_BLOCK_CLASS, EXERCISE_BLOCK_SURFACE_CLASS } from "@/components/task-card-style";
import { SectionHeaderBar, SCENE_CARD_CLASS, scrollToHeaderAndFocus } from "@/components/scene-header-bar";

// Шеврон "вгору" для кнопки "Згорнути..." (script-section.tsx/vocab-
// section.tsx) — inline SVG, бо лейбл+іконка мають різний колір штриха
// залежно від варіанту (золото на фоні курсу, currentColor без фону), а
// готові lucide-іконки не параметризують stroke так напряму в одному рядку.
function CollapseChevronIcon({ stroke }: { stroke: string }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 18 18"
      fill="none"
      stroke={stroke}
      strokeWidth="2.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M6 15l6-6 6 6" />
    </svg>
  );
}

// Кнопка "Згорнути..." під вмістом секції — та сама дія, що тогл-заголовок
// (onClick лише викликає переданий колбек, жодного власного стану).
function BottomCollapseButton({
  label,
  onBackground,
  onClick,
}: {
  label: string;
  onBackground: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        onBackground
          ? "scene-collapse-btn"
          : `${STUDENT_BUTTON_SECONDARY_TOUCH} mt-[18px] flex w-full items-center justify-center gap-2`
      }
    >
      <CollapseChevronIcon stroke={onBackground ? "#f6dc8e" : "currentColor"} />
      {label}
    </button>
  );
}

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
export function ScriptSection({
  dialogue,
  title,
  onBackground = false,
}: {
  dialogue: DialogueEntry[];
  title?: string;
  onBackground?: boolean;
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [showTranslation, setShowTranslation] = useState(false);
  const [collapsed, setCollapsed] = useState(true);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasTranslation = dialogue.some((line) => line.translationUk);
  const isOpen = !title || !collapsed;

  // Кнопка "Згорнути скрипт" під вмістом — та сама дія, що тогл-заголовок
  // (нижче), без дубльованого стану: headerToggleRef вказує на АКТУАЛЬНИЙ
  // DOM-вузол тогла (передається в обидва варіанти рендеру нижче — plain
  // button і обидва стани SectionHeaderBar), pendingHeaderFocusRef лише
  // позначає "після цього згортання підвести тогл у вид і сфокусувати".
  const headerToggleRef = useRef<HTMLButtonElement>(null);
  const pendingHeaderFocusRef = useRef(false);

  useEffect(() => {
    if (collapsed && pendingHeaderFocusRef.current) {
      pendingHeaderFocusRef.current = false;
      scrollToHeaderAndFocus(headerToggleRef.current);
    }
  }, [collapsed]);

  function collapseFromBottomButton() {
    pendingHeaderFocusRef.current = true;
    setCollapsed(true);
  }

  // Ім'я спікера показуємо лише на першому рядку "серії" його реплік —
  // далі, поки спікер не змінився, DialogueLine ховає підпис (але лишає
  // місце під нього, див. коментар там). Рахується один раз тут (не в
  // DialogueLine — йому не видно сусідніх рядків).
  const showSpeakerFlags = dialogue.map(
    (line, i) => i === 0 || normalizeSpeakerForCompare(line.speaker) !== normalizeSpeakerForCompare(dialogue[i - 1].speaker)
  );

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

  // Скляний бар (SectionHeaderBar) замінює звичайний тогл-заголовок лише
  // коли є сам заголовок (title — фіксований блок "Скрипт" сторінки сцени,
  // не додаткові script-блоки без title) І активний фон курсу — інакше
  // розмітка/класи нижче лишаються байтово тими самими, що й сьогодні.
  const useBar = Boolean(title) && onBackground;

  const body = isOpen && (
    <div
      className={`script-body flex flex-col gap-2 ${
        useBar
          ? EXERCISE_BLOCK_SURFACE_CLASS
          : `${title ? H2_TO_CONTENT : ""} ${onBackground ? EXERCISE_BLOCK_CLASS : ""}`
      }`}
    >
      {hasTranslation && (
        <button
          type="button"
          onClick={() => setShowTranslation((v) => !v)}
          className="scene-translation-toggle mb-1 self-start"
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
        <div className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
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
                showSpeaker={showSpeakerFlags[i]}
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
            showSpeaker={showSpeakerFlags[i]}
          />
        ))
      )}

      {/* Лише коли є сам заголовок-тогл (title) — "Скрипт", не додаткові
          script-блоки без заголовка (їх і згортати нема чим). Видима лише
          поки секція розгорнута — body сам під isOpen &&, тож додаткова
          умова тут не потрібна. */}
      {title && (
        <BottomCollapseButton label="Згорнути скрипт" onBackground={onBackground} onClick={collapseFromBottomButton} />
      )}
    </div>
  );

  if (useBar) {
    return (
      <div>
        {isOpen ? (
          <div className={SCENE_CARD_CLASS}>
            <SectionHeaderBar
              title={title!}
              attached
              collapsible
              expanded={!collapsed}
              onToggle={() => setCollapsed((c) => !c)}
              toggleRef={headerToggleRef}
            />
            {body}
          </div>
        ) : (
          <SectionHeaderBar
            title={title!}
            attached={false}
            collapsible
            expanded={false}
            onToggle={() => setCollapsed((c) => !c)}
            toggleRef={headerToggleRef}
          />
        )}
      </div>
    );
  }

  return (
    <div>
      {title && (
        <button
          ref={headerToggleRef}
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          className={STUDENT_TOGGLE_HEADER_BUTTON}
        >
          <ChevronDown
            size={18}
            className={`shrink-0 transition-transform ${collapsed ? "" : "rotate-180"}`}
          />
          <h2 className={`student-on-bg ${STUDENT_SECTION_HEADING}`}>{title}</h2>
        </button>
      )}

      {body}
    </div>
  );
}
