// Логотип "Trucs d'French" — Nunito 900 (TRUCS) + Lora italic 700 (d'French),
// платформні шрифти, без окремих брендових (Montserrat/Cormorant прибрані).
//
// tone не задано: колір сам перемикається між світлою/темною темою сайту
// (клас .dark на <html>) — для звичайних поверхонь. tone="dark" форсує
// темний (кремово-золотий) варіант незалежно від теми сайту — для місць,
// які завжди на індиго-градієнті (бокова панель кабінету), tone="light"
// форсує світлий варіант незалежно від теми.
const SIZES = {
  sm: { trucs: 20, french: 22, tagline: 10 },
  md: { trucs: 26, french: 29, tagline: 11.5 },
  lg: { trucs: 34, french: 38, tagline: 15 },
  mobile: { trucs: 30, french: 33, tagline: 12 },
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
}: {
  size?: WordmarkSize;
  tone?: "light" | "dark";
  tagline?: boolean;
}) {
  const { trucs, french, tagline: taglineSize } = SIZES[size];

  return (
    <span className="inline-flex flex-col items-center text-center leading-none whitespace-nowrap">
      <span className="inline-flex items-baseline leading-none whitespace-nowrap">
        <span
          className={`font-heading font-black uppercase tracking-[0.06em] ${toneClasses(tone, "trucs")}`}
          style={{ fontSize: trucs }}
        >
          TRUCS
        </span>
        <span
          className={`font-body font-bold italic ${toneClasses(tone, "trucs")}`}
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
          className={`font-body font-semibold italic ${toneClasses(tone, "tagline")}`}
          style={{ fontSize: taglineSize, marginTop: "0.7em" }}
        >
          {TAGLINE_TEXT}
        </span>
      )}
    </span>
  );
}
