import Script from "next/script";

// Фолбек ЛИШЕ для першого візиту (кука ще не виставлена, layout.tsx не
// зміг порахувати клас на сервері) — повторно перевіряє localStorage і
// matchMedia. Для будь-якого наступного візиту (кука вже є) layout.tsx уже
// вставив правильний клас на сервері, і цей скрипт просто підтверджує те
// саме значення (без ефекту — toggle на вже наявний клас — no-op).
//
// Виконується синхронно до першого фарбування сторінки (strategy="beforeInteractive"
// -> Next.js вставляє скрипт у початковий HTML, у <head>), щоб виставити клас
// .dark ще до рендеру React і уникнути "блимання" не тією темою. Не залежить
// від React/гідратації.
const THEME_SCRIPT = `
(function () {
  try {
    var stored = localStorage.getItem("theme");
    var isDark = stored ? stored === "dark" : window.matchMedia("(prefers-color-scheme: dark)").matches;
    document.documentElement.classList.toggle("dark", isDark);
    document.documentElement.classList.toggle("light", !isDark);
  } catch (e) {}
})();
`;

export function ThemeScript() {
  return (
    <Script
      id="theme-script"
      strategy="beforeInteractive"
      dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }}
    />
  );
}
