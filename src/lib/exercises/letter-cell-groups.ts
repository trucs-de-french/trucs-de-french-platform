// Спільна для letter-gaps.tsx (рендер) і estimate-card-rows.ts (оцінка
// ширини для сортування карток) функція: сусідні видимі літери без
// пропуску між ними ("b"+"e" у "be") — в ОДНУ групу, а не по одній на
// символ, щоб вони рендерились впритул, як звичайне слово (одна клітинка
// gap-проміжку між групами, не між кожною літерою). Пропуски (null)
// лишаються окремими групами — одна прихована літера = одна клітинка.
export type CharGroup = { type: "letters"; text: string } | { type: "gap" };

export function groupChars(chars: (string | null)[]): CharGroup[] {
  const groups: CharGroup[] = [];
  for (const char of chars) {
    if (char === null) {
      groups.push({ type: "gap" });
      continue;
    }
    const last = groups[groups.length - 1];
    if (last?.type === "letters") {
      last.text += char;
    } else {
      groups.push({ type: "letters", text: char });
    }
  }
  return groups;
}
