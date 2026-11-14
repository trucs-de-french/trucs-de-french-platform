import Link from "next/link";
import { User, Mail, Lock } from "lucide-react";
import { signIn } from "./actions";
import { SubmitButton } from "@/components/submit-button";
import { AuthShell } from "@/components/auth/auth-shell";
import { t } from "@/lib/i18n/t";

const lang = "uk" as const;

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; message?: string }>;
}) {
  const { error, message } = await searchParams;

  return (
    <AuthShell
      variant="tabs"
      activeTab="login"
      icon={<User size={32} aria-hidden="true" />}
      iconAriaLabel={t(lang, "auth.login.avatarAria")}
      title={t(lang, "auth.login.title")}
    >
      {message && (
        <p className="auth-success" role="status">
          <span aria-hidden="true">✓</span>
          <span>{message}</span>
        </p>
      )}
      {error && (
        <p className="auth-error" role="alert">
          <span aria-hidden="true">⚠</span>
          <span>{error}</span>
        </p>
      )}

      <form action={signIn} className="flex flex-col gap-5">
        <div className="auth-field">
          <label htmlFor="email" className="auth-label--sr">
            {t(lang, "auth.login.emailLabel")}
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
              autoComplete="email"
              placeholder={t(lang, "auth.login.emailLabel")}
              className="auth-input"
            />
          </div>
        </div>

        <div className="auth-field">
          <label htmlFor="password" className="auth-label--sr">
            {t(lang, "auth.login.passwordLabel")}
          </label>
          <div className="auth-input-wrap">
            <span className="auth-input-icon" aria-hidden="true">
              <Lock size={17} />
            </span>
            <input
              id="password"
              name="password"
              type="password"
              required
              autoComplete="current-password"
              placeholder={t(lang, "auth.login.passwordLabel")}
              className="auth-input"
            />
          </div>
        </div>

        <div className="flex items-center justify-between gap-3">
          <Link href="/auth/forgot-password" className="auth-link">
            {t(lang, "auth.login.forgotLink")}
          </Link>
        </div>

        <SubmitButton pendingChildren={t(lang, "auth.login.submitPending")} className="auth-btn-primary">
          {t(lang, "auth.login.submit")}
        </SubmitButton>
      </form>

      <p className="mt-5 text-center text-sm">
        {t(lang, "auth.login.noAccount")}{" "}
        <Link href="/register" className="auth-link">
          {t(lang, "auth.login.registerLink")}
        </Link>
      </p>
    </AuthShell>
  );
}
