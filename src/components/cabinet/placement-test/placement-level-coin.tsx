import { useId } from "react";

const FONT_SIZE_BY_LENGTH: Record<number, number> = { 2: 30, 4: 22 };

function fontSizeForLabel(label: string): number {
  return FONT_SIZE_BY_LENGTH[label.length] ?? 20;
}

// Монета результату тесту рівня — та сама "gold ring + indigo face"
// палітра, що achievement-badge.tsx (AchievementBadgeCoin), але без
// стрічок (тут немає дати здобуття/лічильника порогу — лише лейбл
// рівня), тож окремий простіший компонент замість спільного.
export function PlacementLevelCoin({ label }: { label: string }) {
  const goldId = useId();
  const indigoId = useId();

  return (
    <svg viewBox="0 0 104 104" className="placement-level-coin" aria-hidden="true">
      <defs>
        <linearGradient id={goldId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#f8e6a8" />
          <stop offset="0.55" stopColor="#d9b765" />
          <stop offset="1" stopColor="#b8923f" />
        </linearGradient>
        <linearGradient id={indigoId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#4b46da" />
          <stop offset="1" stopColor="#2f2c6b" />
        </linearGradient>
      </defs>
      <circle cx="52" cy="52" r="50" fill={`url(#${goldId})`} stroke="#b8923f" strokeWidth={2.5} />
      <circle cx="52" cy="52" r="40" fill={`url(#${indigoId})`} stroke="#f8e6a8" strokeWidth={3} />
      <text
        x="52"
        y={52 + fontSizeForLabel(label) * 0.35}
        textAnchor="middle"
        fontFamily="var(--font-heading)"
        fontWeight={900}
        fontSize={fontSizeForLabel(label)}
        fill="#f3d98b"
      >
        {label}
      </text>
    </svg>
  );
}
