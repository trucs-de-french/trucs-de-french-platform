"use client";

// Підтвердження видалення акаунта — модалка (createPortal, Z_MODAL), той
// самий overlay-патерн, що rich-article-editor.tsx. Кнопка підтвердження
// розблокована лише коли введене слово ТОЧНО збігається зі словом свого
// мовою (settings.account.delete.confirmWord): uk "ВИДАЛИТИ", fr
// "SUPPRIMER", en "DELETE".
import { useState } from "react";
import { createPortal } from "react-dom";
import { t } from "@/lib/i18n/t";
import type { UiLang } from "@/lib/ui/product-lang";
import { Z_MODAL } from "@/lib/z-layers";

export function DeleteAccountDialog({
  lang,
  pending,
  error,
  onConfirm,
  onClose,
}: {
  lang: UiLang;
  pending: boolean;
  error: string | null;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const [input, setInput] = useState("");
  const confirmWord = t(lang, "settings.account.delete.confirmWord");
  const canConfirm = input.trim() === confirmWord;

  return createPortal(
    <div
      className={`fixed inset-0 ${Z_MODAL} flex items-center justify-center bg-black/50 p-4`}
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t(lang, "settings.account.delete.title")}
        onClick={(e) => e.stopPropagation()}
        className="cabinet-card flex w-full max-w-sm flex-col gap-3 p-5"
      >
        <h3 className="font-body text-lg font-semibold text-[var(--cabinet-ink)]">
          {t(lang, "settings.account.delete.title")}
        </h3>
        <p className="text-sm text-[var(--cabinet-muted)]">{t(lang, "settings.account.delete.body")}</p>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-semibold text-[var(--cabinet-muted)]">
            {t(lang, "settings.account.delete.inputLabel", { word: confirmWord })}
          </span>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            className="cabinet-input"
            autoFocus
          />
        </label>
        {error && <p className="text-xs text-red-600">{error}</p>}
        <div className="mt-1 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={pending}
            className="flex min-h-11 items-center justify-center rounded-full border border-[var(--cabinet-line)] bg-transparent px-4 text-sm font-bold text-[var(--cabinet-ghost-fg)] hover:bg-[var(--cabinet-ghost-bg-hover)] disabled:opacity-60 dark:border-[1.5px] dark:border-[var(--cabinet-btn-border)]"
          >
            {t(lang, "settings.account.delete.cancel")}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={!canConfirm || pending}
            className="min-h-11 rounded-full bg-red-600 px-4 text-sm font-bold text-white hover:bg-red-700 disabled:opacity-40"
          >
            {t(lang, "settings.account.delete.confirm")}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
