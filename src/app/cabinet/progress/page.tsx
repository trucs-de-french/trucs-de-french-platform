import { createClient } from "@/lib/supabase/server";
import { normalizeUiLang } from "@/lib/ui/product-lang";
import { t } from "@/lib/i18n/t";
import { getCabinetProgressData } from "@/lib/cabinet/progress-data";
import { getAchievements, type AchievementState } from "@/lib/cabinet/achievements";
import { CabinetMobileHeader } from "@/components/cabinet/mobile-header";
import { PageHeader } from "@/components/cabinet/page-header";
import { StatTiles } from "@/components/cabinet/home/stat-tiles";
import { SceneResults } from "@/components/cabinet/progress/scene-results";
import { AchievementsCard } from "@/components/cabinet/progress/achievements-card";
import { DelfSkillsCard } from "@/components/cabinet/progress/delf-skills-card";
import type { Profile } from "@/lib/supabase/profile";

export default async function CabinetProgressPage() {
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
  const [data, achievements] = await Promise.all([
    getCabinetProgressData(supabase, user.id),
    getAchievements(supabase, user.id).catch((err): { items: AchievementState[]; showExamCard: boolean } => {
      console.error("getAchievements failed on Progress", err);
      return { items: [], showExamCard: false };
    }),
  ]);
  const hasDelfSkills = data.delfSkills !== null;

  return (
    <div className="flex flex-col gap-6">
      <CabinetMobileHeader />

      <PageHeader title={t(lang, "cabinet.nav.progress")} subtitle={t(lang, "cabinet.progress.subtitle")} />

      <StatTiles
        lang={lang}
        scenesCompleted={data.home.scenesCompleted}
        streakDays={data.home.streakDays}
        pointsThisWeek={data.home.pointsThisWeek}
        redoCount={data.home.redoCount}
      />

      <AchievementsCard lang={lang} items={achievements.items} showExamCard={achievements.showExamCard} />

      <div
        className={
          hasDelfSkills
            ? "grid grid-cols-1 items-stretch gap-[18px] min-[900px]:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]"
            : ""
        }
      >
        <SceneResults lang={lang} items={data.sceneResults} />
        {hasDelfSkills && <DelfSkillsCard lang={lang} skills={data.delfSkills} />}
      </div>
    </div>
  );
}
