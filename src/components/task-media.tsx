"use client";

import { ImageOrPlaceholder } from "@/components/image-or-placeholder";
import { AudioPlayer } from "@/components/audio-player";
import { toEmbedUrl, isGdriveUrl } from "@/lib/video";

// Універсальні image_url/audio_url на рівні task — показуються над змістом
// будь-якого завдання. audio_url не має власного поля-провайдера в схемі
// (на відміну від task_groups.media_provider) — gdrive визначається лише
// за виглядом URL, той самий isGdriveUrl fallback, що в TaskGroupBlock.
export function TaskMedia({
  imageUrl,
  audioUrl,
}: {
  imageUrl: string | null;
  audioUrl: string | null;
}) {
  return (
    <>
      <ImageOrPlaceholder src={imageUrl} alt="" className="mt-2 h-40 w-full rounded-md object-cover" />
      {audioUrl &&
        (isGdriveUrl(audioUrl) ? (
          <div className="mt-2">
            <div className="overflow-hidden rounded-md border" style={{ height: 140 }}>
              <iframe
                src={toEmbedUrl(audioUrl, "gdrive")}
                className="h-full w-full"
                allow="autoplay"
              />
            </div>
            <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
              Якщо аудіо не відкривається,{" "}
              <a href={audioUrl} target="_blank" rel="noopener noreferrer" className="underline">
                перейдіть за посиланням
              </a>
              .
            </p>
          </div>
        ) : (
          <AudioPlayer src={audioUrl} className="mt-2" />
        ))}
    </>
  );
}
