// Розбиття великих вправ на блоки по EXERCISE_BLOCK_SIZE елементів (10),
// коли елементів більше — коли їх ≤10, вправа лишається одним "блоком"
// (useBlocks === false у кожному студентському компоненті), без жодної
// зміни вигляду/поведінки. Спільне джерело порогу й самої нарізки для
// matching.tsx/letter-gaps.tsx/letter-rearrangement.tsx/table-fill.tsx —
// та сама межа має узгоджуватись і в sanitize.ts (де для matching це ще й
// межі шаффлу right, щоб блок не лишився без своїх справжніх відповідей),
// і в студентському компоненті, інакше ліва й права сторони розійдуться.
//
// Що таке "елемент" — рішення КОЖНОГО типу окремо (слово в letter_gaps/
// letter_rearrangement, рядок таблиці в table_fill, ПАРА — тобто 2
// елементи — в matching, звідси ділення EXERCISE_BLOCK_SIZE навпіл лише
// там). Тут — лише спільне число й генерична нарізка масиву.
export const EXERCISE_BLOCK_SIZE = 10;

export function chunk<T>(items: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < items.length; i += size) result.push(items.slice(i, i + size));
  return result;
}
