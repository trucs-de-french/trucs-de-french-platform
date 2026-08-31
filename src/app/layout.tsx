import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ThemeScript } from "./theme-script";
import { ThemeToggle } from "@/components/theme-toggle";
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

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="uk"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
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
