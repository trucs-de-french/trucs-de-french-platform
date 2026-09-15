import type { Metadata } from "next";
import { cookies } from "next/headers";
import { Roboto, Geist_Mono, Playfair_Display, Montserrat, Cormorant_Garamond, Lora } from "next/font/google";
import { ThemeScript } from "./theme-script";
import { ThemeToggle } from "@/components/theme-toggle";
import { THEME_COOKIE } from "@/lib/theme-cookie";
import "./globals.css";

// Той самий Roboto, що раніше був звужений лише на адмінку
// (admin/layout.tsx) — тепер дефолтний шрифт усього сайту (--font-sans,
// globals.css), замінює Geist Sans. cyrillic — обов'язково, увесь текст
// сайту українською.
const roboto = Roboto({
  variable: "--font-roboto",
  weight: ["400", "500", "700"],
  subsets: ["latin", "cyrillic"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin", "cyrillic"],
});

// Лише для заголовків назв курсів/сцен/тестів (font-heading, globals.css) —
// не замінює Geist Sans як основний шрифт UI, той самий принцип, що вже
// застосований до Roboto в admin/layout.tsx (окрема variable, вузьке
// призначення, не сайт-вайд основний шрифт).
//
// Playfair Display, не Fraunces — Fraunces/Newsreader (варіанти з
// дизайн-документа) НЕ мають кириличного підсету в Google Fonts (лише
// latin/latin-ext/vietnamese), а назви курсів/сцен/тестів переважно
// українською; без кирилиці шрифт просто не застосувався б до реального
// контенту. Playfair Display — найближчий за характером (виразний,
// високий контраст) варіант із повною кириличною підтримкою.
const playfairDisplay = Playfair_Display({
  variable: "--font-serif-heading",
  subsets: ["latin", "cyrillic"],
});

// Обидва — лише для вордмарку "Trucs d'French" (platform-wordmark.tsx),
// фіксованого латинського тексту — кирилиця не потрібна (на відміну від
// Playfair Display вище, який рендерить реальні українські назви курсів).
const montserrat = Montserrat({
  variable: "--font-montserrat",
  weight: ["800"],
  subsets: ["latin"],
});
const cormorantGaramond = Cormorant_Garamond({
  variable: "--font-cormorant",
  weight: ["500"],
  style: ["italic"],
  subsets: ["latin"],
});

// Лише для полів навчального контенту (текст репліки діалогу, варіанти
// відповідей вправ) — клас font-content (globals.css), той самий вузько-
// скопований принцип, що Roboto/Playfair Display вище: окрема змінна, не
// замінює жодного наявного шрифту. Застосування до конкретних полів — окремий
// етап, тут лише інфраструктура (шрифт підключено, клас ще ніде не використано).
const lora = Lora({
  variable: "--font-lora",
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
      className={`${roboto.variable} ${geistMono.variable} ${playfairDisplay.variable} ${montserrat.variable} ${cormorantGaramond.variable} ${lora.variable} h-full antialiased ${themeClass}`.trim()}
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
