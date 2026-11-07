"use client";

import { useState } from "react";
import { setThemeCookie } from "@/lib/theme-cookie";

// Спільний хук теми — та сама механіка, що раніше жила лише в
// theme-toggle.tsx (клас dark/light на <html>, localStorage, кука через
// setThemeCookie), винесена сюди, щоб кабінетний перемикач теми (sidebar/
// More) не дублював її. theme-toggle.tsx тепер теж викликає цей хук
// замість власної копії — поведінка не змінюється, лише спільне джерело.
//
// isDark читається СИНХРОННО в lazy useState-ініціалізаторі (не в
// useEffect/після mount) — eslint-правило проєкту react-hooks/set-state-
// in-effect забороняє прямий setState() у тілі ефекту, тож на сервері
// (немає document) повертається false, а на клієнті при гідратації функція
// одразу підхоплює клас, який theme-script.tsx (інлайн-скрипт у <head>)
// уже виставив на <html> ДО гідратації. Можливий один кадр розбіжності
// сервер/клієнт — той самий, що раніше в theme-toggle.tsx — лишається на
// відповідальності кожного рендера (suppressHydrationWarning на елементі,
// що показує стан).
function getInitialIsDark() {
  return typeof document !== "undefined" && document.documentElement.classList.contains("dark");
}

export function useTheme() {
  const [isDark, setIsDark] = useState(getInitialIsDark);

  function setTheme(dark: boolean) {
    setIsDark(dark);
    document.documentElement.classList.toggle("dark", dark);
    document.documentElement.classList.toggle("light", !dark);
    try {
      localStorage.setItem("theme", dark ? "dark" : "light");
    } catch {
      // localStorage недоступний (приватний режим тощо) — тема просто не збережеться
    }
    setThemeCookie(dark ? "dark" : "light");
  }

  return { isDark, setTheme };
}
