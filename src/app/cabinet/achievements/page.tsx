import { createClient } from "@/lib/supabase/server";
import { normalizeUiLang } from "@/lib/ui/product-lang";
import { t } from "@/lib/i18n/t";
import { getAchievements, type AchievementState } from "@/lib/cabinet/achievements";
import { CabinetMobileHeader } from "@/components/cabinet/mobile-header";
import { CardTitle } from "@/components/cabinet/card-title";
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
    .select("ui_lang")
    .eq("id", user.id)
    .single<Pick<Profile, "ui_lang">>();

  const lang = normalizeUiLang(profile?.ui_lang);
  const achievements = await getAchievements(supabase, user.id).catch(
    (err): { items: AchievementState[]; showExamCard: boolean } => {
      console.error("getAchievements failed on Achievements page", err);
      return { items: [], showExamCard: false };
    }
  );

  return (
    <div className="flex flex-col gap-6">
      <CabinetMobileHeader />

      <div className="cabinet-card flex flex-col gap-5 p-5">
        <CardTitle>{t(lang, "progress.achievements.title")}</CardTitle>
        <FullAchievements lang={lang} items={achievements.items} showExamCard={achievements.showExamCard} />
      </div>
    </div>
  );
}
