"use client";

import { useEffect, useRef, useState } from "react";

// Завантаження НАПРЯМУ з браузера в Cloudflare R2 (не через наш
// сервер/Server Action) — обходить і ліміт розміру тіла Server Actions
// (1MB за замовчуванням), і буфер proxy-шару Next.js 16 (src/proxy.ts,
// 10MB), і жорсткий ліміт payload serverless-функції Netlify (~6MB) —
// жоден з них не застосовується, бо байти файлу йдуть напряму на
// *.r2.cloudflarestorage.com, а не на наш домен. Той самий принцип, що
// раніше був реалізований для Supabase Storage (звідки й мігрували —
// R2 не має плати за egress-трафік, вигідніше на очікуваному масштабі).
//
// На відміну від Supabase (де браузер сам генерує підписаний URL через
// сесію), R2/S3 presigned URL можна згенерувати лише на сервері — секретний
// ключ ніяк не можна віддати браузеру. Тому тут два кроки замість одного:
// 1) POST /api/r2-upload-url — крихітний запит (ім'я файлу + MIME-тип),
//    повертає підписаний URL; 2) PUT напряму на *.r2.cloudflarestorage.com
//    з байтами файлу. Лише крок 2 несе вагу файлу, і саме він обходить наш
//    сервер повністю.
//
// Ручний fetch(), не бібліотека — та сама причина, що раніше для Supabase:
// реальний % прогресу вимагав би XMLHttpRequest з відстеженням progress-
// подій, що не протестовано наживо тут. Індикатор нижче — лише "процес
// іде" (анімація + секундомір), без обіцянки byte-accurate прогресу.
export function AudioFileUpload({ name }: { name: string }) {
  const [status, setStatus] = useState<"idle" | "uploading" | "done" | "error">("idle");
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [uploadedUrl, setUploadedUrl] = useState("");
  const [fileName, setFileName] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

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
      setStatus("done");
    } catch (error) {
      setStatus("error");
      setErrorMessage(error instanceof Error ? error.message : "Невідома помилка мережі");
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <input
        ref={inputRef}
        type="file"
        accept="audio/*"
        disabled={status === "uploading"}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleFileChange(file);
        }}
        className="text-sm"
      />
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
      {/* Порожній рядок — коректно (== "нічого не завантажено"), сервер
          трактує через `|| null`/truthy-перевірку так само, як порожнє
          текстове поле URL. */}
      <input type="hidden" name={name} value={uploadedUrl} />
    </div>
  );
}
