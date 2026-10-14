"use server";

import { createClient } from "@/lib/supabase/server";
import { parseWebVtt } from "@/lib/webvtt";
import { pairVttCues, groupCuesIntoSentences } from "./vtt-pairing";

const MAX_SPEAKER_LENGTH = 60;

export type ImportedDialogueLine = { speaker: string; text: string; translationUk: string | null };

export type ImportFromVideoSubtitlesResult =
  | { ok: true; lines: ImportedDialogueLine[]; matchedCount: number; ukWarning: string | null }
  | { ok: false; error: string };

// Лише текстові субтитри — кілька сотень КБ навіть для повнометражного
// фільму (той самий порядок, що MAX_FILE_SIZE у script-import/actions.ts).
const MAX_VTT_SIZE = 1024 * 1024;
const FETCH_TIMEOUT_MS = 8000;

// SSRF-захист: фетчимо лише з нашого публічного R2-хоста (той самий
// NEXT_PUBLIC_... базовий URL, яким підписуються завантажені файли в
// r2-upload-url/route.ts) — довільний URL з форми НЕ приймаємо.
function isAllowedSubtitleUrl(url: string): boolean {
  const base = process.env.R2_PUBLIC_URL;
  if (!base) return false;
  try {
    return new URL(url).origin === new URL(base).origin;
  } catch {
    return false;
  }
}

async function fetchVttText(url: string): Promise<{ ok: true; text: string } | { ok: false; error: string }> {
  if (!isAllowedSubtitleUrl(url)) {
    return { ok: false, error: "Дозволені лише посилання на наше сховище файлів (R2)." };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) {
      return { ok: false, error: `Не вдалося завантажити файл субтитрів (код ${res.status}).` };
    }
    const lengthHeader = res.headers.get("content-length");
    if (lengthHeader && Number(lengthHeader) > MAX_VTT_SIZE) {
      return { ok: false, error: "Файл субтитрів завеликий." };
    }
    const text = await res.text();
    if (text.length > MAX_VTT_SIZE) {
      return { ok: false, error: "Файл субтитрів завеликий." };
    }
    return { ok: true, text };
  } catch {
    return { ok: false, error: "Не вдалося завантажити файл субтитрів (недосяжний або час очікування вийшов)." };
  } finally {
    clearTimeout(timeout);
  }
}

export async function importDialogueFromVideoSubtitles(
  frUrl: string,
  ukUrl: string | null,
  options?: { mergeSentences?: boolean; defaultSpeaker?: string | null }
): Promise<ImportFromVideoSubtitlesResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Потрібен вхід." };

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "teacher") return { ok: false, error: "Доступно лише викладачу." };

  if (!frUrl.trim()) return { ok: false, error: "Немає FR субтитрів для імпорту." };

  const frResult = await fetchVttText(frUrl);
  if (!frResult.ok) return { ok: false, error: frResult.error };

  const frCues = parseWebVtt(frResult.text);
  if (frCues.length === 0) {
    return { ok: false, error: "Файл FR субтитрів порожній або не є валідним WebVTT." };
  }

  let ukCues: ReturnType<typeof parseWebVtt> = [];
  let ukWarning: string | null = null;
  if (ukUrl?.trim()) {
    const ukResult = await fetchVttText(ukUrl);
    if (ukResult.ok) {
      ukCues = parseWebVtt(ukResult.text);
      if (ukCues.length === 0) ukWarning = "Файл UA субтитрів порожній або не є валідним WebVTT — переклад не додано.";
    } else {
      ukWarning = ukResult.error;
    }
  }

  const mergeSentences = options?.mergeSentences ?? true;
  const speaker = (options?.defaultSpeaker ?? "").trim().slice(0, MAX_SPEAKER_LENGTH);

  const paired = mergeSentences ? groupCuesIntoSentences(frCues, ukCues) : pairVttCues(frCues, ukCues);
  const lines: ImportedDialogueLine[] = paired.map((p) => ({ speaker, text: p.text, translationUk: p.translationUk }));
  const matchedCount = lines.filter((l) => l.translationUk).length;

  return { ok: true, lines, matchedCount, ukWarning };
}
