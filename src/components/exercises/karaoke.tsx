"use client";

import { useState, useEffect, useMemo, useRef, useCallback, useSyncExternalStore } from "react";
import type { KaraokePublic, KaraokePublicLine, KaraokeDetail, GradeResult } from "@/lib/exercises/types";
import { useExerciseCheck } from "./use-exercise-check";
import { DEFAULT_INSTRUCTIONS, DEFAULT_TRANSLATION_EN, taskTranslationLine } from "@/lib/exercises/default-instructions";
import { useT } from "@/lib/i18n/context";
import { TaskPanelHeader } from "./task-panel-header";
import { BlockTabs } from "./block-navigation";
import { STUDENT_BUTTON_PRIMARY } from "@/lib/button-styles";
import { DiacriticsPopup, useDiacriticsPopup, insertAtCursor, focusAndSetCursor } from "./diacritics-popup";
import { useYoutubePlayer, YT_PLAYER_STATE } from "@/lib/youtube-player";
import { extractYoutubeId } from "@/lib/video";
import { EXERCISE_STACK } from "@/lib/spacing";
import { TaskResult, rowResultAriaLabel } from "./task-result";
import type { UiLang } from "@/lib/ui/product-lang";
import { headerPointsState } from "@/lib/exercises/header-points";
import { useCheckConfirm, CheckConfirmBar } from "./check-confirm";

const POLL_INTERVAL_MS = 200;
// Останній рядок не має "наступного", що позначив би його кінець — якщо
// після його start ще довго триває музика (інструментал/аутро), вважаємо
// його завершеним через стільки секунд (коротший фінал ловить подія ENDED).
const LAST_LINE_END_FALLBACK_SECONDS = 4;
const PAUSE_PREFERENCE_KEY_PREFIX = "karaoke-pause-";
// Опитування currentTime раз на ~200мс саме по собі занадто неточне для
// паузи "рівно в кінці рядка" (плюс власна затримка YouTube API) — коли до
// межі лишається менше цього вікна, озброюємо ТОЧНИЙ setTimeout (нижче),
// а не чекаємо наступного тіку опитування.
const PAUSE_ARM_WINDOW_SECONDS = 0.5;

// Останній рядок, чий start <= time — не покладається на порядок масиву
// (хоч конструктор і заповнює рядки згори вниз, а значить хронологічно),
// шукає МАКСИМАЛЬНИЙ придатний start явним проходом. Рядки з ОДНАКОВИМ
// start (зокрема кілька 0 на початку, поки вчителька ще не розмітила час) —
// строге "> найкращого" лишає виграним ПЕРШИЙ за індексом, не останній.
function findCurrentLineIndex(lines: { start: number }[], time: number): number {
  let best = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].start > time) continue;
    if (best === -1 || lines[i].start > lines[best].start) {
      best = i;
    }
  }
  return best;
}

type ActiveGap = { li: number; gi: number };

// Скролить ЛИШЕ сам контейнер рядків (container.scrollTo) — ніколи вікно:
// на відміну від Element.scrollIntoView(), яке саме вирішує, якого
// скрольованого предка рухати (і за певних умов — скролить СТОРІНКУ, не
// лише цей контейнер, звідси й баг на мобільному). Рахує зсув через
// getBoundingClientRect обох елементів, не lineEl.offsetTop — коректно
// навіть якщо container має padding/border чи сам не в normal flow.
function scrollLineIntoContainer(container: HTMLElement, lineEl: HTMLElement) {
  const containerRect = container.getBoundingClientRect();
  const lineRect = lineEl.getBoundingClientRect();
  // Рядок уже повністю видимий у контейнері — нічого не робимо; це й
  // покриває випадок "весь список вміщається без скролу" (containerRect
  // завжди вмістить lineRect, якщо scrollHeight <= clientHeight).
  if (lineRect.top >= containerRect.top && lineRect.bottom <= containerRect.bottom) return;
  const delta = lineRect.top + lineRect.height / 2 - (containerRect.top + containerRect.height / 2);
  container.scrollTo({ top: container.scrollTop + delta, behavior: "smooth" });
}

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

