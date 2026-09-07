"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import type { ActionState } from "@/lib/action-state";
import { setStudentPreviewCookie } from "@/app/admin/courses/actions";

// Вставляє ?theme=... ПЕРЕД #fragment (не після — інакше він потрапив би
// всередину hash, а не в query string, і сервер/theme-script його не
// побачили б). href — завжди відносний шлях (/courses/...), тож
// String-маніпуляція без URL API безпечна й не потребує знання origin.
function withThemeParam(href: string, theme: "dark" | "light"): string {
  const hashIndex = href.indexOf("#");
  const base = hashIndex === -1 ? href : href.slice(0, hashIndex);
  const hash = hashIndex === -1 ? "" : href.slice(hashIndex);
  const separator = base.includes("?") ? "&" : "?";
  return `${base}${separator}theme=${theme}${hash}`;
}

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
  backLink,
  previewLink,
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
  const [previewPending, startPreviewTransition] = useTransition();

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

  function handlePreviewClick() {
    if (!previewLink) return;
    // window.open МАЄ бути синхронним усередині обробника кліка — інакше
    // браузер трактує його як програмний popup (не "у відповідь на дію
    // користувача") і блокує. Тому відкриваємо порожню вкладку одразу, а
    // навігацію в неї застосовуємо вже після того, як кука прев'ю
    // виставиться на сервері.
    const newTab = window.open("", "_blank");
    // Явно передаємо ВЖЕ резолвлену тему поточної вкладки через ?theme=
    // (theme-script.tsx читає його першим) — щойно відкрите popup-вікно
    // спостережено інакше резолвить prefers-color-scheme за батьківську
    // вкладку, коли вчитель ще не перемикав тему вручну (тоді
    // localStorage.getItem("theme") порожній і в обох).
    const theme = document.documentElement.classList.contains("dark") ? "dark" : "light";
    const href = withThemeParam(previewLink.href, theme);
    startPreviewTransition(async () => {
      await setStudentPreviewCookie(previewLink.productId);
      if (newTab) newTab.location.href = href;
    });
  }

  const disabled = dirty || pending;

  return (
    <form onSubmit={handleSubmit} onChange={() => setDirty(true)} className={className}>
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
        {backLink &&
          (disabled ? (
            <span className="text-sm text-neutral-400 dark:text-neutral-600">{backLink.label}</span>
          ) : (
            <Link href={backLink.href} className="text-sm underline">
              {backLink.label}
            </Link>
          ))}
        {previewLink && (
          <button
            type="button"
            onClick={handlePreviewClick}
            disabled={disabled || previewPending}
            className="rounded-md border px-3 py-1.5 text-sm hover:bg-neutral-50 disabled:opacity-50 dark:hover:bg-neutral-800"
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
