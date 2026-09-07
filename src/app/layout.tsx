import type { Metadata } from "next";
import { cookies } from "next/headers";
import { Geist, Geist_Mono } from "next/font/google";
import { ThemeScript } from "./theme-script";
import { ThemeToggle } from "@/components/theme-toggle";
import { THEME_COOKIE } from "@/lib/theme-cookie";
import "./globals.css";

// cyrillic — обов'язково, увесь текст сайту українською; без цієї
// підмножини кирилиця йшла б фолбеком в Arial, а не Geist (саме це й було
// причиною багу — body раніше ще й ігнорував --font-geist-sans узагалі).
const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin", "cyrillic"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin", "cyrillic"],
});

export const metadata: Metadata = {
  title: "Trucs de French",
  description: "Платформа для вивчення французької мови через кіно та DELF",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // Кука темна — не лише localStorage (theme-toggle.tsx/save-form.tsx
  // пишуть в обидва разом) — щоб клас .dark/.light потрапляв у <html> ВЖЕ
  // на сервері, звідси й без потреби виправляти щось на клієнті ДО
  // гідратації (те, що якраз і ламалось: theme-script.tsx мутував <html>
  // до гідратації, React під час гідратації звіряв className з тим, що сам
  // порахував — БЕЗ теми, бо сервер її не знав — і перезаписував назад,
  // стираючи щойно виставлений клас; підтверджено логом "on window load").
  const cookieStore = await cookies();
  const theme = cookieStore.get(THEME_COOKIE)?.value;
  const themeClass = theme === "dark" ? "dark" : theme === "light" ? "light" : "";

  return (
    <html
      lang="uk"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased ${themeClass}`.trim()}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col">
        <ThemeScript />
        {children}
        <ThemeToggle />
      </body>
    </html>
  );
}
