"use client";

import { useFormStatus } from "react-dom";

export function SubmitButton({
  children,
  pendingChildren,
  className,
  disabled,
  "aria-label": ariaLabel,
  title,
}: {
  children: React.ReactNode;
  pendingChildren?: React.ReactNode;
  className?: string;
  disabled?: boolean;
  // Потрібні для icon-only кнопок (немає видимого тексту, що й так дає
  // доступне ім'я) — напр. SceneDragList.
  "aria-label"?: string;
  title?: string;
}) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending || disabled}
      className={className}
      aria-label={ariaLabel}
      title={title}
    >
      {pending ? (pendingChildren ?? children) : children}
    </button>
  );
}
