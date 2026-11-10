import { AdminSidebar } from "@/components/admin/admin-sidebar";
import { AdminMobileHeader } from "@/components/admin/admin-mobile-header";

// Той самий вигляд, що /cabinet (темна indigo/gold рейка + крем/темна
// панель контенту), для сторінок адмінки, що отримали новий дизайн
// (courses, achievements-preview). Full-bleed breakout (mx-[calc(50%-
// 50vw)]) — та сама техніка, що вже використовує courses/[id]/layout.tsx,
// щоб вийти за межі mx-auto max-w-4xl p-6 кореневого admin/layout.tsx
// БЕЗ зміни самого layout.tsx (там сидить і сам guard, і глибокий
// редактор курсу з власним sidebar — його не торкаємось).
export function AdminShell({
  initialIsDark,
  children,
}: {
  initialIsDark: boolean | null;
  children: React.ReactNode;
}) {
  return (
    <div className="cabinet mx-[calc(50%-50vw)] w-screen">
      <AdminMobileHeader initialIsDark={initialIsDark} />
      <div className="admin-shell">
        <AdminSidebar initialIsDark={initialIsDark} />
        <main className="admin-shell-panel">{children}</main>
      </div>
    </div>
  );
}
