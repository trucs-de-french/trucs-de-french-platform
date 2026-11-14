"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Eye, EyeOff, Lock, CheckCircle2 } from "lucide-react";
import { t } from "@/lib/i18n/t";
import { updatePassword } from "./actions";
import { MIN_PASSWORD_LENGTH, type UpdatePasswordError } from "./constants";

const lang = "uk" as const;

const ERROR_KEY: Record<UpdatePasswordError, Parameters<typeof t>[1]> = {
  too_short: "auth.updatePassword.error.tooShort",
  mismatch: "auth.updatePassword.error.mismatch",
  same_password: "auth.updatePassword.error.samePassword",
  weak_password: "auth.updatePassword.error.weakPassword",
  session_missing: "auth.updatePassword.error.sessionMissing",
  generic: "auth.updatePassword.error.generic",
};

// Кругла кнопка показу/сховання — НЕ native control (type="button", не
// checkbox/input), aria-pressed передає стан. Той самий компонент для
// обох полів (новий пароль/повторіть пароль), id переданий зовні —
// стабільний, не генерується випадково (без hydration-різниці).
function PasswordField({
  id,
  label,
  value,
  onChange,
  autoFocus,
  autoComplete,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  autoFocus?: boolean;
  autoComplete: string;
}) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="auth-field">
      <label htmlFor={id} className="auth-label--sr">
        {label}
      </label>
      <div className="auth-input-wrap">
        <span className="auth-input-icon" aria-hidden="true">
          <Lock size={17} />
        </span>
        <input
          id={id}
          name={id}
          type={visible ? "text" : "password"}
          required
          autoFocus={autoFocus}
          autoComplete={autoComplete}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={label}
          className="auth-input"
        />
        <button
          type="button"
          aria-pressed={visible}
          aria-label={
            visible ? t(lang, "auth.updatePassword.hidePasswordAria") : t(lang, "auth.updatePassword.showPasswordAria")
          }
          onClick={() => setVisible((v) => !v)}
          className="auth-field-toggle"
        >
          {visible ? <EyeOff size={17} aria-hidden="true" /> : <Eye size={17} aria-hidden="true" />}
        </button>
      </div>
    </div>
  );
}

export function UpdatePasswordForm() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<UpdatePasswordError | null>(null);
  const [success, setSuccess] = useState(false);
  const [pending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await updatePassword(password, confirmPassword);
      if (result.ok) {
        setSuccess(true);
      } else {
        // Паролі НЕ очищаються після невдалої спроби (студент не мусить
        // перевводити) — лише код помилки з сервера, сам пароль сервер
        // ніколи не "ехо" назад.
        setError(result.error ?? "generic");
      }
    });
  }

  if (success) {
    return (
      <div className="flex flex-col items-center gap-4 text-center">
        <CheckCircle2 size={40} className="auth-success" aria-hidden="true" />
        <p className="auth-success" role="status">
          {t(lang, "auth.updatePassword.success")}
        </p>
        <Link href="/cabinet" className="auth-btn-primary">
          {t(lang, "auth.updatePassword.goToCabinet")}
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {error && (
        <p className="auth-error" role="alert">
          <span aria-hidden="true">⚠</span>
          <span>{t(lang, ERROR_KEY[error])}</span>
        </p>
      )}
      {error === "session_missing" && (
        <p className="-mt-2">
          <Link href="/auth/forgot-password" className="auth-link">
            {t(lang, "auth.forgotPassword.title")}
          </Link>
        </p>
      )}

      <PasswordField
        id="password"
        label={t(lang, "auth.updatePassword.newPasswordLabel")}
        value={password}
        onChange={setPassword}
        autoFocus
        autoComplete="new-password"
      />
      <p className="auth-hint">{t(lang, "auth.updatePassword.hint", { min: MIN_PASSWORD_LENGTH })}</p>

      <PasswordField
        id="confirmPassword"
        label={t(lang, "auth.updatePassword.confirmPasswordLabel")}
        value={confirmPassword}
        onChange={setConfirmPassword}
        autoComplete="new-password"
      />

      <button type="submit" disabled={pending} className="auth-btn-primary">
        {pending ? t(lang, "auth.updatePassword.submitPending") : t(lang, "auth.updatePassword.submit")}
      </button>
    </form>
  );
}
