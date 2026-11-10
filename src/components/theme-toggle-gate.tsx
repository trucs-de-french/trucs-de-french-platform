"use client";

import { usePathname } from "next/navigation";
import { ThemeToggle } from "./theme-toggle";

// Сторінки з власним AdminShell (admin-shell.tsx) — рейка там уже має
// свій перемикач "Тема" (той самий useTheme()), плаваюча кнопка там
// лише заважала б (fixed-оверлей сидить ПОВЕРХ неї, z-index не рятує,
// бо вона б малювалась над самим шеллом по DOM-порядку). Точний список,
// НЕ pathname.startsWith("/admin") — глибокий редактор курсу (courses/
// new/**, courses/[id]/**) досі без власного перемикача теми, плаваюча
// кнопка там лишається потрібною.
const ADMIN_SHELL_PATHS = ["/admin/courses", "/admin/achievements-preview"];

// Корінь сайту (layout.tsx) — серверний компонент, без доступу до
// pathname; найменш інвазивний спосіб приховати плаваючу ThemeToggle
// лише на /cabinet/** і адмін-сторінках з AdminShell — тонка клієнтська
// обгортка, що перевіряє шлях і просто не рендерить кнопку там (сама
// ThemeToggle не змінена, працює на решті сайту як і раніше). Перемикач
// теми в кабінеті/адмінці — окремий UI у sidebar (cabinet/theme-
// switch.tsx), той самий useTheme() — тема лишається синхронізованою.
export function ThemeToggleGate() {
  const pathname = usePathname();
  if (pathname?.startsWith("/cabinet")) return null;
  if (pathname && ADMIN_SHELL_PATHS.includes(pathname)) return null;
  return <ThemeToggle />;
}
