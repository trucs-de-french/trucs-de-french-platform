"use client";

import {
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { Play, Pause, Rewind, FastForward, Repeat, Volume2, VolumeX, Maximize, Minimize, Captions } from "lucide-react";
import { parseWebVtt, type WebVttCue } from "@/lib/webvtt";
import { useFullscreenWrapper } from "@/hooks/use-fullscreen-wrapper";
import { Z_MODAL } from "@/lib/z-layers";

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2];
const OVERLAY_HIDE_DELAY_MS = 2500;
const FOCUS_RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#14132b]";

export type VideoSubtitleTrack = { lang: "fr" | "uk"; url: string };
type SubtitlesMode = "fr_uk" | "fr" | "uk" | "off";

// Той самий принцип автопаузи, що audio-player.tsx (модульна змінна "хто
// грає", не React-стан) — лише між екземплярами VideoPlayer, та сама межа,
// що й у AudioPlayer (лише між екземплярами AudioPlayer).
let currentlyPlaying: HTMLVideoElement | null = null;

function stopOthersAndRegister(el: HTMLVideoElement) {
  if (currentlyPlaying && currentlyPlaying !== el) currentlyPlaying.pause();
  currentlyPlaying = el;
}

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function readStoredSpeed(): number {
  try {
    const raw = localStorage.getItem("videoPlayer:speed");
    const n = raw ? Number(raw) : NaN;
    return SPEEDS.includes(n) ? n : 1;
  } catch {
    return 1;
  }
}

function readStoredSubtitlesMode(): SubtitlesMode | null {
  try {
    const raw = localStorage.getItem("videoPlayer:subtitlesMode");
    return raw === "fr_uk" || raw === "fr" || raw === "uk" || raw === "off" ? raw : null;
  } catch {
    return null;
  }
}

// Розкладка репліки на слова-токени (<span data-word>) — поки без жодної
// клікабельної поведінки, лише розмітка під майбутній глосарій (етап 2).
// split(/(\s+)/) лишає пробіли окремими елементами масиву — рендеряться як
// текст, не обгортаються в span.
function renderTokens(text: string, keyPrefix: string) {
  return text
    .replace(/\n+/g, " ")
    .split(/(\s+)/)
    .map((chunk, i) =>
      chunk.trim() === "" ? (
        chunk
      ) : (
        <span key={`${keyPrefix}-${i}`} data-word={chunk}>
          {chunk}
        </span>
      )
    );
}

function findActiveCue(cues: WebVttCue[], time: number): WebVttCue | null {
  for (const cue of cues) {
    if (time >= cue.start && time < cue.end) return cue;
  }
  return null;
}

