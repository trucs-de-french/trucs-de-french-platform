import Link from "next/link";

// Єдине джерело розмітки лого адмінки — використовується і в
// CourseSwitcherSidebar (сторінки всередині курсу), і напряму на
// admin/courses/page.tsx та admin/courses/new/page.tsx (сторінки БЕЗ
// sidebar, де інакше лого не показувалось би взагалі). admin/layout.tsx
// свідомо його не рендерить — лого живе рівно в одному з цих місць на
// будь-якій конкретній сторінці, ніде не дублюється.
export function AdminLogo({ onClick }: { onClick?: () => void }) {
  return (
    <Link href="/admin/courses" className="flex flex-col leading-tight" onClick={onClick}>
      <span className="text-lg font-semibold">Trucs de French</span>
      <span className="text-xs text-neutral-500 dark:text-neutral-400">Адмінка</span>
    </Link>
  );
}
