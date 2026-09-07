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
