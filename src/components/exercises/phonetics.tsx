"use client";

import { useState } from "react";
import { Play } from "lucide-react";
import type { PhoneticsConfig, PhoneticsItem } from "@/lib/exercises/types";
import { normalizeLegacyMedia, extractDriveId, driveEmbedUrl, type PhoneticsMedia } from "@/lib/phonetics-media";
import { AudioPill } from "@/components/audio-pill";
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
        className="h-16 w-full max-w-full rounded-xl"
        allow="autoplay"
      />
    );
  }
  return (
    <button
      type="button"
      onClick={() => setActivated(true)}
      aria-label="Відтворити аудіо з Google Диска"
      className="flex w-full min-w-0 max-w-full items-center gap-1.5 rounded-xl bg-[#f3f2fb] px-2.5 py-1.5 dark:bg-neutral-700/40"
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand text-white">
        <Play size={14} fill="currentColor" />
      </span>
      <span className="truncate text-xs text-neutral-600 dark:text-neutral-300">Google Диск</span>
    </button>
  );
}

const NUMBER_BADGE =
  "flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand text-sm font-semibold text-white";

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
      <div className="grid grid-cols-1 items-stretch gap-4 md:grid-cols-2">
        {config.items.map((item, i) => {
          const media = mediaOf(item);
          const translation = item.translation?.trim();
          return (
            <div
              key={i}
              // @container — "текст зліва, медіа справа" залежить від
              // ФАКТИЧНОЇ ширини картки (яка в сітці 2х ≈ половина
              // контейнера), а не від ширини вікна: sm:/lg: раніше
              // ламались саме тут — на вузькій картці full-width вікна
              // вони все одно спрацьовували, а flex-shrink:0 медіа-колонки
              // при цьому стискав min-w-0 ліву частину до мінімуму,
              // лишаючи під медіа ~600px замість заданих ~260-300.
              // min-w-0 на самій картці — щоб довгий текст не розпирав
              // grid-колонку (а з нею і сусідню картку) ширше задуманого.
              className="@container flex min-w-0 flex-col gap-3 rounded-2xl border-[1.5px] dark:border glass-chip border-[#dcbd6e] bg-white p-4 glass-gap-shadow dark:shadow-sm @[480px]:flex-row @[480px]:items-start @[480px]:gap-4 dark:border-neutral-700 dark:bg-neutral-800"
            >
              <div className="flex min-w-0 flex-1 items-start gap-2.5">
                <span className={NUMBER_BADGE}>{i + 1}</span>
                <div className="flex min-w-0 flex-col gap-1">
                  <span className="break-words font-content text-[16px] font-medium leading-[1.35] [overflow-wrap:anywhere]">
                    {item.text}
                  </span>
                  <span className="break-words text-sm text-neutral-500 [overflow-wrap:anywhere] dark:text-neutral-400">
                    {item.transcription}
                  </span>
                  {translation && (
                    <span className="break-words text-[13px] italic text-neutral-400 [overflow-wrap:anywhere] dark:text-neutral-500">
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
                      className="h-12 w-12 rounded-lg object-cover"
                      useFocus
                    />
                  </button>
                )}
              </div>

              {media && (
                // Права колонка: на вузькій картці (<480px, мобільний теж
                // сюди потрапляє) — повна ширина картки, не більше 320px,
                // зліва. На широкій картці (>=480px) — фіксована 220px
                // (180-240 за вимогою). min-w-0 — не дати вмісту (iframe/
                // video з "w-full") розіпрати цю колонку понад задане.
                <div className="w-full min-w-0 max-w-[320px] flex-none self-start @[480px]:w-[220px] @[480px]:max-w-[220px]">
                  {media.kind === "video" ? (
                    <PhoneticsVideoBlock media={media} />
                  ) : media.source === "drive" ? (
                    <DriveAudioBlock url={media.url} />
                  ) : (
                    <AudioPill src={media.url} />
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
