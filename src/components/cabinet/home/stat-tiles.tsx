import { CheckCircle2, Zap, Star, RotateCcw, type LucideIcon } from "lucide-react";
import { t, type MessageKey } from "@/lib/i18n/t";
import type { UiLang } from "@/lib/ui/product-lang";

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
    <div className="cabinet-card flex items-center gap-3 p-4">
      <span
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-[var(--cabinet-ink)]"
        style={{ background: "linear-gradient(135deg, #f6dc8e, #e0aa3e)" }}
      >
        <Icon size={20} aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <div className="font-heading text-2xl font-extrabold leading-tight text-[var(--cabinet-ink)]">
          {value}
        </div>
        <div className="truncate text-xs text-[var(--cabinet-muted)]">{label}</div>
      </div>
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
    { icon: CheckCircle2, value: scenesCompleted, labelKey: "home.stat.scenes" },
    { icon: Zap, value: streakDays, labelKey: "home.stat.streak" },
    { icon: Star, value: pointsThisWeek, labelKey: "home.stat.points" },
    { icon: RotateCcw, value: redoCount, labelKey: "home.stat.redo" },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {tiles.map((tile) => (
        <StatTile key={tile.labelKey} icon={tile.icon} value={tile.value} label={t(lang, tile.labelKey)} />
      ))}
    </div>
  );
}
