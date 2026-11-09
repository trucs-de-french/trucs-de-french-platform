import {
  Home,
  BookOpen,
  BookMarked,
  LineChart,
  RotateCcw,
  SlidersHorizontal,
  MoreHorizontal,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";
import type { MessageKey } from "@/lib/i18n/t";

// Єдиний список пунктів навігації кабінету — читають і Sidebar (desktop),
// і MobileTabBar/MorePage (mobile), щоб не дублювати href/іконку/лейбл у
// кількох місцях.
export type CabinetNavItem = {
  href: string;
  icon: LucideIcon;
  labelKey: MessageKey;
};

export type CabinetMobileNavItem = CabinetNavItem & { shortLabelKey: MessageKey };

export const CABINET_PRIMARY_NAV: CabinetNavItem[] = [
  { href: "/cabinet", icon: Home, labelKey: "cabinet.nav.home" },
  { href: "/cabinet/library", icon: BookOpen, labelKey: "cabinet.nav.library" },
  { href: "/cabinet/dictionary", icon: BookMarked, labelKey: "cabinet.nav.dictionary" },
  { href: "/cabinet/progress", icon: LineChart, labelKey: "cabinet.nav.progress" },
  { href: "/cabinet/mistakes", icon: RotateCcw, labelKey: "cabinet.nav.mistakes" },
];

export const CABINET_SETTINGS_NAV: CabinetNavItem = {
  href: "/cabinet/settings",
  icon: SlidersHorizontal,
  labelKey: "cabinet.nav.settings",
};

export const CABINET_ADMIN_NAV: CabinetNavItem = {
  href: "/admin/courses",
  icon: ShieldCheck,
  labelKey: "cabinet.nav.admin",
};

// Мобільна нижня панель — підмножина primary-навігації (без "Mistakes
// review", що переїжджає в "Ще") + вкладка "Ще".
export const CABINET_MOBILE_TABS: CabinetMobileNavItem[] = [
  { ...CABINET_PRIMARY_NAV[0], shortLabelKey: "cabinet.nav.short.home" },
  { ...CABINET_PRIMARY_NAV[1], shortLabelKey: "cabinet.nav.short.library" },
  { ...CABINET_PRIMARY_NAV[2], shortLabelKey: "cabinet.nav.short.dictionary" },
  { ...CABINET_PRIMARY_NAV[3], shortLabelKey: "cabinet.nav.short.progress" },
  {
    href: "/cabinet/more",
    icon: MoreHorizontal,
    labelKey: "cabinet.nav.more",
    shortLabelKey: "cabinet.nav.short.more",
  },
];
