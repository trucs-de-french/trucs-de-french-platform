// Українська плюралізація "слово/слова/слів" — те саме mod10/mod100
// правило, що pluralizePoints/pluralizeExercisesAccusative.
export function pluralizeWords(n: number): "слово" | "слова" | "слів" {
  const abs = Math.abs(n);
  const mod10 = abs % 10;
  const mod100 = abs % 100;
  if (mod10 === 1 && mod100 !== 11) return "слово";
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return "слова";
  return "слів";
}
