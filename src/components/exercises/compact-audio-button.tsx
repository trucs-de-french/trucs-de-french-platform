"use client";

import { useRef, useState } from "react";
import { Pause, Play } from "lucide-react";

// Компактна кнопка-іконка відтворення (44×44, той самий розмір, що й
// картинка-підказка поруч) — заміна повного нативного <audio controls> там,
// де він займав би забагато місця в рядку "картинка + підказка" (letter_gaps/
// letter_rearrangement). Сам елемент <audio> лишається звичайним HTML-audio
// (жодної кастомної логіки відтворення) — кнопка лише викликає його
// play()/pause(), поведінка відтворення не змінюється.
export function CompactAudioButton({ src }: { src: string }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);

  return (
    <>
      <audio
        ref={audioRef}
        src={src}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
      />
      <button
        type="button"
        onClick={() => (playing ? audioRef.current?.pause() : audioRef.current?.play())}
        aria-label={playing ? "Зупинити вимову" : "Прослухати вимову"}
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-gray-200 text-neutral-600 transition-colors hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800/70"
      >
        {playing ? <Pause size={18} /> : <Play size={18} />}
      </button>
    </>
  );
}
