import Link from "next/link";

// Профільний блок у бічній панелі кабінету (desktop) — лінк на /cabinet/settings.
// Ім'я приходить зверху з cabinet/layout.tsx (той самий запит до profiles,
// що й раніше), а не з окремого клієнтського фетчу. Лише аватар + ім'я —
// роль у блоці більше не показується (прибрано на прохання, всім однаково).
export function CabinetSidebarProfile({
  fullName,
  collapsed,
}: {
  fullName: string | null;
  collapsed: boolean;
}) {
  const name = fullName?.trim() || "";
  const initial = (name[0] ?? "?").toUpperCase();
  const label = name || "—";

  if (collapsed) {
    return (
      <Link
        href="/cabinet/settings"
        aria-label={label}
        className="cabinet-sidebar-profile cabinet-sidebar-profile--collapsed"
      >
        <span className="cabinet-sidebar-profile-avatar" aria-hidden="true">
          {initial}
        </span>
        <span className="cabinet-tooltip" role="tooltip">
          {label}
        </span>
      </Link>
    );
  }

  return (
    <Link
      href="/cabinet/settings"
      aria-label={label}
      className="cabinet-sidebar-profile"
    >
      <span className="cabinet-sidebar-profile-avatar" aria-hidden="true">
        {initial}
      </span>
      <span className="cabinet-sidebar-profile-name block min-w-0 truncate">{label}</span>
    </Link>
  );
}
