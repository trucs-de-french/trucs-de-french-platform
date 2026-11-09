// Компактний значок "TDF" — золота монета (round, за замовчуванням) або
// індиго квадрат зі скругленими кутами (variant="app-icon") — круасан
// тон-в-тон позаду літер, намальований п'ятьма еліпсами.
//
// Живий <text> (font-family: var(--font-lora)) — лише для рендеру в React;
// статичні файли іконок (favicon/manifest) не можуть вантажити веб-шрифти,
// тому там літери заздалегідь конвертовані в контури (scripts/make-icons.mjs).
const CROISSANT_ELLIPSES: [number, number, number, number, number][] = [
  [6, 26, 6, 5.6, -50],
  [54, 26, 6, 5.6, 50],
  [16, 18, 8.6, 10.4, -26],
  [44, 18, 8.6, 10.4, 26],
  [30, 15, 10.6, 13, 0],
];

function Croissant({ scale }: { scale: number }) {
  return (
    <g transform={`translate(100 102) scale(${scale}) translate(-30 -17)`}>
      {CROISSANT_ELLIPSES.map(([cx, cy, rx, ry, rotate], i) => (
        <ellipse
          key={i}
          cx={cx}
          cy={cy}
          rx={rx}
          ry={ry}
          fill="#c49b3f"
          stroke="#d9b765"
          strokeWidth={1.8}
          transform={`rotate(${rotate} ${cx} ${cy})`}
        />
      ))}
    </g>
  );
}

export function PlatformBadge({
  size = 46,
  variant = "round",
}: {
  size?: number;
  variant?: "round" | "app-icon";
}) {
  const rounded = variant === "app-icon";

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 200 200"
      role="img"
      aria-label="TDF"
    >
      {rounded ? (
        <>
          <rect width={200} height={200} rx={44} fill="#2f2c6b" />
          <circle cx={100} cy={100} r={74} fill="#d9b765" />
          <Croissant scale={2.2} />
          <text
            x="100"
            y="124"
            textAnchor="middle"
            style={{ fontFamily: "var(--font-lora), Lora, serif" }}
            fontWeight={700}
            fontSize={64}
            fill="#1a1640"
            letterSpacing={-1}
          >
            TDF
          </text>
        </>
      ) : (
        <>
          <circle cx={100} cy={100} r={90} fill="#d9b765" />
          <Croissant scale={2.7} />
          <text
            x="100"
            y="128"
            textAnchor="middle"
            style={{ fontFamily: "var(--font-lora), Lora, serif" }}
            fontWeight={700}
            fontSize={78}
            fill="#1a1640"
            letterSpacing={-1}
          >
            TDF
          </text>
        </>
      )}
    </svg>
  );
}
