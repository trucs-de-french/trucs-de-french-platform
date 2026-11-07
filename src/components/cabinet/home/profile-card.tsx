import { t } from "@/lib/i18n/t";
import type { UiLang } from "@/lib/ui/product-lang";

export function ProfileCard({
  lang,
  fullName,
  isTeacher,
}: {
  lang: UiLang;
  fullName: string | null;
  isTeacher: boolean;
}) {
  const name = fullName?.trim() || "";
  const initial = (name[0] ?? "?").toUpperCase();

  return (
    <div className="cabinet-card flex items-center gap-3 p-5">
      <span
        className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full font-heading text-lg font-extrabold text-[var(--cabinet-on-gold)]"
        style={{ background: "linear-gradient(135deg, #f6dc8e, #e0aa3e)" }}
        aria-hidden="true"
      >
        {initial}
      </span>
      <div className="min-w-0">
        <div className="truncate font-body text-base font-semibold text-[var(--cabinet-ink)]">
          {name || "—"}
        </div>
        <div className="text-xs text-[var(--cabinet-muted)]">
          {t(lang, isTeacher ? "home.role.teacher" : "home.role.student")}
        </div>
      </div>
    </div>
  );
}
