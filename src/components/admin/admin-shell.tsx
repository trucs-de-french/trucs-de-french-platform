import { AdminSidebar } from "@/components/admin/admin-sidebar";
import { AdminMobileHeader } from "@/components/admin/admin-mobile-header";

// Той самий вигляд, що /cabinet (темна indigo/gold рейка + крем/темна
// панель контенту), для сторінок адмінки, що отримали новий дизайн
// (courses, achievements-preview).
//
// position:fixed;inset:0 (.admin-shell-fixed) — НЕ full-bleed breakout
// (mx-[calc(50%-50vw)] w-screen): той давав горизонтальний скрол (100vw
// рахує і ширину вертикальної скрол-доріжки документа) і білі смуги
// зверху/знизу (p-6 кореневого admin/layout.tsx навколо, висота рейки не
// сягала самого низу вьюпорта). Фіксований оверлей повністю виходить за
// межі batьківського padding'а в обох напрямках одразу, рейка/панель —
// .cabinet-frame/.cabinet-panel (ті самі класи, що /cabinet) всередині
// нього скролять і заповнюють точно 100dvh.
//
// fullName/avatarUrl/avatarMascot — ТІ САМІ поля profiles, що cabinet/
// layout.tsx читає для CabinetSidebarProfile; кожна сторінка з AdminShell
// сама фетчить їх (lib/admin/admin-profile.ts) і передає сюди.
export function AdminShell({
  initialIsDark,
  fullName,
  avatarUrl,
  avatarMascot,
  children,
}: {
  initialIsDark: boolean | null;
  fullName: string | null;
  avatarUrl: string | null;
  avatarMascot: string | null;
  children: React.ReactNode;
}) {
  return (
    <div className="cabinet admin-shell-fixed">
      <div className="cabinet-frame">
        <AdminMobileHeader
          initialIsDark={initialIsDark}
          fullName={fullName}
          avatarUrl={avatarUrl}
          avatarMascot={avatarMascot}
        />
        <AdminSidebar
          initialIsDark={initialIsDark}
          fullName={fullName}
          avatarUrl={avatarUrl}
          avatarMascot={avatarMascot}
        />
        <main className="cabinet-panel">{children}</main>
      </div>
    </div>
  );
}
