"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import type { ActionState } from "@/lib/action-state";
import { useStudentPreview } from "@/lib/use-student-preview";
import { BUTTON_PRIMARY_LG, BUTTON_SECONDARY_LG, BUTTON_PREVIEW } from "@/lib/button-styles";
import { BREADCRUMB_LINK } from "@/lib/typography-styles";

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
  id,
  saveLabel = "Зберегти",
  saveVariant = "button",
  saveButtonStyle = "primary",
  savedLabel = "Збережено ✓",
  sticky = false,
  backLink,
  previewLink,
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  children: React.ReactNode;
  className?: string;
  // Потрібен зовнішнім кнопкам поза формою (напр. глобальне "Зберегти все"
  // на сторінці сцени), щоб знайти форму через document.getElementById і
  // викликати requestSubmit() — форма сабмітить через onSubmit нижче
  // незалежно від того, як саме викликаний submit.
  id?: string;
  saveLabel?: string;
  // "link" — для швидких компактних форм (напр. додавання посилання сцени),
  // де важка залита кнопка виглядає непропорційно поруч із рядком полів.
  saveVariant?: "button" | "link";
  // "secondary" — коли ЦЯ кнопка вже не головна дія на сторінці (напр.
  // окремі "Зберегти" в блоках сцени, тепер другорядні поряд із закріпленою
  // "Зберегти все"). Стосується лише saveVariant === "button" — "link" і так
  // не залитий.
  saveButtonStyle?: "primary" | "secondary";
  savedLabel?: string;
  // За замовчуванням false — вмикати лише для довгих форм (напр. редагування
  // завдання), де інакше довелось би прокручувати аж донизу заради кнопки.
  // Для коротких форм (назва сцени, посилання тощо) стікі-бар був би зайвим.
  sticky?: boolean;
  // Дублікат навігаційного посилання "Назад" (уже є вгорі сторінки) — у
  // тій самій sticky-панелі, щоб не скролити вгору для довгих форм.
  // Дизейблиться, поки є незбережені зміни/сабміт триває.
  backLink?: { href: string; label: string };
  // "Переглянути в режимі учня" — нова вкладка з реальною студентською
  // сторінкою. Плоскі серіалізовані дані (не render-prop/closure) — SaveForm
  // рендериться з серверного page.tsx, а функції неможливо передати через
  // межу Server -> Client Component.
  previewLink?: { productId: string; href: string };
}) {
  const [state, setState] = useState<ActionState>(null);
  const [pending, startTransition] = useTransition();
  const [showSaved, setShowSaved] = useState(false);
  // Жодне поле форми зараз не позначає себе як "змінене" — універсальний
  // спосіб дізнатись про це для БУДЬ-ЯКОГО поля (контрольованого чи ні,
  // без потреби чіпати кожне окремо) — делегування onChange з самої форми:
  // будь-яка зміна будь-якого input/select/textarea всередині випливає сюди.
  const [dirty, setDirty] = useState(false);
  // Хук викликається безумовно (правило хуків) навіть коли previewLink нема —
  // порожні рядки нешкідливі, бо кнопка нижче тоді просто не рендериться.
  const { pending: previewPending, handleClick: handlePreviewClick } = useStudentPreview(
    previewLink?.productId ?? "",
    previewLink?.href ?? ""
  );

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = await action(state, formData);
      setState(result);
      if (result?.ok) {
        setShowSaved(true);
        setDirty(false);
        setTimeout(() => setShowSaved(false), 1500);
      }
    });
  }

  const disabled = dirty || pending;

  return (
    <form id={id} onSubmit={handleSubmit} onChange={() => setDirty(true)} className={className}>
      {children}
      <div
        className={`mt-4 mb-6 flex items-center gap-3 ${
          sticky
            ? "sticky bottom-0 -mx-4 border-t border-gray-200 bg-white px-4 py-3 shadow-[0_-1px_3px_rgba(0,0,0,0.1)] dark:border-neutral-800 dark:bg-neutral-950"
            : ""
        }`}
      >
        <button
          type="submit"
          disabled={pending}
          className={
            saveVariant === "link"
              ? "self-start text-sm text-brand hover:underline disabled:opacity-50"
              : `self-start ${saveButtonStyle === "secondary" ? BUTTON_SECONDARY_LG : BUTTON_PRIMARY_LG}`
          }
        >
          {pending ? "Зберігаю..." : saveLabel}
        </button>
        {backLink &&
          (disabled ? (
            <span className="text-sm text-neutral-400 dark:text-neutral-600">{backLink.label}</span>
          ) : (
            <Link href={backLink.href} className={BREADCRUMB_LINK}>
              {backLink.label}
            </Link>
          ))}
        {previewLink && (
          <button
            type="button"
            onClick={handlePreviewClick}
            disabled={disabled || previewPending}
            className={BUTTON_PREVIEW}
          >
            Переглянути в режимі учня
          </button>
        )}
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
