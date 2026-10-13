// Мінімальний WebVTT-парсер для VideoPlayer (video-player.tsx) — сирий текст
// .vtt-файлу в масив реплік {start, end, text}. Без нативного <track>
// (VideoPlayer сам малює субтитри, щоб токенізувати слова для майбутнього
// глосарія), тож парсинг — наш, не браузера.

export type WebVttCue = {
  start: number;
  end: number;
  text: string;
};

const TIME_RE = /(\d{2}:)?(\d{2}):(\d{2})\.(\d{3})/;

function parseTimestamp(raw: string): number | null {
  const m = raw.match(TIME_RE);
  if (!m) return null;
  const hours = m[1] ? Number(m[1].replace(":", "")) : 0;
  const minutes = Number(m[2]);
  const seconds = Number(m[3]);
  const millis = Number(m[4]);
  return hours * 3600 + minutes * 60 + seconds + millis / 1000;
}

function stripTags(text: string): string {
  return text.replace(/<[^>]*>/g, "");
}

// Рядок таймінгу — завжди містить "-->"; усе після другого таймкоду (settings
// на кшталт "line:90%") нам не потрібне.
function isTimingLine(line: string): boolean {
  return line.includes("-->");
}

export function parseWebVtt(raw: string): WebVttCue[] {
  const text = raw.replace(/^﻿/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const lines = text.split("\n");

  // Заголовок "WEBVTT" — перший непорожній рядок, ігноруємо його й усе до
  // першого порожнього рядка (можливі метадані заголовка).
  let i = 0;
  while (i < lines.length && lines[i].trim() === "") i++;
  if (i < lines.length && /^WEBVTT/.test(lines[i].trim())) {
    i++;
    while (i < lines.length && lines[i].trim() !== "") i++;
  }

  const cues: WebVttCue[] = [];

  while (i < lines.length) {
    // Пропустити порожні рядки між блоками.
    while (i < lines.length && lines[i].trim() === "") i++;
    if (i >= lines.length) break;

    const blockStart = i;
    while (i < lines.length && lines[i].trim() !== "") i++;
    const block = lines.slice(blockStart, i);

    const first = block[0]?.trim() ?? "";
    if (first.startsWith("NOTE") || first.startsWith("STYLE") || first.startsWith("REGION")) {
      continue;
    }

    // Рядок 0 — або вже таймінг, або ідентифікатор репліки (тоді таймінг —
    // рядок 1).
    let timingLineIndex = 0;
    if (!isTimingLine(block[0] ?? "") && isTimingLine(block[1] ?? "")) {
      timingLineIndex = 1;
    }
    const timingLine = block[timingLineIndex];
    if (!timingLine || !isTimingLine(timingLine)) continue;

    const [startRaw, endRaw] = timingLine.split("-->");
    const start = parseTimestamp(startRaw ?? "");
    const end = parseTimestamp((endRaw ?? "").trim());
    if (start === null || end === null) continue;

    const textLines = block.slice(timingLineIndex + 1);
    const cueText = stripTags(textLines.join("\n")).trim();
    if (!cueText) continue;

    cues.push({ start, end, text: cueText });
  }

  return cues;
}
