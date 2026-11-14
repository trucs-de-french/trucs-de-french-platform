import Link from "next/link";
import { KeyRound, MailCheck, Mail } from "lucide-react";
import { t } from "@/lib/i18n/t";
import { AuthShell } from "@/components/auth/auth-shell";
import { SubmitButton } from "@/components/submit-button";
import { requestPasswordResetByEmail } from "./actions";

// Мова цих сторінок — завжди "uk" (той самий підхід, що вже /login:
// немає сесії/профілю до логіну, щоб визначити мову інакше, і задача
// явно просить саме дефолт без автовизначення).
const lang = "uk" as const;

export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; sent?: string }>;
}) {
  const { error, sent } = await searchParams;

  return (
    <AuthShell
      variant="heading"
      heading={{
        title: t(lang, "auth.forgotPassword.heading"),
        lead: t(lang, "auth.forgotPassword.headingLead"),
      }}
      icon={
        sent ? <MailCheck size={32} aria-hidden="true" /> : <KeyRound size={32} aria-hidden="true" />
      }
      iconAriaLabel={
        sent ? t(lang, "auth.forgotPassword.sentAvatarAria") : t(lang, "auth.forgotPassword.avatarAria")
      }
      title={sent ? t(lang, "auth.forgotPassword.sentTitle") : t(lang, "auth.forgotPassword.title")}
    >
      {sent ? (
        <p className="auth-success" role="status">
          <span aria-hidden="true">✓</span>
          <span>{t(lang, "auth.forgotPassword.successGeneric")}</span>
        </p>
      ) : (
        <>
          {error === "expired" && (
            <p className="auth-error" role="alert">
              <span aria-hidden="true">⚠</span>
              <span>{t(lang, "auth.forgotPassword.linkExpired")}</span>
            </p>
          )}
          {error === "rate_limited" && (
            <p className="auth-error" role="alert">
              <span aria-hidden="true">⚠</span>
              <span>{t(lang, "auth.forgotPassword.rateLimited")}</span>
            </p>
          )}
          {error === "invalid_email" && (
            <p className="auth-error" role="alert">
              <span aria-hidden="true">⚠</span>
              <span>{t(lang, "auth.forgotPassword.invalidEmail")}</span>
            </p>
          )}

          <form action={requestPasswordResetByEmail} className="flex flex-col gap-5">
            <div className="auth-field">
              <label htmlFor="email" className="auth-label--sr">
                {t(lang, "auth.forgotPassword.emailLabel")}
              </label>
              <div className="auth-input-wrap">
                <span className="auth-input-icon" aria-hidden="true">
                  <Mail size={17} />
                </span>
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  autoFocus
                  autoComplete="email"
                  placeholder={t(lang, "auth.forgotPassword.emailLabel")}
                  className="auth-input"
                />
              </div>
            </div>

            <SubmitButton pendingChildren={t(lang, "auth.forgotPassword.submitPending")} className="auth-btn-primary">
              {t(lang, "auth.forgotPassword.submit")}
            </SubmitButton>
          </form>
        </>
      )}

      <p className="mt-5 text-center">
        <Link href="/login" className="auth-link">
          {t(lang, "auth.forgotPassword.backToLogin")}
        </Link>
      </p>
    </AuthShell>
  );
}
