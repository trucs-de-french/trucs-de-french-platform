import { t } from "@/lib/i18n/t";
import { createClient } from "@/lib/supabase/server";
import { normalizeUiLang } from "@/lib/ui/product-lang";
import { getCabinetHomeData } from "@/lib/cabinet/home-data";
import { CabinetMobileHeader } from "@/components/cabinet/mobile-header";
import { StatTiles } from "@/components/cabinet/home/stat-tiles";
import { ContinueCard } from "@/components/cabinet/home/continue-card";
import { ProgressChart } from "@/components/cabinet/home/progress-chart";
import { RedoList } from "@/components/cabinet/home/redo-list";
import { ProfileCard } from "@/components/cabinet/home/profile-card";
import { ExamCard } from "@/components/cabinet/home/exam-card";
import { CalendarCard } from "@/components/cabinet/home/calendar-card";
import { WeeklyGoalCard } from "@/components/cabinet/home/weekly-goal-card";
import type { Profile } from "@/lib/supabase/profile";

export default async function CabinetHomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null; // guarded by cabinet/layout.tsx — не повинно трапитись
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, ui_lang")
    .eq("id", user.id)
    .single<Pick<Profile, "role" | "ui_lang">>();

  const lang = normalizeUiLang(profile?.ui_lang);
  const isTeacher = profile?.role === "teacher";
  const home = await getCabinetHomeData(supabase, user.id);

  const firstName = home.fullName?.split(" ")[0] || "";

  return (
    <div className="flex flex-col gap-6">
      <CabinetMobileHeader />

      <header>
        <h1 className="font-body text-2xl font-semibold text-[var(--cabinet-ink)] sm:text-3xl">
          {t(lang, "cabinet.home.greeting", { name: firstName })}
        </h1>
        <p className="mt-1 text-sm text-[var(--cabinet-muted)]">
          {home.continueTarget?.sceneTitle
            ? t(lang, "home.subtitle.continue", { scene: home.continueTarget.sceneTitle })
            : t(lang, "home.subtitle.empty")}
        </p>
      </header>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
        <div className="flex flex-col gap-6">
          <StatTiles
            lang={lang}
            scenesCompleted={home.scenesCompleted}
            streakDays={home.streakDays}
            pointsThisWeek={home.pointsThisWeek}
            redoCount={home.redoCount}
          />

          <ContinueCard lang={lang} target={home.continueTarget} />

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <ProgressChart lang={lang} data={home.pointsByDay} />
            <RedoList lang={lang} items={home.redoList} />
          </div>
        </div>

        <div className="flex flex-col gap-6">
          <ProfileCard lang={lang} fullName={home.fullName} isTeacher={isTeacher} />
          {home.showExamCard && <ExamCard lang={lang} exam={home.exam} />}
          <CalendarCard lang={lang} activeDays={home.activeDays} />
          <WeeklyGoalCard lang={lang} done={home.weeklyGoal.done} goal={home.weeklyGoal.goal} />
        </div>
      </div>
    </div>
  );
}
