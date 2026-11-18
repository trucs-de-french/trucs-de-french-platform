"use client";

// Кастомний перемикач (48x28 pill, білий гвинт) замість нативного
// checkbox — light: indigo-градієнт у стані "on", dark: gold-градієнт;
// role="switch"/aria-checked — ТОЙ САМИЙ елемент, що й стан (не прикраса
// над окремим invisible-checkbox).
export function SwitchToggle({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label?: string;
  // Задача "Тренувати мої слова" (setup-екран, train-setup-view.tsx):
  // останній увімкнений тип вправи й gap-fill без достатньої кількості
  // прикладів мають виглядати ВИМКНЕНИМИ, не просто ігнорувати клік —
  // звичайний disabled на <button>, той самий підхід, що решта кабінету.
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`switch-toggle ${checked ? "switch-toggle--on" : ""}`}
    >
      <span className="switch-toggle-knob" aria-hidden="true" />
    </button>
  );
}
