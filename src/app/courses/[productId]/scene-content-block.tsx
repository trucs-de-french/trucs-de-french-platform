import { toEmbedUrl, isGdriveUrl } from "@/lib/video";
import { VideoFrame } from "@/components/video-frame";
import { VideoPlayer, type VideoSubtitleTrack } from "@/components/video-player";
import { AudioPlayer } from "@/components/audio-player";
import { GdriveAudioPlayer } from "@/components/gdrive-audio-player";
import { ScriptSection } from "./scenes/[sceneId]/script-section";
import { collectVideoVocab, type VocabItem } from "@/lib/vocab";
import { SHARED_CONTENT_PANEL } from "@/components/task-card-style";
import { GlassBlock } from "@/components/glass-block";
import { EmbedFrame } from "@/components/embed-frame";
import { LinkCard } from "@/components/link-card";
import { resolveSceneLinkMeta } from "@/lib/link-task-icon";
import { EXERCISE_BODY } from "@/lib/typography-styles";
import { sanitizeInstructionsHtml } from "@/lib/sanitize-instructions-html";
import { frenchNbspHtml } from "@/lib/text/french-typography";
import { contentBlockHasRenderableContent } from "@/lib/exercises/task-visibility";
import { isBlankHtml } from "@/lib/html-text";
import { t } from "@/lib/i18n/t";
import type { UiLang } from "@/lib/ui/product-lang";

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
  // "file" (пряме посилання на mp4 — завантажений у R2 файл чи власний URL,
  // 0056) — субтитри опційні, FR/UA WebVTT, лише для цього провайдера;
  // youtube/gdrive їх не мають і лишаються на VideoFrame/iframe.
  subtitles?: VideoSubtitleTrack[] | null;
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
export function SceneContentBlock({
  block,
  sceneDialogue,
  lang,
}: {
  block: SceneContentBlockData;
  // Dialogue сцени — фолбек для глосарію відео-блоку (Крок 2), якщо У
  // САМОГО content-блоку немає власного dialogue (звичний випадок: dialogue
  // на scene_content_blocks реально заповнюється лише для content_type
  // "script", не "video"). Опційний — блоки поза сторінкою сцени (їх тут
  // немає, але контракт лишається сумісним) просто не підсвічують слова.
  sceneDialogue?: ScriptDialogueLine[];
  lang: UiLang;
}) {
  // Обгортка (EXERCISE_BLOCK_CLASS) не має з'являтись, якщо для цього
  // content_type немає жодного заповненого поля — інакше студент бачить
  // голу рамку з padding, без вмісту (task-visibility.ts).
  if (!contentBlockHasRenderableContent(block)) return null;

  return (
    <GlassBlock>
      <SceneContentBlockContent block={block} sceneDialogue={sceneDialogue} lang={lang} />
    </GlassBlock>
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
  sceneDialogue,
  lang,
}: {
  block: SceneContentBlockData;
  // Підкладка (SHARED_CONTENT_PANEL, лише навколо тексту) — вмикається
  // ЛИШЕ коли блок показується разом із прикріпленою групою вправ (сторінка
  // сцени об'єднує SceneContentBlockContent + TaskGroupBlock в одну секцію,
  // bare-режим TaskGroupBlock) — самостійний content-блок (SceneContentBlock
  // вище, без жодної групи) лишається без підкладки навіть для тексту.
  panelForText?: boolean;
  sceneDialogue?: ScriptDialogueLine[];
  lang: UiLang;
}) {
  // Власний dialogue блоку (якщо колись заповнять і для "video") виграє над
  // сценою; інакше — dialogue сцени, якщо є.
  const videoVocab = collectVideoVocab(block.dialogue?.length ? block.dialogue : sceneDialogue ?? []);
  const textNode = !isBlankHtml(block.content_text) && (
    // rich-text + EXERCISE_BODY (Lora, text-base, звичайна вага) — НЕ
    // InstructionsText/EXERCISE_INSTRUCTION: це вільний пояснювальний текст
    // довільної довжини (абзаци, виділення), не коротка імперативна
    // інструкція вправи. instruction-text (і його правило strong→800)
    // свідомо не застосовується тут — <strong> лишається звичайним 700, як
    // і скрізь у .rich-text.
    <div
      className={`rich-text ${EXERCISE_BODY}`}
      dangerouslySetInnerHTML={{ __html: frenchNbspHtml(sanitizeInstructionsHtml(block.content_text ?? "")) }}
    />
  );

  return (
    <>
      {block.content_type === "text" &&
        textNode &&
        (panelForText ? <div className={SHARED_CONTENT_PANEL}>{textNode}</div> : textNode)}

      {block.content_type === "script" && <ScriptSection dialogue={block.dialogue ?? []} />}

      {block.content_type === "links" && (block.links ?? []).length > 0 && (
        <div className="link-card-grid">
          {(block.links ?? []).map((link) => {
            const meta = resolveSceneLinkMeta(link.platform, lang);
            const Icon = meta.icon;
            return (
              <LinkCard
                key={link.id}
                href={link.url}
                icon={<Icon size={22} strokeWidth={2} />}
                title={link.label ?? meta.label}
                subtitle={meta.label}
                variant={meta.featured ? "featured" : "default"}
              />
            );
          })}
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
                  {t(lang, "scene.audioFallbackNote")}{" "}
                  <a
                    href={block.media_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline"
                  >
                    {t(lang, "scene.followLink")}
                  </a>
                  .
                </p>
              </div>
            );
          }

          return <AudioPlayer src={block.media_url} />;
        })()}

      {block.content_type === "video" &&
        block.media_url &&
        (block.media_provider === "file" ? (
          <VideoPlayer
            src={block.media_url}
            subtitles={block.subtitles ?? undefined}
            vocab={videoVocab}
            title={t(lang, "video.videoLabel")}
          />
        ) : (
          <VideoFrame
            src={toEmbedUrl(block.media_url, block.media_provider as "youtube" | "gdrive" | null)}
            title={t(lang, "video.videoLabel")}
            provider={(block.media_provider as "youtube" | "gdrive" | null) ?? "youtube"}
          />
        ))}

      {block.content_type === "embed" && block.media_url && (
        <EmbedFrame url={block.media_url} height={480} />
      )}
    </>
  );
}
