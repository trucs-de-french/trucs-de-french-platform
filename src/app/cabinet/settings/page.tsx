import { redirect } from "next/navigation";
import { t } from "@/lib/i18n/t";
import { createClient } from "@/lib/supabase/server";
import { normalizeUiLang } from "@/lib/ui/product-lang";
import { getExamSettingsData } from "@/lib/cabinet/home-data";
import { signOut } from "@/app/login/actions";
import { CabinetMobileHeader } from "@/components/cabinet/mobile-header";
import { SettingsForm } from "@/components/cabinet/settings/settings-form";
import type { Profile } from "@/lib/supabase/profile";

export default async function CabinetSettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login"); // guarded by cabinet/layout.tsx теж — подвійний захист не шкодить
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, full_name, ui_lang, avatar_url, avatar_mascot, notification_prefs, weekly_goal_scenes")
    .eq("id", user.id)
    .single<
      Pick<
        Profile,
        "role" | "full_name" | "ui_lang" | "avatar_url" | "avatar_mascot" | "notification_prefs" | "weekly_goal_scenes"
      >
    >();

  const lang = normalizeUiLang(profile?.ui_lang);
  const { exam, showExamCard } = await getExamSettingsData(supabase, user.id);

  return (
    <div className="flex flex-col gap-6">
      <CabinetMobileHeader />

      <header>
        <h1 className="font-body text-2xl font-semibold text-[var(--cabinet-ink)] sm:text-3xl">
          {t(lang, "cabinet.nav.settings")}
        </h1>
        <p className="mt-1 text-sm text-[var(--cabinet-muted)]">{t(lang, "cabinet.settings.subtitle")}</p>
      </header>

      <SettingsForm
        lang={lang}
        userId={user.id}
        email={user.email ?? ""}
        isTeacher={profile?.role === "teacher"}
        initialName={profile?.full_name ?? ""}
        initialMascot={profile?.avatar_mascot ?? null}
        initialAvatarUrl={profile?.avatar_url ?? null}
        initialNotificationPrefs={profile?.notification_prefs ?? { review: true, weekly_goal: true, news: false }}
        weeklyGoal={profile?.weekly_goal_scenes ?? 3}
        exam={exam}
        showExamCard={showExamCard}
        onSignOut={signOut}
      />
    </div>
  );
}
