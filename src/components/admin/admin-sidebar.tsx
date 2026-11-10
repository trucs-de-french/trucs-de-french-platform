"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, Trophy, ChevronLeft, type LucideIcon } from "lucide-react";
import { PlatformWordmark } from "@/components/platform-wordmark";
import { ThemePills } from "@/components/cabinet/theme-switch";

export const ADMIN_NAV_ITEMS: { href: string; icon: LucideIcon; label: string }[] = [
  { href: "/admin/courses", icon: BookOpen, label: "Курси" },
  { href: "/admin/achievements-preview", icon: Trophy, label: "Симулятор досягнень" },
];

// Адмінський відповідник CabinetSidebar — ті самі CSS-класи (.cabinet-
// sidebar/.cabinet-nav-item/...), простіший вміст (без профілю, мовних
// пігулок, collapse — лише 2 пункти навігації). Рендериться САМЕ на
// сторінках, що отримали новий shell (courses, achievements-preview), а
// не в кореневому admin/layout.tsx — глибокий редактор курсу
// (courses/[id]/**) має власний CourseSwitcherSidebar і full-bleed
// breakout, які цей shell зламав би, якби сидів у спільному layout.
export function AdminSidebar({ initialIsDark }: { initialIsDark: boolean | null }) {
  const pathname = usePathname();

  return (
    <aside className="cabinet-sidebar admin-sidebar">
      <div className="cabinet-sidebar-logo-wrap cabinet-sidebar-logo flex flex-col items-start gap-1.5 pb-[18px]">
        <Link href="/admin/courses" aria-label="Trucs d’French">
          <PlatformWordmark size="sidebar" tone="dark" tagline align="left" />
        </Link>
        <span className="admin-sidebar-badge">Адмінка</span>
      </div>

      <nav aria-label="Адмінка" className="flex w-full flex-col gap-[2px]">
        {ADMIN_NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={`cabinet-nav-item ${active ? "cabinet-nav-item--active" : ""}`}
            >
              <Icon size={22} aria-hidden="true" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="cabinet-sidebar-bottom mt-auto flex flex-col gap-[10px]">
        <div className="px-1">
          <p className="cabinet-sidebar-section-label mb-1.5 text-xs font-semibold">Тема</p>
          <ThemePills lang="uk" initialIsDark={initialIsDark} />
        </div>
        <Link href="/dashboard" className="cabinet-nav-item w-full">
          <ChevronLeft size={22} aria-hidden="true" />
          <span>До кабінету</span>
        </Link>
      </div>
    </aside>
  );
}
