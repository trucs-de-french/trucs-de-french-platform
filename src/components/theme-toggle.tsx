"use client";

import { useState } from "react";

function getInitialIsDark() {
  return typeof document !== "undefined" && document.documentElement.classList.contains("dark");
}

export function ThemeToggle() {
  const [isDark, setIsDark] = useState(getInitialIsDark);

  function toggle() {
    const next = !isDark;
    setIsDark(next);
    document.documentElement.classList.toggle("dark", next);
    document.documentElement.classList.toggle("light", !next);
    try {
      localStorage.setItem("theme", next ? "dark" : "light");
    } catch {
      // localStorage недоступний (приватний режим тощо) — тема просто не збережеться
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label="Перемкнути тему"
      className="fixed bottom-4 right-4 z-50 flex h-10 w-10 items-center justify-center rounded-full border bg-white text-lg shadow-md hover:bg-neutral-50 dark:bg-neutral-900 dark:hover:bg-neutral-800"
    >
      <span suppressHydrationWarning>{isDark ? "☀️" : "🌙"}</span>
    </button>
  );
}
