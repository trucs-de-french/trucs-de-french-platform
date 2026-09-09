"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

const BUCKET = "task-audio";

// Завантаження НАПРЯМУ з браузера в Supabase Storage (не через наш
// сервер/Server Action) — обходить і ліміт розміру тіла Server Actions
// (1MB за замовчуванням), і буфер proxy-шару Next.js 16 (src/proxy.ts,
// 10MB), і жорсткий ліміт payload serverless-функції Netlify (~6MB) —
// жоден з них не застосовується, бо байти файлу йдуть напряму на
// *.supabase.co, а не на наш домен. Це й було причиною краху сторінки при
// завантаженні великих (десятки MB) mp3 через попередній підхід (файл ішов
// через FormData у Server Action).
//
// uploadToSignedUrl() (офіційний метод @supabase/storage-js), НЕ
// самописний XMLHttpRequest — свідомий вибір: реальний % прогресу
// потребував би відтворення внутрішнього формату запиту бібліотеки
// вручну, без можливості перевірити це наживо тут. Гарантована коректність
// важливіша за точний відсоток — індикатор нижче лише повідомляє "процес
// іде" (анімація + секундомір), без обіцянки byte-accurate прогресу.
//
// RLS на storage.objects (0033_task_audio_storage.sql, is_teacher()) діє
// однаково незалежно від того, викликає це сервер чи браузер — той самий
// автентифікований сеанс вчителя, жодних додаткових прав не треба.
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

    const supabase = createClient();
    const ext = file.name.split(".").pop() || "mp3";
    const path = `${crypto.randomUUID()}.${ext}`;

    const { data: signed, error: signError } = await supabase.storage
      .from(BUCKET)
      .createSignedUploadUrl(path);
    if (signError || !signed) {
      setStatus("error");
      setErrorMessage(signError?.message ?? "Не вдалося підготувати завантаження");
      return;
    }

    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .uploadToSignedUrl(path, signed.token, file);
    if (uploadError) {
      setStatus("error");
      setErrorMessage(uploadError.message);
      return;
    }

    const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
    setUploadedUrl(data.publicUrl);
    setStatus("done");
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
