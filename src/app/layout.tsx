import type { Metadata } from "next";
import { cookies } from "next/headers";
import { Nunito, Geist_Mono, Montserrat, Cormorant_Garamond, Lora } from "next/font/google";
import { ThemeScript } from "./theme-script";
import { ThemeToggle } from "@/components/theme-toggle";
import { THEME_COOKIE } from "@/lib/theme-cookie";
import "./globals.css";

// Nunito — шрифт заголовків та інтерфейсу (--font-heading і --font-sans,
// globals.css): усі h1-h6, кнопки/поля вводу/лейбли, бічні панелі/навігація
// сайту. Замінює Roboto (--font-sans) і Playfair Display (--font-heading,
// раніше точково лише на ~6-8 h1) — обидва прибрані повністю, більше ніде
// не використовуються. latin-ext — потрібен для французьких діакритик
// (é, è, ê, ç...) поза базовим latin-підсетом; cyrillic — увесь інтерфейс
// українською.
const nunito = Nunito({
  variable: "--font-nunito",
  subsets: ["latin", "latin-ext", "cyrillic"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
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

// Lora — шрифт основного тексту сайту (--font-body, globals.css): body за
// замовчуванням, статті Матеріалів/callout (.rich-text p/li), і далі
// поля навчального контенту (--font-content, клас font-content — текст
// репліки діалогу, варіанти відповідей вправ), той самий шрифт під іншою
// назвою змінної для вужчого призначення. latin-ext — французькі
// діакритики поза базовим latin.
const lora = Lora({
  variable: "--font-lora",
  subsets: ["latin", "latin-ext", "cyrillic"],
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
      className={`${nunito.variable} ${geistMono.variable} ${montserrat.variable} ${cormorantGaramond.variable} ${lora.variable} h-full antialiased ${themeClass}`.trim()}
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
