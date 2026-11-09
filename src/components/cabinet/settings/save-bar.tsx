"use client";

// Плаваюча пілюля "Є незбережені зміни" — sticky (не fixed) усередині
// колонки контенту сторінки: природно центрується над .cabinet-panel
// (не над усім вікном, сайдбар лишається поза нею) і НЕ потребує рахувати
// ширину сайдбару вручну. Той самий scroll-контейнер (.cabinet-panel на
// десктопі, документ на мобільному, де .cabinet-bottom-bar лишається
// position:fixed окремо) — bottom-офсет під мобільний нижній таб-бар
// рахує сам CSS (settings-save-pill-wrap, globals.css).
//
// Власна машина станів (closed -> open -> success -> closing -> closed),
// а не просто {dirty && <...>}: після успішного збереження батьківський
// dirty одразу стає false, але пілюля має ще ~1.5с показати "Збережено" з
// галочкою, а потім згаснути зворотною анімацією — цього batch-рендеру
// з dirty не видно, тож стан веде компонент сам.
import { useEffect, useRef, useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { t } from "@/lib/i18n/t";
import type { UiLang } from "@/lib/ui/product-lang";

type Phase = "closed" | "open" | "success" | "closing";

export function SettingsSaveBar({
  lang,
  dirty,
  error,
  onCancel,
  onSave,
}: {
  lang: UiLang;
  dirty: boolean;
  error: string | null;
  onCancel: () => void;
  onSave: () => Promise<boolean>;
}) {
  const [phase, setPhase] = useState<Phase>("closed");
  const [pending, setPending] = useState(false);
  const prevDirty = useRef(dirty);

  useEffect(() => {
    if (dirty && !prevDirty.current) {
      setPhase("open");
    } else if (!dirty && prevDirty.current) {
      setPhase((p) => (p === "success" ? p : "closing"));
    }
    prevDirty.current = dirty;
  }, [dirty]);

  useEffect(() => {
    if (phase === "success") {
      const id = setTimeout(() => setPhase("closing"), 1500);
      return () => clearTimeout(id);
    }
    if (phase === "closing") {
      const id = setTimeout(() => setPhase("closed"), 180);
      return () => clearTimeout(id);
    }
  }, [phase]);

  async function handleSaveClick() {
    setPending(true);
    const ok = await onSave();
    setPending(false);
    if (ok) setPhase("success");
  }

  if (phase === "closed") return null;

  return (
    <div className="settings-save-pill-wrap">
      <div
        role="status"
        className={`settings-save-pill ${phase === "closing" ? "settings-save-pill--exit" : "settings-save-pill--enter"}`}
      >
        {phase === "success" ? (
          <span className="settings-save-pill-text">
            <Check size={14} aria-hidden="true" />
            {t(lang, "settings.save.done")}
          </span>
        ) : (
          <>
            <span className="settings-save-pill-text">
              <span className="settings-save-pill-dot" aria-hidden="true" />
              {t(lang, "settings.save.unsaved")}
            </span>
            {error && <p className="settings-save-pill-error">{error}</p>}
            <div className="settings-save-pill-actions">
              <button
                type="button"
                disabled={pending}
                onClick={onCancel}
                className="settings-save-pill-cancel"
              >
                {t(lang, "settings.save.cancel")}
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={handleSaveClick}
                aria-label={t(lang, "settings.save.submitAriaLabel")}
                className="settings-save-pill-submit"
              >
                {pending ? (
                  <Loader2 size={14} className="animate-spin" aria-hidden="true" />
                ) : (
                  t(lang, "settings.save.submit")
                )}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
