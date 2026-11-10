"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { PlatformWordmark } from "@/components/platform-wordmark";
import { ThemeRailButton } from "@/components/cabinet/theme-switch";
import { ADMIN_NAV_ITEMS } from "@/components/admin/admin-sidebar";

// Мобільна версія AdminSidebar — та сама рейка "згортається" у шапку,
// що й кабінет (.cabinet-sidebar сам display:none до md:768px): тут
// окремий top bar. Вордмарк → один рядок, що переноситься ("Адмінка"-
// пілюля + "До кабінету") — той самий порядок/стиль, що верхній блок
// AdminSidebar, лише компактніше (один рядок замість двох).
export function AdminMobileHeader({ initialIsDark }: { initialIsDark: boolean | null }) {
  const pathname = usePathname();

  return (
    <div className="admin-mobile-header md:hidden">
      <Link href="/admin/courses" aria-label="Trucs d’French" className="inline-block">
        <PlatformWordmark size="mobile" tone="dark" />
      </Link>
      <div className="admin-sidebar-pill-row">
        <span className="admin-sidebar-badge">Адмінка</span>
        <Link href="/cabinet" className="admin-sidebar-back-pill">
          <ChevronLeft size={14} aria-hidden="true" />
          До кабінету
        </Link>
      </div>
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
      </nav>
    </div>
  );
}
