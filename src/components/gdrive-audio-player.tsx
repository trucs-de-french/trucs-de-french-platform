"use client";

import { useEffect, useRef, useState } from "react";
import { AudioPlayer } from "@/components/audio-player";
import { toDirectDownloadUrl, toEmbedUrl } from "@/lib/video";

const STALL_TIMEOUT_MS = 8000;

// ТИМЧАСОВЕ діагностичне логування — той самий підхід, що вже спрацював
// для theme-бага раніше цієї сесії (console.log + збір з консолі
// браузера), для діагностики стабільного падіння конкретного gdrive-файлу
// ("Exercice 2"), яке curl не відтворив (мережевий рівень для цього файлу
// виглядає ідентичним до робочого файлу "CO Test 1" — отже причина десь
// між реальним браузерним запитом і рендером <audio>). Прибрати після
// діагностики.
const MEDIA_ERROR_CODES: Record<number, string> = {
  1: "MEDIA_ERR_ABORTED",
  2: "MEDIA_ERR_NETWORK",
  3: "MEDIA_ERR_DECODE",
  4: "MEDIA_ERR_SRC_NOT_SUPPORTED",
};
const NETWORK_STATES: Record<number, string> = {
  0: "NETWORK_EMPTY",
  1: "NETWORK_IDLE",
  2: "NETWORK_LOADING",
  3: "NETWORK_NO_SOURCE",
};
const READY_STATES: Record<number, string> = {
  0: "HAVE_NOTHING",
  1: "HAVE_METADATA",
  2: "HAVE_CURRENT_DATA",
  3: "HAVE_FUTURE_DATA",
  4: "HAVE_ENOUGH_DATA",
};

function logMediaState(label: string, url: string, startedAt: number, audio: HTMLAudioElement | null) {
  const elapsedMs = Date.now() - startedAt;
  const err = audio?.error;
  console.log(`[gdrive-audio-debug] ${label}`, {
    url,
    directSrc: audio?.currentSrc,
    elapsedMs,
    networkState: audio ? `${audio.networkState} (${NETWORK_STATES[audio.networkState] ?? "?"})` : undefined,
    readyState: audio ? `${audio.readyState} (${READY_STATES[audio.readyState] ?? "?"})` : undefined,
    errorCode: err ? `${err.code} (${MEDIA_ERROR_CODES[err.code] ?? "?"})` : null,
    errorMessage: err?.message || null,
    currentTime: audio?.currentTime,
    duration: audio?.duration,
  });
}

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
  const startedAtRef = useRef(0);
  // Потрібен, щоб таймер (нижче) міг залогувати networkState/readyState —
  // на відміну від onError/onStalled, таймер не отримує React-подію з
  // currentTarget, тож без цього рефу ми бачили б лише "таймер спрацював",
  // без жодних деталей про стан аудіо в цей момент.
  const audioElRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    if (failed) return;
    startedAtRef.current = Date.now();
    console.log("[gdrive-audio-debug] mount, starting direct-play attempt", {
      url,
      directSrc: toDirectDownloadUrl(url),
      timeoutMs: STALL_TIMEOUT_MS,
    });
    timeoutRef.current = setTimeout(() => {
      logMediaState("STALL TIMEOUT fired — no loadedmetadata within timeoutMs, switching to iframe", url, startedAtRef.current, audioElRef.current);
      setFailed(true);
    }, STALL_TIMEOUT_MS);
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [failed, url]);

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
          ref={audioElRef}
          src={toDirectDownloadUrl(url)}
          onError={(e) => {
            logMediaState("ERROR event — switching to iframe", url, startedAtRef.current, e.currentTarget);
            setFailed(true);
          }}
          onStalled={(e) => {
            logMediaState("STALLED event — switching to iframe", url, startedAtRef.current, e.currentTarget);
            setFailed(true);
          }}
          onLoadedMetadata={(e) => {
            logMediaState("loadedmetadata OK — direct play succeeded", url, startedAtRef.current, e.currentTarget);
            clearStallTimeout();
          }}
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
