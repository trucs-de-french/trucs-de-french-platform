"use client";

import { useEffect, useRef, useState } from "react";
import { Play, Pause, Repeat } from "lucide-react";

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2];
const RADIUS = 26;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

// Один елемент грає за раз: коли стартує новий — попередній ставиться на
// паузу. Модульний рівень, не React-стан — свідомо просто "хто зараз грає",
// без підписки/ререндерів чужих карток.
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

export function PhoneticsAudioPlayer({ src, className = "" }: { src: string; className?: string }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const speedWrapRef = useRef<HTMLDivElement>(null);
  const speedButtonRef = useRef<HTMLButtonElement>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  // null — метадані ще не завантажені: показуємо "–:–", а не "0:00".
  const [duration, setDuration] = useState<number | null>(null);
  const [loop, setLoop] = useState(false);
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

  function setRate(rate: number) {
    setSpeed(rate);
    setSpeedOpen(false);
    if (audioRef.current) audioRef.current.playbackRate = rate;
  }

  if (loadError) {
    return (
      <p className={`rounded-xl bg-[#f3f2fb] px-2.5 py-2 text-xs text-neutral-500 dark:bg-neutral-700/40 dark:text-neutral-400 ${className}`}>
        Не вдалося завантажити аудіо
      </p>
    );
  }

  const metadataLoaded = duration !== null && Number.isFinite(duration);
  const progress = metadataLoaded && duration! > 0 ? currentTime / duration! : 0;
  const ringOffset = CIRCUMFERENCE * (1 - progress);

  return (
    <div className={`@container flex min-w-0 max-w-full items-center gap-2.5 rounded-xl bg-[#f3f2fb] px-2.5 py-1.5 dark:bg-neutral-700/40 ${className}`}>
      <audio
        ref={audioRef}
        src={src}
        preload="metadata"
        loop={loop}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => {
          // loop=true не породжує подію ended (аудіо само зациклюється) —
          // це лише для випадку "повтор вимкнено": кільце/час повертаються
          // на початок замість зависання на останньому кадрі.
          setPlaying(false);
          setCurrentTime(0);
          if (audioRef.current) audioRef.current.currentTime = 0;
        }}
        onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
        onError={() => setLoadError(true)}
        className="hidden"
      />

      <div className="relative h-[60px] w-[60px] shrink-0">
        <svg width={60} height={60} viewBox="0 0 60 60" className="absolute inset-0">
          <circle
            cx={30}
            cy={30}
            r={RADIUS}
            strokeWidth={4}
            fill="none"
            stroke="currentColor"
            className="text-[#e2e0f0] dark:text-neutral-600"
          />
          <circle
            cx={30}
            cy={30}
            r={RADIUS}
            strokeWidth={4}
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={ringOffset}
            transform="rotate(-90 30 30)"
            className="text-brand transition-[stroke-dashoffset] duration-150 ease-linear"
          />
        </svg>
        <button
          type="button"
          onClick={togglePlay}
          aria-label={playing ? "Пауза" : "Відтворити"}
          aria-pressed={playing}
          className="absolute left-1/2 top-1/2 flex h-11 w-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-brand text-white"
        >
          {playing ? <Pause size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" />}
        </button>
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex items-baseline gap-1 whitespace-nowrap font-content text-[15px] font-semibold tabular-nums">
          <span>{metadataLoaded ? formatTime(currentTime) : "–:–"}</span>
          <span className="text-neutral-400 dark:text-neutral-500">
            / {metadataLoaded ? formatTime(duration!) : "–:–"}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setLoop((v) => !v)}
            aria-label="Повторити"
            aria-pressed={loop}
            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border transition-colors ${
              loop
                ? "border-brand bg-[#ecebfd] text-brand"
                : "border-gray-200 text-neutral-500 hover:bg-white dark:border-neutral-600 dark:text-neutral-400 dark:hover:bg-neutral-800"
            }`}
          >
            <Repeat size={15} />
          </button>

          <div ref={speedWrapRef} className="relative shrink-0">
            <button
              ref={speedButtonRef}
              type="button"
              onClick={() => setSpeedOpen((v) => !v)}
              aria-label={`Швидкість ${speed}×`}
              aria-haspopup="menu"
              aria-expanded={speedOpen}
              className="rounded-full border border-gray-200 bg-white px-2 py-0.5 text-[13px] font-bold text-brand dark:border-neutral-600 dark:bg-neutral-800"
            >
              {speed}× ▾
            </button>
            {speedOpen && (
              <div
                role="menu"
                className="absolute left-0 top-full z-10 mt-1 flex flex-col rounded-md border border-gray-200 bg-white py-1 shadow-md dark:border-neutral-700 dark:bg-neutral-800"
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
        </div>
      </div>
    </div>
  );
}
