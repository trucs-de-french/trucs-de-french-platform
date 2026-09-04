import type { PhoneticsConfig } from "@/lib/exercises/types";
import { isYouTubeUrl, toEmbedUrl } from "@/lib/video";
import { AudioPlayer } from "@/components/audio-player";
import { DEFAULT_INSTRUCTIONS } from "@/lib/exercises/default-instructions";
import { InstructionsText } from "./instructions-text";

// Не "use client" — довідковий блок без взаємодії, що вимагала б стану
// (як callout/flip_cards); AudioPlayer/iframe усередині самі "use client".

export function PhoneticsExercise({ config }: { config: PhoneticsConfig }) {
  if (config.items.length === 0) {
    return (
      <p className="text-sm text-neutral-500 dark:text-neutral-400">
        У цій вправі ще немає реплік.
      </p>
    );
  }

  return (
    <div>
      <InstructionsText
        text={config.instructions ?? DEFAULT_INSTRUCTIONS.phonetics}
        subText={config.subInstructions}
        className="mb-2 font-medium"
      />
      <div className="flex flex-col gap-2">
        {config.items.map((item, i) => (
          <div key={i} className="flex flex-col gap-1 rounded-md border p-3">
            <span className="text-sm">{item.text}</span>
            <span className="text-sm text-neutral-500 dark:text-neutral-400">
              {item.transcription}
            </span>
            {item.mediaUrl &&
              (isYouTubeUrl(item.mediaUrl) ? (
                <div className="mt-1 aspect-video w-full max-w-md overflow-hidden rounded-md bg-black">
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
    </div>
  );
}
