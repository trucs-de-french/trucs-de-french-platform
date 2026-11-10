import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { normalizeUiLang } from "@/lib/ui/product-lang";
import { t } from "@/lib/i18n/t";
import { getAchievements, EMPTY_BADGE_STATS } from "@/lib/cabinet/achievements";
import { AdminShell } from "@/components/admin/admin-shell";
import { PageHeader } from "@/components/cabinet/page-header";
import { AdminPreviewProvider } from "@/lib/cabinet/admin-preview";
import { AdminPreviewBar } from "@/components/cabinet/admin-preview-bar";
import { AdminSimulatorPanel } from "./simulator-panel";
import { THEME_COOKIE, parseThemeCookieValue } from "@/lib/theme-cookie";
import { getAdminSidebarProfile } from "@/lib/admin/admin-profile";
import type { Profile } from "@/lib/supabase/profile";

// Адмін-сторінка симулятора досягнень — лише вчителі (guard: admin/
// layout.tsx вище). Prefill інпутів бере РЕАЛЬНІ stats цього вчителя
// (getAchievements, та сама функція, що й /cabinet/achievements); сам
// override живе лише в localStorage цього браузера (lib/cabinet/
// admin-preview.tsx) — нічого не пишеться в Supabase.
export default async function AchievementsPreviewPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null; // guarded by admin/layout.tsx — не повинно трапитись
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("ui_lang")
    .eq("id", user.id)
    .single<Pick<Profile, "ui_lang">>();

  const lang = normalizeUiLang(profile?.ui_lang);
  const { stats } = await getAchievements(supabase, user.id).catch(() => ({ stats: EMPTY_BADGE_STATS }));
  const sidebarProfile = await getAdminSidebarProfile(supabase, user.id);

  const cookieStore = await cookies();
  const initialIsDark = parseThemeCookieValue(cookieStore.get(THEME_COOKIE)?.value);

  return (
    <AdminShell
      initialIsDark={initialIsDark}
      fullName={sidebarProfile.fullName}
      avatarUrl={sidebarProfile.avatarUrl}
      avatarMascot={sidebarProfile.avatarMascot}
    >
      <AdminPreviewProvider>
        <AdminPreviewBar lang={lang} />
        <PageHeader
          title={t(lang, "achievements.admin.page.title")}
          subtitle={t(lang, "achievements.admin.page.subtitle")}
        />
        <AdminSimulatorPanel lang={lang} realStats={stats} />
      </AdminPreviewProvider>
    </AdminShell>
  );
}
