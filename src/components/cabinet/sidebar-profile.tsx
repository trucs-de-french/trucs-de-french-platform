import Link from "next/link";
import { ProfileAvatar } from "@/components/cabinet/profile-avatar";

// Профільний блок у бічній панелі кабінету (desktop) — лінк на /cabinet/settings.
// Ім'я приходить зверху з cabinet/layout.tsx (той самий запит до profiles,
// що й раніше), а не з окремого клієнтського фетчу. Лише аватар + ім'я —
// роль у блоці більше не показується для студента/вчителя (прибрано на
// прохання, всім однаково) — КРІМ адмінки (AdminSidebar передає
// roleTag="ADMIN"), де роль саме й потрібно підкреслити.
export function CabinetSidebarProfile({
  fullName,
  avatarUrl = null,
  avatarMascot = null,
  collapsed,
  roleTag,
  href = "/cabinet/settings",
}: {
  fullName: string | null;
  avatarUrl?: string | null;
  avatarMascot?: string | null;
  collapsed: boolean;
  // Короткий тег ролі після імені ("ADMIN") — лише AdminSidebar; формат
  // "{ім'я} / {roleTag}", лише ім'я скорочується (ellipsis), тег ролі
  // ніколи не ховається/не переноситься.
  roleTag?: string;
  href?: string;
}) {
  const name = fullName?.trim() || "";
  const label = name || "—";
  const ariaLabel = roleTag ? `${label} / ${roleTag}` : label;

  if (collapsed) {
    return (
      <Link href={href} aria-label={ariaLabel} className="cabinet-sidebar-profile cabinet-sidebar-profile--collapsed">
        <ProfileAvatar name={name} size={36} imageUrl={avatarUrl} mascotId={avatarMascot} />
        <span className="cabinet-tooltip" role="tooltip">
          {ariaLabel}
        </span>
      </Link>
    );
  }

  return (
    <Link href={href} aria-label={ariaLabel} className="cabinet-sidebar-profile">
      <ProfileAvatar name={label} size={36} imageUrl={avatarUrl} mascotId={avatarMascot} />
      {roleTag ? (
        <span className="flex min-w-0 flex-1 items-baseline gap-1">
          <span className="cabinet-sidebar-profile-name min-w-0 truncate">{label}</span>
          <span className="shrink-0 whitespace-nowrap font-heading text-[12px] font-extrabold tracking-[0.06em] uppercase text-[#1a1640]/70">
            / {roleTag}
          </span>
        </span>
      ) : (
        <span className="cabinet-sidebar-profile-name block min-w-0 truncate">{label}</span>
      )}
    </Link>
  );
}
