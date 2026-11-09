"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronLeft, ChevronRight, LogOut, type LucideIcon } from "lucide-react";
import { PlatformWordmark } from "@/components/platform-wordmark";
import { PlatformBadge } from "@/components/platform-badge";
import { CabinetSidebarProfile } from "@/components/cabinet/sidebar-profile";
import { t, type MessageKey } from "@/lib/i18n/t";
import type { UiLang } from "@/lib/ui/product-lang";
import { CABINET_PRIMARY_NAV, CABINET_SETTINGS_NAV, CABINET_ADMIN_NAV } from "./nav-items";
import { LanguagePills, CabinetLangCycle } from "./language-pills";
import { ThemePills, ThemeRailButton } from "./theme-switch";

const NAV_COOKIE = "tdf_cabinet_nav";
const NAV_COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 рік

export function CabinetSidebar({
  lang,
  isTeacher,
  fullName,
  initialCollapsed,
  onSignOut,
}: {
  lang: UiLang;
  isTeacher: boolean;
  fullName: string | null;
  initialCollapsed: boolean;
  onSignOut: () => Promise<void>;
}) {
  const [collapsed, setCollapsed] = useState(initialCollapsed);
  const pathname = usePathname();

  function toggle() {
    const next = !collapsed;
    setCollapsed(next);
    document.cookie = `${NAV_COOKIE}=${next ? "collapsed" : "expanded"}; path=/; max-age=${NAV_COOKIE_MAX_AGE}`;
  }

  return (
    <aside className={`cabinet-sidebar ${collapsed ? "cabinet-sidebar--collapsed" : ""}`}>
      <div className={collapsed ? "flex justify-center pb-[18px]" : "cabinet-sidebar-logo pb-[18px]"}>
        <Link href="/cabinet" aria-label="Trucs d’French">
          {collapsed ? (
            <PlatformBadge size={46} />
          ) : (
            <PlatformWordmark size="sidebar" tone="dark" tagline align="left" />
          )}
        </Link>
      </div>

      <CabinetSidebarProfile lang={lang} fullName={fullName} isTeacher={isTeacher} collapsed={collapsed} />

      <nav aria-label={t(lang, "cabinet.nav.home")} className="flex w-full flex-col gap-[2px]">
        {CABINET_PRIMARY_NAV.map((item) => (
          <NavLink
            key={item.href}
            item={item}
            lang={lang}
            collapsed={collapsed}
            active={pathname === item.href}
          />
        ))}

        <div className="my-2 border-t border-white/15" />

        <NavLink
          item={CABINET_SETTINGS_NAV}
          lang={lang}
          collapsed={collapsed}
          active={pathname === CABINET_SETTINGS_NAV.href}
        />

        {isTeacher && (
          <NavLink
            item={CABINET_ADMIN_NAV}
            lang={lang}
            collapsed={collapsed}
            active={pathname.startsWith("/admin")}
          />
        )}

        <form action={onSignOut}>
          <button
            type="submit"
            className="cabinet-nav-item w-full"
            aria-label={t(lang, "cabinet.nav.signOut")}
          >
            {collapsed ? (
              <span className="cabinet-rail-icon">
                <LogOut size={22} aria-hidden="true" />
              </span>
            ) : (
              <LogOut size={22} aria-hidden="true" />
            )}
            {!collapsed && <span>{t(lang, "cabinet.nav.signOut")}</span>}
            {collapsed && (
              <span className="cabinet-tooltip" role="tooltip">
                {t(lang, "cabinet.nav.signOut")}
              </span>
            )}
          </button>
        </form>
      </nav>

      <div
        className={
          collapsed
            ? "mt-auto flex flex-col items-center gap-[10px]"
            : "mt-auto flex flex-col gap-[10px]"
        }
      >
        <button
          type="button"
          onClick={toggle}
          aria-expanded={!collapsed}
          aria-label={t(lang, collapsed ? "cabinet.nav.expand" : "cabinet.nav.collapse")}
          className={collapsed ? "cabinet-nav-item w-full justify-center" : "cabinet-nav-item w-full"}
        >
          {collapsed ? (
            <span className="cabinet-rail-icon">
              <ChevronRight size={22} aria-hidden="true" />
            </span>
          ) : (
            <>
              <ChevronLeft size={22} aria-hidden="true" />
              <span>{t(lang, "cabinet.nav.collapse")}</span>
            </>
          )}
        </button>

        {collapsed ? (
          <>
            <ThemeRailButton lang={lang} />
            <CabinetLangCycle current={lang} />
          </>
        ) : (
          <>
            <div className="px-1">
              <p className="mb-1.5 text-xs font-semibold text-white/70">
                {t(lang, "cabinet.nav.language")}
              </p>
              <LanguagePills current={lang} />
            </div>
            <div className="px-1">
              <p className="mb-1.5 text-xs font-semibold text-white/70">
                {t(lang, "cabinet.theme.label")}
              </p>
              <ThemePills lang={lang} />
            </div>
          </>
        )}
      </div>
    </aside>
  );
}

function NavLink({
  item,
  lang,
  collapsed,
  active,
}: {
  item: { href: string; icon: LucideIcon; labelKey: MessageKey };
  lang: UiLang;
  collapsed: boolean;
  active: boolean;
}) {
  const Icon = item.icon;
  const label = t(lang, item.labelKey);

  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      aria-label={label}
      className={`cabinet-nav-item ${active ? "cabinet-nav-item--active" : ""}`}
    >
      {collapsed ? (
        <span className="cabinet-rail-icon">
          <Icon size={22} aria-hidden="true" />
        </span>
      ) : (
        <Icon size={22} aria-hidden="true" />
      )}
      {!collapsed && <span>{label}</span>}
      {collapsed && (
        <span className="cabinet-tooltip" role="tooltip">
          {label}
        </span>
      )}
    </Link>
  );
}
