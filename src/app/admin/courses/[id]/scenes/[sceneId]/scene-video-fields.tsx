"use client";

import { useRef, useState } from "react";
import { FileUpload } from "@/components/file-upload";
import { INPUT_BORDER } from "@/lib/input-styles";
import { LABEL_TEXT } from "@/lib/typography-styles";
import { useVideoSubtitlesUrls } from "./video-subtitles-state";

// Той самий блок "Файл / пряме посилання (mp4)", що вже в
// ContentBlockFields/TaskGroupFields (коміт 7ccca03) — ТРЕТІЙ окремий домен
// (scenes.video_url/video_provider, 0001, НЕ scene_content_blocks/task_groups,
// 0036/0031), тож навмисна дуплікація тієї самої розмітки, не спільний
// імпорт — той самий принцип, що вже задокументований для цих двох.
// Контролюється тут (не в page.tsx — Server Component без стану), бо
// потрібен useState для провайдера: видимість полів "URL відео"/файл+субтитри
// залежить від обраного значення.
export function SceneVideoFields({
  initialUrl,
  initialProvider,
  initialSubtitles,
}: {
  initialUrl: string;
  initialProvider: string;
  initialSubtitles?: { lang: "fr" | "uk"; url: string }[] | null;
}) {
  const [provider, setProvider] = useState(initialProvider || "youtube");
  const mediaUrlRef = useRef<HTMLInputElement>(null);
  const videoFileUrlRef = useRef<HTMLInputElement>(null);
  const initialSubFr = initialSubtitles?.find((s) => s.lang === "fr")?.url ?? "";
  const initialSubUk = initialSubtitles?.find((s) => s.lang === "uk")?.url ?? "";

  // Контрольовані (через VideoSubtitlesProvider, якщо є) — щоб кнопка
  // імпорту скрипту в DialogueEditor бачила щойно введений/завантажений URL
  // ще до збереження цієї форми. useState — лише фолбек, якщо колись
  // SceneVideoFields опиниться без Provider.
  const subsCtx = useVideoSubtitlesUrls();
  const [localSubFr, setLocalSubFr] = useState(initialSubFr);
  const [localSubUk, setLocalSubUk] = useState(initialSubUk);
  const subFr = subsCtx?.subFr ?? localSubFr;
  const subUk = subsCtx?.subUk ?? localSubUk;
  const setSubFr = subsCtx?.setSubFr ?? setLocalSubFr;
  const setSubUk = subsCtx?.setSubUk ?? setLocalSubUk;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-4">
        {provider !== "file" && (
          <div className="flex flex-1 flex-col gap-1">
            <label className={LABEL_TEXT}>URL відео</label>
            <input
              ref={mediaUrlRef}
              name="video_url"
              defaultValue={initialProvider !== "file" ? initialUrl : ""}
              className={`${INPUT_BORDER} px-3 py-2`}
            />
          </div>
        )}
        <div className="flex flex-col gap-1">
          <label className={LABEL_TEXT}>Джерело</label>
          <select
            name="video_provider"
            value={provider}
            onChange={(e) => setProvider(e.target.value)}
            className={`${INPUT_BORDER} px-3 py-2`}
          >
            <option value="youtube">YouTube</option>
            <option value="gdrive">Google Drive</option>
            <option value="file">Файл / пряме посилання (mp4)</option>
          </select>
        </div>
      </div>

      {/* Той самий блок, що ContentBlockFields/TaskGroupFields — URL+завантаження
          mp4 (kind="media") і два необов'язкові .vtt-поля (kind="subtitle"). */}
      {provider === "file" && (
        <div className="flex flex-col gap-3 rounded-md border border-dashed border-gray-300 p-3 dark:border-neutral-700">
          <div className="flex flex-col gap-1">
            <label className={LABEL_TEXT}>URL відео (mp4) або завантаження файлу</label>
            <div className="flex items-center gap-1">
              <input
                ref={videoFileUrlRef}
                name="video_url"
                defaultValue={initialProvider === "file" ? initialUrl : ""}
                placeholder="https://..."
                className={`${INPUT_BORDER} flex-1 px-3 py-2 text-sm`}
              />
              <FileUpload
                kind="media"
                variant="icon"
                name="video_file_url"
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
                name="subtitles_fr_url"
                value={subFr}
                onChange={(e) => setSubFr(e.target.value)}
                placeholder="https://... .vtt"
                className={`${INPUT_BORDER} flex-1 px-3 py-2 text-sm`}
              />
              <FileUpload
                kind="subtitle"
                variant="icon"
                name="subtitles_fr_file_url"
                onUploaded={(url) => setSubFr(url)}
              />
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label className={LABEL_TEXT}>Субтитри UA (.vtt)</label>
            <div className="flex items-center gap-1">
              <input
                name="subtitles_uk_url"
                value={subUk}
                onChange={(e) => setSubUk(e.target.value)}
                placeholder="https://... .vtt"
                className={`${INPUT_BORDER} flex-1 px-3 py-2 text-sm`}
              />
              <FileUpload
                kind="subtitle"
                variant="icon"
                name="subtitles_uk_file_url"
                onUploaded={(url) => setSubUk(url)}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
