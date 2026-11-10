"use client";

import { t } from "@/lib/i18n/t";
import type { UiLang } from "@/lib/ui/product-lang";
import { useAdminPreview } from "@/lib/cabinet/admin-preview";

// Тонка gold-смужка нагорі будь-якої /cabinet сторінки, поки активний
// адмінський override (localStorage, lib/cabinet/admin-preview.tsx) —
// рендериться лише всередині AdminPreviewProvider (вчитель), і лише коли
// override не null.
export function AdminPreviewBar({ lang }: { lang: UiLang }) {
  const { override, clear } = useAdminPreview();
  if (!override) return null;

  return (
    <div className="admin-preview-bar">
      {t(lang, "achievements.admin.previewBar.title")}
      <button type="button" className="achievements-admin-pill-outline" onClick={clear}>
        {t(lang, "achievements.admin.previewBar.disable")}
      </button>
    </div>
  );
}
