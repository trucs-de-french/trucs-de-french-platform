import { createClient } from "@/lib/supabase/server";
import { normalizeUiLang } from "@/lib/ui/product-lang";
import { getCabinetHomeData, getNewLibraryItems } from "@/lib/cabinet/home-data";
import { getAchievements, EMPTY_BADGE_STATS, type AchievementsResult } from "@/lib/cabinet/achievements";
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
  const [home, newLibraryItems, achievements] = await Promise.all([
    getCabinetHomeData(supabase, user.id),
    getNewLibraryItems(supabase),
    getAchievements(supabase, user.id).catch((err): AchievementsResult => {
      console.error("getAchievements failed on Home", err);
      return { items: [], showExamCard: false, stats: EMPTY_BADGE_STATS, earnedAtById: {} };
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

      {/* Один спільний grid для обох рядків (досягнення+іспит, продовжити+
          цитата) — .cabinet-home-split, одна й та сама колонкова сітка
          (minmax(0,1fr) 300px, <760px — 1 колонка) для обох рядків, щоб
          вертикальний gutter лежав в одній точці на всю висоту. Порядок
          завжди [досягнення, іспит, продовжити, цитата] — і на >=760px
          (2 рядки по 2), і на <760px (1 колонка, той самий порядок);
          попередній окремий мобільний блок із "Продовжити" першим
          прибрано — колишня причина дублювання блоків. */}
      <div className="cabinet-home-split">
        {/* display:contents, не "без класу", коли є Іспит-картка — щоб
            обгортка не ставала власним grid-item'ом (тоді align-items:
            stretch тягнув би ЦЮ порожню обгортку, не саму картку
            досягнень усередині неї) і сама картка лишалась прямим
            grid-item'ом, як і раніше. */}
        <div className={home.showExamCard ? "contents" : "cabinet-home-split-full"}>
          <AchievementsHomeCard
            lang={lang}
            realStats={achievements.stats}
            earnedAtById={achievements.earnedAtById}
            showExamCard={achievements.showExamCard}
          />
        </div>
        {home.showExamCard && <ExamCard lang={lang} exam={home.exam} />}
        <ContinueCard lang={lang} target={home.continueTarget} />
        <QuoteCard lang={lang} quote={quote} />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <WeeklyGoalCard lang={lang} done={home.weeklyGoal.done} goal={home.weeklyGoal.goal} />
        <QuickActionsCard lang={lang} />
        <RedoList lang={lang} items={home.redoList} totalCount={home.redoCount} />
      </div>

      <LibraryCarousel lang={lang} items={newLibraryItems} />

      <CabinetFooter lang={lang} />
    </div>
  );
}
