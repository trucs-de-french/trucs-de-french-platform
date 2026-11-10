"use client";

// Глобальний (на всі сторінки /cabinet) override симульованих BadgeStats
// для вчителя — mount лише коли СЕРВЕРНИЙ isTeacher true (cabinet/
// layout.tsx), тож студент ніколи не бачить ні провайдера, ні ключа.
// localStorage — єдине "сховище" (нічого в БД); синхронізація між
// вкладками через подію "storage" (той самий ключ з іншої вкладки).
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { BadgeStats } from "@/lib/cabinet/achievements";

export const ADMIN_PREVIEW_STORAGE_KEY = "tdf.adminPreview.v1";

type AdminPreviewContextValue = {
  override: BadgeStats | null;
  setOverride: (stats: BadgeStats) => void;
  clear: () => void;
};

const AdminPreviewContext = createContext<AdminPreviewContextValue | null>(null);

function readStored(): BadgeStats | null {
  try {
    const raw = localStorage.getItem(ADMIN_PREVIEW_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as BadgeStats;
  } catch {
    return null;
  }
}

export function AdminPreviewProvider({ children }: { children: React.ReactNode }) {
  const [override, setOverrideState] = useState<BadgeStats | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- одноразова гідратація з localStorage на mount, не цикл рендерів
    setOverrideState(readStored());
    function onStorage(e: StorageEvent) {
      if (e.key === ADMIN_PREVIEW_STORAGE_KEY || e.key === null) setOverrideState(readStored());
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const setOverride = useCallback((stats: BadgeStats) => {
    setOverrideState(stats);
    try {
      localStorage.setItem(ADMIN_PREVIEW_STORAGE_KEY, JSON.stringify(stats));
    } catch {
      // приватний режим тощо — override лишається лише в state цієї вкладки
    }
  }, []);

  const clear = useCallback(() => {
    setOverrideState(null);
    try {
      localStorage.removeItem(ADMIN_PREVIEW_STORAGE_KEY);
    } catch {
      // як і вище — не критично
    }
  }, []);

  return (
    <AdminPreviewContext.Provider value={{ override, setOverride, clear }}>{children}</AdminPreviewContext.Provider>
  );
}

// Поза AdminPreviewProvider (студент — провайдер не змонтований) повертає
// завжди null/no-op: жодного компонента не треба умовно рендерити лише
// через відсутність контексту.
export function useAdminPreview(): AdminPreviewContextValue {
  const ctx = useContext(AdminPreviewContext);
  return ctx ?? { override: null, setOverride: () => {}, clear: () => {} };
}
