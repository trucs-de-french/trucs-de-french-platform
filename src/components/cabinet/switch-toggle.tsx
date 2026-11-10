"use client";

// Кастомний перемикач (48x28 pill, білий гвинт) замість нативного
// checkbox — light: indigo-градієнт у стані "on", dark: gold-градієнт;
// role="switch"/aria-checked — ТОЙ САМИЙ елемент, що й стан (не прикраса
// над окремим invisible-checkbox).
export function SwitchToggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`switch-toggle ${checked ? "switch-toggle--on" : ""}`}
    >
      <span className="switch-toggle-knob" aria-hidden="true" />
    </button>
  );
}
