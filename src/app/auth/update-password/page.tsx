import { redirect } from "next/navigation";
import { Lock } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { t } from "@/lib/i18n/t";
import { AuthShell } from "@/components/auth/auth-shell";
import { UpdatePasswordForm } from "./update-password-form";

const lang = "uk" as const;

// Серверна перевірка сесії ДО рендеру — без "checking"-скелетона: немає
// клієнтського завантаження, якого треба б чекати (на відміну від
// клієнтського onAuthStateChange-підходу, якого тут свідомо немає —
// /auth/confirm уже створив сесію до редіректу сюди token_hash+verifyOtp,
// render thus happens only once we already know getUser()'s answer).
export default async function UpdatePasswordPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/forgot-password?error=expired");
  }

  return (
    <AuthShell
      variant="heading"
      heading={{
        title: t(lang, "auth.updatePassword.heading"),
        lead: t(lang, "auth.updatePassword.headingLead"),
      }}
      icon={<Lock size={32} aria-hidden="true" />}
      iconAriaLabel={t(lang, "auth.updatePassword.avatarAria")}
      title={t(lang, "auth.updatePassword.title")}
    >
      <UpdatePasswordForm />
    </AuthShell>
  );
}
