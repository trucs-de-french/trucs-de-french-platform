"use client";

import { useEffect, useRef, useState } from "react";
import { AudioPlayer } from "@/components/audio-player";
import { toDirectDownloadUrl, toEmbedUrl } from "@/lib/video";

const STALL_TIMEOUT_MS = 8000;

// Гібрид, дослідження перед стартом (для контексту, чому саме так):
// пряме gdrive-посилання (uc?export=download) — неофіційний метод, не
// задокументований Google API. Надійний для файлів, що влазять у ліміт
// антивірусної перевірки Drive (тоді працює звичайний <audio> з нашими
// кнопками швидкості 0.5x-2x); для більших файлів Google повертає
// HTML-сторінку попередження замість байтів — тому спершу пробуємо пряме
// відтворення, і лише при провалі падаємо на iframe-плеєр Drive (/preview,
// офіційно підтримуваний Google, без контролю швидкості).
//
// Три сигнали провалу, у порядку надійності:
// 1. onError — надійний: браузер не зміг декодувати HTML-сторінку
//    попередження як аудіо, завжди спрацьовує для цього випадку.
// 2. onStalled — додатковий захист: нативна подія, що часто спрацьовує,
//    коли Range-запит підвисає (не гарантія, реальний сигнал браузера).
// 3. Таймер (STALL_TIMEOUT_MS): якщо onLoadedMetadata не спрацював за цей
//    час — запит завис без явної помилки й без onStalled.
//
// ЗАЛИШКОВИЙ РИЗИК, свідомо НЕ покритий жодним із трьох сигналів: якщо
// відтворення СПОЧАТКУ успішно стартувало (onLoadedMetadata спрацював,
// таймер очистився), а перемотування ДАЛІ в треку зазнає провалу через
// відсутню/неповну підтримку Range-запитів на боці Drive — це може статись
// мовчки, без onError/onStalled. Автоматичного перемикання на iframe у
// цьому сценарії немає (студент лишиться зі зламаним прямим плеєром
// посеред прослуховування) — компроміс, прийнятий свідомо: перемикання
// плеєра "на льоту" під час відтворення саме по собі було б гіршим UX, ніж
// рідкісний зламаний seek, і посилання "перейти за посиланням" нижче
// лишається робочим резервом для студента в цьому випадку.
export function GdriveAudioPlayer({ url, className }: { url: string; className?: string }) {
  const [failed, setFailed] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (failed) return;
    timeoutRef.current = setTimeout(() => setFailed(true), STALL_TIMEOUT_MS);
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [failed]);

  function clearStallTimeout() {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }

  return (
    <div className={className}>
      {!failed ? (
        <AudioPlayer
          src={toDirectDownloadUrl(url)}
          onError={() => setFailed(true)}
          onStalled={() => setFailed(true)}
          onLoadedMetadata={clearStallTimeout}
        />
      ) : (
        <div className="overflow-hidden rounded-md border" style={{ height: 140 }}>
          <iframe src={toEmbedUrl(url, "gdrive")} className="h-full w-full" allow="autoplay" />
        </div>
      )}
      {/* Завжди видимий резервний варіант — останній рубіж, якщо ні прямий
          плеєр, ні iframe-резерв не спрацюють (той самий принцип, що
          video/embed-гілки в task-group-block.tsx). */}
      <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
        Якщо аудіо не відкривається,{" "}
        <a href={url} target="_blank" rel="noopener noreferrer" className="underline">
          перейдіть за посиланням
        </a>
        .
      </p>
    </div>
  );
}
