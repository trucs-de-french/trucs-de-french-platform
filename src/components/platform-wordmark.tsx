// Логотип "Trucs d'French" — Nunito 900 (TRUCS) + Lora italic 600 (d'French),
// платформні шрифти, без окремих брендових (Montserrat/Cormorant прибрані).
// Lora завантажений у layout.tsx без фіксованого weight — next/font тоді
// бере варіативну версію (font-weight: 400 700 суцільним діапазоном), тож
// 600 вже доступний без жодної зміни конфігурації шрифту.
//
// tone не задано: колір сам перемикається між світлою/темною темою сайту
// (клас .dark на <html>) — для звичайних поверхонь. tone="dark" форсує
// темний (кремово-золотий) варіант незалежно від теми сайту — для місць,
// які завжди на індиго-градієнті (бокова панель кабінету), tone="light"
// форсує світлий варіант незалежно від теми.
//
// "sidebar" — єдиний розмір, вужчий за "md", підібраний саме під ширину
// розгорнутої рейки кабінету (256px, --cabinet-item-pl 14px зліва): рядок
// TRUCS+d'French мусить лишати мінімум 22px вільного місця з обох боків.
const SIZES = {
  sm: { trucs: 20, french: 22, tagline: 10 },
  md: { trucs: 26, french: 29, tagline: 11.5 },
  lg: { trucs: 34, french: 38, tagline: 15 },
  mobile: { trucs: 30, french: 33, tagline: 12 },
  sidebar: { trucs: 21, french: 23, tagline: 10.5 },
} as const;

type WordmarkSize = keyof typeof SIZES;

const TAGLINE_TEXT = "tout devient possible avec le français";

function toneClasses(tone: "light" | "dark" | undefined, part: "trucs" | "apostrophe" | "tagline") {
  const map = {
    trucs: { light: "text-[#2f2c6b]", dark: "text-[#f6f1e3]", auto: "text-[#2f2c6b] dark:text-[#f6f1e3]" },
    apostrophe: { light: "text-[#d9b765]", dark: "text-[#f3d98b]", auto: "text-[#d9b765] dark:text-[#f3d98b]" },
    tagline: { light: "text-[#6a5d40]", dark: "text-[#f3d98b]", auto: "text-[#6a5d40] dark:text-[#f3d98b]" },
  } as const;
  return map[part][tone ?? "auto"];
}

export function PlatformWordmark({
  size = "md",
  tone,
  tagline = false,
  align = "center",
}: {
  size?: WordmarkSize;
  tone?: "light" | "dark";
  tagline?: boolean;
  // "left" — рядок і підпис лишаються лівим краєм на одній лінії з іконками
  // навігації замість взаємного центрування (вузька рейка кабінету, де
  // підпис при переносі на 2 рядки може стати ширшим за сам вордмарк).
  align?: "center" | "left";
}) {
  const { trucs, french, tagline: taglineSize } = SIZES[size];
  const alignClass = align === "left" ? "items-start text-left" : "items-center text-center";

  return (
    <span
      className={`inline-flex flex-col ${alignClass} leading-none`}
      style={{ maxWidth: "100%", overflow: "visible" }}
    >
      <span className="inline-flex items-baseline leading-none whitespace-nowrap">
        <span
          className={`font-heading font-black uppercase tracking-[0.05em] ${toneClasses(tone, "trucs")}`}
          style={{ fontSize: trucs }}
        >
          TRUCS
        </span>
        <span
          className={`font-body font-semibold italic ${toneClasses(tone, "trucs")}`}
          style={{ fontSize: french, marginLeft: "0.28em" }}
        >
          d
          <span
            className={`relative ${toneClasses(tone, "apostrophe")}`}
            style={{ fontSize: "1.25em", top: "-0.04em" }}
          >
            &rsquo;
          </span>
          French
        </span>
      </span>
      {tagline && (
        <span
          className={`font-body font-semibold italic whitespace-normal ${toneClasses(tone, "tagline")}`}
          style={{ fontSize: taglineSize, marginTop: "0.7em", maxWidth: "100%" }}
        >
          {TAGLINE_TEXT}
        </span>
      )}
    </span>
  );
}
