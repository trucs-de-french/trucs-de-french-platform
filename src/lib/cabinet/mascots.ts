// Маскоти профілю — альтернатива фото: кругла картинка замість аватара-
// ініціала. Файли зображень у public/mascots/ ще не додані (власниця
// додасть їх пізніше), тож MascotPicker і ProfileAvatar самі показують
// нейтральний сірий кружок із номером, якщо файл не завантажився — сторінка
// лишається робочою вже зараз, без намальованого тут артворку.
export type Mascot = {
  id: string;
  src: string;
  label: string;
};

export const MASCOTS: Mascot[] = [
  { id: "mascot-01", src: "/mascots/mascot-01.png", label: "Маскот 1" },
  { id: "mascot-02", src: "/mascots/mascot-02.png", label: "Маскот 2" },
  { id: "mascot-03", src: "/mascots/mascot-03.png", label: "Маскот 3" },
  { id: "mascot-04", src: "/mascots/mascot-04.png", label: "Маскот 4" },
  { id: "mascot-05", src: "/mascots/mascot-05.png", label: "Маскот 5" },
  { id: "mascot-06", src: "/mascots/mascot-06.png", label: "Маскот 6" },
];

export function findMascot(id: string | null | undefined): Mascot | null {
  if (!id) return null;
  return MASCOTS.find((m) => m.id === id) ?? null;
}

export function isMascotId(value: string): boolean {
  return MASCOTS.some((m) => m.id === value);
}

// "mascot-01" -> "1" — номер для сірого заглушка, коли файл не завантажився.
export function mascotNumber(id: string): string {
  return String(Number(id.replace(/\D/g, "")) || "?");
}
