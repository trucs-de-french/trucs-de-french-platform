import type { LinkPlatform } from "@/lib/platform";

const COLORS: Record<LinkPlatform, string> = {
  youtube: "bg-red-600",
  wordwall: "bg-emerald-600",
  genially: "bg-purple-600",
  custom: "bg-neutral-600",
};

const LABELS: Record<LinkPlatform, string> = {
  youtube: "▶",
  wordwall: "W",
  genially: "G",
  custom: "🔗",
};

export function PlatformIcon({ platform }: { platform: LinkPlatform }) {
  return (
    <span
      className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white ${COLORS[platform]}`}
    >
      {LABELS[platform]}
    </span>
  );
}
