import { t } from "@/lib/i18n/t";
import type { UiLang } from "@/lib/ui/product-lang";

export function ProfileCard({
  lang,
  fullName,
  isTeacher,
  compact = false,
}: {
  lang: UiLang;
  fullName: string | null;
  isTeacher: boolean;
  // Компактний варіант — мобільна копія під привітанням на cabinet/page.tsx:
  // менший вертикальний відступ, трохи більший шрифт імені/ролі (12px/py
  // замість p-5, 18px/14px замість text-base/text-xs), аватар лишається
  // 48px (h-12), як на десктопі.
  compact?: boolean;
}) {
  const name = fullName?.trim() || "";
  const initial = (name[0] ?? "?").toUpperCase();

  return (
    <div className={`cabinet-card flex items-center gap-3 ${compact ? "px-5 py-3" : "p-5"}`}>
      <span
        className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full font-heading text-lg font-extrabold text-[var(--cabinet-on-gold)]"
        style={{ background: "linear-gradient(135deg, #f6dc8e, #e0aa3e)" }}
        aria-hidden="true"
      >
        {initial}
      </span>
      <div className="min-w-0">
        <div
          className={`truncate font-body font-semibold text-[var(--cabinet-ink)] ${compact ? "text-[18px]" : "text-base"}`}
        >
          {name || "—"}
        </div>
        <div className={`text-[var(--cabinet-muted)] ${compact ? "text-[14px]" : "text-xs"}`}>
          {t(lang, isTeacher ? "home.role.teacher" : "home.role.student")}
        </div>
      </div>
    </div>
  );
}
