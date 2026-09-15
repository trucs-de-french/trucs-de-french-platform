"use client";

import { useState } from "react";
import { InstructionsRichTextField } from "../tasks/instructions-rich-text-field";
import { FileUpload } from "@/components/file-upload";
import { INPUT_BORDER } from "@/lib/input-styles";
import { LABEL_TEXT } from "@/lib/typography-styles";

export type ContentBlockInitial = {
  title?: string | null;
  content_type?: string;
  content_text?: string | null;
  media_url?: string | null;
  media_provider?: string | null;
};

// Дубльовано з task-group-fields.tsx (та сама секція вибору типу контенту +
// полів під нього) — навмисно, не спільний компонент: two різних домени
// (див. коментар у 0036_scene_content_blocks.sql), яким випадково збігається
// форма полів; той самий принцип навмисної дуплікації для полів-редакторів,
// що вже задокументований у material-article-fields.tsx.
export function ContentBlockFields({ initialBlock }: { initialBlock?: ContentBlockInitial }) {
  const [contentType, setContentType] = useState(initialBlock?.content_type ?? "text");

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
          <option value="links">Практика (посилання)</option>
        </select>
      </div>

      {contentType === "text" && (
        <InstructionsRichTextField
          name="content_text"
          label="Текст"
          initialValue={initialBlock?.content_text ?? ""}
        />
      )}

      {(contentType === "audio" || contentType === "video" || contentType === "embed") && (
        <div className="flex flex-col gap-1">
          <label className={LABEL_TEXT}>
            {contentType === "audio"
              ? "URL аудіо"
              : contentType === "video"
                ? "URL відео"
                : "URL для вбудовування (iframe src)"}
          </label>
          <input
            name="media_url"
            defaultValue={initialBlock?.media_url ?? ""}
            className={`${INPUT_BORDER} px-3 py-2 text-sm`}
          />
        </div>
      )}

      {contentType === "audio" && (
        <div className="flex flex-col gap-1">
          <label className={LABEL_TEXT}>
            Або завантажити аудіофайл (перекриє URL вище, якщо вибрано)
          </label>
          <FileUpload kind="audio" name="media_audio_file_url" />
        </div>
      )}

      {(contentType === "video" || contentType === "audio") && (
        <div className="flex flex-col gap-1">
          <label className={LABEL_TEXT}>Платформа</label>
          <select
            name="media_provider"
            defaultValue={initialBlock?.media_provider ?? "youtube"}
            className={`${INPUT_BORDER} w-fit px-2 py-2 text-sm`}
          >
            <option value="youtube">YouTube</option>
            <option value="gdrive">Google Drive</option>
          </select>
        </div>
      )}
    </>
  );
}
