import { ProfileAvatar } from "@/components/cabinet/profile-avatar";

// Компактна мобільна картка профілю під привітанням на cabinet/page.tsx —
// лише аватар + ім'я (роль прибрано, всім однаково). Той самий фон/рамка/
// радіус, що й інші cabinet-картки (.cabinet-card), просто менші відступи.
export function ProfileCard({
  fullName,
  avatarUrl = null,
  avatarMascot = null,
}: {
  fullName: string | null;
  avatarUrl?: string | null;
  avatarMascot?: string | null;
}) {
  const name = fullName?.trim() || "";

  return (
    <div className="cabinet-card flex items-center gap-3 px-3 py-2">
      <ProfileAvatar name={name} size={40} imageUrl={avatarUrl} mascotId={avatarMascot} />
      <div className="min-w-0 truncate font-body text-[17px] font-semibold text-[var(--cabinet-ink)]">
        {name || "—"}
      </div>
    </div>
  );
}
