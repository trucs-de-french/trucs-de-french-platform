// Українська плюралізація "бал/бали/балів" — стандартне правило (1 бал,
// 2-4 бали крім 12-14, решта — балів). Дробові значення (крок 0.5 в
// системі балів) — родовий однини, як "1.5 бала"/"2.5 бала".
export function pluralizePoints(n: number): "бал" | "бали" | "балів" | "бала" {
  const abs = Math.abs(n);
  if (!Number.isInteger(abs)) return "бала";
  const mod10 = abs % 10;
  const mod100 = abs % 100;
  if (mod10 === 1 && mod100 !== 11) return "бал";
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return "бали";
  return "балів";
}
