"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Paperclip } from "lucide-react";

type UploadKind = "audio" | "image";

const ACCEPT_BY_KIND: Record<UploadKind, string> = {
  audio: "audio/*",
  image: "image/*",
};

const LABEL_BY_KIND: Record<UploadKind, string> = {
  audio: "📎 Завантажити аудіо",
  image: "📎 Завантажити зображення",
};

// Завантаження НАПРЯМУ з браузера в Cloudflare R2 (не через наш
// сервер/Server Action) — обходить і ліміт розміру тіла Server Actions
// (1MB за замовчуванням), і буфер proxy-шару Next.js 16 (src/proxy.ts,
// 10MB), і жорсткий ліміт payload serverless-функції Netlify (~6MB) —
// жоден з них не застосовується, бо байти файлу йдуть напряму на
// *.r2.cloudflarestorage.com, а не на наш домен.
//
// На відміну від Supabase (де браузер сам генерує підписаний URL через
// сесію), R2/S3 presigned URL можна згенерувати лише на сервері — секретний
// ключ ніяк не можна віддати браузеру. Тому тут два кроки замість одного:
// 1) POST /api/r2-upload-url (ім'я файлу + MIME-тип + kind) — повертає
//    підписаний URL; 2) PUT напряму на *.r2.cloudflarestorage.com з
//    байтами файлу. Лише крок 2 несе вагу файлу.
//
// Два режими виводу результату — не через два окремі компоненти, а через
// два опційні пропи:
// - `name` — прихований <input>, для полів, які сервер читає напряму з
//   FormData при сабміті (task_image_url, cover_image_url тощо).
// - `onUploaded` — callback, для полів УСЕРЕДИНІ масиву в React-стані
//   (варіанти multiple_choice, картки flip_cards тощо) — там немає
//   окремого named form-field, весь масив серіалізується в один JSON при
//   сабміті, тож URL потрібно записати прямо в стан батьківського
//   компонента, а не в прихований input.
export function FileUpload({
  kind,
  name,
  onUploaded,
  variant = "button",
}: {
  kind: UploadKind;
  name?: string;
  onUploaded?: (url: string) => void;
  // "icon" — компактний тригер (скрепка, без тексту) для розміщення в
  // одному рядку поруч з іншим полем (напр. URL картинки словника) — той
  // самий icon-only рецепт, що вже Copy/Trash2 по платформі. За
  // замовчуванням "button" — усі наявні виклики лишаються без змін.
  variant?: "button" | "icon";
}) {
  const [status, setStatus] = useState<"idle" | "uploading" | "done" | "error">("idle");
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [uploadedUrl, setUploadedUrl] = useState("");
  const [fileName, setFileName] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const inputId = useId();

  useEffect(() => {
    if (status !== "uploading") return;
    const interval = setInterval(() => setElapsedSeconds((s) => s + 1), 1000);
    return () => clearInterval(interval);
  }, [status]);

  async function handleFileChange(file: File) {
    setStatus("uploading");
    setElapsedSeconds(0);
    setErrorMessage("");
    setFileName(file.name);

    try {
      const prepRes = await fetch("/api/r2-upload-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename: file.name,
          contentType: file.type || "application/octet-stream",
          kind,
        }),
      });
      const prep = (await prepRes.json()) as {
        uploadUrl?: string;
        publicUrl?: string;
        contentType?: string;
        error?: string;
      };
      if (!prepRes.ok || !prep.uploadUrl || !prep.publicUrl) {
        setStatus("error");
        setErrorMessage(prep.error ?? "Не вдалося підготувати завантаження");
        return;
      }

      // contentType — саме те значення, яке сервер щойно використав для
      // підпису URL (не file.type напряму) — гарантує точний збіг між
      // підписом і фактичним запитом.
      const uploadRes = await fetch(prep.uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": prep.contentType ?? file.type },
        body: file,
      });
      if (!uploadRes.ok) {
        setStatus("error");
        setErrorMessage(`R2 повернув помилку (${uploadRes.status})`);
        return;
      }

      setUploadedUrl(prep.publicUrl);
      onUploaded?.(prep.publicUrl);
      setStatus("done");
    } catch (error) {
      setStatus("error");
      setErrorMessage(error instanceof Error ? error.message : "Невідома помилка мережі");
    }
  }

  return (
    <div className="flex flex-col gap-1">
      {/* sr-only, не hidden — приховано лише візуально, лишається доступним
          з клавіатури/скрінрідера. <label htmlFor> відкриває системний
          діалог вибору файлу без жодного JS — стандартна HTML-поведінка,
          що не спрацьовує лише коли сам input вимкнений (status
          "uploading"), тому лейбл нижче додатково притлумлений тоді ж. */}
      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept={ACCEPT_BY_KIND[kind]}
        disabled={status === "uploading"}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleFileChange(file);
        }}
        className="sr-only"
      />
      <label
        htmlFor={inputId}
        title={variant === "icon" ? LABEL_BY_KIND[kind] : undefined}
        aria-label={variant === "icon" ? LABEL_BY_KIND[kind] : undefined}
        className={
          variant === "icon"
            ? `inline-flex w-fit shrink-0 items-center justify-center rounded p-1.5 text-neutral-400 hover:text-neutral-600 dark:text-neutral-500 dark:hover:text-neutral-300 ${
                status === "uploading" ? "pointer-events-none opacity-50" : "cursor-pointer"
              }`
            : `w-fit rounded-md bg-neutral-100 px-3 py-1.5 text-sm text-neutral-700 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700 ${
                status === "uploading" ? "pointer-events-none opacity-50" : "cursor-pointer"
              }`
        }
      >
        {variant === "icon" ? <Paperclip size={16} /> : LABEL_BY_KIND[kind]}
      </label>
      {status === "uploading" && (
        <p className="text-xs text-neutral-500 dark:text-neutral-400">
          <span className="inline-block animate-pulse">⏳</span> Завантажую &laquo;{fileName}
          &raquo;... {elapsedSeconds}с
        </p>
      )}
      {status === "done" && (
        <p className="text-xs text-green-600 dark:text-green-400">
          ✓ Завантажено: {fileName}
        </p>
      )}
      {status === "error" && (
        <div className="flex flex-col gap-1">
          <p className="text-xs text-red-600 dark:text-red-400">
            Не вдалося завантажити файл: {errorMessage}
          </p>
          <button
            type="button"
            onClick={() => {
              setStatus("idle");
              setErrorMessage("");
              if (inputRef.current) inputRef.current.value = "";
            }}
            className="w-fit rounded border px-2 py-0.5 text-xs hover:bg-neutral-50 dark:hover:bg-neutral-800"
          >
            Спробувати ще раз
          </button>
        </div>
      )}
      {/* Лише в режимі name= — у режимі onUploaded= прихований input не
          потрібен, URL уже записаний у стан батьківського компонента. */}
      {name && (
        <input type="hidden" name={name} value={uploadedUrl} readOnly />
      )}
    </div>
  );
}
