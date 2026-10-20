// Евристичне (не лінгвістично точне) розбиття французького слова на
// склад-подібні фрагменти — лише щоб знайти "безпечні" місця для переносу
// рядка в letter_gaps (letter-gaps.tsx): довге слово переноситься МІЖ
// фрагментами, ніколи всередині групи голосних (ou, ai, eau...) чи
// нерозривного приголосного кластера (ch, bl, gr...).
const VOWELS = new Set([
  "a", "e", "i", "o", "u", "y",
  "à", "â", "ä", "é", "è", "ê", "ë", "î", "ï", "ô", "ö", "ù", "û", "ü", "œ",
]);

const INSEPARABLE_CLUSTERS = new Set([
  "ch", "ph", "th", "gn", "qu",
  "bl", "br", "cl", "cr", "dr", "fl", "fr", "gl", "gr", "pl", "pr", "tr", "vr",
]);

function isVowel(ch: string): boolean {
  return VOWELS.has(ch);
}

// Жоден фрагмент не лишається довжиною 1 (приєднується до сусіда; якщо
// фрагмент один — не зливається самим із собою).
function mergeShortChunks(chunks: string[]): string[] {
  const result = chunks.slice();
  for (let i = 0; i < result.length; ) {
    if (result[i].length >= 2 || result.length === 1) {
      i++;
      continue;
    }
    if (i > 0) {
      result[i - 1] += result[i];
      result.splice(i, 1);
    } else {
      result[1] = result[0] + result[1];
      result.splice(0, 1);
    }
  }
  return result;
}

// Основний алгоритм без урахування дефіса/апострофа (ті розбиваються ОКРЕМО,
// рекурсивно, у splitIntoSyllableChunks нижче).
function splitCore(word: string, lower: string): string[] {
  // Фінальне німе "e"/"es" (приголосна+e/es у кінці слова) — НЕ самостійна
  // голосна група для меж складу, приєднується до останнього фрагмента
  // вже ПІСЛЯ основного розбиття (voir chéri/baiser — "e" після приголосної,
  // якщо за нею ще є літери, лишається звичайною голосною групою).
  let suffixLen = 0;
  if (lower.length > 2) {
    if (lower.endsWith("es") && !isVowel(lower[lower.length - 3])) suffixLen = 2;
    else if (lower.endsWith("e") && !isVowel(lower[lower.length - 2])) suffixLen = 1;
  }
  const coreLen = lower.length - suffixLen;
  if (coreLen < 4) return [word];
  const core = lower.slice(0, coreLen);

  const tokens: { vowel: boolean; start: number; end: number }[] = [];
  let i = 0;
  while (i < core.length) {
    const v = isVowel(core[i]);
    let j = i + 1;
    while (j < core.length && isVowel(core[j]) === v) j++;
    tokens.push({ vowel: v, start: i, end: j });
    i = j;
  }

  const vowelCount = tokens.filter((t) => t.vowel).length;
  if (vowelCount <= 1) {
    const whole = word.slice(0, coreLen) + (suffixLen ? word.slice(coreLen) : "");
    return [whole];
  }

  // Межа перед приголосним кластером між двома голосними групами:
  // 1 приголосна — йде з НАСТУПНОЮ голосною (V|CV); 2+ — нерозривний
  // кластер (останні 2 літери run) лишається цілим з наступною голосною,
  // решта кластера йде з попередньою; інакше розрізаємо кластер навпіл
  // (VC|CV...). Приголосні без пари голосної з обох боків (префікс/хвіст
  // слова) не утворюють межі — лишаються суцільно з єдиним сусіднім
  // фрагментом.
  const cuts: number[] = [];
  for (let k = 0; k < tokens.length; k++) {
    const t = tokens[k];
    if (t.vowel) continue;
    const prev = tokens[k - 1];
    const next = tokens[k + 1];
    if (!prev || !next) continue;
    const run = core.slice(t.start, t.end);
    const n = run.length;
    if (n === 1) {
      cuts.push(t.start);
    } else {
      const lastPair = run.slice(n - 2);
      cuts.push(INSEPARABLE_CLUSTERS.has(lastPair) ? t.start + n - 2 : t.start + 1);
    }
  }

  const chunks: string[] = [];
  let cut = 0;
  for (const b of cuts) {
    chunks.push(word.slice(cut, b));
    cut = b;
  }
  chunks.push(word.slice(cut, coreLen));
  if (suffixLen) chunks[chunks.length - 1] += word.slice(coreLen);
  return chunks;
}

// Повертає фрагменти слова (конкатенація === оригінал, регістр збережений
// як у вхідному рядку — розбір ведеться по lower-case копії). Слово
// коротше 4 літер — один фрагмент. Дефіс/апостроф — завжди межа (дія
// рекурсивна на обидві частини, роздільник лишається з лівою частиною).
export function splitIntoSyllableChunks(word: string): string[] {
  const sep = word.search(/[-']/);
  if (sep !== -1) {
    const left = word.slice(0, sep + 1);
    const right = word.slice(sep + 1);
    const leftChunks = left.length < 4 ? [left] : splitCore(left, left.toLowerCase());
    const rightChunks = right.length === 0 ? [] : splitIntoSyllableChunks(right);
    return mergeShortChunks([...leftChunks, ...rightChunks]);
  }
  if (word.length < 4) return [word];
  return mergeShortChunks(splitCore(word, word.toLowerCase()));
}

// Повне слово (без масок) для ОДНІЄЇ одиниці переносу letter_gaps
// (артикль/"se"/слово) — splitIntoSyllableChunks вище потребує РЕАЛЬНІ
// літери, не null. hiddenLetters уже є в публічному config letter_gaps
// (той самий масив, що gapLiveStatus/nextHintGap у letter-gaps.tsx читають
// для живої підсвітки) — жодних нових серверних даних тут не потрібно.
// gapOffset — кількість пропусків у ПОПЕРЕДНІХ одиницях того самого слова
// (hiddenLetters індексується по всьому слову, не по одиниці).
export function reconstructUnitWord(unit: (string | null)[], hiddenLetters: string[], gapOffset: number): string {
  let word = "";
  let hi = gapOffset;
  for (const ch of unit) {
    word += ch === null ? hiddenLetters[hi++] ?? "" : ch;
  }
  return word;
}

// Розрізає одиницю (масив символів/null) на фрагменти за довжинами
// фрагментів splitIntoSyllableChunks (довжини в сумі рівні unit.length —
// reconstructUnitWord зберігає позиційну відповідність).
export function sliceUnitByChunks(unit: (string | null)[], chunks: string[]): (string | null)[][] {
  const result: (string | null)[][] = [];
  let pos = 0;
  for (const chunk of chunks) {
    result.push(unit.slice(pos, pos + chunk.length));
    pos += chunk.length;
  }
  return result;
}
