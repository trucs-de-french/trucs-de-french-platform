"use client";

import { useEffect, useRef, useState } from "react";
import { Play, Pause, Repeat, Turtle } from "lucide-react";

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2];
const RADIUS = 20;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const CARD_GRADIENT = { background: "linear-gradient(135deg, #2b2a52, #4f46e5)" };
const FOCUS_RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#2b2a52]";

// Один елемент грає за раз: коли стартує новий — попередній ставиться на
// паузу. Модульний рівень, не React-стан — свідомо просто "хто зараз грає",
// без підписки/ререндерів чужих плеєрів. Спільний для ВСІХ AudioPill на
// сторінці (phonetics і будь-яка картка завдання, що використовує цей
// плеєр) — великий AudioPlayer (components/audio-player.tsx, "listening" і
// task-media) має власний окремий трекер, свідомо не об'єднаний із цим.
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

// Спільний плеєр-пілюля (індиго-градієнт, кругла play-кнопка з кільцем
// прогресу, "повільно"/повтор/швидкість) — раніше був приватним для
// phonetics.tsx (PhoneticsAudioPlayer), тепер єдиний компонент і для картки
// фонетики, і для аудіо в картках інших вправ (flip_cards, crossword),
// замість нативного <audio controls>. compact=true — щільніше пакування
// для вузьких карток (grid_drop/flip_cards-плитка): без тексту "Повільно"
// і без таймера, кнопки-іконки без текстового лейбла, менші відступи/gap —
// та сама картка-пілюля, play-кнопка лишається 44px.
export function AudioPill({
  src,
  compact = false,
  className = "",
}: {
  src: string;
  compact?: boolean;
  className?: string;
}) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const speedWrapRef = useRef<HTMLDivElement>(null);
  const speedButtonRef = useRef<HTMLButtonElement>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  // null — метадані ще не завантажені: час показує "0:00".
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

  // Toggle "Повільно" — лише зручний ярлик для 0.75×: окремого стану нема,
  // активність виводиться напряму з speed, тож вибір 0.75× у меню швидкості
  // вмикає toggle, а вибір будь-якого іншого значення — вимикає його.
  function toggleSlow() {
    setRate(speed === 0.75 ? 1 : 0.75);
  }

  // Плеєр сидить усередині клікабельних карток (flip_cards-плитка,
  // кросворд-підказка) — клік/тап/клавіша на самому плеєрі не мають
  // доходити до картки (перевернути/обрати слово).
  const guardProps = {
    onClick: (e: React.MouseEvent) => e.stopPropagation(),
    onPointerDown: (e: React.PointerEvent) => e.stopPropagation(),
    onKeyDown: (e: React.KeyboardEvent) => e.stopPropagation(),
  };

  if (loadError) {
    return (
      <div
        {...guardProps}
        draggable={false}
        title="Не вдалося завантажити аудіо"
        className={`flex w-full min-w-0 max-w-full items-center rounded-full opacity-60 ${
          compact ? "px-3 py-2" : "px-3.5 py-2.5"
        } ${className}`}
        style={CARD_GRADIENT}
      >
        <p className="truncate text-xs text-[#d6d3ff]">Не вдалося завантажити аудіо</p>
      </div>
    );
  }

  const metadataLoaded = duration !== null && Number.isFinite(duration);
  const progress = metadataLoaded && duration! > 0 ? currentTime / duration! : 0;
  const ringOffset = CIRCUMFERENCE * (1 - progress);

  return (
    <div
      {...guardProps}
      draggable={false}
      className={`@container flex w-full min-w-0 max-w-full items-center rounded-full ${
        compact ? "gap-1 p-[4px_8px_4px_4px]" : "gap-2.5 p-[6px_14px_6px_6px]"
      } ${className}`}
      style={CARD_GRADIENT}
    >
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

      {/* кільце-play: клік будь-де в межах 44px (не лише по білому кругу) перемикає відтворення */}
      <button
        type="button"
        onClick={togglePlay}
        disabled={!metadataLoaded}
        aria-label={playing ? "Пауза" : "Відтворити"}
        aria-pressed={playing}
        className={`relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full disabled:cursor-wait disabled:opacity-60 ${FOCUS_RING}`}
      >
        <svg width={44} height={44} viewBox="0 0 44 44" className="absolute inset-0">
          <circle cx={22} cy={22} r={RADIUS} strokeWidth={3} fill="none" stroke="rgba(255,255,255,0.3)" />
          <circle
            cx={22}
            cy={22}
            r={RADIUS}
            strokeWidth={3}
            fill="none"
            stroke="white"
            strokeLinecap="round"
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={ringOffset}
            transform="rotate(-90 22 22)"
            className="transition-[stroke-dashoffset] duration-150 ease-linear"
          />
        </svg>
        <span className="relative flex h-8 w-8 items-center justify-center rounded-full bg-white text-[#4f46e5]">
          {playing ? <Pause size={14} fill="currentColor" /> : <Play size={14} fill="currentColor" />}
        </span>
      </button>

      <button
        type="button"
        onClick={toggleSlow}
        aria-pressed={speed === 0.75}
        aria-label="Повільно"
        className={`flex shrink-0 items-center gap-1 rounded-full border border-white/35 font-heading text-[13px] font-bold ${FOCUS_RING} ${
          compact ? "h-8 w-8 justify-center" : "px-3 py-[5px]"
        } ${speed === 0.75 ? "bg-white text-[#4f46e5]" : "bg-transparent text-white"}`}
      >
        <Turtle size={14} />
        {!compact && <span className="@max-[340px]:hidden">Повільно</span>}
      </button>

      {!compact && (
        <span className="@max-[340px]:hidden shrink-0 whitespace-nowrap font-heading text-[13px] font-semibold tabular-nums text-[#d6d3ff]">
          {metadataLoaded ? formatTime(currentTime) : "0:00"} / {metadataLoaded ? formatTime(duration!) : "0:00"}
        </span>
      )}

      <div className={`ml-auto flex shrink-0 items-center ${compact ? "gap-1" : "gap-1.5"}`}>
        <button
          type="button"
          onClick={() => setLoop((v) => !v)}
          aria-label="Повторити"
          aria-pressed={loop}
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-colors ${FOCUS_RING} ${
            loop ? "bg-white text-[#4f46e5]" : "bg-white/[0.16] text-white"
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
            className={`rounded-full border border-white/35 bg-transparent text-[13px] font-semibold text-white ${FOCUS_RING} ${
              compact ? "px-1.5 py-0.5" : "px-2 py-0.5"
            }`}
          >
            {speed}× ▾
          </button>
          {speedOpen && (
            <div
              role="menu"
              className="absolute bottom-full right-0 z-10 mb-1 flex flex-col rounded-xl border border-[#e6e4ee] bg-white py-1 shadow-md"
            >
              {SPEEDS.map((s) => (
                <button
                  key={s}
                  type="button"
                  role="menuitemradio"
                  aria-checked={s === speed}
                  onClick={() => setRate(s)}
                  className={`whitespace-nowrap rounded-lg px-3 py-1 text-left text-xs ${
                    s === speed ? "bg-[#ecebfd] font-semibold text-brand" : "text-neutral-600 hover:bg-neutral-50"
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
  );
}
