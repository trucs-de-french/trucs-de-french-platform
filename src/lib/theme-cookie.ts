// Ізоморфний хелпер — імпортується і з серверного layout.tsx (лише
// константа), і з клієнтських theme-toggle.tsx/save-form.tsx (сама функція
// запису). Кука (не лише localStorage) — щоб SERVER міг прочитати тему на
// САМОМУ ПЕРШОМУ рендері й одразу вставити правильний клас у <html>, без
// клієнтського мутування ДО гідратації, яке React потім скидає назад до
// server-обчисленого значення (корінь бага з темною темою в новій вкладці
// "Переглянути в режимі учня" — React звіряє className під час гідратації і
// перезаписує його своїм значенням при розбіжності; suppressHydrationWarning
// глушить лише попередження в консолі, не саму синхронізацію).
export const THEME_COOKIE = "theme";
const THEME_COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 рік

export function setThemeCookie(value: "dark" | "light") {
  if (typeof document === "undefined") return;
  document.cookie = `${THEME_COOKIE}=${value}; path=/; max-age=${THEME_COOKIE_MAX_AGE}; samesite=lax`;
}

// Вибір "Системна" (use-theme.ts setThemeMode) прибирає explicit-кукі,
// а не пише в неї "system" — відсутність куки й так означає "система"
// для і сервера (parseThemeCookieValue нижче), і інлайн-скрипта
// (theme-script.tsx), без нового стану для парсити.
export function clearThemeCookie() {
  if (typeof document === "undefined") return;
  document.cookie = `${THEME_COOKIE}=; path=/; max-age=0; samesite=lax`;
}

// Чистий парсер (без next/headers — цей модуль ділять і клієнтський, і
// серверний код) для серверних компонентів кабінету: дає useTheme()
// той самий isDark, що вже є в куці, замінюючи SSR-дефолт "не темна"
// (document недоступний на сервері) на реальне значення. Без цього
// ThemePills/ThemeRailButton на /cabinet завжди SSR-или світлу пілюлю як
// активну, і підсвітка лишалась неправильною — React не відкочує
// className, виставлений гідратацією, назад до SSR-значення автоматично,
// але якщо щось у дереві (напр. Suspense-границя) ре-рендерить компонент
// із серверним інпутом ще раз, дефолт "не темна" знову перемагає.
export function parseThemeCookieValue(value: string | undefined): boolean | null {
  if (value === "dark") return true;
  if (value === "light") return false;
  return null;
}
