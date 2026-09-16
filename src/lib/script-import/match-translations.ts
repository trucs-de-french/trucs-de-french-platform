import type { TranslationCue } from "./parse";

type LineTimecode = { start?: number | null; end?: number | null };

export type TranslationMatch = {
  lineIndex: number;
  translation: string | null;
  // start І end ОБИДВА не null — репліки вставленого транскрипту мають
  // лише start (без end, за дизайном імпорту сценарію), тож так само
  // потрапляють у "без таймкоду" для ЦІЄЇ фічі, попри частковий start.
  hasTimecode: boolean;
  // Кілька cues перекладу претендували на цю саму репліку — присвоєно
  // те, що з найбільшим перетином, решта в unmatchedCues не потрапляють
  // (вони "матчнулись", просто не найкраще) — конфлікт лише позначка для
  // ручної перевірки в прев'ю, translation усе одно виставлений.
  conflict: boolean;
};

export type MatchTranslationsResult = {
  matches: TranslationMatch[];
  unmatchedCues: TranslationCue[];
};

// Допуск на розбіжність сегментації між оригінальним і перекладеним .srt —
// якщо немає жодного справжнього перетину, усе одно зіставляємо в межах
// цього розриву (секунди).
const TOLERANCE_SECONDS = 1.5;

function overlapSeconds(aStart: number, aEnd: number, bStart: number, bEnd: number): number {
  return Math.max(0, Math.min(aEnd, bEnd) - Math.max(aStart, bStart));
}

function gapSeconds(aStart: number, aEnd: number, bStart: number, bEnd: number): number {
  if (aEnd < bStart) return bStart - aEnd;
  if (bEnd < aStart) return aStart - bEnd;
  return 0;
}

export function matchTranslations<T extends LineTimecode>(
  lines: T[],
  cues: TranslationCue[]
): MatchTranslationsResult {
  const timecodedIndices = lines
    .map((line, index) => ({ line, index }))
    .filter(({ line }) => line.start != null && line.end != null);

  const candidatesByLineIndex = new Map<number, TranslationCue[]>();
  const unmatchedCues: TranslationCue[] = [];

  for (const cue of cues) {
    let bestIndex: number | null = null;
    let bestScore = -Infinity;

    for (const { line, index } of timecodedIndices) {
      const overlap = overlapSeconds(cue.start, cue.end, line.start as number, line.end as number);
      const score = overlap > 0 ? overlap : -gapSeconds(cue.start, cue.end, line.start as number, line.end as number);
      if (score > bestScore) {
        bestScore = score;
        bestIndex = index;
      }
    }

    // score > 0 -> справжній перетин; score між -TOLERANCE і 0 -> розрив у
    // межах допуску, теж зіставляємо; менше -TOLERANCE -> без пари.
    if (bestIndex === null || bestScore < -TOLERANCE_SECONDS) {
      unmatchedCues.push(cue);
      continue;
    }

    const arr = candidatesByLineIndex.get(bestIndex) ?? [];
    arr.push(cue);
    candidatesByLineIndex.set(bestIndex, arr);
  }

  const matches: TranslationMatch[] = lines.map((line, index) => {
    const hasTimecode = line.start != null && line.end != null;
    if (!hasTimecode) {
      return { lineIndex: index, translation: null, hasTimecode: false, conflict: false };
    }

    const candidates = candidatesByLineIndex.get(index) ?? [];
    if (candidates.length === 0) {
      return { lineIndex: index, translation: null, hasTimecode: true, conflict: false };
    }

    // Найбільший перетин серед конкурентів за цю репліку.
    const best = candidates.reduce((a, b) =>
      overlapSeconds(a.start, a.end, line.start as number, line.end as number) >=
      overlapSeconds(b.start, b.end, line.start as number, line.end as number)
        ? a
        : b
    );
    return {
      lineIndex: index,
      translation: best.text,
      hasTimecode: true,
      conflict: candidates.length > 1,
    };
  });

  return { matches, unmatchedCues };
}
