import { PlatformWordmark } from "@/components/platform-wordmark";

// Спільний каркас логінних сторінок поза /cabinet (forgot-password/
// update-password) — НЕ /login чи /register (їх задача просить не
// рестайлити), лише нові сторінки відновлення пароля. Власні CSS-класи
// (.auth-shell-*, globals.css), не --cabinet-* токени: ті визначені лише
// всередині .cabinet-обгортки (cabinet/layout.tsx), якої тут немає —
// пряме читання дало б undefined-змінні. Кольори нижче буквально
// повторюють світлі/темні значення --cabinet-panel-bg/-card-bg/-line/-ink,
// щоб сторінка виглядала як частина того самого кабінетного стилю.
export function AuthShell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="auth-shell-page">
      <main className="auth-shell-card">
        <div className="flex justify-center">
          <PlatformWordmark size="md" tagline />
        </div>
        <h1 className="auth-shell-title">{title}</h1>
        <span className="auth-shell-rule" aria-hidden="true" />
        <div className="auth-shell-body">{children}</div>
      </main>
    </div>
  );
}
