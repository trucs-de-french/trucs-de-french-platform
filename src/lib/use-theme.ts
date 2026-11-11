"use client";

import { useEffect, useState } from "react";
import { setThemeCookie, clearThemeCookie } from "@/lib/theme-cookie";

// Спільний хук теми — та сама механіка, що раніше жила лише в
// theme-toggle.tsx (клас dark/light на <html>, localStorage, кука через
// setThemeCookie), винесена сюди, щоб кабінетний перемикач теми (sidebar/
// More) не дублював її. theme-toggle.tsx тепер теж викликає цей хук
// замість власної копії — поведінка не змінюється, лише спільне джерело.
//
// Три режими: "system" (дефолт, немає збереженого explicit-значення —
// слідує prefers-color-scheme й живо реагує на зміну ОС через matchMedia
// 'change'), "light"/"dark" (explicit вибір — у Налаштуваннях або
// швидким перемикачем у сайдбарі/адмінці, той самий STORAGE_KEY в
// localStorage + кука). mode потрібен ОКРЕМО від isDark: isDark — це
// РЕЗУЛЬТАТ (що намальовано), mode — ПРИЧИНА (explicit чи "сама
// система"), і лише mode каже, яка з трьох пілюль у Налаштуваннях
// підсвічена — <html>-клас цього не зберігає.
export type ThemeMode = "system" | "light" | "dark";

const STORAGE_KEY = "theme";

function systemPrefersDark(): boolean {
  try {
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  } catch {
    return false;
  }
}

function applyIsDark(dark: boolean) {
  document.documentElement.classList.toggle("dark", dark);
  document.documentElement.classList.toggle("light", !dark);
}

// isDark читається СИНХРОННО в lazy useState-ініціалізаторі (не в
// useEffect/після mount) — eslint-правило проєкту react-hooks/set-state-
// in-effect забороняє прямий setState() у тілі ефекту. На клієнті функція
// одразу підхоплює клас, який theme-script.tsx (інлайн-скрипт у <head>)
// уже виставив на <html> ДО гідратації — тут завжди коректно (і для
// explicit, і для щойно розрішеного "система" значення).
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

// serverIsDark — той самий тристанний сигнал з куки (true/false/null),
// null саме тоді, коли кука explicit відсутня — тобто "система", без
// потреби в окремому парсері чи новому значенні куки.
function getInitialMode(serverIsDark?: boolean | null): ThemeMode {
  if (typeof document !== "undefined") {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === "dark" || stored === "light") return stored;
    } catch {
      // localStorage недоступний (приватний режим тощо) — вважаємо "система"
    }
    return "system";
  }
  if (serverIsDark === true) return "dark";
  if (serverIsDark === false) return "light";
  return "system";
}

export function useTheme(serverIsDark?: boolean | null) {
  const [isDark, setIsDark] = useState(() => getInitialIsDark(serverIsDark));
  const [mode, setMode] = useState<ThemeMode>(() => getInitialMode(serverIsDark));

  // Поки режим "система" — живо стежити за зміною теми ОС (matchMedia
  // 'change') і одразу перефарбовувати <html>; слухач знімається, щойно
  // обрано explicit light/dark (клас тоді вже не залежить від ОС).
  useEffect(() => {
    if (mode !== "system") return;
    let mq: MediaQueryList;
    try {
      mq = window.matchMedia("(prefers-color-scheme: dark)");
    } catch {
      return;
    }
    const update = () => {
      applyIsDark(mq.matches);
      setIsDark(mq.matches);
    };
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, [mode]);

  // Явний вибір light/dark — той самий виклик, що й раніше (швидкий
  // перемикач у сайдбарі/адмінці/плаваюча кнопка продовжують викликати
  // setTheme(!isDark) без жодних змін із їхнього боку).
  function setTheme(dark: boolean) {
    setIsDark(dark);
    setMode(dark ? "dark" : "light");
    applyIsDark(dark);
    try {
      localStorage.setItem(STORAGE_KEY, dark ? "dark" : "light");
    } catch {
      // localStorage недоступний — тема просто не збережеться
    }
    setThemeCookie(dark ? "dark" : "light");
  }

  // Налаштування → Інтерфейс → Тема: три пілюлі викликають це напряму.
  // "Системна" прибирає explicit-значення (localStorage + кука) і одразу
  // розрішує поточну тему ОС, замість запису літерала "system" — те саме
  // "нічого не збережено" значення, яке інлайн-скрипт і сервер уже
  // трактують як "система".
  function setThemeMode(next: ThemeMode) {
    if (next === "system") {
      setMode("system");
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch {
        // localStorage недоступний — нічого видаляти
      }
      clearThemeCookie();
      const dark = systemPrefersDark();
      applyIsDark(dark);
      setIsDark(dark);
      return;
    }
    setTheme(next === "dark");
  }

  return { isDark, mode, setTheme, setThemeMode };
}
