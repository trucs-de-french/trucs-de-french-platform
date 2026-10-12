"use client";

import { useState } from "react";
import { Play } from "lucide-react";
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

// Диск-аудіо: власного доступу до байтів нема (щоб прогнати через наш
// waveform-плеєр), тож компактний рядок-кнопка, що розкриває вбудований
// плеєр Диска (iframe /preview) лише по кліку — як і відео, без зайвого
// запиту до Диска, доки студент не захотів слухати.
function DriveAudioBlock({ url }: { url: string }) {
  const [activated, setActivated] = useState(false);
  const id = extractDriveId(url);
  if (!id) return null;
  if (activated) {
    return (
      <iframe
        src={driveEmbedUrl(id)}
        title="Google Диск"
        className="h-16 w-full rounded-xl"
        allow="autoplay"
      />
    );
  }
  return (
    <button
      type="button"
      onClick={() => setActivated(true)}
      aria-label="Відтворити аудіо з Google Диска"
      className="flex w-full items-center gap-2 rounded-[14px] bg-[#f3f2fb] px-3 py-2 dark:bg-neutral-700/40"
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand text-white">
        <Play size={16} fill="currentColor" />
      </span>
      <span className="truncate text-sm text-neutral-600 dark:text-neutral-300">Google Диск</span>
    </button>
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
              className="flex flex-col gap-4 rounded-[18px] border border-gray-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:gap-6 dark:border-neutral-700 dark:bg-neutral-800"
            >
              <div className="flex min-w-0 flex-1 items-start gap-3">
                <span className={NUMBER_BADGE}>{i + 1}</span>
                <div className="flex min-w-0 flex-col gap-1">
                  <span className="break-words font-content text-xl font-medium leading-[1.3] [overflow-wrap:anywhere]">
                    {item.text}
                  </span>
                  <span className="break-words text-[15px] text-neutral-500 [overflow-wrap:anywhere] dark:text-neutral-400">
                    {item.transcription}
                  </span>
                  {translation && (
                    <span className="break-words text-[14px] italic text-neutral-400 [overflow-wrap:anywhere] dark:text-neutral-500">
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
                      className="h-14 w-14 rounded-lg object-cover"
                      useFocus
                    />
                  </button>
                )}
              </div>

              {media && (
                // Права колонка: фіксована ширина на sm+ (~260-300px),
                // на мобільному — повна ширина картки, але не ширше 360px.
                <div className="w-full max-w-[360px] flex-none self-start sm:w-[260px] sm:self-center lg:w-[300px]">
                  {media.kind === "video" ? (
                    <PhoneticsVideoBlock media={media} />
                  ) : media.source === "drive" ? (
                    <DriveAudioBlock url={media.url} />
                  ) : (
                    <PhoneticsAudioPlayer src={media.url} />
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
      {lightboxSrc && <ImageLightbox src={lightboxSrc} onClose={() => setLightboxSrc(null)} />}
    </div>
  );
}
