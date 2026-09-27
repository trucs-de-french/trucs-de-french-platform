"use client";

import { Component, type ReactNode } from "react";

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
      return (
        <p className="text-sm italic text-neutral-500 dark:text-neutral-400">
          Вправа тимчасово недоступна.
        </p>
      );
    }
    return this.props.children;
  }
}
