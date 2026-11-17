"use client";

import { useState, type InputHTMLAttributes, type ReactNode } from "react";
import { Eye, EyeOff, Lock } from "lucide-react";
import { t } from "@/lib/i18n/t";

const lang = "uk" as const;

type PasswordInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & {
  icon?: ReactNode;
};

// Той самий .auth-input-wrap/.auth-input-icon/.auth-input, що й решта
// auth-полів (email/name) — лише з кнопкою показу/сховання як ще одним
// flex-item праворуч (НЕ absolute-overlay над текстом, тож без потреби
// в правому padding-хаку: .auth-input-wrap сам flex-row).
export function PasswordInput({ icon, className, ...rest }: PasswordInputProps) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="auth-input-wrap">
      <span className="auth-input-icon" aria-hidden="true">
        {icon ?? <Lock size={17} />}
      </span>
      <input
        {...rest}
        type={visible ? "text" : "password"}
        className={className ? `auth-input ${className}` : "auth-input"}
      />
      <button
        type="button"
        aria-pressed={visible}
        aria-label={visible ? t(lang, "auth.passwordToggle.hide") : t(lang, "auth.passwordToggle.show")}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => setVisible((v) => !v)}
        className="auth-field-toggle"
      >
        {visible ? <EyeOff size={17} aria-hidden="true" /> : <Eye size={17} aria-hidden="true" />}
      </button>
    </div>
  );
}
