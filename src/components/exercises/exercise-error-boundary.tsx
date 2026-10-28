"use client";

import { Component, type ReactNode } from "react";
import { useT } from "@/lib/i18n/context";

// Клас-boundary не може самостійно викликати hooks (useT) — функціональна
// дитина нижче отримує lang із контексту так само, як і решта студентських
// компонентів.
function ErrorBoundaryFallback() {
  const { t } = useT();
  return (
    <p className="text-sm italic text-[var(--text-muted-caption)] dark:text-[var(--text-muted-caption)]">
      {t("boundary.unavailable")}
    </p>
  );
}

// Одна зламана вправа (напр. збережений конфіг без обов'язкового поля,
// як table_fill без columnLabels) не повинна валити всю студентську
// сторінку — кожен виклик вправи на сторінках сцени/DELF/матеріалів/блоків
// задач обгортається цим boundary окремо, тож інші вправи на тій самій
// сторінці лишаються робочими. Клас, не функція — це вимога самого React
// API для error boundaries (getDerivedStateFromError/componentDidCatch
// існують лише в class-компонентах).
export class ExerciseErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: unknown, info: { componentStack?: string | null }) {
    console.error("[exercise] Помилка рендеру вправи:", error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return <ErrorBoundaryFallback />;
    }
    return this.props.children;
  }
}
