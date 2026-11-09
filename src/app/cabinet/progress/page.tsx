import { createClient } from "@/lib/supabase/server";
import { normalizeUiLang } from "@/lib/ui/product-lang";
import { t } from "@/lib/i18n/t";
import { getCabinetProgressData } from "@/lib/cabinet/progress-data";
import { getAchievements, type AchievementState } from "@/lib/cabinet/achievements";
import { CabinetMobileHeader } from "@/components/cabinet/mobile-header";
import { StatTiles } from "@/components/cabinet/home/stat-tiles";
import { PointsChart } from "@/components/cabinet/progress/points-chart";
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

      <header>
        <h1 className="font-body text-2xl font-semibold text-[var(--cabinet-ink)] sm:text-3xl">
          {t(lang, "cabinet.nav.progress")}
        </h1>
        <p className="mt-1 text-sm text-[var(--cabinet-muted)]">{t(lang, "cabinet.progress.subtitle")}</p>
      </header>

      <StatTiles
        lang={lang}
        scenesCompleted={data.home.scenesCompleted}
        streakDays={data.home.streakDays}
        pointsThisWeek={data.home.pointsThisWeek}
        redoCount={data.home.redoCount}
      />

      <div className={hasDelfSkills ? "grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]" : ""}>
        <PointsChart lang={lang} week={data.pointsByWeek} month={data.pointsByMonth} />
        {hasDelfSkills && <DelfSkillsCard lang={lang} skills={data.delfSkills} />}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <SceneResults lang={lang} items={data.sceneResults} />
        <div id="achievements">
          <AchievementsCard lang={lang} items={achievements.items} showExamCard={achievements.showExamCard} />
        </div>
      </div>
    </div>
  );
}
