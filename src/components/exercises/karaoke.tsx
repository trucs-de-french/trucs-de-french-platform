"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import type { KaraokePublic, KaraokePublicLine, KaraokeDetail, GradeResult } from "@/lib/exercises/types";
import { useExerciseCheck } from "./use-exercise-check";
import { DEFAULT_INSTRUCTIONS } from "@/lib/exercises/default-instructions";
import { pluralizePoints } from "@/lib/pluralize-points";
import { sanitizeInstructionsHtml } from "@/lib/sanitize-instructions-html";
import { STUDENT_BUTTON_PRIMARY } from "@/lib/button-styles";
import { DiacriticsPopup, useDiacriticsPopup, insertAtCursor, focusAndSetCursor } from "./diacritics-popup";
import { useYoutubePlayer, YT_PLAYER_STATE } from "@/lib/youtube-player";
import { extractYoutubeId } from "@/lib/video";
import { EXERCISE_INSTRUCTION, EXERCISE_SUBINSTRUCTION } from "@/lib/typography-styles";
import { EXERCISE_STACK } from "@/lib/spacing";

const POLL_INTERVAL_MS = 200;

// Останній рядок, чий start <= time — не покладається на порядок масиву
// (хоч конструктор і заповнює рядки згори вниз, а значить хронологічно),
// шукає МАКСИМАЛЬНИЙ придатний start явним проходом.
function findCurrentLineIndex(lines: { start: number }[], time: number): number {
  let best = -1;
  let bestStart = -Infinity;
  lines.forEach((line, i) => {
    if (line.start <= time && line.start > bestStart) {
      best = i;
      bestStart = line.start;
    }
  });
  return best;
}

type ActiveGap = { li: number; gi: number };

// Module-level, поза компонентом — той самий принцип, що groupChars/
// splitPhraseUnits у letter-gaps.tsx: React Compiler незалежно аналізує й
// мемоізує КОЖЕН компонент, тож мутація let-лічильника між ітераціями
// .map() ВСЕРЕДИНІ компонента (KaraokeLineRow) заборонена; звичайна функція
// поза компонентом такому аналізу не підлягає. -1 на позиціях не-пропусків.
function gapIndexesForTokens(tokens: (string | null)[]): number[] {
  const result: number[] = [];
  let counter = -1;
  for (const t of tokens) {
    if (t === null) counter += 1;
    result.push(t === null ? counter : -1);
  }
  return result;
}

function findFirstGap(lines: KaraokePublicLine[]): ActiveGap | null {
  for (let li = 0; li < lines.length; li++) {
    if (lines[li].tokens.some((t) => t === null)) return { li, gi: 0 };
  }
  return null;
}

// Один рядок тексту — токени рендеряться інлайн (роздільники як текстові
// вузли зі своїм пробілом усередині, той самий принцип, що
// karaoke-fields.tsx). Клік по рядку (крім самого поля/кнопки пропуску,
// stopPropagation) перемотує відео на його початок. Поточний рядок —
// text-lg і ОСНОВНИЙ колір тексту (без явного класу кольору — успадковує
// звичайний foreground, той самий принцип, що "не заданий колір" в інших
// місцях цієї сесії), решта — text-base і приглушені (neutral-500/400) —
// саме розмір/колір, без фонової підсвітки, відрізняє поточний рядок.
function KaraokeLineRow({
  line,
  lineIndex,
  isCurrent,
  answers,
  detail,
  disabled,
  answerMode,
  activeGap,
  onSeek,
  onSetActiveGap,
  onTypeAnswer,
  diacritics,
  lineRef,
}: {
  line: KaraokePublicLine;
  lineIndex: number;
  isCurrent: boolean;
  answers: string[];
  detail?: KaraokeDetail["lines"][number];
  disabled: boolean;
  answerMode: "choice" | "typing";
  activeGap: ActiveGap | null;
  onSeek: () => void;
  onSetActiveGap: (gi: number) => void;
  onTypeAnswer: (gi: number, value: string) => void;
  diacritics: ReturnType<typeof useDiacriticsPopup<string>>;
  lineRef: (el: HTMLDivElement | null) => void;
}) {
  const gapIndexByToken = gapIndexesForTokens(line.tokens);

  return (
    <div
      ref={lineRef}
      onClick={onSeek}
      className="cursor-pointer rounded-md px-2 py-1 transition-colors hover:bg-neutral-50 dark:hover:bg-neutral-800/60"
    >
      <p
        className={`font-content leading-8 ${
          isCurrent ? "text-lg" : "text-base text-neutral-500 dark:text-neutral-400"
        }`}
      >

        {line.tokens.map((token, ti) => {
          if (token !== null) return <span key={ti}>{token}</span>;
          const gi = gapIndexByToken[ti];
          const value = answers[gi] ?? "";
          const gapDetail = detail?.gaps[gi];
          const statusClass = gapDetail
            ? gapDetail.isCorrect
              ? "border-green-500 bg-green-50 dark:bg-green-950/30"
              : "border-red-500 bg-red-50 dark:bg-red-950/30"
            : null;

          if (answerMode === "typing") {
            return (
              <input
                key={ti}
                ref={diacritics.fieldRef(`${lineIndex}-${gi}`)}
                value={value}
                onChange={(e) => onTypeAnswer(gi, e.target.value)}
                onFocus={() => diacritics.onFocus(`${lineIndex}-${gi}`)}
                onBlur={diacritics.onBlur}
                onClick={(e) => e.stopPropagation()}
                disabled={disabled}
                className={`mx-1 w-24 rounded border px-1.5 py-0.5 text-base ${
                  statusClass ?? "border-gray-300 dark:border-neutral-600"
                }`}
              />
            );
          }

          const isActive = activeGap?.li === lineIndex && activeGap?.gi === gi;
          return (
            <button
              key={ti}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (!disabled) onSetActiveGap(gi);
              }}
              disabled={disabled}
              className={`mx-1 min-w-12 rounded border px-2 py-0.5 text-base ${
                statusClass ?? (isActive ? "border-brand bg-brand/10" : "border-dashed border-gray-300 dark:border-neutral-600")
              }`}
            >
              {value || "…"}
            </button>
          );
        })}
      </p>
    </div>
  );
}

