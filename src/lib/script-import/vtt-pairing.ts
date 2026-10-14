import type { WebVttCue } from "@/lib/webvtt";

export type PairedVttLine = { text: string; translationUk: string | null };

// Якщо кількість cues однакова — пара за індексом (найнадійніше, коли FR і
// UK .vtt зроблені з того самого оригінального розбиття). Інакше — для
// кожної FR cue шукаємо UK cue з найближчим часом початку, у межах 1 с
// (TOLERANCE_SECONDS); далі — без пари (translationUk: null), без спливу
// помилки (сценарій заповнюється, перевіряється вчителькою вручну).
const TOLERANCE_SECONDS = 1;

export function pairVttCues(frCues: WebVttCue[], ukCues: WebVttCue[]): PairedVttLine[] {
  const sameCount = ukCues.length > 0 && frCues.length === ukCues.length;
  const result: PairedVttLine[] = [];

  for (let i = 0; i < frCues.length; i++) {
    const text = frCues[i].text.replace(/\s+/g, " ").trim();
    if (!text) continue;

    let translationUk: string | null = null;
    if (sameCount) {
      translationUk = ukCues[i].text.replace(/\s+/g, " ").trim() || null;
    } else if (ukCues.length > 0) {
      let best: WebVttCue | null = null;
      let bestDiff = Infinity;
      for (const uk of ukCues) {
        const diff = Math.abs(uk.start - frCues[i].start);
        if (diff < bestDiff) {
          bestDiff = diff;
          best = uk;
        }
      }
      if (best && bestDiff <= TOLERANCE_SECONDS) {
        translationUk = best.text.replace(/\s+/g, " ").trim() || null;
      }
    }

    result.push({ text, translationUk });
  }

  return result;
}
