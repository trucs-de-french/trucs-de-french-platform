import { createClient } from "@/lib/supabase/server";
import { normalizeUiLang } from "@/lib/ui/product-lang";
import { getCabinetHomeData, getNewLibraryItems } from "@/lib/cabinet/home-data";
import { getAchievements, pickHomeAchievements, type AchievementState } from "@/lib/cabinet/achievements";
import { getDailyQuote } from "@/lib/cabinet/quotes";
import { CabinetMobileHeader } from "@/components/cabinet/mobile-header";
import { GreetingHero } from "@/components/cabinet/home/greeting-hero";
import { ContinueCard } from "@/components/cabinet/home/continue-card";
import { ExamCard } from "@/components/cabinet/home/exam-card";
import { WeeklyGoalCard } from "@/components/cabinet/home/weekly-goal-card";
import { AchievementsHomeCard } from "@/components/cabinet/home/achievements-home-card";
import { QuoteCard } from "@/components/cabinet/home/quote-card";
import { QuickActionsCard } from "@/components/cabinet/home/quick-actions-card";
import { RedoList } from "@/components/cabinet/home/redo-list";
import { LibraryCarousel } from "@/components/cabinet/home/library-carousel";
import { CabinetFooter } from "@/components/cabinet/home/cabinet-footer";
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
    .select("ui_lang")
    .eq("id", user.id)
    .single<Pick<Profile, "ui_lang">>();

  const lang = normalizeUiLang(profile?.ui_lang);
  const [home, newLibraryItems, achievementItems] = await Promise.all([
    getCabinetHomeData(supabase, user.id),
    getNewLibraryItems(supabase),
    getAchievements(supabase, user.id)
      .then((r) => pickHomeAchievements(r.items, r.showExamCard))
      .catch((err): AchievementState[] => {
        console.error("getAchievements failed on Home", err);
        return [];
      }),
  ]);
  const quote = getDailyQuote();

  const firstName = home.fullName?.split(" ")[0] || "";

  return (
    <div className="flex flex-col gap-6">
      <CabinetMobileHeader />

      <GreetingHero
        lang={lang}
        firstName={firstName}
        fullName={home.fullName}
        avatarUrl={home.avatarUrl}
        avatarMascot={home.avatarMascot}
        streakDays={home.streakDays}
        weekActiveDays={home.weekActiveDays}
        level={home.continueTarget?.productLevel ?? null}
      />

      {/* Два різні порядки блоків (десктоп/мобільний) з макету v4 — явно
          продубльовано (hidden lg:flex / lg:hidden), а не одна CSS grid
          з order: на мобільному "Продовжити" йде першим, на десктопі —
          лише другим рядком після "Останні досягнення"/"Іспит". */}
      <div className="hidden flex-col gap-4 lg:flex">
        <div
          className={
            home.showExamCard ? "grid grid-cols-1 items-stretch gap-4 lg:grid-cols-[1fr_320px]" : "grid grid-cols-1"
          }
        >
          <AchievementsHomeCard lang={lang} items={achievementItems} />
          {home.showExamCard && <ExamCard lang={lang} exam={home.exam} />}
        </div>

        <div className="grid grid-cols-1 items-stretch gap-4 lg:grid-cols-[1fr_320px]">
          <ContinueCard lang={lang} target={home.continueTarget} />
          <QuoteCard lang={lang} quote={quote} />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <WeeklyGoalCard lang={lang} done={home.weeklyGoal.done} goal={home.weeklyGoal.goal} />
          <QuickActionsCard lang={lang} />
          <RedoList lang={lang} items={home.redoList} totalCount={home.redoCount} />
        </div>

        <LibraryCarousel lang={lang} items={newLibraryItems} />
      </div>

      <div className="flex flex-col gap-4 lg:hidden">
        <ContinueCard lang={lang} target={home.continueTarget} />
        <AchievementsHomeCard lang={lang} items={achievementItems} />
        {home.showExamCard && <ExamCard lang={lang} exam={home.exam} />}
        <WeeklyGoalCard lang={lang} done={home.weeklyGoal.done} goal={home.weeklyGoal.goal} />
        <QuickActionsCard lang={lang} />
        <RedoList lang={lang} items={home.redoList} totalCount={home.redoCount} />
        <QuoteCard lang={lang} quote={quote} />
        <LibraryCarousel lang={lang} items={newLibraryItems} />
      </div>

      <CabinetFooter lang={lang} />
    </div>
  );
}
