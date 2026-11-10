import type { LucideIcon } from "lucide-react";

// "C. gold bevel" 3D-рендер sidebar-іконок — три накладені копії того
// самого Lucide-глифа (тінь/основний градієнт/відблиск) замість плаского
// currentColor. selected=true — indigo-градієнт (коли іконка лежить на
// світлій cream-плашці активного пункту, light-тема); selected=false —
// gold-градієнт (звичайний стан в обох темах, і активний пункт у dark-темі,
// де плашка темна — gold дає кращий контраст, ніж indigo на indigo).
export function BevelIcon({
  icon: Icon,
  selected = false,
  size = 26,
}: {
  icon: LucideIcon;
  selected?: boolean;
  size?: number;
}) {
  const mainStroke = selected ? "url(#tdf-bevel-indigo)" : "url(#tdf-bevel-gold)";
  const shadowStroke = selected ? "rgba(184,146,63,.5)" : "rgba(10,8,50,.5)";
  const highlightStroke = selected ? "rgba(255,255,255,.35)" : "rgba(255,255,255,.7)";

  return (
    <span className="bevel-icon" style={{ width: size, height: size }} aria-hidden="true">
      <Icon
        aria-hidden="true"
        className="bevel-icon-layer bevel-icon-shadow"
        stroke={shadowStroke}
        strokeWidth={2.4}
      />
      <Icon
        aria-hidden="true"
        className="bevel-icon-layer bevel-icon-main"
        stroke={mainStroke}
        strokeWidth={2.4}
      />
      <Icon
        aria-hidden="true"
        className="bevel-icon-layer bevel-icon-highlight"
        stroke={highlightStroke}
        strokeWidth={0.7}
      />
    </span>
  );
}
