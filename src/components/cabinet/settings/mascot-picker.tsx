"use client";

// Грід круглих опцій маскота — 6 колонок на десктопі, 3 на мобільному
// (Tailwind grid-cols-3/sm:grid-cols-6). Кожна опція рендерить ту саму
// ProfileAvatar, що й сам аватар-прев'ю, щоб fallback на сірий кружок із
// номером (картинка ще не додана) не дублював логіку окремо тут.
import { MASCOTS } from "@/lib/cabinet/mascots";
import { ProfileAvatar } from "@/components/cabinet/profile-avatar";

const OPTION_SIZE = 64;
const SELECTED_RING = "0 0 0 2.5px #d9b765, 0 0 14px 2px rgba(217, 183, 101, 0.5)";

export function MascotPicker({
  selected,
  onSelect,
}: {
  selected: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="grid grid-cols-3 justify-items-center gap-3 md:grid-cols-6">
      {MASCOTS.map((mascot) => {
        const isSelected = selected === mascot.id;
        return (
          <button
            key={mascot.id}
            type="button"
            onClick={() => onSelect(mascot.id)}
            aria-pressed={isSelected}
            aria-label={mascot.label}
            className="settings-mascot-option"
            style={isSelected ? { boxShadow: SELECTED_RING } : undefined}
          >
            <ProfileAvatar name="" size={OPTION_SIZE} mascotId={mascot.id} />
          </button>
        );
      })}
    </div>
  );
}
