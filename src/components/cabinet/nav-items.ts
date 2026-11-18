import {
  Home,
  BookOpen,
  BookMarked,
  LineChart,
  RotateCcw,
  ClipboardCheck,
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

export type CabinetMobileNavItem = CabinetNavItem & {
  shortLabelKey: MessageKey;
  // Додаткові префікси шляхів, на яких цей пункт теж вважається активним
  // (наприклад "Ще" активна і на /cabinet/settings, /admin/... — сторінках,
  // куди можна дістатись лише через неї, а не лише на точному href).
  extraActivePrefixes?: string[];
};

// Правило "активний пункт" для CABINET_PRIMARY_NAV (desktop sidebar.tsx) —
// чиста функція, щоб бути тестованою окремо (nav-items.test.ts) без
// рендеру React. "/cabinet" (Головна) — єдиний виняток із точним
// збігом: усі інші пункти кабінету теж починаються на "/cabinet/...",
// тож pathname.startsWith("/cabinet") підсвічував би Головну на КОЖНІЙ
// сторінці кабінету без цього винятку. Інші пункти (library/dictionary/
// progress/mistakes) не перетинаються префіксами одне з одним, тож
// startsWith тут безпечний і підсвічує й підсторінки (/cabinet/mistakes/
// [sceneId], /cabinet/dictionary/train/...), не лише точний href — той
// самий прийом, що вже був у CABINET_MOBILE_TABS (mobile-tab-bar.tsx).
export function isNavItemActive(href: string, pathname: string): boolean {
  return href === "/cabinet" ? pathname === "/cabinet" : pathname.startsWith(href);
}

export const CABINET_PRIMARY_NAV: CabinetNavItem[] = [
  { href: "/cabinet", icon: Home, labelKey: "cabinet.nav.home" },
  { href: "/cabinet/library", icon: BookOpen, labelKey: "cabinet.nav.library" },
  { href: "/cabinet/dictionary", icon: BookMarked, labelKey: "cabinet.nav.dictionary" },
  { href: "/cabinet/progress", icon: LineChart, labelKey: "cabinet.nav.progress" },
  { href: "/cabinet/mistakes", icon: RotateCcw, labelKey: "cabinet.nav.mistakes" },
];

// Окремий від CABINET_PRIMARY_NAV (не в мобільному tab bar — там лише 5
// вкладок + "Ще") — у десктопному sidebar рендериться NavLink'ом одразу
// після primary-списку, ПЕРЕД розділювачем/Налаштуваннями; на мобільному
// — рядок у "Ще" (cabinet/more/page.tsx), перед Налаштуваннями.
export const CABINET_PLACEMENT_TEST_NAV: CabinetNavItem = {
  href: "/cabinet/placement-test",
  icon: ClipboardCheck,
  labelKey: "cabinet.nav.placementTest",
};

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

// Мобільна нижня панель — вся primary-навігація (включно з "Mistakes
// review") + вкладка "Ще" (Налаштування/Адмінка/мова/тема/вихід сховані
// за нею — див. cabinet/more/page.tsx).
export const CABINET_MOBILE_TABS: CabinetMobileNavItem[] = [
  { ...CABINET_PRIMARY_NAV[0], shortLabelKey: "cabinet.nav.short.home" },
  { ...CABINET_PRIMARY_NAV[1], shortLabelKey: "cabinet.nav.short.library" },
  { ...CABINET_PRIMARY_NAV[2], shortLabelKey: "cabinet.nav.short.dictionary" },
  { ...CABINET_PRIMARY_NAV[3], shortLabelKey: "cabinet.nav.short.progress" },
  { ...CABINET_PRIMARY_NAV[4], shortLabelKey: "cabinet.nav.short.mistakes" },
  {
    href: "/cabinet/more",
    icon: MoreHorizontal,
    labelKey: "cabinet.nav.more",
    shortLabelKey: "cabinet.nav.short.more",
    extraActivePrefixes: ["/cabinet/settings", "/admin"],
  },
];
