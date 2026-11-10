import Link from "next/link";
import { ArrowRight } from "lucide-react";

// Спільна "pill"-кнопка-лінк для карткових заголовків (напр. "Усі
// досягнення →" на Home і на /cabinet/progress) — градієнтна заливка,
// завжди непрозора в обох темах (на відміну від .cabinet-back-link, що
// лишається текстовим лінком).
export function CabinetPillLink({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} className="cabinet-pill-link">
      {label}
      <ArrowRight size={16} strokeWidth={2.2} className="cabinet-pill-link-icon" aria-hidden="true" />
    </Link>
  );
}
