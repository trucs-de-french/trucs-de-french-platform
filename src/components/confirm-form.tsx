"use client";

// Тонка обгортка над <form> для дій, що потребують "Ви впевнені?" перед
// сабмітом — без введення назви вручну, просто window.confirm. Загальний
// компонент (не специфічний для видалення курсу), щоб можна було повторно
// використати для інших руйнівних дій за потреби.
export function ConfirmForm({
  action,
  message,
  className,
  children,
}: {
  action: React.ComponentProps<"form">["action"];
  message: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <form
      action={action}
      className={className}
      onSubmit={(e) => {
        if (!window.confirm(message)) {
          e.preventDefault();
        }
      }}
    >
      {children}
    </form>
  );
}
