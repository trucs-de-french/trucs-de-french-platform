"use client";

// Пілюля спільна для мови/теми/тижневої цілі на /cabinet/settings — НЕ
// .cabinet-lang-pill (той клас рахує на темний indigo-фон сайдбару:
// неактивна пілюля там ледь біла на білому — невидима на кремовій картці
// Налаштувань). .settings-pill/--active нижче (globals.css) непрозорі в
// обох темах незалежно від фону.
export function SettingsPill({
  active,
  onClick,
  disabled,
  ariaLabel,
  children,
}: {
  active: boolean;
  onClick: () => void;
  disabled?: boolean;
  ariaLabel?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      aria-pressed={active}
      aria-label={ariaLabel}
      onClick={onClick}
      className={`settings-pill ${active ? "settings-pill--active" : ""}`}
    >
      {children}
    </button>
  );
}
