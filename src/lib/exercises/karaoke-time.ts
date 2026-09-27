// Компактний формат мм:сс.с для ручного уточнення часу початку рядка в
// конструкторі караоке (karaoke-fields.tsx) — formatTime завжди повертає
// цей вигляд; parseTime приймає його ж, а також голі секунди ("75.3") як
// зручний альтернативний ввід (напр. якщо вчителька копіює число з іншого
// джерела).
export function formatTime(seconds: number): string {
  const total = Math.max(0, seconds);
  const m = Math.floor(total / 60);
  const s = total - m * 60;
  return `${String(m).padStart(2, "0")}:${s.toFixed(1).padStart(4, "0")}`;
}

export function parseTime(value: string): number | null {
  const trimmed = value.trim();
  const mmss = trimmed.match(/^(\d+):(\d+(?:\.\d+)?)$/);
  if (mmss) {
    return Number(mmss[1]) * 60 + Number(mmss[2]);
  }
  const plain = Number(trimmed);
  return Number.isFinite(plain) && trimmed !== "" ? plain : null;
}

// Мітка часу на самому початку вставленого рядка тексту — [m:ss], [mm:ss],
// [m:ss.x] чи [mm:ss.xx] (1-2 цифри хвилин, рівно 2 цифри секунд, опційна
// дробова частина 1-2 цифри) — те, у якому форматі експортують субтитри/
// LRC-подібні джерела. \s* наприкінці — щоб пробіл після дужки теж пішов
// разом із міткою, не лишаючи зайвого пробілу на початку тексту рядка.
const LEADING_TIME_LABEL_RE = /^\[(\d{1,2}):(\d{2})(?:\.(\d{1,2}))?\]\s*/;

export function extractLeadingTimeLabel(text: string): { seconds: number; rest: string } | null {
  const match = text.match(LEADING_TIME_LABEL_RE);
  if (!match) return null;

  const minutes = Number(match[1]);
  const secs = Number(match[2]);
  const frac = match[3] ? Number(`0.${match[3]}`) : 0;

  return { seconds: minutes * 60 + secs + frac, rest: text.slice(match[0].length) };
}
