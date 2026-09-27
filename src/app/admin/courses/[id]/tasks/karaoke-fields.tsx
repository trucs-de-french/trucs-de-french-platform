"use client";

import { forwardRef, useCallback, useImperativeHandle, useEffect, useRef, useState } from "react";
import { Trash2, Play } from "lucide-react";
import type { KaraokeConfig, KaraokeLine } from "@/lib/exercises/types";
import type { TypeSwitchHandle } from "./type-switch-handle";
import { InstructionsRichTextField } from "./instructions-rich-text-field";
import { tokenizeKaraokeLine, isWordToken, normalizeLyricLine } from "@/lib/exercises/karaoke-tokens";
import { formatTime, parseTime, extractLeadingTimeLabel } from "@/lib/exercises/karaoke-time";
import { useYoutubePlayer } from "@/lib/youtube-player";
import { extractYoutubeId } from "@/lib/video";
import { INPUT_BORDER } from "@/lib/input-styles";
import { LABEL_TEXT, HINT_TEXT } from "@/lib/typography-styles";
import { BUTTON_SECONDARY_SM } from "@/lib/button-styles";

type EditableLine = KaraokeLine & { id: string; timeText: string; endTimeText: string };

function emptyLine(): EditableLine {
  return {
    id: crypto.randomUUID(),
    start: 0,
    end: undefined,
    tokens: [],
    gapTokenIndices: [],
    timeText: formatTime(0),
    endTimeText: "",
  };
}

function stripLine(l: EditableLine): KaraokeLine {
  return { start: l.start, end: l.end, tokens: l.tokens, gapTokenIndices: l.gapTokenIndices };
}

// ЧАСОВИЙ ДІАГНОСТИЧНИЙ ЛОГ — прибрати, щойно підтвердиться, що розбір
// міток часу справді працює на реальному тексті з сайтів пісень. Виводить
// коди перших ~10 символів кожного непорожнього рядка ДО нормалізації —
// якщо на КОНКРЕТНОМУ вставленому тексті мітка все одно не розпізнається,
// ці коди покажуть, який саме символ там насправді (консоль браузера,
// F12 → Console).
function logRawLineCharCodes(raw: string) {
  const codes = [...raw.slice(0, 10)].map(
    (ch) => `U+${ch.codePointAt(0)!.toString(16).toUpperCase().padStart(4, "0")}`
  );
  console.log("[karaoke] рядок:", JSON.stringify(raw.slice(0, 20)), "коди:", codes.join(" "));
}

// Один рядок тексту — токени рендеряться інлайн (не flex+gap, як
// letter-gaps-fields.tsx для символів): роздільники (пробіли/пунктуація) —
// уже готові текстові вузли з власним пробілом усередині, звичайний inline-
// потік HTML розставляє їх без додаткової розмітки. Клікабельні — лише
// "словесні" токени (isWordToken), клік перемикає його в/із gapTokenIndices —
// той самий принцип toggle, що letter-gaps-fields.tsx, лише на рівні слова.
function LineTokens({
  tokens,
  gapTokenIndices,
  onToggle,
}: {
  tokens: string[];
  gapTokenIndices: number[];
  onToggle: (tokenIndex: number) => void;
}) {
  return (
    <p className="leading-8">
      {tokens.map((token, i) =>
        isWordToken(token) ? (
          <button
            key={i}
            type="button"
            onClick={() => onToggle(i)}
            title={gapTokenIndices.includes(i) ? "Показати студенту" : "Зробити пропуском"}
            className={`rounded px-0.5 font-content text-base ${
              gapTokenIndices.includes(i)
                ? "bg-amber-100 text-amber-800 underline decoration-2 dark:bg-amber-900/40 dark:text-amber-300"
                : "hover:bg-neutral-100 dark:hover:bg-neutral-800"
            }`}
          >
            {token}
          </button>
        ) : (
          <span key={i} className="font-content text-base">
            {token}
          </span>
        )
      )}
    </p>
  );
}

export const KaraokeFields = forwardRef<
  TypeSwitchHandle<KaraokeConfig>,
  { initialConfig?: Partial<KaraokeConfig> }
