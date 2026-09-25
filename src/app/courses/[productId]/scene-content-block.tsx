import { toEmbedUrl, isGdriveUrl } from "@/lib/video";
import { AudioPlayer } from "@/components/audio-player";
import { GdriveAudioPlayer } from "@/components/gdrive-audio-player";
import { ScriptSection } from "./scenes/[sceneId]/script-section";
import type { VocabItem } from "@/lib/vocab";
import { EXERCISE_BLOCK_CLASS, SHARED_CONTENT_PANEL } from "@/components/task-card-style";
import { EmbedWithFallback } from "@/components/embed-with-fallback";
import { STUDENT_LINK_BUTTON } from "@/lib/button-styles";
import { EXERCISE_BODY } from "@/lib/typography-styles";
import { sanitizeInstructionsHtml } from "@/lib/sanitize-instructions-html";
import { contentBlockHasRenderableContent } from "@/lib/exercises/task-visibility";
import { isBlankHtml } from "@/lib/html-text";

// Той самий локальний тип, що DialogueEntry в script-section.tsx (не
// експортований звідти) — структурно сумісний, ScriptSection не переймається
// звідки прийшов масив.
type ScriptDialogueLine = {
  speaker: string;
  text: string;
  vocab: VocabItem[];
  start?: number | null;
  videoLink?: string | null;
  translationUk?: string | null;
};

export type SceneContentLink = {
  id: string;
  url: string;
  platform: string;
  label: string | null;
};

export type SceneContentBlockData = {
  id: string;
  content_type: string;
  content_text: string | null;
  media_url: string | null;
  media_provider: string | null;
  dialogue?: ScriptDialogueLine[] | null;
  links?: SceneContentLink[];
};

// Рендер text/audio/video/embed дубльований з task-group-block.tsx (той
// самий шматок, той самий домен content_type) — навмисно, не спільний
// компонент (див. коментар у 0036_scene_content_blocks.sql). script/links
// (0038) перевикористовують уже наявні ScriptSection/просту розмітку
// посилань фіксованої Практики — не дублюють їх. Не "use client" — на
// відміну від TaskGroupBlock, тут немає задач/балів, що потребують
// клієнтського стану, весь блок рендериться на сервері (ScriptSection сам
// по собі "use client" — це нормально всередині Server Component).
export function SceneContentBlock({ block }: { block: SceneContentBlockData }) {
  // Обгортка (EXERCISE_BLOCK_CLASS) не має з'являтись, якщо для цього
  // content_type немає жодного заповненого поля — інакше студент бачить
  // голу рамку з padding, без вмісту (task-visibility.ts).
  if (!contentBlockHasRenderableContent(block)) return null;

  return (
    <section className={EXERCISE_BLOCK_CLASS}>
      <SceneContentBlockContent block={block} />
    </section>
  );
}

// Сам вміст, БЕЗ зовнішньої секції/рамки — окремо від SceneContentBlock,
// щоб сторінка сцени могла вставити його всередину ЧУЖОЇ рамки (спільної з
// TaskGroupBlock), коли до цього content-блоку прикріплено набір вправ
// (task_groups.scene_content_block_id) — тоді блок і вправи мають одну
// спільну картку, не дві окремі (раніше саме тому й розпадались на дві).
export function SceneContentBlockContent({
  block,
  panelForText = false,
}: {
  block: SceneContentBlockData;
  // Підкладка (SHARED_CONTENT_PANEL, лише навколо тексту) — вмикається
  // ЛИШЕ коли блок показується разом із прикріпленою групою вправ (сторінка
  // сцени об'єднує SceneContentBlockContent + TaskGroupBlock в одну секцію,
  // bare-режим TaskGroupBlock) — самостійний content-блок (SceneContentBlock
  // вище, без жодної групи) лишається без підкладки навіть для тексту.
  panelForText?: boolean;
}) {
  const textNode = !isBlankHtml(block.content_text) && (
    // rich-text + EXERCISE_BODY (Lora, text-base, звичайна вага) — НЕ
    // InstructionsText/EXERCISE_INSTRUCTION: це вільний пояснювальний текст
    // довільної довжини (абзаци, виділення), не коротка імперативна
    // інструкція вправи. instruction-text (і його правило strong→800)
    // свідомо не застосовується тут — <strong> лишається звичайним 700, як
    // і скрізь у .rich-text.
    <div
      className={`rich-text ${EXERCISE_BODY}`}
      dangerouslySetInnerHTML={{ __html: sanitizeInstructionsHtml(block.content_text ?? "") }}
    />
  );

  return (
    <>
      {block.content_type === "text" &&
        textNode &&
        (panelForText ? <div className={SHARED_CONTENT_PANEL}>{textNode}</div> : textNode)}

      {block.content_type === "script" && <ScriptSection dialogue={block.dialogue ?? []} />}

      {block.content_type === "links" && (block.links ?? []).length > 0 && (
        <div className="flex flex-wrap gap-2">
          {(block.links ?? []).map((link) => (
            <a
              key={link.id}
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              className={STUDENT_LINK_BUTTON}
            >
              {link.label ?? link.platform}
            </a>
          ))}
        </div>
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
                <div className="overflow-hidden rounded-md border border-gray-200 dark:border-neutral-700" style={{ height: 140 }}>
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
        <div className="aspect-video w-full overflow-hidden rounded-md bg-black dark:border dark:border-neutral-700">
          <iframe
            src={toEmbedUrl(block.media_url, block.media_provider as "youtube" | "gdrive" | null)}
            className="h-full w-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      )}

      {block.content_type === "embed" && block.media_url && (
        <EmbedWithFallback url={block.media_url} height={480} />
      )}
    </>
  );
}
