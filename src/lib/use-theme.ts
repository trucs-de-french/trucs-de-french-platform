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
// in-effect забороняє прямий setState() у тілі ефекту. На клієнті функція
// одразу підхоплює клас, який theme-script.tsx (інлайн-скрипт у <head>)
// уже виставив на <html> ДО гідратації — тут завжди коректно.
//
// На СЕРВЕРІ (немає document) раніше тут завжди повертався false, тобто
// SSR будь-якого ThemePills/ThemeRailButton малював активною світлу
// пілюлю незалежно від реальної теми користувача — саме це й було
// причиною неправильної підсвітки теми в кабінеті (settings/sidebar):
// клієнтський рендер при гідратації хоч і підхоплював правильне значення,
// але повторний SSR-прохід (RSC-навігація/Suspense-ревалідація) знову
// скидав видиме на дефолт. serverIsDark — те саме значення теми, яке
// сервер уже знає з куки (parseThemeCookieValue, theme-cookie.ts) і
// передає пропом згори (cabinet/layout.tsx, cabinet/more/page.tsx,
// cabinet/settings/page.tsx) — SSR тепер завжди збігається з клієнтом.
function getInitialIsDark(serverIsDark?: boolean | null) {
  if (typeof document !== "undefined") {
    return document.documentElement.classList.contains("dark");
  }
  return serverIsDark ?? false;
}

export function useTheme(serverIsDark?: boolean | null) {
  const [isDark, setIsDark] = useState(() => getInitialIsDark(serverIsDark));

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
