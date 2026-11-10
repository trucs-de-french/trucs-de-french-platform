import { Clapperboard, Flame, Star, RotateCcw, type LucideIcon } from "lucide-react";
import { t, type MessageKey } from "@/lib/i18n/t";
import type { UiLang } from "@/lib/ui/product-lang";

// Варіант "C: gold line icon, no tile, big watermark" — ті самі іконки, що
// в категоріях досягнень (achievement-ui.ts): Сцени/Стрік/Бали/Помилки.
// Градієнт штриха (tdf-stat-gold/-dark) — спільні <defs> у cabinet/
// layout.tsx, не дублюються тут.
function StatTile({
  icon: Icon,
  value,
  label,
}: {
  icon: LucideIcon;
  value: number;
  label: string;
}) {
  return (
    <div className="cabinet-stat-card">
      <Icon size={34} strokeWidth={2.2} className="cabinet-stat-icon" aria-hidden="true" />
      <div className="relative z-[1] min-w-0">
        <div className="font-heading text-[32px] font-black leading-none text-[var(--cabinet-ink)]">{value}</div>
        <div className="font-body text-sm font-medium leading-[1.2] text-[var(--cabinet-muted)]">{label}</div>
      </div>
      <Icon strokeWidth={1.4} className="cabinet-stat-watermark" aria-hidden="true" />
    </div>
  );
}

export function StatTiles({
  lang,
  scenesCompleted,
  streakDays,
  pointsThisWeek,
  redoCount,
}: {
  lang: UiLang;
  scenesCompleted: number;
  streakDays: number;
  pointsThisWeek: number;
  redoCount: number;
}) {
  const tiles: { icon: LucideIcon; value: number; labelKey: MessageKey }[] = [
    { icon: Clapperboard, value: scenesCompleted, labelKey: "home.stat.scenes" },
    { icon: Flame, value: streakDays, labelKey: "home.stat.streak" },
    { icon: Star, value: pointsThisWeek, labelKey: "home.stat.points" },
    { icon: RotateCcw, value: redoCount, labelKey: "home.stat.redo" },
  ];

  return (
    <div className="cabinet-stat-grid">
      {tiles.map((tile) => (
        <StatTile key={tile.labelKey} icon={tile.icon} value={tile.value} label={t(lang, tile.labelKey)} />
      ))}
    </div>
  );
}
