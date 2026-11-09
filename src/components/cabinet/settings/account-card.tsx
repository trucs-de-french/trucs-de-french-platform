"use client";

// Пароль/вихід/видалення акаунта. "Вийти" — наявна дія signOut (та сама,
// що сайдбар/Ще), передана пропсом, не дубльована тут. Видалення —
// окрема модалка (delete-account-dialog.tsx) + серверна дія deleteAccount
// (service-role, лише на сервері).
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Lock, LogOut, Trash2 } from "lucide-react";
import { t } from "@/lib/i18n/t";
import type { UiLang } from "@/lib/ui/product-lang";
import { requestPasswordReset, deleteAccount } from "@/app/cabinet/settings/actions";
import { DeleteAccountDialog } from "./delete-account-dialog";

export function AccountCard({
  lang,
  isTeacher,
  onSignOut,
}: {
  lang: UiLang;
  isTeacher: boolean;
  onSignOut: () => Promise<void>;
}) {
  const router = useRouter();
  const [resetPending, startReset] = useTransition();
  const [resetMessage, setResetMessage] = useState<string | null>(null);
  const [resetError, setResetError] = useState(false);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [deletePending, startDelete] = useTransition();
  const [deleteError, setDeleteError] = useState<string | null>(null);

  function handleResetPassword() {
    setResetMessage(null);
    setResetError(false);
    startReset(async () => {
      const result = await requestPasswordReset();
      if (result.ok) {
        setResetMessage(t(lang, "settings.account.changePassword.sent"));
      } else {
        setResetError(true);
        setResetMessage(t(lang, "settings.account.changePassword.error"));
      }
    });
  }

  function handleConfirmDelete() {
    setDeleteError(null);
    startDelete(async () => {
      if (isTeacher) {
        setDeleteError(t(lang, "settings.account.delete.blocked"));
        return;
      }
      const result = await deleteAccount();
      if (result && !result.ok) {
        setDeleteError(
          result.error === "role"
            ? t(lang, "settings.account.delete.blocked")
            : t(lang, "settings.account.delete.error")
        );
      } else {
        router.push("/login");
      }
    });
  }

  return (
    <div className="cabinet-card flex flex-col gap-4 p-5">
      <h3 className="font-body text-lg font-semibold text-[var(--cabinet-ink)]">
        {t(lang, "settings.section.account")}
      </h3>

      {/* Variant C: три рівноважні кнопки в один ряд (ширина по вмісту,
          не на всю ширину картки), wrap на вузьких екранах — "Видалити
          акаунт" та самого розміру/форми, лише притлумлена (не червона)
          через settings-account-btn--danger. */}
      <div className="flex flex-wrap gap-2.5">
        <button
          type="button"
          disabled={resetPending}
          onClick={handleResetPassword}
          className="settings-account-btn"
        >
          <Lock size={17} strokeWidth={2} aria-hidden="true" />
          {t(lang, "settings.account.changePassword")}
        </button>

        <form action={onSignOut}>
          <button type="submit" className="settings-account-btn">
            <LogOut size={17} strokeWidth={2} aria-hidden="true" />
            {t(lang, "cabinet.nav.signOut")}
          </button>
        </form>

        <button
          type="button"
          onClick={() => setDialogOpen(true)}
          className="settings-account-btn settings-account-btn--danger"
        >
          <Trash2 size={17} strokeWidth={2} aria-hidden="true" />
          {t(lang, "settings.account.delete")}
        </button>
      </div>

      {resetMessage && (
        <p
          className={`text-xs ${
            resetError ? "text-[#9b4a44] dark:text-[#e2a49c]" : "text-[var(--cabinet-muted)]"
          }`}
        >
          {resetMessage}
        </p>
      )}

      {dialogOpen && (
        <DeleteAccountDialog
          lang={lang}
          pending={deletePending}
          error={deleteError}
          onConfirm={handleConfirmDelete}
          onClose={() => {
            setDialogOpen(false);
            setDeleteError(null);
          }}
        />
      )}
    </div>
  );
}
