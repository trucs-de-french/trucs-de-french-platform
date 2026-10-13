"use client";

import { useRef, useState } from "react";
import { InstructionsRichTextField } from "../tasks/instructions-rich-text-field";
import { FileOrLinkField } from "@/components/file-or-link-field";
import { FileUpload } from "@/components/file-upload";
import { INPUT_BORDER } from "@/lib/input-styles";
import { LABEL_TEXT } from "@/lib/typography-styles";

export type ContentBlockInitial = {
  title?: string | null;
  content_type?: string;
  content_text?: string | null;
  media_url?: string | null;
  media_provider?: string | null;
  subtitles?: { lang: "fr" | "uk"; url: string }[] | null;
};

// Дубльовано з task-group-fields.tsx (та сама секція вибору типу контенту +
// полів під нього) — навмисно, не спільний компонент: two різних домени
// (див. коментар у 0036_scene_content_blocks.sql), яким випадково збігається
// форма полів; той самий принцип навмисної дуплікації для полів-редакторів,
// що вже задокументований у material-article-fields.tsx.
export function ContentBlockFields({ initialBlock }: { initialBlock?: ContentBlockInitial }) {
  const [contentType, setContentType] = useState(initialBlock?.content_type ?? "text");
  const [provider, setProvider] = useState(initialBlock?.media_provider ?? "youtube");
  const mediaUrlRef = useRef<HTMLInputElement>(null);
  const videoFileUrlRef = useRef<HTMLInputElement>(null);
  const subsFrUrlRef = useRef<HTMLInputElement>(null);
  const subsUkUrlRef = useRef<HTMLInputElement>(null);
  const initialSubFr = initialBlock?.subtitles?.find((s) => s.lang === "fr")?.url ?? "";
  const initialSubUk = initialBlock?.subtitles?.find((s) => s.lang === "uk")?.url ?? "";

  return (
    <>
      <div className="flex flex-col gap-1">
        <label className={LABEL_TEXT}>Назва блоку (для адмінки, студент не бачить)</label>
        <input
          name="title"
          defaultValue={initialBlock?.title ?? ""}
          placeholder="напр. Додаткове відео — вимова"
          className={`${INPUT_BORDER} px-3 py-2 text-base font-medium`}
        />
      </div>

      <div className="flex flex-col gap-1">
        <label className={LABEL_TEXT}>Тип контенту</label>
        <select
          name="content_type"
          value={contentType}
          onChange={(e) => setContentType(e.target.value)}
          className={`${INPUT_BORDER} w-fit px-2 py-2 text-sm`}
        >
          <option value="text">Текст</option>
          <option value="audio">Аудіо</option>
          <option value="video">Відео</option>
          <option value="embed">Вбудований контент (iframe)</option>
          <option value="script">Скрипт (діалог)</option>
        </select>
      </div>

      {contentType === "text" && (
        <InstructionsRichTextField
          name="content_text"
          label="Текст"
          initialValue={initialBlock?.content_text ?? ""}
        />
      )}

      {contentType === "audio" && (
        <div className="flex flex-col gap-1">
          <label className={LABEL_TEXT}>Аудіо</label>
          <FileOrLinkField
            kind="audio"
            mode="name"
            urlName="media_url"
            uploadName="media_audio_file_url"
            defaultValue={initialBlock?.media_url ?? ""}
            placeholder="URL аудіо"
          />
        </div>
      )}

      {contentType === "embed" && (
        <div className="flex flex-col gap-1">
          <label className={LABEL_TEXT}>URL для вбудовування (iframe src)</label>
          <div className="flex items-center gap-1">
            <input
              ref={mediaUrlRef}
              name="media_url"
              defaultValue={initialBlock?.media_url ?? ""}
              className={`${INPUT_BORDER} flex-1 px-3 py-2 text-sm`}
            />
            <FileUpload
              kind="html"
              variant="icon"
              onUploaded={(url) => {
                if (mediaUrlRef.current) mediaUrlRef.current.value = url;
              }}
            />
          </div>
        </div>
      )}

      {(contentType === "video" || contentType === "audio") && (
        <div className="flex flex-col gap-1">
          <label className={LABEL_TEXT}>Платформа</label>
          <select
            name="media_provider"
            value={provider}
            onChange={(e) => setProvider(e.target.value)}
            className={`${INPUT_BORDER} w-fit px-2 py-2 text-sm`}
          >
            <option value="youtube">YouTube</option>
            <option value="gdrive">Google Drive</option>
            {contentType === "video" && <option value="file">Файл / пряме посилання (mp4)</option>}
          </select>
        </div>
      )}

      {contentType === "video" && provider !== "file" && (
        <div className="flex flex-col gap-1">
          <label className={LABEL_TEXT}>URL відео</label>
          <input
            ref={mediaUrlRef}
            name="media_url"
            defaultValue={initialBlock?.media_provider !== "file" ? initialBlock?.media_url ?? "" : ""}
            className={`${INPUT_BORDER} px-3 py-2 text-sm`}
          />
        </div>
      )}

      {/* Джерело "file" — пряме посилання на mp4 (власний VideoPlayer, не
          VideoFrame-iframe): URL-поле + завантаження в R2 (той самий
          kind="media", що вже phonetics) + два необов'язкові .vtt-файли
          субтитрів. media_video_file_url/subtitles_fr_file_url/
          subtitles_uk_file_url — приховані поля, перекривають відповідний
          текстовий URL при сабміті (actions.ts), той самий принцип, що
          media_audio_file_url для аудіо. */}
      {contentType === "video" && provider === "file" && (
        <div className="flex flex-col gap-3 rounded-md border border-dashed border-gray-300 p-3 dark:border-neutral-700">
          <div className="flex flex-col gap-1">
            <label className={LABEL_TEXT}>URL відео (mp4) або завантаження файлу</label>
            <div className="flex items-center gap-1">
              <input
                ref={videoFileUrlRef}
                name="media_url"
                defaultValue={initialBlock?.media_provider === "file" ? initialBlock?.media_url ?? "" : ""}
                placeholder="https://..."
                className={`${INPUT_BORDER} flex-1 px-3 py-2 text-sm`}
              />
              <FileUpload
                kind="media"
                variant="icon"
                name="media_video_file_url"
                onUploaded={(url) => {
                  if (videoFileUrlRef.current) videoFileUrlRef.current.value = url;
                }}
              />
            </div>
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              Для файлів понад ~500 МБ завантажте через rclone і вставте посилання.
            </p>
          </div>

          <div className="flex flex-col gap-1">
            <label className={LABEL_TEXT}>Субтитри FR (.vtt)</label>
            <div className="flex items-center gap-1">
              <input
                ref={subsFrUrlRef}
                name="subtitles_fr_url"
                defaultValue={initialSubFr}
                placeholder="https://... .vtt"
                className={`${INPUT_BORDER} flex-1 px-3 py-2 text-sm`}
              />
              <FileUpload
                kind="subtitle"
                variant="icon"
                name="subtitles_fr_file_url"
                onUploaded={(url) => {
                  if (subsFrUrlRef.current) subsFrUrlRef.current.value = url;
                }}
              />
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label className={LABEL_TEXT}>Субтитри UA (.vtt)</label>
            <div className="flex items-center gap-1">
              <input
                ref={subsUkUrlRef}
                name="subtitles_uk_url"
                defaultValue={initialSubUk}
                placeholder="https://... .vtt"
                className={`${INPUT_BORDER} flex-1 px-3 py-2 text-sm`}
              />
              <FileUpload
                kind="subtitle"
                variant="icon"
                name="subtitles_uk_file_url"
                onUploaded={(url) => {
                  if (subsUkUrlRef.current) subsUkUrlRef.current.value = url;
                }}
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
