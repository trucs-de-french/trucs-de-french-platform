// Реальний текст пісень, скопійований із сайтів, часто містить символи, що
// ламають і розбір мітки часу ([0:19]), і саму токенізацію нижче: невидимі
// символи (BOM на початку буфера обміну; zero-width space/non-joiner/
// joiner/word-joiner, які деякі сайти вставляють як захист від копіювання
// чи як артефакт кодування), нестандартні пробіли (NBSP та інші юнікодні
// пробіли замість звичайного — часто в HTML-вёрстці для вирівнювання) і
// повноширинні дужки/двокрапка (з деяких шрифтів/локалізацій). Викликається
// ОДИН раз на кожен сирий рядок ДО extractLeadingTimeLabel і ДО
// tokenizeKaraokeLine — обидва мають справу вже з чистим ASCII-скелетом
// пунктуації.
//
// Явні \uXXXX-екрани нижче (не буквальні символи в регексі) — навмисно:
// невидимі символи в літералі регулярного виразу неможливо перевірити
// візуально під час рев'ю чи гарантовано зберегти без спотворення при
// копіюванні файлу.
// U+200B ZERO WIDTH SPACE, U+200C ZWNJ, U+200D ZWJ, U+2060 WORD JOINER,
// U+FEFF BOM/ZERO WIDTH NO-BREAK SPACE.
const INVISIBLE_CHARS_RE = /[\u200B\u200C\u200D\u2060\uFEFF]/g;
// U+00A0 NBSP, U+1680 OGHAM SPACE MARK, U+2000-U+200A (EN QUAD..HAIR
// SPACE), U+2028/U+2029 (LINE/PARAGRAPH SEPARATOR), U+202F NARROW NBSP,
// U+205F MEDIUM MATHEMATICAL SPACE, U+3000 IDEOGRAPHIC SPACE — усі
// юнікодні пробіли поза звичайним U+0020.
const UNICODE_SPACES_RE = /[\u00A0\u1680\u2000-\u200A\u2028\u2029\u202F\u205F\u3000]/g;
// Повноширинні/альтернативні дужки й двокрапка (\uXXXX, та сама причина,
// що вище): FULLWIDTH LEFT/RIGHT SQUARE BRACKET, FULLWIDTH LEFT/RIGHT
// PARENTHESIS, FULLWIDTH COLON, SMALL COLON, MODIFIER LETTER COLON.
const FULLWIDTH_BRACKET_MAP: Record<string, string> = {
  "\uFF3B": "[",
  "\uFF3D": "]",
  "\uFF08": "(",
  "\uFF09": ")",
  "\uFF1A": ":",
  "\uFE55": ":",
  "\uA789": ":",
};

export function normalizeLyricLine(raw: string): string {
  let text = raw.replace(/\r/g, "").replace(INVISIBLE_CHARS_RE, "").replace(UNICODE_SPACES_RE, " ");
  for (const [from, to] of Object.entries(FULLWIDTH_BRACKET_MAP)) {
    text = text.split(from).join(to);
  }
  return text;
}

// Розбиття рядка тексту пісні на токени для караоке — слова (клікабельні,
// можуть стати пропуском) і роздільники (пробіли/розділові знаки, НІКОЛИ не
// пропуск — та сама вимога, що в letter-hide.ts для артиклів, лише на рівні
// слова, не символу). Апостроф/дефіс УСЕРЕДИНІ слова (елізії "j'aime",
// складні слова "café-crème") лишаються частиною ОДНОГО токена, не
// розбивають його — інакше клік по слову випадково перетворював би на
// пропуск лише половину французького слова.
const TOKEN_RE = /[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*|[^\p{L}\p{N}]+/gu;

export function tokenizeKaraokeLine(text: string): string[] {
  return text.match(TOKEN_RE) ?? [];
}

// "Словесний" токен — має хоч одну літеру/цифру. Роздільники (пробіли,
// пунктуація) — усе інше, ніколи не клікабельні в конструкторі й ніколи не
// можуть бути в gapTokenIndices.
export function isWordToken(token: string): boolean {
  return /[\p{L}\p{N}]/u.test(token);
}
