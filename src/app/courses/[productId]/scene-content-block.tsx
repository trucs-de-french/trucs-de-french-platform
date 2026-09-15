import { toEmbedUrl, isGdriveUrl } from "@/lib/video";
import { AudioPlayer } from "@/components/audio-player";
import { GdriveAudioPlayer } from "@/components/gdrive-audio-player";
import { InstructionsText } from "@/components/exercises/instructions-text";

export type SceneContentBlockData = {
  id: string;
  content_type: string;
  content_text: string | null;
  media_url: string | null;
  media_provider: string | null;
};

// Рендер text/audio/video/embed дубльований з task-group-block.tsx (той
// самий шматок, той самий домен content_type) — навмисно, не спільний
// компонент (див. коментар у 0036_scene_content_blocks.sql). Не "use
// client" — на відміну від TaskGroupBlock, тут немає задач/балів, що
// потребують клієнтського стану, весь блок рендериться на сервері.
export function SceneContentBlock({ block }: { block: SceneContentBlockData }) {
  return (
    <section className="rounded-md border p-3">
      {block.content_type === "text" && block.content_text && (
        <InstructionsText text={block.content_text} />
      )}

      {block.content_type === "audio" &&
        block.media_url &&
        (() => {
          const provider =
            (block.media_provider as "youtube" | "gdrive" | null) ??
            (isGdriveUrl(block.media_url) ? "gdrive" : null);

          if (provider === "gdrive") {
            return <GdriveAudioPlayer url={block.media_url} />;
          }

          if (provider === "youtube") {
            return (
              <div>
                <div className="overflow-hidden rounded-md border" style={{ height: 140 }}>
                  <iframe
                    src={toEmbedUrl(block.media_url, "youtube")}
                    className="h-full w-full"
                    allow="autoplay"
                  />
                </div>
                <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                  Якщо аудіо не відкривається,{" "}
                  <a
                    href={block.media_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline"
                  >
                    перейдіть за посиланням
                  </a>
                  .
                </p>
              </div>
            );
          }

          return <AudioPlayer src={block.media_url} />;
        })()}

      {block.content_type === "video" && block.media_url && (
        <div className="aspect-video w-full overflow-hidden rounded-md bg-black">
          <iframe
            src={toEmbedUrl(block.media_url, block.media_provider as "youtube" | "gdrive" | null)}
            className="h-full w-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      )}

      {block.content_type === "embed" && block.media_url && (
        <div>
          <div className="overflow-hidden rounded-md border" style={{ height: 480 }}>
            <iframe src={block.media_url} className="h-full w-full" allowFullScreen />
          </div>
          <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
            Якщо вміст не відкривається,{" "}
            <a
              href={block.media_url}
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
            >
              перейдіть за посиланням
            </a>
            .
          </p>
        </div>
      )}
    </section>
  );
}
