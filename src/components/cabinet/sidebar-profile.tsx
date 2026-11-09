import Link from "next/link";
import { t } from "@/lib/i18n/t";
import type { UiLang } from "@/lib/ui/product-lang";

// Профільний блок у бічній панелі кабінету (desktop) — лінк на /cabinet/settings.
// Дані (ім'я/роль) приходять зверху з cabinet/layout.tsx (той самий запит
// до profiles, що й раніше), а не з окремого клієнтського фетчу.
export function CabinetSidebarProfile({
  lang,
  fullName,
  isTeacher,
  collapsed,
}: {
  lang: UiLang;
  fullName: string | null;
  isTeacher: boolean;
  collapsed: boolean;
}) {
  const name = fullName?.trim() || "";
  const initial = (name[0] ?? "?").toUpperCase();
  const roleLabel = t(lang, isTeacher ? "home.role.teacher" : "home.role.student");

  if (collapsed) {
    return (
      <Link
        href="/cabinet/settings"
        aria-label={name || roleLabel}
        className="cabinet-sidebar-profile cabinet-sidebar-profile--collapsed"
      >
        <span className="cabinet-sidebar-profile-avatar" aria-hidden="true">
          {initial}
        </span>
        <span className="cabinet-tooltip" role="tooltip">
          {name ? `${name} — ${roleLabel}` : roleLabel}
        </span>
      </Link>
    );
  }

  return (
    <Link
      href="/cabinet/settings"
      aria-label={name || roleLabel}
      className="cabinet-sidebar-profile"
    >
      <span className="cabinet-sidebar-profile-avatar" aria-hidden="true">
        {initial}
      </span>
      <span className="min-w-0">
        <span className="cabinet-sidebar-profile-name block truncate">{name || "—"}</span>
        <span className="cabinet-sidebar-profile-role block">{roleLabel}</span>
      </span>
    </Link>
  );
}
