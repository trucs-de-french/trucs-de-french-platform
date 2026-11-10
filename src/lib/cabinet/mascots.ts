// Маскоти профілю — альтернатива фото: кругла картинка замість аватара-
// ініціала. Файли зображень лежать у public/mascots/ (mascots.zip,
// додано власницею). ProfileAvatar лишається толерантним до id, якого
// немає в цьому списку (старий збережений вибір із попередньої версії
// манiфесту абощо) — findMascot() поверне null, і аватар тихо впаде на
// ініціал імені, без падіння.
export type Mascot = {
  id: string;
  src: string;
  label: string;
};

export const MASCOTS: Mascot[] = [
  { id: "mascot-01", src: "/mascots/mascot-01.png", label: "panda" },
  { id: "mascot-02", src: "/mascots/mascot-02.png", label: "raccoon-cap" },
  { id: "mascot-03", src: "/mascots/mascot-03.png", label: "bunny-purple" },
  { id: "mascot-04", src: "/mascots/mascot-04.png", label: "dog-green" },
  { id: "mascot-05", src: "/mascots/mascot-05.png", label: "cat-boss" },
  { id: "mascot-06", src: "/mascots/mascot-06.png", label: "elephant" },
  { id: "mascot-07", src: "/mascots/mascot-07.png", label: "bird-blue" },
  { id: "mascot-08", src: "/mascots/mascot-08.png", label: "cat-bucket" },
  { id: "mascot-09", src: "/mascots/mascot-09.png", label: "bunny-white" },
  { id: "mascot-10", src: "/mascots/mascot-10.png", label: "wolf-suit" },
  { id: "mascot-11", src: "/mascots/mascot-11.png", label: "toucan" },
  { id: "mascot-12", src: "/mascots/mascot-12.png", label: "panther" },
  { id: "mascot-13", src: "/mascots/mascot-13.png", label: "cardinal" },
  { id: "mascot-14", src: "/mascots/mascot-14.png", label: "cat-red" },
  { id: "mascot-15", src: "/mascots/mascot-15.png", label: "duck" },
  { id: "mascot-16", src: "/mascots/mascot-16.png", label: "owl" },
  { id: "mascot-17", src: "/mascots/mascot-17.png", label: "chimp" },
  { id: "mascot-18", src: "/mascots/mascot-18.png", label: "wolf-yellow" },
  { id: "mascot-19", src: "/mascots/mascot-19.png", label: "raccoon-mint" },
  { id: "mascot-20", src: "/mascots/mascot-20.png", label: "lion-red" },
  { id: "mascot-21", src: "/mascots/mascot-21.png", label: "rooster" },
  { id: "mascot-22", src: "/mascots/mascot-22.png", label: "bunny-skate" },
  { id: "mascot-23", src: "/mascots/mascot-23.png", label: "goose" },
  { id: "mascot-24", src: "/mascots/mascot-24.png", label: "dog-white" },
  { id: "mascot-25", src: "/mascots/mascot-25.png", label: "lion-king" },
  { id: "mascot-26", src: "/mascots/mascot-26.png", label: "parrot" },
];

export function findMascot(id: string | null | undefined): Mascot | null {
  if (!id) return null;
  return MASCOTS.find((m) => m.id === id) ?? null;
}

export function isMascotId(value: string): boolean {
  return MASCOTS.some((m) => m.id === value);
}

// "mascot-01" -> "1" — номер для сірого заглушка, коли файл не
// завантажився (зіпсований/відсутній конкретний файл — не весь набір
// більше не додано, той випадок тепер рідкісний).
export function mascotNumber(id: string): string {
  return String(Number(id.replace(/\D/g, "")) || "?");
}
