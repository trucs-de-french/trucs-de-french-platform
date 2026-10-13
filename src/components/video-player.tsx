"use client";

import {
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import {
  Play,
  Pause,
  Rewind,
  FastForward,
  Repeat,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  Captions,
  Turtle,
} from "lucide-react";
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
  const overlayRef = useRef<HTMLDivElement>(null);
  const { wrapperRef, isFullscreen, isPseudoFullscreen, toggle: toggleFullscreen } = useFullscreenWrapper();

  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState<number | null>(null);
  const [muted, setMuted] = useState(false);
  // Реальна висота оверлея керування (не константа — ряди переносяться на
  // вузьких екранах, висота плаває) — субтитри піднімаються рівно на цю
  // висоту + 8px, щоб ніколи не перекриватись кнопками.
  const [overlayHeight, setOverlayHeight] = useState(0);
  // Висота самого контейнера плеєра — потрібна лише для обмеження max-height
  // меню, що розкриваються вгору (щоб не вилазили за верхній край контейнера
  // з overflow-hidden). Вимірюється так само через ResizeObserver, а не
  // читанням wrapperRef.current напряму в тілі рендеру (react-hooks/refs
  // забороняє доступ до .current під час рендеру).
  const [containerHeight, setContainerHeight] = useState(0);
  // Завжди фіксований дефолт на першому рендері (сервер і клієнт мають
  // збігатись) — збережену швидкість із localStorage застосовуємо лише
  // ПІСЛЯ монтування, в ефекті нижче. Раніше лазі-ініціалізатор читав
  // localStorage напряму тут — на клієнті першим рендером міг вийти інший
  // speed, ніж на сервері (SSR завжди бачив дефолт), і React лаявся на
  // hydration mismatch (aria-pressed кнопки "Повільно" true/false).
  const [speed, setSpeed] = useState<number>(1);
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
  // Той самий принцип, що speed вище: початковий режим рахується лише з
  // subtitles-пропса (той самий і на сервері, і на клієнті) — без читання
  // localStorage тут, щоб перший клієнтський рендер збігався з SSR.
  // Збережений режим застосовується після монтування в ефекті нижче.
  const [mode, setMode] = useState<SubtitlesMode>(() =>
    hasFr && hasUk ? "fr_uk" : hasFr ? "fr" : hasUk ? "uk" : "off"
  );

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

  // Відновлення збережених speed/mode з localStorage — ЛИШЕ після
  // монтування (не в ініціалізаторі useState вище), щоб перший рендер на
  // клієнті збігався з SSR. setSpeed тут лише оновлює state — застосування
  // до самого <video> (playbackRate/preservesPitch) бере на себе ефект
  // вище, що й так реагує на зміну speed.
  useEffect(() => {
    // queueMicrotask — той самий прийом, що вже в save-form.tsx: без нього
    // react-hooks/set-state-in-effect проєкту забороняє прямий синхронний
    // setState() у тілі ефекту (навіть одноразового, deps: []).
    queueMicrotask(() => {
      const storedSpeed = readStoredSpeed();
      setSpeed((current) => (storedSpeed !== current ? storedSpeed : current));

      const storedMode = readStoredSubtitlesMode();
      setMode((current) => {
        if (storedMode === "fr_uk" && hasFr && hasUk) return "fr_uk";
        if (storedMode === "fr" && hasFr) return "fr";
        if (storedMode === "uk" && hasUk) return "uk";
        if (storedMode === "off") return "off";
        return current;
      });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    return () => {
      if (video && currentlyPlaying === video) currentlyPlaying = null;
    };
  }, []);

  // Реальна висота оверлея (ResizeObserver, не константа) — рядок кнопок
  // переноситься на вузьких екранах, фіксоване число розійшлося б із
  // фактичною висотою й або лишало зазор, або субтитри перекривались би.
  useEffect(() => {
    const overlay = overlayRef.current;
    if (!overlay) return;
    const observer = new ResizeObserver((entries) => {
      const height = entries[0]?.contentRect.height;
      if (height !== undefined) setOverlayHeight(height);
    });
    observer.observe(overlay);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;
    const observer = new ResizeObserver((entries) => {
      const height = entries[0]?.contentRect.height;
      if (height !== undefined) setContainerHeight(height);
    });
    observer.observe(wrapper);
    return () => observer.disconnect();
  }, [wrapperRef]);

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

  // Той самий ярлик, що toggleSlow у phonetics-audio-player.tsx — без
  // окремого стану, активність виводиться напряму з speed.
  function toggleSlow() {
    setRate(speed === 0.75 ? 1 : 0.75);
  }

  // Orientation lock — лише локально тут, НЕ в самому useFullscreenWrapper:
  // хук свідомо без нього (коментар у use-fullscreen-wrapper.ts — форсований
  // поворот одразу після fullscreenchange ламав iframe-плеєри Drive на
  // Android), але власний <video> цієй проблеми не має, тож пробуємо тут,
  // ігноруючи відмову (iOS Safari й десктоп її не підтримують).
  async function handleFullscreenToggle() {
    const wasFullscreen = isFullscreen || isPseudoFullscreen;
    await toggleFullscreen();
    if (!wasFullscreen) {
      try {
        await (screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> })?.lock?.(
          "landscape"
        );
      } catch {
        // більшість браузерів/ОС відмовляють — ігноруємо.
      }
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
  // Скільки вертикального місця меню (розкривається вгору) реально має
  // всередині контейнера плеєра над панеллю — контейнер плеєра (rounded,
  // overflow-hidden) інакше обрізав би довге меню зверху.
  const menuMaxHeight = containerHeight ? Math.max(120, containerHeight - overlayHeight - 16) : undefined;

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
        className={`video-player relative aspect-video w-full overflow-hidden rounded-[14px] ${
          isPseudoFullscreen ? `video-player--pseudo-fullscreen ${Z_MODAL}` : ""
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

        {subtitlesLoadError && (
          <span className="absolute right-2 top-2 rounded bg-black/60 px-2 py-0.5 text-[11px] text-white/90">
            Субтитри недоступні
          </span>
        )}

        {/* Єдиний нижній стек: субтитри йдуть у потоці ПЕРЕД панеллю
            керування (document order), тож перекриття кнопками структурно
            неможливе — немає абсолютного bottom, яким субтитри могли б
            залізти під градієнт чи на кнопки. pointer-events:none на стеку
            (субтитри не мають бути клікабельні), auto — лише на самій
            панелі нижче. */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-col items-center">
          {Boolean(showFr && activeFrCue) || Boolean(showUk && activeUkCue) ? (
            <div
              className={`video-subtitle-plate mb-2 flex flex-col items-center text-center ${
                isFullscreen || isPseudoFullscreen ? "video-subtitle-plate--fullscreen" : ""
              }`}
            >
              {showFr && activeFrCue && (
                <p className="font-heading video-subtitle-fr">{renderTokens(activeFrCue.text, "fr")}</p>
              )}
              {showUk && activeUkCue && (
                <p className="font-heading video-subtitle-uk">{renderTokens(activeUkCue.text, "uk")}</p>
              )}
            </div>
          ) : null}

          {/* "Підлога" під субтитрами: висота плавно переходить між
              природною висотою панелі (вимірена ResizeObserver на самому
              вмісті нижче, не константа) і clamp(36px, 8% контейнера,
              72px), коли панель схована. "Схований" стан — лише opacity:0 +
              pointer-events:none на вмісті нижче; БЕЗ overflow-hidden тут —
              інакше меню швидкості/субтитрів (розкриваються вгору,
              position:absolute bottom-full всередині вмісту) обрізалися б
              цією ж обгорткою. */}
          <div
            className="pointer-events-auto w-full transition-[height] duration-150 ease-in-out"
            style={{
              height: overlayVisible ? (overlayHeight ? `${overlayHeight}px` : "auto") : "clamp(36px, 8%, 72px)",
            }}
          >
            <div
              ref={overlayRef}
              className="flex flex-col gap-2 pb-3 pl-[14px] pr-[14px] pt-[34px] transition-opacity duration-150 ease-in-out max-[420px]:gap-1 max-[420px]:pb-2 max-[420px]:pl-[10px] max-[420px]:pr-[10px] max-[420px]:pt-[18px]"
              style={{
                background: "linear-gradient(to top, rgba(10,9,30,0.85), transparent)",
                opacity: overlayVisible ? 1 : 0,
                pointerEvents: overlayVisible ? "auto" : "none",
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
                  className={`relative h-1 flex-1 touch-none rounded-full max-[420px]:h-[3px] ${FOCUS_RING} ${
                    metadataLoaded ? "cursor-pointer" : "cursor-default opacity-60"
                  }`}
                  style={{ background: "rgba(255,255,255,0.3)" }}
                >
                  <div
                    className="absolute inset-y-0 left-0 rounded-full bg-white"
                    style={{ width: `${progress * 100}%` }}
                  />
                  <span
                    className="absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow"
                    style={{ left: `${progress * 100}%` }}
                  />
                </div>
                <span className="shrink-0 whitespace-nowrap text-xs tabular-nums text-white/90">
                  {metadataLoaded ? formatTime(duration!) : "0:00"}
                </span>
              </div>

              {/* Рядок 2: зліва play/±10с/повтор, справа повільно/швидкість/
                  субтитри/mute/fullscreen. На <560px кнопки лівого кластера
                  зменшені до 32px (gap 6px), праворуч дозволений перенос у
                  другий рядок (flex-wrap), замість приховування функцій. */}
              {/* justify-between замінено на ml-auto на правому кластері:
                  коли права група не вміщається поруч із лівою й
                  переноситься на окремий рядок (flex-wrap на цьому
                  контейнері), з justify-between вона лягла б по лівому
                  краю (єдиний елемент на рядку) — ml-auto тримає її
                  праворуч завжди, і на спільному рядку, і на власному. */}
              <div className="flex flex-wrap items-center gap-2 max-[420px]:gap-1.5">
                <div className="flex items-center gap-1.5 min-[560px]:gap-2">
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
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white min-[560px]:h-[34px] min-[560px]:w-[34px] ${FOCUS_RING}`}
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
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white min-[560px]:h-[34px] min-[560px]:w-[34px] ${FOCUS_RING}`}
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
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-colors min-[560px]:h-[34px] min-[560px]:w-[34px] ${FOCUS_RING} ${
                        loopLine ? "bg-white text-[#4f46e5]" : "text-white"
                      }`}
                      style={!loopLine ? { background: "rgba(255,255,255,0.16)" } : undefined}
                    >
                      <Repeat size={16} />
                    </button>
                  )}
                </div>

                <div className="ml-auto flex flex-wrap items-center justify-end gap-1.5 min-[560px]:gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      toggleSlow();
                      wakeOverlay();
                    }}
                    aria-label="Повільно"
                    aria-pressed={speed === 0.75}
                    className={`flex h-8 shrink-0 items-center gap-1 rounded-full border border-white/40 px-2.5 text-xs font-semibold min-[560px]:h-auto min-[560px]:py-1 ${FOCUS_RING} ${
                      speed === 0.75 ? "bg-white text-[#4f46e5]" : "bg-transparent text-white"
                    }`}
                  >
                    <Turtle size={14} />
                    <span className="hidden min-[560px]:inline">Повільно</span>
                  </button>

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
                      className={`flex h-8 items-center rounded-full border border-white/35 bg-white/10 px-2.5 text-xs font-semibold text-white min-[560px]:h-auto min-[560px]:py-1 ${FOCUS_RING}`}
                    >
                      {speed}× ▾
                    </button>
                    {speedOpen && (
                      <div
                        role="menu"
                        className="absolute bottom-full right-0 z-10 mb-1 flex flex-col overflow-y-auto rounded-md border border-gray-200 bg-white py-1 shadow-md dark:border-neutral-700 dark:bg-neutral-800"
                        style={{ maxHeight: menuMaxHeight }}
                      >
                        {SPEEDS.map((s) => (
                          <button
                            key={s}
                            type="button"
                            role="menuitemradio"
                            aria-checked={s === speed}
                            onClick={() => setRate(s)}
                            className={`flex min-h-10 min-w-24 items-center whitespace-nowrap px-3 text-left text-xs hover:bg-neutral-50 dark:hover:bg-neutral-700 ${
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
                        className={`flex h-8 items-center gap-1 rounded-full border border-white/35 bg-white/10 px-2.5 text-xs font-semibold text-white min-[560px]:h-auto min-[560px]:py-1 ${FOCUS_RING}`}
                      >
                        <Captions size={14} />
                        <span className="hidden min-[560px]:inline">{subsLabel}</span>
                      </button>
                      {subsOpen && (
                        <div
                          role="menu"
                          className="absolute bottom-full right-0 z-10 mb-1 flex flex-col overflow-y-auto rounded-md border border-gray-200 bg-white py-1 shadow-md dark:border-neutral-700 dark:bg-neutral-800"
                          style={{ maxHeight: menuMaxHeight }}
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

                  {/* Звук регулюється апаратними кнопками на дотикових
                      пристроях — ховається там через CSS (pointer: coarse),
                      а не за шириною екрана, тож лишається доступним на
                      вузькому, але мишачому вікні. */}
                  <button
                    type="button"
                    onClick={() => {
                      setMuted((v) => !v);
                      wakeOverlay();
                    }}
                    aria-label={muted ? "Увімкнути звук" : "Вимкнути звук"}
                    aria-pressed={muted}
                    className={`video-mute-btn flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white min-[560px]:h-[34px] min-[560px]:w-[34px] ${FOCUS_RING}`}
                    style={{ background: "rgba(255,255,255,0.16)" }}
                  >
                    {muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      void handleFullscreenToggle();
                      wakeOverlay();
                    }}
                    aria-label={isFullscreen || isPseudoFullscreen ? "Вийти з повного екрану" : "На весь екран"}
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white min-[560px]:h-[34px] min-[560px]:w-[34px] ${FOCUS_RING}`}
                    style={{ background: "rgba(255,255,255,0.16)" }}
                  >
                    {isFullscreen || isPseudoFullscreen ? <Minimize size={16} /> : <Maximize size={16} />}
                  </button>
                </div>
              </div>
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
      className={`flex min-h-10 items-center whitespace-nowrap px-3 text-left text-xs hover:bg-neutral-50 dark:hover:bg-neutral-700 ${
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
