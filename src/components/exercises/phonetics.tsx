"use client";

import { useState } from "react";
import type { PhoneticsConfig, PhoneticsItem } from "@/lib/exercises/types";
import { normalizeLegacyMedia, extractDriveId, driveEmbedUrl, type PhoneticsMedia } from "@/lib/phonetics-media";
import { PhoneticsAudioPlayer } from "./phonetics-audio-player";
import { PhoneticsVideoBlock } from "./phonetics-video-block";
import { ImageOrPlaceholder } from "@/components/image-or-placeholder";
import { ImageLightbox } from "./image-lightbox";
import { DEFAULT_INSTRUCTIONS } from "@/lib/exercises/default-instructions";
import { InstructionsText } from "./instructions-text";
import { EXERCISE_STACK } from "@/lib/spacing";

// "use client" — плеєри/лайтбокс нижче самі "use client", довідковий блок
// і далі без взаємодії, що оцінюється (phonetics не gradable).

function mediaOf(item: PhoneticsItem): PhoneticsMedia | null {
  return item.media ?? normalizeLegacyMedia(item.mediaUrl);
}

function DrivePreviewAudio({ url }: { url: string }) {
  const id = extractDriveId(url);
  if (!id) return null;
  return (
    <iframe
      src={driveEmbedUrl(id)}
      title="Google Диск"
      className="h-20 w-full max-w-md rounded-[14px]"
      allow="autoplay"
    />
  );
}

const NUMBER_BADGE =
  "flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand text-xs font-semibold text-white";

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
      <div className="flex flex-col gap-3">
        {config.items.map((item, i) => {
          const media = mediaOf(item);
          const translation = item.translation?.trim();
          return (
            <div
              key={i}
              className="flex flex-col gap-[18px] rounded-[18px] border border-gray-200 bg-white p-6 shadow-sm dark:border-neutral-700 dark:bg-neutral-800"
            >
              <div className="flex items-start gap-3">
                <span className={NUMBER_BADGE}>{i + 1}</span>
                <div className="flex min-w-0 flex-col">
                  <span className="break-words font-content text-2xl [overflow-wrap:anywhere]">{item.text}</span>
                  <span className="break-words text-[17px] text-neutral-500 [overflow-wrap:anywhere] dark:text-neutral-400">
                    {item.transcription}
                  </span>
                  {translation && (
                    <span className="break-words text-[15px] italic text-neutral-400 [overflow-wrap:anywhere] dark:text-neutral-500">
                      {translation}
                    </span>
                  )}
                </div>
                {item.imageUrl && (
                  <button
                    type="button"
                    onClick={() => setLightboxSrc(item.imageUrl!)}
                    aria-label="Показати картинку повністю"
                    className="ml-auto shrink-0 cursor-zoom-in"
                  >
                    <ImageOrPlaceholder
                      src={item.imageUrl}
                      alt=""
                      className="h-16 w-16 rounded-lg object-cover"
                      useFocus
                    />
                  </button>
                )}
              </div>

              {media &&
                (media.kind === "video" ? (
                  <div className="max-w-md">
                    <PhoneticsVideoBlock media={media} />
                  </div>
                ) : media.source === "drive" ? (
                  // Диск-аудіо: власний плеєр Диска (iframe /preview), не наш
                  // waveform-плеєр — немає доступу до самих байтів, щоб
                  // відтворити їх через <audio>.
                  <DrivePreviewAudio url={media.url} />
                ) : (
                  <PhoneticsAudioPlayer src={media.url} />
                ))}
            </div>
          );
        })}
      </div>
      {lightboxSrc && <ImageLightbox src={lightboxSrc} onClose={() => setLightboxSrc(null)} />}
    </div>
  );
}
