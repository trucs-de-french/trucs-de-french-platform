import type { ReactNode } from "react";
import Link from "next/link";
import { PlatformWordmark } from "@/components/platform-wordmark";
import { t } from "@/lib/i18n/t";

// Спільний каркас для /login, /register, /auth/forgot-password,
// /auth/update-password — split-card: ліва градієнтна панель (бренд +
// таби вхід/реєстрація АБО короткий заголовок для відновлення пароля),
// права колонка — форма. Усі ці сторінки поза /cabinet, тож --cabinet-*
// токени (визначені лише всередині .cabinet-обгортки) тут недоступні —
// власні класи .auth-shell-* в globals.css з буквальними кольорами.
// Мова хардкодна "uk" (той самий підхід, що вже був у /login до цієї
// задачі) — немає сесії/профілю до логіну, щоб визначити мову інакше.
const lang = "uk" as const;

type TabsProps = {
  variant: "tabs";
  activeTab: "login" | "register";
};
type HeadingProps = {
  variant: "heading";
  heading: { title: string; lead: string };
};

export function AuthShell({
  icon,
  iconAriaLabel,
  title,
  lead,
  children,
  ...panel
}: (TabsProps | HeadingProps) & {
  icon: ReactNode;
  iconAriaLabel: string;
  title: string;
  lead?: string;
  children: ReactNode;
}) {
  return (
    <div className="auth-shell-page">
      <div className="auth-shell-card">
        <aside className="auth-shell-panel">
          <div className="auth-shell-brand">
            <PlatformWordmark size="md" tone="light" />
            <span className="auth-shell-brand-rule" aria-hidden="true" />
          </div>

          {panel.variant === "tabs" ? (
            <nav className="auth-shell-tabs" aria-label={t(lang, "auth.shell.tabsAriaLabel")}>
              <Link
                href="/login"
                aria-current={panel.activeTab === "login" ? "page" : undefined}
                className={`auth-shell-tab ${panel.activeTab === "login" ? "auth-shell-tab--active" : ""}`}
              >
                {t(lang, "auth.shell.tabLogin")}
              </Link>
              <Link
                href="/register"
                aria-current={panel.activeTab === "register" ? "page" : undefined}
                className={`auth-shell-tab ${panel.activeTab === "register" ? "auth-shell-tab--active" : ""}`}
              >
                {t(lang, "auth.shell.tabRegister")}
              </Link>
            </nav>
          ) : (
            <div className="auth-shell-heading-block">
              <p className="auth-shell-heading-title">{panel.heading.title}</p>
              <p className="auth-shell-heading-lead">{panel.heading.lead}</p>
            </div>
          )}

          <p className="auth-shell-tagline">{t(lang, "auth.shell.tagline")}</p>
        </aside>

        <div className="auth-shell-form-area">
          <div className="auth-shell-form-scroll">
            <div className="auth-shell-avatar" role="img" aria-label={iconAriaLabel}>
              {icon}
            </div>
            <h1 className="auth-shell-title">{title}</h1>
            {lead && <p className="auth-shell-lead">{lead}</p>}
            <div className="auth-shell-body">{children}</div>
          </div>

          <footer className="auth-shell-footer">
            <a
              href="https://t.me/trucs_de_french"
              target="_blank"
              rel="noopener noreferrer"
              className="auth-shell-footer-link"
            >
              {t(lang, "auth.shell.footerQuestion")}
            </a>
          </footer>
        </div>
      </div>
    </div>
  );
}
