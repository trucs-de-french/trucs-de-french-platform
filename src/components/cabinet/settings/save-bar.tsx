// Нижня панель "Є незбережені зміни" — зникає, коли форма не dirty.
// position:sticky bottom-0 всередині .cabinet-panel (той самий скрол-
// контейнер, що інші sticky-елементи кабінету, Z_ACTION_BAR).
import { t } from "@/lib/i18n/t";
import type { UiLang } from "@/lib/ui/product-lang";
import { Z_ACTION_BAR } from "@/lib/z-layers";

export function SettingsSaveBar({
  lang,
  pending,
  error,
  onCancel,
  onSave,
}: {
  lang: UiLang;
  pending: boolean;
  error: string | null;
  onCancel: () => void;
  onSave: () => void;
}) {
  return (
    <div className={`sticky bottom-0 ${Z_ACTION_BAR} -mx-4 mt-2 sm:-mx-6`}>
      <div className="cabinet-card mx-4 flex flex-col gap-2 p-4 sm:mx-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-[var(--cabinet-ink)]">{t(lang, "settings.save.unsaved")}</p>
          {error && <p className="text-xs text-red-600">{error}</p>}
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={pending}
            onClick={onCancel}
            className="flex min-h-11 items-center justify-center rounded-full border border-[var(--cabinet-line)] bg-transparent px-4 text-sm font-bold text-[var(--cabinet-ghost-fg)] hover:bg-[var(--cabinet-ghost-bg-hover)] disabled:opacity-60 dark:border-[1.5px] dark:border-[var(--cabinet-btn-border)]"
          >
            {t(lang, "settings.save.cancel")}
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={onSave}
            className="min-h-11 rounded-full px-4 text-sm font-bold text-[var(--cabinet-on-gold)] disabled:opacity-60"
            style={{ background: "linear-gradient(135deg, #f6dc8e, #e0aa3e)" }}
          >
            {t(lang, "settings.save.submit")}
          </button>
        </div>
      </div>
    </div>
  );
}
