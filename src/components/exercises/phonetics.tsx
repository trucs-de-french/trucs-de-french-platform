"use client";

import { useState } from "react";
import type { PhoneticsConfig } from "@/lib/exercises/types";
import { isYouTubeUrl, toEmbedUrl } from "@/lib/video";
import { AudioPlayer } from "@/components/audio-player";
import { ImageOrPlaceholder } from "@/components/image-or-placeholder";
import { ImageLightbox } from "./image-lightbox";
import { DEFAULT_INSTRUCTIONS } from "@/lib/exercises/default-instructions";
import { InstructionsText } from "./instructions-text";
import { ANSWER_CARD_BASE, ANSWER_CARD_DEFAULT } from "./answer-card-style";
import { EXERCISE_STACK } from "@/lib/spacing";

// "use client" тепер потрібен лише для лайтбокса (стан lightboxSrc) —
// AudioPlayer/iframe і раніше самі були "use client", довідковий блок і
// далі без взаємодії, що оцінюється.

export function PhoneticsExercise({ config }: { config: PhoneticsConfig }) {
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);

  if (config.items.length === 0) {
    return (
      <p className="text-sm text-neutral-500 dark:text-neutral-400">
        У цій вправі ще немає реплік.
      </p>
    );
  }

  return (
    <div className={EXERCISE_STACK}>
      <InstructionsText
        text={config.instructions ?? DEFAULT_INSTRUCTIONS.phonetics.instruction}
        subText={config.subInstructions ?? DEFAULT_INSTRUCTIONS.phonetics.subInstruction}
      />
      <div className="flex flex-col gap-2">
        {config.items.map((item, i) => (
          <div key={i} className={`flex flex-col items-center gap-1 ${ANSWER_CARD_BASE} ${ANSWER_CARD_DEFAULT}`}>
            {item.imageUrl && (
              <button
                type="button"
                onClick={() => setLightboxSrc(item.imageUrl!)}
                aria-label="Показати картинку повністю"
                className="mb-1 shrink-0 cursor-zoom-in"
              >
                <ImageOrPlaceholder
                  src={item.imageUrl}
                  alt=""
                  className="h-16 w-16 rounded-lg object-cover"
                  useFocus
                />
              </button>
            )}
            <span>{item.text}</span>
            <span className="text-base text-neutral-500 dark:text-neutral-400">
              {item.transcription}
            </span>
            {item.mediaUrl &&
              (isYouTubeUrl(item.mediaUrl) ? (
                <div className="mt-1 aspect-video w-full max-w-md overflow-hidden rounded-md bg-black dark:border dark:border-neutral-700">
                  <iframe
                    src={toEmbedUrl(item.mediaUrl, "youtube")}
                    className="h-full w-full"
                    allowFullScreen
                  />
                </div>
              ) : (
                <AudioPlayer src={item.mediaUrl} className="mt-1" />
              ))}
          </div>
        ))}
      </div>
      {lightboxSrc && <ImageLightbox src={lightboxSrc} onClose={() => setLightboxSrc(null)} />}
    </div>
  );
}
