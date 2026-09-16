export type ParsedLine = {
  speaker: string;
  text: string;
  start: number | null;
  end: number | null;
};

export type ParseResult = { ok: true; lines: ParsedLine[] } | { ok: false; error: string };

// "Ім'я:" на початку рядка — спільна евристика для .txt і для тексту кожного
// cue в .srt/.vtt (жоден із цих форматів не має власного поля спікера).
// Ім'я має починатись із великої літери (латиниця/кирилиця/діакритика) і
// бути коротким (≤40 символів) — знижує хибні спрацювання на звичайних
// реченнях із двокрапкою (напр. "Примітка: щось там").
const SPEAKER_PREFIX = /^\s*([A-ZÀ-ÖØ-ÞА-ЯІЇҐ][\w' -]{0,39}):\s*(.*)$/u;

function extractSpeaker(line: string): { speaker: string; text: string } {
  const match = line.match(SPEAKER_PREFIX);
  if (!match) return { speaker: "", text: line.trim() };
  return { speaker: match[1].trim(), text: match[2].trim() };
}

// "1:23"/"12:34" на початку рядка (вставлений транскрипт із панелі
// "Текстова версія" Google Диска). Хвилини 1-3 цифри, секунди рівно 2
// цифри 00-59, ОБОВ'ЯЗКОВИЙ пробіл після — і те, й інше прив'язане до
// початку рядка (^), тож "14:30" усередині звичайного речення ніколи не
// матчиться, лише справжня позначка часу на початку.
const TIMECODE_PREFIX = /^\s*(\d{1,3}):([0-5]\d)\s+(.+)$/;

function toSeconds(minutes: string, seconds: string): number {
  return Number(minutes) * 60 + Number(seconds);
}

// SRT: "00:00:01,000 --> 00:00:04,000" (кома). VTT: "00:00:01.000 -->
// 00:00:04.000" (крапка), і файл починається з рядка "WEBVTT". Обидва —
// той самий "cue"-принцип (номер/ідентифікатор [необов'язково] + рядок
// таймкоду + один-кілька рядків тексту + порожній рядок), тому один
// парсер на обидва формати.
const TIMECODE_LINE = /^(\d{2}):(\d{2}):(\d{2})[,.](\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2})[,.](\d{3})/;

function parseTimecodeLine(line: string): { start: number; end: number } | null {
  const match = line.match(TIMECODE_LINE);
  if (!match) return null;
  const [, h1, m1, s1, ms1, h2, m2, s2, ms2] = match;
  const start = Number(h1) * 3600 + Number(m1) * 60 + Number(s1) + Number(ms1) / 1000;
  const end = Number(h2) * 3600 + Number(m2) * 60 + Number(s2) + Number(ms2) / 1000;
  return { start, end };
}

export function parseSrtOrVtt(content: string): ParseResult {
  const rawLines = content.split(/\r?\n/);
  const lines: ParsedLine[] = [];
  let i = 0;

  while (i < rawLines.length) {
    const line = rawLines[i];
    const timecode = parseTimecodeLine(line);
    if (!timecode) {
      i++;
      continue;
    }

    // Текст cue — усі рядки після таймкоду, до порожнього рядка/кінця файлу.
    i++;
    const textLines: string[] = [];
    while (i < rawLines.length && rawLines[i].trim() !== "") {
      textLines.push(rawLines[i].trim());
      i++;
    }
    const rawText = textLines.join(" ").trim();
    if (!rawText) continue;

    const { speaker, text } = extractSpeaker(rawText);
    lines.push({ speaker, text, start: timecode.start, end: timecode.end });
  }

  if (lines.length === 0) {
    return { ok: false, error: "Не вдалося розпізнати жодної репліки — перевірте формат файлу." };
  }
  return { ok: true, lines };
}

export function parseTxt(content: string): ParseResult {
  const rawLines = content.split(/\r?\n/);
  const lines: ParsedLine[] = [];

  for (const raw of rawLines) {
    const trimmed = raw.trim();
    if (!trimmed) continue;

    const { speaker, text } = extractSpeaker(trimmed);
    if (speaker) {
      lines.push({ speaker, text, start: null, end: null });
    } else if (lines.length > 0) {
      // Продовження попередньої репліки (перенесення рядка без нового спікера).
      lines[lines.length - 1].text = `${lines[lines.length - 1].text} ${text}`.trim();
    } else {
      lines.push({ speaker: "", text, start: null, end: null });
    }
  }

  if (lines.length === 0) {
    return { ok: false, error: "Файл порожній або не містить розпізнаваного тексту." };
  }
  return { ok: true, lines };
}

// Вставлений транскрипт (панель "Текстова версія" Google Диска) — спікер
// НЕ розпізнається (на відміну від .txt), лише час.
export function parsePastedTranscript(text: string): ParseResult {
  if (!text.trim()) {
    return { ok: false, error: "Порожній текст." };
  }

  const rawLines = text.split(/\r?\n/);
  const lines: ParsedLine[] = [];

  for (const raw of rawLines) {
    const trimmed = raw.trim();
    if (!trimmed) continue;

    const match = trimmed.match(TIMECODE_PREFIX);
    if (match) {
      const [, minutes, seconds, rest] = match;
      lines.push({ speaker: "", text: rest.trim(), start: toSeconds(minutes, seconds), end: null });
    } else if (lines.length > 0) {
      lines[lines.length - 1].text = `${lines[lines.length - 1].text} ${trimmed}`.trim();
    } else {
      lines.push({ speaker: "", text: trimmed, start: null, end: null });
    }
  }

  if (lines.length === 0) {
    return {
      ok: false,
      error: "Не вдалося розпізнати жодного рядка — перевірте, що кожен рядок починається з часу (m:ss).",
    };
  }
  return { ok: true, lines };
}

const EXTENSION_PARSERS: Record<string, (content: string) => ParseResult> = {
  srt: parseSrtOrVtt,
  vtt: parseSrtOrVtt,
  txt: parseTxt,
};

export function parseScriptContent(filename: string, content: string): ParseResult {
  if (!content.trim()) {
    return { ok: false, error: "Файл порожній." };
  }

  const extension = filename.split(".").pop()?.toLowerCase() ?? "";
  const parser = EXTENSION_PARSERS[extension];
  if (!parser) {
    return {
      ok: false,
      error: `Нерозпізнаний формат файлу "${extension || filename}". Підтримуються: .srt, .vtt, .txt.`,
    };
  }

  return parser(content);
}
