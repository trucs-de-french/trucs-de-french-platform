// Компактна мобільна картка профілю під привітанням на cabinet/page.tsx —
// лише аватар + ім'я (роль прибрано, всім однаково). Той самий фон/рамка/
// радіус, що й інші cabinet-картки (.cabinet-card), просто менші відступи.
export function ProfileCard({ fullName }: { fullName: string | null }) {
  const name = fullName?.trim() || "";
  const initial = (name[0] ?? "?").toUpperCase();

  return (
    <div className="cabinet-card flex items-center gap-3 px-3 py-2">
      <span
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full font-heading text-base font-extrabold"
        style={{ background: "#1a1640", color: "#f3d98b" }}
        aria-hidden="true"
      >
        {initial}
      </span>
      <div className="min-w-0 truncate font-body text-[17px] font-semibold text-[var(--cabinet-ink)]">
        {name || "—"}
      </div>
    </div>
  );
}
