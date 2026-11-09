"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { t } from "@/lib/i18n/t";
import type { UiLang } from "@/lib/ui/product-lang";
import { CABINET_MOBILE_TABS } from "./nav-items";

export function CabinetMobileTabBar({ lang }: { lang: UiLang }) {
  const pathname = usePathname();

  return (
    <nav aria-label={t(lang, "cabinet.nav.home")} className="cabinet-bottom-bar">
      {CABINET_MOBILE_TABS.map((item) => {
        const Icon = item.icon;
        const active =
          item.href === "/cabinet" ? pathname === "/cabinet" : pathname.startsWith(item.href);
        const label = t(lang, item.labelKey);
        const shortLabel = t(lang, item.shortLabelKey);

        return (
          <Link
            key={item.href}
            href={item.href}
            aria-label={label}
            aria-current={active ? "page" : undefined}
            className={`cabinet-bottom-item ${active ? "cabinet-bottom-item--active" : ""}`}
          >
            <Icon size={active ? 22 : 24} aria-hidden="true" />
            {active && <span aria-hidden="true">{shortLabel}</span>}
          </Link>
        );
      })}
    </nav>
  );
}
