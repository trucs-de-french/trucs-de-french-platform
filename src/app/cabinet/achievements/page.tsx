import { createClient } from "@/lib/supabase/server";
import { normalizeUiLang } from "@/lib/ui/product-lang";
import { t } from "@/lib/i18n/t";
import { getAchievements, EMPTY_BADGE_STATS, type AchievementsResult } from "@/lib/cabinet/achievements";
import { CabinetMobileHeader } from "@/components/cabinet/mobile-header";
import { PageHeader } from "@/components/cabinet/page-header";
import { FullAchievements } from "@/components/cabinet/achievements/full-achievements";
import type { Profile } from "@/lib/supabase/profile";

export default async function CabinetAchievementsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null; // guarded by cabinet/layout.tsx — не повинно трапитись
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("ui_lang, role")
    .eq("id", user.id)
    .single<Pick<Profile, "ui_lang" | "role">>();

  const lang = normalizeUiLang(profile?.ui_lang);
  // Та сама перевірка, що показує "Адмінка" в sidebar (cabinet/layout.tsx)
  // — у цьому проєкті немає окремої ролі "admin", викладач виконує цю
  // роль. isAdmin лише відкриває UI (чипи/симулятор), нічого не пише в БД.
  const isAdmin = profile?.role === "teacher";
  const achievements = await getAchievements(supabase, user.id).catch((err): AchievementsResult => {
    console.error("getAchievements failed on Achievements page", err);
    return { items: [], showExamCard: false, stats: EMPTY_BADGE_STATS, earnedAtById: {} };
  });

  return (
    <div className="flex flex-col gap-6">
      <CabinetMobileHeader />

      <PageHeader
        title={t(lang, "progress.achievements.title")}
        backHref="/cabinet/progress"
        backLabel={t(lang, "cabinet.nav.progress")}
      />

      <div className="cabinet-card flex flex-col gap-5 p-5">
        <FullAchievements
          lang={lang}
          realStats={achievements.stats}
          earnedAtById={achievements.earnedAtById}
          showExamCard={achievements.showExamCard}
          isAdmin={isAdmin}
        />
      </div>
    </div>
  );
}
