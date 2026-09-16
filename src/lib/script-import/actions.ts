"use server";

import { parseScriptContent, type ParseResult } from "./parse";

// Ліміт лише для файлового шляху (тут є реальний File-об'єкт, вартий
// перевірки на сервері) — вставлений транскрипт це просто рядок, уже в
// браузері, парситься напряму на клієнті (parsePastedTranscript), без
// звернення сюди. 300 КБ — з великим запасом для .srt/.vtt/.txt (це
// текстові файли, навіть повнометражний фільм — це лічені сотні КБ).
const MAX_FILE_SIZE = 300 * 1024;

export async function parseScriptFile(formData: FormData): Promise<ParseResult> {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "Файл порожній." };
  }
  if (file.size > MAX_FILE_SIZE) {
    return { ok: false, error: "Файл завеликий (максимум 300 КБ для текстового сценарію)." };
  }

  const content = await file.text();
  return parseScriptContent(file.name, content);
}
