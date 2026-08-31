"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import type { ActionState } from "@/lib/action-state";
import { SubmitButton } from "./submit-button";

export function SaveForm({
  action,
  children,
  className,
  saveLabel = "Зберегти",
  savedLabel = "Збережено ✓",
  sticky = false,
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  children: React.ReactNode;
  className?: string;
  saveLabel?: string;
  savedLabel?: string;
  // За замовчуванням false — вмикати лише для довгих форм (напр. редагування
  // завдання), де інакше довелось би прокручувати аж донизу заради кнопки.
  // Для коротких форм (назва сцени, посилання тощо) стікі-бар був би зайвим.
  sticky?: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, null);
  const [showSaved, setShowSaved] = useState(false);
  const wasPending = useRef(false);

  useEffect(() => {
    const justFinished = wasPending.current && !pending;
    wasPending.current = pending;

    if (justFinished && state?.ok) {
      setShowSaved(true);
      const timer = setTimeout(() => setShowSaved(false), 1500);
      return () => clearTimeout(timer);
    }
  }, [pending, state]);

  return (
    <form action={formAction} className={className}>
      {children}
      <div
        className={`mt-2 flex items-center gap-3 ${
          sticky
            ? "sticky bottom-0 -mx-4 border-t bg-white px-4 py-3 dark:bg-neutral-950 dark:border-neutral-800"
            : ""
        }`}
      >
        <SubmitButton
          pendingChildren="Зберігаю..."
          className="self-start rounded-md bg-black px-4 py-2 text-sm text-white hover:bg-neutral-800 disabled:opacity-50 dark:bg-white dark:text-black dark:hover:bg-neutral-200"
        >
          {saveLabel}
        </SubmitButton>
        {showSaved && (
          <span className="text-sm font-medium text-green-600 dark:text-green-400">
            {savedLabel}
          </span>
        )}
        {state?.error && (
          <span className="text-sm text-red-600 dark:text-red-400">{state.error}</span>
        )}
      </div>
    </form>
  );
}