>(function KaraokeFields({ initialConfig }, ref) {
  const [videoUrl, setVideoUrl] = useState(initialConfig?.videoUrl ?? "");
  const [pasteText, setPasteText] = useState("");
  const [lines, setLines] = useState<EditableLine[]>(
    initialConfig?.lines?.length
      ? initialConfig.lines.map((l) => ({
          ...l,
          id: crypto.randomUUID(),
          timeText: formatTime(l.start),
          endTimeText: l.end !== undefined ? formatTime(l.end) : "",
        }))
      : []
  );
  const [answerMode, setAnswerMode] = useState<"choice" | "typing">(initialConfig?.answerMode ?? "typing");
  const [pauseOnGap, setPauseOnGap] = useState(initialConfig?.pauseOnGap ?? false);
  const [pointsPerGap, setPointsPerGap] = useState(initialConfig?.pointsPerGap ?? 1);
  // "Зсунути всі часи" — текстовий буфер поля секунд (може бути від'ємним,
  // порожнім чи "-" на півдорозі набору), не комітиться сам по собі —
  // лише за натисканням "Застосувати" (applyShiftAllTimes).
  const [shiftSecondsText, setShiftSecondsText] = useState("0");
  // Розмітка часу пробілом — markingPointer вказує на рядок, що отримає
  // start/end за НАСТУПНЕ затискання/відпускання пробілу. Уже задані часи
  // інших рядків не чіпаються — кожне натискання пише лише в
  // lines[markingPointer].
  const [markingActive, setMarkingActive] = useState(false);
  const [markingPointer, setMarkingPointer] = useState(0);
  // Швидкість відтворення в режимі розмітки — лише для зручності слухати
  // повільніше/швидше; getCurrentTime() у YouTube API документовано
  // повертає РЕАЛЬНИЙ час відео незалежно від playbackRate, тож записаний
  // captureLineStart/captureLineEnd час лишається коректним на будь-якій швидкості.
  const [markingRate, setMarkingRate] = useState(1);

  // Прев'ю-плеєр лише для кнопки "▶" на кожному рядку (перевірити розмітку
  // часу вручну) і режиму розмітки пробілом — та сама обгортка
  // (useYoutubePlayer), що студентський компонент.
  const videoId = extractYoutubeId(videoUrl);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const player = useYoutubePlayer({ videoId, containerRef });
  // Автозупинка прев'ю "▶" рядка на початку наступного — окремий таймер від
  // player (не пов'язаний із розміткою/студентським плеєром).
  const previewStopTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    return () => {
      if (previewStopTimeoutRef.current !== null) clearTimeout(previewStopTimeoutRef.current);
    };
  }, []);

  useImperativeHandle(ref, () => ({
    getValue: () => ({
      instructions: initialConfig?.instructions,
      subInstructions: initialConfig?.subInstructions,
      videoUrl,
      answerMode,
      pauseOnGap,
      pointsPerGap,
      lines: lines.map(stripLine),
    }),
  }));

  // Мітка [m:ss]/[mm:ss.xx]/(m:ss) на самому початку рядка — стає start і
  // прибирається з тексту ДО токенізації (extractLeadingTimeLabel,
  // karaoke-time.ts); рядки без мітки лишаються start=0 для ручного
  // введення, як і раніше. normalizeLyricLine (karaoke-tokens.ts) — ПЕРЕД
  // усім іншим: реальний текст, скопійований із сайтів, часто містить
  // невидимі символи/нестандартні пробіли чи дужки, що інакше зламали б
  // розпізнавання мітки. Рядок, що після прибирання мітки лишився порожнім
  // (сама лише мітка, без слів), пропускається — як і звичайні порожні
  // рядки.
  function linesFromRawText(text: string): EditableLine[] {
    return text
      .split("\n")
      .map((raw) => {
        if (raw.trim().length > 0) logRawLineCharCodes(raw); // ЧАСОВИЙ ЛОГ
        return normalizeLyricLine(raw).trim();
      })
      .filter((raw) => raw.length > 0)
      .map((raw) => {
        const parsed = extractLeadingTimeLabel(raw);
        return { start: parsed?.seconds ?? 0, text: (parsed?.rest ?? raw).trim() };
      })
      .filter(({ text }) => text.length > 0)
      .map(({ start, text }) => ({
        id: crypto.randomUUID(),
        start,
        tokens: tokenizeKaraokeLine(text),
        gapTokenIndices: [],
        timeText: formatTime(start),
        endTimeText: "",
      }));
  }

  function splitIntoLines() {
    setLines(linesFromRawText(pasteText));
  }

  // Автоматичний розбір при вставці — лише коли рядків ЩЕ немає (щоб не
  // загубити вже позначені пропуски й час) і більшість непорожніх рядків
  // вставленого тексту виглядають як мітка часу на початку — типова ознака,
  // що це LRC-подібний текст пісні, а не звичайний вільний ввід.
  function handlePasteText(e: React.ClipboardEvent<HTMLTextAreaElement>) {
    if (lines.length > 0) return;
    const pasted = e.clipboardData.getData("text");
    const rawLines = pasted
      .split("\n")
      .map((raw) => normalizeLyricLine(raw).trim())
      .filter((raw) => raw.length > 0);
    if (rawLines.length === 0) return;

    const withLabel = rawLines.filter((raw) => extractLeadingTimeLabel(raw) !== null).length;
    if (withLabel * 2 > rawLines.length) {
      setLines(linesFromRawText(pasted));
    }
  }

  // Для вже наявних рядків (у т.ч. збережених раніше), де мітка часу лишилась
  // ПРЯМО В ТОКЕНАХ (напр. створені до цієї можливості чи вставлені без
  // автоматичного розбору) — той самий розбір, застосований до вже
  // токенізованого тексту. normalizeLyricLine — на КОЖЕН токен окремо (не
  // на об'єднаний рядок): довжина нормалізованого токена й далі рахується
  // при пошуку межі, тож "скільки токенів прибрати" лишається коректним,
  // навіть якщо нормалізація змінила довжину конкретного токена (напр.
  // прибрала невидимий символ усередині нього). Рядок без мітки на початку
  // не чіпається взагалі; якщо межа мітки все одно не збігається з межею
  // токена — рядок теж лишається як є (безпечніше, ніж обрізати слово
  // навпіл).
  function readTimeFromText() {
    setLines((prev) =>
      prev.map((line) => {
        const normalizedTokens = line.tokens.map(normalizeLyricLine);
        const fullText = normalizedTokens.join("");
        const parsed = extractLeadingTimeLabel(fullText);
        if (!parsed) return line;

        const matchedLength = fullText.length - parsed.rest.length;
        let consumed = 0;
        let removedCount = 0;
        while (removedCount < normalizedTokens.length && consumed < matchedLength) {
          consumed += normalizedTokens[removedCount].length;
          removedCount += 1;
        }
        if (consumed !== matchedLength) return line;

        return {
          ...line,
          start: parsed.seconds,
          timeText: formatTime(parsed.seconds),
          tokens: line.tokens.slice(removedCount),
          gapTokenIndices: line.gapTokenIndices
            .filter((i) => i >= removedCount)
            .map((i) => i - removedCount),
        };
      })
    );
  }

  // Показуємо кнопку не лише коли рядки взагалі є, а коли ХОЧ В ОДНОМУ з них
  // ще лишилась мітка часу на початку (нормалізуємо так само, як сама
  // readTimeFromText — інакше кнопка не з'явилась би саме для тих рядків,
  // де вона найпотрібніша).
  const hasEmbeddedTimeLabel = lines.some(
    (l) => extractLeadingTimeLabel(normalizeLyricLine(l.tokens.join(""))) !== null
  );

  // Час має СУВОРО зростати рядок за рядком — однаковий чи менший за
  // попередній зазвичай означає забутий/помилковий запис при розмітці.
  // Позначаємо саме той рядок, що порушує зростання (не обидва в парі) —
  // студент однаково побачить перший рядок раніше за другий у плеєрі,
  // джерело плутанини саме тут.
  const nonIncreasingLineIds = new Set<string>();
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].start <= lines[i - 1].start) {
      nonIncreasingLineIds.add(lines[i].id);
    }
  }

  // Кінець рядка (якщо заданий) має бути ПІЗНІШЕ за його власний початок —
  // рівний чи менший зазвичай означає помилку розмітки (напр. відпустили
  // пробіл раніше, ніж затиснули).
  const invalidEndLineIds = new Set<string>();
  // Кінець рядка, що заходить ЗА початок наступного — рядки накладаються
  // одне на одного, найімовірніше неточна розмітка (не блокуємо: буває й
  // навмисний легкий нахлест на протяжній ноті).
  const endOverlapLineIds = new Set<string>();
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.end !== undefined && line.end <= line.start) {
      invalidEndLineIds.add(line.id);
    }
    const nextStart = lines[i + 1]?.start;
    if (line.end !== undefined && nextStart !== undefined && line.end > nextStart) {
      endOverlapLineIds.add(line.id);
    }
  }

  function addLine() {
    setLines((prev) => [...prev, emptyLine()]);
  }

  function removeLine(id: string) {
    setLines((prev) => prev.filter((l) => l.id !== id));
  }

  function toggleGap(id: string, tokenIndex: number) {
    setLines((prev) =>
      prev.map((l) => {
        if (l.id !== id) return l;
        const gapTokenIndices = l.gapTokenIndices.includes(tokenIndex)
          ? l.gapTokenIndices.filter((i) => i !== tokenIndex)
          : [...l.gapTokenIndices, tokenIndex].sort((a, b) => a - b);
        return { ...l, gapTokenIndices };
      })
    );
  }

  function updateTimeText(id: string, value: string) {
    setLines((prev) => prev.map((l) => (l.id === id ? { ...l, timeText: value } : l)));
  }

  // Комміт у start — лише на blur (не на кожен keystroke): текстовий буфер
  // timeText лишається вільним для набору "01:1" на півдорозі, не
  // перезаписується форматованим значенням, поки вчителька ще друкує.
  // Невалідний ввід відкочується назад до останнього дійсного start.
  function commitTime(id: string) {
    setLines((prev) =>
      prev.map((l) => {
        if (l.id !== id) return l;
        const parsed = parseTime(l.timeText);
        const start = parsed ?? l.start;
        return { ...l, start, timeText: formatTime(start) };
      })
    );
  }

  function updateEndTimeText(id: string, value: string) {
    setLines((prev) => prev.map((l) => (l.id === id ? { ...l, endTimeText: value } : l)));
  }

  // Порожнє поле на blur — прибирає end (повертає рядок до фолбеку "до
  // start наступного рядка"), той самий принцип відкату невалідного вводу,
  // що commitTime, лише тут "невалідне" включає й порожнє.
  function commitEndTime(id: string) {
    setLines((prev) =>
      prev.map((l) => {
        if (l.id !== id) return l;
        if (l.endTimeText.trim() === "") return { ...l, end: undefined, endTimeText: "" };
        const parsed = parseTime(l.endTimeText);
        const end = parsed ?? l.end;
        return { ...l, end, endTimeText: end !== undefined ? formatTime(end) : "" };
      })
    );
  }

  // Грає від start рядка з ІНДЕКСОМ index і зупиняється рівно на його end
  // (чи, якщо end не задано, на start наступного рядка) — щоб відразу чути,
  // чи рядок починається й закінчується вчасно. Немає ні end, ні
  // наступного рядка (останній без розмітки кінця) — просто грає без
  // автозупинки.
  function playFrom(index: number) {
    if (previewStopTimeoutRef.current !== null) {
      clearTimeout(previewStopTimeoutRef.current);
      previewStopTimeoutRef.current = null;
    }
    const line = lines[index];
    const start = line.start;
    const stopAt = line.end ?? lines[index + 1]?.start;
    player.seekTo(start);
    player.play();
    if (stopAt !== undefined && stopAt > start) {
      previewStopTimeoutRef.current = setTimeout(() => {
        player.pause();
        previewStopTimeoutRef.current = null;
      }, (stopAt - start) * 1000);
    }
  }

  // Додає delta (може бути від'ємним) до start чи end ОДНОГО рядка,
  // затиснуто до 0 знизу — той самий принцип округлення відображення, що
  // commitTime. Нема end — нема чого зсувати (тиша, а не встановлення
  // нового end із нуля).
  function nudgeLineTime(id: string, field: "start" | "end", delta: number) {
    setLines((prev) =>
      prev.map((l) => {
        if (l.id !== id) return l;
        if (field === "start") {
          const start = Math.max(0, l.start + delta);
          return { ...l, start, timeText: formatTime(start) };
        }
        if (l.end === undefined) return l;
        const end = Math.max(0, l.end + delta);
        return { ...l, end, endTimeText: formatTime(end) };
      })
    );
  }

  // Додає одне й те саме значення до start (і до end, якщо заданий) УСІХ
  // рядків одразу — для пісень, де мітки джерела рівномірно зсунуті
  // відносно конкретного відео на YouTube (інший кліп/вставка на початку
  // тощо).
  function applyShiftAllTimes() {
    const delta = Number(shiftSecondsText);
    if (!Number.isFinite(delta) || delta === 0) return;
    setLines((prev) =>
      prev.map((l) => {
        const start = Math.max(0, l.start + delta);
        const end = l.end !== undefined ? Math.max(0, l.end + delta) : undefined;
        return { ...l, start, timeText: formatTime(start), end, endTimeText: end !== undefined ? formatTime(end) : "" };
      })
    );
  }

  function startMarking() {
    if (!videoId || lines.length === 0) return;
    player.seekTo(0);
    player.play();
    setMarkingPointer(0);
    setMarkingActive(true);
  }

  // Затиснути (пробіл або кнопка на екрані) — записати start поточного
  // рядка; відпустити — записати його end і перейти до наступного.
  // markingHoldingRef — чи вже записано start у ЦЬОМУ натисканні (гейт від
  // повторного handleKeyDown при утриманні клавіші й від "відпускання без
  // затискання", напр. якщо фокус змінився під час утримання).
  const markingHoldingRef = useRef(false);

  const stopMarking = useCallback(() => {
    markingHoldingRef.current = false;
    setMarkingActive(false);
  }, []);

  // Швидкість застосовується лише в режимі розмітки — поза ним завжди 1×
  // (звичайне прев'ю "▶" рядка не повинно лишитись пришвидшеним/
  // сповільненим після виходу з розмітки).
  useEffect(() => {
    player.setPlaybackRate(markingActive ? markingRate : 1);
  }, [markingActive, markingRate, player]);

  // useCallback — стабільна ідентичність для ефекту клавіатури нижче.
  const captureLineStart = useCallback(() => {
    if (markingPointer >= lines.length || markingHoldingRef.current) return;
    markingHoldingRef.current = true;
    const time = player.getCurrentTime();
    const index = markingPointer;
    setLines((prev) =>
      prev.map((l, i) => (i === index ? { ...l, start: time, timeText: formatTime(time), end: undefined, endTimeText: "" } : l))
    );
  }, [markingPointer, lines.length, player]);

  const captureLineEnd = useCallback(() => {
    if (!markingHoldingRef.current) return;
    markingHoldingRef.current = false;
    if (markingPointer >= lines.length) return;
    const time = player.getCurrentTime();
    const index = markingPointer;
    setLines((prev) => prev.map((l, i) => (i === index ? { ...l, end: time, endTimeText: formatTime(time) } : l)));
    setMarkingPointer(index + 1);
  }, [markingPointer, lines.length, player]);

  // "Назад" лише пересуває вказівник — наступне затискання перезапише
  // start (і скине end) того рядка (captureLineStart вище). Скидаємо
  // holding, щоб не лишити "підвислий" стан, якщо перемкнулись мідь
  // утримання.
  function markingGoBack() {
    markingHoldingRef.current = false;
    setMarkingPointer((pointer) => Math.max(0, pointer - 1));
  }

  // Пробіл — лише коли фокус НЕ в текстовому полі (щоб не заважати вводу в
  // назву відео/текст пісні/поля часу). event.repeat ігнорується — інакше
  // автоповтор при утриманні клавіші раз у раз перезаписував би start.
  // Esc — вийти з режиму без запису поточного (ще не завершеного) рядка.
  useEffect(() => {
    if (!markingActive) return;

    function isTypingTarget() {
      const active = document.activeElement as HTMLElement | null;
      return active?.tagName === "INPUT" || active?.tagName === "TEXTAREA" || !!active?.isContentEditable;
    }

    function handleKeyDown(e: KeyboardEvent) {
      if (e.code === "Space" && !isTypingTarget()) {
        if (e.repeat) {
          e.preventDefault();
          return;
        }
        e.preventDefault();
        captureLineStart();
      } else if (e.key === "Escape") {
        stopMarking();
      }
    }

    function handleKeyUp(e: KeyboardEvent) {
      if (e.code === "Space" && !isTypingTarget()) {
        e.preventDefault();
        captureLineEnd();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [markingActive, captureLineStart, captureLineEnd, stopMarking]);

  return (
    <div className="flex flex-col gap-3 rounded-md bg-neutral-50 p-3 dark:bg-neutral-900">
      <input type="hidden" name="karaoke_video_url" value={videoUrl} readOnly />
      <input type="hidden" name="karaoke_answer_mode" value={answerMode} readOnly />
      <input type="hidden" name="karaoke_pause_on_gap" value={pauseOnGap ? "true" : "false"} readOnly />
      <input type="hidden" name="karaoke_points_per_gap" value={pointsPerGap} readOnly />
      <input type="hidden" name="karaoke_lines" value={JSON.stringify(lines.map(stripLine))} readOnly />

      <InstructionsRichTextField
        name="karaoke_instructions"
        label="Інструкція для студента"
        initialValue={initialConfig?.instructions ?? ""}
      />
      <InstructionsRichTextField
        name="karaoke_sub_instructions"
        label="Додаткові інструкції (опційно)"
        initialValue={initialConfig?.subInstructions ?? ""}
        compact
      />

      <div className="flex flex-col gap-1">
        <label className={LABEL_TEXT}>Посилання на відео (YouTube)</label>
        <input
          value={videoUrl}
          onChange={(e) => setVideoUrl(e.target.value)}
          placeholder="https://www.youtube.com/watch?v=..."
          className={`${INPUT_BORDER} px-2 py-2 text-sm`}
        />
        {videoUrl && !videoId && (
          <p className="text-xs text-red-600 dark:text-red-400">
            Не вдалося розпізнати YouTube-посилання — перевірте URL.
          </p>
        )}
      </div>

      {videoId && (
        <div className="flex flex-col gap-2">
          <div className="aspect-video w-full max-w-sm overflow-hidden rounded-md bg-black">
            <div ref={containerRef} className="h-full w-full" />
          </div>
          {!markingActive && lines.length > 0 && (
            <button type="button" onClick={startMarking} className={`self-start ${BUTTON_SECONDARY_SM}`}>
              Розмітити час
            </button>
          )}
          {markingActive && (
            <div className="flex items-center gap-1">
              <span className={LABEL_TEXT}>Швидкість:</span>
              {[0.5, 0.75, 1].map((rate) => (
                <button
                  key={rate}
                  type="button"
                  onClick={() => setMarkingRate(rate)}
                  className={`rounded border px-2 py-1 text-xs ${
                    markingRate === rate
                      ? "border-brand bg-brand/10 text-brand"
                      : "border-gray-200 text-neutral-600 dark:border-neutral-700 dark:text-neutral-400"
                  }`}
                >
                  {rate}×
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="flex flex-col gap-1">
        <label className={LABEL_TEXT}>Текст пісні (вставте цілком — розіб&apos;ється на рядки)</label>
        <p className={HINT_TEXT}>
          Якщо в тексті на початку більшості рядків є мітка часу [m:ss] (чи (m:ss)) — рядки з часом
          створяться одразу після вставки, без кнопки нижче.
        </p>
        <textarea
          value={pasteText}
          onChange={(e) => setPasteText(e.target.value)}
          onPaste={handlePasteText}
          rows={6}
          placeholder={"Рядок 1\nРядок 2\n..."}
          className={`${INPUT_BORDER} px-2 py-2 text-sm font-content`}
        />
        <button
          type="button"
          onClick={splitIntoLines}
          disabled={!pasteText.trim()}
          className={`self-start ${BUTTON_SECONDARY_SM}`}
        >
          {lines.length > 0 ? "Замінити рядки нижче текстом вище" : "Розбити на рядки"}
        </button>
        {lines.length > 0 && (
          <p className={HINT_TEXT}>
            Натискання кнопки вище ЗАМІНИТЬ усі рядки нижче (разом із часом і позначеними пропусками).
          </p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <label className={LABEL_TEXT}>Рядки — клік по слову робить його пропуском</label>
          {hasEmbeddedTimeLabel && (
            <button
              type="button"
              onClick={readTimeFromText}
              title="Якщо на початку рядка лишилась мітка [m:ss] — перенести її в поле часу і прибрати з тексту"
              className={BUTTON_SECONDARY_SM}
            >
              Зчитати час із тексту
            </button>
          )}
        </div>

        {hasEmbeddedTimeLabel && (
          <p className="rounded-md bg-amber-50 p-2 text-xs text-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
            ⚠ У тексті є мітки часу — натисніть «Зчитати час із тексту».
          </p>
        )}

        {nonIncreasingLineIds.size > 0 && (
          <p className="rounded-md bg-red-50 p-2 text-xs text-red-800 dark:bg-red-950/30 dark:text-red-300">
            ⚠ Час деяких рядків не зростає (однаковий або менший за попередній) — перевірте поля,
            позначені червоним нижче.
          </p>
        )}

        {invalidEndLineIds.size > 0 && (
          <p className="rounded-md bg-red-50 p-2 text-xs text-red-800 dark:bg-red-950/30 dark:text-red-300">
            ⚠ У деяких рядків «кінець» не пізніше за «початок» — перевірте поля, позначені червоним
            нижче.
          </p>
        )}

        {endOverlapLineIds.size > 0 && (
          <p className="rounded-md bg-amber-50 p-2 text-xs text-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
            ⚠ У деяких рядків «кінець» заходить за початок наступного рядка — перевірте поля,
            позначені жовтим нижче.
          </p>
        )}

        {lines.length > 0 && (
          <div className="flex flex-wrap items-end gap-2 rounded-md bg-white p-2 dark:bg-neutral-800/50">
            <div className="flex flex-col gap-1">
              <label className={LABEL_TEXT}>Зсунути всі часи, с</label>
              <input
                type="number"
                step={0.5}
                value={shiftSecondsText}
                onChange={(e) => setShiftSecondsText(e.target.value)}
                className={`${INPUT_BORDER} w-24 px-2 py-1 text-sm`}
              />
            </div>
            <button type="button" onClick={applyShiftAllTimes} className={BUTTON_SECONDARY_SM}>
              Застосувати
            </button>
            <p className={HINT_TEXT}>Додає значення до start усіх рядків (не менше 0). Може бути від&apos;ємним.</p>
          </div>
        )}

        {markingActive && (
          <div className="flex flex-col gap-2 rounded-md border-2 border-brand bg-brand/5 p-3">
            <p className="text-sm font-medium">
              {markingPointer < lines.length
                ? `Рядок ${markingPointer + 1} з ${lines.length}: ${lines[markingPointer].tokens.join("")}`
                : "Розмітку завершено — усі рядки позначені."}
            </p>
            <p className={HINT_TEXT}>
              Затисніть пробіл, коли рядок починається, і відпустіть, коли він закінчився. Esc — вийти
              без запису для рядка, що ще не позначений.
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={markingGoBack}
                disabled={markingPointer === 0}
                className={BUTTON_SECONDARY_SM}
              >
                ← Назад
              </button>
              <button
                type="button"
                onPointerDown={(e) => {
                  e.preventDefault();
                  captureLineStart();
                }}
                onPointerUp={(e) => {
                  e.preventDefault();
                  captureLineEnd();
                }}
                onPointerLeave={() => {
                  if (markingHoldingRef.current) captureLineEnd();
                }}
                disabled={markingPointer >= lines.length}
                className={BUTTON_SECONDARY_SM}
              >
                Утримуйте, поки звучить рядок
              </button>
              <button type="button" onClick={stopMarking} className={BUTTON_SECONDARY_SM}>
                Завершити
              </button>
            </div>
          </div>
        )}

        {lines.map((line, index) => (
          <div key={line.id} className="flex flex-col gap-1.5 rounded-md border border-gray-100 p-2 dark:border-neutral-700">
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1">
                <span className="text-xs text-neutral-400 dark:text-neutral-500">початок</span>
                <input
                  value={line.timeText}
                  onChange={(e) => updateTimeText(line.id, e.target.value)}
                  onBlur={() => commitTime(line.id)}
                  placeholder="00:00.0"
                  title={
                    nonIncreasingLineIds.has(line.id)
                      ? "Час не зростає порівняно з попереднім рядком"
                      : "Час початку рядка (мм:сс.с)"
                  }
                  className={
                    nonIncreasingLineIds.has(line.id)
                      ? "w-24 rounded-md border border-red-500 bg-red-50 px-2 py-1 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500 dark:border-red-700 dark:bg-red-950/30 dark:text-neutral-100"
                      : `${INPUT_BORDER} w-24 px-2 py-1 text-sm`
                  }
                />
                <div className="flex gap-0.5">
                  <button
                    type="button"
                    onClick={() => nudgeLineTime(line.id, "start", -0.5)}
                    title="−0.5с"
                    className="rounded px-1.5 py-1 text-xs text-neutral-500 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800"
                  >
                    −0.5
                  </button>
                  <button
                    type="button"
                    onClick={() => nudgeLineTime(line.id, "start", 0.5)}
                    title="+0.5с"
                    className="rounded px-1.5 py-1 text-xs text-neutral-500 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800"
                  >
                    +0.5
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-1">
                <span className="text-xs text-neutral-400 dark:text-neutral-500">кінець</span>
                <input
                  value={line.endTimeText}
                  onChange={(e) => updateEndTimeText(line.id, e.target.value)}
                  onBlur={() => commitEndTime(line.id)}
                  placeholder="до наступного"
                  title={
                    invalidEndLineIds.has(line.id)
                      ? "Кінець не пізніше за початок"
                      : endOverlapLineIds.has(line.id)
                        ? "Кінець заходить за початок наступного рядка"
                        : "Час кінця рядка (мм:сс.с) — порожньо: до початку наступного"
                  }
                  className={
                    invalidEndLineIds.has(line.id)
                      ? "w-28 rounded-md border border-red-500 bg-red-50 px-2 py-1 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500 dark:border-red-700 dark:bg-red-950/30 dark:text-neutral-100"
                      : endOverlapLineIds.has(line.id)
                        ? "w-28 rounded-md border border-amber-500 bg-amber-50 px-2 py-1 text-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500 dark:border-amber-700 dark:bg-amber-950/30 dark:text-neutral-100"
                        : `${INPUT_BORDER} w-28 px-2 py-1 text-sm`
                  }
                />
                <div className="flex gap-0.5">
                  <button
                    type="button"
                    onClick={() => nudgeLineTime(line.id, "end", -0.5)}
                    title="−0.5с"
                    className="rounded px-1.5 py-1 text-xs text-neutral-500 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800"
                  >
                    −0.5
                  </button>
                  <button
                    type="button"
                    onClick={() => nudgeLineTime(line.id, "end", 0.5)}
                    title="+0.5с"
                    className="rounded px-1.5 py-1 text-xs text-neutral-500 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800"
                  >
                    +0.5
                  </button>
                </div>
              </div>

              <button
                type="button"
                onClick={() => playFrom(index)}
                disabled={!videoId || !player.isReady}
                aria-label="Відтворити цей рядок від початку до кінця"
                title="Відтворити цей рядок від початку до кінця"
                className="rounded p-1.5 text-neutral-500 hover:bg-neutral-100 disabled:opacity-40 dark:text-neutral-400 dark:hover:bg-neutral-800"
              >
                <Play size={16} />
              </button>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex-1">
                <LineTokens
                  tokens={line.tokens}
                  gapTokenIndices={line.gapTokenIndices}
                  onToggle={(i) => toggleGap(line.id, i)}
                />
              </div>
              <button
                type="button"
                onClick={() => removeLine(line.id)}
                aria-label="Видалити рядок"
                title="Видалити"
                className="rounded p-1.5 text-neutral-400 hover:text-red-600 dark:text-neutral-500 dark:hover:text-red-400"
              >
                <Trash2 size={16} />
              </button>
            </div>
          </div>
        ))}
        <button
          type="button"
          onClick={addLine}
          className="self-start text-xs text-blue-700 hover:underline dark:text-blue-400"
        >
          + рядок
        </button>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <label className={LABEL_TEXT}>Режим відповіді</label>
          <div className="flex gap-1">
            {(
              [
                { mode: "typing" as const, label: "Введення з клавіатури" },
                { mode: "choice" as const, label: "Вибір варіантів" },
              ]
            ).map(({ mode, label }) => (
              <button
                key={mode}
                type="button"
                onClick={() => setAnswerMode(mode)}
                className={`rounded border px-2 py-1 text-xs ${
                  answerMode === mode
                    ? "border-brand bg-brand/10 text-brand"
                    : "border-gray-200 text-neutral-600 dark:border-neutral-700 dark:text-neutral-400"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <label className={`flex items-center gap-1.5 ${LABEL_TEXT}`}>
          <input type="checkbox" checked={pauseOnGap} onChange={(e) => setPauseOnGap(e.target.checked)} />
          Паузи після рядків з пропусками — увімкнено за замовчуванням
        </label>

        <div className="flex flex-col gap-1">
          <label className={LABEL_TEXT}>Бали за пропуск</label>
          <input
            type="number"
            min={0}
            step={0.5}
            value={pointsPerGap}
            onChange={(e) => setPointsPerGap(Number(e.target.value) || 0)}
            className={`${INPUT_BORDER} w-20 px-2 py-1 text-sm`}
          />
        </div>
      </div>
    </div>
  );
});
