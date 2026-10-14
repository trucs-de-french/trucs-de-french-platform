import type { WebVttCue } from "@/lib/webvtt";

export type PairedVttLine = { text: string; translationUk: string | null };

// Якщо кількість cues однакова — пара за індексом (найнадійніше, коли FR і
// UK .vtt зроблені з того самого оригінального розбиття). Інакше — для
// кожної FR cue шукаємо UK cue з найближчим часом початку, у межах 1 с
// (TOLERANCE_SECONDS); далі — без пари (null), без спливу помилки (сценарій
// заповнюється, перевіряється вчителькою вручну).
const TOLERANCE_SECONDS = 1;

function cleanCueText(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

// Один FR cue (за індексом у frCues) -> текст UK cue, за правилом вище.
// Спільний для pairVttCues (пара "один cue — один рядок") і
// groupCuesIntoSentences (де та сама пара-за-cue обчислюється для КОЖНОГО
// cue групи окремо, а тексти потім склеюються — завдання прямо вимагає
// "attach UK cues by the existing nearest-start-time pairing first, then
// join the UK pieces that fall into the same group").
function ukTextForFrCueIndex(frCues: WebVttCue[], ukCues: WebVttCue[], index: number): string | null {
  if (ukCues.length === 0) return null;

  if (frCues.length === ukCues.length) {
    return cleanCueText(ukCues[index].text) || null;
  }

  let best: WebVttCue | null = null;
  let bestDiff = Infinity;
  for (const uk of ukCues) {
    const diff = Math.abs(uk.start - frCues[index].start);
    if (diff < bestDiff) {
      bestDiff = diff;
      best = uk;
    }
  }
  return best && bestDiff <= TOLERANCE_SECONDS ? cleanCueText(best.text) || null : null;
}

export function pairVttCues(frCues: WebVttCue[], ukCues: WebVttCue[]): PairedVttLine[] {
  const result: PairedVttLine[] = [];

  for (let i = 0; i < frCues.length; i++) {
    const text = cleanCueText(frCues[i].text);
    if (!text) continue;

    result.push({ text, translationUk: ukTextForFrCueIndex(frCues, ukCues, i) });
  }

  return result;
}

// Фільмові субтитри часто рвуть одне речення на кілька коротких cues
// ("Même si bien d'autres nations aimeraient" / "pouvoir nous disputer le
// titre,") — без об'єднання вчителька отримує скрипт із купою фрагментів
// замість реплік. Групуємо послідовні FR cues в один рядок, поки НЕ
// трапиться одна з трьох меж (перша зі спрацьованих закриває групу):
//   1. поточний cue закінчується на . ! ? … (можливо, після закриваючих
//      лапок/дужок — ." .» .)) — SENTENCE_END_RE;
//   2. розрив між кінцем поточного cue й початком наступного >= 2 с
//      (GAP_SECONDS) — тривала пауза, навіть якщо пунктуації нема;
//   3. додавання наступного cue зробило б об'єднаний текст довшим за
//      ~220 символів (MAX_GROUP_CHARS) — захист від одного величезного
//      рядка, якщо і пунктуації, і пауз довго нема.
// Кома/крапка з комою/рядок, що починається з малої літери, — НЕ межа
// (саме вони й мають склеюватись в одну репліку).
const SENTENCE_END_RE = /[.!?…][”"»')\]]*$/u;
const GAP_SECONDS = 2;
const MAX_GROUP_CHARS = 220;

export function groupCuesIntoSentences(frCues: WebVttCue[], ukCues: WebVttCue[]): PairedVttLine[] {
  const groups: PairedVttLine[] = [];
  let frParts: string[] = [];
  let ukParts: string[] = [];

  function flush() {
    if (frParts.length === 0) return;
    const text = cleanCueText(frParts.join(" "));
    const translationUk = cleanCueText(ukParts.join(" ")) || null;
    if (text) groups.push({ text, translationUk });
    frParts = [];
    ukParts = [];
  }

  for (let i = 0; i < frCues.length; i++) {
    const text = cleanCueText(frCues[i].text);
    if (!text) continue;

    // Межа 3 (ліміт символів) — перевіряємо ДО додавання цього cue в
    // поточну групу: якщо він її переповнить, поточна група закривається
    // без нього, і він стає початком нової.
    if (frParts.length > 0 && [...frParts, text].join(" ").length > MAX_GROUP_CHARS) {
      flush();
    }

    frParts.push(text);
    const ukText = ukTextForFrCueIndex(frCues, ukCues, i);
    if (ukText) ukParts.push(ukText);

    const nextCue = frCues[i + 1];
    const bigGap = !nextCue || nextCue.start - frCues[i].end >= GAP_SECONDS;
    if (SENTENCE_END_RE.test(text) || bigGap) {
      flush();
    }
  }
  flush();

  return groups;
}