export function VideoPlayer({
  src,
  subtitles,
  title,
  poster,
  className = "",
}: {
  src: string;
  subtitles?: VideoSubtitleTrack[];
  title?: string;
  poster?: string;
  className?: string;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const speedWrapRef = useRef<HTMLDivElement>(null);
  const speedButtonRef = useRef<HTMLButtonElement>(null);
  const subsWrapRef = useRef<HTMLDivElement>(null);
  const subsButtonRef = useRef<HTMLButtonElement>(null);
  const hideOverlayTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { wrapperRef, isFullscreen, isPseudoFullscreen, toggle: toggleFullscreen } = useFullscreenWrapper();

  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState<number | null>(null);
  const [muted, setMuted] = useState(false);
  // Лазі-ініціалізатор useState, НЕ useEffect (react-hooks/set-state-in-effect
  // проєкту забороняє прямий setState() у тілі ефекту) — той самий підхід,
  // що вже getInitialPosition у theme-toggle.tsx: читається синхронно при
  // першому рендері, на сервері (typeof window === "undefined") — дефолт.
  const [speed, setSpeed] = useState<number>(() => (typeof window === "undefined" ? 1 : readStoredSpeed()));
  const [speedOpen, setSpeedOpen] = useState(false);
  const [subsOpen, setSubsOpen] = useState(false);
  const [loopLine, setLoopLine] = useState(false);
  const [overlayVisible, setOverlayVisible] = useState(true);
  const [loadError, setLoadError] = useState(false);

  const frUrl = subtitles?.find((s) => s.lang === "fr")?.url ?? null;
  const ukUrl = subtitles?.find((s) => s.lang === "uk")?.url ?? null;
  const [frCues, setFrCues] = useState<WebVttCue[] | null>(null);
  const [ukCues, setUkCues] = useState<WebVttCue[] | null>(null);
  const [subtitlesLoadError, setSubtitlesLoadError] = useState(false);
  const hasFr = Boolean(frUrl);
  const hasUk = Boolean(ukUrl);
  // Той самий лазі-підхід, що speed вище — subtitles-пропс відомий уже на
  // першому рендері (не чекає на fetch .vtt), тож початковий режим
  // обчислюється одразу, без ефекту.
  const [mode, setMode] = useState<SubtitlesMode>(() => {
    const stored = typeof window === "undefined" ? null : readStoredSubtitlesMode();
    if (stored === "fr_uk" && hasFr && hasUk) return "fr_uk";
    if (stored === "fr" && hasFr) return "fr";
    if (stored === "uk" && hasUk) return "uk";
    if (stored === "off") return "off";
    return hasFr && hasUk ? "fr_uk" : hasFr ? "fr" : hasUk ? "uk" : "off";
  });

  const lockedCueRef = useRef<WebVttCue | null>(null);
  const lastCueRef = useRef<WebVttCue | null>(null);

  // playbackRate/preservesPitch — ЛИШЕ імперативні DOM-властивості елемента
  // <video> (жодного setState тут), виставляються щоразу, коли сам елемент
  // змонтувався чи швидкість змінилась через меню.
  useEffect(() => {
    if (!videoRef.current) return;
    videoRef.current.playbackRate = speed;
    (videoRef.current as HTMLVideoElement & { preservesPitch?: boolean }).preservesPitch = true;
  }, [speed]);

  useEffect(() => {
    const video = videoRef.current;
    return () => {
      if (video && currentlyPlaying === video) currentlyPlaying = null;
    };
  }, []);

  // Завантаження й парсинг .vtt — лише коли є URL; окремо для FR/UA, провал
  // одного файлу не ламає інший чи саме відео (subtitlesLoadError — лише
  // позначка в кутку). Без гілки "URL відсутній -> setFrCues(null)" —
  // початкове значення вже null (useState вище), а subtitles-пропс
  // практично незмінний протягом життя одного відео.
  useEffect(() => {
    if (!frUrl) return;
    let cancelled = false;
    fetch(frUrl)
      .then((res) => {
        if (!res.ok) throw new Error("fr vtt");
        return res.text();
      })
      .then((text) => {
        if (!cancelled) setFrCues(parseWebVtt(text));
      })
      .catch(() => {
        if (!cancelled) setSubtitlesLoadError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [frUrl]);

  useEffect(() => {
    if (!ukUrl) return;
    let cancelled = false;
    fetch(ukUrl)
      .then((res) => {
        if (!res.ok) throw new Error("uk vtt");
        return res.text();
      })
      .then((text) => {
        if (!cancelled) setUkCues(parseWebVtt(text));
      })
      .catch(() => {
        if (!cancelled) setSubtitlesLoadError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [ukUrl]);

  function changeMode(next: SubtitlesMode) {
    setMode(next);
    setSubsOpen(false);
    try {
      localStorage.setItem("videoPlayer:subtitlesMode", next);
    } catch {
      // localStorage недоступний (приватний режим тощо) — просто без збереження.
    }
  }

  const activeFrCue = frCues ? findActiveCue(frCues, currentTime) : null;
  const activeUkCue = ukCues ? findActiveCue(ukCues, currentTime) : null;
  const showFr = (mode === "fr_uk" || mode === "fr") && activeFrCue;
  const showUk = (mode === "fr_uk" || mode === "uk") && activeUkCue;

  // Репліка для "Повтор репліки" — FR за пріоритетом (якщо є), інакше UA;
  // lastCueRef запам'ятовує ОСТАННЮ активну репліку, щоб toggle увімкнений
  // між репліками (currentTime у проміжку без жодної активної) все одно
  // зафіксував щось сенсовне ("остання відтворена").
  const primaryCues = frCues ?? ukCues;
  const currentPrimaryCue = primaryCues ? findActiveCue(primaryCues, currentTime) : null;
  useEffect(() => {
    if (currentPrimaryCue) lastCueRef.current = currentPrimaryCue;
  }, [currentPrimaryCue]);

  function toggleLoopLine() {
    setLoopLine((v) => {
      const next = !v;
      lockedCueRef.current = next ? currentPrimaryCue ?? lastCueRef.current : null;
      return next;
    });
  }

  const metadataLoaded = duration !== null && Number.isFinite(duration);

  function scheduleOverlayHide() {
    if (hideOverlayTimerRef.current) clearTimeout(hideOverlayTimerRef.current);
    hideOverlayTimerRef.current = setTimeout(() => {
      if (videoRef.current && !videoRef.current.paused) setOverlayVisible(false);
    }, OVERLAY_HIDE_DELAY_MS);
  }

  function wakeOverlay() {
    setOverlayVisible(true);
    scheduleOverlayHide();
  }

  // Коригування стану під час рендеру (React-рекомендований патерн — НЕ
  // useEffect, щоб уникнути react-hooks/set-state-in-effect, той самий
  // підхід, що вже в fill-blank.tsx/true-false.tsx): щойно playing стає
  // false (пауза/кінець відео), оверлей одразу показується знову, без
  // зайвого кадру очікування на ефект.
  const [prevPlaying, setPrevPlaying] = useState(playing);
  if (prevPlaying !== playing) {
    setPrevPlaying(playing);
    if (!playing) setOverlayVisible(true);
  }

  // Сам таймер прибирання оверлею — лише DOM-побічний ефект (setTimeout/
  // clearTimeout), без прямого setState у тілі ефекту (callback всередині
  // setTimeout — асинхронний, не "синхронно в тілі ефекту").
  useEffect(() => {
    if (!playing) {
      if (hideOverlayTimerRef.current) clearTimeout(hideOverlayTimerRef.current);
      return;
    }
    scheduleOverlayHide();
    return () => {
      if (hideOverlayTimerRef.current) clearTimeout(hideOverlayTimerRef.current);
    };
  }, [playing]);

  function togglePlay() {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      stopOthersAndRegister(video);
      void video.play();
    } else {
      video.pause();
    }
  }

  function skip(deltaSeconds: number) {
    const video = videoRef.current;
    if (!video || !metadataLoaded) return;
    video.currentTime = Math.min(Math.max(0, video.currentTime + deltaSeconds), duration!);
    setCurrentTime(video.currentTime);
  }

  function seekToClientX(clientX: number) {
    const video = videoRef.current;
    const track = trackRef.current;
    if (!video || !track || !metadataLoaded) return;
    const rect = track.getBoundingClientRect();
    const pct = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    video.currentTime = pct * duration!;
    setCurrentTime(video.currentTime);
  }

  function handleTrackPointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    if (!metadataLoaded) return;
    seekToClientX(e.clientX);
    trackRef.current?.setPointerCapture(e.pointerId);
    wakeOverlay();
  }

  function handleTrackPointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    if (!metadataLoaded || e.buttons !== 1) return;
    seekToClientX(e.clientX);
  }

  function setRate(rate: number) {
    setSpeed(rate);
    setSpeedOpen(false);
    if (videoRef.current) videoRef.current.playbackRate = rate;
    try {
      localStorage.setItem("videoPlayer:speed", String(rate));
    } catch {
      // без збереження, якщо localStorage недоступний.
    }
  }

  // Закриття меню швидкості/субтитрів кліком поза ним і по Escape — той
  // самий рецепт, що вже в audio-player.tsx.
  useEffect(() => {
    if (!speedOpen && !subsOpen) return;
    function handlePointerDown(e: globalThis.PointerEvent) {
      if (speedOpen && speedWrapRef.current && !speedWrapRef.current.contains(e.target as Node)) {
        setSpeedOpen(false);
      }
      if (subsOpen && subsWrapRef.current && !subsWrapRef.current.contains(e.target as Node)) {
        setSubsOpen(false);
      }
    }
    function handleKeyDown(e: globalThis.KeyboardEvent) {
      if (e.key === "Escape") {
        if (speedOpen) {
          setSpeedOpen(false);
          speedButtonRef.current?.focus();
        }
        if (subsOpen) {
          setSubsOpen(false);
          subsButtonRef.current?.focus();
        }
      }
    }
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [speedOpen, subsOpen]);

  // Пробіл (play/pause) і ←/→ (±5с) — слухач на всій обгортці, спрацьовує
  // незалежно від того, який саме дочірній елемент (смуга, кнопка) у фокусі.
  function handleWrapperKeyDown(e: ReactKeyboardEvent<HTMLDivElement>) {
    if (e.key === " " || e.key === "Spacebar") {
      e.preventDefault();
      togglePlay();
      wakeOverlay();
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      skip(5);
      wakeOverlay();
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      skip(-5);
      wakeOverlay();
    }
  }

  const progress = metadataLoaded && duration! > 0 ? currentTime / duration! : 0;
  const hasAnySubtitles = hasFr || hasUk;
  const subsLabel = mode === "fr_uk" ? "FR+UA" : mode === "fr" ? "FR" : mode === "uk" ? "UA" : "Вимкнено";

  if (loadError) {
    return (
      <div className={`w-full ${className}`}>
        <div
          className="flex aspect-video w-full items-center justify-center rounded-[14px] p-4 text-center"
          style={{ background: "linear-gradient(135deg, #14132b, #2b2a52)" }}
        >
          <p className="text-sm text-[#d6d3ff]">Не вдалося завантажити відео</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`w-full ${className}`}>
      <div
        ref={wrapperRef}
        tabIndex={-1}
        aria-label={title}
        onKeyDown={handleWrapperKeyDown}
        onPointerMove={wakeOverlay}
        onFocus={wakeOverlay}
        className={`relative aspect-video w-full overflow-hidden rounded-[14px] ${
          isPseudoFullscreen ? Z_MODAL : ""
        }`}
        style={{ background: "linear-gradient(135deg, #14132b, #2b2a52)" }}
      >
        <video
          ref={videoRef}
          src={src}
          poster={poster}
          playsInline
          preload="metadata"
          muted={muted}
          className="absolute inset-0 h-full w-full object-contain"
          onClick={() => {
            togglePlay();
            wakeOverlay();
          }}
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onEnded={() => setPlaying(false)}
          onTimeUpdate={(e) => {
            const time = e.currentTarget.currentTime;
            setCurrentTime(time);
            if (loopLine && lockedCueRef.current && time >= lockedCueRef.current.end) {
              e.currentTarget.currentTime = lockedCueRef.current.start;
            }
          }}
          onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
          onError={() => setLoadError(true)}
        />

        {/* rAF-оновлення поточного часу під час відтворення — timeupdate у
            браузерах зазвичай спрацьовує рідше (кожні ~250мс), субтитри й
            "повтор репліки" (точне "до кінця репліки") потребують точнішого
            кроку. */}
        <PlaybackTicker videoRef={videoRef} playing={playing} onTick={setCurrentTime} />

        {hasAnySubtitles && (
          <div
            className={`pointer-events-none absolute inset-x-0 flex flex-col items-center gap-0.5 px-4 text-center transition-all duration-300 ${
              overlayVisible ? "bottom-[92px]" : "bottom-6"
            }`}
          >
            {showFr && activeFrCue && (
              <p
                className="font-heading text-[15px] font-bold text-white sm:text-[18px]"
                style={{ textShadow: "0 1px 4px rgba(0,0,0,0.85)" }}
              >
                {renderTokens(activeFrCue.text, "fr")}
              </p>
            )}
            {showUk && activeUkCue && (
              <p
                className="font-heading text-[12px] font-semibold sm:text-[14px]"
                style={{ color: "#ffd166", textShadow: "0 1px 4px rgba(0,0,0,0.85)" }}
              >
                {renderTokens(activeUkCue.text, "uk")}
              </p>
            )}
          </div>
        )}

        {subtitlesLoadError && (
          <span className="absolute right-2 top-2 rounded bg-black/60 px-2 py-0.5 text-[11px] text-white/90">
            Субтитри недоступні
          </span>
        )}

        {/* Оверлей керування знизу */}
        <div
          className={`absolute inset-x-0 bottom-0 flex flex-col gap-2 transition-opacity duration-300 ${
            overlayVisible ? "opacity-100" : "pointer-events-none opacity-0"
          }`}
          style={{
            background: "linear-gradient(to top, rgba(10,9,30,0.85), transparent)",
            padding: "34px 14px 12px",
          }}
        >
          {/* Рядок 1: час + смуга */}
          <div className="flex items-center gap-2">
            <span className="shrink-0 whitespace-nowrap text-xs tabular-nums text-white/90">
              {metadataLoaded ? formatTime(currentTime) : "0:00"}
            </span>
            <div
              ref={trackRef}
              role="slider"
              tabIndex={0}
              aria-label="Позиція відтворення"
              aria-valuemin={0}
              aria-valuemax={metadataLoaded ? Math.round(duration!) : 0}
              aria-valuenow={Math.round(currentTime)}
              aria-disabled={!metadataLoaded}
              onPointerDown={handleTrackPointerDown}
              onPointerMove={handleTrackPointerMove}
              className={`relative h-1 flex-1 touch-none rounded-full ${FOCUS_RING} ${
                metadataLoaded ? "cursor-pointer" : "cursor-default opacity-60"
              }`}
              style={{ background: "rgba(255,255,255,0.3)" }}
            >
              <div className="absolute inset-y-0 left-0 rounded-full bg-white" style={{ width: `${progress * 100}%` }} />
              <span
                className="absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow"
                style={{ left: `${progress * 100}%` }}
              />
            </div>
            <span className="shrink-0 whitespace-nowrap text-xs tabular-nums text-white/90">
              {metadataLoaded ? formatTime(duration!) : "0:00"}
            </span>
          </div>

          {/* Рядок 2: зліва play/±10с/повтор, справа швидкість/субтитри/mute/fullscreen */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  togglePlay();
                  wakeOverlay();
                }}
                aria-label={playing ? "Пауза" : "Відтворити"}
                aria-pressed={playing}
                className={`flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-full bg-white text-[#4f46e5] ${FOCUS_RING}`}
              >
                {playing ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" />}
              </button>
              <button
                type="button"
                onClick={() => {
                  skip(-10);
                  wakeOverlay();
                }}
                aria-label="Назад на 10 секунд"
                className={`flex h-[34px] w-[34px] items-center justify-center rounded-full text-white ${FOCUS_RING}`}
                style={{ background: "rgba(255,255,255,0.16)" }}
              >
                <Rewind size={16} />
              </button>
              <button
                type="button"
                onClick={() => {
                  skip(10);
                  wakeOverlay();
                }}
                aria-label="Вперед на 10 секунд"
                className={`flex h-[34px] w-[34px] items-center justify-center rounded-full text-white ${FOCUS_RING}`}
                style={{ background: "rgba(255,255,255,0.16)" }}
              >
                <FastForward size={16} />
              </button>
              {hasAnySubtitles && (
                <button
                  type="button"
                  onClick={() => {
                    toggleLoopLine();
                    wakeOverlay();
                  }}
                  aria-label="Повтор репліки"
                  aria-pressed={loopLine}
                  className={`flex h-[34px] w-[34px] items-center justify-center rounded-full transition-colors ${FOCUS_RING} ${
                    loopLine ? "bg-white text-[#4f46e5]" : "text-white"
                  }`}
                  style={!loopLine ? { background: "rgba(255,255,255,0.16)" } : undefined}
                >
                  <Repeat size={16} />
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <div ref={speedWrapRef} className="relative shrink-0">
                <button
                  ref={speedButtonRef}
                  type="button"
                  onClick={() => {
                    setSpeedOpen((v) => !v);
                    setSubsOpen(false);
                    wakeOverlay();
                  }}
                  aria-label={`Швидкість відтворення ${speed}×`}
                  aria-haspopup="menu"
                  aria-expanded={speedOpen}
                  className={`rounded-full border border-white/35 bg-white/10 px-2.5 py-1 text-xs font-semibold text-white ${FOCUS_RING}`}
                >
                  {speed}× ▾
                </button>
                {speedOpen && (
                  <div
                    role="menu"
                    className="absolute bottom-full right-0 z-10 mb-1 flex flex-col rounded-md border border-gray-200 bg-white py-1 shadow-md dark:border-neutral-700 dark:bg-neutral-800"
                  >
                    {SPEEDS.map((s) => (
                      <button
                        key={s}
                        type="button"
                        role="menuitemradio"
                        aria-checked={s === speed}
                        onClick={() => setRate(s)}
                        className={`whitespace-nowrap px-3 py-1 text-left text-xs hover:bg-neutral-50 dark:hover:bg-neutral-700 ${
                          s === speed ? "font-semibold text-brand" : "text-neutral-600 dark:text-neutral-300"
                        }`}
                      >
                        {s}×
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {hasAnySubtitles && (
                <div ref={subsWrapRef} className="relative shrink-0">
                  <button
                    ref={subsButtonRef}
                    type="button"
                    onClick={() => {
                      setSubsOpen((v) => !v);
                      setSpeedOpen(false);
                      wakeOverlay();
                    }}
                    aria-label={`Субтитри: ${subsLabel}`}
                    aria-haspopup="menu"
                    aria-expanded={subsOpen}
                    className={`flex items-center gap-1 rounded-full border border-white/35 bg-white/10 px-2.5 py-1 text-xs font-semibold text-white ${FOCUS_RING}`}
                  >
                    <Captions size={14} />
                    <span className="hidden min-[560px]:inline">{subsLabel}</span>
                  </button>
                  {subsOpen && (
                    <div
                      role="menu"
                      className="absolute bottom-full right-0 z-10 mb-1 flex flex-col rounded-md border border-gray-200 bg-white py-1 shadow-md dark:border-neutral-700 dark:bg-neutral-800"
                    >
                      {hasFr && hasUk && (
                        <SubsMenuItem label="FR+UA" active={mode === "fr_uk"} onClick={() => changeMode("fr_uk")} />
                      )}
                      {hasFr && <SubsMenuItem label="FR" active={mode === "fr"} onClick={() => changeMode("fr")} />}
                      {hasUk && <SubsMenuItem label="UA" active={mode === "uk"} onClick={() => changeMode("uk")} />}
                      <SubsMenuItem label="Вимкнено" active={mode === "off"} onClick={() => changeMode("off")} />
                    </div>
                  )}
                </div>
              )}

              <button
                type="button"
                onClick={() => {
                  setMuted((v) => !v);
                  wakeOverlay();
                }}
                aria-label={muted ? "Увімкнути звук" : "Вимкнути звук"}
                aria-pressed={muted}
                className={`hidden h-[34px] w-[34px] items-center justify-center rounded-full text-white min-[560px]:flex ${FOCUS_RING}`}
                style={{ background: "rgba(255,255,255,0.16)" }}
              >
                {muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
              </button>

              <button
                type="button"
                onClick={() => {
                  void toggleFullscreen();
                  wakeOverlay();
                }}
                aria-label={isFullscreen || isPseudoFullscreen ? "Вийти з повного екрану" : "На весь екран"}
                className={`flex h-[34px] w-[34px] items-center justify-center rounded-full text-white ${FOCUS_RING}`}
                style={{ background: "rgba(255,255,255,0.16)" }}
              >
                {isFullscreen || isPseudoFullscreen ? <Minimize size={16} /> : <Maximize size={16} />}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SubsMenuItem({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      role="menuitemradio"
      aria-checked={active}
      onClick={onClick}
      className={`whitespace-nowrap px-3 py-1 text-left text-xs hover:bg-neutral-50 dark:hover:bg-neutral-700 ${
        active ? "font-semibold text-brand" : "text-neutral-600 dark:text-neutral-300"
      }`}
    >
      {label}
    </button>
  );
}

// requestAnimationFrame-цикл поточного часу відео під час відтворення —
// точніший крок, ніж рідкі timeupdate-події браузера, потрібен для плавних
// субтитрів і точного "до кінця репліки" в "Повторі репліки".
function PlaybackTicker({
  videoRef,
  playing,
  onTick,
}: {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  playing: boolean;
  onTick: (time: number) => void;
}) {
  useEffect(() => {
    if (!playing) return;
    let rafId: number;
    function tick() {
      if (videoRef.current) onTick(videoRef.current.currentTime);
      rafId = requestAnimationFrame(tick);
    }
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [playing, videoRef, onTick]);
  return null;
}
