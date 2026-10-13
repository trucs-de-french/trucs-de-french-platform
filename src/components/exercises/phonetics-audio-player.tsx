"use client";

import { useEffect, useMemo, useRef, useState, type PointerEvent, type KeyboardEvent } from "react";
import { Play, Pause } from "lucide-react";

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2];
// 14, не 20 — права колонка картки у сітці 2х стала ще вужчою (~180-240px).
const BAR_COUNT = 14;

// Один елемент грає за раз (крок 7 задачі): коли стартує новий — попередній
// ставиться на пауза. Модульний рівень, не React-стан — свідомо просто
// "хто зараз грає", без підписки/ререндерів чужих карток.
let currentlyPlaying: HTMLAudioElement | null = null;

function stopOthersAndRegister(el: HTMLAudioElement) {
  if (currentlyPlaying && currentlyPlaying !== el) currentlyPlaying.pause();
  currentlyPlaying = el;
}

// Детермінована "хвиля" (не справжня амплітуда файлу — декоративна, як і
// попросили) — та сама послідовність висот для того самого src щоразу,
// без потреби декодувати аудіо.
function barHeights(seed: string): number[] {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  const heights: number[] = [];
  for (let i = 0; i < BAR_COUNT; i++) {
    h = (h * 1103515245 + 12345) >>> 0;
    heights.push(30 + (h % 71)); // 30%..100%
  }
  return heights;
}

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function PhoneticsAudioPlayer({ src, className = "" }: { src: string; className?: string }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const waveRef = useRef<HTMLDivElement>(null);
  const speedWrapRef = useRef<HTMLDivElement>(null);
  const speedButtonRef = useRef<HTMLButtonElement>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [speedOpen, setSpeedOpen] = useState(false);
  const heights = useMemo(() => barHeights(src), [src]);

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

  function seekToClientX(clientX: number) {
    const audio = audioRef.current;
    const wave = waveRef.current;
    if (!audio || !wave || !duration) return;
    const rect = wave.getBoundingClientRect();
    const pct = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    audio.currentTime = pct * duration;
    setCurrentTime(audio.currentTime);
  }

  function handleWavePointerDown(e: PointerEvent<HTMLDivElement>) {
    seekToClientX(e.clientX);
    const wave = waveRef.current;
    wave?.setPointerCapture(e.pointerId);
  }

  function handleWavePointerMove(e: PointerEvent<HTMLDivElement>) {
    if (e.buttons !== 1) return;
    seekToClientX(e.clientX);
  }

  function handleWaveKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    const audio = audioRef.current;
    if (!audio || !duration) return;
    if (e.key === "ArrowRight") {
      audio.currentTime = Math.min(duration, audio.currentTime + duration * 0.05);
      setCurrentTime(audio.currentTime);
    } else if (e.key === "ArrowLeft") {
      audio.currentTime = Math.max(0, audio.currentTime - duration * 0.05);
      setCurrentTime(audio.currentTime);
    }
  }

  function setRate(rate: number) {
    setSpeed(rate);
    setSpeedOpen(false);
    if (audioRef.current) audioRef.current.playbackRate = rate;
  }

  const progress = duration > 0 ? currentTime / duration : 0;
  const filledBars = Math.round(progress * BAR_COUNT);

  return (
    <div
      // @container — вузька колонка, а не весь екран: час ховається за
      // шириною САМОГО плеєра (@[Npx]:), не за шириною вікна браузера.
      // min-w-0 — плеєр не повинен штовхати власний max-w-full контейнер
      // ширше за замовлену колонку (flex-row батьків без цього тягнеться
      // під min-content дітей, звідси й був баг "розтягується до ~600px").
      className={`@container flex min-w-0 max-w-full items-center gap-1.5 rounded-xl bg-[#f3f2fb] px-2.5 py-1.5 dark:bg-neutral-700/40 ${className}`}
    >
      <audio
        ref={audioRef}
        src={src}
        preload="metadata"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
        onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
        className="hidden"
      />

      <button
        type="button"
        onClick={togglePlay}
        aria-label={playing ? "Пауза" : "Відтворити"}
        aria-pressed={playing}
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand text-white"
      >
        {playing ? <Pause size={14} fill="currentColor" /> : <Play size={14} fill="currentColor" />}
      </button>

      <div
        ref={waveRef}
        role="slider"
        tabIndex={0}
        aria-label="Позиція відтворення"
        aria-valuemin={0}
        aria-valuemax={Math.round(duration) || 0}
        aria-valuenow={Math.round(currentTime)}
        onPointerDown={handleWavePointerDown}
        onPointerMove={handleWavePointerMove}
        onKeyDown={handleWaveKeyDown}
        className="flex h-5 min-w-0 flex-1 cursor-pointer items-center gap-[2px]"
      >
        {heights.map((h, i) => (
          <span
            key={i}
            className={`w-full rounded-full ${i < filledBars ? "bg-brand" : "bg-neutral-300 dark:bg-neutral-500"}`}
            style={{ height: `${h}%` }}
          />
        ))}
      </div>

      {/* приховано за замовчуванням — показуємо лише коли сам плеєр (не
          вікно) має досить ширини, @container вище */}
      <span className="hidden shrink-0 whitespace-nowrap text-[10px] text-neutral-500 @[260px]:inline dark:text-neutral-400">
        {formatTime(currentTime)} / {formatTime(duration)}
      </span>

      <div ref={speedWrapRef} className="relative shrink-0">
        <button
          ref={speedButtonRef}
          type="button"
          onClick={() => setSpeedOpen((v) => !v)}
          aria-label="Швидкість відтворення"
          aria-haspopup="menu"
          aria-expanded={speedOpen}
          className="rounded-md border border-gray-200 px-1 py-0.5 text-[10px] text-neutral-600 hover:bg-white dark:border-neutral-600 dark:text-neutral-300 dark:hover:bg-neutral-800"
        >
          {speed}× ▾
        </button>
        {speedOpen && (
          <div
            role="menu"
            className="absolute right-0 top-full z-10 mt-1 flex flex-col rounded-md border border-gray-200 bg-white py-1 shadow-md dark:border-neutral-700 dark:bg-neutral-800"
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
  );
}
