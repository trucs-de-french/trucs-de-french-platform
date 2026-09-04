"use client";

import { useState, useTransition } from "react";
import type { ActionState } from "@/lib/action-state";

// Навмисно onSubmit + прямий виклик дії, а НЕ <form action={formAction}>
// (useActionState) — React 19 скидає ВСІ поля форми нативним form.reset()
// при кожному сабміті САМЕ через <form action>-інтеграцію (extractEvents$1
// у react-dom: автоматичний reset прив'язаний до native "submit" на формі,
// чий action-проп — функція). Пряма виклик дії тут узагалі не проходить
// через цей код, тож reset ніколи не відбувається — ані для контрольованих
// полів (напр. Vrai/Faux select), ані для неконтрольованих (defaultValue
// інструкцій), без потреби в reset-listener/queueMicrotask на кожному полі.
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
  const [state, setState] = useState<ActionState>(null);
  const [pending, startTransition] = useTransition();
  const [showSaved, setShowSaved] = useState(false);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = await action(state, formData);
      setState(result);
      if (result?.ok) {
        setShowSaved(true);
        setTimeout(() => setShowSaved(false), 1500);
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className={className}>
      {children}
      <div
        className={`mt-2 flex items-center gap-3 ${
          sticky
            ? "sticky bottom-0 -mx-4 border-t bg-white px-4 py-3 dark:bg-neutral-950 dark:border-neutral-800"
            : ""
        }`}
      >
        <button
          type="submit"
          disabled={pending}
          className="self-start rounded-md bg-black px-4 py-2 text-sm text-white hover:bg-neutral-800 disabled:opacity-50 dark:bg-white dark:text-black dark:hover:bg-neutral-200"
        >
          {pending ? "Зберігаю..." : saveLabel}
        </button>
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
