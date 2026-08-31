"use client";

import { ImageOrPlaceholder } from "@/components/image-or-placeholder";
import { AudioPlayer } from "@/components/audio-player";

// Універсальні image_url/audio_url на рівні task — показуються над змістом
// будь-якого завдання.
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
      {audioUrl && <AudioPlayer src={audioUrl} className="mt-2" />}
    </>
  );
}