export function KaraokeExercise({
  taskId,
  config,
  pointsVisible,
  onResult,
  hidePoints,
}: {
  taskId: string;
  config: KaraokePublic;
  pointsVisible: boolean;
  onResult?: (result: GradeResult) => void;
  hidePoints?: boolean;
}) {
  const videoId = extractYoutubeId(config.videoUrl);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const player = useYoutubePlayer({
    videoId,
    containerRef,
    onStateChange: (state) => setIsPlaying(state === YT_PLAYER_STATE.PLAYING),
  });

  const [currentLineIndex, setCurrentLineIndex] = useState(-1);
  const [answers, setAnswers] = useState<string[][]>(() =>
    config.lines.map((l) => Array(l.tokens.filter((t) => t === null).length).fill(""))
  );
  // Лише для режиму "вибір" — який саме пропуск зараз показує варіанти під
  // текстом. За замовчуванням — перший пропуск пісні (усі відповіді ще
  // порожні на момент першого рендеру, тож найпростіше й коректно завжди).
  const [activeGap, setActiveGap] = useState<ActiveGap | null>(() =>
    config.answerMode === "choice" ? findFirstGap(config.lines) : null
  );
  const diacritics = useDiacriticsPopup<string>();
  const { submit, pending, result, error } = useExerciseCheck(taskId);
  const detail = result?.detail as KaraokeDetail | undefined;
  const lineRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    if (result) onResult?.(result);
  }, [result, onResult]);

  // Опитування currentTime — лише поки відео реально грає, ~200мс: досить
  // часто для плавної підсвітки поточного рядка без зайвого навантаження.
  useEffect(() => {
    if (!isPlaying) return;
    const id = setInterval(() => {
      const time = player.getCurrentTime();
      const index = findCurrentLineIndex(config.lines, time);
      setCurrentLineIndex((prev) => (prev === index ? prev : index));
    }, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [isPlaying, player, config.lines]);

  // Автоскрол у ВЛАСНОМУ контейнері тексту (overflow-y-auto нижче), не
  // сторінки — scrollIntoView скролить найближчого overflow-предка, той
  // самий принцип, що вже застосований для сітки філворда/легенди
  // вокабуляру раніше в цій сесії.
  useEffect(() => {
    if (currentLineIndex < 0) return;
    lineRefs.current[currentLineIndex]?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [currentLineIndex]);

  const totalGaps = useMemo(
    () => config.lines.reduce((sum, l) => sum + l.tokens.filter((t) => t === null).length, 0),
    [config.lines]
  );
  const pointsPossibleTotal = config.pointsPerGap * totalGaps;

  function updateAnswer(li: number, gi: number, value: string) {
    setAnswers((prev) => prev.map((line, idx) => (idx === li ? line.map((v, j) => (j === gi ? value : v)) : line)));
  }

  // Клік по варіанту — заповнює активний пропуск і сам переходить на
  // наступний незаповнений (наскрізно через усю пісню, не лише в межах
  // рядка), щоб студенту не треба було щоразу клікати сам пропуск заново.
  function pickOption(value: string) {
    if (!activeGap) return;
    const { li, gi } = activeGap;
    updateAnswer(li, gi, value);
    setActiveGap(findNextEmptyGap(li, gi));
  }

  function findNextEmptyGap(afterLi: number, afterGi: number): ActiveGap | null {
    for (let li = afterLi; li < config.lines.length; li++) {
      const gapCount = config.lines[li].tokens.filter((t) => t === null).length;
      const startGi = li === afterLi ? afterGi + 1 : 0;
      for (let gi = startGi; gi < gapCount; gi++) {
        if (!answers[li][gi]) return { li, gi };
      }
    }
    return null;
  }

  return (
    <div className={EXERCISE_STACK}>
      <div>
        <div className="flex flex-wrap items-baseline gap-2">
          <div
            className={`instruction-text ${EXERCISE_INSTRUCTION}`}
            dangerouslySetInnerHTML={{
              __html: sanitizeInstructionsHtml(config.instructions ?? DEFAULT_INSTRUCTIONS.karaoke),
            }}
          />
          {!hidePoints && (pointsVisible || detail) && (
            <span className="text-xs font-normal italic text-neutral-500 dark:text-neutral-400">
              {detail
                ? `${result?.pointsEarned ?? 0}/${result?.pointsPossible ?? pointsPossibleTotal} ${pluralizePoints(
                    result?.pointsPossible ?? pointsPossibleTotal
                  )}`
                : `${pointsPossibleTotal} ${pluralizePoints(pointsPossibleTotal)}`}
            </span>
          )}
        </div>
        {config.subInstructions && (
          <div
            className={`mt-1 ${EXERCISE_SUBINSTRUCTION}`}
            dangerouslySetInnerHTML={{ __html: sanitizeInstructionsHtml(config.subInstructions) }}
          />
        )}
      </div>

      {/* Один вертикальний стовпчик на БУДЬ-ЯКій ширині (не md:flex-row, як
          раніше) — відео зверху по центру, обмежене max-w-3xl, під ним —
          вікно тексту тієї самої ширини, під ним — варіанти вибору. */}
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-3">
        <div className="aspect-video w-full overflow-hidden rounded-md bg-black">
          {videoId ? (
            <div ref={containerRef} className="h-full w-full" />
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-neutral-400">
              Відео недоступне
            </div>
          )}
        </div>

        {/* ~5-6 рядків висотою (leading-8=2rem на рядок) — власний
            скрол-контейнер, не сторінка. */}
        <div className="flex h-44 flex-col gap-1 overflow-y-auto">
          {config.lines.map((line, li) => (
            <KaraokeLineRow
              key={li}
              line={line}
              lineIndex={li}
              isCurrent={li === currentLineIndex}
              answers={answers[li]}
              detail={detail?.lines[li]}
              disabled={!!result}
              answerMode={config.answerMode}
              activeGap={activeGap}
              onSeek={() => player.seekTo(line.start)}
              onSetActiveGap={(gi) => setActiveGap({ li, gi })}
              onTypeAnswer={(gi, value) => updateAnswer(li, gi, value)}
              diacritics={diacritics}
              lineRef={(el) => {
                lineRefs.current[li] = el;
              }}
            />
          ))}
        </div>

        {config.answerMode === "choice" && activeGap && !result && (
          <div className="flex flex-col gap-2">
            <p className="text-sm text-neutral-500 dark:text-neutral-400">Оберіть слово для пропуску</p>
            {/* flex-wrap лише як запобіжник, коли варіанти фізично не
                вміщаються в один рядок — сама природа flex-wrap уже дає
                "один рядок, коли влазить" без жодних додаткових умов. */}
            <div className="flex flex-wrap gap-2">
              {(config.lines[activeGap.li].gapOptions?.[activeGap.gi] ?? []).map((opt, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => pickOption(opt)}
                  className="rounded-xl border-2 border-brand/30 bg-white px-4 py-2 text-base transition hover:border-brand hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand dark:bg-neutral-800 shadow-sm"
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {config.answerMode === "typing" && diacritics.rect && !result && diacritics.activeKey && (
        <DiacriticsPopup
          rect={diacritics.rect}
          onPick={(ch) => {
            const [liText, giText] = diacritics.activeKey!.split("-");
            const li = Number(liText);
            const gi = Number(giText);
            const el = diacritics.getElement(`${li}-${gi}`);
            const { value, cursor } = insertAtCursor(el, answers[li][gi], ch);
            updateAnswer(li, gi, value);
            focusAndSetCursor(el, cursor);
          }}
        />
      )}

      {detail && (
        <ul className="flex flex-col gap-1 text-sm">
          {detail.lines.flatMap((l, li) =>
            l.gaps.map((g, gi) =>
              g.isCorrect ? null : (
                <li key={`${li}-${gi}`} className="text-red-600 dark:text-red-400">
                  Рядок {li + 1}, пропуск {gi + 1}: правильно — {g.correctAnswer}
                </li>
              )
            )
          )}
        </ul>
      )}

      <div className="flex flex-col gap-3">
        {!result ? (
          <button
            type="button"
            onClick={() => submit(answers)}
            disabled={pending}
            className={`self-start ${STUDENT_BUTTON_PRIMARY}`}
          >
            {pending ? "Перевіряю..." : "Перевірити"}
          </button>
        ) : (
          <p
            className={`text-sm font-medium ${
              result.correct ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
            }`}
          >
            {result.correct ? "Правильно! ✓" : `Результат: ${result.score}%`}
            {result.pointsPossible !== undefined && (
              <span className="ml-2 font-normal text-neutral-500 dark:text-neutral-400">
                ({result.pointsEarned} з {result.pointsPossible} {pluralizePoints(result.pointsPossible)})
              </span>
            )}
          </p>
        )}
        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      </div>
    </div>
  );
}
