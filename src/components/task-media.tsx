"use client";

import { ImageOrPlaceholder } from "@/components/image-or-placeholder";
import { AudioPlayer } from "@/components/audio-player";
import { GdriveAudioPlayer } from "@/components/gdrive-audio-player";
import { isGdriveUrl } from "@/lib/video";

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
          <GdriveAudioPlayer url={audioUrl} className="mt-2" />
        ) : (
          <AudioPlayer src={audioUrl} className="mt-2" />
        ))}
    </>
  );
}
