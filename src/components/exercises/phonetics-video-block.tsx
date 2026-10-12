"use client";

import { useState } from "react";
import { Play } from "lucide-react";
import type { PhoneticsMedia } from "@/lib/phonetics-media";
import { extractYoutubeId, extractDriveId, youtubeEmbedUrl, driveEmbedUrl, youtubeThumbnailUrl } from "@/lib/phonetics-media";

// YouTube/Диск: легке превʼю (без запиту до чужого сервісу, доки студент
// не натиснув play) — iframe рендериться лише після кліку. upload/url —
// файл наш (чи прямий https-лінк), довантаження нема чого уникати, звичний
// <video controls>.
export function PhoneticsVideoBlock({ media }: { media: PhoneticsMedia }) {
  const [activated, setActivated] = useState(false);

  if (media.source === "upload" || media.source === "url") {
    return (
      <div className="aspect-video w-full max-w-full overflow-hidden rounded-xl bg-black">
        <video controls preload="metadata" playsInline src={media.url} className="h-full w-full" />
      </div>
    );
  }

  const isYoutube = media.source === "youtube";
  const id = isYoutube ? extractYoutubeId(media.url) : extractDriveId(media.url);
  if (!id) return null;

  const embedUrl = isYoutube ? youtubeEmbedUrl(id) : driveEmbedUrl(id);
  const label = isYoutube ? "YouTube" : "Google Диск";
  const openLabel = isYoutube ? "Відкрити на YouTube ↗" : "Відкрити на Google Диску ↗";
  const thumbnail = isYoutube ? youtubeThumbnailUrl(id) : null;

  return (
    <div className="flex w-full max-w-full min-w-0 flex-col gap-1">
      <div className="relative aspect-video w-full max-w-full overflow-hidden rounded-xl bg-black">
        {activated ? (
          <iframe
            src={embedUrl}
            title={label}
            className="h-full w-full"
            allow="autoplay; encrypted-media; fullscreen"
            allowFullScreen
          />
        ) : (
          <button
            type="button"
            onClick={() => setActivated(true)}
            aria-label="Дивитись відео"
            className="group relative h-full w-full"
            style={
              thumbnail
                ? { backgroundImage: `url(${thumbnail})`, backgroundSize: "cover", backgroundPosition: "center" }
                : { background: "linear-gradient(135deg, #4f46e5, #7c3aed)" }
            }
          >
            <span className="absolute inset-0 bg-black/20 transition group-hover:bg-black/30" />
            <span className="absolute inset-0 flex items-center justify-center">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-md">
                <Play size={16} className="text-brand" fill="currentColor" />
              </span>
            </span>
            <span className="absolute bottom-1 left-1 rounded bg-black/60 px-1.5 py-0.5 text-[11px] text-white">
              {label}
            </span>
          </button>
        )}
      </div>
      <a
        href={media.url}
        target="_blank"
        rel="noopener noreferrer"
        className="self-start truncate text-[12px] text-neutral-500 underline hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200"
      >
        {openLabel}
      </a>
    </div>
  );
}
