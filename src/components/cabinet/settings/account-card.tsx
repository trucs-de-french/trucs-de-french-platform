"use client";

// Пароль/вихід/видалення акаунта. "Вийти" — наявна дія signOut (та сама,
// що сайдбар/Ще), передана пропсом, не дубльована тут. Видалення —
// окрема модалка (delete-account-dialog.tsx) + серверна дія deleteAccount
// (service-role, лише на сервері).
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
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

      <div className="flex flex-col gap-2">
        <button
          type="button"
          disabled={resetPending}
          onClick={handleResetPassword}
          className="flex min-h-11 w-full items-center justify-center rounded-full border border-[var(--cabinet-line)] bg-transparent text-sm font-bold text-[var(--cabinet-ghost-fg)] hover:bg-[var(--cabinet-ghost-bg-hover)] disabled:opacity-60 dark:border-[1.5px] dark:border-[var(--cabinet-btn-border)] sm:w-auto sm:px-4"
        >
          {t(lang, "settings.account.changePassword")}
        </button>
        {resetMessage && (
          <p
            className={`text-xs ${
              resetError ? "text-[#9b4a44] dark:text-[#e2a49c]" : "text-[var(--cabinet-muted)]"
            }`}
          >
            {resetMessage}
          </p>
        )}
      </div>

      <form action={onSignOut}>
        <button
          type="submit"
          className="flex min-h-11 w-full items-center justify-center rounded-full border border-[var(--cabinet-line)] bg-transparent text-sm font-bold text-[var(--cabinet-ghost-fg)] hover:bg-[var(--cabinet-ghost-bg-hover)] dark:border-[1.5px] dark:border-[var(--cabinet-btn-border)] sm:w-auto sm:px-4"
        >
          {t(lang, "cabinet.nav.signOut")}
        </button>
      </form>

      {/* Квітчаста/насичено-червона дія тут не потрібна — видалення й так
          захищене типізаним підтвердженням у модалці нижче; притлумлений
          тон (не #c0392b/#ff8f80) тримає контроль "тихим" поряд зі
          звичними gold-outline кнопками картки. */}
      <button
        type="button"
        onClick={() => setDialogOpen(true)}
        className="min-h-11 self-start rounded-full text-sm font-bold text-[#9b4a44] hover:text-[#843c37] hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#9b4a44] dark:text-[#e2a49c] dark:hover:text-[#efb8b0] dark:focus-visible:outline-[#e2a49c]"
      >
        {t(lang, "settings.account.delete")}
      </button>

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
