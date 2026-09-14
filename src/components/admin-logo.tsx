import Link from "next/link";
import { PlatformWordmark } from "./platform-wordmark";

// Єдине джерело розмітки лого адмінки — використовується і в
// CourseSwitcherSidebar (сторінки всередині курсу), і напряму на
// admin/courses/page.tsx та admin/courses/new/page.tsx (сторінки БЕЗ
// sidebar, де інакше лого не показувалось би взагалі). admin/layout.tsx
// свідомо його не рендерить — лого живе рівно в одному з цих місць на
// будь-якій конкретній сторінці, ніде не дублюється.
//
// "Адмінка"-підпис — навмисно поза PlatformWordmark (він лише про назву
// платформи, не про те, що це саме адмінка) — єдине місце, яке каже
// вчителю "ви в адмінці".
export function AdminLogo({
  onClick,
  size = "lg",
}: {
  onClick?: () => void;
  // "sm" — для вузького sidebar (w-56), де "lg" не влазить/переноситься.
  size?: "sm" | "lg";
}) {
  return (
    <Link
      href="/admin/courses"
      className={size === "sm" ? "flex flex-col leading-tight" : "flex items-center leading-tight"}
      onClick={onClick}
    >
      <PlatformWordmark size={size} />
      <span
        className={
          size === "sm"
            ? "text-xs text-neutral-500 dark:text-neutral-400"
            : "ml-3 rounded-full bg-accent/10 px-2 py-0.5 text-xs text-accent"
        }
      >
        Адмінка
      </span>
    </Link>
  );
}
