// Розбиття matching на блоки по MATCHING_BLOCK_SIZE пар (10 елементів),
// коли пар більше — спільне джерело для sanitize.ts (шафл right у межах
// блоку, не глобально — щоб кожен блок мав серед видимих right ХОЧА Б усі
// свої справжні відповіді) і matching.tsx (та сама межа блоків для left/
// right/pairs на клієнті). ОДНА межа в ОБОХ місцях — інакше блок міг би
// показати right, чия пара насправді лежить в ІНШОМУ блоці (нерозв'язний
// блок).
export const MATCHING_BLOCK_SIZE = 5;

export function chunk<T>(items: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < items.length; i += size) result.push(items.slice(i, i + size));
  return result;
}
