// Фолбек ЛИШЕ для першого візиту (кука ще не виставлена, layout.tsx не
// зміг порахувати клас на сервері) — повторно перевіряє localStorage і
// matchMedia. Для будь-якого наступного візиту (кука вже є) layout.tsx уже
// вставив правильний клас на сервері, і цей скрипт просто підтверджує те
// саме значення (без ефекту — toggle на вже наявний клас — no-op).
//
// Рендериться як простий <script> у <head> кореневого layout.tsx (Server
// Component), не next/script: Script із strategy="beforeInteractive"
// давав консольну помилку "Encountered a script tag while rendering React
// component" (React 19/Next 16) — next/script у такому режимі вставляє тег
// у початковий HTML у <head> ще до гідратації, а React під час гідратації
// все одно намагався звірити цей-таки <script> як частину дерева
// компонентів. Простий <script> у <head> виконується так само синхронно,
// до першого фарбування, без цього конфлікту.
export const THEME_SCRIPT = `
(function () {
  try {
    var stored = localStorage.getItem("theme");
    var isDark = stored ? stored === "dark" : window.matchMedia("(prefers-color-scheme: dark)").matches;
    document.documentElement.classList.toggle("dark", isDark);
    document.documentElement.classList.toggle("light", !isDark);
  } catch (e) {}
})();
`;