// localStorage-backed перемикач паузи, за вправою (ключ включає taskId) —
// useSyncExternalStore, не useState+useEffect: сховище недоступне під час
// SSR, тож "прочитати в ефекті й setState" дало б і hydration mismatch
// (сервер рендерить дефолт із config.pauseOnGap, клієнтський перший рендер —
// уже інше), і саму лінтер-помилку react-hooks/set-state-in-effect (той
// самий принцип, що вже useCollapsedKeys у scene-block-list.tsx).
// sessionFallbackRef — якщо localStorage кидає виняток (приватний режим
// тощо), перемикач і далі працює в межах сесії (не "замерзає" на дефолті),
// просто нічого не переживає перезавантаження сторінки.
function usePausePreference(key: string, defaultValue: boolean) {
  const listenersRef = useRef(new Set<() => void>());
  const sessionFallbackRef = useRef<string | null>(null);

  const subscribe = useCallback((onStoreChange: () => void) => {
    listenersRef.current.add(onStoreChange);
    return () => listenersRef.current.delete(onStoreChange);
  }, []);

  const getSnapshot = useCallback(() => {
    try {
      return window.localStorage.getItem(key);
    } catch {
      return sessionFallbackRef.current;
    }
  }, [key]);

  const getServerSnapshot = useCallback(() => null, []);

  const raw = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const value = raw === null ? defaultValue : raw === "true";

  function setValue(next: boolean) {
    const str = next ? "true" : "false";
    try {
      window.localStorage.setItem(key, str);
    } catch {
      sessionFallbackRef.current = str;
    }
    listenersRef.current.forEach((onStoreChange) => onStoreChange());
  }

  return [value, setValue] as const;
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
  lineState,
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
  lineState: "sung" | "active" | "upcoming";
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
      className={`karaoke-line ${
        lineState === "active" ? "karaoke-line--active" : lineState === "upcoming" ? "karaoke-line--upcoming" : ""
      }`}
    >
      <p className="font-content">
        {line.tokens.map((token, ti) => {
          if (token !== null) return <span key={ti}>{token}</span>;
          const gi = gapIndexByToken[ti];
          const value = answers[gi] ?? "";
          const gapDetail = detail?.gaps[gi];
          const statusClass = gapDetail
            ? gapDetail.isCorrect
              ? "karaoke-gap--correct"
              : "karaoke-gap--wrong"
            : null;

          if (answerMode === "typing") {
            return (
              <input
                key={ti}
                ref={diacritics.fieldRef(`${lineIndex}-${gi}`)}
                value={value}
                placeholder="…"
                onChange={(e) => onTypeAnswer(gi, e.target.value)}
                onFocus={() => diacritics.onFocus(`${lineIndex}-${gi}`)}
                onBlur={diacritics.onBlur}
                onClick={(e) => e.stopPropagation()}
                disabled={disabled}
                className={`karaoke-gap ${statusClass ?? (value ? "karaoke-gap--filled" : "karaoke-gap--upcoming-empty")}`}
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
              className={`karaoke-gap ${
                statusClass ?? (value ? "karaoke-gap--filled" : isActive ? "karaoke-gap--active-empty" : "karaoke-gap--upcoming-empty")
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

// Кругла 22px позначка статусу рядка в лівому "жолобку" панелі "Правильні
// відповіді" (задача "редизайн караоке") — correct/incorrect, та сама
// aria-label-функція, що rowResultAriaLabel (task-result.tsx), уже
// використана для подібних статус-позначок в інших типах вправ (той самий
// принцип, не новий текст).
function KaraokeResultBadge({ correct, lang }: { correct: boolean; lang: UiLang }) {
  return (
    <span
      className={`karaoke-result-badge ${correct ? "karaoke-result-badge--correct" : "karaoke-result-badge--wrong"}`}
      role="img"
      aria-label={rowResultAriaLabel(correct, lang)}
    >
      {correct ? (
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M20 6L9 17l-5-5" />
        </svg>
      ) : (
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M18 6L6 18M6 6l12 12" />
        </svg>
      )}
    </span>
  );
}

// Один рядок пісні в панелі "Правильні відповіді" — ПОВНИЙ текст рядка
// (tokens публічного конфігу, null на місці пропуску), не лише "___" як у
// KaraokeDetail.text (той формат лишається для "Роботи над помилками", не
// чіпається). gi (лічильник пропуску в межах рядка) синхронізується з
// l.gaps за позицією — той самий порядок, що gapTokenIndices при побудові
// detail (grade.ts: gradeKaraoke), тож i-й null у tokens завжди відповідає
// gaps[i]. Токенізація (karaoke.tsx/types.ts: tokens — слова Й
// розділові знаки окремими елементами) вже ізолює слово пропуску від
// прилеглої пунктуації/апострофа (п.5 задачі) — рендер нижче просто
// показує кожен токен як є, нічого додатково не парсить.
function KaraokeResultLine({
  tokens,
  gaps,
  t,
  lang,
}: {
  tokens: (string | null)[];
  gaps: KaraokeDetail["lines"][number]["gaps"];
  t: ReturnType<typeof useT>["t"];
  lang: UiLang;
}) {
  let gi = 0;
  // Рядок без пропусків — null (жолобок лишається порожнім); з пропусками —
  // "неправильний", якщо БОДАЙ ОДИН пропуск неправильний (той самий критерій,
  // що колишній список wrongAnswers.length>0, п.3 задачі — "виправлення
  // помилки: раніше кожен рядок був червоним незалежно від isCorrect").
  const lineCorrect = gaps.length === 0 ? null : gaps.every((g) => g.isCorrect);
  const parts = tokens.map((token, i) => {
    if (token !== null) return <span key={i}>{token}</span>;
    const gap = gaps[gi++];
    if (!gap) return null;
    if (gap.isCorrect) {
      return (
        <span key={i} className="karaoke-result-word karaoke-result-word--correct">
          {gap.correctAnswer}
        </span>
      );
    }
    const studentEmpty = !gap.studentAnswer.trim();
    return (
      <span key={i} className="karaoke-result-gap-inline">
        {studentEmpty ? (
          <span className="karaoke-result-word karaoke-result-word--wrong karaoke-result-word--empty">
            {t("karaoke.emptyAnswerPlaceholder")}
          </span>
        ) : (
          <span className="karaoke-result-word karaoke-result-word--wrong">{gap.studentAnswer}</span>
        )}
        <span className="karaoke-result-arrow">→</span>
        <span className="karaoke-result-word karaoke-result-word--correct">{gap.correctAnswer}</span>
      </span>
    );
  });

  return (
    <div className="karaoke-result-line-row">
      <span className="karaoke-result-gutter">
        {lineCorrect !== null && <KaraokeResultBadge correct={lineCorrect} lang={lang} />}
      </span>
      <span className="karaoke-result-line-text">{parts}</span>
    </div>
  );
}

export function KaraokeExercise({
  taskId,
  config,
  plaqueText,
  onResult,
  hidePoints,
}: {
  taskId: string;
  config: KaraokePublic;
  plaqueText?: string;
  pointsVisible: boolean;
  onResult?: (result: GradeResult) => void;
  hidePoints?: boolean;
}) {
  const { t, lang } = useT();
  const videoId = extractYoutubeId(config.videoUrl);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const linesContainerRef = useRef<HTMLDivElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  // 0, не -1, коли є хоч один рядок — до запуску відео (і поки currentTime
  // не дістався start першого рядка) поточним/прокрученим вважається
  // ПЕРШИЙ рядок, а не "нічого".
  const [currentLineIndex, setCurrentLineIndex] = useState(() => (config.lines.length > 0 ? 0 : -1));
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
  const checkConfirm = useCheckConfirm();
  const filledGaps = answers.reduce((sum, a) => sum + a.filter((v) => v.trim() !== "").length, 0);

  useEffect(() => {
    if (result) onResult?.(result);
  }, [result, onResult]);

  // Студентський перемикач паузи — початково з налаштування вправи
  // (config.pauseOnGap), далі власний вибір студента для ЦІЄЇ вправи
  // (usePausePreference, useSyncExternalStore — вище).
  const [pauseEnabled, setPauseEnabled] = usePausePreference(
    `${PAUSE_PREFERENCE_KEY_PREFIX}${taskId}`,
    config.pauseOnGap
  );

  function togglePauseEnabled() {
    setPauseEnabled(!pauseEnabled);
  }

  // Пауза-в-кінці-рядка — pausedForGapLine (для показу кнопки "▶
  // Продовжити"/підсвітки саме щойно проспіваного рядка) і
  // pausedLineIndicesRef (які рядки вже паузили В ЦЬОМУ проході — рівно
  // раз, доки перемотка назад не озброїть їх знову). previousRawIndexRef —
  // "сира" позиція за часом із МИНУЛОГО тіку опитування, для виявлення
  // перемотки назад незалежно від того, як саме вона сталась (клік по
  // рядку чи скрол у самому плеєрі).
  const [pausedForGapLine, setPausedForGapLine] = useState<number | null>(null);
  const pausedLineIndicesRef = useRef<Set<number>>(new Set());
  const previousRawIndexRef = useRef(-1);
  // Точний таймер паузи — armedForLineRef запам'ятовує, для ЯКОГО рядка вже
  // заплановано setTimeout (щоб не переозброювати його на кожен тік
  // опитування, поки й так у вікні PAUSE_ARM_WINDOW_SECONDS).
  const pauseTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const armedForLineRef = useRef<number | null>(null);

  // useCallback — стабільна ідентичність (лише refs усередині, жодних
  // реактивних залежностей) для обох ефектів нижче, що її використовують.
  const cancelScheduledPause = useCallback(() => {
    if (pauseTimeoutRef.current !== null) {
      clearTimeout(pauseTimeoutRef.current);
      pauseTimeoutRef.current = null;
    }
    armedForLineRef.current = null;
  }, []);

  // Скасування при: паузі (isPlaying стає false → ефект опитування нижче
  // сам чистить таймер у своєму return), перемотці (усередині ефекту й у
  // onSeek рядка), зміні перемикача, анмаунті (тут, окремим ефектом —
  // спрацює незалежно від того, чи взагалі був активний ефект опитування
  // на момент розмонтування).
  useEffect(() => {
    if (!pauseEnabled) cancelScheduledPause();
  }, [pauseEnabled, cancelScheduledPause]);

  useEffect(() => () => cancelScheduledPause(), [cancelScheduledPause]);
  // Завжди свіжі answers всередині setInterval-колбека нижче — сам ефект
  // навмисно НЕ перезапускається на кожну зміну answers (інакше найменше
  // натискання клавіші рвало б інтервал опитування currentTime).
  const answersRef = useRef(answers);
  useEffect(() => {
    answersRef.current = answers;
  });

  const player = useYoutubePlayer({
    videoId,
    containerRef,
    onStateChange: (state) => {
      setIsPlaying(state === YT_PLAYER_STATE.PLAYING);
      // Короткий фінал (останній рядок закінчується разом із відео, без
      // тривалого аутро) — тут ENDED ловить те, що фолбек-таймер нижче міг
      // не встигнути.
      if (state === YT_PLAYER_STATE.ENDED && pauseEnabled) {
        triggerPauseForLine(config.lines.length - 1);
      }
    },
  });

  // Пауза спрацьовує РІВНО РАЗ за прохід через рядок (pausedLineIndicesRef),
  // лише якщо в ньому є незаповнений пропуск — інакше рядок просто
  // пропускається без жодної паузи. useCallback — стабільна ідентичність
  // для ефекту опитування нижче (інакше він перезапускав би interval на
  // кожен рендер без потреби).
  const triggerPauseForLine = useCallback(
    (index: number) => {
      if (index < 0 || pausedLineIndicesRef.current.has(index)) return;
      const lineAnswers = answersRef.current[index] ?? [];
      const firstEmptyGi = lineAnswers.findIndex((v) => !v);
      if (firstEmptyGi === -1) return;

      pausedLineIndicesRef.current.add(index);
      setPausedForGapLine(index);
      player.pause();

      if (config.answerMode === "typing") {
        // preventScroll — фокус на полі пропуску не повинен сам по собі
        // смикати сторінку/контейнер; видимість цього рядка вже забезпечує
        // scrollLineIntoContainer вище (той самий ефект, через
        // pausedForGapLine).
        diacritics.getElement(`${index}-${firstEmptyGi}`)?.focus({ preventScroll: true });
      } else {
        setActiveGap({ li: index, gi: firstEmptyGi });
      }
    },
    [player, config.answerMode, diacritics]
  );

  // Ціль паузи для рядка index — момент відео-часу, на який планується
  // setTimeout: явний end рядка, якщо заданий (конструктор, karaoke-
  // fields.tsx), інакше start наступного рядка, а для останнього рядка без
  // end — старий "віртуальний" запас LAST_LINE_END_FALLBACK_SECONDS.
  const pauseTargetFor = useCallback(
    (index: number): number | undefined => {
      const line = config.lines[index];
      if (!line) return undefined;
      if (line.end !== undefined) return line.end;
      if (index === config.lines.length - 1) return line.start + LAST_LINE_END_FALLBACK_SECONDS;
      return config.lines[index + 1]?.start;
    },
    [config.lines]
  );

  // Опитування currentTime — лише поки відео реально грає, ~200мс. Підсвітка
  // рядка (setCurrentLineIndex) працює із "сирим" індексом (rawIndex), лише
  // замінюючи -1 (ще до start першого рядка) на 0 для показу/скролу.
  //
  // Пауза-в-кінці-рядка — ДВОШАРОВА: (1) основний шлях — щойно до цілі
  // (pauseTargetFor) лишається менше PAUSE_ARM_WINDOW_SECONDS, озброюємо
  // ТОЧНИЙ setTimeout — саме опитування раз на ~200мс недостатньо точне;
  // (2) резервний шлях — стара реактивна перевірка "вже перетнули межу
  // наступного рядка" на випадок, якщо точний таймер з якоїсь причини не
  // встиг озброїтись (напр. пропуск тіку опитування під навантаженою
  // вкладкою).
  useEffect(() => {
    if (!isPlaying) return;
    const id = setInterval(() => {
      const time = player.getCurrentTime();
      const rawIndex = findCurrentLineIndex(config.lines, time);
      const displayIndex = rawIndex === -1 && config.lines.length > 0 ? 0 : rawIndex;
      setCurrentLineIndex((prev) => (prev === displayIndex ? prev : displayIndex));

      if (!pauseEnabled) return;

      // Перемотка назад (клік по рядку чи скрол у самому плеєрі) — знову
      // озброюємо паузи для рядків ПІСЛЯ нової позиції й скасовуємо будь-
      // який запланований точний таймер (він рахований під СТАРУ позицію).
      if (rawIndex < previousRawIndexRef.current) {
        for (const idx of pausedLineIndicesRef.current) {
          if (idx >= rawIndex) pausedLineIndicesRef.current.delete(idx);
        }
        cancelScheduledPause();
      }
      previousRawIndexRef.current = rawIndex;

      if (rawIndex < 0) return;

      if (armedForLineRef.current !== rawIndex && !pausedLineIndicesRef.current.has(rawIndex)) {
        const target = pauseTargetFor(rawIndex);
        if (target !== undefined) {
          const remaining = target - time;
          if (remaining > 0 && remaining <= PAUSE_ARM_WINDOW_SECONDS) {
            armedForLineRef.current = rawIndex;
            const delayMs = Math.max(0, remaining * 1000);
            pauseTimeoutRef.current = setTimeout(() => triggerPauseForLine(rawIndex), delayMs);
          }
        }
      }

      // Резервний, менш точний шлях — на випадок, якщо озброєння вище
      // якось пропустило момент.
      if (rawIndex >= 1) triggerPauseForLine(rawIndex - 1);
      const lastIndex = config.lines.length - 1;
      const lastTarget = pauseTargetFor(lastIndex);
      if (rawIndex === lastIndex && lastTarget !== undefined && time >= lastTarget) {
        triggerPauseForLine(lastIndex);
      }
    }, POLL_INTERVAL_MS);
    return () => {
      clearInterval(id);
      cancelScheduledPause();
    };
  }, [isPlaying, player, config.lines, pauseEnabled, pauseTargetFor, triggerPauseForLine, cancelScheduledPause]);

  // Рядок, що зараз грає — ЄДИНЕ джерело підсвітки й автоскролу (раніше в
  // режимі "вибір" підсвітку перехоплював activeGap.li, через що вона
  // статично сиділа на рядку з першим незаповненим пропуском і ніколи не
  // рухалась услід за відео — це й був баг). Під час паузи-в-кінці-рядка
  // підсвічуємо саме ЩОЙНО ПРОСПІВАНИЙ рядок (pausedForGapLine), не "сиру"
  // позицію за часом, що вже перейшла на наступний.
  const playingLineIndex = pausedForGapLine ?? currentLineIndex;

  // Автоскрол призупиняється на 3с після ручного скролу студента в
  // контейнері рядків — lastManualScrollAtRef пишеться лише в onScroll
  // нижче, АЛЕ той самий onScroll спрацьовує і на НАШ програмний
  // scrollLineIntoContainer (smooth-скрол сам генерує scroll-події) —
  // programmaticScrollUntilRef відмежовує "цей scroll — наш" (ефект ставить
  // його ПЕРЕД викликом, на час, довший за typical smooth-scroll) від
  // реального дотику студента до контейнера.
  const lastManualScrollAtRef = useRef(0);
  const programmaticScrollUntilRef = useRef(0);
  const MANUAL_SCROLL_SUPPRESS_MS = 3000;
  const PROGRAMMATIC_SCROLL_WINDOW_MS = 1000;

  function handleLinesContainerScroll() {
    if (Date.now() < programmaticScrollUntilRef.current) return;
    lastManualScrollAtRef.current = Date.now();
  }

  // Автоскрол лише ВСЕРЕДИНІ linesContainerRef (scrollLineIntoContainer
  // вище), ніколи вікна — scrollIntoView ЗАМІНЕНО саме тому, що воно сам
  // вирішує, якого скрольованого предка рухати, і на мобільному це могло
  // виявитись сторінкою, а не лише h-44-контейнером рядків.
  //
  // mountedRef("перший рендер — нічого не робити") лишається як ДОДАТКОВИЙ
  // бар'єр, але НЕ єдиний: у React StrictMode (dev) ефекти монтування
  // викликаються ДВІЧІ підряд (mount → cleanup → mount) на тому самому
  // рендері — mountedRef.current, виставлений ПЕРШИМ із цих двох викликів,
  // уже true й на ДРУГОМУ, тож прапорець сам по собі не захищає від скролу
  // саме на монтуванні (це й лишало баг живим попри mountedRef у 7502031).
  // Надійний захист — isPlaying/pausedForGapLine: currentLineIndex і
  // pausedForGapLine можуть реально змінитись лише як наслідок відтворення
  // (інтервал опитування нижче існує лише поки isPlaying; pausedForGapLine
  // виставляється лише з нього самого чи з onStateChange ENDED, теж під час
  // відтворення) — на самому монтуванні, і під час паузи без жодної дії,
  // обидва лишаються у стартових значеннях (false/null), тож ефект нічого
  // не скролить незалежно від StrictMode чи кількості викликів.
  const mountedRef = useRef(false);
  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true;
      return;
    }
    if (!isPlaying && pausedForGapLine === null) return;
    if (playingLineIndex < 0) return;
    if (Date.now() - lastManualScrollAtRef.current < MANUAL_SCROLL_SUPPRESS_MS) return;
    const container = linesContainerRef.current;
    const lineEl = lineRefs.current[playingLineIndex];
    if (container && lineEl) {
      programmaticScrollUntilRef.current = Date.now() + PROGRAMMATIC_SCROLL_WINDOW_MS;
      scrollLineIntoContainer(container, lineEl);
    }
  }, [playingLineIndex, isPlaying, pausedForGapLine]);

  // Активний пропуск (лише режим "вибір") слідує за playingLineIndex, не
  // за власним станом вибору студента — спрацьовує ЛИШЕ коли playingLineIndex
  // РЕАЛЬНО змінюється (dep-масив нижче), тож ручний клік по пропуску
  // (onSetActiveGap) не перебивається цим ефектом, доки відео не перейде на
  // інший рядок (цим і забезпечується "ручний вибір перемагає" з задачі).
  // answersRef (вище, уже існує для triggerPauseForLine) — завжди свіжі
  // answers без перезапуску ефекту на кожне натискання клавіші.
  useEffect(() => {
    if (config.answerMode !== "choice") return;
    if (playingLineIndex < 0) return;
    const lines = config.lines;
    const isUnfilled = (li: number, gi: number) => !answersRef.current[li]?.[gi];

    // 1) перший незаповнений пропуск у рядку, що зараз грає.
    const gapCountInLine = lines[playingLineIndex].tokens.filter((t) => t === null).length;
    for (let gi = 0; gi < gapCountInLine; gi++) {
      if (isUnfilled(playingLineIndex, gi)) {
        setActiveGap({ li: playingLineIndex, gi });
        return;
      }
    }
    // 2) немає в цьому рядку — наступний незаповнений ПІСЛЯ нього.
    for (let li = playingLineIndex + 1; li < lines.length; li++) {
      const gapCount = lines[li].tokens.filter((t) => t === null).length;
      for (let gi = 0; gi < gapCount; gi++) {
        if (isUnfilled(li, gi)) {
          setActiveGap({ li, gi });
          return;
        }
      }
    }
    // 3) немає й після — перший незаповнений ПЕРЕД цим рядком.
    for (let li = 0; li < playingLineIndex; li++) {
      const gapCount = lines[li].tokens.filter((t) => t === null).length;
      for (let gi = 0; gi < gapCount; gi++) {
        if (isUnfilled(li, gi)) {
          setActiveGap({ li, gi });
          return;
        }
      }
    }
    // 4) усі пропуски заповнені — лишаємо активний пропуск як є.
  }, [playingLineIndex, config.answerMode, config.lines]);

  // Підсвітка рядка — ЗАВЖДИ рядок, що зараз грає (playingLineIndex), для
  // обох режимів відповіді. Активний пропуск (activeGap, лише в режимі
  // "вибір") має власну підсвітку самого поля (.karaoke-gap--active-empty)
  // і НЕ підсвічує свій рядок цілком — він може бути в іншому рядку, ніж
  // той, що зараз грає (студент ще добирає відповідь у попередньому рядку,
  // поки відео вже перейшло на наступний).
  const highlightLineIndex = playingLineIndex;

  const totalGaps = useMemo(
    () => config.lines.reduce((sum, l) => sum + l.tokens.filter((t) => t === null).length, 0),
    [config.lines]
  );
  const pointsPossibleTotal = config.pointsPerGap * totalGaps;

  // Заповнення пропуску більше НЕ продовжує відео саме — єдиний спосіб
  // продовжити після паузи-в-кінці-рядка — кнопка "▶ Продовжити" нижче
  // (працює незалежно від того, заповнені пропуски чи ні).
  function updateAnswer(li: number, gi: number, value: string) {
    setAnswers((prev) => prev.map((line, idx) => (idx === li ? line.map((v, j) => (j === gi ? value : v)) : line)));
  }

  // Клік по варіанту — заповнює активний пропуск і сам переходить на
  // наступний незаповнений пропуск у ТОМУ Ж рядку (не через усю пісню, як
  // було): якщо рядок уже весь заповнений, лишаємось на ньому — стрибок у
  // інший рядок сам собою робить лише ефект playingLineIndex вище, коли
  // відео реально туди переходить.
  function pickOption(value: string) {
    if (!activeGap) return;
    const { li, gi } = activeGap;
    updateAnswer(li, gi, value);
    const gapCount = config.lines[li].tokens.filter((t) => t === null).length;
    for (let nextGi = gi + 1; nextGi < gapCount; nextGi++) {
      if (!answers[li][nextGi]) {
        setActiveGap({ li, gi: nextGi });
        return;
      }
    }
  }

  // 1-based порядковий номер пропуску {li, gi} серед УСІХ пропусків пісні
  // (наскрізно, не в межах рядка) — для пілюлі "Пропуск N з M".
  function globalGapNumber(li: number, gi: number): number {
    let count = 0;
    for (let i = 0; i < li; i++) count += config.lines[i].tokens.filter((t) => t === null).length;
    return count + gi + 1;
  }

  return (
    <div className={EXERCISE_STACK}>
      <BlockTabs plaqueText={plaqueText} />
      <TaskPanelHeader
        {...(hidePoints
          ? {}
          : headerPointsState(pointsPossibleTotal, result ? result.pointsEarned : undefined, lang))}
        instructionText={config.instructions ?? DEFAULT_INSTRUCTIONS.karaoke.instruction}
        subInstructionText={taskTranslationLine(config.subInstructions, lang, {
          uk: DEFAULT_INSTRUCTIONS.karaoke.subInstruction,
          en: DEFAULT_TRANSLATION_EN.karaoke,
        })}
      />

      {/* Один вертикальний стовпчик на БУДЬ-ЯКій ширині (не md:flex-row, як
          раніше) — відео зверху по центру, обмежене max-w-3xl, під ним —
          вікно тексту тієї самої ширини, під ним — варіанти вибору. */}
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-3">
        {/* Перемикач студента — праворуч над відео. Початковий стан із
            налаштування вправи, далі власний вибір студента (localStorage,
            через togglePauseEnabled вище). */}
        <div className="flex items-center justify-between">
          <span className="text-sm text-[var(--text-muted-caption)] dark:text-[var(--text-muted-caption)]">{t("karaoke.pauseAfterGapLine")}</span>
          <button
            type="button"
            role="switch"
            aria-checked={pauseEnabled}
            onClick={togglePauseEnabled}
            className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand ${
              pauseEnabled ? "bg-brand" : "bg-neutral-300 dark:bg-neutral-600"
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                pauseEnabled ? "translate-x-6" : "translate-x-1"
              }`}
            />
          </button>
        </div>

        <div className="aspect-video w-full overflow-hidden rounded-md bg-black">
          {videoId ? (
            <div ref={containerRef} className="h-full w-full" />
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-neutral-400">
              {t("karaoke.videoUnavailable")}
            </div>
          )}
        </div>

        {/* Єдиний спосіб продовжити після паузи-в-кінці-рядка — активна
            незалежно від того, заповнені пропуски чи ні (можна пропустити
            рядок). */}
        {pausedForGapLine !== null && (
          <button
            type="button"
            onClick={() => {
              player.play();
              cancelScheduledPause();
              setPausedForGapLine(null);
            }}
            className={`self-start ${STUDENT_BUTTON_PRIMARY}`}
          >
            {t("karaoke.continueBtn")}
          </button>
        )}

        {/* ~6-7 рядків висотою (clamp у .karaoke-card, globals.css) —
            власний скрол-контейнер, не сторінка. */}
        <div ref={linesContainerRef} className="karaoke-card" onScroll={handleLinesContainerScroll}>
          {config.lines.map((line, li) => (
            <KaraokeLineRow
              key={li}
              line={line}
              lineIndex={li}
              lineState={li === highlightLineIndex ? "active" : li > highlightLineIndex ? "upcoming" : "sung"}
              answers={answers[li]}
              detail={detail?.lines[li]}
              disabled={!!result}
              answerMode={config.answerMode}
              activeGap={activeGap}
              onSeek={() => {
                // Ручний клік по рядку — той самий "перемотка", що й скрол
                // у самому плеєрі: не тримаємо підсвітку/кнопку продовження
                // прив'язаною до рядка, з якого студент щойно пішов сам, і
                // скасовуємо будь-який запланований точний таймер паузи
                // (рахований під позицію, з якої щойно пішли).
                cancelScheduledPause();
                setPausedForGapLine(null);
                player.seekTo(line.start);
              }}
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
          // mt-0.5 — додає 2px до спадкованого gap-3 (12px) батьківського
          // flex-col, разом 14px до картки з текстом, як просить задача
          // (не чіпаючи сам gap-3, спільний і для інших сусідів вище).
          <div className="mt-0.5 flex flex-col gap-2.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="karaoke-progress-pill">
                {t("karaoke.gapOfTotal", { n: globalGapNumber(activeGap.li, activeGap.gi), total: totalGaps })}
              </span>
              <p className="text-sm text-[#55546b] dark:text-[var(--text-muted-caption)]">{t("karaoke.clickCorrectWord")}</p>
            </div>
            {/* flex-wrap лише як запобіжник, коли варіанти фізично не
                вміщаються в один рядок — сама природа flex-wrap уже дає
                "один рядок, коли влазить" без жодних додаткових умов. */}
            <div className="flex flex-wrap gap-2">
              {(config.lines[activeGap.li].gapOptions?.[activeGap.gi] ?? []).map((opt, i) => (
                <button key={i} type="button" onClick={() => pickOption(opt)} className="karaoke-option-chip">
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

      {/* md:-mt-2 — лише коли щойно над цим блоком рендерились чипи
          (режим "вибір", !result): EXERCISE_STACK (gap-4 md:gap-6) дає тут
          16px моб./24px десктоп, задача просить рівно 16px на обох, тож
          компенсуємо зайві 8px на десктопі саме для цієї пари сусідів, не
          чіпаючи сам спільний EXERCISE_STACK чи інші стани (typing-режим,
          після перевірки). */}
      <div
        className={`flex flex-col gap-3 ${
          config.answerMode === "choice" && activeGap && !result ? "md:-mt-2" : ""
        }`}
      >
        {!result ? (
          <div className="flex flex-col items-start gap-2">
            <button
              type="button"
              onClick={() => checkConfirm.attemptCheck(totalGaps - filledGaps, () => submit(answers))}
              disabled={pending}
              className="karaoke-check-btn btn-check self-start"
            >
              {pending ? t("button.checking") : t("button.check")}
            </button>
            {checkConfirm.confirming && (
              <CheckConfirmBar
                unansweredCount={totalGaps - filledGaps}
                onConfirm={() => checkConfirm.confirmCheck(() => submit(answers))}
                onCancel={checkConfirm.cancelCheck}
              />
            )}
          </div>
        ) : (
          <TaskResult
            correct={result.correct}
            pointsEarned={result.pointsEarned}
            pointsPossible={result.pointsPossible}
            toggleTitle={t("panel.correctAnswers")}
            toggleCount={totalGaps}
          >
            {detail && (
              // Маркер-обгортка лише для СКОУПОВАНОГО :has()-перевизначення
              // padding/заголовка (globals.css) — .task-result-toggle-panel/
              // .task-result-toggle-title-main спільні з 18 іншими типами
              // вправ, тож самі класи тут не чіпаються, лише цей селектор-
              // маркер, що більше ніде не зустрічається.
              <div className="karaoke-result-panel">
                <div className="karaoke-result-lines">
                  {detail.lines.map((l, li) => (
                    <KaraokeResultLine key={li} tokens={config.lines[li].tokens} gaps={l.gaps} t={t} lang={lang} />
                  ))}
                </div>
                <p className="karaoke-result-legend">
                  {t("karaoke.legendCorrect")} · {t("karaoke.legendWrong")}
                </p>
              </div>
            )}
          </TaskResult>
        )}
        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      </div>
    </div>
  );
}
