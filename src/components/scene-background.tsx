import type { CSSProperties } from "react";

// Декоративний курсовий фон студентської сторінки сцени — викликач
// (courses/[productId]/scenes/[sceneId]/page.tsx) уже ПОВТОРНО валідував
// усі три значення через validate-r2-url.ts безпосередньо перед рендером
// (значенню з БД не довіряємо навіть тут, у кінці ланцюжка) — тут лише
// escape-перевірка символів, що могли б вирватись із url("...") (лапки/
// дужки/зворотний слеш/пробіл), як додатковий захисний шар, а не єдиний.
const UNSAFE_FOR_CSS_URL = /["'()\\\s]/;

function cssUrl(value: string | null): string {
  if (!value || UNSAFE_FOR_CSS_URL.test(value)) return "none";
  return `url("${value}")`;
}

// Нічого не рендерить, якщо жодне з трьох значень не задано — викликач і
// так пропускає рендер цілком у цьому випадку, друга перевірка тут лише
// заради безпечного прямого використання компонента.
export function SceneBackground({
  desktopUrl,
  mobileUrl,
  fillColor,
}: {
  desktopUrl: string | null;
  mobileUrl: string | null;
  fillColor: string | null;
}) {
  if (!desktopUrl && !mobileUrl && !fillColor) return null;

  const style = {
    "--scene-bg-desktop": cssUrl(desktopUrl),
    "--scene-bg-mobile": cssUrl(mobileUrl),
    "--scene-bg-fill": fillColor || "transparent",
  } as CSSProperties;

  return (
    <div aria-hidden style={style}>
      {/* landscape — фіксований шар позаду контенту на весь екран:
          background-attachment:fixed тут НЕ підходить (iOS Safari його
          ігнорує) — саме тому окремий position:fixed елемент, не фон body. */}
      <div className="scene-bg-layer scene-bg-layer--desktop" />
      {/* portrait — суцільна заливка на весь екран (фіксована, той самий
          принцип) ПЛЮС банер нижче, що прокручується з документом. */}
      <div className="scene-bg-layer scene-bg-layer--portrait-fill" />
      <div className="scene-bg-banner" />
    </div>
  );
}
