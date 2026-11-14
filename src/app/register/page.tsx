import Link from "next/link";
import { UserPlus, User, Mail, Lock } from "lucide-react";
import { signUp } from "../login/actions";
import { SubmitButton } from "@/components/submit-button";
import { AuthShell } from "@/components/auth/auth-shell";
import { t } from "@/lib/i18n/t";

const lang = "uk" as const;

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <AuthShell
      variant="tabs"
      activeTab="register"
      icon={<UserPlus size={32} aria-hidden="true" />}
      iconAriaLabel={t(lang, "auth.register.avatarAria")}
      title={t(lang, "auth.register.title")}
    >
      {error && (
        <p className="auth-error" role="alert">
          <span aria-hidden="true">⚠</span>
          <span>{error}</span>
        </p>
      )}

      <form action={signUp} className="flex flex-col gap-5">
        <div className="auth-field">
          <label htmlFor="fullName" className="auth-label--sr">
            {t(lang, "auth.register.fullNameLabel")}
          </label>
          <div className="auth-input-wrap">
            <span className="auth-input-icon" aria-hidden="true">
              <User size={17} />
            </span>
            <input
              id="fullName"
              name="fullName"
              type="text"
              required
              autoComplete="name"
              placeholder={t(lang, "auth.register.fullNameLabel")}
              className="auth-input"
            />
          </div>
        </div>

        <div className="auth-field">
          <label htmlFor="email" className="auth-label--sr">
            {t(lang, "auth.register.emailLabel")}
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
              placeholder={t(lang, "auth.register.emailLabel")}
              className="auth-input"
            />
          </div>
        </div>

        <div className="auth-field">
          <label htmlFor="password" className="auth-label--sr">
            {t(lang, "auth.register.passwordLabel")}
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
              minLength={8}
              autoComplete="new-password"
              placeholder={t(lang, "auth.register.passwordLabel")}
              className="auth-input"
            />
          </div>
          <p className="auth-hint">{t(lang, "auth.register.passwordHint")}</p>
        </div>

        <SubmitButton pendingChildren={t(lang, "auth.register.submitPending")} className="auth-btn-primary">
          {t(lang, "auth.register.submit")}
        </SubmitButton>
      </form>

      <p className="mt-5 text-center text-sm">
        {t(lang, "auth.register.haveAccount")}{" "}
        <Link href="/login" className="auth-link">
          {t(lang, "auth.register.loginLink")}
        </Link>
      </p>
    </AuthShell>
  );
}
