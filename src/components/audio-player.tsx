"use client";

import { useRef, useState } from "react";

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2];

// Рідний UI браузера для <audio controls> непослідовно показує контроль
// швидкості (Chrome/Firefox — не показують, Safari — показує), хоча сам
// HTMLMediaElement.playbackRate підтримується всюди однаково. Тому власний
// рядок кнопок замість покладання на рідний UI.
export function AudioPlayer({ src, className }: { src: string; className?: string }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [speed, setSpeed] = useState(1);

  function setPlaybackRate(rate: number) {
    setSpeed(rate);
    if (audioRef.current) {
      audioRef.current.playbackRate = rate;
    }
  }

  return (
    <div className={className}>
      <audio ref={audioRef} controls src={src} className="w-full" />
      <div className="mt-1 flex flex-wrap gap-1">
        {SPEEDS.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setPlaybackRate(s)}
            className={`rounded border px-2 py-0.5 text-xs font-medium transition-colors ${
              speed === s
                ? "border-black bg-black text-white dark:border-white dark:bg-white dark:text-black"
                : "hover:bg-neutral-50 dark:hover:bg-neutral-800"
            }`}
          >
            {s}x
          </button>
        ))}
      </div>
    </div>
  );
}
