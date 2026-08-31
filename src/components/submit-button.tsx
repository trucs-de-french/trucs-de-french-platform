"use client";

import { useFormStatus } from "react-dom";

export function SubmitButton({
  children,
  pendingChildren,
  className,
  disabled,
}: {
  children: React.ReactNode;
  pendingChildren?: React.ReactNode;
  className?: string;
  disabled?: boolean;
}) {
  const { pending } = useFormStatus();

  return (
    <button type="submit" disabled={pending || disabled} className={className}>
      {pending ? (pendingChildren ?? children) : children}
    </button>
  );
}
