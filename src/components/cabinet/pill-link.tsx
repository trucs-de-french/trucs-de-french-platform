import Link from "next/link";
import { ArrowRight } from "lucide-react";

// Спільна "pill"-кнопка-лінк для карткових заголовків (напр. "Усі
// досягнення →" на Home і на /cabinet/progress) — градієнтна заливка,
// завжди непрозора в обох темах (на відміну від .cabinet-back-link, що
// лишається текстовим лінком).
export function CabinetPillLink({
  href,
  label,
  compact = false,
}: {
  href: string;
  label: string;
  // Трохи менша пілюля (padding 9px 18px, font 14px замість висоти
  // 40px/18px) — лише там, де явно попросили (home "Останні досягнення");
  // решта викликів (compact-картка на /cabinet/progress, банер колекцій)
  // лишаються default, щоб не зменшити їх ненавмисно.
  compact?: boolean;
}) {
  return (
    <Link href={href} className={`cabinet-pill-link ${compact ? "cabinet-pill-link--compact" : ""}`.trim()}>
      {label}
      <ArrowRight size={16} strokeWidth={2.2} className="cabinet-pill-link-icon" aria-hidden="true" />
    </Link>
  );
}
