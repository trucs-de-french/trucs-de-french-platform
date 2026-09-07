import Script from "next/script";

// Виконується синхронно до першого фарбування сторінки (strategy="beforeInteractive"
// -> Next.js вставляє скрипт у початковий HTML, у <head>), щоб виставити клас
// .dark ще до рендеру React і уникнути "блимання" не тією темою. Не залежить
// від React/гідратації.
//
// ?theme=dark|light у URL — явно передана тема з батьківської вкладки, лише
// для "Переглянути в режимі учня" (SaveForm.handlePreviewClick), яке
// відкриває студентську сторінку в НОВІЙ вкладці через window.open. Нове
// вікно за специфікацією має той самий доступ до localStorage цього origin,
// що й батьківське — але спостережено, що щойно створене popup-вікно може
// резолвити prefers-color-scheme інакше за батьківську вкладку (платформна
// непослідовність, не залежить від коду тут), тож коли вчитель ще ніколи не
// перемикав тему вручну (localStorage порожній), фолбек міг розійтися.
// Параметр з URL, коли є, перекриває обидва джерела і одразу записується в
// localStorage — подальша навігація студента вже йде звичайним шляхом.
const THEME_SCRIPT = `
(function () {
  try {
    var params = new URLSearchParams(window.location.search);
    var fromUrl = params.get("theme");
    var stored;
    if (fromUrl === "dark" || fromUrl === "light") {
      stored = fromUrl;
      localStorage.setItem("theme", fromUrl);
    } else {
      stored = localStorage.getItem("theme");
    }
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
