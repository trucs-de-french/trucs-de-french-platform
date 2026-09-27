"use client";

import { confirmMessageForTaskConfig } from "@/lib/exercises/task-validation";
import { buildTaskConfig } from "@/lib/exercises/task-config-builder";

// new/page.tsx лишається серверним компонентом (redirect() у createTask,
// без useActionState) — <form action={createTask}> там не може отримати
// onSubmit напряму (обробники подій вимагають клієнтський компонент), тож
// ця тонка обгортка існує лише заради одного onSubmit-перехоплення перед
// redirect()-сабмітом: те саме підтвердження "Є незаповнені поля",
// що SaveForm (validateBeforeSubmit="task-config") дає для редагування.
export function TaskCreateForm({
  action,
  children,
  className,
}: {
  action: (formData: FormData) => void | Promise<void>;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <form
      action={action}
      className={className}
      onSubmit={(e) => {
        const formData = new FormData(e.currentTarget);
        const message = confirmMessageForTaskConfig(formData, buildTaskConfig);
        if (message && !window.confirm(message)) e.preventDefault();
      }}
    >
      {children}
    </form>
  );
}
