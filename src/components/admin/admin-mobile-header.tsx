"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { PlatformWordmark } from "@/components/platform-wordmark";
import { ThemeRailButton } from "@/components/cabinet/theme-switch";
import { CabinetSidebarProfile } from "@/components/cabinet/sidebar-profile";
import { ADMIN_NAV_ITEMS } from "@/components/admin/admin-sidebar";

// Мобільна версія AdminSidebar — та сама рейка "згортається" у шапку,
// що й кабінет (.cabinet-sidebar сам display:none до md:768px): тут
// окремий top bar — вордмарк, та сама профільна пілюля (roleTag="ADMIN"),
// далі рядок пунктів навігації з "До кабінету" останнім (та сама логіка,
// що десктопна рейка).
export function AdminMobileHeader({
  initialIsDark,
  fullName,
  avatarUrl,
  avatarMascot,
}: {
  initialIsDark: boolean | null;
  fullName: string | null;
  avatarUrl: string | null;
  avatarMascot: string | null;
}) {
  const pathname = usePathname();

  return (
    <div className="admin-mobile-header md:hidden">
      <Link href="/admin/courses" aria-label="Trucs d’French" className="mb-3 inline-block">
        <PlatformWordmark size="mobile" tone="dark" />
      </Link>
      <CabinetSidebarProfile
        fullName={fullName}
        avatarUrl={avatarUrl}
        avatarMascot={avatarMascot}
        collapsed={false}
        roleTag="ADMIN"
      />
      <nav aria-label="Адмінка" className="admin-mobile-nav">
        {ADMIN_NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={`admin-mobile-nav-item ${active ? "admin-mobile-nav-item--active" : ""}`}
            >
              <Icon size={16} aria-hidden="true" />
              {item.label}
            </Link>
          );
        })}
        <ThemeRailButton lang="uk" initialIsDark={initialIsDark} />
        <Link href="/cabinet" className="admin-mobile-nav-item">
          <ChevronLeft size={16} aria-hidden="true" />
          До кабінету
        </Link>
      </nav>
    </div>
  );
}
