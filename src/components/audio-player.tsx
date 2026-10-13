"use client";

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { Play, Pause, Repeat, Rewind, FastForward, Volume2, VolumeX, Headphones } from "lucide-react";

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2];
const FOCUS_RING = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#352f66]";

// Один плеєр на сторінці: коли стартує новий — попередній ставиться на
// паузу. Модульний рівень, не React-стан — просто "хто зараз грає", без
// підписки/ререндерів чужих плеєрів.
let currentlyPlaying: HTMLAudioElement | null = null;

function stopOthersAndRegister(el: HTMLAudioElement) {
  if (currentlyPlaying && currentlyPlaying !== el) currentlyPlaying.pause();
  currentlyPlaying = el;
}

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function AudioPlayer({
  src,
  title,
  subtitle,
  className = "",
  onError,
  onStalled,
  onLoadedMetadata,
}: {
  src: string;
  title?: string;
  subtitle?: string;
  className?: string;
  // Опційні — для GdriveAudioPlayer, щоб виявити провал прямого gdrive-
  // стріму й перемкнутись на iframe-резерв. Прості прокидання нативних
  // подій <audio>, без жодної логіки тут — AudioPlayer лишається "дурним"
  // компонентом, уся евристика провалу — на боці викликача.
  onError?: () => void;
  onStalled?: () => void;
  onLoadedMetadata?: () => void;
}) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const speedWrapRef = useRef<HTMLDivElement>(null);
  const speedButtonRef = useRef<HTMLButtonElement>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  // null — метадані ще не завантажені: час показує "0:00", перемотка заблокована.
  const [duration, setDuration] = useState<number | null>(null);
  const [loop, setLoop] = useState(false);
  const [muted, setMuted] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [speedOpen, setSpeedOpen] = useState(false);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    const audio = audioRef.current;
    return () => {
      if (audio && currentlyPlaying === audio) currentlyPlaying = null;
    };
  }, []);

  // Слухач додається лише коли меню відкрите (і знімається при закритті/
  // unmount) — так клік по кнопці іншого плеєра просто відкриває його
  // власне меню, а це закривається через pointerdown поза собою.
  useEffect(() => {
    if (!speedOpen) return;
    function handlePointerDown(e: globalThis.PointerEvent) {
      if (speedWrapRef.current && !speedWrapRef.current.contains(e.target as Node)) {
        setSpeedOpen(false);
      }
    }
    function handleKeyDown(e: globalThis.KeyboardEvent) {
      if (e.key === "Escape") {
        setSpeedOpen(false);
        speedButtonRef.current?.focus();
      }
    }
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [speedOpen]);

  const metadataLoaded = duration !== null && Number.isFinite(duration);

  function togglePlay() {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) {
      stopOthersAndRegister(audio);
      void audio.play();
    } else {
      audio.pause();
    }
  }

  function skip(deltaSeconds: number) {
    const audio = audioRef.current;
    if (!audio || !metadataLoaded) return;
    audio.currentTime = Math.min(Math.max(0, audio.currentTime + deltaSeconds), duration!);
    setCurrentTime(audio.currentTime);
  }

  function seekToClientX(clientX: number) {
    const audio = audioRef.current;
    const track = trackRef.current;
    if (!audio || !track || !metadataLoaded) return;
    const rect = track.getBoundingClientRect();
    const pct = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    audio.currentTime = pct * duration!;
    setCurrentTime(audio.currentTime);
  }

  function handleTrackPointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    if (!metadataLoaded) return;
    seekToClientX(e.clientX);
    trackRef.current?.setPointerCapture(e.pointerId);
  }

  function handleTrackPointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    if (!metadataLoaded || e.buttons !== 1) return;
    seekToClientX(e.clientX);
  }

  function handleTrackKeyDown(e: ReactKeyboardEvent<HTMLDivElement>) {
    if (!metadataLoaded) return;
    if (e.key === "ArrowRight") skip(5);
    else if (e.key === "ArrowLeft") skip(-5);
  }

  function setRate(rate: number) {
    setSpeed(rate);
    setSpeedOpen(false);
    if (audioRef.current) audioRef.current.playbackRate = rate;
  }

  const cardStyle = { background: "linear-gradient(135deg, #2b2a52, #4f46e5)" };

  if (loadError) {
    return (
      <div className={`mx-auto w-full max-w-[640px] ${className}`}>
        <div className="flex items-center gap-3 rounded-2xl p-4 shadow-sm" style={cardStyle}>
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white/15 text-white">
            <Headphones size={20} />
          </span>
          <p className="text-sm text-[#d6d3ff]">Не вдалося завантажити аудіо</p>
        </div>
      </div>
    );
  }

  const progress = metadataLoaded && duration! > 0 ? currentTime / duration! : 0;

  return (
    <div className={`mx-auto w-full max-w-[640px] ${className}`}>
      <div className="flex flex-col gap-3 rounded-2xl p-4 shadow-sm" style={cardStyle}>
        <audio
          ref={audioRef}
          src={src}
          preload="metadata"
          loop={loop}
          muted={muted}
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onEnded={() => {
            // loop=true не породжує подію ended (аудіо само зациклюється) —
            // це лише для "повтор вимкнено": позиція повертається на початок
            // замість зависання на останньому кадрі.
            setPlaying(false);
            setCurrentTime(0);
            if (audioRef.current) audioRef.current.currentTime = 0;
          }}
          onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
          onLoadedMetadata={(e) => {
            setDuration(e.currentTarget.duration);
            onLoadedMetadata?.();
          }}
          onError={() => {
            setLoadError(true);
            onError?.();
          }}
          onStalled={onStalled}
          className="hidden"
        />

        {/* верхній ряд: play/pause, заголовок, іконка-обкладинка */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={togglePlay}
            aria-label={playing ? "Пауза" : "Відтворити"}
            aria-pressed={playing}
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white text-[#4f46e5] ${FOCUS_RING}`}
          >
            {playing ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" />}
          </button>
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="truncate font-heading text-[16px] font-semibold text-white">{title ?? "Аудіо"}</span>
            {subtitle && <span className="truncate text-[13px] text-[#d6d3ff]">{subtitle}</span>}
          </div>
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/[0.18] text-white">
            <Headphones size={20} />
          </span>
        </div>

        {/* ряд прогресу */}
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
            onKeyDown={handleTrackKeyDown}
            className={`relative h-1 flex-1 touch-none rounded-full bg-white/25 ${FOCUS_RING} ${
              metadataLoaded ? "cursor-pointer" : "cursor-default opacity-60"
            }`}
          >
            <div className="absolute inset-y-0 left-0 rounded-full bg-white" style={{ width: `${progress * 100}%` }} />
            <span
              className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow"
              style={{ left: `${progress * 100}%` }}
            />
          </div>
          <span className="shrink-0 whitespace-nowrap text-xs tabular-nums text-white/90">
            {metadataLoaded ? formatTime(duration!) : "0:00"}
          </span>
        </div>

        {/* нижній ряд: ±10с/повтор зліва, швидкість/гучність справа */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => skip(-10)}
              aria-label="Назад на 10 секунд"
              className={`flex h-8 w-8 items-center justify-center rounded-full bg-white/[0.16] text-white ${FOCUS_RING}`}
            >
              <Rewind size={16} />
            </button>
            <button
              type="button"
              onClick={() => skip(10)}
              aria-label="Вперед на 10 секунд"
              className={`flex h-8 w-8 items-center justify-center rounded-full bg-white/[0.16] text-white ${FOCUS_RING}`}
            >
              <FastForward size={16} />
            </button>
            <button
              type="button"
              onClick={() => setLoop((v) => !v)}
              aria-label="Повторити"
              aria-pressed={loop}
              className={`flex h-8 w-8 items-center justify-center rounded-full transition-colors ${FOCUS_RING} ${
                loop ? "bg-white text-[#4f46e5]" : "bg-white/[0.16] text-white"
              }`}
            >
              <Repeat size={16} />
            </button>
          </div>

          <div className="flex items-center gap-2">
            <div ref={speedWrapRef} className="relative shrink-0">
              <button
                ref={speedButtonRef}
                type="button"
                onClick={() => setSpeedOpen((v) => !v)}
                aria-label={`Швидкість ${speed}×`}
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

            <button
              type="button"
              onClick={() => setMuted((v) => !v)}
              aria-label={muted ? "Увімкнути звук" : "Вимкнути звук"}
              aria-pressed={muted}
              className={`flex h-8 w-8 items-center justify-center rounded-full bg-white/[0.16] text-white ${FOCUS_RING}`}
            >
              {muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
