"use client";

import { usePathname } from "next/navigation";
import { ThemeToggle } from "./theme-toggle";

// Корінь сайту (layout.tsx) — серверний компонент, без доступу до
// pathname; найменш інвазивний спосіб приховати плаваючу ThemeToggle
// лише на /cabinet/** — тонка клієнтська обгортка, що перевіряє шлях і
// просто не рендерить кнопку там (сама ThemeToggle не змінена, працює
// на решті сайту як і раніше). Перемикач теми в кабінеті — окремий UI
// у sidebar/More (cabinet/theme-switch.tsx), той самий useTheme().
export function ThemeToggleGate() {
  const pathname = usePathname();
  if (pathname?.startsWith("/cabinet")) return null;
  return <ThemeToggle />;
}
