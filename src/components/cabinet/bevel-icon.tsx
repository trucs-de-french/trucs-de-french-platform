import type { LucideIcon } from "lucide-react";

// "C. gold bevel" 3D-рендер sidebar-іконок — три накладені копії того
// самого Lucide-глифа (тінь/основний градієнт/відблиск) замість плаского
// currentColor. Колір кожного шару задає CSS (globals.css, .bevel-icon-*
// / .bevel-icon--selected), не inline-пропи — завдяки цьому вибір
// indigo/gold для selected=true різниться між темами (:root.dark) без
// жодної JS-перевірки теми, тож немає спалаху неправильного кольору до
// гідратації (SSR клас .dark на <html> уже стоїть від theme-script.tsx).
export function BevelIcon({
  icon: Icon,
  selected = false,
  size = 26,
}: {
  icon: LucideIcon;
  selected?: boolean;
  size?: number;
}) {
  return (
    <span
      className={`bevel-icon${selected ? " bevel-icon--selected" : ""}`}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <Icon aria-hidden="true" className="bevel-icon-layer bevel-icon-shadow" strokeWidth={2.4} />
      <Icon aria-hidden="true" className="bevel-icon-layer bevel-icon-main" strokeWidth={2.4} />
      <Icon aria-hidden="true" className="bevel-icon-layer bevel-icon-highlight" strokeWidth={0.7} />
    </span>
  );
}
